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

export async function getGolfers() {
  return apiRequest('getGolfers');
}

export async function getWorldCupGames() {
  return apiRequest('getWorldCupGames');
}