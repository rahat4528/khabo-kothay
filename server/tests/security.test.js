import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { runSecurityCheck } from '../../scripts/security-check.js';

describe('Automated Security Audit & Credential Protection', () => {
  it('Validates that no Google API keys, server secrets, or .env files appear in client or build files', () => {
    const res = runSecurityCheck();
    expect(res.violations).toEqual([]);
    expect(res.success).toBe(true);
  });

  describe('Security Headers & CSP Hardening', () => {
    it('sets strict CSP directives without unsafe-eval or unsafe-inline in script-src', async () => {
      const res = await request(app).get('/');
      const csp = res.headers['content-security-policy'] || '';

      expect(csp).toBeDefined();
      expect(csp).not.toContain("'unsafe-eval'");

      // Extract script-src directive
      const scriptSrcMatch = csp.match(/script-src\s+([^;]+)/);
      expect(scriptSrcMatch).not.toBeNull();
      const scriptSrc = scriptSrcMatch ? scriptSrcMatch[1] : '';
      expect(scriptSrc).not.toContain("'unsafe-inline'");
    });

    it('allows CORS for configured origin with credentials support', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'https://khabo-kothay-backend.onrender.com');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('https://khabo-kothay-backend.onrender.com');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('rejects CORS for unauthorized origin', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'https://malicious-site.example.com');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
