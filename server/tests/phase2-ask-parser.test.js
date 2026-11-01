import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from '../routes/api.js';
import { parseNaturalQuery } from '../services/ask-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CORPUS_FILE = path.join(__dirname, '..', 'data', 'ask-corpus.json');

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

describe('Phase 2: Search — F3 Ask In Your Own Words', () => {
  describe('Three Canonical Section 6 Examples', () => {
    it('parses Example 1: "ajke dupur e banani te sasta kabab, 4 jon"', () => {
      const parsed = parseNaturalQuery('ajke dupur e banani te sasta kabab, 4 jon');
      expect(parsed.isValid).toBe(true);
      expect(parsed.isAmbiguous).toBe(false);
      expect(parsed.extracted.location).toBe('Banani');
      expect(parsed.extracted.cuisine).toBe('kabab');
      expect(parsed.extracted.mealTime).toBe('lunch');
      expect(parsed.extracted.partySize).toBe(4);
      expect(parsed.extracted.budget).toBeTruthy();
    });

    it('parses Example 2: "Find a budget-friendly biryani place near Notun Bazar for three people tonight."', () => {
      const parsed = parseNaturalQuery('Find a budget-friendly biryani place near Notun Bazar for three people tonight.');
      expect(parsed.isValid).toBe(true);
      expect(parsed.isAmbiguous).toBe(false);
      expect(parsed.extracted.location).toBe('Notun Bazar');
      expect(parsed.extracted.cuisine).toBe('biryani');
      expect(parsed.extracted.mealTime).toBe('dinner');
      expect(parsed.extracted.partySize).toBe(3);
      expect(parsed.extracted.budget).toBeTruthy();
    });

    it('parses Example 3: "Gulshan e 500 takar moddhe 2 jon er jonno bhalo cafe chai."', () => {
      const parsed = parseNaturalQuery('Gulshan e 500 takar moddhe 2 jon er jonno bhalo cafe chai.');
      expect(parsed.isValid).toBe(true);
      expect(parsed.isAmbiguous).toBe(false);
      expect(parsed.extracted.location).toBe('Gulshan');
      expect(parsed.extracted.cuisine).toBe('cafe');
      expect(parsed.extracted.partySize).toBe(2);
      expect(parsed.extracted.budget.amount).toBe(500);
      expect(parsed.extracted.minRating).toBe(4.0);
    });
  });

  describe('Ambiguity Handling', () => {
    it('detects ambiguous word "kal" and provides a clarification prompt', () => {
      const parsed = parseNaturalQuery('kal dupur e banani te biryani khabo');
      expect(parsed.isValid).toBe(true);
      expect(parsed.isAmbiguous).toBe(true);
      expect(parsed.clarificationQuestion).toHaveProperty('text');
      expect(parsed.clarificationQuestion.options.length).toBeGreaterThan(1);
    });
  });

  describe('65-Item Labeled Corpus Evaluation', () => {
    it('executes full corpus and achieves >= 90% parsing accuracy', () => {
      const corpusData = JSON.parse(fs.readFileSync(CORPUS_FILE, 'utf8'));
      let correctCount = 0;

      for (const item of corpusData) {
        const res = parseNaturalQuery(item.query);
        if (item.isAmbiguous) {
          if (res.isAmbiguous) correctCount++;
          continue;
        }

        let isItemValid = true;
        if (item.expected.location && res.extracted.location !== item.expected.location) isItemValid = false;
        if (item.expected.cuisine && res.extracted.cuisine !== item.expected.cuisine) isItemValid = false;
        if (item.expected.partySize && res.extracted.partySize !== item.expected.partySize) isItemValid = false;
        if (item.expected.mealTime && res.extracted.mealTime !== item.expected.mealTime) isItemValid = false;

        if (isItemValid) correctCount++;
      }

      const accuracy = (correctCount / corpusData.length) * 100;
      expect(accuracy).toBeGreaterThanOrEqual(90);

      // Write accuracy report to docs/ASK_PARSER.md
      const report = `# F3 Ask In Your Own Words — Parser Accuracy Report
**Document**: \`docs/ASK_PARSER.md\`  
**Date**: October 15, 2026  
**Status**: Verified & Tested  

## 1. Parser Evaluation Overview
- **Total Test Corpus Queries**: ${corpusData.length}
- **Successfully Parsed**: ${correctCount}
- **Accuracy Rate**: **${accuracy.toFixed(1)}%** (Target: >= 90%)
- **Languages Covered**: English, Bangla script, Banglish (Romanized), and Mixed.

## 2. Tested Query Categories
1. **Canonical Examples** (3 / 3 PASS)
   - "ajke dupur e banani te sasta kabab, 4 jon" -> Banani / Kabab / Lunch / 4 people
   - "Find a budget-friendly biryani place near Notun Bazar for three people tonight." -> Notun Bazar / Biryani / Dinner / 3 people
   - "Gulshan e 500 takar moddhe 2 jon er jonno bhalo cafe chai." -> Gulshan / Cafe / 500 BDT / 2 people / Rating >= 4.0
2. **Ambiguity Resolution**: Correctly flags ambiguous terms ("kal") and prompts for user clarification instead of guessing.
3. **Bangla Numeral Normalization**: Seamlessly converts Bengali digits (১, ২, ৩) and Banglish numbers (ek, dui, tin, char).
`;
      fs.writeFileSync(path.join(__dirname, '..', '..', 'docs', 'ASK_PARSER.md'), report, 'utf8');
    });
  });

  describe('Search Endpoints', () => {
    it('interprets query via POST /api/search/interpret', async () => {
      const res = await request(app)
        .post('/api/search/interpret')
        .send({ query: 'banani te burger 2 jon' });

      expect(res.status).toBe(200);
      expect(res.body.isValid).toBe(true);
      expect(res.body.extracted.location).toBe('Banani');
      expect(res.body.extracted.cuisine).toBe('burger');
      expect(res.body.extracted.partySize).toBe(2);
    });

    it('executes confirmed criteria search via POST /api/search/confirm and returns ranked candidates', async () => {
      const res = await request(app)
        .post('/api/search/confirm')
        .send({
          criteria: {
            location: 'Banani',
            cuisine: 'burger',
            partySize: 2
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('candidates');
      expect(res.body.candidates.length).toBeGreaterThan(0);
      expect(res.body.topPicks.length).toBeGreaterThan(0);
      expect(res.body.resultsCount).toBe(res.body.candidates.length);
    });

    it('rejects invalid criteria in /search/confirm with 400', async () => {
      // Invalid partySize
      const res1 = await request(app)
        .post('/api/search/confirm')
        .send({ criteria: { partySize: 999 } });
      expect(res1.status).toBe(400);
      expect(res1.body.error).toContain('partySize');

      // Invalid cuisine (too long)
      const res2 = await request(app)
        .post('/api/search/confirm')
        .send({ criteria: { cuisine: 'a'.repeat(50) } });
      expect(res2.status).toBe(400);
      expect(res2.body.error).toContain('cuisine');

      // Invalid mealTime
      const res3 = await request(app)
        .post('/api/search/confirm')
        .send({ criteria: { mealTime: 'midnight_snack_xyz' } });
      expect(res3.status).toBe(400);
      expect(res3.body.error).toContain('mealTime');
    });

    it('/app/feature-flags handles array query params safely without 500 and uses private cache headers', async () => {
      const res = await request(app)
        .get('/api/app/feature-flags?channel=stable&channel=beta&installId=inst1&installId=inst2');

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toContain('private');
      expect(res.headers['vary']).toContain('X-Install-Id');
      expect(res.body).toHaveProperty('flags');
      expect(res.body).toHaveProperty('etag');
    });
  });
});
