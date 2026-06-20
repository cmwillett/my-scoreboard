export function renderGameCard(game) {
  const status =
    game.status ||
    game.shortStatus ||
    game.displayStatus ||
    '-';

  const title =
    game.shortName ||
    game.matchup ||
    game.eventName ||
    'Game';

  const sport =
    game.sport ||
    game.sportKey ||
    '';

  return `
    <div class="score-card">
      <div class="score-card-top">
        <span>${sport}</span>
        <span>${status}</span>
      </div>

      <div class="team-row">
        <span>${title}</span>
      </div>
    </div>
  `;
}