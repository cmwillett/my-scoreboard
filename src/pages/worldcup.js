import {
  getWorldCupPageData,
  refreshWorldCupScores,
  addWorldCupFollowedTeam,
  addWorldCupFavoriteTeam,
  removeWorldCupFollowedTeam,
  removeWorldCupFavoriteTeam,
  updateWorldCupTeamNote
} from '../api.js';
import {
  openConfirmModal,
  openMessageModal,
  openTextModal,
  showToast
} from '../components/modal.js';

let worldCupState = null;
let teamOptions = [];

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isWorldCupGameLive(game) {
  const raw = String(game.rawStatus || '').toLowerCase();
  const status = String(game.status || '').toLowerCase();

  return (
    raw.includes('in') ||
    status.includes('live') ||
    status.includes('half') ||
    status.includes("'")
  );
}

function showTeamOptions() {
  const input = document.getElementById('worldcup-team-input');
  const dropdown = document.getElementById('worldcup-team-dropdown');

  if (!input || !dropdown) return;

  const search = input.value.trim().toLowerCase();
  const matches = teamOptions
    .filter(team => team.toLowerCase().includes(search))
    .slice(0, 40);

  if (!matches.length) {
    dropdown.innerHTML = '<div class="dropdown-item muted">No matches</div>';
    dropdown.style.display = 'block';
    return;
  }

  dropdown.innerHTML = matches.map(team => `
    <button type="button" class="dropdown-item" data-team="${escapeHtml(team)}">
      ${escapeHtml(team)}
    </button>
  `).join('');

  dropdown.style.display = 'block';

  dropdown.querySelectorAll('.dropdown-item').forEach(btn => {
    btn.addEventListener('click', () => {
      input.value = btn.dataset.team;
      dropdown.style.display = 'none';
    });
  });
}

function renderSelectedTeamRows(data) {
  const favoriteRows = (data.favorites || []).map(team => ({
    ...team,
    type: 'favorite'
  }));

  const followedRows = (data.followedTeams || []).map(team => ({
    ...team,
    type: 'followed'
  }));

  const rows = [...favoriteRows, ...followedRows];

  if (!rows.length) {
    return '<p class="muted-text">No followed or favorite teams yet.</p>';
  }

  return rows.map(row => `
    <div class="worldcup-team-row">
      <div>
        <strong>${row.type === 'favorite' ? '⭐ ' : ''}${escapeHtml(row.team)}</strong>
        <span>${row.type === 'favorite' ? 'Favorite' : 'Followed'}</span>
        ${row.notes ? `<p>${escapeHtml(row.notes)}</p>` : ''}
      </div>

      <div class="worldcup-team-actions">
        <button
          type="button"
          class="small-btn edit-worldcup-team-note-btn"
          data-type="${row.type}"
          data-team="${escapeHtml(row.team)}"
          data-notes="${escapeHtml(row.notes || '')}"
        >
          Edit Note
        </button>

        <button
          type="button"
          class="small-btn danger remove-worldcup-team-btn"
          data-type="${row.type}"
          data-team="${escapeHtml(row.team)}"
        >
          Remove
        </button>
      </div>
    </div>
  `).join('');
}

function renderGameRows(games, { selectedOnly = false } = {}) {
  if (!games.length) {
    return `
      <tr>
        <td colspan="6" class="worldcup-empty-cell">No games found.</td>
      </tr>
    `;
  }

  return games.map(game => {
    const typeIcon = game.selectedType === 'favorite' ? '⭐ ' : '';
    const scoreText = `${escapeHtml(game.awayTeam)} ${escapeHtml(game.awayScore || '0')} at ${escapeHtml(game.homeTeam)} ${escapeHtml(game.homeScore || '0')}`;

    return `
      <tr>
        <td>${escapeHtml(game.date || '-')}</td>
        <td><strong>${typeIcon}${scoreText}</strong></td>
        <td>${escapeHtml(game.status || '-')}</td>
        <td>${escapeHtml(game.channel || '-')}</td>
        <td>${game.notes ? `📝 ${escapeHtml(game.notes)}` : '-'}</td>
        <td>
          ${selectedOnly
            ? `
              <button
                type="button"
                class="small-btn edit-worldcup-game-note-btn"
                data-type="${escapeHtml(game.selectedType || 'followed')}"
                data-team="${escapeHtml(game.selectedTeam || '')}"
                data-notes="${escapeHtml(game.notes || '')}"
              >
                Edit
              </button>
            `
            : ''
          }
        </td>
      </tr>
    `;
  }).join('');
}

function renderGamesTable(games, options = {}) {
  return `
    <div class="worldcup-table-wrap">
      <table class="worldcup-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Match</th>
            <th>Status</th>
            <th>TV</th>
            <th>Note</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${renderGameRows(games, options)}
        </tbody>
      </table>
    </div>
  `;
}

function filterUpcomingGames() {
  const input = document.getElementById('worldcup-upcoming-filter');
  const rows = document.querySelectorAll('#worldcup-upcoming-table tbody tr');
  const search = String(input?.value || '').toLowerCase();

  rows.forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(search) ? '' : 'none';
  });
}

function attachWorldCupHandlers() {
  const teamInput = document.getElementById('worldcup-team-input');
  const dropdown = document.getElementById('worldcup-team-dropdown');
  const addFollowedBtn = document.getElementById('add-worldcup-followed-btn');
  const addFavoriteBtn = document.getElementById('add-worldcup-favorite-btn');
  const refreshBtn = document.getElementById('refresh-worldcup-btn');
  const upcomingFilter = document.getElementById('worldcup-upcoming-filter');

  if (teamInput) {
    teamInput.addEventListener('input', showTeamOptions);
    teamInput.addEventListener('focus', showTeamOptions);
  }

  document.addEventListener('click', event => {
    if (!event.target.closest('.worldcup-team-search') && dropdown) {
      dropdown.style.display = 'none';
    }
  });

  async function addTeam(type) {
    const team = teamInput?.value.trim() || '';
    const notes = document.getElementById('worldcup-team-notes')?.value.trim() || '';

    if (!team) {
      openMessageModal({
        title: 'Choose a Team',
        message: 'Choose a World Cup team first.'
      });
      return;
    }

    try {
      if (type === 'favorite') {
        await addWorldCupFavoriteTeam({ team, notes });
      } else {
        await addWorldCupFollowedTeam({ team, notes });
      }

      showToast(`${team} saved.`);
      await window.refreshCurrentPage?.();
    } catch (err) {
      console.error(err);
      openMessageModal({
        title: 'Could Not Save Team',
        message: 'The World Cup team was not saved.'
      });
    }
  }

  addFollowedBtn?.addEventListener('click', () => addTeam('followed'));
  addFavoriteBtn?.addEventListener('click', () => addTeam('favorite'));

  refreshBtn?.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Refreshing...';

    try {
      await refreshWorldCupScores();
      showToast('World Cup scores refreshed.');
      await window.refreshCurrentPage?.();
    } catch (err) {
      console.error(err);
      openMessageModal({
        title: 'Could Not Refresh World Cup Scores',
        message: 'The World Cup scores were not refreshed.'
      });
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Refresh World Cup Scores';
    }
  });

  upcomingFilter?.addEventListener('input', filterUpcomingGames);

  document.querySelectorAll('.remove-worldcup-team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      const team = btn.dataset.team;

      openConfirmModal({
        title: 'Remove World Cup Team?',
        message: `Remove ${team} from ${type === 'favorite' ? 'favorites' : 'followed teams'}?`,
        confirmText: 'Remove',
        onConfirm: async () => {
          if (type === 'favorite') {
            await removeWorldCupFavoriteTeam(team);
          } else {
            await removeWorldCupFollowedTeam(team);
          }

          showToast(`${team} removed.`);
          await window.refreshCurrentPage?.();
        }
      });
    });
  });

  document.querySelectorAll('.edit-worldcup-team-note-btn, .edit-worldcup-game-note-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      const team = btn.dataset.team;
      const notes = btn.dataset.notes || '';

      openTextModal({
        title: `Edit ${team} Note`,
        label: 'Note',
        value: notes,
        onSave: async nextNotes => {
          await updateWorldCupTeamNote(type, team, nextNotes);
          showToast('Note saved.');
          await window.refreshCurrentPage?.();
        }
      });
    });
  });
}

export async function renderWorldCup() {
  try {
    const result = await getWorldCupPageData();
    const data = result.data || {};

    worldCupState = data;
    teamOptions = data.teams || [];

    const selectedGames = data.selectedGames || [];
    const upcomingGames = data.upcomingGames || [];

    setTimeout(attachWorldCupHandlers, 0);

    return `
      <div class="page-header">
        <div class="page-title-row">
          <div>
            <h2>World Cup</h2>
            <p>Follow teams, favorite teams, and view the full upcoming schedule.</p>
            <p class="last-updated">World Cup Last Updated: ${escapeHtml(data.lastWorldCupUpdated || 'Not updated yet')}</p>
          </div>

          <button id="refresh-worldcup-btn" class="small-btn">
            Refresh World Cup Scores
          </button>
        </div>
      </div>

      <details class="collapsible-section worldcup-section">
        <summary>
          <span>Add World Cup Team</span>
          <span class="section-count">Follow/Favorite</span>
        </summary>
        <div class="collapsible-body">
          <div class="card form-card">
            <label>Team</label>
            <div class="search-combo worldcup-team-search">
              <input
                id="worldcup-team-input"
                type="text"
                placeholder="Search team..."
                autocomplete="off"
              />
              <div id="worldcup-team-dropdown" class="search-dropdown"></div>
            </div>

            <label>Note</label>
            <textarea id="worldcup-team-notes" rows="3" placeholder="Optional note..."></textarea>

            <div class="worldcup-add-actions">
              <button id="add-worldcup-followed-btn" class="primary-btn" type="button">
                Follow Team
              </button>
              <button id="add-worldcup-favorite-btn" class="primary-btn" type="button">
                Favorite Team
              </button>
            </div>
          </div>
        </div>
      </details>

      <details class="collapsible-section worldcup-section">
        <summary>
          <span>⚽ My Games</span>
          <span class="section-count">${selectedGames.length}</span>
        </summary>
        <div class="collapsible-body">
          ${renderGamesTable(selectedGames, { selectedOnly: true })}
        </div>
      </details>

      <details class="collapsible-section worldcup-section">
        <summary>
          <span>🗓️ Upcoming Schedule</span>
          <span class="section-count">${upcomingGames.length}</span>
        </summary>
        <div class="collapsible-body">
          <input
            id="worldcup-upcoming-filter"
            class="worldcup-filter"
            type="text"
            placeholder="Filter upcoming games by team..."
          />

          <div id="worldcup-upcoming-table">
            ${renderGamesTable(upcomingGames)}
          </div>
        </div>
      </details>

      <details class="collapsible-section worldcup-section">
        <summary>
          <span>Selected Teams</span>
          <span class="section-count">${(data.favorites || []).length + (data.followedTeams || []).length}</span>
        </summary>
        <div class="collapsible-body">
          <div class="card">
            <div class="worldcup-team-list">
              ${renderSelectedTeamRows(data)}
            </div>
          </div>
        </div>
      </details>
    `;
  } catch (err) {
    console.error(err);

    return `
      <div class="page-header">
        <h2>World Cup</h2>
      </div>

      <div class="card">
        Failed to load World Cup data.
      </div>
    `;
  }
}
