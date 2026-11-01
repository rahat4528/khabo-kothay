import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkGoogleMapsKeyConfigured } from '../src/services/mapsConfig.js';

describe('Map Tab Screen & Google Maps Configuration', () => {
  const origEnvKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY;
  const origMapsKey = process.env.GOOGLE_MAPS_ANDROID_KEY;

  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY;
    delete process.env.GOOGLE_MAPS_ANDROID_KEY;
  });

  afterEach(() => {
    if (origEnvKey !== undefined) process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY = origEnvKey;
    if (origMapsKey !== undefined) process.env.GOOGLE_MAPS_ANDROID_KEY = origMapsKey;
  });

  it('detects that Google Maps key is unconfigured by default, triggering list fallback', () => {
    expect(checkGoogleMapsKeyConfigured()).toBe(false);
  });

  it('detects Google Maps key when configured in environment', () => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY = 'AIzaSyFakeTestKey1234567890';
    expect(checkGoogleMapsKeyConfigured()).toBe(true);
  });

  it('app.config.js maps Google Maps key into android.config.googleMaps.apiKey', async () => {
    const appConfigFn = (await import('../app.config.js')).default;
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY = 'AIzaSyCustomKeyTest';
    const config = appConfigFn({
      config: {
        name: 'Khabo Kothay?',
        android: {}
      }
    });

    expect(config.android.config.googleMaps.apiKey).toBe('AIzaSyCustomKeyTest');
    expect(config.extra.googleMapsApiKey).toBe('AIzaSyCustomKeyTest');
  });
});
