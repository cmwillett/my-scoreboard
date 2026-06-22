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
  saveWorldCupRefreshSettings,
  getWorldCupPageData,
  addWorldCupFollowedTeam,
  addWorldCupFavoriteTeam,
  removeWorldCupFollowedTeam,
  removeWorldCupFavoriteTeam,
  updateWorldCupTeamNote,
  refreshWorldCupScores
} from '../api.js';
import { renderAddGame, attachAddHandlers } from './addgame.js';
import {
  openConfirmModal,
  openMessageModal,
  openTextModal,
  showToast
} from '../components/modal.js';

const ADMIN_AUTH_KEY = 'scoreboardAdminUnlocked';
let favoriteTeamOptions = [];
let worldCupTeamOptions = [];

function isAdminUnlocked() {
  return localStorage.getItem(ADMIN_AUTH_KEY) === 'true';
}

function setAdminUnlocked() {
  localStorage.setItem(ADMIN_AUTH_KEY, 'true');
}

function clearAdminUnlocked() {
  localStorage.removeItem(ADMIN_AUTH_KEY);
}


function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isRealWorldCupTeamName(team) {
  const name = String(team || '').trim();
  const lower = name.toLowerCase();

  if (!name) return false;
  if (lower === 'tbd') return false;
  if (lower.includes('group')) return false;
  if (lower.includes('/')) return false;
  if (/^\d/.test(name)) return false;
  if (/^(winner|loser)\b/i.test(name)) return false;

  return /[a-z]/i.test(name);
}

function renderWorldCupTeamRows(data = {}) {
  const favoriteRows = (data.favorites || []).map(team => ({
    ...team,
    type: 'favorite'
  }));

  const followedRows = (data.followedTeams || []).map(team => ({
    ...team,
    type: 'followed'
  }));

  const rows = [...favoriteRows, ...followedRows].sort((a, b) => {
    const teamA = String(a.team || '').toLowerCase();
    const teamB = String(b.team || '').toLowerCase();
    return teamA.localeCompare(teamB);
  });

  if (!rows.length) {
    return '<p class="muted-text">No World Cup teams selected yet.</p>';
  }

  return rows.map(row => `
    <div class="worldcup-team-row admin-list-row">
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

function renderWorldCupAddCard() {
  return `
    <div class="card form-card">
      <h3>Add World Cup Team</h3>
      <p class="admin-help">
        Add a followed or favorite World Cup team. It behaves like the other team controls; the World Cup tab and Roku app are display-only.
      </p>

      <label>Team</label>
      <div class="search-combo worldcup-team-search">
        <input
          id="admin-worldcup-team-input"
          type="text"
          placeholder="Search country..."
          autocomplete="off"
        />
        <div id="admin-worldcup-team-dropdown" class="search-dropdown"></div>
      </div>

      <label>Note</label>
      <textarea id="admin-worldcup-team-notes" rows="3" placeholder="Optional note..."></textarea>

      <div class="worldcup-add-actions">
        <button id="admin-add-worldcup-followed-btn" class="primary-btn" type="button">
          Follow Team
        </button>
        <button id="admin-add-worldcup-favorite-btn" class="primary-btn" type="button">
          Favorite Team
        </button>
      </div>
    </div>
  `;
}

function renderWorldCupCurrentCard(data = {}) {
  const selectedCount = (data.favorites || []).length + (data.followedTeams || []).length;

  return `
    <div class="card">
      <div class="card-header-row">
        <div>
          <h3>Current World Cup Teams</h3>
          <p class="admin-help">${selectedCount} selected</p>
        </div>
      </div>
      <div class="worldcup-team-list admin-list">
        ${renderWorldCupTeamRows(data)}
      </div>
    </div>
  `;
}

function showWorldCupTeamOptions() {
  const input = document.getElementById('admin-worldcup-team-input');
  const dropdown = document.getElementById('admin-worldcup-team-dropdown');

  if (!input || !dropdown) return;

  const search = input.value.trim().toLowerCase();
  const matches = worldCupTeamOptions
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

function renderSportsDataCard(visibility, refreshSports = [], worldCupRefresh = {}) {
  const settings = {
    scoreboard: visibility.scoreboard !== false,
    golfers: visibility.golfers !== false,
    worldcup: visibility.worldcup !== false
  };

  const refreshRows = [
    ...refreshSports.map(sport => ({
      sportKey: sport.sportKey,
      label: sport.label || sport.sportKey,
      enabled: sport.enabled === true,
      isWorldCup: false
    })),
    {
      sportKey: 'WorldCup',
      label: 'World Cup',
      enabled: worldCupRefresh.autoRefresh === true,
      isWorldCup: true
    }
  ];

  return `
    <div class="card form-card sports-data-card">
      <h3>Page Visibility</h3>
      <p class="admin-help">Show or hide main display pages without deleting their data.</p>

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

    <div class="card form-card sports-data-card">
      <h3>Auto Refresh</h3>
      <p class="admin-help">Turn sports off when they are out of season. Smart refresh skips disabled sports.</p>

      <div class="admin-list refresh-control-list">
        ${refreshRows.length ? refreshRows.map(sport => `
          <label class="checkbox-row admin-checkbox-row refresh-control-row">
            <input
              class="sport-refresh-toggle"
              type="checkbox"
              data-sport-key="${sport.sportKey}"
              data-worldcup="${sport.isWorldCup ? 'true' : 'false'}"
              ${sport.enabled ? 'checked' : ''}
            />
            <span>
              <strong>${sport.label}</strong>
              <small>${sport.sportKey}</small>
            </span>
          </label>
        `).join('') : '<p class="admin-help">No sport refresh settings were found.</p>'}
      </div>

      <button id="save-sports-refresh-btn" class="primary-btn">
        Save Auto Refresh Settings
      </button>

      <div class="admin-subsection-label">Manual Refresh</div>
      <button id="admin-refresh-worldcup-btn" class="secondary-btn" type="button">
        Refresh World Cup Scores Now
      </button>
    </div>
  `;
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
    <details class="collapsible-section admin-collapsible" data-default-collapsed="true">
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

/* Legacy separate refresh/visibility cards removed in v0.7.4. */

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
      const toggles = Array.from(document.querySelectorAll('.sport-refresh-toggle'));
      const sports = toggles
        .filter(input => input.dataset.worldcup !== 'true')
        .map(input => ({
          sportKey: input.dataset.sportKey,
          enabled: input.checked === true
        }));
      const worldCupToggle = toggles.find(input => input.dataset.worldcup === 'true');
      const worldCupEnabled = worldCupToggle?.checked === true;

      saveSportsRefreshBtn.disabled = true;
      saveSportsRefreshBtn.textContent = 'Saving...';

      try {
        await saveSportsRefreshSettings(sports);
        await saveWorldCupRefreshSettings(worldCupEnabled);
        showToast('Auto refresh settings saved.');
        await window.refreshCurrentPage?.();
      } catch (err) {
        console.error(err);
        openMessageModal({
          title: 'Could Not Save Auto Refresh',
          message: 'The auto refresh settings were not saved.'
        });
        saveSportsRefreshBtn.disabled = false;
        saveSportsRefreshBtn.textContent = 'Save Auto Refresh Settings';
      }
    });
  }


  const wcTeamInput = document.getElementById('admin-worldcup-team-input');
  const wcDropdown = document.getElementById('admin-worldcup-team-dropdown');
  const wcFollowBtn = document.getElementById('admin-add-worldcup-followed-btn');
  const wcFavoriteBtn = document.getElementById('admin-add-worldcup-favorite-btn');
  const wcRefreshBtn = document.getElementById('admin-refresh-worldcup-btn');

  if (wcTeamInput) {
    wcTeamInput.addEventListener('input', showWorldCupTeamOptions);
    wcTeamInput.addEventListener('focus', showWorldCupTeamOptions);
  }

  document.addEventListener('click', event => {
    if (!event.target.closest('.worldcup-team-search') && wcDropdown) {
      wcDropdown.style.display = 'none';
    }
  });

  async function addWorldCupTeam(type) {
    const team = wcTeamInput?.value.trim() || '';
    const notes = document.getElementById('admin-worldcup-team-notes')?.value.trim() || '';

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

  wcFollowBtn?.addEventListener('click', () => addWorldCupTeam('followed'));
  wcFavoriteBtn?.addEventListener('click', () => addWorldCupTeam('favorite'));

  wcRefreshBtn?.addEventListener('click', async () => {
    wcRefreshBtn.disabled = true;
    wcRefreshBtn.textContent = 'Refreshing...';

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
      wcRefreshBtn.disabled = false;
      wcRefreshBtn.textContent = 'Refresh World Cup Scores Now';
    }
  });

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

  document.querySelectorAll('.edit-worldcup-team-note-btn').forEach(btn => {
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

  const [sportsResult, favoritesResult, visibilityResult, settingsResult, worldCupResult] = await Promise.all([
    getAvailableSports(),
    getFavoriteTeams(),
    getPageVisibility(),
    getSettingsData(),
    getWorldCupPageData()
  ]);

  const sports = sportsResult.data || [];
  const favorites = favoritesResult.data || [];
  const visibility = visibilityResult.data || {};
  const settingsData = settingsResult.data || {};
  const refreshSports = settingsData.sports || [];
  const worldCupRefresh = settingsData.worldCupRefresh || {};
  const worldCupData = worldCupResult.data || {};
  worldCupTeamOptions = (worldCupData.teams || []).filter(isRealWorldCupTeamName).sort();

  setTimeout(attachAdminHandlers, 0);

  return `
    <div class="page-header">
      <div class="page-title-row">
        <div>
          <h2>Admin</h2>
          <p>Control what appears on the PWA and Roku scoreboard.</p>
        </div>

        <button id="admin-logout-btn" class="small-btn">
          Lock Admin
        </button>
      </div>
    </div>

    ${renderCollapsibleSection('Add Game/Golfer/Team', 'Games, golfers, teams', `
      ${addGameHtml}

      <div class="card form-card">
        <h3>Favorite Team</h3>
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

      ${renderWorldCupAddCard()}
    `)}

    ${renderCollapsibleSection('Current Followed/Favorite Teams/Games', favorites.length + ' favorites • ' + ((worldCupData.favorites || []).length + (worldCupData.followedTeams || []).length) + ' World Cup teams', `
      <div class="card">
        <h3>Current Favorite Teams</h3>
        <div class="admin-list">
          ${renderFavoriteTeamRows(favorites)}
        </div>
      </div>

      ${renderWorldCupCurrentCard(worldCupData)}
    `)}

    ${renderCollapsibleSection('Site Data', (refreshSports.filter(s => s.enabled).length + (worldCupRefresh.autoRefresh === true ? 1 : 0)) + '/' + (refreshSports.length + 1) + ' refresh on', renderSportsDataCard(visibility, refreshSports, worldCupRefresh))}
  `;
}
