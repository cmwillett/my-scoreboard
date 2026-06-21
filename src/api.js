import { CONFIG } from './config.js';

async function apiRequest(action, params = {}) {
  const url = new URL(CONFIG.API_URL);

  url.searchParams.set('action', action);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

export async function getAvailableGames(sportKey = 'ALL') {
  return apiRequest('getAvailableGames', { sportKey });
}

export async function getAvailableGolfers() {
  return apiRequest('getAvailableGolfers');
}

export async function getGolfers() {
  return apiRequest('getGolfers');
}

export async function getWorldCupGames() {
  return apiRequest('getWorldCupGames');
}

export async function getFollowedTeams() {
  return apiRequest('getFollowedTeams');
}

export async function addFollowedTeam(sport, team, spread = '', note = '', favorite = false) {
  return apiRequest('addFollowedTeam', {
    sport,
    team,
    spread,
    note,
    favorite
  });
}

export async function removeFollowedTeam(sport, team) {
  return apiRequest('removeFollowedTeam', { sport, team });
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
  return apiRequest('removeFollowedGolfer', {
    golfer
  });
}

export async function getAvailableSports() {
  return apiRequest('getAvailableSports');
}

export async function getTeamsForSport(sport) {
  return apiRequest('getTeamsForSport', { sport });
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

export async function updateFollowedGame(id, spread = '', notes = '') {
  return apiRequest('updateFollowedGame', {
    id,
    spread,
    notes
  });
}

export async function removeFollowedGame(id) {
  return apiRequest('removeFollowedGame', {
    id
  });
}

export async function updateFollowedGolferOrder(golfers) {
  return apiRequest('updateFollowedGolferOrder', {
    golfers: JSON.stringify(golfers)
  });
}

export async function removeAllFollowedGames() {
  return apiRequest('removeAllFollowedGames');
}

export async function removeAllFollowedGolfers() {
  return apiRequest('removeAllFollowedGolfers');
}