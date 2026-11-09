import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRouter from '../routes/api.js';
import { evaluateFlags, updateFlag, computeRolloutBucket, DEFAULT_FLAGS } from '../services/flags.js';
import { getLatestRelease, createReleaseDraft, publishRelease, withdrawRelease, validateDownloadUrl, APPROVED_DOWNLOAD_HOSTS } from '../services/releases.js';
import { getAuditLogs } from '../services/audit.js';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

describe('Phase 1A: Safety Net — F14 Remote Feature Flags & F1 Update Checker', () => {
  describe('F14 Remote Feature Flags Service', () => {
    it('evaluates all 16 specified feature flags', () => {
      const result = evaluateFlags({ installId: 'test-install-uuid', versionCode: 3, channel: 'stable' });
      expect(result).toHaveProperty('flags');
      expect(result).toHaveProperty('etag');

      const expectedKeys = [
        'update_checker', 'natural_language_search', 'voice_search', 'group_mode',
        'swipe_mode', 'fare_check', 'dish_prices', 'rain_aware_mode',
        'lunch_break_reminders', 'share_my_trip', 'dietary_preferences', 'pay_me_line',
        'simple_mode', 'food_story', 'crash_reporting', 'report_a_problem'
      ];

      for (const key of expectedKeys) {
        expect(result.flags).toHaveProperty(key);
        expect(typeof result.flags[key]).toBe('boolean');
      }
    });

    it('produces stable deterministic assignment for the same installId', () => {
      const id = 'user-unique-install-id-9988';
      const r1 = evaluateFlags({ installId: id, versionCode: 3, channel: 'stable' });
      const r2 = evaluateFlags({ installId: id, versionCode: 3, channel: 'stable' });
      expect(r1.flags).toEqual(r2.flags);
      expect(r1.etag).toBe(r2.etag);
    });

    it('respects emergency kill switch by forcing flag to false', () => {
      updateFlag('swipe_mode', { enabled: false }, { who: 'test-admin' });
      const res = evaluateFlags({ installId: 'any-install-id', versionCode: 3, channel: 'stable' });
      expect(res.flags.swipe_mode).toBe(false);

      // Re-enable for subsequent tests
      updateFlag('swipe_mode', { enabled: true, rolloutPercentage: 100 }, { who: 'test-admin' });
    });

    it('enforces minVersionCode constraint', () => {
      updateFlag('group_mode', { minVersionCode: 10 }, { who: 'test-admin' });
      const oldApp = evaluateFlags({ installId: 'any-id', versionCode: 3, channel: 'stable' });
      expect(oldApp.flags.group_mode).toBe(false);

      const newApp = evaluateFlags({ installId: 'any-id', versionCode: 12, channel: 'stable' });
      expect(newApp.flags.group_mode).toBe(true);

      // Reset
      updateFlag('group_mode', { minVersionCode: 1 }, { who: 'test-admin' });
    });
  });

  describe('F1 Update Checker & Release Management', () => {
    it('validates download URLs against approved hosts and HTTPS protocol', () => {
      expect(validateDownloadUrl('https://github.com/rahat4528/khabo-kothay/releases/download/v4/app.apk').valid).toBe(true);
      expect(validateDownloadUrl('http://github.com/insecure.apk').valid).toBe(false);
      expect(validateDownloadUrl('https://malicious-site.com/app.apk').valid).toBe(false);
    });

    it('returns published release version metadata via GET /api/app/version', async () => {
      const res = await request(app).get('/api/app/version');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('packageName', 'com.khabokothay.app');
      expect(res.body).toHaveProperty('latestVersionCode');
      expect(res.body).toHaveProperty('latestVersionName');
      expect(res.body).toHaveProperty('minimumSupportedVersionCode');
      expect(res.body).toHaveProperty('downloadUrl');
      expect(res.body).toHaveProperty('releaseNotes');
      expect(res.body.releaseNotes).toHaveProperty('en');
      expect(res.body.releaseNotes).toHaveProperty('bn');
    });

    it('returns release history via GET /api/app/releases', async () => {
      const res = await request(app).get('/api/app/releases');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('releases');
      expect(Array.isArray(res.body.releases)).toBe(true);
      expect(res.body.releases.length).toBeGreaterThan(0);
    });

    it('prevents creating a release where minimumSupportedVersionCode > latestVersionCode', () => {
      expect(() => {
        createReleaseDraft({
          latestVersionName: '5.0.0',
          latestVersionCode: 5,
          minimumSupportedVersionCode: 10,
          downloadUrl: 'https://github.com/rahat4528/khabo-kothay/releases/download/v5/app.apk'
        });
      }).toThrow('minimumSupportedVersionCode cannot exceed latestVersionCode');
    });
  });

  describe('Server-Side HTTP 426 Version Enforcement', () => {
    it('returns HTTP 426 UPGRADE_REQUIRED when client versionCode is below minimum', async () => {
      // Temporarily set release minimumSupportedVersionCode to 10
      const draft = createReleaseDraft({
        latestVersionName: '5.0.0',
        latestVersionCode: 15,
        minimumSupportedVersionCode: 10,
        downloadUrl: 'https://github.com/rahat4528/khabo-kothay/releases/download/v5/app.apk'
      }, { who: 'test-admin' });
      publishRelease(draft.id, { who: 'test-admin' });

      // Client with versionCode 3 calls a protected business route
      const res = await request(app)
        .post('/api/restaurants/search')
        .set('X-App-Version-Code', '3')
        .send({ query: 'biryani' });

      expect(res.status).toBe(426);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error.code).toBe('UPGRADE_REQUIRED');
      expect(res.body.error).toHaveProperty('downloadUrl');

      // But exempt routes must NOT be blocked (health, version, releases)
      const healthRes = await request(app)
        .get('/api/health')
        .set('X-App-Version-Code', '3');
      expect(healthRes.status).toBe(200);

      const versionRes = await request(app)
        .get('/api/app/version')
        .set('X-App-Version-Code', '3');
      expect(versionRes.status).toBe(200);

      // Clean up by withdrawing the test release
      withdrawRelease(draft.id, { who: 'test-admin' });
    });
  });

  describe('Audit Trail', () => {
    it('records administrative actions into the audit log', () => {
      const logs = getAuditLogs({ limit: 10 });
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
      const latest = logs[0];
      expect(latest).toHaveProperty('id');
      expect(latest).toHaveProperty('timestamp');
      expect(latest).toHaveProperty('action');
    });
  });
});
