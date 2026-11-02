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
  it('ensures C++ routing core and Java traffic dispatch engines have zero coordinate bugs or hardcoded area assumptions', () => {
    const mainCppPath = path.join(rootDir, 'engines', 'routing-core', 'src', 'main.cpp');
    const mainCpp = fs.readFileSync(mainCppPath, 'utf8');
    expect(mainCpp).not.toContain('23.4250 ? 90.4250 : 90.4250');
    expect(mainCpp).toContain('const double userLng = 90.4250;');

    const routingCppPath = path.join(rootDir, 'engines', 'routing-core', 'src', 'RoutingCore.cpp');
    const routingCpp = fs.readFileSync(routingCppPath, 'utf8');
    expect(routingCpp).not.toContain('Calibrated rates for Gulshan');

    const javaGeofencePath = path.join(rootDir, 'services', 'traffic-dispatch', 'src', 'main', 'java', 'com', 'khabokothay', 'geofence', 'DhakaGeofenceManager.java');
    const javaGeofence = fs.readFileSync(javaGeofencePath, 'utf8');
    expect(javaGeofence).not.toContain('23.7680, 23.3950');
    expect(javaGeofence).toContain('23.7680, 90.3950');
    expect(javaGeofence).toContain('dhanmondi');
    expect(javaGeofence).toContain('uttara');
    expect(javaGeofence).toContain('mirpur');
  });
});