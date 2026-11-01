import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { apiClient, MobileApiClient, isLocalhostUrl } from '../src/api/client.js';

describe('Mobile API Client Configuration', () => {
  it('includes X-App-Token and mobile headers in request configuration', () => {
    const headers = apiClient.getHeaders();
    expect(typeof headers['X-App-Token']).toBe('string');
    expect(headers['X-Client-Platform']).toBe('mobile');
    expect(headers['X-Requested-With']).toBe('com.khabokothay.app');
  });

  it('formats photo proxy URLs correctly', () => {
    const url = apiClient.getPhotoUrl('places/sample/photos/1', 500);
    expect(url).toContain('/api/places/photo?name=');
    expect(url).toContain('maxWidth=500');
  });

  it('exposes meal-time search and feedback methods', () => {
    expect(typeof apiClient.searchMealTime).toBe('function');
    expect(typeof apiClient.sendMealTimeFeedback).toBe('function');
  });

  it('defaults to live Render backend URL https://khabo-kothay-backend.onrender.com', () => {
    expect(apiClient.baseUrl).toBe('https://khabo-kothay-backend.onrender.com');
  });

  it('correctly identifies localhost and loopback URLs via isLocalhostUrl', () => {
    expect(isLocalhostUrl('http://localhost:3000')).toBe(true);
    expect(isLocalhostUrl('http://127.0.0.1:3000')).toBe(true);
    expect(isLocalhostUrl('http://10.0.2.2:3000')).toBe(true);
    expect(isLocalhostUrl('https://khabo-kothay-backend.onrender.com')).toBe(false);
  });

  it('warns when base URL points to localhost in production mode', () => {
    const origEnv = process.env.NODE_ENV;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      process.env.NODE_ENV = 'production';
      const client = new MobileApiClient('http://localhost:3000', 'test_tok');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ApiClient] Warning: API base URL points to localhost in production build:'),
        'http://localhost:3000'
      );
    } finally {
      process.env.NODE_ENV = origEnv;
      warnSpy.mockRestore();
    }
  });

  it('eas.json explicitly configures EXPO_PUBLIC_API_BASE_URL for all build profiles', () => {
    const easPath = path.resolve(__dirname, '../eas.json');
    const easConfig = JSON.parse(fs.readFileSync(easPath, 'utf8'));

    const expectedUrl = 'https://khabo-kothay-backend.onrender.com';
    expect(easConfig.build.development.env.EXPO_PUBLIC_API_BASE_URL).toBe(expectedUrl);
    expect(easConfig.build.preview.env.EXPO_PUBLIC_API_BASE_URL).toBe(expectedUrl);
    expect(easConfig.build.production.env.EXPO_PUBLIC_API_BASE_URL).toBe(expectedUrl);
  });
});
