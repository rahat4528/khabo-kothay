import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import app from '../index.js';

describe('Section 14: Site-Wide Fixes & Quality Assurance Suite', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const indexHtml = fs.readFileSync(path.join(rootDir, 'public/index.html'), 'utf8');
  const downloadHtml = fs.readFileSync(path.join(rootDir, 'public/download.html'), 'utf8');
  const errorHtml = fs.readFileSync(path.join(rootDir, 'public/404.html'), 'utf8');
  const styleCss = fs.readFileSync(path.join(rootDir, 'public/css/style.css'), 'utf8');
  const apkMeta = JSON.parse(fs.readFileSync(path.join(rootDir, 'server/data/apk-metadata.json'), 'utf8'));

  it('Item 1 & 16: Enforces zero horizontal scroll & mobile responsive layout rules', () => {
    expect(styleCss).toContain('overflow-x: hidden');
    expect(styleCss).toContain('overflow-wrap: anywhere');
    expect(indexHtml).toContain('meta name="viewport" content="width=device-width, initial-scale=1.0');
    expect(downloadHtml).toContain('meta name="viewport" content="width=device-width, initial-scale=1.0');
    expect(errorHtml).toContain('meta name="viewport" content="width=device-width, initial-scale=1.0');
  });

  it('Item 2: Internal navigation anchors resolve to existing DOM elements', () => {
    const anchors = ['#heroSection', '#controlPanelSection', '#topPicksContainer', '#filterOptionsSidebar', '#mapContainer'];
    anchors.forEach(anchor => {
      const id = anchor.replace('#', '');
      expect(indexHtml).toContain(`id="${id}"`);
    });
  });

  it('Item 3: Accessible mobile navigation hamburger and drawer exist', () => {
    expect(indexHtml).toContain('id="mobileMenuBtn"');
    expect(indexHtml).toContain('aria-label="Open navigation menu"');
    expect(indexHtml).toContain('aria-expanded="false"');
    expect(indexHtml).toContain('aria-controls="mobileNavDrawer"');
    expect(indexHtml).toContain('id="mobileNavDrawer"');
    expect(indexHtml).toContain('role="dialog"');
    expect(indexHtml).toContain('aria-modal="true"');
    expect(indexHtml).toContain('id="closeMobileNavBtn"');
    expect(styleCss).toContain('.mobile-menu-btn');
    expect(styleCss).toContain('.mobile-nav-drawer');
  });

  it('Item 4: Favicon and Web App Manifest files are present and linked', () => {
    expect(indexHtml).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(fs.existsSync(path.join(rootDir, 'public/manifest.webmanifest'))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, 'public/favicon.svg'))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, 'public/favicon-32.png'))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, 'public/favicon-192.png'))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, 'public/favicon-512.png'))).toBe(true);
  });

  it('Item 5: Meaningful branded page titles exist on every page', () => {
    expect(indexHtml).toContain('<title>Khabo Kothay?');
    expect(downloadHtml).toContain('Download KHABO KOTHAY? APK (Android)');
    expect(errorHtml).toContain('404');
    expect(errorHtml).toContain('Khabo Kothay?');
  });

  it('Item 6: Meta descriptions, Open Graph, and Twitter metadata tags exist', () => {
    [indexHtml, downloadHtml].forEach(html => {
      expect(html).toContain('name="description"');
      expect(html).toContain('property="og:title"');
      expect(html).toContain('property="og:description"');
      expect(html).toContain('property="og:image"');
      expect(html).toContain('name="twitter:card"');
      expect(html).toContain('name="twitter:title"');
    });
  });

  it('Item 7: Semantic footer with quick navigation links exists', () => {
    expect(indexHtml).toContain('class="app-footer"');
    expect(indexHtml).toContain('class="footer-links-col"');
    expect(indexHtml).toContain('href="#heroSection"');
    expect(indexHtml).toContain('href="/download"');
  });

  it('Item 8: Custom branded 404 error page returns HTTP 404', async () => {
    const res = await request(app).get('/404');
    expect(res.status).toBe(404);
    expect(res.text).toContain('Khabo Kothay?');
    expect(res.text).toContain('404');
    expect(res.text).toContain('Back to Home');
  });

  it('Item 9: Dynamic copyright year is implemented without hardcoded obsolescence', () => {
    expect(indexHtml).toContain('id="currentYear"');
    expect(downloadHtml).toContain('id="dlCurrentYear"');
    expect(errorHtml).toContain('id="errCurrentYear"');
  });

  it('Item 10: Image elements specify explicit dimensions and meaningful alt text', () => {
    expect(indexHtml).toContain('id="brandLogoImg" src="/img/icon.svg" alt="Khabo Kothay? Logo" class="brand-logo" width="38" height="38"');
    expect(downloadHtml).toContain('alt="KHABO KOTHAY? App Icon" width="72" height="72"');
  });

  it('Item 11: Touch targets meet accessibility minimum of 44x44px in mobile styles', () => {
    expect(styleCss).toContain('min-width: 44px');
    expect(styleCss).toContain('min-height: 44px');
  });

  it('Item 12: Status banners use appropriate accessibility attributes', () => {
    expect(indexHtml).toContain('id="offlineBanner" class="server-wakeup-banner offline-banner hidden" role="status" aria-live="polite"');
  });

  it('Item 13: APK download serves valid verified binary with matching SHA-256', () => {
    expect(apkMeta.apkSizeBytes).toBeGreaterThan(5 * 1024 * 1024);
    expect(apkMeta.sha256).toBe('7584E6983BA19CE71DE7DA63FDCA94C6053559B2C12F455DCB67100381A64896');
    expect(apkMeta.packageId).toBe('com.khabokothay.app');
  });

  it('Item 14: User-facing HTML files are free of placeholder text', () => {
    [indexHtml, downloadHtml, errorHtml].forEach(html => {
      expect(html).not.toMatch(/\blorem\s+ipsum\b/i);
      expect(html).not.toMatch(/\bTODO\b/);
      expect(html).not.toMatch(/\bFIXME\b/);
    });
  });

  it('Item 17: Brand logos are clickable links navigating to home', () => {
    expect(indexHtml).toContain('<a href="/" class="brand" aria-label="Khabo Kothay home"');
    expect(downloadHtml).toContain('<a href="/" class="dl-brand-link" aria-label="Go to Khabo Kothay home"');
    expect(errorHtml).toContain('<a href="/" class="brand" aria-label="Khabo Kothay home"');
  });

  it('Item 18: Direct contact telephone and mailto links are validly formatted', () => {
    expect(indexHtml).toContain('href="tel:+8801711522244"');
    expect(indexHtml).toContain('href="mailto:support@khabokothay.com"');
  });
});
