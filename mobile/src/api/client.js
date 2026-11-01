import {
  getLocalRecommendations,
  getLocalMealTime,
  getLocalWeather,
  getLocalRouteComparison
} from '../services/localEngine.js';
import { EMBEDDED_RESTAURANTS } from '../data/embedded-restaurants.js';

let extraConfig = {};
try {
  // eslint-disable-next-line global-require
  const Constants = require('expo-constants');
  extraConfig = (Constants?.default || Constants)?.expoConfig?.extra || {};
} catch {
  // In pure Node/test environments where native Expo modules aren't linked
}

export const isLocalhostUrl = (url) => {
  return /localhost|127\.0\.0\.1|10\.0\.2\.2/i.test(url || '');
};

const DEFAULT_PROD_URL = 'https://khabo-kothay-backend.onrender.com';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || extraConfig.apiBaseUrl || DEFAULT_PROD_URL;
const APP_TOKEN = process.env.EXPO_PUBLIC_APP_CLIENT_TOKEN || extraConfig.appClientToken || '';

if (process.env.NODE_ENV === 'production' && isLocalhostUrl(API_BASE_URL)) {
  console.warn('[ApiClient] Warning: API_BASE_URL points to localhost/emulator loopback in production build:', API_BASE_URL);
}

const OFFLINE_RETRY_MS = 60 * 1000;

class MobileApiClient {
  constructor(baseUrl = API_BASE_URL, token = APP_TOKEN) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.offlineUntil = 0;
    if (process.env.NODE_ENV === 'production' && isLocalhostUrl(this.baseUrl)) {
      console.warn('[ApiClient] Warning: API base URL points to localhost in production build:', this.baseUrl);
    }
  }

  // Offline mode is a cooldown, not a permanent switch: a single cold-start timeout or
  // error used to pin the whole session to the local engine until the app restarted.
  get isOfflineMode() {
    return Date.now() < this.offlineUntil;
  }

  set isOfflineMode(value) {
    this.offlineUntil = value ? Date.now() + OFFLINE_RETRY_MS : 0;
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-App-Token': this.token,
      'X-Client-Platform': 'mobile',
      'X-Requested-With': 'com.khabokothay.app'
    };
  }

  async request(endpoint, options = {}, timeoutMs = 12000) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = { ...this.getHeaders(), ...(options.headers || {}) };

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const res = await fetch(url, { ...options, headers, signal: controller?.signal });
      if (timer) clearTimeout(timer);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP error ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      if (timer) clearTimeout(timer);
      throw err;
    }
  }

  async getConfig() {
    try {
      return await this.request('/api/config', {}, 8000);
    } catch {
      return { ok: true, app: 'Khabo Kothay?', offline: true };
    }
  }

  async getWeather(lat, lng) {
    try {
      return await this.request(`/api/context/weather?lat=${lat}&lng=${lng}`, {}, 6000);
    } catch {
      return getLocalWeather();
    }
  }

  async getRecommendations({
    lat,
    lng,
    cuisine = 'All',
    priority = 'Best Overall',
    budget = 2,
    mood = null,
    tasteProfile = null,
    weatherContext = null,
    surpriseMe = false,
    timeBudgetMinutes = null,
    companion = null,
    preferences = null,
    openNowOnly = false,
    distanceRadiusMeters = null,
    foodProfile = null,
    filters = null
  }) {
    const payload = {
      lat,
      lng,
      cuisine,
      priority,
      budget,
      mood,
      tasteProfile,
      weatherContext,
      surpriseMe,
      timeBudgetMinutes,
      companion,
      preferences,
      openNowOnly,
      distanceRadiusMeters,
      foodProfile,
      filters
    };

    // If already in confirmed offline mode, serve immediately from local engine
    if (this.isOfflineMode) {
      return getLocalRecommendations(payload);
    }

    try {
      const data = await this.request('/api/recommend', {
        method: 'POST',
        body: JSON.stringify(payload)
      }, 12000);

      if (data && Array.isArray(data.results) && data.results.length > 0) {
        return data;
      }
      return getLocalRecommendations(payload);
    } catch (err) {
      console.warn('Backend /api/recommend unavailable or wake-up delayed, using embedded local engine:', err.message);
      this.isOfflineMode = true;
      return getLocalRecommendations(payload);
    }
  }

  async getBanditWeights() {
    try {
      return await this.request('/api/bandit/weights', {}, 2500);
    } catch {
      return { weights: { rating: 0.4, distance: 0.25, time: 0.2, budget: 0.15 } };
    }
  }

  async resetBanditWeights() {
    try {
      return await this.request('/api/bandit/reset', { method: 'POST' }, 2500);
    } catch {
      return { ok: true };
    }
  }

  async toggleBandit(enabled) {
    try {
      return await this.request('/api/bandit/toggle', {
        method: 'POST',
        body: JSON.stringify({ enabled })
      }, 2500);
    } catch {
      return { ok: true, enabled };
    }
  }

  async compareRoutes(origin, destination) {
    try {
      return await this.request('/api/routes/compare', {
        method: 'POST',
        body: JSON.stringify({ origin, destination })
      }, 3500);
    } catch {
      return getLocalRouteComparison(origin, destination);
    }
  }

  async getPlaceDetails(placeId) {
    try {
      return await this.request(`/api/places/${placeId}/details`, {}, 3000);
    } catch {
      const found = EMBEDDED_RESTAURANTS.find(r => r.id === placeId);
      return found || { id: placeId, displayName: 'Restaurant Details' };
    }
  }

  async postTasteEvent(currentProfile, event, candidatePool = null) {
    try {
      return await this.request('/api/taste/event', {
        method: 'POST',
        body: JSON.stringify({ currentProfile, event, candidatePool })
      }, 2500);
    } catch {
      return { ok: true, updatedProfile: currentProfile };
    }
  }

  async pingWarmUp(onStatusChange = null, maxWaitMs = 5000) {
    const startTime = Date.now();
    let delay = 1000;
    let attempt = 1;

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), 2000) : null;

        const res = await fetch(`${this.baseUrl}/api/health`, {
          signal: controller?.signal,
          headers: {
            'X-App-Token': this.token,
            'X-Client-Platform': 'mobile'
          }
        });
        if (timer) clearTimeout(timer);

        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data && data.ok) {
            this.isOfflineMode = false;
            if (onStatusChange) {
              onStatusChange({ status: 'ready', app: data.app, version: data.version });
            }
            return { ok: true, app: data.app, attempts: attempt };
          }
        } else {
          // Any non-200 (404 Not Found, 502 Bad Gateway, 503 No Server) -> immediately activate local engine
          this.isOfflineMode = true;
          if (onStatusChange) {
            onStatusChange({
              status: 'ready',
              app: 'Khabo Kothay?',
              isLocalFallback: true,
              message: 'Local Engine Active'
            });
          }
          return { ok: true, app: 'Khabo Kothay? (Local Engine)', isLocal: true };
        }
      } catch {
        // network error or timeout
        if (attempt >= 2) {
          // Don't keep user waiting if server is completely unreachable
          this.isOfflineMode = true;
          if (onStatusChange) {
            onStatusChange({
              status: 'ready',
              app: 'Khabo Kothay?',
              isLocalFallback: true,
              message: 'Local Engine Active'
            });
          }
          return { ok: true, app: 'Khabo Kothay? (Local Engine)', isLocal: true };
        }
      }

      if (onStatusChange && attempt === 1) {
        onStatusChange({
          status: 'waking',
          message: 'Waking up the server, this can take up to a minute...',
          attempt,
          elapsedSeconds: Math.round((Date.now() - startTime) / 1000)
        });
      }

      attempt++;
      if (Date.now() - startTime + delay >= maxWaitMs) {
        break;
      }
      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(delay * 1.5, 2500);
    }

    this.isOfflineMode = true;
    if (onStatusChange) {
      onStatusChange({
        status: 'ready',
        app: 'Khabo Kothay?',
        isLocalFallback: true,
        message: 'Local Engine Active'
      });
    }
    return { ok: true, app: 'Khabo Kothay? (Local Engine)', isLocal: true };
  }

  getPhotoUrl(photoName, maxWidth = 600) {
    if (!photoName) {
      return `${this.baseUrl}/api/places/photo?name=mock_placeholder&maxWidth=${maxWidth}`;
    }
    return `${this.baseUrl}/api/places/photo?name=${encodeURIComponent(photoName)}&maxWidth=${maxWidth}`;
  }

  async searchMealTime(params) {
    if (this.isOfflineMode) {
      return getLocalMealTime(params);
    }

    try {
      const data = await this.request('/api/v1/meal-time/search', {
        method: 'POST',
        body: JSON.stringify(params)
      }, 4000);

      if (data && Array.isArray(data.results)) {
        return data;
      }
      return getLocalMealTime(params);
    } catch (err) {
      console.warn('Backend /api/v1/meal-time/search unavailable, using local engine:', err.message);
      this.isOfflineMode = true;
      return getLocalMealTime(params);
    }
  }

  async sendMealTimeFeedback(feedback) {
    try {
      return await this.request('/api/v1/meal-time/feedback', {
        method: 'POST',
        body: JSON.stringify(feedback)
      }, 2500);
    } catch {
      return { ok: true, recordedLocally: true };
    }
  }
}

export const apiClient = new MobileApiClient();
export { MobileApiClient };
export default apiClient;

