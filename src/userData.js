import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  serverTimestamp,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { getCurrentUser, getFirebaseDb } from './firebase.js';

function requireUser_() {
  const user = getCurrentUser();
  if (!user) throw new Error('You must be signed in.');
  return user;
}

function db_() {
  return getFirebaseDb();
}

function keyPart_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'item';
}

function teamDocId_(sportKey, team) {
  return `${keyPart_(sportKey)}_${keyPart_(team)}`;
}

function golferDocId_(golfer) {
  return keyPart_(golfer);
}

function normalizeTeam_(value) {
  return String(value || '').trim().toLowerCase();
}

function userCollection_(name) {
  const user = requireUser_();
  return collection(db_(), 'users', user.uid, name);
}

function userDoc_(collectionName, id) {
  const user = requireUser_();
  return doc(db_(), 'users', user.uid, collectionName, id);
}

async function getCollectionItems_(name) {
  const snapshot = await getDocs(userCollection_(name));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function getUserFollowedTeams() {
  const rows = await getCollectionItems_('followedTeams');
  return rows
    .filter(row => row.sportKey && row.team)
    .sort((a, b) => Number(a.sortOrder || 9999) - Number(b.sortOrder || 9999));
}

export async function addUserFollowedTeam({ sportKey, eventId = '', team, opponent = '', spread = '', notes = '' }) {
  if (!sportKey || !team) throw new Error('Sport and team are required.');
  const existing = await getUserFollowedTeams();
  const id = teamDocId_(sportKey, team);
  const sortOrder = existing.find(row => row.id === id)?.sortOrder || existing.length + 1;

  await setDoc(userDoc_('followedTeams', id), {
    sportKey,
    eventId: String(eventId || ''),
    team,
    opponent,
    spread,
    notes,
    active: true,
    sortOrder,
    updatedAt: serverTimestamp(),
    createdAt: existing.find(row => row.id === id)?.createdAt || serverTimestamp()
  }, { merge: true });

  return getUserFollowedTeams();
}

export async function updateUserFollowedTeam(id, spread = '', notes = '') {
  await setDoc(userDoc_('followedTeams', id), {
    spread,
    notes,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return getUserFollowedTeams();
}

export async function removeUserFollowedTeam(id) {
  await deleteDoc(userDoc_('followedTeams', id));
  return getUserFollowedTeams();
}

export async function removeAllUserFollowedTeams() {
  const rows = await getDocs(userCollection_('followedTeams'));
  const batch = writeBatch(db_());
  rows.forEach(row => batch.delete(row.ref));
  await batch.commit();
  return [];
}

function isGameFinal_(game) {
  const status = String(game.status || '').toLowerCase();
  const raw = String(game.rawStatus || '').toLowerCase();
  return raw.includes('final') || raw.includes('complete') || status.includes('final') || status.includes('complete');
}

function isGameLive_(game) {
  const status = String(game.status || '').toLowerCase();
  const raw = String(game.rawStatus || '').toLowerCase();
  if (isGameFinal_(game)) return false;
  if (raw.includes('scheduled') || raw.includes('pre') || status.includes('scheduled') || status.includes('pm') || status.includes('am')) return false;
  return raw.includes('in_progress') || raw.includes('first_half') || raw.includes('second_half') || raw.includes('halftime') || status.includes('live') || status.includes('top') || status.includes('bot') || status.includes('half') || status.includes('quarter');
}

function isGameUpcoming_(game) {
  return !isGameLive_(game) && !isGameFinal_(game);
}

function findBestGame_(games, follow) {
  const team = normalizeTeam_(follow.team);
  const sportKey = String(follow.sportKey || '');
  const matches = games.filter(game => {
    if (String(game.sportKey || '') !== sportKey) return false;
    const away = normalizeTeam_(game.awayTeam);
    const home = normalizeTeam_(game.homeTeam);
    return away === team || home === team || away.includes(team) || home.includes(team) || team.includes(away) || team.includes(home);
  });

  if (!matches.length) return null;
  return matches.find(isGameLive_) || matches.filter(isGameFinal_).pop() || matches.find(isGameUpcoming_) || matches[0];
}

export function buildFollowedGamesFromTeams(followedTeams, availableGames) {
  return (followedTeams || []).map(follow => {
    const live = findBestGame_(availableGames || [], follow);
    const fallbackLive = {
      sport: follow.sportKey,
      sportKey: follow.sportKey,
      eventId: follow.eventId || '',
      selectedTeam: follow.team,
      awayTeam: follow.team,
      awayScore: '',
      homeTeam: follow.opponent || '',
      homeScore: '',
      status: 'Scheduled',
      clock: '',
      channel: '',
      startTime: '',
      rawStatus: 'STATUS_SCHEDULED'
    };

    return {
      ...follow,
      selectedTeam: follow.team,
      sport: live?.sport || follow.sportKey,
      eventId: live?.eventId || follow.eventId || '',
      live: live ? { ...live, selectedTeam: follow.team } : fallbackLive
    };
  }).sort((a, b) => Number(a.sortOrder || 9999) - Number(b.sortOrder || 9999));
}

export async function getUserFollowedGolfers() {
  const rows = await getCollectionItems_('followedGolfers');
  return rows
    .filter(row => row.golfer)
    .sort((a, b) => Number(a.sortOrder || 9999) - Number(b.sortOrder || 9999));
}

export async function addUserFollowedGolfer(golfer, note = '', favorite = false) {
  if (!golfer) throw new Error('Golfer is required.');
  const existing = await getUserFollowedGolfers();
  const id = golferDocId_(golfer);
  const sortOrder = existing.find(row => row.id === id)?.sortOrder || existing.length + 1;

  await setDoc(userDoc_('followedGolfers', id), {
    golfer,
    note,
    notes: note,
    favorite: favorite === true || favorite === 'true',
    sortOrder,
    updatedAt: serverTimestamp(),
    createdAt: existing.find(row => row.id === id)?.createdAt || serverTimestamp()
  }, { merge: true });

  return getUserFollowedGolfers();
}

export async function removeUserFollowedGolfer(golfer) {
  await deleteDoc(userDoc_('followedGolfers', golferDocId_(golfer)));
  return getUserFollowedGolfers();
}

export async function updateUserFollowedGolferOrder(golfers) {
  const batch = writeBatch(db_());
  (golfers || []).forEach((golfer, index) => {
    batch.set(userDoc_('followedGolfers', golferDocId_(golfer)), {
      golfer,
      sortOrder: index + 1,
      updatedAt: serverTimestamp()
    }, { merge: true });
  });
  await batch.commit();
  return getUserFollowedGolfers();
}

export async function removeAllUserFollowedGolfers() {
  const rows = await getDocs(userCollection_('followedGolfers'));
  const batch = writeBatch(db_());
  rows.forEach(row => batch.delete(row.ref));
  await batch.commit();
  return [];
}

export function mergeFollowedGolfersWithLive(followedGolfers, availableGolfers) {
  const lookup = {};
  (availableGolfers || []).forEach(row => {
    lookup[String(row.golfer || '').trim().toLowerCase()] = row;
  });

  return (followedGolfers || []).map(follow => {
    const live = lookup[String(follow.golfer || '').trim().toLowerCase()];
    return {
      ...follow,
      ...(live || {}),
      golfer: live?.golfer || follow.golfer,
      note: follow.note || follow.notes || '',
      notes: follow.notes || follow.note || ''
    };
  });
}

export async function getUserWorldCupTeams() {
  const rows = await getCollectionItems_('worldCupTeams');
  return rows
    .filter(row => row.team)
    .sort((a, b) => Number(a.sortOrder || 9999) - Number(b.sortOrder || 9999));
}

export async function addUserWorldCupTeam({ team, notes = '', favorite = false }) {
  if (!team) throw new Error('Team is required.');
  const existing = await getUserWorldCupTeams();
  const id = teamDocId_('WorldCup', team);
  const sortOrder = existing.find(row => row.id === id)?.sortOrder || existing.length + 1;

  await setDoc(userDoc_('worldCupTeams', id), {
    team,
    notes,
    favorite: favorite === true,
    enabled: true,
    sortOrder,
    updatedAt: serverTimestamp(),
    createdAt: existing.find(row => row.id === id)?.createdAt || serverTimestamp()
  }, { merge: true });

  return getUserWorldCupTeams();
}

export async function removeUserWorldCupTeam(team) {
  await deleteDoc(userDoc_('worldCupTeams', teamDocId_('WorldCup', team)));
  return getUserWorldCupTeams();
}

export async function updateUserWorldCupTeamNote(team, notes = '') {
  await setDoc(userDoc_('worldCupTeams', teamDocId_('WorldCup', team)), {
    team,
    notes,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return getUserWorldCupTeams();
}
