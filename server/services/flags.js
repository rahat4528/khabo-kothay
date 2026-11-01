import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import logger from './logger.js';
import { recordAuditLog } from './audit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FLAGS_FILE = path.join(__dirname, '..', 'data', 'remote-flags.json');

// Compiled-in default flags for all 16 features
export const DEFAULT_FLAGS = {
  update_checker: {
    key: 'update_checker',
    description: 'In-app update checker and release notes (What\'s New)',
    enabled: true,
    minVersionCode: 1,
    maxVersionCode: 999999,
    channel: 'all',
    rolloutPercentage: 100,
    allowlist: [],
    updatedAt: new Date().toISOString(),
    updatedBy: 'system'
  },
  natural_language_search: {
    key: 'natural_language_search',
    description: 'Ask In Your Own Words natural language query parser',
    enabled: true,
    minVersionCode: 1,
    maxVersionCode: 999999,
    channel: 'all',
    rolloutPercentage: 100,
    allowlist: [],
    updatedAt: new Date().toISOString(),
    updatedBy: 'system'
  },
  voice_search: {
    key: 'voice_search',
    description: 'Voice search microphone input and transcription editing',
    enabled: true,
    minVersionCode: 1,
    maxVersionCode: 999999,
    channel: 'all',
    rolloutPercentage: 100,
    allowlist: [],
    updatedAt: new Date().toISOString(),
    updatedBy: 'system'
  },
  group_mode: {
    key: 'group_mode',
    description: 'Group dining session coordination and fair multi-origin ranking',
    enabled: true,
    minVersionCode: 1,
    maxVersionCode: 999999,
    channel: 'all',
    rolloutPercentage: 100,
    allowlist: [],
    updatedAt: new Date().toISOString(),
    updatedBy: 'system'
  },
  swipe_mode: {
    key: 'swipe_mode',
    description: 'One-minute taste preference setup with restaurant swipe cards',
    enabled: true,
    minVersionCode: 1,
    maxVersionCode: 999999,
    channel: 'all',
    rolloutPercentage: 100,
    allowlist: [],
    updatedAt: new Date().toISOString(),
    updatedBy: 'system'
  },
  fare_check: {
    key: 'fare_check',
    description: 'Fare Check crowdsourced reference range estimation for rickshaw & CNG',
    enabled: true,
    minVersionCode: 1,
    maxVersionCode: 999999,
    channel: 'all',
    rolloutPercentage: 100,
    allowlist: [],
    updatedAt: new Date().toISOString(),
    updatedBy: 'system'
  },
  dish_prices: {
    key: 'dish_prices',
    description: 'Community-reported dish prices with outlier filtering',
    enabled: true,
    minVersionCode: 1,
    maxVersionCode: 999999,
    channel: 'all',
    rolloutPercentage: 100,
    allowlist: [],
    updatedAt: new Date().toISOString(),
    updatedBy: 'system'
  },
  rain_aware_mode: {
    key: 'rain_aware_mode',
    description: 'Weather-aware recommendations favoring closer spots when rain is predicted',
    enabled: true,
    minVersionCode: 1,
    maxVersionCode: 999999,
    channel: 'all',
    rolloutPercentage: 100,
    allowlist: [],
    updatedAt: new Date().toISOString(),
    updatedBy: 'system'
  },
  lunch_break_reminders: {
    key: 'lunch_break_reminders',
    description: 'WorkManager lunch-break reminders with time-budget feasible picks',
    enabled: true,
    minVersionCode: 1,
    maxVersionCode: 999999,
    channel: 'all',
    rolloutPercentage: 100,
    allowlist: [],
    updatedAt: new Date().toISOString(),
    updatedBy: 'system'
  },
  share_my_trip: {
    key: 'share_my_trip',
    description: 'One-tap trip sharing to native share sheet without live tracking',
    enabled: true,
    minVersionCode: 1,
    maxVersionCode: 999999,
    channel: 'all',
    rolloutPercentage: 100,
    allowlist: [],
    updatedAt: new Date().toISOString(),
    updatedBy: 'system'
  },
  dietary_preferences: {
    key: 'dietary_preferences',
    description: 'Structured dietary filters (Halal, Vegetarian, etc.) with verification levels',
    enabled: true,
    minVersionCode: 1,
    maxVersionCode: 999999,
    channel: 'all',
    rolloutPercentage: 100,
    allowlist: [],
    updatedAt: new Date().toISOString(),
    updatedBy: 'system'
  },
  pay_me_line: {
    key: 'pay_me_line',
    description: 'On-device encrypted bKash/Nagad number line for bill split sharing',
    enabled: true,
    minVersionCode: 1,
    maxVersionCode: 999999,
    channel: 'all',
    rolloutPercentage: 100,
    allowlist: [],
    updatedAt: new Date().toISOString(),
    updatedBy: 'system'
  },
  simple_mode: {
    key: 'simple_mode',
    description: 'High-accessibility streamlined UI with large text and 3 core actions',
    enabled: true,
    minVersionCode: 1,
    maxVersionCode: 999999,
    channel: 'all',
    rolloutPercentage: 100,
    allowlist: [],
    updatedAt: new Date().toISOString(),
    updatedBy: 'system'
  },
  food_story: {
    key: 'food_story',
    description: '100% on-device dining recap and milestone summaries',
    enabled: true,
    minVersionCode: 1,
    maxVersionCode: 999999,
    channel: 'all',
    rolloutPercentage: 100,
    allowlist: [],
    updatedAt: new Date().toISOString(),
    updatedBy: 'system'
  },
  crash_reporting: {
    key: 'crash_reporting',
    description: 'Consented, sanitized on-device crash capture and error reporting',
    enabled: true,
    minVersionCode: 1,
    maxVersionCode: 999999,
    channel: 'all',
    rolloutPercentage: 100,
    allowlist: [],
    updatedAt: new Date().toISOString(),
    updatedBy: 'system'
  },
  report_a_problem: {
    key: 'report_a_problem',
    description: 'User-facing diagnostic problem reporter with user-reviewed attachments',
    enabled: true,
    minVersionCode: 1,
    maxVersionCode: 999999,
    channel: 'all',
    rolloutPercentage: 100,
    allowlist: [],
    updatedAt: new Date().toISOString(),
    updatedBy: 'system'
  }
};

/**
 * Load flags from persistent JSON store or initialize with defaults
 */
export function loadFlags() {
  try {
    if (fs.existsSync(FLAGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(FLAGS_FILE, 'utf8'));
      // Merge with defaults to ensure all 16 flags exist
      return { ...DEFAULT_FLAGS, ...data };
    }
  } catch (err) {
    logger.error({ err }, 'Failed reading remote-flags.json; using defaults');
  }
  return { ...DEFAULT_FLAGS };
}

/**
 * Save flags to persistent JSON store
 */
export function saveFlags(flags) {
  try {
    const dir = path.dirname(FLAGS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(FLAGS_FILE, JSON.stringify(flags, null, 2), 'utf8');
  } catch (err) {
    logger.error({ err }, 'Failed saving remote-flags.json');
  }
}

/**
 * Compute stable 0-99 bucket for an installId and flagKey
 * @param {string} installId
 * @param {string} flagKey
 * @returns {number} Integer between 0 and 99
 */
export function computeRolloutBucket(installId, flagKey) {
  if (!installId) return 0;
  const hash = crypto.createHash('sha256').update(`${installId}:${flagKey}`).digest('hex');
  return parseInt(hash.substring(0, 8), 16) % 100;
}

/**
 * Evaluate all flags for a requesting client
 * @param {Object} options
 * @param {string} [options.installId] - Unique random install UUID
 * @param {number} [options.versionCode=0] - Client versionCode
 * @param {string} [options.channel='stable'] - Client channel ('stable', 'beta', 'internal')
 * @returns {Object} Evaluated key-value map and ETag
 */
export function evaluateFlags({ installId = 'anonymous', versionCode = 0, channel = 'stable' } = {}) {
  const flags = loadFlags();
  const evaluated = {};
  const safeInstallId = Array.isArray(installId) ? String(installId[0] || 'anonymous') : String(installId || 'anonymous');
  const safeVersionCode = Array.isArray(versionCode) ? Number(versionCode[0]) || 0 : Number(versionCode) || 0;
  const safeChannel = Array.isArray(channel) ? String(channel[0] || 'stable') : String(channel || 'stable');
  const vCode = safeVersionCode;
  const clientChannel = safeChannel.toLowerCase();

  for (const [key, cfg] of Object.entries(flags)) {
    // 1. Emergency kill switch: if not enabled, strictly false
    if (!cfg.enabled) {
      evaluated[key] = false;
      continue;
    }

    // 2. Allowlist override: if installId is explicitly allowlisted, grant access
    if (Array.isArray(cfg.allowlist) && cfg.allowlist.includes(safeInstallId)) {
      evaluated[key] = true;
      continue;
    }

    // 3. Version code check
    if (vCode > 0) {
      if (cfg.minVersionCode && vCode < cfg.minVersionCode) {
        evaluated[key] = false;
        continue;
      }
      if (cfg.maxVersionCode && vCode > cfg.maxVersionCode) {
        evaluated[key] = false;
        continue;
      }
    }

    // 4. Channel check
    if (cfg.channel && cfg.channel !== 'all' && cfg.channel !== clientChannel) {
      evaluated[key] = false;
      continue;
    }

    // 5. Staged percentage rollout check via stable hash
    const pct = typeof cfg.rolloutPercentage === 'number' ? cfg.rolloutPercentage : 100;
    if (pct >= 100) {
      evaluated[key] = true;
    } else if (pct <= 0) {
      evaluated[key] = false;
    } else {
      const bucket = computeRolloutBucket(safeInstallId, key);
      evaluated[key] = bucket < pct;
    }
  }

  const payload = JSON.stringify(evaluated);
  const etag = crypto.createHash('md5').update(payload).digest('hex');

  return {
    flags: evaluated,
    etag,
    serverTime: new Date().toISOString()
  };
}

/**
 * Update a feature flag definition (admin only)
 */
export function updateFlag(key, updates, { who = 'admin', ip = 'unknown', requestId = null } = {}) {
  const flags = loadFlags();
  if (!flags[key]) {
    throw new Error(`Flag '${key}' not found`);
  }

  const before = { ...flags[key] };
  const allowedFields = ['enabled', 'rolloutPercentage', 'minVersionCode', 'maxVersionCode', 'channel', 'allowlist', 'description'];
  
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      flags[key][field] = updates[field];
    }
  }

  flags[key].updatedAt = new Date().toISOString();
  flags[key].updatedBy = who;

  saveFlags(flags);

  recordAuditLog({
    who,
    action: 'FLAG_UPDATE',
    target: key,
    before,
    after: flags[key],
    ip,
    requestId
  });

  return flags[key];
}

/**
 * Retrieve all raw flag definitions (admin only)
 */
export function getAllFlags() {
  return loadFlags();
}

export default {
  DEFAULT_FLAGS,
  loadFlags,
  saveFlags,
  computeRolloutBucket,
  evaluateFlags,
  updateFlag,
  getAllFlags
};
