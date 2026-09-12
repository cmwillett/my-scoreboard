import {
  getFollowedGames,
  saveFavoriteGamePick,
  updateFollowedGame,
  removeFollowedGame,
  removeAllFollowedGames
} from '../api.js';
import { renderGameCard } from '../components/gameCard.js';
import {
  openConfirmModal,
  openGameEditModal,
  showToast
} from '../components/modal.js';
import { formatLastUpdated } from '../utils/date.js';
import { renderDensityToggle } from '../components/pageTools.js';
import { renderPickEmsSummary } from '../components/pickEmsSummary.js';


function getFollowedTeamNames(item) {
  const teams = [];
  if (Array.isArray(item.followedTeams)) teams.push(...item.followedTeams);
  if (Array.isArray(item.selectedTeams)) teams.push(...item.selectedTeams);
  if (Array.isArray(item.teams)) teams.push(...item.teams);
  if (item.team) teams.push(item.team);
  if (item.selectedTeam) teams.push(item.selectedTeam);
  return [...new Set(teams.map(team => String(team || '').trim()).filter(Boolean))];
}

function mergeFollowedTeamNames(existing, incoming) {
  return [...new Set([...getFollowedTeamNames(existing), ...getFollowedTeamNames(incoming)])];
}

function getGameSection(followedGame) {
  const game = followedGame.live || followedGame;
  const rawStatus = game.rawStatus || '';
  const status = String(game.status || '').toLowerCase();

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


function getGameKey(followedGame) {
  const game = followedGame.live || followedGame;
  const sportKey = game.sportKey || followedGame.sportKey || game.sport || followedGame.sport || '';
  const eventId = game.eventId || followedGame.eventId || '';
  if (sportKey && eventId) return `${sportKey}_${eventId}`;
  return `${sportKey}_${followedGame.team || game.awayTeam || ''}_${game.homeTeam || ''}_${game.startTime || ''}`;
}

function mergeGameNotes(existing, incoming) {
  const parts = [];
  [existing, incoming].forEach(item => {
    if (!item) return;
    const team = item.team || item.selectedTeam || '';
    const note = item.notes || '';
    if (!note) return;
    parts.push(team ? `${team}: ${note}` : note);
  });
  return [...new Set(parts)].join('\n');
}

function dedupeFollowedGames(games) {
  const map = new Map();

  games.forEach(game => {
    const key = getGameKey(game);
    if (!map.has(key)) {
      map.set(key, { ...game, followedTeams: getFollowedTeamNames(game) });
      return;
    }

    const existing = map.get(key);
    map.set(key, {
      ...existing,
      notes: mergeGameNotes(existing, game) || existing.notes || game.notes || '',
      followedTeams: mergeFollowedTeamNames(existing, game),
      duplicateFollowIds: [
        ...(existing.duplicateFollowIds || [existing.id].filter(Boolean)),
        game.id
      ].filter(Boolean)
    });
  });

  return Array.from(map.values());
}

// ESPN's pre-game status text looks like "9/9 - 8:20 PM EDT". Parse that into a
// real sortable timestamp so games within a sport group show soonest-first
// instead of in whatever order they were followed. Live/final status text
// ("Q3 05:12", "Final") won't match, and that's fine - those fall back to
// Number.MAX_SAFE_INTEGER below and simply keep their existing relative order.
function parseGameStartTime_(text) {
  const match = String(text || '').match(/(\d{1,2})\/(\d{1,2})\D+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;

  const [, monthStr, dayStr, hourStr, minuteStr, ampm] = match;
  const month = Number(monthStr) - 1;
  const day = Number(dayStr);
  let hour = Number(hourStr) % 12;
  if (/pm/i.test(ampm)) hour += 12;
  const minute = Number(minuteStr);

  const now = new Date();
  const candidate = new Date(now.getFullYear(), month, day, hour, minute);

  // A season can cross a calendar year boundary (checking in December for a
  // January game). If the parsed date looks more than two weeks in the past,
  // it actually belongs to next year.
  const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
  if (candidate.getTime() < now.getTime() - twoWeeksMs) {
    candidate.setFullYear(candidate.getFullYear() + 1);
  }

  return candidate.getTime();
}

function getGameSortTime_(followedGame) {
  const game = followedGame.live || followedGame;
  const parsed = parseGameStartTime_(game.status) ?? parseGameStartTime_(game.startTime);
  return parsed === null ? Number.MAX_SAFE_INTEGER : parsed;
}

function groupBySport(games) {
  return games.reduce((groups, followedGame) => {
    const game = followedGame.live || followedGame;
    const sport = game.sport || followedGame.sport || game.sportKey || 'Other';

    if (!groups[sport]) groups[sport] = [];

    groups[sport].push(followedGame);
    return groups;
  }, {});
}

function attachScoreboardHandlers() {
  const removeAllBtn = document.getElementById('remove-all-games-btn');

  if (removeAllBtn) {
    removeAllBtn.addEventListener('click', () => {
      openConfirmModal({
        title: 'Remove All Games?',
        message: 'This will remove all manually followed games from the scoreboard.',
        confirmText: 'Remove All',
        onConfirm: async () => {
          await removeAllFollowedGames();
          showToast('All games removed.');
          await window.refreshCurrentPage?.();
        }
      });
    });
  }

  document.querySelectorAll('.edit-followed-game-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sportKey = String(btn.dataset.sport || '').toUpperCase();
      openGameEditModal({
        id: btn.dataset.id,
        spread: btn.dataset.spread || '',
        notes: btn.dataset.notes || '',
        isPickEm: btn.dataset.isPickEm === 'true',
        showPickEmToggle: sportKey === 'NFL' || sportKey === 'CFB',
        onSave: async ({ id, spread, notes, isPickEm }) => {
          await updateFollowedGame(id, spread, notes, isPickEm);
          showToast('Game saved.');
          await window.refreshCurrentPage?.();
        }
      });
    });
  });

  document.querySelectorAll('.edit-favorite-game-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openGameEditModal({
        id: btn.dataset.id,
        spread: btn.dataset.spread || '',
        notes: btn.dataset.notes || '',
        onSave: async ({ spread, notes }) => {
          await saveFavoriteGamePick({
            sportKey: btn.dataset.sportKey,
            eventId: btn.dataset.eventId,
            team: btn.dataset.team,
            spread,
            notes
          });
          showToast('Favorite game saved.');
          await window.refreshCurrentPage?.();
        }
      });
    });
  });

  document.querySelectorAll('.remove-followed-game-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openConfirmModal({
        title: 'Remove Game?',
        message: 'This will remove this game from your scoreboard.',
        confirmText: 'Remove',
        onConfirm: async () => {
          await removeFollowedGame(btn.dataset.id);
          showToast('Game removed.');
          await window.refreshCurrentPage?.();
        }
      });
    });
  });
}

// Each league within a Live/Upcoming/Recent Finals section is its own
// collapsible, collapsed by default - so opening e.g. "Upcoming" with 16 NFL
// games and a handful of CFB games doesn't force scrolling past one league
// to reach the other. Reuses the same nested-collapsible look the admin
// page already uses for sections-within-a-section.
//
// sectionTitle is folded into data-section-key (not just the league name)
// because the same league can legitimately appear under more than one
// parent section at once (e.g. one Thursday NFL game live while the Sunday
// slate is still Upcoming) - keying on the league name alone would give two
// different <details> elements the same key and make app.js's refresh
// snapshot restore the wrong one's open/closed state onto both.
function renderSportGroup(sectionTitle, sport, games) {
  const sortedGames = [...games].sort((a, b) => getGameSortTime_(a) - getGameSortTime_(b));

  return `
    <details class="collapsible-section admin-nested-collapsible sport-group" data-section-key="section:${sectionTitle}:sport:${sport}">
      <summary>
        <span>${sport}</span>
        <span class="section-count">${sortedGames.length}</span>
      </summary>
      <div class="collapsible-body">
        <div class="score-card-grid">
          ${sortedGames.map(renderGameCard).join('')}
        </div>
      </div>
    </details>
  `;
}

function renderSection(title, games) {
  const groupedGames = groupBySport(games);
  const body = games.length
    ? Object.entries(groupedGames)
      .map(([sport, sportGames]) => renderSportGroup(title, sport, sportGames))
      .join('')
    : '<div class="card empty-state small"><p>No games in this section.</p></div>';

  return `
    <details class="collapsible-section scoreboard-section" data-section-key="section:${title}">
      <summary>
        <span>${title}</span>
        <span class="section-count">${games.length}</span>
      </summary>
      <div class="collapsible-body">
        ${body}
      </div>
    </details>
  `;
}

export async function renderScoreboard() {
  try {
    const followedResult = await getFollowedGames();
    const followedRaw = followedResult.data || [];
    const games = dedupeFollowedGames(followedRaw);
    const lastUpdated = formatLastUpdated();
    const pickEmsHtml = renderPickEmsSummary(followedRaw);

    const liveGames = games.filter(game => getGameSection(game) === 'live');
    const upcomingGames = games.filter(game => getGameSection(game) === 'upcoming');
    const finalGames = games.filter(game => getGameSection(game) === 'final');

    setTimeout(attachScoreboardHandlers, 0);

    return `
      <div class="page-header">
        <div class="page-title-row">
          <h2>Scoreboard</h2>

          <div class="page-actions">
            ${renderDensityToggle('scoreboard')}
            ${
              games.length
                ? `
                  <button id="remove-all-games-btn" class="small-btn danger">
                    Remove All
                  </button>
                `
                : ''
            }
          </div>
        </div>

        <p class="last-updated">Scoreboard Last Updated: ${lastUpdated}</p>
        <p>${games.length} games showing. Duplicate matchups are combined automatically.</p>
      </div>

      ${pickEmsHtml}

      ${renderSection('Live', liveGames)}
      ${renderSection('Upcoming', upcomingGames)}
      ${renderSection('Recent Finals', finalGames)}

      ${
        !games.length
          ? `
            <div class="card empty-state">
              <h3>No followed games yet</h3>
              <p>Go to Add Game/Golfer to follow a specific game.</p>
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
