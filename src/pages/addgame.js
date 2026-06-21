import {
  getAvailableSports,
  getTeamsForSport,
  getAvailableGolfers,
  addFollowedTeam,
  addFollowedGolfer
} from '../api.js';

function renderSportOptions(sports) {
  return sports
    .map(sport => `<option value="${sport}">${sport}</option>`)
    .join('');
}

function renderTeamOptions(teams) {
  return teams
    .map(team => {
      const value = team.shortName || team.fullName || team;
      const label = team.fullName
        ? `${team.shortName} - ${team.fullName}`
        : value;

      return `<option value="${value}">${label}</option>`;
    })
    .join('');
}

function renderGolferOptions(golfers) {
  return golfers
    .map(g => g.golfer)
    .filter(Boolean)
    .sort()
    .map(name => `<option value="${name}">${name}</option>`)
    .join('');
}

function attachAddHandlers() {
  const sportSelect = document.getElementById('sport-select');
  const itemSelect = document.getElementById('item-select');
  const itemLabel = document.getElementById('item-label');
  const spreadWrap = document.getElementById('spread-wrap');
  const saveBtn = document.getElementById('save-followed-item');

  async function updateItems() {
    const sport = sportSelect.value;

    itemSelect.innerHTML = `<option value="">Loading...</option>`;

    if (!sport) {
      itemLabel.textContent = 'Team/Golfer';
      itemSelect.innerHTML = `<option value="">Choose sport first...</option>`;
      spreadWrap.style.display = 'block';
      return;
    }

    if (sport === 'Golf') {
      itemLabel.textContent = 'Golfer';
      spreadWrap.style.display = 'none';

      const result = await getAvailableGolfers();
      const golfers = result.data || [];

      itemSelect.innerHTML = `
        <option value="">Choose golfer...</option>
        ${renderGolferOptions(golfers)}
      `;

      return;
    }

    itemLabel.textContent = 'Team';
    spreadWrap.style.display = 'block';

    const result = await getTeamsForSport(sport);
    const teams = result.data || [];

    itemSelect.innerHTML = `
      <option value="">Choose team...</option>
      ${renderTeamOptions(teams)}
    `;
  }

  sportSelect.addEventListener('change', updateItems);

  saveBtn.addEventListener('click', async () => {
    const sport = sportSelect.value;
    const item = itemSelect.value;
    const spread = document.getElementById('spread-input').value;
    const note = document.getElementById('note-input').value;
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

      itemSelect.value = '';
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
      <select id="item-select">
        <option value="">Choose sport first...</option>
      </select>

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