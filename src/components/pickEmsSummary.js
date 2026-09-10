import { summarizeContest } from '../utils/pickEms.js';

const CONTESTS = [
  { sportKey: 'NFL', label: "NFL Pick 'Ems" },
  { sportKey: 'CFB', label: 'CFB Picks' }
];

const STATUS_LABEL = {
  won: "✅ Covered",
  lost: "❌ No Cover",
  push: "➖ Push",
  pending: "⏳ Pending",
  unscored: "—"
};

function renderPickRow(pick) {
  const matchup = pick.opponent ? `${pick.team} vs ${pick.opponent}` : pick.team;

  return `
    <tr class="pickems-row pickems-row-${pick.status}">
      <td>${matchup}</td>
      <td>${pick.spread || '-'}</td>
      <td>${pick.weight !== null ? pick.weight : '-'}</td>
      <td>${STATUS_LABEL[pick.status] || '—'}</td>
    </tr>
  `;
}

function renderContestCard(summary, label) {
  if (!summary.picks.length) return '';

  const record = `${summary.won.length}-${summary.lost.length}${summary.push.length ? `-${summary.push.length}` : ''}`;
  const outstandingCount = summary.pending.length + summary.unscored.length;

  return `
    <div class="card pickems-card">
      <div class="pickems-header">
        <h3>${label} &middot; This Week</h3>
        <div class="pickems-record">${record} &middot; ${summary.weightWon}/${summary.weightPossible} pts</div>
      </div>

      ${
        outstandingCount
          ? `<p class="pickems-pending-note">${outstandingCount} of ${summary.picks.length} still to be settled.</p>`
          : ''
      }

      <div class="table-scroll">
        <table class="pickems-table">
          <thead>
            <tr><th>Pick</th><th>Spread</th><th>Wt</th><th>Result</th></tr>
          </thead>
          <tbody>
            ${summary.picks.map(renderPickRow).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// followedGamesRaw is the same pre-dedup array scoreboard.js gets back from
// getFollowedGames() - one entry per followed team, each with its own
// spread/notes/isPickEm and merged live game data.
export function renderPickEmsSummary(followedGamesRaw) {
  const cards = CONTESTS
    .map(({ sportKey, label }) => renderContestCard(summarizeContest(followedGamesRaw, sportKey), label))
    .filter(Boolean);

  if (!cards.length) return '';

  return `<div class="pickems-summary-wrap">${cards.join('')}</div>`;
}
