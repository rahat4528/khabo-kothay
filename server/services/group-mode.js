import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import logger from './logger.js';
import { PRESET_LOCATIONS } from './mock.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GROUPS_FILE = path.join(__dirname, '..', 'data', 'group-sessions.json');

const SESSION_TTL_MS = 3 * 60 * 60 * 1000; // 3 Hours
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 Minutes
export const MAX_TOTAL_SESSIONS = 500;
export const MAX_SESSIONS_PER_IP = 10;

export const ALLOWED_DIETARY = new Set([
  'halal',
  'vegetarian',
  'vegan',
  'no_beef',
  'gluten_free',
  'nut_free',
  'dairy_free',
  'pescatarian'
]);

// Active in-memory session cache to maintain object reference parity
const activeSessions = new Map();

function sanitizeString(str, maxLen, fallback = '') {
  if (typeof str !== 'string') return fallback;
  const trimmed = str.trim().slice(0, maxLen);
  return trimmed || fallback;
}

function sanitizeDietary(arr) {
  if (!Array.isArray(arr)) return [];
  const valid = [];
  for (const item of arr) {
    if (typeof item === 'string') {
      const clean = item.trim().toLowerCase();
      if (ALLOWED_DIETARY.has(clean) && !valid.includes(clean)) {
        valid.push(clean);
        if (valid.length >= 8) break;
      }
    }
  }
  return valid;
}

export function isSessionExpired(session, now = Date.now()) {
  if (!session || !session.expiresAt) return true;
  return new Date(session.expiresAt).getTime() <= now;
}

export function purgeExpiredSessions(now = Date.now()) {
  let purgedCount = 0;
  for (const [token, session] of activeSessions.entries()) {
    if (isSessionExpired(session, now)) {
      activeSessions.delete(token);
      purgedCount++;
    }
  }
  if (purgedCount > 0) {
    saveSessionsSync();
  }
  return purgedCount;
}

let sweepTimer = null;
export function startPeriodicSweep() {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    try {
      purgeExpiredSessions();
    } catch (err) {
      logger.error({ err }, 'Error during group session periodic sweep');
    }
  }, SWEEP_INTERVAL_MS);
  if (sweepTimer.unref) sweepTimer.unref();
}
startPeriodicSweep();

let saveTimeout = null;
export function scheduleSave() {
  if (saveTimeout) return;
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    saveSessionsSync();
  }, 200);
  if (saveTimeout.unref) saveTimeout.unref();
}

export function saveSessionsSync() {
  try {
    const dir = path.dirname(GROUPS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Atomic write via temp file + rename
    const tempFile = `${GROUPS_FILE}.tmp.${crypto.randomBytes(6).toString('hex')}`;
    const payload = JSON.stringify(Array.from(activeSessions.values()), null, 2);
    fs.writeFileSync(tempFile, payload, 'utf8');
    fs.renameSync(tempFile, GROUPS_FILE);
  } catch (err) {
    logger.error({ err }, 'Failed saving group sessions atomically');
  }
}

/**
 * Format a session for safe public consumption (no secrets, no foreign IDs, aggregate votes)
 */
export function toPublicSession(session) {
  if (!session) return null;
  const voteCounts = {};
  for (const candidateId of Object.values(session.votes || {})) {
    if (candidateId) {
      voteCounts[candidateId] = (voteCounts[candidateId] || 0) + 1;
    }
  }

  return {
    id: session.id,
    token: session.token,
    deepLink: session.deepLink,
    creatorName: session.creatorName,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    status: session.status,
    participants: (session.participants || []).map(p => ({
      name: p.name,
      isCreator: Boolean(p.isCreator),
      startingArea: p.startingArea,
      joinedAt: p.joinedAt
    })),
    candidates: session.candidates || [],
    voteCounts,
    totalVotes: Object.keys(session.votes || {}).length,
    winner: session.winner || null
  };
}

export function loadSessions() {
  if (activeSessions.size > 0) {
    return Array.from(activeSessions.values());
  }
  try {
    if (fs.existsSync(GROUPS_FILE)) {
      const data = JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8'));
      const now = Date.now();
      for (const s of data) {
        if (!isSessionExpired(s, now)) {
          activeSessions.set(s.token, s);
        }
      }
      return Array.from(activeSessions.values());
    }
  } catch (err) {
    logger.error({ err }, 'Failed reading group-sessions.json');
  }
  return [];
}

export function saveSessions(sessions) {
  for (const s of sessions) {
    activeSessions.set(s.token, s);
  }
  scheduleSave();
}

/**
 * Clear in-memory sessions (for testing)
 */
export function clearSessionsForTest() {
  activeSessions.clear();
  try {
    if (fs.existsSync(GROUPS_FILE)) fs.unlinkSync(GROUPS_FILE);
  } catch {}
}

/**
 * Create a new group dining session
 */
export function createGroupSession({ creatorName = 'Host', budget = 600, cuisinePreference = null, clientIp = null } = {}) {
  purgeExpiredSessions();

  if (activeSessions.size >= MAX_TOTAL_SESSIONS) {
    const err = new Error('Maximum active group sessions limit reached');
    err.status = 429;
    throw err;
  }

  if (clientIp) {
    let ipCount = 0;
    for (const s of activeSessions.values()) {
      if (s.creatorIp === clientIp && !isSessionExpired(s)) {
        ipCount++;
      }
    }
    if (ipCount >= MAX_SESSIONS_PER_IP) {
      const err = new Error('Rate limit exceeded: too many active group sessions created from this IP');
      err.status = 429;
      throw err;
    }
  }

  const token = crypto.randomBytes(16).toString('hex'); // 128-bit unguessable token
  const creatorId = `user-${crypto.randomBytes(4).toString('hex')}`;
  const hostKey = crypto.randomBytes(32).toString('hex');
  const hostKeyHash = crypto.createHash('sha256').update(hostKey).digest('hex');
  const creatorSecret = crypto.randomBytes(32).toString('hex');
  const creatorSecretHash = crypto.createHash('sha256').update(creatorSecret).digest('hex');

  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const cleanCreatorName = sanitizeString(creatorName, 30, 'Host');
  const cleanBudget = Math.max(50, Math.min(50000, Number(budget) || 600));

  const session = {
    id: `grp-${token.substring(0, 8)}`,
    token,
    deepLink: `khabokothay://group/${token}`,
    creatorId,
    creatorIp: clientIp || null,
    hostKeyHash,
    creatorName: cleanCreatorName,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'open', // open, voting, closed
    participants: [
      {
        participantId: creatorId,
        participantSecretHash: creatorSecretHash,
        name: cleanCreatorName,
        isCreator: true,
        startingArea: 'Gulshan 2',
        budget: cleanBudget,
        dietaryPreferences: [],
        joinedAt: now.toISOString()
      }
    ],
    candidates: [],
    votes: {}, // participantId -> candidateId
    winner: null
  };

  activeSessions.set(session.token, session);
  saveSessionsSync();

  const publicSession = toPublicSession(session);
  return {
    ...publicSession,
    hostKey,
    creatorId,
    participantId: creatorId,
    participantSecret: creatorSecret,
    session: publicSession
  };
}

/**
 * Join an existing session
 */
export function joinGroupSession(token, { name = 'Guest', startingArea = 'Banani', budget = 500, dietaryPreferences = [] } = {}) {
  loadSessions();
  const session = activeSessions.get(token);
  if (!session || isSessionExpired(session)) {
    if (session) {
      activeSessions.delete(token);
      scheduleSave();
    }
    const err = new Error('Session not found or expired');
    err.status = 404;
    throw err;
  }
  if (session.status === 'closed') {
    const err = new Error('Session is closed');
    err.status = 400;
    throw err;
  }

  if (session.participants.length >= 12) {
    const err = new Error('Group session participant limit reached (maximum 12)');
    err.status = 400;
    throw err;
  }

  const cleanName = sanitizeString(name, 30, 'Guest');
  const cleanStartingArea = sanitizeString(startingArea, 40, 'Banani');
  const cleanDietary = sanitizeDietary(dietaryPreferences);
  const cleanBudget = Math.max(50, Math.min(50000, Number(budget) || 500));

  const participantId = `user-${crypto.randomBytes(4).toString('hex')}`;
  const participantSecret = crypto.randomBytes(32).toString('hex');
  const participantSecretHash = crypto.createHash('sha256').update(participantSecret).digest('hex');

  const participant = {
    participantId,
    participantSecretHash,
    name: cleanName,
    isCreator: false,
    startingArea: cleanStartingArea,
    budget: cleanBudget,
    dietaryPreferences: cleanDietary,
    joinedAt: new Date().toISOString()
  };

  session.participants.push(participant);
  saveSessionsSync();

  return {
    session: toPublicSession(session),
    participantId,
    participantSecret
  };
}

/**
 * Multi-Origin Fair Ranking Algorithm
 * Computes fair scores based on travel times from each participant's start
 */
export function computeFairRanking(session, candidateRestaurants) {
  if (!session || !candidateRestaurants || candidateRestaurants.length === 0) return [];

  const participants = session.participants;
  const scored = [];

  for (const restaurant of candidateRestaurants) {
    const travelTimes = [];

    const rArea = (restaurant.neighborhood || '').toLowerCase();
    for (const p of participants) {
      const pArea = (p.startingArea || '').toLowerCase();
      let travelMins = 18;
      if (rArea && pArea && (rArea.includes(pArea) || pArea.includes(rArea))) {
        travelMins = 8;
      } else if (rArea.includes('uttara') || rArea.includes('mirpur') || pArea.includes('uttara') || pArea.includes('mirpur')) {
        travelMins = 45;
      }
      travelTimes.push(travelMins);
    }

    const avgTravel = travelTimes.reduce((a, b) => a + b, 0) / travelTimes.length;
    const maxTravel = Math.max(...travelTimes);
    const minTravel = Math.min(...travelTimes);
    const spread = maxTravel - minTravel;

    // Fair Ranking Formula: weighted blend of average, max, and spread
    // Lower travel and lower spread yields higher fair score
    const fairScore = Math.max(0, 100 - (0.45 * avgTravel + 0.35 * maxTravel + 0.20 * spread));

    scored.push({
      id: restaurant.id || restaurant.placeId,
      name: restaurant.name,
      neighborhood: restaurant.neighborhood || 'Dhaka',
      rating: restaurant.rating || 4.2,
      priceLevel: restaurant.priceLevel || 2,
      metrics: {
        averageTravelMinutes: Math.round(avgTravel),
        maximumTravelMinutes: maxTravel,
        travelTimeSpread: spread,
        fairScore: Math.round(fairScore)
      }
    });
  }

  // Sort descending by fair score
  return scored.sort((a, b) => b.metrics.fairScore - a.metrics.fairScore);
}

/**
 * Cast or change vote in group session
 */
export function castVote(token, { participantId, participantSecret, candidateId }) {
  loadSessions();
  const session = activeSessions.get(token);
  if (!session || isSessionExpired(session)) {
    if (session) {
      activeSessions.delete(token);
      scheduleSave();
    }
    const err = new Error('Session not found or expired');
    err.status = 404;
    throw err;
  }
  if (session.status === 'closed') {
    const err = new Error('Session is closed');
    err.status = 400;
    throw err;
  }

  if (!candidateId || typeof candidateId !== 'string') {
    const err = new Error('Valid candidateId string is required');
    err.status = 400;
    throw err;
  }
  const cleanCandidateId = candidateId.trim().slice(0, 64);
  if (!cleanCandidateId) {
    const err = new Error('candidateId cannot be empty');
    err.status = 400;
    throw err;
  }

  const participant = session.participants.find(p => p.participantId === participantId);
  if (!participant) {
    const err = new Error('Participant not in this session');
    err.status = 404;
    throw err;
  }

  if (participant.participantSecretHash) {
    if (!participantSecret || typeof participantSecret !== 'string') {
      const err = new Error('Participant secret required to vote');
      err.status = 403;
      throw err;
    }
    const providedHash = crypto.createHash('sha256').update(String(participantSecret)).digest();
    const storedHash = Buffer.from(participant.participantSecretHash, 'hex');
    if (providedHash.length !== storedHash.length || !crypto.timingSafeEqual(providedHash, storedHash)) {
      const err = new Error('Invalid participant secret: cannot vote as another participant');
      err.status = 403;
      throw err;
    }
  }

  session.votes[participantId] = cleanCandidateId;
  saveSessionsSync();

  const publicSession = toPublicSession(session);
  return { success: true, voteCounts: publicSession.voteCounts, totalVotes: publicSession.totalVotes };
}

/**
 * Close session and determine winner
 */
export function closeGroupSession(token, { hostKey, creatorId } = {}) {
  loadSessions();
  const session = activeSessions.get(token);
  if (!session || isSessionExpired(session)) {
    if (session) {
      activeSessions.delete(token);
      scheduleSave();
    }
    const err = new Error('Session not found or expired');
    err.status = 404;
    throw err;
  }

  let authorized = false;
  if (hostKey && session.hostKeyHash) {
    const providedHash = crypto.createHash('sha256').update(String(hostKey)).digest();
    const storedHash = Buffer.from(session.hostKeyHash, 'hex');
    if (providedHash.length === storedHash.length && crypto.timingSafeEqual(providedHash, storedHash)) {
      authorized = true;
    }
  }

  if (!authorized) {
    const err = new Error('Only the session creator can close the session');
    err.status = 403;
    throw err;
  }

  session.status = 'closed';

  // Count votes
  const counts = {};
  for (const candId of Object.values(session.votes || {})) {
    if (candId) {
      counts[candId] = (counts[candId] || 0) + 1;
    }
  }

  let winnerId = null;
  let maxVotes = -1;
  for (const [candId, count] of Object.entries(counts)) {
    if (count > maxVotes) {
      maxVotes = count;
      winnerId = candId;
    }
  }

  session.winner = {
    candidateId: winnerId,
    votesReceived: maxVotes > 0 ? maxVotes : 0,
    totalVotesCast: Object.keys(session.votes || {}).length
  };

  saveSessionsSync();
  return toPublicSession(session);
}

export function getGroupSession(token) {
  loadSessions();
  const session = activeSessions.get(token);
  if (!session) return null;
  if (isSessionExpired(session)) {
    activeSessions.delete(token);
    scheduleSave();
    return null;
  }

  return toPublicSession(session);
}

export default {
  toPublicSession,
  createGroupSession,
  joinGroupSession,
  computeFairRanking,
  castVote,
  closeGroupSession,
  getGroupSession,
  purgeExpiredSessions,
  isSessionExpired,
  clearSessionsForTest
};
