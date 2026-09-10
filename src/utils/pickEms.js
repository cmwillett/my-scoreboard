// Grades "Pick 'Em" followed games once they go Final, and rolls them up
// into a this-week totals summary per sport (NFL / CFB). The two contests
// use different rules: NFL Pick 'Ems is straight-up (win the game outright,
// get the weight - the spread field isn't used at all), while CFB Picks is
// against the spread. This is intentionally "this week only": a followed
// team's spread and notes get overwritten the moment Craig enters next
// week's pick for that same team, so there is no season-long history here -
// just whatever is currently followed and tagged with isPickEm.

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
// entry per followed team, each carrying its own spread/notes/isPickEm.
export function summarizeContest(followedGames, sportKey) {
  const picks = (followedGames || [])
    .filter(g => g.isPickEm === true && String(g.sportKey || '').toUpperCase() === sportKey)
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
