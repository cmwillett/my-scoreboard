import {
  getWorldCupPageData,
  refreshWorldCupScores,
  updateWorldCupTeamNote
} from '../api.js';
import {
  openMessageModal,
  openTextModal,
  showToast
} from '../components/modal.js';

let worldCupState = null;
let teamOptions = [];

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

function isWorldCupGameLive(game) {
  const raw = String(game.rawStatus || '').toLowerCase();
  const status = String(game.status || '').toLowerCase();

  return (
    raw.includes('in') ||
    status.includes('live') ||
    status.includes('half') ||
    status.includes("'")
  );
}

function showTeamOptions() {
  const input = document.getElementById('worldcup-team-input');
  const dropdown = document.getElementById('worldcup-team-dropdown');

  if (!input || !dropdown) return;

  const search = input.value.trim().toLowerCase();
  const matches = teamOptions
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

function renderSelectedTeamRows(data) {
  const favoriteRows = (data.favorites || []).map(team => ({
    ...team,
    type: 'favorite'
  }));

  const followedRows = (data.followedTeams || []).map(team => ({
    ...team,
    type: 'followed'
  }));

  const rows = [...favoriteRows, ...followedRows];

  if (!rows.length) {
    return '<p class="muted-text">No followed or favorite teams yet.</p>';
  }

  return rows.map(row => `
    <div class="worldcup-team-row">
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

function renderGameRows(games, { selectedOnly = false } = {}) {
  if (!games.length) {
    return `
      <tr>
        <td colspan="6" class="worldcup-empty-cell">No games found.</td>
      </tr>
    `;
  }

  return games.map(game => {
    const typeIcon = game.selectedType === 'favorite' ? '⭐ ' : '';
    const awayScoreNum = Number(game.awayScore);
    const homeScoreNum = Number(game.homeScore);
    const hasScores = !Number.isNaN(awayScoreNum) && !Number.isNaN(homeScoreNum);
    const rawStatus = String(game.rawStatus || '').toUpperCase();
    const statusText = String(game.status || '').toLowerCase();
    const isFinal =
      rawStatus === 'STATUS_FINAL' ||
      rawStatus === 'STATUS_COMPLETE' ||
      rawStatus === 'STATUS_FULL_TIME' ||
      statusText.includes('final') ||
      statusText.includes('complete');
    const awayWinner = hasScores && isFinal && awayScoreNum > homeScoreNum;
    const homeWinner = hasScores && isFinal && homeScoreNum > awayScoreNum;
    const awayClass = awayWinner ? 'worldcup-winner' : homeWinner ? 'worldcup-loser' : '';
    const homeClass = homeWinner ? 'worldcup-winner' : awayWinner ? 'worldcup-loser' : '';

    return `
      <tr>
        <td>${escapeHtml(game.date || '-')}</td>
        <td>
          <strong>
            ${typeIcon}
            <span class="${awayClass}">${awayWinner ? '🏆 ' : ''}${escapeHtml(game.awayTeam)} ${escapeHtml(game.awayScore || '0')}</span>
            <span class="worldcup-vs"> at </span>
            <span class="${homeClass}">${homeWinner ? '🏆 ' : ''}${escapeHtml(game.homeTeam)} ${escapeHtml(game.homeScore || '0')}</span>
          </strong>
        </td>
        <td>${escapeHtml(game.status || '-')}</td>
        <td>${escapeHtml(game.channel || '-')}</td>
        <td>${game.notes ? `📝 ${escapeHtml(game.notes)}` : '-'}</td>
        <td>
          ${selectedOnly
            ? `
              <button
                type="button"
                class="small-btn edit-worldcup-game-note-btn"
                data-type="${escapeHtml(game.selectedType || 'followed')}"
                data-team="${escapeHtml(game.selectedTeam || '')}"
                data-notes="${escapeHtml(game.notes || '')}"
              >
                Edit
              </button>
            `
            : ''
          }
        </td>
      </tr>
    `;
  }).join('');
}

function renderGamesTable(games, options = {}) {
  return `
    <div class="worldcup-table-wrap">
      <table class="worldcup-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Match</th>
            <th>Status</th>
            <th>TV</th>
            <th>Note</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${renderGameRows(games, options)}
        </tbody>
      </table>
    </div>
  `;
}

function filterUpcomingGames() {
  const input = document.getElementById('worldcup-upcoming-filter');
  const rows = document.querySelectorAll('#worldcup-upcoming-table tbody tr');
  const search = String(input?.value || '').toLowerCase();

  rows.forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(search) ? '' : 'none';
  });
}

function attachWorldCupHandlers() {
  const refreshBtn = document.getElementById('refresh-worldcup-btn');
  const upcomingFilter = document.getElementById('worldcup-upcoming-filter');

  refreshBtn?.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Refreshing...';

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
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Refresh World Cup Scores';
    }
  });

  upcomingFilter?.addEventListener('input', filterUpcomingGames);

  document.querySelectorAll('.edit-worldcup-game-note-btn').forEach(btn => {
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
}

export async function renderWorldCup() {
  try {
    const result = await getWorldCupPageData();
    const data = result.data || {};

    worldCupState = data;
    teamOptions = (data.teams || []).filter(isRealWorldCupTeamName).sort();

    const selectedGames = data.selectedGames || [];
    const upcomingGames = data.upcomingGames || [];
    const recentFinalGames = data.recentFinalGames || [];

    setTimeout(attachWorldCupHandlers, 0);

    return `
      <div class="page-header">
        <div class="page-title-row">
          <div>
            <h2>World Cup</h2>
            <p>View your selected teams and the full upcoming schedule. Manage teams in Admin.</p>
            <p class="last-updated">World Cup Last Updated: ${escapeHtml(data.lastWorldCupUpdated || 'Not updated yet')}</p>
          </div>

          <button id="refresh-worldcup-btn" class="small-btn">
            Refresh World Cup Scores
          </button>
        </div>
      </div>

      <details class="collapsible-section worldcup-section">
        <summary>
          <span>⚽ My Games</span>
          <span class="section-count">${selectedGames.length}</span>
        </summary>
        <div class="collapsible-body">
          ${renderGamesTable(selectedGames, { selectedOnly: true })}
        </div>
      </details>

      <details class="collapsible-section worldcup-section">
        <summary>
          <span>🏁 Recent Finals</span>
          <span class="section-count">${recentFinalGames.length}</span>
        </summary>
        <div class="collapsible-body">
          ${renderGamesTable(recentFinalGames, { selectedOnly: true })}
        </div>
      </details>

      <details class="collapsible-section worldcup-section">
        <summary>
          <span>🗓️ Upcoming Schedule</span>
          <span class="section-count">${upcomingGames.length}</span>
        </summary>
        <div class="collapsible-body">
          <input
            id="worldcup-upcoming-filter"
            class="worldcup-filter"
            type="text"
            placeholder="Filter upcoming games by team..."
          />

          <div id="worldcup-upcoming-table">
            ${renderGamesTable(upcomingGames)}
          </div>
        </div>
      </details>
    `;
  } catch (err) {
    console.error(err);

    return `
      <div class="page-header">
        <h2>World Cup</h2>
      </div>

      <div class="card">
        Failed to load World Cup data.
      </div>
    `;
  }
}
