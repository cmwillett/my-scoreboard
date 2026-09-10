// Grades "Pick 'Em" followed games against the spread once their game goes
// Final, and rolls them up into a this-week totals summary per sport (NFL /
// CFB). This is intentionally "this week only": a followed team's spread and
// notes get overwritten the moment Craig enters next week's pick for that
// same team, so there is no season-long history here - just whatever is
// currently followed and tagged with isPickEm.

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

// Grades a single followed-game pick. Spread is stored relative to the
// picked team (e.g. "-23.5" means the picked team is favored by 23.5;
// "+10.5" means they're getting 10.5 points as an underdog). Weight is the
// plain point value Craig types into Notes for a Pick 'Em entry.
//
// status is one of:
//   pending  - game hasn't gone Final yet
//   unscored - game is Final but we can't grade it (missing/blank spread,
//              missing scores, or the picked team name doesn't match either
//              side of the game - shouldn't normally happen, but fail safe
//              rather than showing a wrong result)
//   won / lost / push - graded outcome against the spread
export function gradePick(followedGame) {
  const game = followedGame.live || followedGame;
  const weight = Number(followedGame.notes);

  const base = {
    id: followedGame.id,
    sportKey: followedGame.sportKey || game.sportKey || '',
    team: followedGame.team || followedGame.selectedTeam || '',
    opponent: followedGame.opponent || '',
    spread: followedGame.spread || '',
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

  const spread = parseFloat(base.spread);
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
