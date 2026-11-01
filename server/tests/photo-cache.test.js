import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { PhotoCache } from '../services/photo-cache.js';
import app from '../index.js';
import quotaManager from '../services/quota.js';

describe('Photo Cache & Quota Guard Integration', () => {
  describe('PhotoCache Unit Tests', () => {
    let cache;

    beforeEach(() => {
      cache = new PhotoCache({ maxItems: 3, maxBytes: 1024, ttlMs: 1000 });
    });

    it('stores and retrieves cached photo buffers', () => {
      const buf = Buffer.from('fake-image-bytes-1');
      cache.set('photo1:400', buf, 'image/jpeg');

      const cached = cache.get('photo1:400');
      expect(cached).not.toBeNull();
      expect(cached.buffer.toString()).toBe('fake-image-bytes-1');
      expect(cached.contentType).toBe('image/jpeg');
      expect(cache.size).toBe(1);
    });

    it('evicts least recently used item when maxItems reached', () => {
      cache.set('p1', Buffer.from('1'), 'image/jpeg');
      cache.set('p2', Buffer.from('2'), 'image/jpeg');
      cache.set('p3', Buffer.from('3'), 'image/jpeg');

      // Access p1 to make p2 the least recently used
      cache.get('p1');

      // Add 4th item
      cache.set('p4', Buffer.from('4'), 'image/jpeg');

      expect(cache.get('p2')).toBeNull();
      expect(cache.get('p1')).not.toBeNull();
      expect(cache.get('p3')).not.toBeNull();
      expect(cache.get('p4')).not.toBeNull();
    });

    it('expires entries after ttl has elapsed', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      cache.set('temp', Buffer.from('expiring'), 'image/jpeg');
      expect(cache.get('temp')).not.toBeNull();

      // Fast forward past 1000ms TTL
      vi.spyOn(Date, 'now').mockReturnValue(now + 1500);
      expect(cache.get('temp')).toBeNull();

      vi.restoreAllMocks();
    });
  });

  describe('GET /api/places/photo HTTP Integration', () => {
    it('returns X-Cache: MISS on first request and X-Cache: HIT on subsequent request', async () => {
      const uniqueName = `places/mock_jap_1/photos/cache_test_${Date.now()}`;
      const res1 = await request(app).get(`/api/places/photo?name=${uniqueName}&maxWidth=400`);
      expect(res1.status).toBe(200);
      expect(res1.headers['x-cache']).toBe('MISS');

      const res2 = await request(app).get(`/api/places/photo?name=${uniqueName}&maxWidth=400`);
      expect(res2.status).toBe(200);
      expect(res2.headers['x-cache']).toBe('HIT');
      expect(res2.headers['content-type']).toMatch(/image/);
    });

    it('returns placeholder fallback with X-Quota-Fallback header when Google daily cap is reached', async () => {
      const origCap = process.env.MAX_GOOGLE_REQUESTS_PER_DAY;
      const origKey = process.env.GOOGLE_SERVER_KEY;
      const origMock = process.env.USE_MOCK_DATA;

      try {
        process.env.GOOGLE_SERVER_KEY = 'AIzaFakeTestKey';
        delete process.env.USE_MOCK_DATA;
        process.env.MAX_GOOGLE_REQUESTS_PER_DAY = '0'; // Immediately hit quota

        const res = await request(app)
          .get(`/api/places/photo?name=places/ChIJquota123/photos/photoRef456&maxWidth=400`);

        expect(res.status).toBe(200);
        expect(res.headers['x-quota-fallback']).toBe('true');
        expect(res.headers['content-type']).toContain('image/svg+xml');
      } finally {
        if (origCap !== undefined) process.env.MAX_GOOGLE_REQUESTS_PER_DAY = origCap;
        else delete process.env.MAX_GOOGLE_REQUESTS_PER_DAY;
        if (origKey !== undefined) process.env.GOOGLE_SERVER_KEY = origKey;
        else delete process.env.GOOGLE_SERVER_KEY;
        if (origMock !== undefined) process.env.USE_MOCK_DATA = origMock;
        else delete process.env.USE_MOCK_DATA;
      }
    });
  });

  describe('Placeholder SVG Neutrality & Area Customization', () => {
    it('defaults to neutral Dhaka Dining Experience instead of hardcoded Gulshan', async () => {
      const { generatePlaceholderSvg } = await import('../routes/api.js');
      const svg = generatePlaceholderSvg('seed123');
      expect(svg).toContain('Dhaka Dining Experience');
      expect(svg).not.toContain('Gulshan Dining Experience');
    });

    it('customizes placeholder label when specified via area or label query', async () => {
      const res = await request(app).get('/api/places/photo?name=places/mock_banani_photo/photos/1&area=Banani');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/svg+xml');
      const bodyStr = res.text || (Buffer.isBuffer(res.body) ? res.body.toString('utf8') : '');
      expect(bodyStr).toContain('Banani Dining Experience');
    });

    it('sanitizes special characters in custom placeholder label to prevent SVG injection', async () => {
      const { generatePlaceholderSvg } = await import('../routes/api.js');
      const svg = generatePlaceholderSvg('seed123', '<script>alert("xss")</script>');
      expect(svg).not.toContain('<script>');
      expect(svg).not.toContain('"xss"');
    });
  });
});
