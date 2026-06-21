import {
  getFollowedGames,
  updateFollowedGame,
  removeFollowedGame,
  removeAllFollowedGames
} from '../api.js';
import { renderGameCard } from '../components/gameCard.js';
import { formatLastUpdated } from '../utils/date.js';

function getGameSection(followedGame) {
  const game = followedGame.live || followedGame;
  const rawStatus = game.rawStatus || '';
  const status = (game.status || '').toLowerCase();

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

function openGameEditModal(id, currentSpread, currentNotes) {
  const modal = document.createElement('div');

  modal.className = 'modal-backdrop';

  modal.innerHTML = `
    <div class="modal-card">
      <h3>Edit Game</h3>

      <label>Spread</label>
      <input id="edit-game-spread" type="text" value="${currentSpread || ''}" />

      <label>Notes</label>
      <textarea id="edit-game-notes" rows="5">${currentNotes || ''}</textarea>

      <div class="modal-actions">
        <button id="cancel-game-edit" class="small-btn">Cancel</button>
        <button id="save-game-edit" class="primary-btn">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('cancel-game-edit').addEventListener('click', () => {
    modal.remove();
  });

  document.getElementById('save-game-edit').addEventListener('click', async () => {
    const spread = document.getElementById('edit-game-spread').value.trim();
    const notes = document.getElementById('edit-game-notes').value.trim();

    try {
      await updateFollowedGame(id, spread, notes);
      modal.remove();
      location.reload();
    } catch (err) {
      console.error(err);
      alert('Could not update game.');
    }
  });
}

function openConfirmModal({ title, message, confirmText, onConfirm }) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';

  modal.innerHTML = `
    <div class="modal-card">
      <h3>${title}</h3>
      <p>${message}</p>

      <div class="modal-actions">
        <button id="cancel-confirm-modal" class="small-btn">Cancel</button>
        <button id="confirm-modal-action" class="small-btn danger">
          ${confirmText}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('cancel-confirm-modal').addEventListener('click', () => {
    modal.remove();
  });

  document.getElementById('confirm-modal-action').addEventListener('click', async () => {
    try {
      await onConfirm();
    } catch (err) {
      console.error(err);
      modal.remove();
    }
  });
}

function attachScoreboardHandlers() {
const removeAllBtn = document.getElementById('remove-all-games-btn');

if (removeAllBtn) {
  removeAllBtn.addEventListener('click', async () => {
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
      openGameEditModal(
        btn.dataset.id,
        btn.dataset.spread || '',
        btn.dataset.notes || ''
      );
    });
  });

  document.querySelectorAll('.remove-followed-game-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this game?')) return;

      btn.disabled = true;
      btn.textContent = 'Removing...';

      try {
        await removeFollowedGame(btn.dataset.id);
        location.reload();
      } catch (err) {
        console.error(err);
        alert('Could not remove game.');
        btn.disabled = false;
        btn.textContent = 'Remove';
      }
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
            <button id="remove-all-games-btn" class="small-btn danger">
                Remove All
            </button>
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