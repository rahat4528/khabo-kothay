import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import logger from './logger.js';
import { recordAuditLog } from './audit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

const CONSENT_FILE = path.join(DATA_DIR, 'user-consents.jsonl');
const CRASH_FILE = path.join(DATA_DIR, 'crash-reports.jsonl');
const PROBLEM_FILE = path.join(DATA_DIR, 'problem-reports.jsonl');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Redaction patterns for sensitive data
export function hashIp(ip) {
  if (!ip || ip === 'unknown') return 'unknown';
  return crypto.createHash('sha256').update(String(ip)).digest('hex').substring(0, 16);
}

export function checkAndRotateJsonl(filePath, maxBytes = 5 * 1024 * 1024) {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size >= maxBytes) {
        const backupPath = `${filePath}.1`;
        if (fs.existsSync(backupPath)) {
          fs.unlinkSync(backupPath);
        }
        try {
          fs.renameSync(filePath, backupPath);
        } catch {
          fs.copyFileSync(filePath, backupPath);
          fs.unlinkSync(filePath);
        }
      }
    }
  } catch (err) {
    logger.warn({ err: err.message, filePath }, 'Failed to rotate jsonl file');
  }
}

export function tailLines(filePath, maxLines = 500) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const stats = fs.statSync(filePath);
    if (stats.size === 0) return [];
    const fd = fs.openSync(filePath, 'r');
    const readSize = Math.min(stats.size, 256 * 1024);
    const buffer = Buffer.alloc(readSize);
    const offset = stats.size - readSize;
    fs.readSync(fd, buffer, 0, readSize, offset);
    fs.closeSync(fd);

    const chunk = buffer.toString('utf8');
    const lines = chunk.split('\n').filter(Boolean);
    const completeLines = offset > 0 ? lines.slice(1) : lines;
    return completeLines.slice(-maxLines);
  } catch (err) {
    logger.warn({ err: err.message, filePath }, 'Failed to tail lines from file');
    return [];
  }
}

const REDACT_PATTERNS = [
  { pattern: /AIza[0-9A-Za-z\-_]{20,}/g, replacement: '[REDACTED_API_KEY]' },
  { pattern: /(?:bearer|token|auth|key|secret)\s*[:=\s]\s*['"]?[0-9a-zA-Z\-_]{8,}['"]?/gi, replacement: '[REDACTED_SECRET]' },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[REDACTED_EMAIL]' },
  { pattern: /(?:\+?88)?01[3-9]\d{8}/g, replacement: '[REDACTED_PHONE]' },
  { pattern: /(?:lat|lng|latitude|longitude)\s*[:=]\s*[-+]?\d+\.\d{3,}/gi, replacement: '[COARSENED_LOCATION]' }
];

export function sanitizeText(text) {
  if (!text || typeof text !== 'string') return '';
  let sanitized = text;
  for (const { pattern, replacement } of REDACT_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

export function computeCrashFingerprint(stackTrace, errorCategory) {
  const sanitized = sanitizeText(stackTrace || errorCategory || 'unknown');
  const lines = sanitized.split('\n').filter(l => l.trim().startsWith('at ') || l.includes('Exception'));
  const keyFrames = lines.slice(0, 3).join('|');
  return crypto.createHash('sha256').update(keyFrames || sanitized).digest('hex').substring(0, 16);
}

export function recordConsent({ installId, consentType = 'crash_reporting', granted = false, textVersion = '1.0', timestamp = null, ip = 'unknown' }) {
  const record = {
    id: `consent-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    installId: sanitizeText(installId),
    consentType,
    granted: Boolean(granted),
    textVersion,
    timestamp: timestamp || new Date().toISOString(),
    ipHash: hashIp(ip)
  };

  checkAndRotateJsonl(CONSENT_FILE);
  fs.appendFileSync(CONSENT_FILE, JSON.stringify(record) + '\n', 'utf8');
  return record;
}

export function recordCrashReport({
  errorCategory = 'UncaughtException',
  message = '',
  stackTrace = '',
  appVersion = '1.1.0',
  versionCode = 4,
  deviceMeta = {},
  requestId = null
}) {
  const sanitizedMessage = sanitizeText(message).substring(0, 1000);
  const sanitizedStack = sanitizeText(stackTrace).substring(0, 4000);
  const fingerprint = computeCrashFingerprint(sanitizedStack, errorCategory);

  const report = {
    id: `crash-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    fingerprint,
    errorCategory: sanitizeText(errorCategory),
    message: sanitizedMessage,
    stackTrace: sanitizedStack,
    appVersion,
    versionCode: Number(versionCode) || 0,
    deviceMeta: {
      osVersion: sanitizeText(deviceMeta.osVersion || ''),
      deviceModel: sanitizeText(deviceMeta.deviceModel || ''),
      manufacturer: sanitizeText(deviceMeta.manufacturer || '')
    },
    requestId: requestId ? sanitizeText(requestId) : null,
    timestamp: new Date().toISOString()
  };

  checkAndRotateJsonl(CRASH_FILE);
  fs.appendFileSync(CRASH_FILE, JSON.stringify(report) + '\n', 'utf8');
  return report;
}

export function recordProblemReport({
  category = 'GENERAL',
  description = '',
  appVersion = '1.1.0',
  versionCode = 4,
  requestId = null,
  screenshotBase64 = null
}) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const refCode = `REF-${dateStr}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const report = {
    id: `prob-${Date.now()}`,
    referenceNumber: refCode,
    category: sanitizeText(category),
    description: sanitizeText(description).substring(0, 1000),
    appVersion,
    versionCode: Number(versionCode) || 0,
    requestId: requestId ? sanitizeText(requestId) : null,
    hasScreenshot: Boolean(screenshotBase64 && screenshotBase64.length <= 100 * 1024),
    status: 'new', // new, triaged, fixed, wont_fix
    resolutionNotes: null,
    timestamp: new Date().toISOString()
  };

  checkAndRotateJsonl(PROBLEM_FILE);
  fs.appendFileSync(PROBLEM_FILE, JSON.stringify(report) + '\n', 'utf8');
  return report;
}

export function getDiagnosticsOverview() {
  const crashes = [];
  for (const line of tailLines(CRASH_FILE, 500)) {
    try { crashes.push(JSON.parse(line)); } catch {}
  }

  const problems = [];
  for (const line of tailLines(PROBLEM_FILE, 500)) {
    try { problems.push(JSON.parse(line)); } catch {}
  }

  // Aggregate crashes by fingerprint
  const crashGroups = {};
  for (const c of crashes) {
    if (!crashGroups[c.fingerprint]) {
      crashGroups[c.fingerprint] = {
        fingerprint: c.fingerprint,
        errorCategory: c.errorCategory,
        message: c.message,
        count: 0,
        lastSeen: c.timestamp,
        affectedVersions: new Set()
      };
    }
    crashGroups[c.fingerprint].count++;
    crashGroups[c.fingerprint].lastSeen = c.timestamp;
    crashGroups[c.fingerprint].affectedVersions.add(c.appVersion);
  }

  const aggregatedCrashes = Object.values(crashGroups).map(g => ({
    ...g,
    affectedVersions: Array.from(g.affectedVersions)
  }));

  return {
    totalCrashes: crashes.length,
    distinctCrashGroups: aggregatedCrashes.length,
    crashes: aggregatedCrashes.sort((a, b) => b.count - a.count),
    problems: problems.reverse()
  };
}

export default {
  sanitizeText,
  computeCrashFingerprint,
  recordConsent,
  recordCrashReport,
  recordProblemReport,
  getDiagnosticsOverview
};
