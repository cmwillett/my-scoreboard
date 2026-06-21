import { getAvailableGames, addFollowedTeam } from '../api.js';

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

function attachAddGameHandlers(teamsBySport) {
  const sportSelect = document.getElementById('sport-select');
  const teamSelect = document.getElementById('team-select');
  const saveBtn = document.getElementById('save-followed-team');

  function updateTeams() {
    const sport = sportSelect.value;
    const teams = teamsBySport[sport] || [];

    teamSelect.innerHTML = `
      <option value="">Choose team...</option>
      ${teams.map(team => `<option value="${team}">${team}</option>`).join('')}
    `;
  }

  sportSelect.addEventListener('change', updateTeams);

  saveBtn.addEventListener('click', async () => {
    const sport = sportSelect.value;
    const team = teamSelect.value;
    const spread = document.getElementById('spread-input').value;
    const note = document.getElementById('note-input').value;
    const favorite = document.getElementById('favorite-input').checked;

    if (!sport || !team) {
      alert('Choose a sport and team.');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      await addFollowedTeam(sport, team, spread, note, favorite);
      alert(`${team} added.`);
      teamSelect.value = '';
      document.getElementById('spread-input').value = '';
      document.getElementById('note-input').value = '';
      document.getElementById('favorite-input').checked = false;
    } catch (err) {
      console.error(err);
      alert('Could not add team.');
    }

    saveBtn.disabled = false;
    saveBtn.textContent = 'Follow/Add Team';
  });
}

export async function renderAddGame() {
  const result = await getAvailableGames('ALL');
  const games = result.data || [];
  const teamsBySport = getTeamsBySport(games);
  const sports = Object.keys(teamsBySport).sort();

  setTimeout(() => attachAddGameHandlers(teamsBySport), 0);

  return `
    <div class="page-header">
      <h2>Add Game</h2>
      <p>Follow a team and optionally add a spread or note.</p>
    </div>

    <div class="card form-card">
      <label>Sport</label>
      <select id="sport-select">
        <option value="">Choose sport...</option>
        ${sports.map(sport => `<option value="${sport}">${sport}</option>`).join('')}
      </select>

      <label>Team</label>
      <select id="team-select">
        <option value="">Choose team...</option>
      </select>

      <label>Spread</label>
      <input id="spread-input" type="text" placeholder="Example: -3.5" />

      <label>Note</label>
      <textarea id="note-input" rows="3" placeholder="Optional note..."></textarea>

      <label class="checkbox-row">
        <input id="favorite-input" type="checkbox" />
        Favorite
      </label>

      <button id="save-followed-team" class="primary-btn">
        Follow/Add Team
      </button>
    </div>
  `;
}