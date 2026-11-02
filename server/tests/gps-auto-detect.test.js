import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Frontend Dynamic Location Search & Auto GPS Detection', () => {
  const indexHtml = fs.readFileSync('public/index.html', 'utf8');
  const appJs = fs.readFileSync('public/js/app.js', 'utf8');
  const apiJs = fs.readFileSync('public/js/api.js', 'utf8');
  const styleCss = fs.readFileSync('public/css/style.css', 'utf8');

  it('contains accessible dynamic combobox markup in public/index.html', () => {
    expect(indexHtml).toContain('id="locationCombobox"');
    expect(indexHtml).toContain('role="combobox"');
    expect(indexHtml).toContain('id="locationSearchInput"');
    expect(indexHtml).toContain('aria-autocomplete="list"');
    expect(indexHtml).toContain('id="locationSuggestions"');
    expect(indexHtml).toContain('role="listbox"');
    expect(indexHtml).toContain('id="clearLocationSearchBtn"');
    expect(indexHtml).toContain('id="useLocationBtn"');
    expect(indexHtml).toContain('id="locationStatus"');
  });

  it('declares responsive, accessible styles for the dynamic search combobox in public/css/style.css', () => {
    expect(styleCss).toContain('.location-combobox-wrapper');
    expect(styleCss).toContain('.location-input-container');
    expect(styleCss).toContain('.location-search-input');
    expect(styleCss).toContain('.location-suggestions-dropdown');
    expect(styleCss).toContain('.location-item');
    expect(styleCss).toContain('.location-item-name mark');
  });

  it('implements fetchLocations helper in public/js/api.js', () => {
    expect(apiJs).toContain('export async function fetchLocations');
    expect(apiJs).toContain('/api/locations?q=');
  });

  it('implements dynamic autocomplete and keyboard navigation in public/js/app.js', () => {
    expect(appJs).toContain('fetchLocations');
    expect(appJs).toContain('highlightQuery');
    expect(appJs).toContain('locationSearchInput');
    expect(appJs).toContain('locationSuggestions');
    expect(appJs).toContain('ArrowDown');
    expect(appJs).toContain('ArrowUp');
    expect(appJs).toContain('Escape');
  });

  it('implements automatic device GPS permission and detection with polite manual fallback in public/js/app.js', () => {
    expect(appJs).toContain('requestAndApplyGpsLocation');
    expect(appJs).toContain('requestAndApplyGpsLocation({ auto: true })');
    expect(appJs).toContain('GPS permission denied');
    expect(appJs).toContain('navigator.geolocation.getCurrentPosition');
  });
});
