import {
  getAvailableSports,
  getTeamsForSport,
  getAvailableGames,
  getAvailableGolfers,
  addFollowedGame,
  addFollowedGolfer
} from '../api.js';

let currentItems = [];
let currentGames = [];
let selectedGame = null;

function renderSportOptions(sports) {
  return sports.map(sport => `<option value="${sport}">${sport}</option>`).join('');
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
      class="game-choice-btn"
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

  const gamesToShow = liveGames.length ? liveGames : upcomingGames;

  const gamesWrap = document.getElementById('game-picker-wrap');
  const gamesList = document.getElementById('game-picker-list');

  selectedGame = null;

  if (!gamesToShow.length) {
    gamesWrap.style.display = 'block';
    gamesList.innerHTML = `
      <div class="empty-state small">
        No live or upcoming games found for ${team}.
      </div>
    `;
    return;
  }

  gamesWrap.style.display = 'block';
  gamesList.innerHTML = gamesToShow
    .map((game, index) => renderGameChoice(game, index))
    .join('');

  gamesList.querySelectorAll('.game-choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = Number(btn.dataset.gameIndex);

      selectedGame = gamesToShow[index];

      gamesList.querySelectorAll('.game-choice-btn').forEach(b => {
        b.classList.remove('selected');
      });

      btn.classList.add('selected');

      console.log('Selected game:', selectedGame);
    });
  });
}

function attachAddHandlers() {
  const sportSelect = document.getElementById('sport-select');
  const itemInput = document.getElementById('item-select');
  const itemDropdown = document.getElementById('item-dropdown');
  const itemLabel = document.getElementById('item-label');
  const spreadWrap = document.getElementById('spread-wrap');
  const gamePickerWrap = document.getElementById('game-picker-wrap');
  const saveBtn = document.getElementById('save-followed-item');

  function showFilteredItems() {
    const search = itemInput.value.toLowerCase();

    const matches = currentItems
      .filter(item => item.label.toLowerCase().includes(search))
      .slice(0, 30);

    if (!matches.length) {
      itemDropdown.innerHTML = `<div class="dropdown-item muted">No matches</div>`;
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

        if (sportSelect.value !== 'Golf') {
          renderGameChoices(btn.dataset.value);
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

    if (!sport) {
      itemLabel.textContent = 'Team/Golfer';
      itemInput.placeholder = 'Choose sport first...';
      spreadWrap.style.display = 'block';
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
        .map(name => ({
          value: name,
          label: name
        }));

      itemInput.placeholder = 'Search golfer...';
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
  }

  sportSelect.addEventListener('change', updateItems);
  itemInput.addEventListener('input', showFilteredItems);
  itemInput.addEventListener('focus', showFilteredItems);

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-combo')) {
      itemDropdown.style.display = 'none';
    }
  });

  saveBtn.addEventListener('click', async () => {
    const sport = sportSelect.value;
    const item = itemInput.value.trim();
    const spread = document.getElementById('spread-input').value.trim();
    const notes = document.getElementById('note-input').value.trim();
    const favorite = document.getElementById('favorite-input').checked;

    if (!sport || !item) {
      alert('Choose a sport and team/golfer.');
      return;
    }

    if (sport !== 'Golf' && !selectedGame) {
      alert('Choose a game to follow.');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      if (sport === 'Golf') {
        await addFollowedGolfer(item, notes, favorite);
      } else {
        await addFollowedGame({
          sportKey: sport,
          eventId: selectedGame.eventId || selectedGame.eventID || selectedGame.id,
          team: item,
          spread,
          notes
        });
      }

      alert(`${item} added.`);

      itemInput.value = '';
      document.getElementById('spread-input').value = '';
      document.getElementById('note-input').value = '';
      document.getElementById('favorite-input').checked = false;
      gamePickerWrap.style.display = 'none';
      selectedGame = null;
    } catch (err) {
      console.error(err);
      alert('Could not add item.');
    }

    saveBtn.disabled = false;
    saveBtn.textContent = 'Follow/Add';
  });
}

export async function renderAddGame() {
  const result = await getAvailableSports();
  const sports = result.data || [];

  setTimeout(attachAddHandlers, 0);

  return `
    <div class="page-header">
      <h2>Add Game/Golfer</h2>
      <p>Follow a specific game or golfer and optionally add a spread or note.</p>
    </div>

    <div class="card form-card">
      <label>Sport</label>
      <select id="sport-select">
        <option value="">Choose sport...</option>
        ${renderSportOptions(sports)}
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
        <label>Game</label>
        <div id="game-picker-list" class="game-picker-list"></div>
      </div>

      <div id="spread-wrap">
        <label>Spread</label>
        <input id="spread-input" type="text" placeholder="Example: -3.5" />
      </div>

      <label>Note</label>
      <textarea id="note-input" rows="3" placeholder="Optional note..."></textarea>

      <label class="checkbox-row">
        <input id="favorite-input" type="checkbox" />
        Favorite
      </label>

      <button id="save-followed-item" class="primary-btn">
        Follow/Add
      </button>
    </div>
  `;
}