import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..', '..');

describe('Meal-Time UI XSS Protection Hygiene', () => {
  it('ensures public/js/mealtime-ui.js escapes plain language reasons with esc()', () => {
    const mealtimeUiPath = path.join(rootDir, 'public', 'js', 'mealtime-ui.js');
    const content = fs.readFileSync(mealtimeUiPath, 'utf8');

    expect(content).toContain('<p class="mealtime-reason">${esc(r.reasons[0])}</p>');
    expect(content).not.toContain('<p class="mealtime-reason">${r.reasons[0]}</p>');
  });

  it('verifies that esc() properly neutralizes script tags and HTML injection', async () => {
    const { esc } = await import('../../public/js/escape.js');
    const maliciousReason = '<script>alert("pwned")</script> & <b>bold</b> "quote" \'single\'';
    const escaped = esc(maliciousReason);

    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
    expect(escaped).toContain('&amp;');
    expect(escaped).toContain('&quot;');
    expect(escaped).toContain('&#39;');
  });
});
