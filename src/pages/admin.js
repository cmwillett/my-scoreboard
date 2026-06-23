import {
  getAvailableSports,
  getFollowedGames,
  updateFollowedGame,
  removeFollowedGame,
  getFollowedGolfers,
  getAvailableGolfers,
  addFollowedGolfer,
  removeFollowedGolfer,
  getTeamsForSport,
  getAvailableGames,
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
  refreshWorldCupScores,
  manualRefreshSport,
  manualRefreshAllSports
} from '../api.js';
import { renderAddGame, attachAddHandlers } from './addgame.js';
import {
  openConfirmModal,
  openGameEditModal,
  openMessageModal,
  openTextModal,
  showToast
} from '../components/modal.js';

const ADMIN_AUTH_KEY = 'scoreboardAdminUnlocked';
let favoriteTeamOptions = [];
let worldCupTeamOptions = [];
let golferOptions = [];

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


function renderAddGolferCard() {
  return `
    <div class="card form-card">
      <p class="admin-help">Follow a golfer on the Golf page and Roku leaderboard.</p>

      <label>Golfer</label>
      <div class="search-combo admin-golfer-search">
        <input
          id="admin-golfer-input"
          type="text"
          placeholder="Search golfer..."
          autocomplete="off"
        />
        <div id="admin-golfer-dropdown" class="search-dropdown"></div>
      </div>

      <label>Note</label>
      <textarea id="admin-golfer-notes" rows="3" placeholder="Optional note..."></textarea>

      <button id="admin-add-golfer-btn" class="primary-btn" type="button">
        Add Golfer
      </button>
    </div>
  `;
}

function showGolferOptions() {
  const input = document.getElementById('admin-golfer-input');
  const dropdown = document.getElementById('admin-golfer-dropdown');

  if (!input || !dropdown) return;

  const search = input.value.trim().toLowerCase();
  const matches = golferOptions
    .filter(golfer => golfer.toLowerCase().includes(search))
    .slice(0, 40);

  if (!matches.length) {
    dropdown.innerHTML = '<div class="dropdown-item muted">No matches</div>';
    dropdown.style.display = 'block';
    return;
  }

  dropdown.innerHTML = matches.map(golfer => `
    <button type="button" class="dropdown-item" data-golfer="${escapeHtml(golfer)}">
      ${escapeHtml(golfer)}
    </button>
  `).join('');

  dropdown.style.display = 'block';

  dropdown.querySelectorAll('.dropdown-item').forEach(btn => {
    btn.addEventListener('click', () => {
      input.value = btn.dataset.golfer;
      dropdown.style.display = 'none';
    });
  });
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
    ${renderNestedCollapsibleSection('Page Visibility', 'Display pages', `
      <div class="card form-card sports-data-card">
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
    `)}

    ${renderNestedCollapsibleSection('Auto Refresh', `${refreshRows.filter(s => s.enabled).length}/${refreshRows.length} on`, `
      <div class="card form-card sports-data-card">
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
      </div>
    `)}

    ${renderNestedCollapsibleSection('Manual Refresh', 'Run now', `
      <div class="card form-card sports-data-card">
        <p class="admin-help">Manually refresh any sport on demand. This does not change auto-refresh settings.</p>

        <div class="manual-refresh-grid">
          ${refreshRows.length ? refreshRows.map(sport => `
            <button
              id="admin-refresh-${sport.sportKey}-btn"
              class="secondary-btn manual-refresh-sport-btn"
              type="button"
              data-sport-key="${sport.sportKey}"
              data-sport-label="${sport.label}"
            >
              Refresh ${sport.label}
            </button>
          `).join('') : '<p class="admin-help">No sports were found.</p>'}
        </div>

        <button id="admin-refresh-all-sports-btn" class="primary-btn" type="button">
          Refresh All Sports
        </button>
      </div>
    `)}
  `;
}

function renderSportOptions(sports) {
  const options = sports.filter(sport => sport !== 'Golf');
  if (!options.includes('WorldCup')) options.push('WorldCup');

  return options
    .map(sport => {
      const label = sport === 'WorldCup' ? 'World Cup' : sport;
      return `<option value="${sport}">${label}</option>`;
    })
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


function groupRowsBySport(rows = [], sportGetter = row => row.sportKey || row.sport || 'Other') {
  return rows.reduce((groups, row) => {
    const sport = sportGetter(row) || 'Other';
    if (!groups[sport]) groups[sport] = [];
    groups[sport].push(row);
    return groups;
  }, {});
}

function renderSportGroupedPanels(groups, rowRenderer, emptyMessage) {
  const sportKeys = Object.keys(groups).sort();

  if (!sportKeys.length) {
    return `<div class="empty-state"><p>${emptyMessage}</p></div>`;
  }

  return sportKeys.map(sport => renderNestedCollapsibleSection(
    sport === 'WorldCup' ? 'World Cup' : sport,
    `${groups[sport].length} selected`,
    `<div class="card"><div class="admin-list">${groups[sport].map(rowRenderer).join('')}</div></div>`
  )).join('');
}

function getFollowedTeamRows(games = [], worldCupData = {}) {
  const manualGames = games.filter(game => game.isFavorite !== true);
  const rows = manualGames.map(game => ({
    ...game,
    sportKey: game.sportKey || game.sport || game.live?.sportKey || game.live?.sport || 'Other',
    team: game.team || game.followedTeam || game.selectedTeam || '',
    type: 'followed'
  }));

  (worldCupData.followedTeams || []).forEach(team => {
    rows.push({
      sportKey: 'WorldCup',
      team: team.team,
      notes: team.notes || '',
      type: 'followed-worldcup'
    });
  });

  return rows;
}

function renderFollowedTeamRow(row) {
  const game = row.live || row || {};
  const team = row.team || row.name || getFollowedGameLabel(row);
  const status = game.status || row.status || game.startTime || row.startTime || '';

  return `
    <div class="admin-list-row">
      <div>
        <strong>${escapeHtml(team)}</strong>
        <span>${escapeHtml(row.sportKey || 'Sport')}${status ? ` • ${escapeHtml(status)}` : ''}</span>
        ${row.spread ? `<p>Spread: ${escapeHtml(row.spread)}</p>` : ''}
        ${row.notes ? `<p>${escapeHtml(row.notes)}</p>` : ''}
      </div>

      ${row.type === 'followed-worldcup' ? `
        <button
          type="button"
          class="small-btn danger remove-worldcup-team-btn"
          data-type="followed"
          data-team="${escapeHtml(row.team)}"
        >
          Remove
        </button>
      ` : `
        <div class="admin-row-actions">
          <button
            type="button"
            class="small-btn edit-current-followed-game-btn"
            data-id="${escapeHtml(row.id)}"
            data-spread="${escapeHtml(row.spread || '')}"
            data-notes="${escapeHtml(row.notes || '')}"
          >
            Edit
          </button>
          <button
            type="button"
            class="small-btn danger remove-current-followed-game-btn"
            data-id="${escapeHtml(row.id)}"
          >
            Remove
          </button>
        </div>
      `}
    </div>
  `;
}

function getFavoriteTeamRows(favorites = [], worldCupData = {}) {
  const rows = favorites.map(favorite => ({ ...favorite, type: 'favorite' }));

  (worldCupData.favorites || []).forEach(team => {
    rows.push({
      sportKey: 'WorldCup',
      team: team.team,
      notes: team.notes || '',
      type: 'favorite-worldcup'
    });
  });

  return rows;
}

function renderFavoriteTeamRow(row) {
  return `
    <div class="admin-list-row">
      <div>
        <strong>${escapeHtml(row.team)}</strong>
        <span>${escapeHtml(row.sportKey || 'Sport')}</span>
        ${row.notes ? `<p>${escapeHtml(row.notes)}</p>` : ''}
      </div>

      ${row.type === 'favorite-worldcup' ? `
        <button
          type="button"
          class="small-btn danger remove-worldcup-team-btn"
          data-type="favorite"
          data-team="${escapeHtml(row.team)}"
        >
          Remove
        </button>
      ` : `
        <button
          type="button"
          class="small-btn danger remove-favorite-team-btn"
          data-sport-key="${escapeHtml(row.sportKey)}"
          data-team="${escapeHtml(row.team)}"
        >
          Remove
        </button>
      `}
    </div>
  `;
}

function getFollowedGameLabel(followedGame) {
  const game = followedGame.live || followedGame || {};
  const away = game.awayTeam || followedGame.awayTeam || '';
  const home = game.homeTeam || followedGame.homeTeam || '';
  const awayScore = game.awayScore ?? followedGame.awayScore ?? '';
  const homeScore = game.homeScore ?? followedGame.homeScore ?? '';

  if (away || home) {
    return `${away || '-'} ${awayScore || 0} at ${home || '-'} ${homeScore || 0}`;
  }

  return followedGame.team || followedGame.name || followedGame.eventId || 'Followed game';
}

function renderFollowedGameRows(games = []) {
  const manualGames = games.filter(game => game.isFavorite !== true);

  if (!manualGames.length) {
    return `
      <div class="empty-state">
        <p>No manually followed games yet.</p>
      </div>
    `;
  }

  return manualGames.map(followedGame => {
    const game = followedGame.live || followedGame || {};
    const label = getFollowedGameLabel(followedGame);
    const sport = followedGame.sport || game.sport || followedGame.sportKey || game.sportKey || 'Sport';
    const status = game.status || followedGame.status || game.startTime || followedGame.startTime || '-';

    return `
      <div class="admin-list-row">
        <div>
          <strong>${escapeHtml(label)}</strong>
          <span>${escapeHtml(sport)} • ${escapeHtml(status)}</span>
          ${followedGame.spread ? `<p>Spread: ${escapeHtml(followedGame.spread)}</p>` : ''}
          ${followedGame.notes ? `<p>${escapeHtml(followedGame.notes)}</p>` : ''}
        </div>

        <div class="admin-row-actions">
          <button
            type="button"
            class="small-btn edit-current-followed-game-btn"
            data-id="${escapeHtml(followedGame.id)}"
            data-spread="${escapeHtml(followedGame.spread || '')}"
            data-notes="${escapeHtml(followedGame.notes || '')}"
          >
            Edit
          </button>

          <button
            type="button"
            class="small-btn danger remove-current-followed-game-btn"
            data-id="${escapeHtml(followedGame.id)}"
          >
            Remove
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderFollowedGolferRows(golfers = []) {
  if (!golfers.length) {
    return `
      <div class="empty-state">
        <p>No followed golfers yet.</p>
      </div>
    `;
  }

  return golfers.map(golfer => {
    const note = golfer.note || golfer.notes || '';
    const status = [golfer.position, golfer.overall, golfer.thru || golfer.teeTime]
      .filter(Boolean)
      .join(' • ');

    return `
      <div class="admin-list-row">
        <div>
          <strong>${golfer.favorite ? '⭐ ' : ''}${escapeHtml(golfer.golfer)}</strong>
          <span>${escapeHtml(status || 'Golfer')}</span>
          ${note ? `<p>${escapeHtml(note)}</p>` : ''}
        </div>

        <button
          type="button"
          class="small-btn danger remove-current-golfer-btn"
          data-golfer="${escapeHtml(golfer.golfer)}"
        >
          Remove
        </button>
      </div>
    `;
  }).join('');
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

function renderNestedCollapsibleSection(title, meta, bodyHtml) {
  return `
    <details class="collapsible-section admin-nested-collapsible" data-default-collapsed="true">
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

  if (sport === 'WorldCup') {
    favoriteTeamOptions = worldCupTeamOptions.map(team => ({ value: team, label: team }));
    teamInput.placeholder = 'Search World Cup team...';
    return;
  }

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


  const adminGolferInput = document.getElementById('admin-golfer-input');
  const adminGolferDropdown = document.getElementById('admin-golfer-dropdown');
  const adminAddGolferBtn = document.getElementById('admin-add-golfer-btn');

  if (adminGolferInput) {
    adminGolferInput.addEventListener('input', showGolferOptions);
    adminGolferInput.addEventListener('focus', showGolferOptions);
  }

  document.addEventListener('click', event => {
    if (!event.target.closest('.admin-golfer-search') && adminGolferDropdown) {
      adminGolferDropdown.style.display = 'none';
    }
  });

  if (adminAddGolferBtn) {
    adminAddGolferBtn.addEventListener('click', async () => {
      const golfer = adminGolferInput.value.trim();
      const notes = document.getElementById('admin-golfer-notes')?.value.trim() || '';

      if (!golfer) {
        openMessageModal({
          title: 'Choose a Golfer',
          message: 'Choose a golfer before saving.'
        });
        return;
      }

      adminAddGolferBtn.disabled = true;
      adminAddGolferBtn.textContent = 'Saving...';

      try {
        await addFollowedGolfer(golfer, notes, false);
        showToast(`${golfer} added.`);
        await window.refreshCurrentPage?.();
      } catch (err) {
        console.error(err);
        openMessageModal({
          title: 'Could Not Add Golfer',
          message: 'The golfer was not saved.'
        });
        adminAddGolferBtn.disabled = false;
        adminAddGolferBtn.textContent = 'Add Golfer';
      }
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
        if (sportKey === 'WorldCup') {
          await addWorldCupFavoriteTeam({ team, notes });
        } else {
          await addFavoriteTeam({ sportKey, team, notes });
        }
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
  const manualRefreshBtns = Array.from(document.querySelectorAll('.manual-refresh-sport-btn'));
  const refreshAllSportsBtn = document.getElementById('admin-refresh-all-sports-btn');

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

  manualRefreshBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const sportKey = btn.dataset.sportKey;
      const sportLabel = btn.dataset.sportLabel || sportKey;
      const originalText = btn.textContent;

      btn.disabled = true;
      btn.textContent = 'Refreshing...';

      try {
        await manualRefreshSport(sportKey);
        showToast(`${sportLabel} refreshed.`);
        await window.refreshCurrentPage?.();
      } catch (err) {
        console.error(err);
        openMessageModal({
          title: `Could Not Refresh ${sportLabel}`,
          message: `${sportLabel} was not refreshed.`
        });
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });
  });

  refreshAllSportsBtn?.addEventListener('click', async () => {
    const originalText = refreshAllSportsBtn.textContent;
    refreshAllSportsBtn.disabled = true;
    refreshAllSportsBtn.textContent = 'Refreshing...';

    try {
      await manualRefreshAllSports();
      showToast('All sports refreshed.');
      await window.refreshCurrentPage?.();
    } catch (err) {
      console.error(err);
      openMessageModal({
        title: 'Could Not Refresh All Sports',
        message: 'One or more sports were not refreshed.'
      });
    } finally {
      refreshAllSportsBtn.disabled = false;
      refreshAllSportsBtn.textContent = originalText;
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



  document.querySelectorAll('.edit-current-followed-game-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openGameEditModal({
        id: btn.dataset.id,
        spread: btn.dataset.spread || '',
        notes: btn.dataset.notes || '',
        onSave: async ({ id, spread, notes }) => {
          await updateFollowedGame(id, spread, notes);
          showToast('Game saved.');
          await window.refreshCurrentPage?.();
        }
      });
    });
  });

  document.querySelectorAll('.remove-current-followed-game-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openConfirmModal({
        title: 'Remove Followed Game?',
        message: 'This will remove this game from your followed games.',
        confirmText: 'Remove',
        onConfirm: async () => {
          await removeFollowedGame(btn.dataset.id);
          showToast('Game removed.');
          await window.refreshCurrentPage?.();
        }
      });
    });
  });

  document.querySelectorAll('.remove-current-golfer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const golfer = btn.dataset.golfer;

      openConfirmModal({
        title: 'Remove Golfer?',
        message: `Remove ${golfer} from your followed golfers?`,
        confirmText: 'Remove',
        onConfirm: async () => {
          await removeFollowedGolfer(golfer);
          showToast(`${golfer} removed.`);
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

  const addGameHtml = await renderAddGame({ embedded: true, teamOnly: true });

  const [sportsResult, followedGamesResult, followedGolfersResult, favoritesResult, visibilityResult, settingsResult, worldCupResult, availableGolfersResult] = await Promise.all([
    getAvailableSports(),
    getFollowedGames(),
    getFollowedGolfers(),
    getFavoriteTeams(),
    getPageVisibility(),
    getSettingsData(),
    getWorldCupPageData(),
    getAvailableGolfers()
  ]);

  const sports = sportsResult.data || [];
  const followedGames = (followedGamesResult.data || []).filter(game => game.isFavorite !== true);
  const followedGolfers = followedGolfersResult.data || [];
  const favorites = favoritesResult.data || [];
  const visibility = visibilityResult.data || {};
  const settingsData = settingsResult.data || {};
  const refreshSports = settingsData.sports || [];
  const worldCupRefresh = settingsData.worldCupRefresh || {};
  const worldCupData = worldCupResult.data || {};
  worldCupTeamOptions = (worldCupData.teams || []).filter(isRealWorldCupTeamName).sort();
  golferOptions = (availableGolfersResult.data || []).map(g => g.golfer).filter(Boolean).sort();

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

    ${renderCollapsibleSection('Add Golfer/Team', 'Teams and golfers', `
      ${renderNestedCollapsibleSection('Add Team', 'Follow one team', addGameHtml)}

      ${renderNestedCollapsibleSection('Add Golfer', 'Follow one golfer', renderAddGolferCard())}

      ${renderNestedCollapsibleSection('Add Favorite Team', 'Auto-display team', `
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
    `)}

    ${renderCollapsibleSection('Current Selected Teams/Golfers', getFollowedTeamRows(followedGames, worldCupData).length + ' followed • ' + getFavoriteTeamRows(favorites, worldCupData).length + ' favorites • ' + followedGolfers.length + ' golfers', `
      ${renderNestedCollapsibleSection('Followed Teams', `${getFollowedTeamRows(followedGames, worldCupData).length} teams`, `
        ${renderSportGroupedPanels(
          groupRowsBySport(getFollowedTeamRows(followedGames, worldCupData), row => row.sportKey),
          renderFollowedTeamRow,
          'No followed teams yet.'
        )}
      `)}

      ${renderNestedCollapsibleSection('Favorite Teams', `${getFavoriteTeamRows(favorites, worldCupData).length} teams`, `
        ${renderSportGroupedPanels(
          groupRowsBySport(getFavoriteTeamRows(favorites, worldCupData), row => row.sportKey),
          renderFavoriteTeamRow,
          'No favorite teams yet.'
        )}
      `)}

      ${renderNestedCollapsibleSection('Followed Golfers', `${followedGolfers.length} golfers`, `
        <div class="card">
          <div class="admin-list">
            ${renderFollowedGolferRows(followedGolfers)}
          </div>
        </div>
      `)}
    `)}

    ${renderCollapsibleSection('Site Data', (refreshSports.filter(s => s.enabled).length + (worldCupRefresh.autoRefresh === true ? 1 : 0)) + '/' + (refreshSports.length + 1) + ' refresh on', renderSportsDataCard(visibility, refreshSports, worldCupRefresh))}
  `;
}
