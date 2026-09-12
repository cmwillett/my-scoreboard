// Grades "Pick 'Em" followed games once they go Final, and rolls them up
// into a this-week totals summary per sport (NFL / CFB). The two contests
// use different rules: NFL Pick 'Ems is straight-up (win the game outright,
// get the weight - the spread field isn't used at all), while CFB Picks is
// against the spread. This is intentionally "this week only": a followed
// team's spread and notes get overwritten the moment Craig enters next
// week's pick for that same team, so there is no season-long history here -
// just whatever is currently followed and tagged with isPickEm.
//
// The totals also reset on a fixed weekly clock per contest, independent of
// whether Craig has gotten around to re-entering next week's pick yet: CFB
// resets every Thursday (games are all Saturday), NFL resets every
// Wednesday (games span Thu/Sun/Mon, so Wednesday is the one day clear of
// games on either side). ESPN's own game-time field for a followed game
// isn't reliably a full parseable date once the game goes Final (it loses
// the month/day and becomes plain "Final"), so instead of the game's date,
// this uses the pick's own Firestore `updatedAt` - the moment Craig last
// saved that team's spread/notes/Pick 'Em tag. A pick not touched since the
// most recent reset boundary simply drops off the card until it's updated
// again for the new week - it isn't graded wrong, it's just not shown.

const RESET_WEEKDAY = { NFL: 3, CFB: 4 }; // Wed, Thu (0 = Sunday)

function mostRecentWeekdayBoundary_(now, targetDayOfWeek) {
  const boundary = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const diff = (boundary.getDay() - targetDayOfWeek + 7) % 7;
  boundary.setDate(boundary.getDate() - diff);
  return boundary;
}

function currentWeekBoundary_(sportKey, now) {
  const targetDay = RESET_WEEKDAY[sportKey];
  if (targetDay === undefined) return null;
  return mostRecentWeekdayBoundary_(now, targetDay);
}

function toMillis_(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function normalizeTeam_(value) {
  return String(value || '').trim().toLowerCase();
}

function isGameFinal_(game) {
  const rawStatus = String(game.rawStatus || '').toUpperCase();
  const status = String(game.status || '').toLowerCase();
  return (
    rawStatus === 'STATUS_FINAL' ||
    rawStatus === 'STATUS_COMPLETE' ||
    rawStatus === 'STATUS_FULL_TIME' ||
    status.includes('final') ||
    status.includes('complete')
  );
}

// Same pregame-status parser scoreboard.js uses to sort the main Live/
// Upcoming groups ("9/12 - 7:30 PM EDT" -> a real timestamp). Only works
// before kickoff - live ("Q2 05:12") and final ("Final") status text won't
// match, and that's expected: those games sort by status first (see
// sortPicks_ below), so a missing sortTime just means "keep it wherever the
// stable sort leaves it" among games that share a status group.
function parseGameStartTime_(text) {
  const match = String(text || '').match(/(\d{1,2})\/(\d{1,2})\D+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;

  const [, monthStr, dayStr, hourStr, minuteStr, ampm] = match;
  const month = Number(monthStr) - 1;
  const day = Number(dayStr);
  let hour = Number(hourStr) % 12;
  if (/pm/i.test(ampm)) hour += 12;
  const minute = Number(minuteStr);

  const now = new Date();
  const candidate = new Date(now.getFullYear(), month, day, hour, minute);

  const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
  if (candidate.getTime() < now.getTime() - twoWeeksMs) {
    candidate.setFullYear(candidate.getFullYear() + 1);
  }

  return candidate.getTime();
}

function getGameSortTime_(game) {
  return parseGameStartTime_(game.status) ?? parseGameStartTime_(game.startTime);
}

// Sports graded straight-up (win the game outright - spread is ignored even
// if one happens to be entered). Anything not listed here (currently just
// CFB) is graded against the spread.
const STRAIGHT_UP_SPORTS = ['NFL'];

// Grades a single followed-game pick. For spread sports, spread is stored
// relative to the picked team (e.g. "-23.5" means the picked team is
// favored by 23.5; "+10.5" means they're getting 10.5 points as an
// underdog). Weight is the plain point value Craig types into Notes for a
// Pick 'Em entry.
//
// status is one of:
//   pending  - game hasn't gone Final yet
//   unscored - game is Final but we can't grade it (missing spread on a
//              spread sport, missing scores, or the picked team name
//              doesn't match either side of the game - shouldn't normally
//              happen, but fail safe rather than showing a wrong result)
//   won / lost / push - graded outcome (straight-up or against the spread,
//              depending on the sport)
export function gradePick(followedGame) {
  const game = followedGame.live || followedGame;
  const weight = Number(followedGame.notes);
  const sportKey = String(followedGame.sportKey || game.sportKey || '').toUpperCase();
  const isStraightUp = STRAIGHT_UP_SPORTS.includes(sportKey);

  const base = {
    id: followedGame.id,
    sportKey,
    team: followedGame.team || followedGame.selectedTeam || '',
    opponent: followedGame.opponent || '',
    spread: isStraightUp ? '' : (followedGame.spread || ''),
    weight: Number.isFinite(weight) ? weight : null,
    status: 'pending',
    margin: null,
    sortTime: getGameSortTime_(game)
  };

  if (!isGameFinal_(game)) return base;

  const awayScore = Number(game.awayScore);
  const homeScore = Number(game.homeScore);
  if (Number.isNaN(awayScore) || Number.isNaN(homeScore)) {
    return { ...base, status: 'unscored' };
  }

  const pickedTeam = normalizeTeam_(base.team);
  let pickedScore;
  let opponentScore;

  if (normalizeTeam_(game.awayTeam) === pickedTeam) {
    pickedScore = awayScore;
    opponentScore = homeScore;
  } else if (normalizeTeam_(game.homeTeam) === pickedTeam) {
    pickedScore = homeScore;
    opponentScore = awayScore;
  } else {
    return { ...base, status: 'unscored' };
  }

  if (isStraightUp) {
    const margin = pickedScore - opponentScore;
    if (margin > 0) return { ...base, status: 'won', margin };
    if (margin < 0) return { ...base, status: 'lost', margin };
    return { ...base, status: 'push', margin: 0 };
  }

  const spread = parseFloat(followedGame.spread);
  if (!Number.isFinite(spread)) return { ...base, status: 'unscored' };

  const margin = (pickedScore - opponentScore) + spread;

  if (margin > 0) return { ...base, status: 'won', margin };
  if (margin < 0) return { ...base, status: 'lost', margin };
  return { ...base, status: 'push', margin: 0 };
}

// Settled picks (won/lost/push - and unscored, which means the game is done
// but couldn't be graded) go to the top of the card; whatever's still
// pending sorts underneath by game time, soonest first / latest last, per
// Craig's request. Games without a parseable time (live, or a pregame
// status we couldn't parse) fall to the bottom of their group rather than
// jumping the line.
function sortPicks_(picks) {
  const settledRank = { won: 0, lost: 0, push: 0, unscored: 0, pending: 1 };

  return [...picks].sort((a, b) => {
    const rankDiff = (settledRank[a.status] ?? 1) - (settledRank[b.status] ?? 1);
    if (rankDiff !== 0) return rankDiff;

    const aTime = a.sortTime ?? Number.MAX_SAFE_INTEGER;
    const bTime = b.sortTime ?? Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
}

// followedGames is the raw (pre-dedup) list from getFollowedGames() - one
// entry per followed team, each carrying its own spread/notes/isPickEm and
// Firestore updatedAt. `now` is overridable for testing; defaults to the
// real current time.
export function summarizeContest(followedGames, sportKey, now = new Date()) {
  const boundary = currentWeekBoundary_(sportKey, now);

  const picks = sortPicks_((followedGames || [])
    .filter(g => g.isPickEm === true && String(g.sportKey || '').toUpperCase() === sportKey)
    .filter(g => {
      if (!boundary) return true;
      const updatedMs = toMillis_(g.updatedAt);
      // No reliable updatedAt - safer to exclude than risk showing a
      // leftover pick from before the reset.
      if (updatedMs === null) return false;
      return updatedMs >= boundary.getTime();
    })
    .map(gradePick));

  const won = picks.filter(p => p.status === 'won');
  const lost = picks.filter(p => p.status === 'lost');
  const push = picks.filter(p => p.status === 'push');
  const pending = picks.filter(p => p.status === 'pending');
  const unscored = picks.filter(p => p.status === 'unscored');

  const weightWon = won.reduce((sum, p) => sum + (p.weight || 0), 0);
  const weightPossible = picks.reduce((sum, p) => sum + (p.weight || 0), 0);

  return {
    sportKey,
    picks,
    won,
    lost,
    push,
    pending,
    unscored,
    weightWon,
    weightPossible
  };
}
