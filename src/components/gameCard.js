export function renderGameCard(game) {
  const status = game.status || game.startTime || '';
  const sport = game.sport || '';
  const channel = game.channel || '';

  const hasTeams =
    game.awayTeam &&
    game.homeTeam;

  if (hasTeams) {
    return `
      <div class="score-card">
        <div class="score-card-top">
          <span>${sport}</span>
          <span>${status}</span>
        </div>

        <div class="team-row">
          <span>${game.awayTeam}</span>
          <strong>${game.awayScore ?? '-'}</strong>
        </div>

        <div class="team-row">
          <span>${game.homeTeam}</span>
          <strong>${game.homeScore ?? '-'}</strong>
        </div>

        ${
          channel
            ? `
              <div class="game-channel">
                ${channel}
              </div>
            `
            : ''
        }
      </div>
    `;
  }

  return `
    <div class="score-card">
      <div class="score-card-top">
        <span>${sport}</span>
        <span>${status}</span>
      </div>

      <div class="team-row">
        <span>${game.shortName || game.name}</span>
      </div>
    </div>
  `;
}