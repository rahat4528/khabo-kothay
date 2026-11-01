import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.join(__dirname, '..', 'package.json');

describe('Mobile Dependencies Health Check', () => {
  it('does not include unused Node filesystem package fs-extra in mobile dependencies', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    expect(pkg.dependencies).toBeDefined();
    expect(pkg.dependencies['fs-extra']).toBeUndefined();
    expect(pkg.devDependencies?.['fs-extra']).toBeUndefined();
  });

  it('maintains essential mobile runtime dependencies', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    expect(pkg.dependencies['expo']).toBeDefined();
    expect(pkg.dependencies['react-native']).toBeDefined();
    expect(pkg.dependencies['react']).toBeDefined();
    expect(pkg.dependencies['react-native-maps']).toBeDefined();
  });
});
