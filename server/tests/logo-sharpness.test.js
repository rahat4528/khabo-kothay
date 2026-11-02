import { describe, it, expect } from 'vitest';
import fs from 'fs';

describe('Brand Logo & Icon Sharpness & Geometry Audit', () => {
  const iconFiles = [
    'public/img/icon.svg',
    'public/favicon.svg',
    'public/img/icon-transparent.svg',
    'public/img/logo.svg',
    'public/img/logo-dark.svg',
    'brand/logo/icon.svg',
    'mobile/assets/icon.svg'
  ];

  it('ensures all icon and logo files exist and are non-empty', () => {
    iconFiles.forEach(file => {
      expect(fs.existsSync(file), `File ${file} should exist`).toBe(true);
      const content = fs.readFileSync(file, 'utf8');
      expect(content.length).toBeGreaterThan(100);
      expect(content).toContain('<svg');
      expect(content).toContain('</svg>');
    });
  });

  it('eliminates old jagged raw polygon paths from all icon assets', () => {
    iconFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toContain('366 110');
      expect(content).not.toContain('372 386');
      expect(content).not.toContain('scale(0.10546875)');
    });
  });

  it('validates 1024x1024 high-definition viewBox for public and mobile app icons', () => {
    const iconSvg = fs.readFileSync('public/img/icon.svg', 'utf8');
    const mobileIconSvg = fs.readFileSync('mobile/assets/icon.svg', 'utf8');
    const brandIconSvg = fs.readFileSync('brand/logo/icon.svg', 'utf8');

    [iconSvg, mobileIconSvg, brandIconSvg].forEach(svg => {
      expect(svg).toContain('viewBox="0 0 1024 1024"');
      expect(svg).toContain('width="1024"');
      expect(svg).toContain('height="1024"');
      expect(svg).toContain('#FF5722');
      expect(svg).toContain('linearGradient');
    });
  });

  it('validates crisp 128x128 favicon with high-contrast cloche geometry', () => {
    const favSvg = fs.readFileSync('public/favicon.svg', 'utf8');
    expect(favSvg).toContain('viewBox="0 0 128 128"');
    expect(favSvg).toContain('width="128"');
    expect(favSvg).toContain('height="128"');
    expect(favSvg).toContain('#FF5722');
  });

  it('validates horizontal wordmark logo contains crisp typography and question mark accent', () => {
    const logoSvg = fs.readFileSync('public/img/logo.svg', 'utf8');
    const logoDarkSvg = fs.readFileSync('public/img/logo-dark.svg', 'utf8');

    [logoSvg, logoDarkSvg].forEach(svg => {
      expect(svg).toContain('viewBox="0 0 357 54"');
      expect(svg).toContain('Khabo Kothay');
      expect(svg).toContain('<tspan fill="#FF5722">?</tspan>');
    });
  });
});
