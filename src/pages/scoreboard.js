import { getAvailableGames } from '../api.js';

const games = await getAvailableGames('ALL');

content.innerHTML = games
  .map(renderGameCard)
  .join('');

export function renderScoreboard() {
  return `
    <div class="page-header">
      <h2>Scoreboard</h2>
      <p>Today's games and followed teams.</p>
    </div>

    <div class="score-card">
      <div class="score-card-top">
        <span>NFL</span>
        <span>Final</span>
      </div>

      <div class="team-row winner">
        <span>Bengals</span>
        <strong>27</strong>
      </div>

      <div class="team-row">
        <span>Steelers</span>
        <strong>20</strong>
      </div>
    </div>

    <div class="score-card">
      <div class="score-card-top">
        <span>NBA</span>
        <span>8:00 PM</span>
      </div>

      <div class="team-row">
        <span>Cavaliers</span>
        <strong>-</strong>
      </div>

      <div class="team-row">
        <span>Celtics</span>
        <strong>-</strong>
      </div>
    </div>
  `;
}