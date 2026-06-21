import { getAvailableGolfers, getFollowedGolfers } from '../api.js';
import { formatLastUpdated } from '../utils/date.js';

function renderGolferRow(golfer) {
  return `
    <tr>
      <td>${golfer.golfer || '-'}</td>
      <td>${golfer.position || '-'}</td>
      <td>${golfer.overall || '-'}</td>
      <td>${golfer.today || '-'}</td>
      <td>${golfer.thru || golfer.teeTime || '-'}</td>
      <td><button class="small-btn">Edit</button></td>
      <td><button class="small-btn danger">Remove</button></td>
    </tr>
  `;
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
    followedGolfers.map(item => item.golfer)
    );

    const golfers = allGolfers.filter(golfer =>
    followedSet.has(golfer.golfer)
    );
    const lastUpdated = formatLastUpdated();

    const firstGolfer = allGolfers[0] || {};
    const cutLine = firstGolfer.cutLine || '-';
    const currentRound = firstGolfer.currentRound || '-';

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
                    ...
                </table>
                </div>
            </div>
            `
            : `
            <div class="card empty-state">
                <h3>No followed golfers yet</h3>
                <p>Go to Add Game to follow a golfer.</p>
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