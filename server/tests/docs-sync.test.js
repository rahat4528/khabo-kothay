import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..', '..');

describe('Documentation Architecture Truth Parity', () => {
  it('ensures RELEASE.md accurately documents the Node backend and Expo mobile stack', () => {
    const content = fs.readFileSync(path.join(rootDir, 'RELEASE.md'), 'utf8');
    expect(content).toContain('Node.js Express backend on Render');
    expect(content).toContain('React Native Expo mobile app');
    expect(content).toContain('/android');
    expect(content).toContain('/api');
  });

  it('ensures docs/ARCHITECTURE.md documents the production package com.khabokothay.app and stack separation', () => {
    const content = fs.readFileSync(path.join(rootDir, 'docs', 'ARCHITECTURE.md'), 'utf8');
    expect(content).toContain('com.khabokothay.app');
    expect(content).not.toContain('com.example.cafefinder');
    expect(content).toContain('Production Stack & Reference Prototypes');
    expect(content).toContain('/server');
    expect(content).toContain('/mobile');
  });

  it('ensures docs/UPGRADE_AUDIT.md and docs/DECISIONS.md designate production vs archived prototypes', () => {
    const audit = fs.readFileSync(path.join(rootDir, 'docs', 'UPGRADE_AUDIT.md'), 'utf8');
    expect(audit).toContain('Primary Active Backend: Node.js Express Server (`/server`)');
    expect(audit).toContain('Official Production Mobile Client (`/mobile`)');

    const decisions = fs.readFileSync(path.join(rootDir, 'docs', 'DECISIONS.md'), 'utf8');
    expect(decisions).toContain('Retain the Node.js Express backend (`server/`) as the active production server');
    expect(decisions).toContain('official production mobile client (`com.khabokothay.app`)');
  });
});
