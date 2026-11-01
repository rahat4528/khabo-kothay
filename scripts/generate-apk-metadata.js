#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const dataDir = path.join(rootDir, 'server', 'data');
const outPath = path.join(dataDir, 'apk-metadata.json');

const apkPath = process.argv[2] || path.join(rootDir, 'public', 'downloads', 'khabo-kothay-latest.apk');

let sizeBytes = 68135777; // Baseline fallback size (~64.98 MB)
let sizeFormatted = '64.98 MB';
let sha256 = 'E5E8D00B8DA110EC7390A57315C76DA1AFD1C8C9B1FC5E54178272CA17D31353';

if (fs.existsSync(apkPath)) {
  const fileBuf = fs.readFileSync(apkPath);
  sizeBytes = fileBuf.length;
  sizeFormatted = `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
  sha256 = crypto.createHash('sha256').update(fileBuf).digest('hex').toUpperCase();
}

const metadata = {
  appName: 'KHABO KOTHAY?',
  appNameBn: 'খাবো কোথায়?',
  version: pkg.version || '1.1.0',
  apkSize: sizeFormatted,
  apkSizeBytes: sizeBytes,
  sha256,
  packageId: 'com.khabokothay.app',
  googleDriveFolderUrl: 'https://drive.google.com/drive/folders/1IqB-z_mpcQlKE4fgXzq5ZukaP2k9QTnu',
  directDownloadUrl: '/downloads/khabo-kothay-latest.apk',
  githubReleaseUrl: `https://github.com/rahat4528/khabo-kothay/releases/latest/download/khabo-kothay-${pkg.version || '1.1.0'}.apk`,
  qrDownloadUrl: '/downloads/khabo-kothay-qr.png',
  qrDriveUrl: '/downloads/khabo-kothay-drive-qr.png',
  minAndroidVersion: 'Android 8.0+ (Oreo)',
  targetSdk: 'Android 14 (API 34)',
  generatedAt: new Date().toISOString()
};

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(metadata, null, 2), 'utf8');
console.log(`Generated APK metadata -> ${outPath}`);
