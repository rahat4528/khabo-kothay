import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index.js';

describe('Server API Endpoints Integration', () => {
  it('GET /api/health returns status ok and rebrand app info', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.app).toBe('Khabo Kothay?');
    expect(res.body.version).toBe('1.1.0');
    expect(res.body.commit).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /api/config NEVER leaks GOOGLE_SERVER_KEY', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body.GOOGLE_SERVER_KEY).toBeUndefined();
    expect(res.body.googleServerKey).toBeUndefined();
    expect(res.body.googleBrowserKey).toBeDefined();
    expect(res.body.useMockData).toBe(true);
    expect(res.body.presetLocations).toBeDefined();
  });

  it('POST /api/restaurants/search returns candidates', async () => {
    const res = await request(app)
      .post('/api/restaurants/search')
      .send({ lat: 23.7925, lng: 90.4150, cuisine: 'Japanese' });

    expect(res.status).toBe(200);
    expect(res.body.candidates).toBeInstanceOf(Array);
    expect(res.body.candidates.length).toBeGreaterThan(0);
    expect(res.body.candidates[0].displayName).toBeDefined();
  });

  it('POST /api/recommend returns ranked results with plain language reasons and top picks', async () => {
    const res = await request(app)
      .post('/api/recommend')
      .send({
        lat: 23.7975, // Notun Bazar
        lng: 90.4234,
        cuisine: 'Japanese',
        priority: 'Fastest',
        budget: 2
      });

    expect(res.status).toBe(200);
    expect(res.body.results).toBeInstanceOf(Array);
    expect(res.body.results.length).toBeGreaterThan(0);
    
    // Each result must have a score, reason text, badges, and breakdown
    const top = res.body.results[0];
    expect(top.score).toBeDefined();
    expect(top.reason).toBeTruthy();
    expect(top.trafficLevel).toBeDefined();
    expect(top.transport).toBeDefined();
    expect(top.transport.cheapestEstimatedCostBdt).toBeDefined();
    expect(top.factorBreakdown).toBeDefined();

    // Top picks structure
    expect(res.body.topPicks).toBeDefined();
    expect(res.body.topPicks.bestMatch).toBeDefined();
    expect(res.body.topPicks.summary).toBeTruthy();
  });

  it('POST /api/routes/compare returns alternative routes with polylines and transport mode table', async () => {
    const res = await request(app)
      .post('/api/routes/compare')
      .send({
        origin: { lat: 23.7975, lng: 90.4234 },
        destination: { lat: 23.7925, lng: 90.4150 }
      });

    expect(res.status).toBe(200);
    expect(res.body.routes).toBeInstanceOf(Array);
    expect(res.body.routes.length).toBeGreaterThanOrEqual(2);
    expect(res.body.recommendationReason).toBeTruthy();
    expect(res.body.transportModes).toBeInstanceOf(Array);
    expect(res.body.transportModes.length).toBe(4); // walk, rickshaw, cng, car
  });

  it('GET /api/places/:placeId/details returns detailed metadata', async () => {
    const res = await request(app).get('/api/places/mock_jap_1/details');
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBeDefined();
    expect(res.body.nationalPhoneNumber).toBeDefined();
    expect(res.body.websiteUri).toBeDefined();
  });

  it('GET /api/context/weather returns Dhaka weather context', async () => {
    const res = await request(app).get('/api/context/weather?lat=23.7925&lng=90.4150');
    expect(res.status).toBe(200);
    expect(typeof res.body.tempC).toBe('number');
    expect(typeof res.body.isRaining).toBe('boolean');
  });

  it('GET /api/places/photo returns image content', async () => {
    const res = await request(app).get('/api/places/photo?name=places/mock_jap_1/photos/0');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image/);
  });

  it('GET /api/taste/default returns default 50% cuisine profile', async () => {
    const res = await request(app).get('/api/taste/default');
    expect(res.status).toBe(200);
    expect(res.body.Japanese).toBe(50);
    expect(res.body.Biriyani).toBe(50);
  });

  it('POST /api/taste/event updates taste profile from interaction signal', async () => {
    const res = await request(app)
      .post('/api/taste/event')
      .send({
        currentProfile: { Japanese: 50 },
        event: { type: 'chose', cuisine: 'Japanese' }
      });

    expect(res.status).toBe(200);
    expect(res.body.updatedProfile.Japanese).toBeGreaterThan(50);
  });

  it('Enforces X-App-Token header for mobile clients', async () => {
    // With invalid token as mobile client
    const resFail = await request(app)
      .post('/api/recommend')
      .set('X-Client-Platform', 'mobile')
      .set('X-App-Token', 'invalid_token_123')
      .send({ lat: 23.79, lng: 90.41 });

    expect(resFail.status).toBe(401);
    expect(resFail.body.error).toContain('Unauthorized');

    // With valid token as mobile client
    const resPass = await request(app)
      .post('/api/recommend')
      .set('X-Client-Platform', 'mobile')
      .set('X-App-Token', process.env.APP_CLIENT_TOKEN || 'test_client_token')
      .send({ lat: 23.79, lng: 90.41, cuisine: 'All' });

    expect(resPass.status).toBe(200);
  });

  it('Fails closed with HTTP 500 in production when APP_CLIENT_TOKEN is unset for mobile requests', async () => {
    const origEnv = process.env.NODE_ENV;
    const origToken = process.env.APP_CLIENT_TOKEN;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.APP_CLIENT_TOKEN;

      const res = await request(app)
        .post('/api/recommend')
        .set('X-Client-Platform', 'mobile')
        .send({ lat: 23.79, lng: 90.41 });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('not configured');
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origToken !== undefined) {
        process.env.APP_CLIENT_TOKEN = origToken;
      }
    }
  });

  it('Handles nonexistent API route with 404', async () => {
    const res = await request(app).get('/api/unknown-route-xyz');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});
