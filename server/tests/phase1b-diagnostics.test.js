import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRouter from '../routes/api.js';
import { sanitizeText, computeCrashFingerprint } from '../services/diagnostics.js';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

describe('Phase 1B: Diagnostics — F15 Opt-In Crash Reports & Report a Problem', () => {
  describe('Sanitization & PII Redaction', () => {
    it('redacts Google API keys, authorization tokens, emails, and phone numbers', () => {
      const sensitive = 'Error with key AIzaSyD3x949219391039401934910394910 and Authorization: Bearer secret_token_12345 from user@example.com call 01711223344 at lat: 23.7928192';
      const clean = sanitizeText(sensitive);
      expect(clean).not.toContain('AIzaSyD');
      expect(clean).not.toContain('secret_token_12345');
      expect(clean).not.toContain('user@example.com');
      expect(clean).not.toContain('01711223344');
      expect(clean).toContain('[REDACTED_API_KEY]');
      expect(clean).toContain('[REDACTED_EMAIL]');
      expect(clean).toContain('[REDACTED_PHONE]');
      expect(clean).toContain('[COARSENED_LOCATION]');
    });

    it('generates deterministic fingerprint for identical stack frames', () => {
      const stack1 = 'NullPointerException\n  at com.khabokothay.app.MainActivity.onCreate(MainActivity.java:42)\n  at android.app.Activity.performCreate(Activity.java:8000)';
      const stack2 = 'NullPointerException\n  at com.khabokothay.app.MainActivity.onCreate(MainActivity.java:42)\n  at android.app.Activity.performCreate(Activity.java:8000)';
      expect(computeCrashFingerprint(stack1, 'NPE')).toBe(computeCrashFingerprint(stack2, 'NPE'));
    });
  });

  describe('API Endpoints', () => {
    it('records consent state via POST /api/diagnostics/consent', async () => {
      const res = await request(app)
        .post('/api/diagnostics/consent')
        .send({
          consentType: 'crash_reporting',
          granted: true,
          textVersion: '1.0'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.consent.granted).toBe(true);
    });

    it('submits a sanitized crash report via POST /api/diagnostics/crash-reports', async () => {
      const res = await request(app)
        .post('/api/diagnostics/crash-reports')
        .send({
          errorCategory: 'NullPointerException',
          message: 'Crash at token=secret12345',
          stackTrace: 'at com.khabokothay.app.ui.MainActivity.onCreate(MainActivity.java:50)'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('reportId');
      expect(res.body).toHaveProperty('fingerprint');
    });

    it('submits problem report and returns reference code via POST /api/diagnostics/problem-reports', async () => {
      const res = await request(app)
        .post('/api/diagnostics/problem-reports')
        .send({
          category: 'RESTAURANT_HOURS',
          description: 'Madchef in Banani shows open but it was closed at 11pm'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.referenceNumber).toMatch(/^REF-\d{8}-[A-Z0-9]{4}$/);
    });

    it('rejects empty problem reports with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/diagnostics/problem-reports')
        .send({ description: '' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns diagnostics overview via GET /api/admin/diagnostics', async () => {
      const res = await request(app).get('/api/admin/diagnostics');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalCrashes');
      expect(res.body).toHaveProperty('crashes');
      expect(res.body).toHaveProperty('problems');
    });

    it('hashes IP in consent records and does not store plain text IP', async () => {
      const plainIp = '203.0.113.195';
      const res = await request(app)
        .post('/api/diagnostics/consent')
        .set('X-Forwarded-For', plainIp)
        .send({
          installId: 'anon-test-install-123',
          consentType: 'analytics',
          granted: true
        });

      expect(res.status).toBe(200);
      expect(res.body.consent).toHaveProperty('ipHash');
      expect(res.body.consent.ip).toBeUndefined();
      expect(res.body.consent.ipHash).not.toContain(plainIp);
      expect(res.body.consent.ipHash.length).toBe(16);
    });

    it('redacts email addresses with diverse TLD lengths in sanitizeText', () => {
      const text = 'Contact founder@startup.io and dev@domain.app and lead@tech.ai or info@gov.bd';
      const sanitized = sanitizeText(text);
      expect(sanitized).not.toContain('founder@startup.io');
      expect(sanitized).not.toContain('dev@domain.app');
      expect(sanitized).not.toContain('lead@tech.ai');
      expect(sanitized).not.toContain('info@gov.bd');
      expect(sanitized).toContain('[REDACTED_EMAIL]');
    });

    it('enforces body size limit returning 413 for oversized payloads', async () => {
      const hugeString = 'x'.repeat(20 * 1024); // 20KB exceeds 16KB limit
      const res = await request(app)
        .post('/api/dish-prices')
        .send({
          restaurantName: 'Test',
          dishName: 'Biryani',
          priceBdt: 300,
          notes: hugeString
        });

      expect(res.status).toBe(413);
      expect(res.body.error).toContain('Payload too large');
    });
  });
});
