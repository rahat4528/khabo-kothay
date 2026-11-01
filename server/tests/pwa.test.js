import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import app from '../index.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..', '..');

describe('PWA Web App Manifest Unification', () => {
  it('ensures public/manifest.json is removed and unified into public/manifest.webmanifest', () => {
    const oldManifestPath = path.join(rootDir, 'public', 'manifest.json');
    const authoritativeManifestPath = path.join(rootDir, 'public', 'manifest.webmanifest');

    expect(fs.existsSync(oldManifestPath)).toBe(false);
    expect(fs.existsSync(authoritativeManifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(authoritativeManifestPath, 'utf8'));
    expect(manifest.name).toBe('Khabo Kothay? – Food Finder (খাবো কোথায়?)');
    expect(manifest.short_name).toBe('Khabo Kothay?');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    expect(manifest.icons.some(i => i.purpose === 'maskable')).toBe(true);
  });

  it('ensures public/index.html links to /manifest.webmanifest', () => {
    const indexHtml = fs.readFileSync(path.join(rootDir, 'public', 'index.html'), 'utf8');
    expect(indexHtml).toContain('<link rel="manifest" href="/manifest.webmanifest">');
  });

  it('serves GET /manifest.webmanifest with valid manifest JSON', async () => {
    const res = await request(app).get('/manifest.webmanifest');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Khabo Kothay? – Food Finder (খাবো কোথায়?)');
    expect(res.body.short_name).toBe('Khabo Kothay?');
  });

  it('serves GET /manifest.json as backward-compatible alias to manifest.webmanifest', async () => {
    const res = await request(app).get('/manifest.json');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/manifest+json');
    expect(res.body.name).toBe('Khabo Kothay? – Food Finder (খাবো কোথায়?)');
    expect(res.body.short_name).toBe('Khabo Kothay?');
  });
});
