import { formatUpcomingGameTime } from '../utils/date.js';

function normalizeTeamName(value) {
  return String(value || '').trim().toLowerCase();
}

function getFollowedTeamNames(followedGame, game) {
  const teams = [];

  if (Array.isArray(followedGame.followedTeams)) teams.push(...followedGame.followedTeams);
  if (Array.isArray(followedGame.selectedTeams)) teams.push(...followedGame.selectedTeams);
  if (Array.isArray(followedGame.teams)) teams.push(...followedGame.teams);
  if (followedGame.team) teams.push(followedGame.team);
  if (followedGame.selectedTeam) teams.push(followedGame.selectedTeam);

  return [...new Set(teams.map(normalizeTeamName).filter(Boolean))];
}

function renderTeamNameWithFollowIcon(name, isWinner, isFollowed, hasPossession) {
  return `${hasPossession ? '<span class="possession-icon" title="Has the ball">🏈</span> ' : ''}${isWinner ? '🏆 ' : ''}${isFollowed ? '<span class="followed-team-icon" title="Followed team">📌</span> ' : ''}${name || '-'}`;
}

export function renderGameCard(followedGame) {
  const game = followedGame.live || followedGame;

  const status = formatUpcomingGameTime(game.status || game.startTime || '');
  const channel = game.channel || '';

  const awayScore = Number(game.awayScore);
  const homeScore = Number(game.homeScore);

  const hasScores = !Number.isNaN(awayScore) && !Number.isNaN(homeScore);

  const rawStatus = String(game.rawStatus || '').toUpperCase();
  const statusText = String(game.status || '').toLowerCase();
  const isFinal =
    rawStatus === 'STATUS_FINAL' ||
    rawStatus === 'STATUS_COMPLETE' ||
    rawStatus === 'STATUS_FULL_TIME' ||
    statusText.includes('final') ||
    statusText.includes('complete');

  const awayWinner = hasScores && isFinal && awayScore > homeScore;
  const homeWinner = hasScores && isFinal && homeScore > awayScore;

  const isLive =
    game.rawStatus === 'STATUS_IN_PROGRESS' ||
    String(game.status || '').toLowerCase().includes('live');

  const isFavorite = followedGame.isFavorite === true;
  const selectedTeam = followedGame.team || game.awayTeam || game.homeTeam || '';
  const isAutoFavorite = isFavorite && String(followedGame.id || '').startsWith('favorite_');
  const followedTeamNames = getFollowedTeamNames(followedGame, game);
  const awayIsFollowed = followedTeamNames.includes(normalizeTeamName(game.awayTeam));
  const homeIsFollowed = followedTeamNames.includes(normalizeTeamName(game.homeTeam));

  // Down/distance + who has the ball - only present (from Code.gs) while a
  // football game is actually in progress, so this naturally disappears for
  // upcoming/final games and for sports other than NFL/CFB.
  const situationText = isLive ? String(game.situation || '') : '';
  const awayHasBall = isLive && game.possession === 'away';
  const homeHasBall = isLive && game.possession === 'home';

  return `
    <div class="score-card ${isFavorite ? 'favorite-score-card' : ''}" data-followed-game-id="${followedGame.id}">
      <div class="team-row ${awayWinner ? 'final-winner' : homeWinner ? 'final-loser' : ''}">
        <span>${renderTeamNameWithFollowIcon(game.awayTeam, awayWinner, awayIsFollowed, awayHasBall)}</span>
        <strong>${game.awayScore || '-'}</strong>
      </div>

      <div class="team-row ${homeWinner ? 'final-winner' : awayWinner ? 'final-loser' : ''}">
        <span>${renderTeamNameWithFollowIcon(game.homeTeam, homeWinner, homeIsFollowed, homeHasBall)}</span>
        <strong>${game.homeScore || '-'}</strong>
      </div>

      <div class="game-meta-line">
        ${channel ? `<span>${channel}</span>` : ''}
        ${status ? `<span class="${isLive ? 'game-live' : ''}">${status}</span>` : ''}
        ${situationText ? `<span class="game-situation">${situationText}</span>` : ''}
      </div>

      ${
        isFavorite
          ? `<div class="favorite-game-label">★ Favorite Team</div>`
          : ''
      }

      ${
        followedGame.spread || followedGame.notes
          ? `
            <div class="game-details">
              ${
                followedGame.spread
                  ? `
                    <div class="game-detail-block">
                      <div class="game-detail-title">Spread</div>
                      <div class="game-detail-text">${followedGame.spread}</div>
                    </div>
                  `
                  : ''
              }

              ${
                followedGame.notes
                  ? `
                    <div class="game-detail-block">
                      <div class="game-detail-title">Notes</div>
                      <div class="game-detail-text">${followedGame.notes}</div>
                    </div>
                  `
                  : ''
              }
            </div>
          `
          : ''
      }

      ${
        followedGame.isPickEm
          ? `<div class="pickem-tag">🏈 Pick 'Em</div>`
          : ''
      }

      <div class="game-card-buttons">
        <button
          class="small-btn card-refresh-btn"
          data-sport-key="${followedGame.sportKey || game.sportKey || ''}"
          title="Refresh ${game.sport || 'this'} scores now"
          aria-label="Refresh scores"
        >
          🔄
        </button>

        <button
          class="small-btn ${isAutoFavorite ? 'edit-favorite-game-btn' : 'edit-followed-game-btn'}"
          data-id="${followedGame.id}"
          data-sport-key="${followedGame.sportKey || game.sportKey || ''}"
          data-event-id="${followedGame.eventId || game.eventId || ''}"
          data-team="${selectedTeam}"
          data-spread="${followedGame.spread || ''}"
          data-notes="${followedGame.notes || ''}"
          data-is-pick-em="${followedGame.isPickEm ? 'true' : 'false'}"
          data-sport="${followedGame.sportKey || game.sportKey || ''}"
        >
          Edit
        </button>

        ${
          isAutoFavorite
            ? ''
            : `
              <button
                class="small-btn danger remove-followed-game-btn"
                data-id="${followedGame.id}"
              >
                Remove
              </button>
            `
        }
      </div>
    </div>
  `;
}
