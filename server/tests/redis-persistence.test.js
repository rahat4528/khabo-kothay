import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RedisStore } from '../services/redis-store.js';
import { quotaManager } from '../services/quota.js';
import { resetBanditProfile } from '../services/bandit.js';
import { createGroupSession, saveSessionsSync, clearSessionsForTest } from '../services/group-mode.js';
import redisStore from '../services/redis-store.js';

describe('Redis Store & Render Free-Tier Persistence', () => {
  let origUpstashUrl;
  let origUpstashToken;
  let origRedisUrl;

  beforeEach(() => {
    origUpstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    origUpstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    origRedisUrl = process.env.REDIS_URL;
  });

  afterEach(() => {
    if (origUpstashUrl) process.env.UPSTASH_REDIS_REST_URL = origUpstashUrl;
    else delete process.env.UPSTASH_REDIS_REST_URL;

    if (origUpstashToken) process.env.UPSTASH_REDIS_REST_TOKEN = origUpstashToken;
    else delete process.env.UPSTASH_REDIS_REST_TOKEN;

    if (origRedisUrl) process.env.REDIS_URL = origRedisUrl;
    else delete process.env.REDIS_URL;

    vi.restoreAllMocks();
  });

  it('operates seamlessly in-memory when no Redis credentials are provided', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.REDIS_URL;

    const store = new RedisStore();
    expect(store.isConfigured()).toBe(false);

    await store.set('test_key', { foo: 'bar' }, 60);
    const value = await store.get('test_key');
    expect(value).toEqual({ foo: 'bar' });

    const count1 = await store.incr('test_counter', 60);
    expect(count1).toBe(1);
    const count2 = await store.incr('test_counter', 60);
    expect(count2).toBe(2);

    await store.del('test_key');
    expect(await store.get('test_key')).toBeNull();
  });

  it('auto-derives REST credentials from Upstash REDIS_URL', () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.REDIS_URL = 'rediss://default:upstashSecret123@us1-test-upstash.upstash.io:6379';

    const store = new RedisStore();
    expect(store.isConfigured()).toBe(true);
    expect(store.restUrl).toBe('https://us1-test-upstash.upstash.io');
    expect(store.restToken).toBe('upstashSecret123');
  });

  it('interacts correctly with Upstash REST API when configured', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://mock-upstash.example.com';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-bearer-token';

    const store = new RedisStore();
    expect(store.isConfigured()).toBe(true);

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/get/')) {
        return {
          ok: true,
          json: async () => ({ result: JSON.stringify({ quota: 15 }) })
        };
      }
      if (u.includes('/incr/')) {
        return {
          ok: true,
          json: async () => ({ result: 16 })
        };
      }
      return { ok: true, json: async () => ({ result: 'OK' }) };
    });

    const setOk = await store.set('daily_quota', { quota: 15 }, 3600);
    expect(setOk).toBe(true);

    const fetched = await store.get('daily_quota');
    expect(fetched).toEqual({ quota: 15 });

    const incResult = await store.incr('daily_quota', 3600);
    expect(incResult).toBe(16);

    expect(fetchMock).toHaveBeenCalled();
  });

  it('syncs Google daily API calls from quotaManager to RedisStore', () => {
    const setSpy = vi.spyOn(redisStore, 'set').mockResolvedValue(true);
    vi.spyOn(redisStore, 'isConfigured').mockReturnValue(true);

    quotaManager.checkAndRecordGoogleApiCall('places');
    expect(setSpy).toHaveBeenCalledWith(
      expect.stringContaining('google_daily_calls:'),
      expect.any(Number),
      86400
    );
  });

  it('syncs bandit profile updates to RedisStore', () => {
    const setSpy = vi.spyOn(redisStore, 'set').mockResolvedValue(true);
    vi.spyOn(redisStore, 'isConfigured').mockReturnValue(true);

    resetBanditProfile('device_audit_test');
    expect(setSpy).toHaveBeenCalledWith(
      'bandit_profile:device_audit_test',
      expect.any(Object),
      30 * 86400
    );
  });

  it('syncs group sessions to RedisStore on saveSessionsSync', () => {
    clearSessionsForTest();
    const setSpy = vi.spyOn(redisStore, 'set').mockResolvedValue(true);
    vi.spyOn(redisStore, 'isConfigured').mockReturnValue(true);

    createGroupSession({ creatorName: 'TestHost', budget: 500 });
    saveSessionsSync();

    expect(setSpy).toHaveBeenCalledWith(
      'group_sessions:active',
      expect.any(Array),
      86400
    );
  });
});
