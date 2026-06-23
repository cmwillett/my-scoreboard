export function renderGameCard(followedGame) {
  const game = followedGame.live || followedGame;

  const status = game.status || game.startTime || '';
  const channel = game.channel || '';

  const awayScore = Number(game.awayScore);
  const homeScore = Number(game.homeScore);

  const hasScores = !Number.isNaN(awayScore) && !Number.isNaN(homeScore);

  const rawStatus = String(game.rawStatus || '').toUpperCase();
  const statusText = String(game.status || '').toLowerCase();
  const isFinal =
    rawStatus === 'STATUS_FINAL' ||
    rawStatus === 'STATUS_COMPLETE' ||
    rawStatus === 'STATUS_FULL_TIME' ||
    statusText.includes('final') ||
    statusText.includes('complete');

  const awayWinner = hasScores && isFinal && awayScore > homeScore;
  const homeWinner = hasScores && isFinal && homeScore > awayScore;

  const isLive =
    game.rawStatus === 'STATUS_IN_PROGRESS' ||
    String(game.status || '').toLowerCase().includes('live');

  const isFavorite = followedGame.isFavorite === true;
  const selectedTeam = followedGame.team || game.awayTeam || game.homeTeam || '';
  const isAutoFavorite = isFavorite && String(followedGame.id || '').startsWith('favorite_');

  return `
    <div class="score-card ${isFavorite ? 'favorite-score-card' : ''}" data-followed-game-id="${followedGame.id}">
      <div class="team-row ${awayWinner ? 'final-winner' : homeWinner ? 'final-loser' : ''}">
        <span>${awayWinner ? '🏆 ' : ''}${game.awayTeam || '-'}</span>
        <strong>${game.awayScore || '-'}</strong>
      </div>

      <div class="team-row ${homeWinner ? 'final-winner' : awayWinner ? 'final-loser' : ''}">
        <span>${homeWinner ? '🏆 ' : ''}${game.homeTeam || '-'}</span>
        <strong>${game.homeScore || '-'}</strong>
      </div>

      <div class="game-meta-line">
        ${channel ? `<span>${channel}</span>` : ''}
        ${status ? `<span class="${isLive ? 'game-live' : ''}">${status}</span>` : ''}
      </div>

      ${
        isFavorite
          ? `<div class="favorite-game-label">★ Favorite Team</div>`
          : ''
      }

      ${
        followedGame.spread || followedGame.notes
          ? `
            <div class="game-details">
              ${
                followedGame.spread
                  ? `
                    <div class="game-detail-block">
                      <div class="game-detail-title">Spread</div>
                      <div class="game-detail-text">${followedGame.spread}</div>
                    </div>
                  `
                  : ''
              }

              ${
                followedGame.notes
                  ? `
                    <div class="game-detail-block">
                      <div class="game-detail-title">Notes</div>
                      <div class="game-detail-text">${followedGame.notes}</div>
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
          class="small-btn ${isAutoFavorite ? 'edit-favorite-game-btn' : 'edit-followed-game-btn'}"
          data-id="${followedGame.id}"
          data-sport-key="${followedGame.sportKey || game.sportKey || ''}"
          data-event-id="${followedGame.eventId || game.eventId || ''}"
          data-team="${selectedTeam}"
          data-spread="${followedGame.spread || ''}"
          data-notes="${followedGame.notes || ''}"
        >
          Edit
        </button>

        ${
          isAutoFavorite
            ? ''
            : `
              <button
                class="small-btn danger remove-followed-game-btn"
                data-id="${followedGame.id}"
              >
                Remove
              </button>
            `
        }
      </div>
    </div>
  `;
}
