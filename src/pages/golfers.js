import { getAvailableGolfers } from '../api.js';

export async function renderGolfers() {
  try {
    const result = await getAvailableGolfers();
    const golfers = result.data || [];

    console.log('FIRST GOLFER:', golfers[0]);

    return `
      <div class="page-header">
        <h2>Golfers</h2>
        <p>${golfers.length} golfers available.</p>
      </div>

      <div class="card">
        Check the console for FIRST GOLFER.
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