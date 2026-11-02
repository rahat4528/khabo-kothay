import { describe, it, expect } from 'vitest';
import fs from 'fs';

describe('Neutral Dhaka Locations Policy & Elimination of Hardcoded Area Defaults', () => {
  it('ensures public/index.html meta description and hero pills do not hardcode Gulshan or Notun Bazar', () => {
    const html = fs.readFileSync('public/index.html', 'utf8');
    expect(html).not.toContain('Gulshan, Banani, Baridhara, and Notun Bazar');
    expect(html).not.toContain('<span class="hero-pill">Gulshan • Banani • Baridhara</span>');
    expect(html).toContain('100+ Dhaka Neighborhoods');
    expect(html).not.toContain('Starting from: Notun Bazar');
    expect(html).toContain('Starting from: Dhaka');
  });

  it('ensures web state and preferences storage default to Dhaka', () => {
    const stateJs = fs.readFileSync('public/js/state.js', 'utf8');
    const storageJs = fs.readFileSync('public/js/storage.js', 'utf8');
    expect(stateJs).toContain("name: prefs.locationPreset || 'Dhaka'");
    expect(storageJs).toContain("locationPreset: 'Dhaka'");
    expect(storageJs).not.toContain("locationPreset: 'Notun Bazar'");
  });

  it('ensures mobile client defaults to Dhaka rather than Notun Bazar', () => {
    const mobileLocJs = fs.readFileSync('mobile/src/services/location.js', 'utf8');
    const mobileStorageJs = fs.readFileSync('mobile/src/services/storage.js', 'utf8');
    const homeScreenJs = fs.readFileSync('mobile/src/features/home/HomeScreen.js', 'utf8');

    expect(mobileLocJs).toContain("export const DEFAULT_LOCATION = { lat: 23.8103, lng: 90.4125, name: 'Dhaka' }");
    expect(mobileLocJs).not.toContain("DEFAULT_LOCATION = PRESET_LOCATIONS['Notun Bazar']");
    expect(mobileStorageJs).toContain("locationPreset: 'Dhaka'");
    expect(homeScreenJs).toContain("useState(DEFAULT_LOCATION)");
  });

  it('ensures server services default to neutral Dhaka coordinates', () => {
    const mealtimeJs = fs.readFileSync('server/services/mealtime.js', 'utf8');
    const weatherJs = fs.readFileSync('server/services/weather.js', 'utf8');
    const placesJs = fs.readFileSync('server/services/places.js', 'utf8');

    expect(mealtimeJs).toContain("origin = { lat: 23.8103, lng: 90.4125, name: 'Dhaka' }");
    expect(weatherJs).toContain('Monsoon / rain in Dhaka');
    expect(placesJs).toContain('restaurant in Dhaka');
  });

  it('ensures bilingual i18n dictionaries describe Dhaka dining without hardcoding Gulshan/Notun Bazar in hero', () => {
    const i18nJs = fs.readFileSync('public/js/i18n.js', 'utf8');
    expect(i18nJs).toContain("heroAreasBadge: '100+ Dhaka Neighborhoods'");
    expect(i18nJs).toContain("heroAreasBadge: '১০০+ ঢাকার এলাকা'");
    expect(i18nJs).not.toContain("heroAreasBadge: 'Gulshan • Banani • Baridhara'");
  });
});
