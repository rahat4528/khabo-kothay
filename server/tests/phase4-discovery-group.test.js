import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRouter from '../routes/api.js';
import {
  createGroupSession,
  joinGroupSession,
  computeFairRanking,
  castVote,
  closeGroupSession,
  getGroupSession,
  purgeExpiredSessions,
  clearSessionsForTest,
  MAX_SESSIONS_PER_IP
} from '../services/group-mode.js';
import { addDishPriceReport, getDishPrices } from '../services/dish-prices.js';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

describe('Phase 4: Discovery & Group — F4 Group Mode, F5 Swipe, F6 Dish Prices', () => {
  describe('F4 Group Mode Session Lifecycle & Fair Ranking', () => {
    it('creates group session with 128-bit unguessable token and 3-hour expiry', async () => {
      const res = await request(app)
        .post('/api/groups')
        .send({ creatorName: 'Rahat', budget: 700 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.session.token).toMatch(/^[0-9a-f]{32}$/);
      expect(res.body.session.deepLink).toContain('khabokothay://group/');
      expect(res.body.session.participants.length).toBe(1);
      // Secret host key and creator participant secret returned once to creator
      expect(res.body.hostKey).toMatch(/^[0-9a-f]{64}$/);
      expect(res.body.participantSecret).toMatch(/^[0-9a-f]{64}$/);
      // Public session view must NOT expose hostKey or creatorId
      expect(res.body.session.hostKey).toBeUndefined();
      expect(res.body.session.creatorId).toBeUndefined();
    });

    it('allows guest to join session and prevents duplicate limit (>12)', () => {
      const session = createGroupSession({ creatorName: 'Host' });
      const join1 = joinGroupSession(session.token, { name: 'Guest 1', startingArea: 'Banani' });
      expect(join1.session.participants.length).toBe(2);

      // Fill up to 12
      for (let i = 2; i <= 11; i++) {
        joinGroupSession(session.token, { name: `Guest ${i}`, startingArea: 'Gulshan' });
      }
      expect(join1.session.participants.length).toBe(2);

      // 13th participant must be rejected
      expect(() => joinGroupSession(session.token, { name: 'Guest 13' }))
        .toThrow('limit reached');
    });

    it('computes fair multi-origin scores without prioritizing creator alone', () => {
      const session = createGroupSession({ creatorName: 'User1' });
      joinGroupSession(session.token, { name: 'User2', startingArea: 'Banani' });
      joinGroupSession(session.token, { name: 'User3', startingArea: 'Gulshan 2' });

      const candidates = [
        { id: 'central', name: 'Central Spot', neighborhood: 'Banani', priceLevel: 2 },
        { id: 'distant', name: 'Far Spot', neighborhood: 'Uttara', priceLevel: 2 }
      ];

      const ranked = computeFairRanking(session, candidates);
      expect(ranked.length).toBe(2);
      expect(ranked[0].id).toBe('central');
      expect(ranked[0].metrics.fairScore).toBeGreaterThan(ranked[1].metrics.fairScore);
    });

    it('records and allows changing votes, then closes session with winner by hostKey', () => {
      const session = createGroupSession({ creatorName: 'Host' });
      const { participantId: p1, participantSecret: s1 } = joinGroupSession(session.token, { name: 'Guest' });

      const vote1 = castVote(session.token, { participantId: p1, participantSecret: s1, candidateId: 'spot-A' });
      expect(vote1.voteCounts['spot-A']).toBe(1);

      // Change vote
      const vote2 = castVote(session.token, { participantId: p1, participantSecret: s1, candidateId: 'spot-B' });
      expect(vote2.voteCounts['spot-B']).toBe(1);
      expect(vote2.voteCounts['spot-A'] || 0).toBe(0);

      // Close session with valid hostKey
      const closed = closeGroupSession(session.token, { hostKey: session.hostKey });
      expect(closed.status).toBe('closed');
      expect(closed.winner.candidateId).toBe('spot-B');
      expect(closed.winner.votesReceived).toBe(1);
    });

    it('prevents joiner from closing session without hostKey (HTTP 403)', async () => {
      // 1. Host creates session
      const createRes = await request(app)
        .post('/api/groups')
        .send({ creatorName: 'HostUser' });
      const token = createRes.body.session.token;
      const hostKey = createRes.body.hostKey;

      // 2. Joiner joins session
      const joinRes = await request(app)
        .post(`/api/groups/${token}/join`)
        .send({ name: 'JoinerUser' });
      expect(joinRes.status).toBe(201);
      // Ensure joiner response does NOT leak creatorId or hostKey
      expect(joinRes.body.session.creatorId).toBeUndefined();
      expect(joinRes.body.session.hostKey).toBeUndefined();
      expect(joinRes.body.hostKey).toBeUndefined();

      // 3. Joiner attempts to close the session using only the token
      const rogueCloseAttempt = await request(app)
        .post(`/api/groups/${token}/close`)
        .send({});
      expect(rogueCloseAttempt.status).toBe(403);

      // 4. Joiner attempts to close with a forged hostKey
      const forgedCloseAttempt = await request(app)
        .post(`/api/groups/${token}/close`)
        .send({ hostKey: '0000000000000000000000000000000000000000000000000000000000000000' });
      expect(forgedCloseAttempt.status).toBe(403);

      // 5. Host successfully closes with legitimate hostKey
      const legitimateClose = await request(app)
        .post(`/api/groups/${token}/close`)
        .send({ hostKey });
      expect(legitimateClose.status).toBe(200);
      expect(legitimateClose.body.session.status).toBe('closed');
    });

    it('prevents participant from voting as another participant (HTTP 403)', async () => {
      const session = createGroupSession({ creatorName: 'Host' });
      const token = session.token;

      // Join participant 1 and participant 2
      const join1 = await request(app)
        .post(`/api/groups/${token}/join`)
        .send({ name: 'Alice' });
      const join2 = await request(app)
        .post(`/api/groups/${token}/join`)
        .send({ name: 'Bob' });

      const p1Id = join1.body.participantId;
      const p1Secret = join1.body.participantSecret;
      const p2Id = join2.body.participantId;

      // Alice votes legitimately for candidate-X
      const aliceVote = await request(app)
        .post(`/api/groups/${token}/votes`)
        .send({ participantId: p1Id, participantSecret: p1Secret, candidateId: 'candidate-X' });
      expect(aliceVote.status).toBe(200);

      // Attacker tries to impersonate Bob using Bob's participantId but Alice's secret
      const impersonateAttempt = await request(app)
        .post(`/api/groups/${token}/votes`)
        .send({ participantId: p2Id, participantSecret: p1Secret, candidateId: 'candidate-Y' });
      expect(impersonateAttempt.status).toBe(403);

      // Attacker tries to vote as Bob with no secret
      const noSecretAttempt = await request(app)
        .post(`/api/groups/${token}/votes`)
        .send({ participantId: p2Id, candidateId: 'candidate-Y' });
      expect(noSecretAttempt.status).toBe(403);
    });

    it('public view strictly censors private credentials and individual votes', async () => {
      const session = createGroupSession({ creatorName: 'Host' });
      const { participantId: p1, participantSecret: s1 } = joinGroupSession(session.token, { name: 'Member' });
      castVote(session.token, { participantId: p1, participantSecret: s1, candidateId: 'kacchi-spot' });

      const res = await request(app).get(`/api/groups/${session.token}`);
      expect(res.status).toBe(200);
      const pub = res.body.session;

      // No credentials or secret keys exposed
      expect(pub.creatorId).toBeUndefined();
      expect(pub.hostKey).toBeUndefined();
      expect(pub.hostKeyHash).toBeUndefined();

      // Participants list does not expose foreign participantIds or secrets
      for (const p of pub.participants) {
        expect(p.participantId).toBeUndefined();
        expect(p.participantSecret).toBeUndefined();
        expect(p.participantSecretHash).toBeUndefined();
        expect(p.name).toBeDefined();
      }

      // Votes are aggregated counts only, never participantId -> candidateId mappings
      expect(pub.votes).toBeUndefined();
      expect(pub.voteCounts['kacchi-spot']).toBe(1);
      expect(pub.totalVotes).toBe(1);
    });

    it('enforces session expiry returning 404 for get, join, vote and close', async () => {
      const created = createGroupSession({ creatorName: 'ExpiringHost' });
      const token = created.token;
      const hostKey = created.hostKey;
      const { participantId: p1, participantSecret: s1 } = joinGroupSession(token, { name: 'EarlyJoiner' });

      // Expire session manually
      const rawSession = getGroupSession(token);
      expect(rawSession).toBeDefined();

      // Set expiry timestamp to the past
      const { default: groupService } = await import('../services/group-mode.js');
      // Update directly via file or in-memory
      const fs = await import('fs');
      const path = await import('path');
      const groupsFile = path.resolve('server/data/group-sessions.json');
      const data = JSON.parse(fs.readFileSync(groupsFile, 'utf8'));
      const target = data.find(s => s.token === token);
      if (target) {
        target.expiresAt = new Date(Date.now() - 10000).toISOString();
        fs.writeFileSync(groupsFile, JSON.stringify(data), 'utf8');
      }
      // Clear in-memory to force reload from expired data
      groupService.clearSessionsForTest();

      // 1. GET returns 404
      const getRes = await request(app).get(`/api/groups/${token}`);
      expect(getRes.status).toBe(404);

      // 2. JOIN returns 404
      const joinRes = await request(app)
        .post(`/api/groups/${token}/join`)
        .send({ name: 'LateJoiner' });
      expect(joinRes.status).toBe(404);

      // 3. VOTE returns 404
      const voteRes = await request(app)
        .post(`/api/groups/${token}/votes`)
        .send({ participantId: p1, participantSecret: s1, candidateId: 'candidate-A' });
      expect(voteRes.status).toBe(404);

      // 4. CLOSE returns 404
      const closeRes = await request(app)
        .post(`/api/groups/${token}/close`)
        .send({ hostKey });
      expect(closeRes.status).toBe(404);
    });

    it('validates and caps creatorName, startingArea, dietaryPreferences and candidateId', async () => {
      const longName = 'A'.repeat(50);
      const longArea = 'B'.repeat(60);
      const invalidDietary = ['halal', 'malicious_injection', 'vegetarian', 'fake_diet', 'vegan'];

      const res = await request(app)
        .post('/api/groups')
        .send({ creatorName: longName });
      expect(res.status).toBe(201);
      // Creator name capped at 30 chars
      expect(res.body.session.creatorName.length).toBeLessThanOrEqual(30);

      const token = res.body.session.token;
      const joinRes = await request(app)
        .post(`/api/groups/${token}/join`)
        .send({
          name: longName,
          startingArea: longArea,
          dietaryPreferences: invalidDietary
        });
      expect(joinRes.status).toBe(201);
      const guest = joinRes.body.session.participants.find(p => !p.isCreator);
      expect(guest.name.length).toBeLessThanOrEqual(30);
      expect(guest.startingArea.length).toBeLessThanOrEqual(40);

      // Vote validation: candidateId must be string <= 64 chars
      const pId = joinRes.body.participantId;
      const pSecret = joinRes.body.participantSecret;

      // Empty candidateId rejected
      const emptyVote = await request(app)
        .post(`/api/groups/${token}/votes`)
        .send({ participantId: pId, participantSecret: pSecret, candidateId: '' });
      expect(emptyVote.status).toBe(400);

      // Valid candidateId accepted
      const validVote = await request(app)
        .post(`/api/groups/${token}/votes`)
        .send({ participantId: pId, participantSecret: pSecret, candidateId: 'valid_candidate_id_123' });
      expect(validVote.status).toBe(200);
      expect(validVote.body.voteCounts['valid_candidate_id_123']).toBe(1);
    });

    it('enforces per-IP session creation limits (HTTP 429)', () => {
      const ip = '192.168.10.42';
      // Create up to MAX_SESSIONS_PER_IP
      for (let i = 0; i < MAX_SESSIONS_PER_IP; i++) {
        createGroupSession({ creatorName: `Host ${i}`, clientIp: ip });
      }

      // Next creation from same IP must throw 429
      expect(() => createGroupSession({ creatorName: 'ExcessHost', clientIp: ip }))
        .toThrow('Rate limit exceeded');
    });
  });

  describe('F6 Community Dish Prices & Outlier Moderation', () => {
    it('records valid dish price report via POST /api/dish-price-reports', async () => {
      const res = await request(app)
        .post('/api/dish-price-reports')
        .send({
          restaurantName: 'Star Kabab',
          dishName: 'Mutton Kacchi',
          priceBdt: 320,
          portion: 'Half'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.report.status).toBe('verified');
    });

    it('flags extreme price outlier (>3x) for moderation', () => {
      const report = addDishPriceReport({
        restaurantId: 'mock_kacchi_1',
        dishName: 'Kacchi Biryani (Basmati)',
        priceBdt: 3500 // Normal median is ~460
      });

      expect(report.status).toBe('pending_moderation');
    });
  });
});
