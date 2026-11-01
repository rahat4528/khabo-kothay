/**
 * In-memory LRU cache for photo proxy responses.
 * Prevents redundant fetches and preserves external Google Places photo quotas.
 */
export class PhotoCache {
  constructor(options = {}) {
    this.maxItems = options.maxItems || 200;
    this.maxBytes = options.maxBytes || 50 * 1024 * 1024; // 50 MB
    this.ttlMs = options.ttlMs || 60 * 60 * 1000; // 1 hour
    this.cache = new Map();
    this.totalBytes = 0;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }
    // Refresh LRU position (delete + re-set)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry;
  }

  set(key, buffer, contentType) {
    if (this.cache.has(key)) {
      this.delete(key);
    }

    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '');
    const byteLength = buf.length;

    // Evict oldest entries if capacity or memory threshold reached
    while (
      this.cache.size > 0 &&
      (this.cache.size >= this.maxItems || (this.totalBytes + byteLength > this.maxBytes))
    ) {
      const oldestKey = this.cache.keys().next().value;
      this.delete(oldestKey);
    }

    const entry = {
      buffer: buf,
      contentType: contentType || 'image/jpeg',
      byteLength,
      expiresAt: Date.now() + this.ttlMs
    };

    this.cache.set(key, entry);
    this.totalBytes += byteLength;
    return entry;
  }

  delete(key) {
    const entry = this.cache.get(key);
    if (entry) {
      this.totalBytes -= entry.byteLength || 0;
      this.cache.delete(key);
    }
  }

  clear() {
    this.cache.clear();
    this.totalBytes = 0;
  }

  get size() {
    return this.cache.size;
  }
}

export const photoCache = new PhotoCache();
export default photoCache;
