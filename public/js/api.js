import { appStorage } from './storage.js';

export async function pingWarmUp(onStatusChange = null, maxWaitMs = 60000) {
  const startTime = Date.now();
  let delay = 1500;
  let attempt = 1;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      if (onStatusChange && attempt > 1) {
        onStatusChange({
          status: 'waking',
          message: 'Waking up the server, this can take up to a minute...',
          attempt,
          elapsedSeconds: Math.round((Date.now() - startTime) / 1000)
        });
      }
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 6000) : null;
      const res = await fetch('/api/health', { signal: controller?.signal });
      if (timer) clearTimeout(timer);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data && data.ok) {
          if (onStatusChange) {
            onStatusChange({ status: 'ready', app: data.app, version: data.version });
          }
          return { ok: true, app: data.app, attempts: attempt };
        }
      }
    } catch (e) {
      // sleep or connection wait
    }

    attempt++;
    if (Date.now() - startTime + delay >= maxWaitMs) break;
    await new Promise(r => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 8000);
  }

  if (onStatusChange) {
    onStatusChange({ status: 'timeout', message: 'Server wake up timed out.' });
  }
  return { ok: false, error: 'Warmup timeout' };
}

/**
 * Fetch dynamic Dhaka locations based on user query prefix or keyword.
 */
export async function fetchLocations(query = '', limit = 30) {
  try {
    const q = encodeURIComponent(query || '');
    const res = await fetch(`/api/locations?q=${q}&limit=${limit}`);
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data.locations) ? data.locations : [];
    }
  } catch (err) {
    console.warn('Failed to fetch locations dynamically:', err);
  }
  return [];
}

export const DEFAULT_PRESET_CONFIG = {
  googleBrowserKey: '',
  useMockData: true,
  presetLocations: {
    "Bailey Road": { lat: 23.7410, lng: 90.4072, name: "Bailey Road" },
    "Banani": { lat: 23.7937, lng: 90.4046, name: "Banani Road 11" },
    "Baridhara": { lat: 23.7998, lng: 90.4215, name: "Baridhara Diplomatic Zone" },
    "Bashundhara R/A": { lat: 23.8164, lng: 90.4278, name: "Bashundhara R/A Gate" },
    "Dhanmondi": { lat: 23.7465, lng: 90.3760, name: "Dhanmondi Road 27" },
    "Gulshan 1": { lat: 23.7785, lng: 90.4178, name: "Gulshan 1 Circle" },
    "Gulshan 2": { lat: 23.7925, lng: 90.4150, name: "Gulshan 2 Circle" },
    "Mirpur": { lat: 23.8071, lng: 90.3686, name: "Mirpur 10 Circle" },
    "Notun Bazar": { lat: 23.7975, lng: 90.4234, name: "Notun Bazar Bus Stand" },
    "Uttara": { lat: 23.8728, lng: 90.3984, name: "Uttara Sector 3" }
  }
};

export async function fetchWithRetry(url, options = {}, maxRetries = 3, onRetry = null) {
  let attempt = 0;
  let delay = 1200;
  while (attempt <= maxRetries) {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutMs = options.timeoutMs || 10000;
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      const res = await fetch(url, { ...options, signal: options.signal || controller?.signal });
      if (timer) clearTimeout(timer);

      if (res.status === 502 || res.status === 503 || res.status === 504) {
        throw new Error(`Server is booting up (HTTP ${res.status})`);
      }
      return res;
    } catch (err) {
      attempt++;
      if (attempt > maxRetries) throw err;
      if (onRetry) onRetry(attempt, maxRetries);
      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(delay * 1.5, 6000);
    }
  }
}

export async function fetchConfig() {
  try {
    const res = await fetchWithRetry('/api/config', {}, 3);
    if (!res.ok) {
      console.warn('API config returned status ' + res.status + ', using fallback presets');
      return DEFAULT_PRESET_CONFIG;
    }
    return await res.json();
  } catch (err) {
    console.warn('Network error loading config, using fallback presets:', err.message);
    return DEFAULT_PRESET_CONFIG;
  }
}

export async function fetchWeather(lat, lng) {
  try {
    const res = await fetchWithRetry(`/api/context/weather?lat=${lat}&lng=${lng}`, {}, 2);
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    return null;
  }
}

export async function fetchRecommendations({
  lat,
  lng,
  cuisine,
  priority,
  budget,
  mood,
  surpriseMe,
  openNowOnly = false,
  distanceRadiusMeters = null
}) {
  const tasteProfile = appStorage.getTasteProfile();

  const payload = {
    lat,
    lng,
    cuisine,
    priority,
    budget,
    mood,
    tasteProfile,
    surpriseMe,
    openNowOnly,
    distanceRadiusMeters
  };

  const res = await fetchWithRetry('/api/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server returned error status ${res.status}`);
  }

  return res.json();
}

export async function compareRoutes(origin, destination) {
  const res = await fetch('/api/routes/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination })
  });

  if (!res.ok) {
    throw new Error('Failed to compute route comparison');
  }

  return res.json();
}

export async function fetchPlaceDetails(placeId) {
  const res = await fetch(`/api/places/${encodeURIComponent(placeId)}/details`);
  if (!res.ok) {
    throw new Error('Failed to load restaurant details');
  }
  return res.json();
}

/**
 * Record a user interaction signal to update the taste profile
 */
export async function recordTasteSignal(type, restaurant, context = {}) {
  if (!appStorage.isLearningEnabled()) return;

  const currentProfile = appStorage.getTasteProfile();
  const event = {
    type,
    restaurantId: restaurant.id,
    cuisine: restaurant.cuisine,
    ...context
  };

  // Log locally
  appStorage.logTasteEvent(event);

  try {
    const res = await fetch('/api/taste/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentProfile, event })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.updatedProfile) {
        appStorage.saveTasteProfile(data.updatedProfile);
        window.dispatchEvent(new CustomEvent('taste-profile-updated', { detail: data.updatedProfile }));
      }
    }
  } catch (err) {
    console.warn('Failed to update taste profile on server:', err);
  }
}

/**
 * Execute Meal-Time Mode recommendations search
 */
export async function searchMealTimeApi(params) {
  const res = await fetch('/api/v1/meal-time/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Meal-time search failed (${res.status})`);
  }
  return res.json();
}

/**
 * Submit anonymous trip completion feedback for Meal-Time Mode
 */
export async function sendMealTimeFeedbackApi(feedback) {
  const res = await fetch('/api/v1/meal-time/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(feedback)
  });
  return res.ok;
}
