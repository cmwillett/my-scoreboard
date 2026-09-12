import { summarizeContest } from '../utils/pickEms.js';

// straightUp: true = win outright, no spread column (NFL). false = graded
// against the spread, spread column shown (CFB).
const CONTESTS = [
  { sportKey: 'NFL', label: "NFL Pick 'Ems", straightUp: true },
  { sportKey: 'CFB', label: 'CFB Picks', straightUp: false }
];

function statusLabel(status, straightUp) {
  if (straightUp) {
    return {
      won: '✅ Win',
      lost: '❌ Loss',
      push: '➖ Tie',
      pending: '⏳ Pending',
      unscored: '—'
    }[status] || '—';
  }

  return {
    won: '✅ Covered',
    lost: '❌ No Cover',
    push: '➖ Push',
    pending: '⏳ Pending',
    unscored: '—'
  }[status] || '—';
}

function renderPickRow(pick, straightUp) {
  const matchup = pick.opponent ? `${pick.team} vs ${pick.opponent}` : pick.team;

  return `
    <tr class="pickems-row pickems-row-${pick.status}">
      <td>${matchup}</td>
      ${straightUp ? '' : `<td>${pick.spread || '-'}</td>`}
      <td>${pick.weight !== null ? pick.weight : '-'}</td>
      <td>${statusLabel(pick.status, straightUp)}</td>
    </tr>
  `;
}

// Reuses the app's existing collapsible-section pattern (same one Live /
// Upcoming / Recent Finals use on this page) so it looks and behaves the
// same way - just defaulting to open via the `open` attribute, rather than
// collapsed like those sections start. data-section-key lets app.js's
// refresh snapshot restore this card's open/closed state precisely, rather
// than matching on the visible title text.
function renderContestCard(summary, label, straightUp) {
  if (!summary.picks.length) return '';

  const record = `${summary.won.length}-${summary.lost.length}${summary.push.length ? `-${summary.push.length}` : ''}`;
  const outstandingCount = summary.pending.length + summary.unscored.length;

  return `
    <details class="collapsible-section pickems-collapsible" data-section-key="pickems:${summary.sportKey}" open>
      <summary>
        <span>${label} &middot; This Week</span>
        <span class="section-count">${record} &middot; ${summary.weightWon}/${summary.weightPossible} pts</span>
      </summary>
      <div class="collapsible-body">
        ${
          outstandingCount
            ? `<p class="pickems-pending-note">${outstandingCount} of ${summary.picks.length} still to be settled.</p>`
            : ''
        }

        <div class="table-scroll">
          <table class="pickems-table">
            <thead>
              <tr>
                <th>Pick</th>
                ${straightUp ? '' : '<th>Spread</th>'}
                <th>Wt</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              ${summary.picks.map(pick => renderPickRow(pick, straightUp)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  `;
}

// followedGamesRaw is the same pre-dedup array scoreboard.js gets back from
// getFollowedGames() - one entry per followed team, each with its own
// spread/notes/isPickEm and merged live game data.
export function renderPickEmsSummary(followedGamesRaw) {
  const cards = CONTESTS
    .map(({ sportKey, label, straightUp }) =>
      renderContestCard(summarizeContest(followedGamesRaw, sportKey), label, straightUp))
    .filter(Boolean);

  if (!cards.length) return '';

  return `<div class="pickems-summary-wrap">${cards.join('')}</div>`;
}

// Re-renders just one contest's card - used by the per-card "refresh this
// sport" button (scoreboard.js) to patch that sport's Pick 'Ems totals in
// place after a manual score refresh, without touching the other contest's
// card. Returns '' if that sport isn't a known contest, or has no eligible
// picks right now (matching renderContestCard's own empty-state behavior) -
// either way the caller treats an empty result as "remove the card".
export function renderPickEmsCardForSport(followedGamesRaw, sportKey) {
  const contest = CONTESTS.find(c => c.sportKey === sportKey);
  if (!contest) return '';

  return renderContestCard(summarizeContest(followedGamesRaw, sportKey), contest.label, contest.straightUp);
}
