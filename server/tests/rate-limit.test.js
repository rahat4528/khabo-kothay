import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { getHybridRateLimitKey } from '../services/rate-limit.js';

describe('Hybrid Rate Limit & Bangladesh CGNAT Protection', () => {
  it('correctly derives rate limit keys from headers and falls back to IP', () => {
    // Valid X-Install-ID
    expect(getHybridRateLimitKey({
      headers: { 'x-install-id': 'install-abc-12345678' },
      ip: '103.205.71.1'
    })).toBe('install:install-abc-12345678');

    // Valid X-Device-ID fallback
    expect(getHybridRateLimitKey({
      headers: { 'x-device-id': 'device-xyz-98765432' },
      ip: '103.205.71.1'
    })).toBe('install:device-xyz-98765432');

    // Sanitize special characters
    expect(getHybridRateLimitKey({
      headers: { 'x-install-id': 'test@install$12345678!!!' },
      ip: '103.205.71.1'
    })).toBe('install:testinstall12345678');

    // Overly short install ID falls back to IP
    expect(getHybridRateLimitKey({
      headers: { 'x-install-id': 'short' },
      ip: '103.205.71.1'
    })).toBe('ip:103.205.71.1');

    // Missing header falls back to IP
    expect(getHybridRateLimitKey({
      headers: {},
      ip: '103.205.71.1'
    })).toBe('ip:103.205.71.1');
  });

  it('allows distinct install IDs on the same IP to proceed without collision', async () => {
    const res1 = await request(app)
      .get('/api/config')
      .set('X-Install-ID', 'mobile-client-device-alpha-1234')
      .set('X-Forwarded-For', '103.205.71.15');

    expect(res1.status).toBe(200);

    const res2 = await request(app)
      .get('/api/config')
      .set('X-Install-ID', 'mobile-client-device-beta-5678')
      .set('X-Forwarded-For', '103.205.71.15');

    expect(res2.status).toBe(200);
  });
});
