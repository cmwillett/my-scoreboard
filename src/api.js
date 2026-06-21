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