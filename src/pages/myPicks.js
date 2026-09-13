import { getFollowedGames } from '../api.js';
import { renderPickEmsSummary } from '../components/pickEmsSummary.js';
import { renderDensityToggle } from '../components/pageTools.js';
import { formatUpcomingGameTime } from '../utils/date.js';

function normalizeTeam_(value) {
  return String(value || '').trim().toLowerCase();
}

// Plain scoreline, no win/loss judgment - Craig deliberately wants this as a
// log rather than a grader (no elimination tracking, no reuse-team warnings,
// see the My Picks planning conversation). He reads the result himself.
function renderSurvivorResult_(followedGame) {
  const game = followedGame.live || followedGame;
  const statusText = formatUpcomingGameTime(game.status || game.startTime || '');
  const pickedTeam = followedGame.team || followedGame.selectedTeam || '';

  const isHomePicked = normalizeTeam_(game.homeTeam) === normalizeTeam_(pickedTeam);
  const pickedScore = isHomePicked ? game.homeScore : game.awayScore;
  const opponentScore = isHomePicked ? game.awayScore : game.homeScore;
  const hasScores = pickedScore !== undefined && pickedScore !== '' && opponentScore !== undefined && opponentScore !== '';

  return hasScores ? `${pickedScore}-${opponentScore} &middot; ${statusText}` : (statusText || '-');
}

function renderSurvivorRow_(followedGame) {
  const opponent = followedGame.opponent || '';
  const matchup = opponent ? `${followedGame.team} vs ${opponent}` : followedGame.team;

  return `
    <tr class="pickems-row">
      <td>${followedGame.survivorPick}</td>
      <td>${matchup}</td>
      <td>${renderSurvivorResult_(followedGame)}</td>
    </tr>
  `;
}

// Survivor picks are just a tag on a followed NFL team (the "Survivor pick
// for" field on Follow Team / Edit) - there's no separate collection and no
// grading. Craig explicitly didn't want auto-elimination tracking or
// reuse-team warnings, just a running list of who picked what so he can look
// at the score himself and know who's still alive.
function renderSurvivorSection_(followedRaw) {
  const picks = (followedRaw || [])
    .filter(g => String(g.sportKey || '').toUpperCase() === 'NFL' && String(g.survivorPick || '').trim())
    .sort((a, b) =>
      String(a.survivorPick).localeCompare(String(b.survivorPick)) ||
      String(a.team || '').localeCompare(String(b.team || ''))
    );

  const body = picks.length
    ? `
      <div class="table-scroll">
        <table class="pickems-table">
          <thead>
            <tr>
              <th>Picked By</th>
              <th>Team</th>
              <th>Game</th>
            </tr>
          </thead>
          <tbody>
            ${picks.map(renderSurvivorRow_).join('')}
          </tbody>
        </table>
      </div>
    `
    : `
      <div class="card empty-state small">
        <p>No survivor picks tagged yet. Add one from Follow Team, or edit an already-followed NFL team - both have a "Survivor pick for" field.</p>
      </div>
    `;

  return `
    <details class="collapsible-section pickems-collapsible" data-section-key="survivor-picks" open>
      <summary>
        <span>Survivor Picks</span>
        <span class="section-count">${picks.length}</span>
      </summary>
      <div class="collapsible-body">
        ${body}
      </div>
    </details>
  `;
}

function attachMyPicksHandlers_() {
  const retryBtn = document.getElementById('retry-load-picks-btn');

  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      window.refreshCurrentPage?.({ showLoading: true });
    });
  }
}

export async function renderMyPicks() {
  try {
    const followedResult = await getFollowedGames();
    const followedRaw = followedResult.data || [];

    const pickEmsHtml = renderPickEmsSummary(followedRaw);
    const survivorHtml = renderSurvivorSection_(followedRaw);

    setTimeout(attachMyPicksHandlers_, 0);

    return `
      <div class="page-header">
        <div class="page-title-row">
          <h2>My Picks</h2>
          <div class="page-actions">
            ${renderDensityToggle('mypicks')}
          </div>
        </div>
        <p>Pick 'Ems totals and survivor pool picks, moved off the Scores page (v1.4.19).</p>
      </div>

      ${
        pickEmsHtml || `
          <div class="card empty-state">
            <h3>No Pick 'Ems yet</h3>
            <p>Tag a followed NFL/CFB team to count toward this week's Pick 'Ems from Follow Team, or by editing an already-followed team.</p>
          </div>
        `
      }

      ${survivorHtml}
    `;
  } catch (err) {
    // Same shape as the Scores page's own failure handling (v1.4.18) - log
    // the real error and offer an immediate retry rather than a silent
    // generic message.
    console.error('My Picks failed to load:', err);

    setTimeout(attachMyPicksHandlers_, 0);

    return `
      <div class="page-header">
        <h2>My Picks</h2>
      </div>

      <div class="card">
        <p>Failed to load picks.</p>
        <button id="retry-load-picks-btn" class="small-btn">Try Again</button>
      </div>
    `;
  }
}
