export function renderGameCard(game) {
  const status = game.status || game.startTime || '';
  const sport = game.sport || '';
  const channel = game.channel || '';

  const awayScore = Number(game.awayScore);
  const homeScore = Number(game.homeScore);

  const awayLeading =
    !Number.isNaN(awayScore) &&
    !Number.isNaN(homeScore) &&
    awayScore > homeScore;

  const homeLeading =
    !Number.isNaN(awayScore) &&
    !Number.isNaN(homeScore) &&
    homeScore > awayScore;

  const isLive = game.rawStatus === 'STATUS_IN_PROGRESS';

  if (game.awayTeam && game.homeTeam) {
    return `
      <div class="score-card">
        <div class="score-card-top">
          <span>${sport}</span>
          <span class="${isLive ? 'game-live' : ''}">${status}</span>
        </div>

        <div class="team-row ${awayLeading ? 'leading' : ''}">
          <span>${game.awayTeam}</span>
          <strong>${game.awayScore || '-'}</strong>
        </div>

        <div class="team-row ${homeLeading ? 'leading' : ''}">
          <span>${game.homeTeam}</span>
          <strong>${game.homeScore || '-'}</strong>
        </div>

        ${
          channel
            ? `<div class="game-channel">${channel}</div>`
            : ''
        }
      </div>
    `;
  }

  return `
    <div class="score-card">
      <div class="score-card-top">
        <span>${sport}</span>
        <span class="${isLive ? 'game-live' : ''}">${status}</span>
      </div>

      <div class="team-row">
        <span>${game.shortName || game.name || 'Game'}</span>
      </div>
    </div>
  `;
}