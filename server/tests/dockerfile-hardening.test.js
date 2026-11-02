import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..', '..');

describe('API Container & Dependencies Hardening', () => {
  it('ensures api/Dockerfile runs as non-root user and specifies HEALTHCHECK', () => {
    const dockerfilePath = path.join(rootDir, 'api', 'Dockerfile');
    const content = fs.readFileSync(dockerfilePath, 'utf8');

    expect(content).toContain('useradd');
    expect(content).toContain('USER appuser');
    expect(content).toContain('HEALTHCHECK');
    expect(content).toContain('http://localhost:8000/api/v1/health');
  });

  it('ensures api/requirements.txt pins production packages and excludes test packages', () => {
    const reqPath = path.join(rootDir, 'api', 'requirements.txt');
    const content = fs.readFileSync(reqPath, 'utf8');

    expect(content).toContain('fastapi==');
    expect(content).toContain('uvicorn');
    expect(content).toContain('pydantic==');
    expect(content).not.toContain('pytest');
    expect(content).not.toContain('httpx');
  });

  it('ensures api/requirements-dev.txt isolates testing and development tools', () => {
    const devReqPath = path.join(rootDir, 'api', 'requirements-dev.txt');
    const content = fs.readFileSync(devReqPath, 'utf8');

    expect(content).toContain('-r requirements.txt');
    expect(content).toContain('pytest==');
    expect(content).toContain('httpx==');
    expect(content).toContain('pytest-cov==');
  });
});
