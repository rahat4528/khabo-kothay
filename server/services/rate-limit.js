/**
 * Hybrid client identifier for rate limiting:
 * Keyed by X-Install-ID or X-Device-ID (sanitized) to prevent false 429s on Bangladesh carrier CGNAT,
 * falling back to client IP for browser requests without an install token.
 */
export function getHybridRateLimitKey(req) {
  const installId = req.headers['x-install-id'] || req.headers['x-device-id'];
  if (typeof installId === 'string') {
    const sanitized = installId.trim().replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 64);
    if (sanitized.length >= 8) {
      return `install:${sanitized}`;
    }
  }
  return `ip:${req.ip}`;
}

export default {
  getHybridRateLimitKey
};
