import {
  getFollowedGames,
  saveFavoriteGamePick,
  updateFollowedGame,
  removeFollowedGame,
  removeAllFollowedGames,
  manualRefreshSport
} from '../api.js';
import { renderGameCard } from '../components/gameCard.js';
import {
  openConfirmModal,
  openGameEditModal,
  openMessageModal,
  showToast
} from '../components/modal.js';
import { formatLastUpdated } from '../utils/date.js';
import { renderDensityToggle } from '../components/pageTools.js';
import { renderPickEmsSummary, renderPickEmsCardForSport } from '../components/pickEmsSummary.js';


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

// root defaults to the whole document (a normal full-page render), but the
// per-card "refresh this sport" patch below (patchSportSections_) also
// calls this scoped to just the fragment it inserted/replaced - re-running
// it against `document` there would re-bind a second click listener onto
// every OTHER already-existing button on the page (their DOM nodes weren't
// touched by the patch, so they're still the same elements from the last
// full render), stacking duplicate handlers a little more with every
// surgical refresh. Scoping to the new fragment keeps each button bound
// exactly once no matter how many patches happen. The remove-all-games-btn
// wiring stays document-only since that control is a page singleton that
// never appears inside a patched fragment.
function attachScoreboardHandlers(root = document) {
  if (root === document) {
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
  }

  root.querySelectorAll('.edit-followed-game-btn').forEach(btn => {
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

  root.querySelectorAll('.edit-favorite-game-btn').forEach(btn => {
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

  root.querySelectorAll('.remove-followed-game-btn').forEach(btn => {
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

  root.querySelectorAll('.card-refresh-btn').forEach(btn => {
    const sportKey = btn.dataset.sportKey || '';
    if (sportsCoolingDown_.has(sportKey)) btn.disabled = true;

    btn.addEventListener('click', () => refreshSportInPlace_(sportKey));
  });
}

// --- Per-card "refresh this sport now" ------------------------------------
//
// ESPN's scoreboard endpoint returns every game for a sport in one call, so
// there's no cheaper way to refresh "just this game" - clicking the button
// on one card refreshes (and in-place updates) every followed game in that
// same sport, wherever they currently sit (Live/Upcoming/Recent Finals),
// plus that sport's Pick 'Ems card if it has one. A short shared cooldown
// per sport (not per button) stops a flurry of taps across several cards of
// the same sport from firing overlapping refreshes back to back.
const SPORT_REFRESH_COOLDOWN_MS = 8000;
const sportsCoolingDown_ = new Set();

function setSportRefreshButtonsState_(sportKey, { refreshing }) {
  const disabled = refreshing || sportsCoolingDown_.has(sportKey);

  document.querySelectorAll(`.card-refresh-btn[data-sport-key="${sportKey}"]`).forEach(btn => {
    btn.disabled = disabled;
    btn.classList.toggle('is-refreshing', refreshing);
  });
}

// Finds/replaces/removes the one <details data-section-key="section:TITLE:
// sport:SPORT"> group for this sport within each of the three outer
// sections, using the freshly-fetched (already-deduped) games for this
// sport only. Leaves every other sport's groups, and every other section's
// contents, completely untouched.
function patchSportSections_(sportKey, sportGames) {
  if (!sportGames.length) return;

  const sportDisplayName = (() => {
    const first = sportGames[0];
    const game = first.live || first;
    return game.sport || first.sport || sportKey;
  })();

  const SECTION_DEFS = [
    { title: 'Live', match: g => getGameSection(g) === 'live' },
    { title: 'Upcoming', match: g => getGameSection(g) === 'upcoming' },
    { title: 'Recent Finals', match: g => getGameSection(g) === 'final' }
  ];

  SECTION_DEFS.forEach(({ title, match }) => {
    const sectionEl = document.querySelector(`details.scoreboard-section[data-section-key="section:${title}"]`);
    if (!sectionEl) return;

    const body = sectionEl.querySelector('.collapsible-body');
    if (!body) return;

    const groupKey = `section:${title}:sport:${sportDisplayName}`;
    const existingGroup = body.querySelector(`[data-section-key="${groupKey}"]`);
    const sectionGames = sportGames.filter(match);

    if (sectionGames.length) {
      const wasOpen = existingGroup ? existingGroup.open : false;

      if (existingGroup) {
        existingGroup.outerHTML = renderSportGroup(title, sportDisplayName, sectionGames);
      } else {
        const emptyState = body.querySelector('.empty-state.small');
        if (emptyState) emptyState.remove();
        body.insertAdjacentHTML('beforeend', renderSportGroup(title, sportDisplayName, sectionGames));
      }

      const refreshedGroup = body.querySelector(`[data-section-key="${groupKey}"]`);
      if (refreshedGroup) {
        refreshedGroup.open = wasOpen;
        attachScoreboardHandlers(refreshedGroup);
      }
    } else if (existingGroup) {
      existingGroup.remove();

      if (!body.querySelector('.sport-group')) {
        body.innerHTML = '<div class="card empty-state small"><p>No games in this section.</p></div>';
      }
    }

    const countEl = sectionEl.querySelector('summary .section-count');
    if (countEl) countEl.textContent = String(body.querySelectorAll('.score-card').length);
  });
}

// Pick 'Ems membership (which picks count, and which contest they belong
// to) only ever changes when Craig edits a follow - a live-score refresh
// can only change an existing pick's graded status, never add or drop one.
// So this only ever needs to patch an ALREADY-shown card's content; it
// never has to decide whether to insert one that wasn't there before.
function patchSportPickEms_(sportKey, followedRaw) {
  const existingCard = document.querySelector(`[data-section-key="pickems:${sportKey}"]`);
  if (!existingCard) return;

  const wasOpen = existingCard.open;
  const newHtml = renderPickEmsCardForSport(followedRaw, sportKey);

  if (!newHtml) {
    existingCard.remove();
    return;
  }

  existingCard.outerHTML = newHtml;

  const refreshed = document.querySelector(`[data-section-key="pickems:${sportKey}"]`);
  if (refreshed) refreshed.open = wasOpen;
}

async function refreshSportInPlace_(sportKey) {
  if (!sportKey || sportsCoolingDown_.has(sportKey)) return;

  setSportRefreshButtonsState_(sportKey, { refreshing: true });

  try {
    await manualRefreshSport(sportKey);

    const followedResult = await getFollowedGames();
    const followedRaw = followedResult.data || [];
    const allGames = dedupeFollowedGames(followedRaw);
    const sportGames = allGames.filter(g => {
      const game = g.live || g;
      return (game.sportKey || g.sportKey || '') === sportKey;
    });

    patchSportSections_(sportKey, sportGames);
    patchSportPickEms_(sportKey, followedRaw);

    showToast('Scores refreshed.');
  } catch (err) {
    console.error(err);
    openMessageModal({
      title: 'Could Not Refresh',
      message: "That sport's scores could not be refreshed right now. Try again in a moment."
    });
  } finally {
    sportsCoolingDown_.add(sportKey);
    setSportRefreshButtonsState_(sportKey, { refreshing: false });

    setTimeout(() => {
      sportsCoolingDown_.delete(sportKey);
      setSportRefreshButtonsState_(sportKey, { refreshing: false });
    }, SPORT_REFRESH_COOLDOWN_MS);
  }
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
