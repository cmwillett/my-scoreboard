import { getAvailableGames } from '../api.js';
import { renderGameCard } from '../components/gameCard.js';

export async function renderScoreboard() {
  try {
    const result = await getAvailableGames('ALL');
    const games = result.data || [];
    const firstGolf = games.find(
    g => g.sportKey === 'GOLF'
    );

    console.log('FIRST GOLF:', firstGolf);

    return `
      <div class="page-header">
        <h2>Scoreboard</h2>
        <p>${games.length} games available.</p>
      </div>

      ${
        games.length
          ? games.map(renderGameCard).join('')
          : `
            <div class="card">
              No games found.
            </div>
          `
      }
    `;
  } catch (err) {
    console.error(err);

    return `
      <div class="page-header">
        <h2>Scoreboard</h2>
      </div>

      <div class="card">
        Failed to load games.
      </div>
    `;
  }
}