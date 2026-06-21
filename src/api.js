import { CONFIG } from './config.js';

async function apiRequest(action, params = {}) {
  const url = new URL(CONFIG.API_URL);
  url.searchParams.set('action', action);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  const result = await response.json();

  if (result && result.success === false) {
    throw new Error(result.error || 'API request failed.');
  }

  return result;
}

export async function getAvailableSports() {
  return apiRequest('getAvailableSports');
}


export async function checkAdminPin(pin) {
  return apiRequest('checkAdminPin', { pin });
}

export async function getTeamsForSport(sport) {
  return apiRequest('getTeamsForSport', { sport });
}

export async function getAvailableGames(sportKey = 'ALL') {
  return apiRequest('getAvailableGames', { sportKey });
}

export async function getFollowedGames() {
  return apiRequest('getFollowedGames');
}

export async function addFollowedGame(game) {
  return apiRequest('addFollowedGame', {
    sportKey: game.sportKey,
    eventId: game.eventId,
    team: game.team,
    spread: game.spread || '',
    notes: game.notes || ''
  });
}

export async function saveFavoriteGamePick(game) {
  return apiRequest('saveFavoriteGamePick', {
    sportKey: game.sportKey,
    eventId: game.eventId,
    team: game.team,
    spread: game.spread || '',
    notes: game.notes || ''
  });
}

export async function updateFollowedGame(id, spread = '', notes = '') {
  return apiRequest('updateFollowedGame', {
    id,
    spread,
    notes
  });
}

export async function removeFollowedGame(id) {
  return apiRequest('removeFollowedGame', { id });
}

export async function removeAllFollowedGames() {
  return apiRequest('removeAllFollowedGames');
}

export async function getFavoriteTeams() {
  return apiRequest('getFavoriteTeams');
}

export async function addFavoriteTeam({ sportKey, team, notes = '' }) {
  return apiRequest('addFavoriteTeam', {
    sportKey,
    team,
    notes
  });
}

export async function removeFavoriteTeam(sportKey, team) {
  return apiRequest('removeFavoriteTeam', {
    sportKey,
    team
  });
}

export async function getAvailableGolfers() {
  return apiRequest('getAvailableGolfers');
}

export async function getFollowedGolfers() {
  return apiRequest('getFollowedGolfers');
}

export async function addFollowedGolfer(golfer, note = '', favorite = false) {
  return apiRequest('addFollowedGolfer', {
    golfer,
    note,
    favorite
  });
}

export async function removeFollowedGolfer(golfer) {
  return apiRequest('removeFollowedGolfer', { golfer });
}

export async function updateFollowedGolferOrder(golfers) {
  return apiRequest('updateFollowedGolferOrder', {
    golfers: JSON.stringify(golfers)
  });
}

export async function removeAllFollowedGolfers() {
  return apiRequest('removeAllFollowedGolfers');
}

export async function getPageVisibility() {
  return apiRequest('getPageVisibility');
}

export async function savePageVisibility(visibility) {
  return apiRequest('savePageVisibility', {
    visibility: JSON.stringify(visibility)
  });
}
