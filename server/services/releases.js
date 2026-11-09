import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';
import { recordAuditLog } from './audit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RELEASES_FILE = path.join(__dirname, '..', 'data', 'releases.json');

// Approved download host allowlist (Section 4.5)
export const APPROVED_DOWNLOAD_HOSTS = [
  'github.com',
  'raw.githubusercontent.com',
  'objects.githubusercontent.com',
  'khabokothay.com',
  'api.khabokothay.com',
  'khabo-kothay-backend.onrender.com'
];

// Baseline initial releases seed
const INITIAL_RELEASES = [
  {
    id: 'rel-1.1.0-4',
    packageName: 'com.khabokothay.app',
    latestVersionName: '1.1.0',
    latestVersionCode: 4,
    minimumSupportedVersionCode: 1,
    minimumSupportedVersionName: '1.0.0',
    downloadUrl: 'https://github.com/rahat4528/khabo-kothay/releases/download/v4.0.0/khabo-kothay-1.1.0.apk',
    checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    signingCertSha256: 'B6:E2:81:4A:9C:20:84:7D:6F:05:41:88:62:3C:D0:A2:4E:91:20:94:FA:21:64:25:7C:E3:69:B8:20:01:DF:74',
    releaseNotes: {
      en: {
        added: [
          'Update Checker & What\'s New in-app notifications',
          'Fare Check: Rickshaw & CNG crowdsourced reference range estimation',
          'Ask in Your Own Words: Banglish and Bangla natural search parser'
        ],
        fixed: [
          'Accurate time-budget calculations avoiding closing restaurants',
          'Traffic calculation resilience under fluctuating network conditions'
        ],
        improved: [
          'Material 3 design system with Bengali language parity and large text scaling'
        ],
        breaking: []
      },
      bn: {
        added: [
          'ইন-অ্যাপ আপডেট চেকার এবং কি নতুন ফিচার বিবরণী',
          'ভাড়া চেক: রিকশা ও সিএনজির যৌক্তিক তথ্যনির্ভর খরচের হিসাব',
          'নিজের ভাষায় খুঁজুন: বাংলা ও বাংলিশ সার্চ পার্সার'
        ],
        fixed: [
          'বন্ধ হতে যাওয়া রেস্তোরাঁ বাদ দিয়ে সঠিক সময় হিসাব',
          'নেটওয়ার্ক দুর্বলতায় ট্রাফিক তথ্যের ধারাবাহিকতা'
        ],
        improved: [
          'মেটেরিয়াল ৩ ডিজাইন এবং উন্নত বাংলা ফন্ট ডিসপ্লে'
        ],
        breaking: []
      }
    },
    publishedAt: '2026-10-15T00:00:00.000Z',
    releaseChannel: 'stable',
    status: 'published',
    artifactVerified: true
  }
];

export function validateDownloadUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return { valid: false, reason: 'Download URL must use secure HTTPS protocol' };
    }
    const hostname = parsed.hostname.toLowerCase();
    const isApproved = APPROVED_DOWNLOAD_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h));
    if (!isApproved) {
      return { valid: false, reason: `Host '${hostname}' is not in the approved download host allowlist` };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: 'Invalid download URL syntax' };
  }
}

export function loadReleases() {
  try {
    if (fs.existsSync(RELEASES_FILE)) {
      const data = JSON.parse(fs.readFileSync(RELEASES_FILE, 'utf8'));
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (err) {
    logger.error({ err }, 'Failed reading releases.json; using baseline');
  }
  return [...INITIAL_RELEASES];
}

export function saveReleases(releases) {
  try {
    const dir = path.dirname(RELEASES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(RELEASES_FILE, JSON.stringify(releases, null, 2), 'utf8');
  } catch (err) {
    logger.error({ err }, 'Failed saving releases.json');
  }
}

export function getLatestRelease(channel = 'stable') {
  const releases = loadReleases();
  const published = releases.filter(r => r.status === 'published' && (channel === 'all' || r.releaseChannel === channel || r.releaseChannel === 'all'));
  if (published.length === 0) return null;
  // Highest versionCode is authoritative
  return published.sort((a, b) => b.latestVersionCode - a.latestVersionCode)[0];
}

export function getPublishedReleases(channel = 'stable') {
  const releases = loadReleases();
  return releases
    .filter(r => r.status === 'published' && (channel === 'all' || r.releaseChannel === channel || r.releaseChannel === 'all'))
    .sort((a, b) => b.latestVersionCode - a.latestVersionCode);
}

export function getAllReleases() {
  return loadReleases();
}

export function createReleaseDraft(data, { who = 'admin', ip = 'unknown', requestId = null } = {}) {
  const releases = loadReleases();

  // Validate fields
  if (!data.latestVersionCode || !data.latestVersionName || !data.downloadUrl) {
    throw new Error('Missing required fields: latestVersionCode, latestVersionName, downloadUrl');
  }

  const urlCheck = validateDownloadUrl(data.downloadUrl);
  if (!urlCheck.valid) {
    throw new Error(urlCheck.reason);
  }

  const vCode = Number(data.latestVersionCode);
  const minCode = Number(data.minimumSupportedVersionCode || vCode);

  if (minCode > vCode) {
    throw new Error('minimumSupportedVersionCode cannot exceed latestVersionCode');
  }

  const newRelease = {
    id: `rel-${data.latestVersionName}-${vCode}`,
    packageName: data.packageName || 'com.khabokothay.app',
    latestVersionName: String(data.latestVersionName),
    latestVersionCode: vCode,
    minimumSupportedVersionCode: minCode,
    minimumSupportedVersionName: data.minimumSupportedVersionName || '1.0.0',
    downloadUrl: data.downloadUrl,
    checksumSha256: data.checksumSha256 || null,
    signingCertSha256: data.signingCertSha256 || null,
    releaseNotes: data.releaseNotes || { en: { added: [], fixed: [], improved: [], breaking: [] }, bn: { added: [], fixed: [], improved: [], breaking: [] } },
    publishedAt: null,
    releaseChannel: data.releaseChannel || 'stable',
    status: 'draft',
    artifactVerified: Boolean(data.artifactVerified)
  };

  releases.push(newRelease);
  saveReleases(releases);

  recordAuditLog({
    who,
    action: 'RELEASE_CREATE_DRAFT',
    target: newRelease.id,
    after: newRelease,
    ip,
    requestId
  });

  return newRelease;
}

export function publishRelease(id, { who = 'admin', ip = 'unknown', requestId = null } = {}) {
  const releases = loadReleases();
  const rel = releases.find(r => r.id === id);
  if (!rel) {
    throw new Error(`Release '${id}' not found`);
  }

  const before = { ...rel };
  rel.status = 'published';
  rel.publishedAt = new Date().toISOString();

  saveReleases(releases);

  recordAuditLog({
    who,
    action: 'RELEASE_PUBLISH',
    target: id,
    before,
    after: rel,
    ip,
    requestId
  });

  return rel;
}

export function withdrawRelease(id, { who = 'admin', ip = 'unknown', requestId = null } = {}) {
  const releases = loadReleases();
  const rel = releases.find(r => r.id === id);
  if (!rel) {
    throw new Error(`Release '${id}' not found`);
  }

  const before = { ...rel };
  rel.status = 'withdrawn';

  saveReleases(releases);

  recordAuditLog({
    who,
    action: 'RELEASE_WITHDRAW',
    target: id,
    before,
    after: rel,
    ip,
    requestId
  });

  return rel;
}

export default {
  APPROVED_DOWNLOAD_HOSTS,
  validateDownloadUrl,
  loadReleases,
  saveReleases,
  getLatestRelease,
  getPublishedReleases,
  getAllReleases,
  createReleaseDraft,
  publishRelease,
  withdrawRelease
};
