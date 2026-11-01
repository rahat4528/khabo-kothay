import logger from './logger.js';

/**
 * Universal Redis Store supporting Upstash REST and REDIS_URL with graceful in-memory fallback.
 * Allows Render free-tier instances to persist quotas, bandit profiles, and session states.
 */
export class RedisStore {
  constructor() {
    this.memoryStore = new Map();
    this.initCredentials();
  }

  initCredentials() {
    let restUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '') || null;
    let restToken = process.env.UPSTASH_REDIS_REST_TOKEN || null;

    // Auto-derive Upstash REST credentials from REDIS_URL if provided
    if ((!restUrl || !restToken) && process.env.REDIS_URL) {
      try {
        const parsed = new URL(process.env.REDIS_URL);
        if (parsed.hostname.includes('upstash.io') || parsed.protocol === 'rediss:') {
          restUrl = `https://${parsed.hostname}`;
          restToken = parsed.password || parsed.username;
        }
      } catch (err) {
        logger.debug({ err: err.message }, 'Failed to parse REDIS_URL');
      }
    }

    this.restUrl = restUrl;
    this.restToken = restToken;
    this.hasRedis = Boolean(this.restUrl && this.restToken);
  }

  isConfigured() {
    return this.hasRedis;
  }

  async get(key) {
    if (!this.hasRedis) {
      const entry = this.memoryStore.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.memoryStore.delete(key);
        return null;
      }
      return entry.value;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${this.restUrl}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${this.restToken}` },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data.result !== null && data.result !== undefined) {
          try {
            return JSON.parse(data.result);
          } catch {
            return data.result;
          }
        }
      }
    } catch (err) {
      logger.debug({ err: err.message, key }, 'Redis get failed, falling back to memory');
    }

    const fallback = this.memoryStore.get(key);
    return fallback ? fallback.value : null;
  }

  async set(key, value, ttlSeconds = 86400) {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.memoryStore.set(key, { value, expiresAt });

    if (!this.hasRedis) {
      return true;
    }

    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      const endpoint = ttlSeconds
        ? `${this.restUrl}/set/${encodeURIComponent(key)}/${encodeURIComponent(serialized)}?ex=${ttlSeconds}`
        : `${this.restUrl}/set/${encodeURIComponent(key)}/${encodeURIComponent(serialized)}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${this.restToken}` },
        signal: controller.signal
      });
      clearTimeout(timeout);
      return res.ok;
    } catch (err) {
      logger.debug({ err: err.message, key }, 'Redis set failed, preserved in memory');
      return false;
    }
  }

  async incr(key, ttlSeconds = 86400) {
    const entry = this.memoryStore.get(key);
    const currentVal = entry && typeof entry.value === 'number' ? entry.value : 0;
    const newVal = currentVal + 1;
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.memoryStore.set(key, { value: newVal, expiresAt });

    if (!this.hasRedis) {
      return newVal;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${this.restUrl}/incr/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${this.restToken}` },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const remoteCount = Number(data.result);
        if (!isNaN(remoteCount)) {
          this.memoryStore.set(key, { value: remoteCount, expiresAt });
          return remoteCount;
        }
      }
    } catch (err) {
      logger.debug({ err: err.message, key }, 'Redis incr failed, using memory counter');
    }

    return newVal;
  }

  async del(key) {
    this.memoryStore.delete(key);
    if (!this.hasRedis) return true;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${this.restUrl}/del/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${this.restToken}` },
        signal: controller.signal
      });
      clearTimeout(timeout);
      return res.ok;
    } catch (err) {
      logger.debug({ err: err.message, key }, 'Redis del failed');
      return false;
    }
  }

  clear() {
    this.memoryStore.clear();
  }
}

export const redisStore = new RedisStore();
export default redisStore;
