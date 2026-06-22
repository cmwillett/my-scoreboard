import {
  getAvailableSports,
  getTeamsForSport,
  getFavoriteTeams,
  addFavoriteTeam,
  removeFavoriteTeam,
  getPageVisibility,
  savePageVisibility,
  getSettingsData,
  saveSportsRefreshSettings,
  saveWorldCupRefreshSettings
} from '../api.js';
import { renderAddGame, attachAddHandlers } from './addgame.js';
import {
  openConfirmModal,
  openMessageModal,
  showToast
} from '../components/modal.js';

const ADMIN_AUTH_KEY = 'scoreboardAdminUnlocked';
let favoriteTeamOptions = [];

function isAdminUnlocked() {
  return localStorage.getItem(ADMIN_AUTH_KEY) === 'true';
}

function setAdminUnlocked() {
  localStorage.setItem(ADMIN_AUTH_KEY, 'true');
}

function clearAdminUnlocked() {
  localStorage.removeItem(ADMIN_AUTH_KEY);
}

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



function renderCollapsibleSection(title, meta, bodyHtml) {
  return `
    <details class="collapsible-section admin-collapsible">
      <summary>
        <span>${title}</span>
        ${meta ? `<span class="section-count">${meta}</span>` : ''}
      </summary>
      <div class="collapsible-body">
        ${bodyHtml}
      </div>
    </details>
  `;
}

function renderSportsRefreshCard(sports = []) {
  if (!sports.length) {
    return `
      <div class="card form-card">
        <p class="admin-help">No sports refresh settings were found.</p>
      </div>
    `;
  }

  return `
    <div class="card form-card">
      <p class="admin-help">
        Turn sports off when they are out of season. Smart refresh will skip disabled sports.
      </p>

      <div class="admin-list refresh-control-list">
        ${sports.map(sport => `
          <label class="checkbox-row admin-checkbox-row refresh-control-row">
            <input
              class="sport-refresh-toggle"
              type="checkbox"
              data-sport-key="${sport.sportKey}"
              ${sport.enabled ? 'checked' : ''}
            />
            <span>
              <strong>${sport.label || sport.sportKey}</strong>
              <small>${sport.sportKey}</small>
            </span>
          </label>
        `).join('')}
      </div>

      <button id="save-sports-refresh-btn" class="primary-btn">
        Save Sports Refresh Settings
      </button>
    </div>
  `;
}

function renderWorldCupRefreshCard(settings = {}) {
  const enabled = settings.autoRefresh === true;

  return `
    <div class="card form-card">
      <h3>World Cup Refresh</h3>
      <p class="admin-help">
        World Cup is a temporary event, so this controls whether smart refresh includes World Cup scores.
        Turn it off when the tournament is over.
      </p>

      <label class="checkbox-row admin-checkbox-row">
        <input id="worldcup-auto-refresh" type="checkbox" ${enabled ? 'checked' : ''} />
        Auto-refresh World Cup scores during smart refresh
      </label>

      <button id="save-worldcup-refresh-btn" class="primary-btn">
        Save World Cup Refresh Setting
      </button>
    </div>
  `;
}

function renderPageVisibilityCard(visibility) {
  const settings = {
    scoreboard: visibility.scoreboard !== false,
    golfers: visibility.golfers !== false,
    worldcup: visibility.worldcup !== false
  };

  return `
    <div class="card form-card">
      <h3>Page Visibility</h3>
      <p class="admin-help">
        Show or hide main navigation pages without deleting their code.
      </p>

      <label class="checkbox-row admin-checkbox-row">
        <input id="page-visible-scoreboard" type="checkbox" ${settings.scoreboard ? 'checked' : ''} />
        Scores
      </label>

      <label class="checkbox-row admin-checkbox-row">
        <input id="page-visible-golfers" type="checkbox" ${settings.golfers ? 'checked' : ''} />
        Golfers
      </label>

      <label class="checkbox-row admin-checkbox-row">
        <input id="page-visible-worldcup" type="checkbox" ${settings.worldcup ? 'checked' : ''} />
        World Cup
      </label>

      <button id="save-page-visibility-btn" class="primary-btn">
        Save Page Visibility
      </button>
    </div>
  `;
}

function renderAdminLocked() {
  setTimeout(attachAdminLoginHandlers, 0);

  return `
    <div class="page-header">
      <h2>Admin</h2>
      <p>Enter your PIN to manage app settings.</p>
    </div>

    <div class="card form-card admin-login-card">
      <h3>Admin Login</h3>

      <label>PIN</label>
      <input
        id="admin-pin-input"
        type="password"
        inputmode="numeric"
        autocomplete="off"
        placeholder="Enter PIN"
      />

      <button id="admin-unlock-btn" class="primary-btn">
        Unlock Admin
      </button>
    </div>
  `;
}

async function verifyAdminPin(pin) {
  const { checkAdminPin } = await import('../api.js');
  const result = await checkAdminPin(pin);
  return result.data === true;
}

function attachAdminLoginHandlers() {
  const pinInput = document.getElementById('admin-pin-input');
  const unlockBtn = document.getElementById('admin-unlock-btn');

  if (!pinInput || !unlockBtn) return;

  async function unlock() {
    const pin = pinInput.value.trim();

    if (!pin) {
      openMessageModal({
        title: 'PIN Required',
        message: 'Enter the admin PIN first.'
      });
      return;
    }

    unlockBtn.disabled = true;
    unlockBtn.textContent = 'Checking...';

    try {
      const ok = await verifyAdminPin(pin);

      if (!ok) {
        openMessageModal({
          title: 'Incorrect PIN',
          message: 'That PIN did not match the Admin PIN in AppSettings.'
        });
        unlockBtn.disabled = false;
        unlockBtn.textContent = 'Unlock Admin';
        return;
      }

      setAdminUnlocked();
      window.refreshCurrentPage?.();
    } catch (err) {
      console.error(err);
      openMessageModal({
        title: 'Could Not Check PIN',
        message: 'The admin PIN could not be verified.'
      });
      unlockBtn.disabled = false;
      unlockBtn.textContent = 'Unlock Admin';
    }
  }

  unlockBtn.addEventListener('click', unlock);

  pinInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      unlock();
    }
  });

  setTimeout(() => pinInput.focus(), 0);
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
  attachAddHandlers();

  const sportSelect = document.getElementById('favorite-sport-select');
  const teamInput = document.getElementById('favorite-team-input');
  const dropdown = document.getElementById('favorite-team-dropdown');
  const addBtn = document.getElementById('add-favorite-team-btn');
  const logoutBtn = document.getElementById('admin-logout-btn');

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearAdminUnlocked();
      window.refreshCurrentPage?.();
    });
  }

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
        showToast(`${team} added.`);
        await window.refreshCurrentPage?.();
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


  const saveVisibilityBtn = document.getElementById('save-page-visibility-btn');

  if (saveVisibilityBtn) {
    saveVisibilityBtn.addEventListener('click', async () => {
      const visibility = {
        scoreboard: document.getElementById('page-visible-scoreboard')?.checked !== false,
        golfers: document.getElementById('page-visible-golfers')?.checked !== false,
        worldcup: document.getElementById('page-visible-worldcup')?.checked !== false,
        admin: true
      };

      saveVisibilityBtn.disabled = true;
      saveVisibilityBtn.textContent = 'Saving...';

      try {
        await savePageVisibility(visibility);
        showToast('Page visibility saved.');
        await window.refreshCurrentPage?.();
      } catch (err) {
        console.error(err);
        openMessageModal({
          title: 'Could Not Save Visibility',
          message: 'The page visibility settings were not saved.'
        });
        saveVisibilityBtn.disabled = false;
        saveVisibilityBtn.textContent = 'Save Page Visibility';
      }
    });
  }

  const saveSportsRefreshBtn = document.getElementById('save-sports-refresh-btn');

  if (saveSportsRefreshBtn) {
    saveSportsRefreshBtn.addEventListener('click', async () => {
      const sports = Array.from(document.querySelectorAll('.sport-refresh-toggle')).map(input => ({
        sportKey: input.dataset.sportKey,
        enabled: input.checked === true
      }));

      saveSportsRefreshBtn.disabled = true;
      saveSportsRefreshBtn.textContent = 'Saving...';

      try {
        await saveSportsRefreshSettings(sports);
        showToast('Sports refresh settings saved.');
        await window.refreshCurrentPage?.();
      } catch (err) {
        console.error(err);
        openMessageModal({
          title: 'Could Not Save Sports Refresh',
          message: 'The sports refresh settings were not saved.'
        });
        saveSportsRefreshBtn.disabled = false;
        saveSportsRefreshBtn.textContent = 'Save Sports Refresh Settings';
      }
    });
  }

  const saveWorldCupRefreshBtn = document.getElementById('save-worldcup-refresh-btn');

  if (saveWorldCupRefreshBtn) {
    saveWorldCupRefreshBtn.addEventListener('click', async () => {
      const enabled = document.getElementById('worldcup-auto-refresh')?.checked === true;

      saveWorldCupRefreshBtn.disabled = true;
      saveWorldCupRefreshBtn.textContent = 'Saving...';

      try {
        await saveWorldCupRefreshSettings(enabled);
        showToast('World Cup refresh setting saved.');
        await window.refreshCurrentPage?.();
      } catch (err) {
        console.error(err);
        openMessageModal({
          title: 'Could Not Save World Cup Refresh',
          message: 'The World Cup refresh setting was not saved.'
        });
        saveWorldCupRefreshBtn.disabled = false;
        saveWorldCupRefreshBtn.textContent = 'Save World Cup Refresh Setting';
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
          showToast(`${team} removed.`);
          await window.refreshCurrentPage?.();
        }
      });
    });
  });
}

export async function renderAdmin() {
  if (!isAdminUnlocked()) {
    return renderAdminLocked();
  }

  const addGameHtml = await renderAddGame({ embedded: true });

  const [sportsResult, favoritesResult, visibilityResult, settingsResult] = await Promise.all([
    getAvailableSports(),
    getFavoriteTeams(),
    getPageVisibility(),
    getSettingsData()
  ]);

  const sports = sportsResult.data || [];
  const favorites = favoritesResult.data || [];
  const visibility = visibilityResult.data || {};
  const settingsData = settingsResult.data || {};
  const refreshSports = settingsData.sports || [];
  const worldCupRefresh = settingsData.worldCupRefresh || {};

  setTimeout(attachAdminHandlers, 0);

  return `
    <div class="page-header">
      <div class="page-title-row">
        <div>
          <h2>Admin</h2>
          <p>Manage followed games, golfers, favorite teams, and app settings.</p>
        </div>

        <button id="admin-logout-btn" class="small-btn">
          Lock Admin
        </button>
      </div>
    </div>

    ${renderCollapsibleSection('Add Game/Golfer', '', addGameHtml)}

    ${renderCollapsibleSection('Favorite Teams', '', `
      <div class="card form-card">
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
`)}

    ${renderCollapsibleSection('Current Favorite Teams', favorites.length, `
      <div class="card">
        <div class="admin-list">
          ${renderFavoriteTeamRows(favorites)}
        </div>
      </div>
`)}

    ${renderCollapsibleSection('Page Visibility', '', renderPageVisibilityCard(visibility))}

    ${renderCollapsibleSection('Sports Refresh', refreshSports.filter(s => s.enabled).length + '/' + refreshSports.length + ' on', renderSportsRefreshCard(refreshSports))}

    ${renderCollapsibleSection('World Cup Refresh', worldCupRefresh.autoRefresh ? 'On' : 'Off', renderWorldCupRefreshCard(worldCupRefresh))}
  `;
}
