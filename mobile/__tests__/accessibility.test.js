import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..', '..');

describe('Mobile Accessibility & TalkBack Readiness', () => {
  it('enforces accessibilityLabel and accessibilityRole across all touchable components', () => {
    const scriptPath = path.join(rootDir, 'scripts', 'check-a11y.js');
    const result = execSync(`node "${scriptPath}"`, { encoding: 'utf8', cwd: rootDir });
    expect(result).toContain('0 violations');
    expect(result).toContain('comply with accessibility requirements');
  });

  it('passes WCAG color contrast checks for all mobile theme palettes', () => {
    const scriptPath = path.join(rootDir, 'scripts', 'check-contrast.js');
    const result = execSync(`node "${scriptPath}"`, { encoding: 'utf8', cwd: rootDir });
    expect(result).toContain('All 32 contrast checks PASSED successfully');
  });
});
