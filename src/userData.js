import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  writeBatch,
  deleteField,
  updateDoc
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

function titleFromKey_(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
    .trim();
}

function parseTeamDocId_(id, defaultSportKey = '') {
  const parts = String(id || '').split('_');
  const first = parts.shift() || '';
  return {
    sportKey: defaultSportKey || first.toUpperCase(),
    team: titleFromKey_(parts.join('_'))
  };
}

function normalizeSportKey_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.toLowerCase() === 'worldcup' || text.toLowerCase() === 'world_cup') return 'WorldCup';
  return text.toUpperCase();
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

function userRootDoc_() {
  const user = requireUser_();
  return doc(db_(), 'users', user.uid);
}

async function updateUserSyncStatus_(patch) {
  const safePatch = patch || {};
  await setDoc(userRootDoc_(), {
    sync: {
      ...safePatch,
      updatedAt: serverTimestamp()
    }
  }, { merge: true });
}

async function getCollectionItems_(name) {
  const snapshot = await getDocs(userCollection_(name));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function getUserFollowedTeams() {
  const snapshot = await getDocs(userCollection_('followedTeams'));
  const batch = writeBatch(db_());
  let needsMigration = false;

  const rows = snapshot.docs.map((item, index) => {
    const data = item.data() || {};
    const parsed = parseTeamDocId_(item.id);
    const sportKey = normalizeSportKey_(data.sportKey || parsed.sportKey);
    const team = String(data.team || parsed.team || '').trim();
    const normalized = {
      id: item.id,
      type: 'followedTeam',
      schemaVersion: 2,
      docKey: item.id,
      sportKey,
      team,
      teamKey: data.teamKey || keyPart_(team),
      eventId: String(data.eventId || ''),
      opponent: data.opponent || '',
      spread: data.spread || '',
      notes: data.notes || '',
      active: data.active !== false,
      sortOrder: Number(data.sortOrder || index + 1),
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null
    };

    const patch = {};
    ['type', 'schemaVersion', 'docKey', 'sportKey', 'team', 'teamKey', 'active', 'sortOrder'].forEach(key => {
      if (data[key] === undefined || data[key] === null || data[key] === '') patch[key] = normalized[key];
    });
    if (!data.createdAt) patch.createdAt = serverTimestamp();
    if (!data.schemaVersion || Number(data.schemaVersion) < 2) {
      patch.schemaVersion = 2;
      patch.migratedAt = serverTimestamp();
    }
    if (Object.keys(patch).length) {
      needsMigration = true;
      batch.set(item.ref, patch, { merge: true });
    }

    return normalized;
  });

  if (needsMigration) await batch.commit();

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
    type: 'followedTeam',
    schemaVersion: 2,
    docKey: id,
    sportKey: normalizeSportKey_(sportKey),
    eventId: String(eventId || ''),
    team,
    teamKey: keyPart_(team),
    opponent,
    spread,
    notes,
    active: true,
    sortOrder,
    updatedAt: serverTimestamp(),
    createdAt: existing.find(row => row.id === id)?.createdAt || serverTimestamp()
  }, { merge: true });

  await updateUserSyncStatus_({
    lastFollowWrite: 'followedTeams',
    lastFollowedTeam: `${sportKey}: ${team}`,
    followedTeamsCount: existing.filter(row => row.id !== id).length + 1
  });
  await syncPairedRokuDevice().catch(err => console.warn('Roku sync skipped.', err));

  return getUserFollowedTeams();
}

export async function updateUserFollowedTeam(id, spread = '', notes = '') {
  await setDoc(userDoc_('followedTeams', id), {
    type: 'followedTeam',
    schemaVersion: 2,
    docKey: id,
    spread,
    notes,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return getUserFollowedTeams();
}

export async function removeUserFollowedTeam(id) {
  await deleteDoc(userDoc_('followedTeams', id));
  const rows = await getUserFollowedTeams();
  await updateUserSyncStatus_({
    lastFollowWrite: 'removeFollowedTeam',
    followedTeamsCount: rows.length
  });
  await syncPairedRokuDevice().catch(err => console.warn('Roku sync skipped.', err));
  return rows;
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

function teamMatches_(a, b) {
  const left = normalizeTeam_(a);
  const right = normalizeTeam_(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function getOpponentFromGame_(game, followedTeam) {
  if (!game) return '';

  if (teamMatches_(game.awayTeam, followedTeam)) return game.homeTeam || '';
  if (teamMatches_(game.homeTeam, followedTeam)) return game.awayTeam || '';

  return game.homeTeam || game.awayTeam || '';
}

function findBestGame_(games, follow) {
  const team = normalizeTeam_(follow.team);
  const sportKey = String(follow.sportKey || '');
  const eventId = String(follow.eventId || '');

  // Prefer an exact event match when Firestore has the current ESPN event id.
  // This prevents fallback cards with blank opponents when short team names differ.
  if (eventId) {
    const eventMatch = (games || []).find(game =>
      String(game.sportKey || '') === sportKey &&
      String(game.eventId || '') === eventId
    );
    if (eventMatch) return eventMatch;
  }

  const matches = (games || []).filter(game => {
    if (String(game.sportKey || '') !== sportKey) return false;
    return teamMatches_(game.awayTeam, team) || teamMatches_(game.homeTeam, team);
  });

  if (!matches.length) return null;
  return matches.find(isGameLive_) || matches.filter(isGameFinal_).pop() || matches.find(isGameUpcoming_) || matches[0];
}

export function buildFollowedGamesFromTeams(followedTeams, availableGames) {
  return (followedTeams || []).map(follow => {
    const live = findBestGame_(availableGames || [], follow);
    const opponent = live ? getOpponentFromGame_(live, follow.team) : (follow.opponent || '');
    const fallbackLive = {
      sport: follow.sportKey,
      sportKey: follow.sportKey,
      eventId: follow.eventId || '',
      selectedTeam: follow.team,
      awayTeam: follow.team,
      awayScore: '',
      homeTeam: opponent,
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
      opponent,
      live: live ? { ...live, selectedTeam: follow.team } : fallbackLive
    };
  }).sort((a, b) => Number(a.sortOrder || 9999) - Number(b.sortOrder || 9999));
}

export async function getUserFollowedGolfers() {
  const snapshot = await getDocs(userCollection_('followedGolfers'));
  const batch = writeBatch(db_());
  let needsMigration = false;

  const rows = snapshot.docs.map((item, index) => {
    const data = item.data() || {};
    const golfer = String(data.golfer || titleFromKey_(item.id) || '').trim();
    const notes = data.notes || data.note || '';
    const normalized = {
      id: item.id,
      type: 'followedGolfer',
      schemaVersion: 3,
      docKey: item.id,
      golfer,
      golferKey: data.golferKey || keyPart_(golfer),
      notes,
      sortOrder: Number(data.sortOrder || index + 1),
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null
    };

    const patch = {};
    ['type', 'schemaVersion', 'docKey', 'golfer', 'golferKey', 'notes', 'sortOrder'].forEach(key => {
      if (data[key] === undefined || data[key] === null || data[key] === '') patch[key] = normalized[key];
    });
    if (data.note !== undefined) patch.note = deleteField();
    if (data.favorite !== undefined) patch.favorite = deleteField();
    if (!data.createdAt) patch.createdAt = serverTimestamp();
    if (!data.schemaVersion || Number(data.schemaVersion) < 3) {
      patch.schemaVersion = 3;
      patch.migratedAt = serverTimestamp();
    }
    if (Object.keys(patch).length) {
      needsMigration = true;
      batch.set(item.ref, patch, { merge: true });
    }

    return normalized;
  });

  if (needsMigration) await batch.commit();

  return rows
    .filter(row => row.golfer)
    .sort((a, b) => Number(a.sortOrder || 9999) - Number(b.sortOrder || 9999));
}

export async function addUserFollowedGolfer(golfer, notes = '', favorite = false) {
  if (!golfer) throw new Error('Golfer is required.');
  const existing = await getUserFollowedGolfers();
  const id = golferDocId_(golfer);
  const sortOrder = existing.find(row => row.id === id)?.sortOrder || existing.length + 1;

  await setDoc(userDoc_('followedGolfers', id), {
    type: 'followedGolfer',
    schemaVersion: 3,
    docKey: id,
    golfer,
    golferKey: keyPart_(golfer),
    notes,
    note: deleteField(),
    favorite: deleteField(),
    sortOrder,
    updatedAt: serverTimestamp(),
    createdAt: existing.find(row => row.id === id)?.createdAt || serverTimestamp()
  }, { merge: true });

  await updateUserSyncStatus_({
    lastFollowWrite: 'followedGolfers',
    lastFollowedGolfer: golfer,
    followedGolfersCount: existing.filter(row => row.id !== id).length + 1
  });
  await syncPairedRokuDevice().catch(err => console.warn('Roku sync skipped.', err));

  return getUserFollowedGolfers();
}

export async function removeUserFollowedGolfer(golfer) {
  await deleteDoc(userDoc_('followedGolfers', golferDocId_(golfer)));
  const rows = await getUserFollowedGolfers();
  await updateUserSyncStatus_({
    lastFollowWrite: 'removeFollowedGolfer',
    followedGolfersCount: rows.length
  });
  await syncPairedRokuDevice().catch(err => console.warn('Roku sync skipped.', err));
  return rows;
}

export async function updateUserFollowedGolferOrder(golfers) {
  const batch = writeBatch(db_());
  (golfers || []).forEach((golfer, index) => {
    const id = golferDocId_(golfer);
    batch.set(userDoc_('followedGolfers', id), {
      type: 'followedGolfer',
      schemaVersion: 3,
      docKey: id,
      golfer,
      golferKey: keyPart_(golfer),
      note: deleteField(),
      favorite: deleteField(),
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
      note: follow.notes || '',
      notes: follow.notes || ''
    };
  });
}

export async function getUserWorldCupTeams() {
  const snapshot = await getDocs(userCollection_('worldCupTeams'));
  const batch = writeBatch(db_());
  let needsMigration = false;

  const rows = snapshot.docs.map((item, index) => {
    const data = item.data() || {};
    const parsed = parseTeamDocId_(item.id, 'WorldCup');
    const team = String(data.team || parsed.team || '').trim();
    const normalized = {
      id: item.id,
      type: 'worldCupTeam',
      schemaVersion: 2,
      docKey: item.id,
      sportKey: 'WorldCup',
      team,
      teamKey: data.teamKey || keyPart_(team),
      notes: data.notes || '',
      enabled: data.enabled !== false,
      sortOrder: Number(data.sortOrder || index + 1),
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null
    };

    const patch = {};
    ['type', 'schemaVersion', 'docKey', 'sportKey', 'team', 'teamKey', 'enabled', 'sortOrder'].forEach(key => {
      if (data[key] === undefined || data[key] === null || data[key] === '') patch[key] = normalized[key];
    });
    if (data.favorite !== undefined) patch.favorite = deleteField();
    if (!data.createdAt) patch.createdAt = serverTimestamp();
    if (!data.schemaVersion || Number(data.schemaVersion) < 2) {
      patch.schemaVersion = 2;
      patch.migratedAt = serverTimestamp();
    }
    if (Object.keys(patch).length) {
      needsMigration = true;
      batch.set(item.ref, patch, { merge: true });
    }

    return normalized;
  });

  if (needsMigration) await batch.commit();

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
    type: 'worldCupTeam',
    schemaVersion: 2,
    docKey: id,
    sportKey: 'WorldCup',
    team,
    teamKey: keyPart_(team),
    notes,
    favorite: deleteField(),
    enabled: true,
    sortOrder,
    updatedAt: serverTimestamp(),
    createdAt: existing.find(row => row.id === id)?.createdAt || serverTimestamp()
  }, { merge: true });

  await updateUserSyncStatus_({
    lastFollowWrite: 'worldCupTeams',
    lastWorldCupTeam: team,
    worldCupTeamsCount: existing.filter(row => row.id !== id).length + 1
  });
  await syncPairedRokuDevice().catch(err => console.warn('Roku sync skipped.', err));

  return getUserWorldCupTeams();
}

export async function removeUserWorldCupTeam(team) {
  await deleteDoc(userDoc_('worldCupTeams', teamDocId_('WorldCup', team)));
  await syncPairedRokuDevice().catch(err => console.warn('Roku sync skipped.', err));
  return getUserWorldCupTeams();
}

export async function updateUserWorldCupTeamNote(team, notes = '') {
  const id = teamDocId_('WorldCup', team);
  await setDoc(userDoc_('worldCupTeams', id), {
    type: 'worldCupTeam',
    schemaVersion: 2,
    docKey: id,
    sportKey: 'WorldCup',
    team,
    teamKey: keyPart_(team),
    notes,
    favorite: deleteField(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  return getUserWorldCupTeams();
}

export async function getRokuSyncState() {
  const user = requireUser_();
  const root = await getDoc(userRootDoc_());
  const data = root.exists() ? (root.data() || {}) : {};
  const legacyRoku = data.roku || {};

  const devicesSnapshot = await getDocs(userCollection_('rokuDevices'));
  const devices = devicesSnapshot.docs.map(item => {
    const device = item.data() || {};
    return {
      id: item.id,
      deviceId: device.deviceId || item.id,
      deviceName: device.deviceName || 'Unnamed Roku',
      pairedAt: device.pairedAt || null,
      lastSyncedAt: device.lastSyncedAt || null,
      lastSeenAt: device.lastSeenAt || null,
      updatedAt: device.updatedAt || null,
      appVersion: device.appVersion || device.rokuVersion || '',
      followedTeamsCount: Number(device.followedTeamsCount || 0),
      followedGolfersCount: Number(device.followedGolfersCount || 0),
      worldCupTeamsCount: Number(device.worldCupTeamsCount || 0)
    };
  }).sort((a, b) => String(a.deviceName).localeCompare(String(b.deviceName)));

  // Backfill the new per-user Roku device collection from the older single-device
  // root field if needed. This keeps existing paired Rokus working.
  if (!devices.length && legacyRoku.deviceId) {
    const backfilled = {
      deviceId: legacyRoku.deviceId,
      deviceName: legacyRoku.deviceName || 'Unnamed Roku',
      pairedAt: legacyRoku.pairedAt || serverTimestamp(),
      lastSyncedAt: legacyRoku.lastSyncedAt || null,
      followedTeamsCount: Number(legacyRoku.followedTeamsCount || 0),
      followedGolfersCount: Number(legacyRoku.followedGolfersCount || 0),
      worldCupTeamsCount: Number(legacyRoku.worldCupTeamsCount || 0)
    };
    await setDoc(userDoc_('rokuDevices', String(legacyRoku.deviceId)), backfilled, { merge: true });
    devices.push({ id: String(legacyRoku.deviceId), ...backfilled });
  }

  const primary = devices[0] || {};
  return {
    paired: devices.length > 0,
    deviceId: primary.deviceId || '',
    deviceName: primary.deviceName || 'Unnamed Roku',
    pairedAt: primary.pairedAt || null,
    lastSyncedAt: primary.lastSyncedAt || null,
    devices,
    deviceCount: devices.length
  };
}

function cleanForRoku_(rows, allowedKeys) {
  return (rows || []).map(row => {
    const out = {};
    allowedKeys.forEach(key => {
      if (row[key] !== undefined && row[key] !== null) out[key] = row[key];
    });
    return out;
  });
}

export async function syncRokuDevice(deviceId, deviceName = '') {
  const user = requireUser_();
  const id = String(deviceId || '').trim();
  if (!id) throw new Error('Roku device ID is required.');

  const [followedTeams, followedGolfers, worldCupTeams] = await Promise.all([
    getUserFollowedTeams(),
    getUserFollowedGolfers(),
    getUserWorldCupTeams()
  ]);

  const snapshot = {
    schemaVersion: 1,
    deviceId: id,
    deviceName: deviceName || 'Unnamed Roku',
    pairedUserId: user.uid,
    pairedUserName: user.displayName || user.email || 'Signed in user',
    updatedAt: serverTimestamp(),
    followedTeams: cleanForRoku_(followedTeams, ['id', 'sportKey', 'team', 'teamKey', 'eventId', 'opponent', 'spread', 'notes', 'active', 'sortOrder']),
    followedGolfers: cleanForRoku_(followedGolfers, ['id', 'golfer', 'golferKey', 'notes', 'sortOrder']),
    worldCupTeams: cleanForRoku_(worldCupTeams, ['id', 'sportKey', 'team', 'teamKey', 'notes', 'enabled', 'sortOrder'])
  };

  await setDoc(doc(db_(), 'rokuDevices', id), snapshot, { merge: true });

  const userDevicePatch = {
    deviceId: id,
    deviceName: deviceName || 'Unnamed Roku',
    pairedAt: serverTimestamp(),
    lastSyncedAt: serverTimestamp(),
    followedTeamsCount: followedTeams.length,
    followedGolfersCount: followedGolfers.length,
    worldCupTeamsCount: worldCupTeams.length
  };

  await setDoc(userDoc_('rokuDevices', id), userDevicePatch, { merge: true });
  await setDoc(userRootDoc_(), {
    roku: userDevicePatch
  }, { merge: true });

  return {
    deviceId: id,
    deviceName: deviceName || 'Unnamed Roku',
    followedTeamsCount: followedTeams.length,
    followedGolfersCount: followedGolfers.length,
    worldCupTeamsCount: worldCupTeams.length
  };
}

export async function syncPairedRokuDevice() {
  const state = await getRokuSyncState();
  const devices = state.devices || [];
  if (!devices.length) return null;

  const results = [];
  for (const device of devices) {
    results.push(await syncRokuDevice(device.deviceId, device.deviceName || 'Unnamed Roku'));
  }

  return {
    devices: results,
    deviceCount: results.length,
    followedTeamsCount: results[0]?.followedTeamsCount || 0,
    followedGolfersCount: results[0]?.followedGolfersCount || 0,
    worldCupTeamsCount: results[0]?.worldCupTeamsCount || 0
  };
}

export async function removePairedRokuDevice(deviceId) {
  const id = String(deviceId || '').trim();
  if (!id) return false;
  await deleteDoc(userDoc_('rokuDevices', id));
  await deleteDoc(doc(db_(), 'rokuDevices', id)).catch(() => {});
  const state = await getRokuSyncState();
  if (!state.devices.length) {
    await setDoc(userRootDoc_(), { roku: deleteField() }, { merge: true });
  }
  return true;
}


export async function renamePairedRokuDevice(deviceId, deviceName) {
  const id = String(deviceId || '').trim();
  const name = String(deviceName || '').trim() || 'Unnamed Roku';
  if (!id) throw new Error('Roku device ID is required.');

  await setDoc(userDoc_('rokuDevices', id), {
    deviceName: name,
    updatedAt: serverTimestamp()
  }, { merge: true });

  await setDoc(doc(db_(), 'rokuDevices', id), {
    deviceName: name,
    updatedAt: serverTimestamp()
  }, { merge: true }).catch(() => {});

  return true;
}

export async function pairRokuCode(code, deviceName = '') {
  const cleaned = String(code || '').replace(/\D/g, '').slice(0, 6);
  if (cleaned.length !== 6) throw new Error('Enter the 6-digit code shown on your Roku.');

  const pairingRef = doc(db_(), 'rokuPairCodes', cleaned);
  const pairingSnap = await getDoc(pairingRef);
  if (!pairingSnap.exists()) {
    throw new Error('Pairing code not found. Open the Info page on Roku and try again.');
  }

  const pairing = pairingSnap.data() || {};
  const deviceId = String(pairing.deviceId || '').trim();
  if (!deviceId) throw new Error('Pairing code is missing a Roku device ID.');

  const result = await syncRokuDevice(deviceId, deviceName || 'Unnamed Roku');
  await deleteDoc(pairingRef);
  return { ...result, code: cleaned };
}

