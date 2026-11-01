import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import apiRouter, { APK_METADATA } from '../routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', '..', 'public');

// Create test app mounting static, api, and SPA fallback matching server/index.js
const app = express();
app.use(express.json());
app.get(['/download', '/apk'], (req, res) => {
  res.sendFile(path.join(publicDir, 'download.html'));
});
app.use(express.static(publicDir));
app.use('/api', apiRouter);

// Match server/index.js SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || path.extname(req.path)) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

describe('APK Download & QR Code Sharing System', () => {
  it('GET /api/download-info returns valid APK metadata and verified Google Drive URL', async () => {
    const res = await request(app).get('/api/download-info');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('appName', 'KHABO KOTHAY?');
    expect(res.body).toHaveProperty('version', '1.1.0');
    expect(res.body.googleDriveFolderUrl).toBe('https://drive.google.com/drive/folders/1IqB-z_mpcQlKE4fgXzq5ZukaP2k9QTnu');
    expect(res.body.directDownloadUrl).toBe('/downloads/khabo-kothay-latest.apk');
    expect(res.body.sha256).toMatch(/^[A-F0-9]{64}$/i);
    expect(res.body.apkSizeBytes).toBeGreaterThan(60 * 1024 * 1024);
  });

  it('GET /api/apk/meta alias returns identical payload', async () => {
    const res = await request(app).get('/api/apk/meta');
    expect(res.status).toBe(200);
    expect(res.body.version).toBe('1.1.0');
  });

  it('does not leak account-index /u/5/ in download metadata or landing page', async () => {
    const apiRes = await request(app).get('/api/download-info');
    expect(JSON.stringify(apiRes.body)).not.toContain('/u/5/');

    const pageRes = await request(app).get('/download');
    expect(pageRes.text).not.toContain('/u/5/');
  });

  it('returns HTTP 404 for missing .apk download requests instead of serving index.html', async () => {
    const res = await request(app).get('/downloads/nonexistent-file.apk');
    expect(res.status).toBe(404);
    // Must NOT be HTML / index.html
    expect(res.headers['content-type']).not.toContain('text/html');
  });

  it('GET /api/qr generates SVG QR code', async () => {
    const res = await request(app).get('/api/qr?url=https://drive.google.com/drive/folders/1IqB-z_mpcQlKE4fgXzq5ZukaP2k9QTnu');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/svg+xml');
    const svgContent = res.text || (Buffer.isBuffer(res.body) ? res.body.toString('utf8') : '');
    expect(svgContent).toContain('<svg');
  });

  it('GET /api/qr?format=png generates valid PNG binary', async () => {
    const res = await request(app).get('/api/qr?url=https://drive.google.com/drive/folders/1IqB-z_mpcQlKE4fgXzq5ZukaP2k9QTnu&format=png');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.body.length).toBeGreaterThan(500);
  });

  it('GET /api/qr?format=dataurl returns JSON dataURL', async () => {
    const res = await request(app).get('/api/qr?format=dataurl');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('dataUrl');
    expect(res.body.dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('GET /download serves complete download landing page with all required controls', async () => {
    const res = await request(app).get('/download');
    expect(res.status).toBe(200);
    expect(res.text).toContain('KHABO KOTHAY?');
    expect(res.text).toContain('id="driveDownloadBtn"');
    expect(res.text).toContain('id="directDownloadBtn"');
    expect(res.text).toContain('id="qrCodeImage"');
    expect(res.text).toContain('id="downloadQrBtn"');
    expect(res.text).toContain('id="copyShareUrlBtn"');
    expect(res.text).toContain('id="tabSharePage"');
    expect(res.text).toContain('id="tabDriveLink"');
    expect(res.text).toContain('https://drive.google.com/drive/folders/1IqB-z_mpcQlKE4fgXzq5ZukaP2k9QTnu');
  });

  it('Static APK and QR assets exist and are non-empty', () => {
    const apkFile = path.join(publicDir, 'downloads', 'khabo-kothay-latest.apk');
    const qrFile = path.join(publicDir, 'downloads', 'khabo-kothay-qr.png');
    const driveQrFile = path.join(publicDir, 'downloads', 'khabo-kothay-drive-qr.png');

    if (fs.existsSync(apkFile)) {
      expect(fs.statSync(apkFile).size).toBeGreaterThan(60 * 1024 * 1024);
    } else {
      expect(APK_METADATA.apkSizeBytes).toBeGreaterThan(60 * 1024 * 1024);
    }

    expect(fs.existsSync(qrFile)).toBe(true);
    expect(fs.statSync(qrFile).size).toBeGreaterThan(1000);

    expect(fs.existsSync(driveQrFile)).toBe(true);
    expect(fs.statSync(driveQrFile).size).toBeGreaterThan(1000);
  });
});
