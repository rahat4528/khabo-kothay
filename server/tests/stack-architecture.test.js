import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..', '..');

describe('Stack Architecture & Production Designation', () => {
  it('confirms /mobile is configured with official package com.khabokothay.app', () => {
    const appJsonPath = path.join(rootDir, 'mobile', 'app.json');
    expect(fs.existsSync(appJsonPath)).toBe(true);
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    expect(appJson.expo?.android?.package).toBe('com.khabokothay.app');
  });

  it('confirms EAS build profiles wire the live Render backend URL', () => {
    const easJsonPath = path.join(rootDir, 'mobile', 'eas.json');
    expect(fs.existsSync(easJsonPath)).toBe(true);
    const easJson = JSON.parse(fs.readFileSync(easJsonPath, 'utf8'));
    expect(easJson.build?.preview?.env?.EXPO_PUBLIC_API_BASE_URL).toBe('https://khabo-kothay-backend.onrender.com');
    expect(easJson.build?.production?.env?.EXPO_PUBLIC_API_BASE_URL).toBe('https://khabo-kothay-backend.onrender.com');
  });

  it('confirms README designates /mobile and /server as the official production stack', () => {
    const readmePath = path.join(rootDir, 'README.md');
    const content = fs.readFileSync(readmePath, 'utf8');
    expect(content).toContain('Official Production Stack');
    expect(content).toContain('Production Mobile Client (`/mobile`)');
    expect(content).toContain('Production Backend Server (`/server`)');
    expect(content).toContain('Archived Reference Prototypes');
  });
});
