import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..', '..');

describe('Codebase Syntax & Encoding Hygiene', () => {
  it('ensures server/routes/api.js has zero UTF-8 BOM characters and unified top-level imports', () => {
    const apiPath = path.join(rootDir, 'server', 'routes', 'api.js');
    const buffer = fs.readFileSync(apiPath);
    const bomIndex = buffer.indexOf(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(bomIndex).toBe(-1);

    const content = buffer.toString('utf8');
    const firstImport = content.indexOf('import ');
    const firstNonImport = content.indexOf('const router = express.Router();');
    expect(firstImport).toBe(0);
    expect(firstNonImport).toBeGreaterThan(firstImport);
  });
});
