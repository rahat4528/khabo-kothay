import { describe, it, expect } from 'vitest';
import { apiClient } from '../src/api/client.js';

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
});
