import { getAvailableGames } from '../api.js';
import { renderGameCard } from '../components/gameCard.js';
import { formatLastUpdated } from '../utils/date.js';

function getGameSection(game) {
  const rawStatus = game.rawStatus || '';
  const status = (game.status || '').toLowerCase();

  if (
    rawStatus === 'STATUS_IN_PROGRESS' ||
    status.includes('top') ||
    status.includes('bot') ||
    status.includes('live') ||
    status.includes('half') ||
    status.includes('period') ||
    status.includes('quarter')
  ) {
    return 'live';
  }

  if (
    rawStatus === 'STATUS_FINAL' ||
    rawStatus === 'STATUS_COMPLETE' ||
    status.includes('final') ||
    status.includes('complete')
  ) {
    return 'final';
  }

  return 'upcoming';
}

function groupBySport(games) {
  return games.reduce((groups, game) => {
    const sport = game.sport || game.sportKey || 'Other';

    if (!groups[sport]) {
      groups[sport] = [];
    }

    groups[sport].push(game);
    return groups;
  }, {});
}

function renderSportGroup(sport, games) {
  return `
    <div class="sport-group">
      <h3>${sport}</h3>
      ${games.map(renderGameCard).join('')}
    </div>
  `;
}

function renderSection(title, games) {
  if (!games.length) {
    return '';
  }

  const groupedGames = groupBySport(games);

  return `
    <section class="scoreboard-section">
      <div class="section-header">
        <h2>${title}</h2>
        <span>${games.length}</span>
      </div>

      ${Object.entries(groupedGames)
        .map(([sport, sportGames]) => renderSportGroup(sport, sportGames))
        .join('')}
    </section>
  `;
}

export async function renderScoreboard() {
  try {
    const result = await getAvailableGames('ALL');
    const games = result.data || [];
    const lastUpdated = formatLastUpdated();

    const liveGames = games.filter(game => getGameSection(game) === 'live');
    const upcomingGames = games.filter(game => getGameSection(game) === 'upcoming');
    const finalGames = games.filter(game => getGameSection(game) === 'final');

    return `
        <div class="page-header">
        <h2>Scoreboard</h2>
        <p class="last-updated">Last updated: ${lastUpdated}</p>
        <p>${games.length} games available.</p>
        </div>

      ${renderSection('Live', liveGames)}
      ${renderSection('Upcoming', upcomingGames)}
      ${renderSection('Final', finalGames)}

      ${
        !games.length
          ? `
            <div class="card">
              No games found.
            </div>
          `
          : ''
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