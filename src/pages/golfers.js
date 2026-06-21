import {
  getAvailableGolfers,
  getFollowedGolfers,
  removeFollowedGolfer
} from '../api.js';
import { formatLastUpdated } from '../utils/date.js';

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function renderGolferRow(golfer) {
  return `
    <tr>
      <td>${golfer.golfer || '-'}</td>
      <td>${golfer.position || '-'}</td>
      <td>${golfer.overall || '-'}</td>
      <td>${golfer.today || '-'}</td>
      <td>${golfer.thru || golfer.teeTime || '-'}</td>
      <td>
        <button class="small-btn danger remove-golfer-btn" data-golfer="${golfer.golfer}">
          Remove
        </button>
      </td>
    </tr>
  `;
}

function attachGolferHandlers() {
  document.querySelectorAll('.remove-golfer-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const golfer = btn.dataset.golfer;

      if (!confirm(`Remove ${golfer}?`)) return;

      btn.disabled = true;
      btn.textContent = 'Removing...';

      try {
        await removeFollowedGolfer(golfer);
        btn.closest('tr')?.remove();
      } catch (err) {
        console.error(err);
        alert('Could not remove golfer.');
        btn.disabled = false;
        btn.textContent = 'Remove';
      }
    });
  });
}

export async function renderGolfers() {
  try {
    const [availableResult, followedResult] = await Promise.all([
      getAvailableGolfers(),
      getFollowedGolfers()
    ]);

    const allGolfers = availableResult.data || [];
    const followedGolfers = followedResult.data || [];

    const followedSet = new Set(
      followedGolfers.map(item => normalizeName(item.golfer))
    );

    const golfers = allGolfers.filter(golfer =>
      followedSet.has(normalizeName(golfer.golfer))
    );

    const lastUpdated = formatLastUpdated();

    const firstGolfer = allGolfers[0] || {};
    const cutLine = firstGolfer.cutLine || '-';
    const currentRound = firstGolfer.currentRound || '-';

    setTimeout(attachGolferHandlers, 0);

    return `
      <div class="page-header">
        <h2>Golfers</h2>
        <p>${currentRound} • Cut line: ${cutLine}</p>
        <p class="last-updated">Golf Last Updated: ${lastUpdated}</p>
      </div>

      ${
        golfers.length
          ? `
            <div class="card">
              <div class="table-wrap">
                <table class="golfers-table">
                  <thead>
                    <tr>
                      <th>Golfer</th>
                      <th>Position</th>
                      <th>Overall</th>
                      <th>Today</th>
                      <th>Thru / Tee Time</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${golfers.map(renderGolferRow).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `
          : `
            <div class="card empty-state">
              <h3>No followed golfers yet</h3>
              <p>Go to Add Game/Golfer to follow a golfer.</p>
            </div>
          `
      }
    `;
  } catch (err) {
    console.error(err);

    return `
      <div class="page-header">
        <h2>Golfers</h2>
      </div>

      <div class="card">
        Failed to load golfers.
      </div>
    `;
  }
}