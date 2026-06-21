import {
  getAvailableGames,
  getAvailableGolfers,
  addFollowedTeam,
  addFollowedGolfer
} from '../api.js';

function getTeamsBySport(games) {
  const teamsBySport = {};

  games.forEach(game => {
    const sport = game.sport || game.sportKey;
    if (!sport) return;

    if (!teamsBySport[sport]) {
      teamsBySport[sport] = new Set();
    }

    if (game.awayTeam) teamsBySport[sport].add(game.awayTeam);
    if (game.homeTeam) teamsBySport[sport].add(game.homeTeam);
  });

  return Object.fromEntries(
    Object.entries(teamsBySport).map(([sport, teams]) => [
      sport,
      [...teams].sort()
    ])
  );
}

function attachAddHandlers(teamsBySport, golfers) {
  const sportSelect = document.getElementById('sport-select');
  const itemSelect = document.getElementById('item-select');
  const itemLabel = document.getElementById('item-label');
  const spreadWrap = document.getElementById('spread-wrap');
  const saveBtn = document.getElementById('save-followed-item');

  function updateItems() {
    const sport = sportSelect.value;

    if (sport === 'Golf') {
      itemLabel.textContent = 'Golfer';
      spreadWrap.style.display = 'none';

      itemSelect.innerHTML = `
        <option value="">Choose golfer...</option>
        ${golfers
          .map(g => g.golfer)
          .filter(Boolean)
          .sort()
          .map(name => `<option value="${name}">${name}</option>`)
          .join('')}
      `;
      return;
    }

    itemLabel.textContent = 'Team';
    spreadWrap.style.display = 'block';

    const teams = teamsBySport[sport] || [];

    itemSelect.innerHTML = `
      <option value="">Choose team...</option>
      ${teams.map(team => `<option value="${team}">${team}</option>`).join('')}
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
      alert('Choose a sport and item.');
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
  const [gamesResult, golfersResult] = await Promise.all([
    getAvailableGames('ALL'),
    getAvailableGolfers()
  ]);

  const games = gamesResult.data || [];
  const golfers = golfersResult.data || [];

  const teamsBySport = getTeamsBySport(games);
  const sports = [...Object.keys(teamsBySport).sort(), 'Golf'];

  setTimeout(() => attachAddHandlers(teamsBySport, golfers), 0);

  return `
    <div class="page-header">
      <h2>Add Game/Golfer</h2>
      <p>Follow a team or golfer and optionally add a note.</p>
    </div>

    <div class="card form-card">
      <label>Sport</label>
      <select id="sport-select">
        <option value="">Choose sport...</option>
        ${sports.map(sport => `<option value="${sport}">${sport}</option>`).join('')}
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