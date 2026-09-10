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
    margin: null
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

// followedGames is the raw (pre-dedup) list from getFollowedGames() - one
// entry per followed team, each carrying its own spread/notes/isPickEm and
// Firestore updatedAt. `now` is overridable for testing; defaults to the
// real current time.
export function summarizeContest(followedGames, sportKey, now = new Date()) {
  const boundary = currentWeekBoundary_(sportKey, now);

  const picks = (followedGames || [])
    .filter(g => g.isPickEm === true && String(g.sportKey || '').toUpperCase() === sportKey)
    .filter(g => {
      if (!boundary) return true;
      const updatedMs = toMillis_(g.updatedAt);
      // No reliable updatedAt - safer to exclude than risk showing a
      // leftover pick from before the reset.
      if (updatedMs === null) return false;
      return updatedMs >= boundary.getTime();
    })
    .map(gradePick);

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
