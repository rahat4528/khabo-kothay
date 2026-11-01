import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..', '..');

describe('Repository Version Synchronization & Drift Guard', () => {
  it('ensures package.json defines the authoritative version 1.1.0', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    expect(pkg.version).toBe('1.1.0');
  });

  it('ensures mobile/app.json matches package.json version and specifies versionCode 4', () => {
    const appJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'mobile', 'app.json'), 'utf8'));
    expect(appJson.expo.version).toBe('1.1.0');
    expect(appJson.expo.android.versionCode).toBe(4);
  });

  it('ensures android/app/build.gradle versionName and versionCode match 1.1.0 (4)', () => {
    const buildGradle = fs.readFileSync(path.join(rootDir, 'android', 'app', 'build.gradle'), 'utf8');
    expect(buildGradle).toContain('versionCode 4');
    expect(buildGradle).toContain('versionName "1.1.0"');
  });

  it('ensures server/services/diagnostics.js defaults to appVersion 1.1.0 and versionCode 4', () => {
    const diagnosticsCode = fs.readFileSync(path.join(rootDir, 'server', 'services', 'diagnostics.js'), 'utf8');
    expect(diagnosticsCode).toContain("appVersion = '1.1.0'");
    expect(diagnosticsCode).toContain('versionCode = 4');
  });

  it('ensures server/services/releases.js initial seed release matches 1.1.0 (4)', () => {
    const releasesCode = fs.readFileSync(path.join(rootDir, 'server', 'services', 'releases.js'), 'utf8');
    expect(releasesCode).toContain("latestVersionName: '1.1.0'");
    expect(releasesCode).toContain('latestVersionCode: 4');
    expect(releasesCode).toContain('khabo-kothay-1.1.0.apk');
  });

  it('ensures CHANGELOG.md documents version 1.1.0', () => {
    const changelog = fs.readFileSync(path.join(rootDir, 'CHANGELOG.md'), 'utf8');
    expect(changelog).toContain('## [1.1.0]');
  });
});
