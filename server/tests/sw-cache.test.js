import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..', '..');

describe('Service Worker Precache Asset Integrity', () => {
  it('ensures public/sw.js includes modern JS modules in APP_SHELL', () => {
    const swPath = path.join(rootDir, 'public', 'sw.js');
    const content = fs.readFileSync(swPath, 'utf8');

    expect(content).toContain("'/js/i18n.js'");
    expect(content).toContain("'/js/group-planner.js'");
    expect(content).toContain("'/js/meal-estimator.js'");
    expect(content).toContain("'/js/download-page.js'");
    expect(content).toContain("'/js/theme-init.js'");
    expect(content).toContain("'/download.html'");
    expect(content).toContain("'/css/download.css'");
  });

  it('ensures every asset in APP_SHELL exists on disk in /public', () => {
    const swPath = path.join(rootDir, 'public', 'sw.js');
    const content = fs.readFileSync(swPath, 'utf8');

    // Extract paths between quotes in APP_SHELL array
    const shellMatch = content.match(/const APP_SHELL = \[([\s\S]*?)\];/);
    expect(shellMatch).not.toBeNull();

    const rawPaths = shellMatch[1].match(/'([^']+)'/g) || [];
    const paths = rawPaths.map(p => p.replace(/'/g, ''));

    expect(paths.length).toBeGreaterThanOrEqual(20);

    for (const relPath of paths) {
      if (relPath === '/') continue; // root maps to index.html
      const diskPath = path.join(rootDir, 'public', relPath.replace(/^\//, ''));
      expect(fs.existsSync(diskPath), `Missing cached asset on disk: ${relPath} (expected at ${diskPath})`).toBe(true);
    }
  });
});
