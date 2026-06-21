import {
  getAvailableSports,
  getTeamsForSport,
  getAvailableGolfers,
  addFollowedTeam,
  addFollowedGolfer
} from '../api.js';

let currentItems = [];

function renderSportOptions(sports) {
  return sports.map(sport => `<option value="${sport}">${sport}</option>`).join('');
}

function attachAddHandlers() {
  const sportSelect = document.getElementById('sport-select');
  const itemInput = document.getElementById('item-select');
  const itemDropdown = document.getElementById('item-dropdown');
  const itemLabel = document.getElementById('item-label');
  const spreadWrap = document.getElementById('spread-wrap');
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
      });
    });
  }

  async function updateItems() {
    const sport = sportSelect.value;

    itemInput.value = '';
    itemInput.placeholder = 'Loading...';
    itemDropdown.innerHTML = '';
    itemDropdown.style.display = 'none';
    currentItems = [];

    if (!sport) {
      itemLabel.textContent = 'Team/Golfer';
      itemInput.placeholder = 'Choose sport first...';
      spreadWrap.style.display = 'block';
      return;
    }

    if (sport === 'Golf') {
      itemLabel.textContent = 'Golfer';
      spreadWrap.style.display = 'none';

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

    const result = await getTeamsForSport(sport);
    const teams = result.data || [];

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
    const note = document.getElementById('note-input').value.trim();
    const favorite = document.getElementById('favorite-input').checked;

    if (!sport || !item) {
      alert('Choose a sport and team/golfer.');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      if (sport === 'Golf') {
        await addFollowedGolfer(item, note, favorite);
      } else {
        await addFollowedTeam(sport, item, spread, note, favorite);
      }

      alert(`${item} added.`);

      itemInput.value = '';
      document.getElementById('spread-input').value = '';
      document.getElementById('note-input').value = '';
      document.getElementById('favorite-input').checked = false;
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
      <p>Follow a team or golfer and optionally add a spread or note.</p>
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