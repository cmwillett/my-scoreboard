import {
  getAvailableSports,
  getTeamsForSport,
  getFavoriteTeams,
  addFavoriteTeam,
  removeFavoriteTeam
} from '../api.js';
import {
  openConfirmModal,
  openMessageModal
} from '../components/modal.js';

let favoriteTeamOptions = [];

function renderSportOptions(sports) {
  return sports
    .filter(sport => sport !== 'Golf')
    .map(sport => `<option value="${sport}">${sport}</option>`)
    .join('');
}

function renderFavoriteTeamRows(favorites) {
  if (!favorites.length) {
    return `
      <div class="empty-state">
        <p>No favorite teams yet.</p>
      </div>
    `;
  }

  return favorites.map(favorite => `
    <div class="admin-list-row">
      <div>
        <strong>${favorite.team}</strong>
        <span>${favorite.sportKey}</span>
        ${favorite.notes ? `<p>${favorite.notes}</p>` : ''}
      </div>

      <button
        type="button"
        class="small-btn danger remove-favorite-team-btn"
        data-sport-key="${favorite.sportKey}"
        data-team="${favorite.team}"
      >
        Remove
      </button>
    </div>
  `).join('');
}

function showFavoriteTeamOptions() {
  const input = document.getElementById('favorite-team-input');
  const dropdown = document.getElementById('favorite-team-dropdown');

  if (!input || !dropdown) return;

  const search = input.value.trim().toLowerCase();
  const matches = favoriteTeamOptions
    .filter(item => item.label.toLowerCase().includes(search))
    .slice(0, 30);

  if (!matches.length) {
    dropdown.innerHTML = '<div class="dropdown-item muted">No matches</div>';
    dropdown.style.display = 'block';
    return;
  }

  dropdown.innerHTML = matches.map(item => `
    <button type="button" class="dropdown-item" data-value="${item.value}">
      ${item.label}
    </button>
  `).join('');

  dropdown.style.display = 'block';

  dropdown.querySelectorAll('.dropdown-item').forEach(btn => {
    btn.addEventListener('click', () => {
      input.value = btn.dataset.value;
      dropdown.style.display = 'none';
    });
  });
}

async function loadTeamsForFavoriteSport() {
  const sportSelect = document.getElementById('favorite-sport-select');
  const teamInput = document.getElementById('favorite-team-input');
  const dropdown = document.getElementById('favorite-team-dropdown');

  if (!sportSelect || !teamInput || !dropdown) return;

  const sport = sportSelect.value;

  favoriteTeamOptions = [];
  teamInput.value = '';
  teamInput.placeholder = sport ? 'Loading teams...' : 'Choose sport first...';
  dropdown.innerHTML = '';
  dropdown.style.display = 'none';

  if (!sport) return;

  const result = await getTeamsForSport(sport);
  const teams = result.data || [];

  favoriteTeamOptions = teams.map(team => {
    const value = team.shortName || team.fullName || team;
    const label = team.fullName
      ? `${team.shortName} - ${team.fullName}`
      : value;

    return { value, label };
  });

  teamInput.placeholder = 'Search team...';
}

function attachAdminHandlers() {
  const sportSelect = document.getElementById('favorite-sport-select');
  const teamInput = document.getElementById('favorite-team-input');
  const dropdown = document.getElementById('favorite-team-dropdown');
  const addBtn = document.getElementById('add-favorite-team-btn');

  if (sportSelect) {
    sportSelect.addEventListener('change', loadTeamsForFavoriteSport);
  }

  if (teamInput) {
    teamInput.addEventListener('input', showFavoriteTeamOptions);
    teamInput.addEventListener('focus', showFavoriteTeamOptions);
  }

  document.addEventListener('click', event => {
    if (!event.target.closest('.search-combo') && dropdown) {
      dropdown.style.display = 'none';
    }
  });

  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const sportKey = sportSelect.value;
      const team = teamInput.value.trim();
      const notes = document.getElementById('favorite-team-notes').value.trim();

      if (!sportKey || !team) {
        openMessageModal({
          title: 'Choose a Favorite Team',
          message: 'Choose a sport and team before saving.'
        });
        return;
      }

      addBtn.disabled = true;
      addBtn.textContent = 'Saving...';

      try {
        await addFavoriteTeam({ sportKey, team, notes });
        openMessageModal({
          title: 'Favorite Team Added',
          message: `${team} was added as a favorite team.`
        });
        location.reload();
      } catch (err) {
        console.error(err);
        openMessageModal({
          title: 'Could Not Add Favorite',
          message: 'The favorite team was not saved.'
        });
        addBtn.disabled = false;
        addBtn.textContent = 'Add Favorite Team';
      }
    });
  }

  document.querySelectorAll('.remove-favorite-team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sportKey = btn.dataset.sportKey;
      const team = btn.dataset.team;

      openConfirmModal({
        title: 'Remove Favorite Team?',
        message: `Remove ${team} from your favorite teams?`,
        confirmText: 'Remove',
        onConfirm: async () => {
          await removeFavoriteTeam(sportKey, team);
          location.reload();
        }
      });
    });
  });
}

export async function renderAdmin() {
  const [sportsResult, favoritesResult] = await Promise.all([
    getAvailableSports(),
    getFavoriteTeams()
  ]);

  const sports = sportsResult.data || [];
  const favorites = favoritesResult.data || [];

  setTimeout(attachAdminHandlers, 0);

  return `
    <div class="page-header">
      <h2>Admin</h2>
      <p>Manage app settings, favorite teams, and future admin tools.</p>
    </div>

    <div class="card form-card">
      <h3>Favorite Teams</h3>
      <p class="admin-help">
        Favorite teams auto-display on the scoreboard. Live games show first; otherwise the next upcoming game shows.
      </p>

      <label>Sport</label>
      <select id="favorite-sport-select">
        <option value="">Choose sport...</option>
        ${renderSportOptions(sports)}
      </select>

      <label>Team</label>
      <div class="search-combo">
        <input
          id="favorite-team-input"
          type="text"
          placeholder="Choose sport first..."
          autocomplete="off"
        />
        <div id="favorite-team-dropdown" class="search-dropdown"></div>
      </div>

      <label>Notes</label>
      <textarea id="favorite-team-notes" rows="3" placeholder="Optional note..."></textarea>

      <button id="add-favorite-team-btn" class="primary-btn">
        Add Favorite Team
      </button>
    </div>

    <div class="card">
      <h3>Current Favorite Teams</h3>
      <div class="admin-list">
        ${renderFavoriteTeamRows(favorites)}
      </div>
    </div>

    <div class="card">
      <h3>Coming Soon</h3>
      <p class="admin-help">
        Add Game/Golfer, page visibility toggles, refresh controls, and World Cup settings will move here next.
      </p>
    </div>
  `;
}
