import {
  getFollowedGames,
  saveFavoriteGamePick,
  updateFollowedGame,
  removeFollowedGame,
  removeAllFollowedGames
} from '../api.js';
import { renderGameCard } from '../components/gameCard.js';
import {
  openConfirmModal,
  openGameEditModal
} from '../components/modal.js';
import { formatLastUpdated } from '../utils/date.js';

function getGameSection(followedGame) {
  const game = followedGame.live || followedGame;
  const rawStatus = game.rawStatus || '';
  const status = String(game.status || '').toLowerCase();

  if (
    rawStatus === 'STATUS_IN_PROGRESS' ||
    status.includes('top') ||
    status.includes('bot') ||
    status.includes('live') ||
    status.includes('half') ||
    status.includes('period') ||
    status.includes('quarter')
  ) {
    return 'live';
  }

  if (
    rawStatus === 'STATUS_FINAL' ||
    rawStatus === 'STATUS_COMPLETE' ||
    status.includes('final') ||
    status.includes('complete')
  ) {
    return 'final';
  }

  return 'upcoming';
}

function groupBySport(games) {
  return games.reduce((groups, followedGame) => {
    const game = followedGame.live || followedGame;
    const sport = game.sport || followedGame.sport || game.sportKey || 'Other';

    if (!groups[sport]) groups[sport] = [];

    groups[sport].push(followedGame);
    return groups;
  }, {});
}

function attachScoreboardHandlers() {
  const removeAllBtn = document.getElementById('remove-all-games-btn');

  if (removeAllBtn) {
    removeAllBtn.addEventListener('click', () => {
      openConfirmModal({
        title: 'Remove All Games?',
        message: 'This will remove all manually followed games from the scoreboard.',
        confirmText: 'Remove All',
        onConfirm: async () => {
          await removeAllFollowedGames();
          location.reload();
        }
      });
    });
  }

  document.querySelectorAll('.edit-followed-game-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openGameEditModal({
        id: btn.dataset.id,
        spread: btn.dataset.spread || '',
        notes: btn.dataset.notes || '',
        onSave: async ({ id, spread, notes }) => {
          await updateFollowedGame(id, spread, notes);
          location.reload();
        }
      });
    });
  });

  document.querySelectorAll('.edit-favorite-game-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openGameEditModal({
        id: btn.dataset.id,
        spread: btn.dataset.spread || '',
        notes: btn.dataset.notes || '',
        onSave: async ({ spread, notes }) => {
          await saveFavoriteGamePick({
            sportKey: btn.dataset.sportKey,
            eventId: btn.dataset.eventId,
            team: btn.dataset.team,
            spread,
            notes
          });
          location.reload();
        }
      });
    });
  });

  document.querySelectorAll('.remove-followed-game-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openConfirmModal({
        title: 'Remove Game?',
        message: 'This will remove this game from your scoreboard.',
        confirmText: 'Remove',
        onConfirm: async () => {
          await removeFollowedGame(btn.dataset.id);
          location.reload();
        }
      });
    });
  });
}

function renderSportGroup(sport, games) {
  return `
    <div class="sport-group">
      <h3>${sport}</h3>
      ${games.map(renderGameCard).join('')}
    </div>
  `;
}

function renderSection(title, games) {
  if (!games.length) return '';

  const groupedGames = groupBySport(games);

  return `
    <section class="scoreboard-section">
      <div class="section-header">
        <h2>${title}</h2>
        <span>${games.length}</span>
      </div>

      ${Object.entries(groupedGames)
        .map(([sport, sportGames]) => renderSportGroup(sport, sportGames))
        .join('')}
    </section>
  `;
}

export async function renderScoreboard() {
  try {
    const followedResult = await getFollowedGames();
    const games = followedResult.data || [];
    const lastUpdated = formatLastUpdated();

    const liveGames = games.filter(game => getGameSection(game) === 'live');
    const upcomingGames = games.filter(game => getGameSection(game) === 'upcoming');
    const finalGames = games.filter(game => getGameSection(game) === 'final');

    setTimeout(attachScoreboardHandlers, 0);

    return `
      <div class="page-header">
        <div class="page-title-row">
          <h2>Scoreboard</h2>

          ${
            games.length
              ? `
                <button id="remove-all-games-btn" class="small-btn danger">
                  Remove All
                </button>
              `
              : ''
          }
        </div>

        <p class="last-updated">Scoreboard Last Updated: ${lastUpdated}</p>
        <p>${games.length} followed games showing.</p>
      </div>

      ${renderSection('Live', liveGames)}
      ${renderSection('Upcoming', upcomingGames)}
      ${renderSection('Final', finalGames)}

      ${
        !games.length
          ? `
            <div class="card empty-state">
              <h3>No followed games yet</h3>
              <p>Go to Add Game/Golfer to follow a specific game.</p>
            </div>
          `
          : ''
      }
    `;
  } catch (err) {
    console.error(err);

    return `
      <div class="page-header">
        <h2>Scoreboard</h2>
      </div>

      <div class="card">
        Failed to load games.
      </div>
    `;
  }
}
