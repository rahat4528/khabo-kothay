import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { getPlaceDetails } from '../services/places.js';
import { rankRestaurants } from '../services/recommend.js';
import { checkOpeningFeasibility } from '../services/mealtime.js';
import { esc } from '../../public/js/escape.js';

const savedEnv = { ...process.env };

afterEach(() => {
  process.env = { ...savedEnv };
  vi.restoreAllMocks();
});

function liveGoogleMode() {
  process.env.GOOGLE_SERVER_KEY = 'test-server-key';
  process.env.USE_MOCK_DATA = 'false';
}

describe('Admin endpoints', () => {
  it('reject requests without a valid token in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_TOKEN = 'a-long-random-test-token';

    expect((await request(app).get('/api/admin/usage')).status).toBe(403);
    expect((await request(app).post('/api/v1/admin/killswitch').send({ active: true })).status).toBe(403);
    expect((await request(app).get('/api/admin/usage').set('X-Admin-Token', 'wrong')).status).toBe(403);

    const ok = await request(app).get('/api/admin/usage').set('X-Admin-Token', 'a-long-random-test-token');
    expect(ok.status).toBe(200);
  });

  it('disallows loopback bypass when proxy headers are present outside production', async () => {
    const origEnv = process.env.NODE_ENV;
    const origToken = process.env.ADMIN_TOKEN;
    try {
      process.env.NODE_ENV = 'development';
      process.env.ADMIN_TOKEN = 'test-admin-secret-token';

      // Proxy header present without admin token -> must be rejected with 403
      const res = await request(app)
        .get('/api/admin/usage')
        .set('X-Forwarded-For', '203.0.113.1');

      expect(res.status).toBe(403);

      // Proxy header present WITH valid admin token -> 200 OK
      const resWithToken = await request(app)
        .get('/api/admin/usage')
        .set('X-Forwarded-For', '203.0.113.1')
        .set('X-Admin-Token', 'test-admin-secret-token');

      expect(resWithToken.status).toBe(200);
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origToken) process.env.ADMIN_TOKEN = origToken;
      else delete process.env.ADMIN_TOKEN;
    }
  });

  it('records server-side verified identity in audit logs', async () => {
    const origEnv = process.env.NODE_ENV;
    const origToken = process.env.ADMIN_TOKEN;
    try {
      process.env.NODE_ENV = 'development';
      process.env.ADMIN_TOKEN = 'test-audit-token';

      // Create release with custom client header
      const res = await request(app)
        .post('/api/admin/releases')
        .set('X-Admin-Token', 'test-audit-token')
        .set('X-Admin-Who', 'charlie')
        .send({
          latestVersionName: '4.5.0-test',
          latestVersionCode: 450,
          channel: 'stable',
          downloadUrl: 'https://github.com/rahat4528/khabo-kothay/releases/download/v4.5.0/app.apk'
        });

      expect(res.status).toBe(201);
      const targetId = res.body?.release?.id;

      // Fetch audit logs for the specific created release to avoid parallel test race
      const auditRes = await request(app)
        .get('/api/admin/audit-logs?target=' + encodeURIComponent(targetId))
        .set('X-Admin-Token', 'test-audit-token');

      expect(auditRes.status).toBe(200);
      const latest = auditRes.body.logs?.[0];
      expect(latest).toBeDefined();
      expect(latest.who).toBe('token:charlie');
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origToken) process.env.ADMIN_TOKEN = origToken;
      else delete process.env.ADMIN_TOKEN;
    }
  });
});

describe('Google API key protection', () => {
  it('photo proxy never forwards non-photo resource names to Google', async () => {
    liveGoogleMode();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await request(app)
      .get('/api/places/photo')
      .query({ name: 'places/x/photos/y/../../../places:searchText', maxWidth: 99999 });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/svg+xml');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('daily Google cap stops place-detail calls before they reach Google', async () => {
    liveGoogleMode();
    process.env.MAX_GOOGLE_REQUESTS_PER_DAY = '0';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const detail = await getPlaceDetails('ChIJcapTestPlace');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(detail.id).toBe('ChIJcapTestPlace');
  });

  it('rejects place ids that could change the Google URL path', async () => {
    const res = await request(app).get('/api/places/..%2Fplaces%3AsearchText/details');
    expect(res.status).toBe(400);
  });
});

describe('Input validation', () => {
  it('rejects non-numeric or out-of-range coordinates', async () => {
    const bad = await request(app).post('/api/recommend').send({ lat: 'abc', lng: 90.4 });
    expect(bad.status).toBe(400);
    const outOfRange = await request(app).post('/api/routes/compare')
      .send({ origin: { lat: 999, lng: 90.4 }, destination: { lat: 23.8, lng: 90.4 } });
    expect(outOfRange.status).toBe(400);
  });

  it('rejects an invalid meal-time leaveAt instead of crashing', async () => {
    const res = await request(app).post('/api/v1/meal-time/search').send({ leaveAt: 'not-a-date' });
    expect(res.status).toBe(400);
  });
});

describe('Ranking with unknown travel times', () => {
  it('a place without a routed travel time is not badged fastest', () => {
    const base = { trafficLevel: 'Moderate', trafficRatio: 1.2, priceLevel: 2, rating: 4.4, userRatingCount: 200, cuisine: 'Cafe' };
    const ranked = rankRestaurants({
      candidates: [
        { ...base, id: 'unknown', displayName: 'Straight Line', distanceMeters: 500, durationSeconds: null },
        { ...base, id: 'routed', displayName: 'Routed', distanceMeters: 2000, durationSeconds: 600 }
      ],
      now: new Date('2026-10-12T06:00:00Z')
    });
    const byId = Object.fromEntries(ranked.map(r => [r.id, r]));
    expect(byId.routed.badges).toContain('Fastest to Reach');
    expect(byId.unknown.badges).not.toContain('Fastest to Reach');
    expect(byId.unknown.reason).not.toMatch(/\b1 min\b/);
  });
});

describe('Meal-time opening hours', () => {
  const lateNight = { regularOpeningHours: { openTime: '18:00', closingTime: '02:00' }, servesDinner: true };

  it('keeps a place open past midnight for a 01:00 arrival', () => {
    const arrival = new Date('2026-10-11T19:00:00Z'); // 01:00 Dhaka
    const finish = new Date(arrival.getTime() + 40 * 60000);
    const res = checkOpeningFeasibility(lateNight, arrival, finish, 'dinner');
    expect(res.passes).toBe(true);
    expect(res.minutesUntilClose).toBe(60);
  });

  it('rejects arrival before the place opens', () => {
    const arrival = new Date('2026-10-12T02:00:00Z'); // 08:00 Dhaka
    const finish = new Date(arrival.getTime() + 40 * 60000);
    const res = checkOpeningFeasibility({ regularOpeningHours: { openTime: '11:30', closingTime: '23:30' } }, arrival, finish, 'lunch');
    expect(res.passes).toBe(false);
  });
});

describe('Frontend escaping', () => {
  it('neutralizes HTML in place names', () => {
    expect(esc('<img src=x onerror=alert(1)>"\'&')).toBe('&lt;img src=x onerror=alert(1)&gt;&quot;&#39;&amp;');
    expect(esc(null)).toBe('');
  });
});
