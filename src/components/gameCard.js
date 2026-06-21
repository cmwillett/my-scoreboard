export function renderGameCard(followedGame) {
  const game = followedGame.live || followedGame;

  const status = game.status || game.startTime || '';
  const sport = game.sport || followedGame.sport || '';
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

  const isLive =
    game.rawStatus === 'STATUS_IN_PROGRESS' ||
    String(game.status || '').toLowerCase().includes('live');

  return `
    <div class="score-card" data-followed-game-id="${followedGame.id}">
      <div class="team-row ${awayLeading ? 'leading' : ''}">
        <span>${game.awayTeam || '-'}</span>
        <strong>${game.awayScore || '-'}</strong>
      </div>

      <div class="team-row ${homeLeading ? 'leading' : ''}">
        <span>${game.homeTeam || '-'}</span>
        <strong>${game.homeScore || '-'}</strong>
      </div>

<div class="game-meta-line">
  ${channel ? `<span>${channel}</span>` : ''}
  ${status ? `<span class="${isLive ? 'game-live' : ''}">${status}</span>` : ''}
</div>

${
  followedGame.spread || followedGame.notes
    ? `
      <div class="game-details">
        ${
          followedGame.spread
            ? `
              <div class="game-detail-block">
                <div class="game-detail-title">Spread</div>
                <div class="game-detail-text">
                  ${followedGame.spread}
                </div>
              </div>
            `
            : ''
        }

        ${
          followedGame.notes
            ? `
              <div class="game-detail-block">
                <div class="game-detail-title">Notes</div>
                <div class="game-detail-text">
                  ${followedGame.notes}
                </div>
              </div>
            `
            : ''
        }
      </div>
    `
    : ''
}

      <div class="game-card-buttons">
        <button
          class="small-btn edit-followed-game-btn"
          data-id="${followedGame.id}"
          data-spread="${followedGame.spread || ''}"
          data-notes="${followedGame.notes || ''}"
        >
          Edit
        </button>

        <button
          class="small-btn danger remove-followed-game-btn"
          data-id="${followedGame.id}"
        >
          Remove
        </button>
      </div>
    </div>
  `;
}