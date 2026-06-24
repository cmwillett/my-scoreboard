import {
  getAvailableSports,
  getTeamsForSport,
  getAvailableGames,
  getAvailableGolfers,
  getWorldCupPageData,
  addWorldCupFollowedTeam,
  addFollowedGame,
  addFollowedGolfer
} from '../api.js';
import { openMessageModal, showToast } from '../components/modal.js';

let currentItems = [];
let currentGames = [];
let selectedGame = null;
let gamesToShowNow = [];

function renderSportOptions(sports, optionsArg = {}) {
  const options = optionsArg.teamOnly
    ? sports.filter(sport => sport !== 'Golf')
    : [...sports];
  if (!options.includes('WorldCup')) options.push('WorldCup');

  return options.map(sport => {
    const label = sport === 'WorldCup' ? 'World Cup' : sport;
    return `<option value="${sport}">${label}</option>`;
  }).join('');
}

function getGameSection(game) {
  const rawStatus = game.rawStatus || '';
  const status = String(game.status || '').toLowerCase();

  if (
    rawStatus === 'STATUS_IN_PROGRESS' ||
    status.includes('live') ||
    status.includes('top') ||
    status.includes('bot') ||
    status.includes('half') ||
    status.includes('period') ||
    status.includes('quarter')
  ) {
    return 'live';
  }

  return 'upcoming';
}

function renderGameChoice(game, index) {
  const status = game.status || game.startTime || '';

  return `
    <button
      type="button"
      class="game-choice-btn ${index === 0 ? 'selected' : ''}"
      data-game-index="${index}"
    >
      <strong>${game.awayTeam}</strong> at <strong>${game.homeTeam}</strong>
      <span>${status}</span>
    </button>
  `;
}

function renderGameChoices(team) {
  const matchingGames = currentGames.filter(game =>
    game.awayTeam === team || game.homeTeam === team
  );

  const liveGames = matchingGames.filter(game => getGameSection(game) === 'live');
  const upcomingGames = matchingGames.filter(game => getGameSection(game) !== 'live');

  gamesToShowNow = liveGames.length ? liveGames : upcomingGames;

  const gamesWrap = document.getElementById('game-picker-wrap');
  const gamesList = document.getElementById('game-picker-list');

  selectedGame = gamesToShowNow[0] || null;

  if (!gamesToShowNow.length) {
    gamesWrap.style.display = 'none';
    gamesList.innerHTML = '';
    return;
  }

  gamesWrap.style.display = 'none';
  gamesList.innerHTML = gamesToShowNow.map(renderGameChoice).join('');

  gamesList.querySelectorAll('.game-choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = Number(btn.dataset.gameIndex);
      selectedGame = gamesToShowNow[index];

      gamesList.querySelectorAll('.game-choice-btn').forEach(button => {
        button.classList.remove('selected');
      });

      btn.classList.add('selected');
    });
  });
}

function resetForm() {
  document.getElementById('item-select').value = '';
  document.getElementById('spread-input').value = '';
  document.getElementById('note-input').value = '';
  document.getElementById('game-picker-wrap').style.display = 'none';
  selectedGame = null;
  gamesToShowNow = [];
}

export function attachAddHandlers() {
  const sportSelect = document.getElementById('sport-select');
  const itemInput = document.getElementById('item-select');
  const itemDropdown = document.getElementById('item-dropdown');
  const itemLabel = document.getElementById('item-label');
  const spreadWrap = document.getElementById('spread-wrap');
  const gamePickerWrap = document.getElementById('game-picker-wrap');
  const saveBtn = document.getElementById('save-followed-item');

  if (!sportSelect || !itemInput || !itemDropdown || !itemLabel || !spreadWrap || !gamePickerWrap || !saveBtn) {
    return;
  }

  function showFilteredItems() {
    const search = itemInput.value.toLowerCase();

    const matches = currentItems
      .filter(item => item.label.toLowerCase().includes(search))
      .slice(0, 30);

    if (!matches.length) {
      itemDropdown.innerHTML = '<div class="dropdown-item muted">No matches</div>';
      itemDropdown.style.display = 'block';
      return;
    }

    itemDropdown.innerHTML = matches.map(item => `
      <button type="button" class="dropdown-item" data-value="${item.value}">
        ${item.label}
      </button>
    `).join('');

    itemDropdown.style.display = 'block';

    itemDropdown.querySelectorAll('.dropdown-item').forEach(btn => {
      btn.addEventListener('click', () => {
        itemInput.value = btn.dataset.value;
        itemDropdown.style.display = 'none';

        if (sportSelect.value !== 'Golf' && sportSelect.value !== 'WorldCup') {
          renderGameChoices(btn.dataset.value);
          gamePickerWrap.style.display = 'none';
        }
      });
    });
  }

  async function updateItems() {
    const sport = sportSelect.value;

    itemInput.value = '';
    itemInput.placeholder = 'Loading...';
    itemDropdown.innerHTML = '';
    itemDropdown.style.display = 'none';
    gamePickerWrap.style.display = 'none';
    currentItems = [];
    currentGames = [];
    selectedGame = null;
    gamesToShowNow = [];

    if (!sport) {
      itemLabel.textContent = 'Team/Golfer';
      itemInput.placeholder = 'Choose sport first...';
      spreadWrap.style.display = 'block';
      return;
    }

    if (sport === 'WorldCup') {
      itemLabel.textContent = 'Team';
      spreadWrap.style.display = 'none';
      gamePickerWrap.style.display = 'none';

      const result = await getWorldCupPageData();
      const teams = (result.data?.teams || [])
        .filter(team => {
          const name = String(team || '').trim();
          const lower = name.toLowerCase();
          return name && lower !== 'tbd' && !lower.includes('group') && !name.includes('/') && !/^\d/.test(name);
        })
        .sort();

      currentItems = teams.map(name => ({ value: name, label: name }));
      itemInput.placeholder = 'Search World Cup team...';
      showFilteredItems();
      return;
    }

    if (sport === 'Golf') {
      itemLabel.textContent = 'Golfer';
      spreadWrap.style.display = 'none';
      gamePickerWrap.style.display = 'none';

      const result = await getAvailableGolfers();
      const golfers = result.data || [];

      currentItems = golfers
        .map(g => g.golfer)
        .filter(Boolean)
        .sort()
        .map(name => ({ value: name, label: name }));

      itemInput.placeholder = 'Search golfer...';
      showFilteredItems();
      return;
    }

    itemLabel.textContent = 'Team';
    spreadWrap.style.display = 'block';

    const [teamsResult, gamesResult] = await Promise.all([
      getTeamsForSport(sport),
      getAvailableGames(sport)
    ]);

    const teams = teamsResult.data || [];
    currentGames = gamesResult.data || [];

    currentItems = teams.map(team => {
      const value = team.shortName || team.fullName || team;
      const label = team.fullName
        ? `${team.shortName} - ${team.fullName}`
        : value;

      return { value, label };
    });

    itemInput.placeholder = 'Search team...';
    showFilteredItems();
  }

  sportSelect.addEventListener('change', updateItems);
  itemInput.addEventListener('input', showFilteredItems);
  itemInput.addEventListener('focus', showFilteredItems);

  document.addEventListener('click', event => {
    if (!event.target.closest('.search-combo')) {
      itemDropdown.style.display = 'none';
    }
  });

  saveBtn.addEventListener('click', async () => {
    const sport = sportSelect.value;
    const item = itemInput.value.trim();
    const spread = document.getElementById('spread-input').value.trim();
    const notes = document.getElementById('note-input').value.trim();

    if (!sport || !item) {
      openMessageModal({
        title: 'Choose an Item',
        message: 'Choose a sport and team/golfer first.'
      });
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      if (sport === 'Golf') {
        await addFollowedGolfer(item, notes, false);
        showToast(`${item} added.`);
      } else if (sport === 'WorldCup') {
        await addWorldCupFollowedTeam({ team: item, notes });
        showToast(`${item} added.`);
      } else {
        await addFollowedGame({
          sportKey: sport,
          eventId: selectedGame ? (selectedGame.eventId || selectedGame.eventID || selectedGame.id || '') : '',
          team: item,
          spread,
          notes
        });

        showToast(`${item} followed.`);
      }

      resetForm();
    } catch (err) {
      console.error(err);
      openMessageModal({
        title: 'Could Not Add Item',
        message: 'The item was not added. It may already be followed.'
      });
    }

    saveBtn.disabled = false;
    saveBtn.textContent = 'Follow Team';
  });
}

export async function renderAddGame(options = {}) {
  const result = await getAvailableSports();
  const sports = result.data || [];

  if (!options.embedded) {
    setTimeout(attachAddHandlers, 0);
  }

  const headerHtml = options.embedded
    ? `
      <div class="admin-subheader">
        <h3>${options.teamOnly ? 'Follow Team' : 'Follow Team/Golfer'}</h3>
        <p>${options.teamOnly ? 'Follow a team and optionally add a spread or note.' : 'Follow a team or golfer and optionally add a spread or note.'}</p>
      </div>
    `
    : `
      <div class="page-header">
        <h2>Follow Team/Golfer</h2>
        <p>Follow a team or golfer and optionally add a spread or note.</p>
      </div>
    `;

  return `
    ${headerHtml}

    <div class="card form-card">
      <label>Sport</label>
      <select id="sport-select">
        <option value="">Choose sport...</option>
        ${renderSportOptions(sports, options)}
      </select>

      <label id="item-label">Team/Golfer</label>
      <div class="search-combo">
        <input
          id="item-select"
          type="text"
          placeholder="Choose sport first..."
          autocomplete="off"
        />
        <div id="item-dropdown" class="search-dropdown"></div>
      </div>

      <div id="game-picker-wrap" style="display:none;">
        <div id="game-picker-list" class="game-picker-list"></div>
      </div>

      <div id="spread-wrap">
        <label>Spread</label>
        <input id="spread-input" type="text" placeholder="Example: -3.5" />
      </div>

      <label>Note</label>
      <textarea id="note-input" rows="3" placeholder="Optional note..."></textarea>

      <button id="save-followed-item" class="primary-btn">
        Follow Team
      </button>
    </div>
  `;
}
