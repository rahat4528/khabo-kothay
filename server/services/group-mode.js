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

// Active in-memory session cache to maintain object reference parity
const activeSessions = new Map();

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
        if (new Date(s.expiresAt).getTime() > now) {
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
  try {
    for (const s of sessions) {
      activeSessions.set(s.token, s);
    }
    const dir = path.dirname(GROUPS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(GROUPS_FILE, JSON.stringify(Array.from(activeSessions.values()), null, 2), 'utf8');
  } catch (err) {
    logger.error({ err }, 'Failed saving group sessions');
  }
}

/**
 * Create a new group dining session
 */
export function createGroupSession({ creatorName = 'Host', budget = 600, cuisinePreference = null } = {}) {
  const token = crypto.randomBytes(16).toString('hex'); // 128-bit unguessable token
  const creatorId = `user-${crypto.randomBytes(4).toString('hex')}`;
  const hostKey = crypto.randomBytes(32).toString('hex');
  const hostKeyHash = crypto.createHash('sha256').update(hostKey).digest('hex');
  const creatorSecret = crypto.randomBytes(32).toString('hex');
  const creatorSecretHash = crypto.createHash('sha256').update(creatorSecret).digest('hex');

  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  const session = {
    id: `grp-${token.substring(0, 8)}`,
    token,
    deepLink: `khabokothay://group/${token}`,
    creatorId,
    hostKeyHash,
    creatorName: String(creatorName).substring(0, 30),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'open', // open, voting, closed
    participants: [
      {
        participantId: creatorId,
        participantSecretHash: creatorSecretHash,
        name: String(creatorName).substring(0, 30),
        isCreator: true,
        startingArea: 'Gulshan 2',
        budget: Number(budget) || 600,
        dietaryPreferences: [],
        joinedAt: now.toISOString()
      }
    ],
    candidates: [],
    votes: {}, // participantId -> candidateId
    winner: null
  };

  const sessions = loadSessions();
  sessions.push(session);
  saveSessions(sessions);

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
  const sessions = loadSessions();
  const session = sessions.find(s => s.token === token);
  if (!session) {
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

  const participantId = `user-${crypto.randomBytes(4).toString('hex')}`;
  const participantSecret = crypto.randomBytes(32).toString('hex');
  const participantSecretHash = crypto.createHash('sha256').update(participantSecret).digest('hex');

  const participant = {
    participantId,
    participantSecretHash,
    name: String(name || 'Guest').substring(0, 30),
    isCreator: false,
    startingArea: startingArea || 'Banani',
    budget: Number(budget) || 500,
    dietaryPreferences: Array.isArray(dietaryPreferences) ? dietaryPreferences : [],
    joinedAt: new Date().toISOString()
  };

  session.participants.push(participant);
  saveSessions(sessions);

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
  const sessions = loadSessions();
  const session = sessions.find(s => s.token === token);
  if (!session) {
    const err = new Error('Session not found or expired');
    err.status = 404;
    throw err;
  }
  if (session.status === 'closed') {
    const err = new Error('Session is closed');
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

  session.votes[participantId] = candidateId;
  saveSessions(sessions);

  const publicSession = toPublicSession(session);
  return { success: true, voteCounts: publicSession.voteCounts, totalVotes: publicSession.totalVotes };
}

/**
 * Close session and determine winner
 */
export function closeGroupSession(token, { hostKey, creatorId } = {}) {
  const sessions = loadSessions();
  const session = sessions.find(s => s.token === token);
  if (!session) {
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

  saveSessions(sessions);
  return toPublicSession(session);
}

export function getGroupSession(token) {
  const sessions = loadSessions();
  const session = sessions.find(s => s.token === token);
  if (!session) return null;

  return toPublicSession(session);
}

export default {
  toPublicSession,
  createGroupSession,
  joinGroupSession,
  computeFairRanking,
  castVote,
  closeGroupSession,
  getGroupSession
};
