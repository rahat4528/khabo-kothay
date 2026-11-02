import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRouter from '../routes/api.js';
import {
  searchDhakaLocations,
  getAllDhakaLocations,
  findClosestDhakaLocation,
  getDhakaLocationByName
} from '../services/locations.js';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

describe('Dynamic Dhaka Locations API & Search Engine', () => {
  it('returns all verified Dhaka locations when query is empty', () => {
    const all = getAllDhakaLocations();
    expect(all.length).toBeGreaterThanOrEqual(115);
    all.forEach(loc => {
      expect(loc.standardizedName).toBeDefined();
      expect(loc.name).toBeDefined();
      expect(loc.lat).toBeGreaterThan(23.5);
      expect(loc.lat).toBeLessThan(24.2);
      expect(loc.lng).toBeGreaterThan(90.1);
      expect(loc.lng).toBeLessThan(90.7);
    });
  });

  it('suggests all Dhaka areas starting with "A" when user types "A" (case-insensitive)', async () => {
    const resUpper = await request(app).get('/api/locations?q=A');
    expect(resUpper.status).toBe(200);
    expect(resUpper.body.locations).toBeDefined();
    expect(resUpper.body.locations.length).toBeGreaterThanOrEqual(7);

    const namesUpper = resUpper.body.locations.map(l => l.standardizedName);
    // Verified official locations starting with A:
    expect(namesUpper).toContain('Abdullahpur');
    expect(namesUpper).toContain('Adabor');
    expect(namesUpper).toContain('Aftabnagar');
    expect(namesUpper).toContain('Agargaon');
    expect(namesUpper).toContain('Aminbazar');
    expect(namesUpper).toContain('Ashulia');

    // Case-insensitive check: "a"
    const resLower = await request(app).get('/api/locations?q=a');
    expect(resLower.status).toBe(200);
    const namesLower = resLower.body.locations.map(l => l.standardizedName);
    expect(namesLower).toEqual(namesUpper);
  });

  it('suggests all Dhaka areas starting with "B" when user types "B"', async () => {
    const res = await request(app).get('/api/locations?q=B');
    expect(res.status).toBe(200);
    const names = res.body.locations.map(l => l.standardizedName);
    expect(names).toContain('Badda');
    expect(names).toContain('Banani');
    expect(names).toContain('Baridhara');
    expect(names).toContain('Bashundhara');
    expect(names).toContain('Banasree');
    expect(names).toContain('Bosila');
  });

  it('suggests all Dhaka areas starting with "M" when user types "M"', async () => {
    const res = await request(app).get('/api/locations?q=m');
    expect(res.status).toBe(200);
    const names = res.body.locations.map(l => l.standardizedName);
    expect(names).toContain('Mirpur');
    expect(names).toContain('Mirpur 1');
    expect(names).toContain('Mirpur 10');
    expect(names).toContain('Mohakhali');
    expect(names).toContain('Mohammadpur');
    expect(names).toContain('Motijheel');
  });

  it('suggests all Dhaka areas starting with "U" when user types "U"', async () => {
    const res = await request(app).get('/api/locations?q=U');
    expect(res.status).toBe(200);
    const names = res.body.locations.map(l => l.standardizedName);
    expect(names).toContain('Uttara');
    expect(names).toContain('Uttarkhan');
  });

  it('supports multi-character specific search (e.g. "Dhanmondi")', async () => {
    const res = await request(app).get('/api/locations?q=Dhanmondi');
    expect(res.status).toBe(200);
    expect(res.body.locations.length).toBeGreaterThanOrEqual(1);
    expect(res.body.locations[0].standardizedName).toBe('Dhanmondi');
    expect(res.body.locations[0].lat).toBeCloseTo(23.7465, 1);
    expect(res.body.locations[0].lng).toBeCloseTo(90.3760, 1);
  });

  it('supports Bangla query search (e.g. "ধানমন্ডি" or "মিরপুর")', async () => {
    const res = await request(app).get(`/api/locations?q=${encodeURIComponent('ধানমন্ডি')}`);
    expect(res.status).toBe(200);
    const names = res.body.locations.map(l => l.standardizedName);
    expect(names).toContain('Dhanmondi');

    const resMirpur = await request(app).get(`/api/locations?q=${encodeURIComponent('মিরপুর')}`);
    expect(resMirpur.status).toBe(200);
    const namesMirpur = resMirpur.body.locations.map(l => l.standardizedName);
    expect(namesMirpur.some(n => n.startsWith('Mirpur'))).toBe(true);
  });

  it('finds the closest Dhaka area to arbitrary GPS coordinates', () => {
    // Coordinates near Banani (23.7937, 90.4046)
    const closest = findClosestDhakaLocation(23.7930, 90.4040);
    expect(closest).not.toBeNull();
    expect(closest.location.standardizedName).toContain('Banani');
    expect(closest.distanceKm).toBeLessThan(1.0);

    // Coordinates near Uttara Sector 3 (23.8728, 90.3984)
    const uttara = findClosestDhakaLocation(23.8720, 90.3980);
    expect(uttara).not.toBeNull();
    expect(uttara.location.standardizedName).toContain('Uttara');
    expect(uttara.distanceKm).toBeLessThan(1.0);
  });

  it('looks up locations by exact or fuzzy name', () => {
    const loc = getDhakaLocationByName('Uttara');
    expect(loc).not.toBeNull();
    expect(loc.standardizedName).toBe('Uttara');

    const locBn = getDhakaLocationByName('উত্তরা');
    expect(locBn).not.toBeNull();
    expect(locBn.standardizedName).toBe('Uttara');
  });
});
