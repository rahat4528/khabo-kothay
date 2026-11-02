import { describe, it, expect } from 'vitest';
import fs from 'fs';

describe('Modernized Hero Section & Dining Intelligence Card', () => {
  const indexHtml = fs.readFileSync('public/index.html', 'utf8');
  const styleCss = fs.readFileSync('public/css/style.css', 'utf8');

  it('contains modern hero editorial structure and live pulse badge in public/index.html', () => {
    expect(indexHtml).toContain('hero-category-tag');
    expect(indexHtml).toContain('hero-live-pulse');
    expect(indexHtml).toContain('hero-editorial-title');
    expect(indexHtml).toContain('hero-editorial-desc');
    expect(indexHtml).toContain('hero-cta-btn');
    expect(indexHtml).toContain('heroDiscoverBtn');
  });

  it('features dynamic live dining radar card composition rather than static sculpture image', () => {
    expect(indexHtml).toContain('hero-radar-card');
    expect(indexHtml).toContain('radar-card-header');
    expect(indexHtml).toContain('Live Dining Intelligence');
    expect(indexHtml).toContain('radar-metrics-grid');
    expect(indexHtml).toContain('Travel Time');
    expect(indexHtml).toContain('Transit Fare');
    expect(indexHtml).toContain('Smart Match');
    expect(indexHtml).toContain('118 Areas');
    expect(indexHtml).not.toContain('hero-sculpture-img');
  });

  it('declares responsive, accessible CSS tokens and pulse animation in public/css/style.css', () => {
    expect(styleCss).toContain('.hero-live-pulse');
    expect(styleCss).toContain('@keyframes pulseLive');
    expect(styleCss).toContain('.hero-cta-btn');
    expect(styleCss).toContain('.hero-radar-card');
    expect(styleCss).toContain('.radar-metrics-grid');
    expect(styleCss).toContain('.radar-metric-box');
  });

  it('ensures smooth scroll targeting from hero CTA to controlPanelSection', () => {
    expect(indexHtml).toContain('href="#controlPanelSection"');
    expect(indexHtml).toContain('id="controlPanelSection"');
  });
});
