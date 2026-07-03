import { CONFIG } from './config.js';
import {
  addUserFollowedTeam,
  addUserFollowedGolfer,
  addUserWorldCupTeam,
  buildFollowedGamesFromTeams,
  getUserFollowedTeams,
  getUserFollowedGolfers,
  getUserWorldCupTeams,
  mergeFollowedGolfersWithLive,
  removeAllUserFollowedTeams,
  removeAllUserFollowedGolfers,
  removeUserFollowedTeam,
  removeUserFollowedGolfer,
  removeUserWorldCupTeam,
  updateUserFollowedTeam,
  updateUserFollowedGolferOrder,
  updateUserWorldCupTeamNote
} from './userData.js';

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

async function getFollowedTeamsFromFirestore_() {
  return getUserFollowedTeams();
}


export async function getFollowedGames() {
  const [followedTeams, availableResult] = await Promise.all([
    getFollowedTeamsFromFirestore_(),
    getAvailableGames('ALL')
  ]);

  return {
    success: true,
    data: buildFollowedGamesFromTeams(followedTeams, availableResult.data || [])
  };
}

export async function getAllFollowedGames() {
  return getFollowedGames();
}

export async function addFollowedGame(game) {
  const teams = await addUserFollowedTeam({
    sportKey: game.sportKey,
    eventId: game.eventId,
    team: game.team,
    spread: game.spread || '',
    notes: game.notes || ''
  });
  return { success: true, data: teams };
}

export async function saveFavoriteGamePick(game) {
  return addFollowedGame(game);
}

export async function updateFollowedGame(id, spread = '', notes = '') {
  const teams = await updateUserFollowedTeam(id, spread, notes);
  return { success: true, data: teams };
}

export async function removeFollowedGame(id) {
  const teams = await removeUserFollowedTeam(id);
  return { success: true, data: teams };
}

export async function removeAllFollowedGames() {
  const teams = await removeAllUserFollowedTeams();
  return { success: true, data: teams };
}

export async function getFavoriteTeams() {
  return { success: true, data: [] };
}

export async function addFavoriteTeam({ sportKey, team, notes = '' }) {
  return addFollowedGame({ sportKey, team, notes });
}

export async function removeFavoriteTeam(sportKey, team) {
  return removeUserFollowedTeam(`${String(sportKey || '').toLowerCase()}_${String(team || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`)
    .then(data => ({ success: true, data }));
}

export async function getAvailableGolfers() {
  return apiRequest('getAvailableGolfers');
}

async function getFollowedGolfersFromFirestore_() {
  return getUserFollowedGolfers();
}


export async function getFollowedGolfers() {
  const [followedGolfers, availableResult] = await Promise.all([
    getFollowedGolfersFromFirestore_(),
    getAvailableGolfers()
  ]);

  return {
    success: true,
    data: mergeFollowedGolfersWithLive(followedGolfers, availableResult.data || [])
  };
}

export async function addFollowedGolfer(golfer, note = '', favorite = false) {
  const golfers = await addUserFollowedGolfer(golfer, note, favorite);
  return { success: true, data: golfers };
}

export async function removeFollowedGolfer(golfer) {
  const golfers = await removeUserFollowedGolfer(golfer);
  return { success: true, data: golfers };
}

export async function updateFollowedGolferOrder(golfers) {
  const updated = await updateUserFollowedGolferOrder(golfers);
  return { success: true, data: updated };
}

export async function removeAllFollowedGolfers() {
  const golfers = await removeAllUserFollowedGolfers();
  return { success: true, data: golfers };
}

export async function getPageVisibility() {
  return apiRequest('getPageVisibility');
}

export async function savePageVisibility(visibility) {
  return apiRequest('savePageVisibility', {
    visibility: JSON.stringify(visibility)
  });
}


async function getWorldCupTeamsFromFirestore_() {
  return getUserWorldCupTeams();
}


export async function getWorldCupPageData() {
  const backendResult = await apiRequest('getWorldCupPageData');
  const data = backendResult.data || {};
  const userTeams = await getWorldCupTeamsFromFirestore_();

  const followedTeams = userTeams;
  const favorites = [];
  const selected = userTeams;
  const candidateGames = data.upcomingGames || [];

  const selectedGames = [];
  selected.forEach(teamObj => {
    const game = candidateGames.find(g => g.awayTeam === teamObj.team || g.homeTeam === teamObj.team);
    if (game && !selectedGames.some(existing => existing.eventId === game.eventId)) {
      selectedGames.push({ ...game, selectedTeam: teamObj.team, selectedType: 'followed', notes: teamObj.notes || '' });
    }
  });

  return {
    success: true,
    data: {
      ...data,
      favorites,
      followedTeams,
      selectedGames
    }
  };
}

export async function refreshWorldCupScores() {
  return apiRequest('refreshWorldCupScores');
}

export async function manualRefreshSport(sportKey) {
  return apiRequest('manualRefreshSport', { sportKey });
}

export async function manualRefreshAllSports() {
  return apiRequest('manualRefreshAllSports');
}

export async function addWorldCupFollowedTeam({ team, notes = '' }) {
  const teams = await addUserWorldCupTeam({ team, notes, favorite: false });
  return { success: true, data: teams };
}

export async function addWorldCupFavoriteTeam({ team, notes = '' }) {
  return addWorldCupFollowedTeam({ team, notes });
}

export async function removeWorldCupFollowedTeam(team) {
  const teams = await removeUserWorldCupTeam(team);
  return { success: true, data: teams };
}

export async function removeWorldCupFavoriteTeam(team) {
  return removeWorldCupFollowedTeam(team);
}

export async function updateWorldCupTeamNote(type, team, notes = '') {
  const teams = await updateUserWorldCupTeamNote(team, notes);
  return { success: true, data: teams };
}


export async function getSettingsData() {
  return apiRequest('getSettingsData');
}

export async function saveSportsRefreshSettings(sports) {
  return apiRequest('saveSportsRefreshSettings', {
    sports: JSON.stringify(sports)
  });
}

export async function saveWorldCupRefreshSettings(enabled) {
  return apiRequest('saveWorldCupRefreshSettings', {
    enabled: enabled ? 'true' : 'false'
  });
}


export async function getAmbientMusicSettings() {
  return apiRequest('getAmbientMusicSettings');
}

export async function saveAmbientMusicSettings(tracks) {
  return apiRequest('saveAmbientMusicSettings', {
    tracks: JSON.stringify(tracks)
  });
}
