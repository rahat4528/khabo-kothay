import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appJsonPath = path.join(__dirname, '..', 'app.json');
const easJsonPath = path.join(__dirname, '..', 'eas.json');

describe('Play Store Readiness & Android Target SDK', () => {
  it('configures targetSdkVersion 35 and compileSdkVersion 35 via expo-build-properties', () => {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    const buildPropsPlugin = appJson.expo?.plugins?.find(
      p => Array.isArray(p) && p[0] === 'expo-build-properties'
    );

    expect(buildPropsPlugin).toBeDefined();
    const androidConfig = buildPropsPlugin[1]?.android;
    expect(androidConfig).toBeDefined();
    expect(androidConfig.targetSdkVersion).toBe(35);
    expect(androidConfig.compileSdkVersion).toBe(35);
  });

  it('configures production build profile to generate Google Play App Bundle (AAB)', () => {
    const easJson = JSON.parse(fs.readFileSync(easJsonPath, 'utf8'));
    expect(easJson.build?.production?.android?.buildType).toBe('app-bundle');
  });
});
