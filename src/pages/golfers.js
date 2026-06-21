import { getAvailableGolfers } from '../api.js';

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
    const result = await getAvailableGolfers();
    const golfers = result.data || [];

    const firstGolfer = golfers[0] || {};
    const cutLine = firstGolfer.cutLine || '-';
    const currentRound = firstGolfer.currentRound || '-';

    return `
      <div class="page-header">
        <h2>Golfers</h2>
        <p>${currentRound} • Cut line: ${cutLine}</p>
      </div>

      <div class="card">
        <div class="table-wrap">
          <table class="golfers-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Pos</th>
                <th>Total</th>
                <th>Today</th>
                <th>Thru / Tee</th>
                <th>Edit</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              ${golfers.map(renderGolferRow).join('')}
            </tbody>
          </table>
        </div>
      </div>
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