import { createGroupSession, joinGroupSession, computeFairRanking, castVote, closeGroupSession, getGroupSession } from '../services/group-mode.js';
import { addDishPriceReport, getDishPrices } from '../services/dish-prices.js';
import { estimateFareRange, compareFareQuote, addFareReport, loadFareReports } from '../services/fare-check.js';
import { parseNaturalQuery } from '../services/ask-parser.js';
import { recordConsent, recordCrashReport, recordProblemReport, getDiagnosticsOverview } from '../services/diagnostics.js';
import { evaluateFlags, updateFlag, getAllFlags } from '../services/flags.js';
import { getLatestRelease, getPublishedReleases, getAllReleases, createReleaseDraft, publishRelease, withdrawRelease, validateDownloadUrl } from '../services/releases.js';
import { getAuditLogs } from '../services/audit.js';
﻿import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import QRCode from 'qrcode';
import pkg from '../../package.json' with { type: 'json' };
import { searchRestaurants, getPlaceDetails } from '../services/places.js';
import { computeTravelTimes, compareRoutes } from '../services/routes.js';
import { rankRestaurants } from '../services/recommend.js';
import { getDefaultTasteProfile, recordEvent, decayProfile } from '../services/taste.js';
import { getWeatherContext } from '../services/weather.js';
import { applyMoodCriteria, getMoodConfig } from '../services/mood.js';
import { PRESET_LOCATIONS } from '../services/mock.js';
import quotaManager from '../services/quota.js';
import logger from '../services/logger.js';
import { getDeparturePredictions } from '../services/predictions.js';
import { getBanditProfile, updateBanditWeights, resetBanditProfile, setBanditEnabled } from '../services/bandit.js';
import { logEvalEvent } from '../services/eval-logger.js';
import preferencesConfig from '../config/preferences.json' with { type: 'json' };
import featureFlags from '../config/featureFlags.js';
import { searchMealTime } from '../services/mealtime.js';
import { dataFile } from '../config/paths.js';

const router = express.Router();
// Configurable endpoints exempt from HTTP 426 version enforcement (Section 4.3)
const EXEMPT_VERSION_ENDPOINTS = new Set([
  '/health',
  '/ready',
  '/app/version',
  '/app/releases',
  '/app/feature-flags',
  '/download-info',
  '/apk/meta',
  '/qr',
  '/config'
]);

// Server-side version enforcement middleware (HTTP 426 Upgrade Required)
router.use((req, res, next) => {
  if (EXEMPT_VERSION_ENDPOINTS.has(req.path)) {
    return next();
  }

  const rawVersionCode = req.headers['x-app-version-code'];
  if (rawVersionCode !== undefined) {
    const clientCode = parseInt(rawVersionCode, 10);
    if (!Number.isNaN(clientCode) && clientCode > 0) {
      const channel = req.headers['x-app-channel'] || 'stable';
      const latest = getLatestRelease(channel);
      if (latest && clientCode < latest.minimumSupportedVersionCode) {
        return res.status(426).json({
          error: {
            code: 'UPGRADE_REQUIRED',
            message: 'This version of the app is no longer supported. Please update to continue.',
            hint: 'Please download the latest version from the verified release link.',
            installedVersionCode: clientCode,
            minimumSupportedVersionCode: latest.minimumSupportedVersionCode,
            latestVersionCode: latest.latestVersionCode,
            latestVersionName: latest.latestVersionName,
            downloadUrl: latest.downloadUrl
          }
        });
      }
    }
  }
  next();
});


const PROBE_PATHS = new Set(['/health', '/ready']);

// Middleware to record endpoint hits and response time metrics
router.use((req, res, next) => {
  if (PROBE_PATHS.has(req.path)) return next(); // platform health checks shouldn't burn the monthly budget
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    // Route pattern (e.g. /places/:placeId/details), not the raw path: raw paths are client-chosen
    // and would grow the counters map without bound.
    const endpoint = req.route ? req.baseUrl + req.route.path : `${req.baseUrl}/(unmatched)`;
    quotaManager.recordEndpointHit(endpoint, res.statusCode, durationMs);
  });
  next();
});

// ---------- Request helpers ----------

/** Quota identity. Uses the connection IP: the x-device-id header is client-chosen and trivially rotated. */
function clientIp(req) {
  return req.ip || 'anonymous';
}

/** Personalization identity (bandit weights). Device id when the client sends one, else IP. */
function deviceKey(req) {
  const id = req.headers['x-device-id'];
  return typeof id === 'string' && id.length > 0 && id.length <= 128 ? id : clientIp(req);
}

/** Eval logs must not contain raw IPs or device ids. */
function anonSessionId(req) {
  const provided = req.headers['x-session-id'];
  if (typeof provided === 'string' && /^[\w-]{1,64}$/.test(provided)) return provided;
  return 'sess_' + crypto.createHash('sha256').update(deviceKey(req)).digest('hex').slice(0, 16);
}

/** Returns { lat, lng } when both are finite and in range, else null. */
export function parseCoords(lat, lng) {
  if (lat === undefined || lat === null || lat === '' || lng === undefined || lng === null || lng === '') return null;
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
  return { lat: la, lng: ln };
}

function enforceDeviceQuota(req, res) {
  const limitCheck = quotaManager.checkAndRecordDeviceSearch(clientIp(req));
  if (!limitCheck.allowed) {
    res.status(429).json({
      error: limitCheck.message,
      limit: limitCheck.limit,
      resetAt: limitCheck.resetAt
    });
    return false;
  }
  return true;
}

function isLoopback(req) {
  // Socket address, not req.ip: with trust proxy enabled req.ip comes from X-Forwarded-For.
  const addr = req.socket?.remoteAddress;
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

function tokensMatch(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * Admin gate: X-Admin-Token must match ADMIN_TOKEN. Outside production, loopback
 * requests are also allowed so local tooling works without a token.
 */
export function requireAdmin(req, res, next) {
  const configured = process.env.ADMIN_TOKEN;
  const isProd = process.env.NODE_ENV === 'production';
  const usable = configured && !(isProd && configured === 'secret_admin_token');
  const provided = req.headers['x-admin-token'];
  if (usable && provided && tokensMatch(provided, configured)) return next();
  if (!isProd && isLoopback(req)) return next();
  return res.status(403).json({ error: 'Admin access denied' });
}

// ---------- Probes ----------

export function healthHandler(req, res) {
  res.json({
    ok: true,
    status: 'ok',
    app: 'Khabo Kothay?',
    version: pkg.version,
    commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'unknown',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
}

export function readyHandler(req, res) {
  const memory = process.memoryUsage();
  const isHealthy = memory.heapUsed < 1.5 * 1024 * 1024 * 1024;
  const budget = quotaManager.checkGlobalMonthlyBudget();
  const ready = isHealthy && !budget.killSwitchActive;

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'degraded',
    ok: ready,
    app: 'Khabo Kothay?',
    version: pkg.version,
    checks: {
      cache: 'ok',
      engine: 'ok',
      budget: budget.isExceeded ? 'budget_exceeded' : 'ok'
    },
    uptime: process.uptime()
  });
}

/**
 * GET /api/health, /api/ready (and /api/v1/*) - Liveness & Readiness Probes
 */
router.get('/health', healthHandler);
router.get('/ready', readyHandler);

/**
 * GET /api/admin/usage
 * Administrative metrics on usage, endpoints, and daily Google API quota
 */
router.get('/admin/usage', requireAdmin, (req, res) => {
  res.json(quotaManager.getUsageReport());
});

/**
 * POST /api/admin/killswitch - Kill-switch toggle
 */
router.post('/admin/killswitch', requireAdmin, (req, res) => {
  const { active } = req.body || {};
  const currentState = quotaManager.setKillSwitch(active);
  res.json({
    success: true,
    killSwitchActive: currentState,
    message: currentState
      ? 'Kill-switch activated. Global requests gated to cached/mock fallback.'
      : 'Kill-switch deactivated.'
  });
});

/**
 * GET /api/config
 * Returns ONLY browser-safe config. NEVER returns GOOGLE_SERVER_KEY!
 */
router.get('/config', (req, res) => {
  const isMock = process.env.USE_MOCK_DATA === 'true' || !process.env.GOOGLE_SERVER_KEY;
  res.json({
    googleBrowserKey: process.env.GOOGLE_BROWSER_KEY || '',
    useMockData: isMock,
    presetLocations: PRESET_LOCATIONS
  });
});

/**
 * GET /api/context/weather
 */
router.get('/context/weather', async (req, res, next) => {
  try {
    const coords = parseCoords(req.query.lat, req.query.lng) || { lat: 23.7925, lng: 90.4150 };
    const weather = await getWeatherContext(coords.lat, coords.lng);
    res.json(weather);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/restaurants/search
 * Simple candidate search
 */
router.post('/restaurants/search', async (req, res, next) => {
  try {
    const { lat, lng, cuisine = 'All', radiusMeters = 3000, budget } = req.body;
    const coords = parseCoords(lat, lng);
    if (!coords) {
      return res.status(400).json({ error: 'lat and lng are required coordinates' });
    }
    if (typeof cuisine !== 'string') {
      return res.status(400).json({ error: 'cuisine must be a string' });
    }
    if (!enforceDeviceQuota(req, res)) return;

    const radius = Number(radiusMeters);
    const candidates = await searchRestaurants({
      lat: coords.lat,
      lng: coords.lng,
      cuisine,
      radiusMeters: Number.isFinite(radius) ? Math.min(Math.max(radius, 100), 10000) : 3000,
      budget
    });

    res.json({ candidates });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/recommend
 * Core ranking engine endpoint: search + traffic-aware routes + cost + mood + taste + scoring
 * Stateless - accepts tasteProfile, mood, priority, budget, weatherContext in request body
 */
router.post('/recommend', async (req, res, next) => {
  try {
    const budgetStatus = quotaManager.checkGlobalMonthlyBudget();

    const {
      lat,
      lng,
      cuisine = 'All',
      priority = 'Best Overall',
      budget = 2,
      mood = null,
      tasteProfile = null,
      weatherContext = null,
      collaborativeInteractions = null,
      surpriseMe = false,
      timeBudgetMinutes = null,
      companion = null,
      preferences = null,
      openNowOnly = false,
      distanceRadiusMeters = null,
      foodProfile = null,
      filters = null
    } = req.body;

    const coords = parseCoords(lat, lng);
    if (!coords) {
      return res.status(400).json({ error: 'Coordinates lat and lng are required' });
    }
    if (typeof cuisine !== 'string' || typeof priority !== 'string') {
      return res.status(400).json({ error: 'cuisine and priority must be strings' });
    }
    if (!enforceDeviceQuota(req, res)) return;

    const userLat = coords.lat;
    const userLng = coords.lng;
    const banditProfile = getBanditProfile(deviceKey(req));

    // 1. Fetch Candidates (Multi-cuisine if mood dictates)
    let candidates = [];
    const moodConfig = mood ? getMoodConfig(mood) : null;

    const candidateBudget = (filters && (filters.priceMin !== undefined || filters.priceMax !== undefined)) ? null : budget;

    if (moodConfig && (!cuisine || cuisine === 'All')) {
      if (moodConfig.cuisines && moodConfig.cuisines.length > 0) {
        // Fetch candidates for primary mood cuisines
        const promises = moodConfig.cuisines.slice(0, 3).map(c =>
          searchRestaurants({ lat: userLat, lng: userLng, cuisine: c, budget: candidateBudget })
        );
        const nested = await Promise.all(promises);
        const seen = new Set();
        for (const list of nested) {
          for (const item of list) {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              candidates.push(item);
            }
          }
        }
      } else {
        candidates = await searchRestaurants({ lat: userLat, lng: userLng, cuisine: 'All', budget: candidateBudget });
      }
    } else {
      candidates = await searchRestaurants({ lat: userLat, lng: userLng, cuisine, budget: candidateBudget });
    }

    if (candidates.length === 0) {
      return res.json({
        results: [],
        topPicks: null,
        meta: { count: 0, message: 'No open restaurants found matching your criteria.' }
      });
    }

    // 2. Compute Traffic-Aware Travel Times
    const travelMetrics = await computeTravelTimes(
      { lat: userLat, lng: userLng },
      candidates
    );

    const travelMap = new Map(travelMetrics.map(t => [t.id, t]));
    const mergedCandidates = candidates.map(c => {
      const metrics = travelMap.get(c.id) || {
        distanceMeters: 2000,
        durationSeconds: 900,
        staticDurationSeconds: 750,
        trafficLevel: 'Moderate',
        trafficRatio: 1.2
      };
      return {
        ...c,
        ...metrics
      };
    });

    // 3. Weather Context (if not supplied in body)
    const activeWeather = weatherContext || await getWeatherContext(userLat, userLng);

    // 4. Mood Filtering & Time-of-day Signals
    let moodEnriched = mergedCandidates;
    if (mood) {
      moodEnriched = applyMoodCriteria(mergedCandidates, mood);
    }

    // 5. Rank Candidates with Recommendation Engine
    const rankedResults = rankRestaurants({
      candidates: moodEnriched,
      userLocation: { lat: userLat, lng: userLng },
      priority,
      budget: Number(budget),
      cuisine,
      tasteProfile,
      weatherContext: activeWeather,
      collaborativeInteractions,
      surpriseMe: Boolean(surpriseMe),
      timeBudgetMinutes,
      companion,
      preferences,
      banditProfile,
      openNowOnly: Boolean(openNowOnly),
      distanceRadiusMeters: distanceRadiusMeters ? Number(distanceRadiusMeters) : null,
      foodProfile,
      filters
    });

    // 6. Assemble "For you right now" Top 3 picks
    let bestMatch = rankedResults[0] || null;

    // Places with unknown travel time (straight-line fallback) can't be "fastest".
    let fastestOrNearest = rankedResults
      .filter(r => r.id !== (bestMatch ? bestMatch.id : null) && Number.isFinite(r.durationSeconds))
      .sort((a, b) => a.durationSeconds - b.durationSeconds)[0] || null;

    let trySomethingNew = rankedResults.find(r => r.isTrySomethingNew && r.id !== (bestMatch ? bestMatch.id : null)) || null;

    // 7. Departure Predictions for Top 3 Picks (+0, +15, +30, +60 min)
    if (featureFlags.enableDeparturePredictions) {
      const picksToPredict = [bestMatch, fastestOrNearest, trySomethingNew].filter(Boolean);
      if (picksToPredict.length > 0) {
        const predictedPicks = await getDeparturePredictions(
          { lat: userLat, lng: userLng },
          picksToPredict
        );
        const predMap = new Map(predictedPicks.map(p => [p.id, p]));
        if (bestMatch && predMap.has(bestMatch.id)) bestMatch = predMap.get(bestMatch.id);
        if (fastestOrNearest && predMap.has(fastestOrNearest.id)) fastestOrNearest = predMap.get(fastestOrNearest.id);
        if (trySomethingNew && predMap.has(trySomethingNew.id)) trySomethingNew = predMap.get(trySomethingNew.id);
      }
    }

    // Summary line for "Why these?"
    const topPickSummary = bestMatch
      ? `Ranked for ${priority} around ${userLat.toFixed(3)}, ${userLng.toFixed(3)} taking into account real-time Dhaka traffic (${bestMatch.trafficLevel} congestion) and transport budget.`
      : 'No recommendations available.';

    // Log anonymized evaluation impression
    logEvalEvent({
      sessionId: anonSessionId(req),
      eventType: 'impression',
      priority,
      chosenCandidateId: null,
      topRankedIds: rankedResults.slice(0, 5).map(r => r.id),
      metadata: { budget, cuisine, companion, timeBudgetMinutes }
    });

    res.json({
      results: rankedResults,
      topPicks: {
        bestMatch,
        fastestOrNearest,
        trySomethingNew,
        summary: topPickSummary,
        counterfactual: bestMatch ? bestMatch.counterfactual : null,
        banditNote: bestMatch ? bestMatch.banditNote : null
      },
      meta: {
        totalFound: rankedResults.length,
        weather: activeWeather,
        priorityUsed: priority,
        timestamp: new Date().toISOString(),
        isBudgetFallback: budgetStatus.isExceeded,
        budgetMessage: budgetStatus.friendlyMessage,
        allergenDisclaimer: preferencesConfig.disclaimer,
        banditActive: Boolean(banditProfile && banditProfile.enabled)
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/routes/compare
 * Compares alternative routes with traffic, polylines, and transport modes
 */
router.post('/routes/compare', async (req, res, next) => {
  try {
    const { origin, destination } = req.body;
    const from = parseCoords(origin?.lat, origin?.lng);
    const to = parseCoords(destination?.lat, destination?.lng);
    if (!from || !to) {
      return res.status(400).json({ error: 'Origin and destination coordinates are required' });
    }

    const comparison = await compareRoutes({ origin: from, destination: to });

    res.json(comparison);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/places/:placeId/details
 * Fetch place details (phone, website, opening hours, photos)
 */
router.get('/places/:placeId/details', async (req, res, next) => {
  try {
    const { placeId } = req.params;
    // Interpolated into the Google URL: reject anything that isn't a plain id (no '/', '..', '?').
    if (!/^[A-Za-z0-9_-]{1,256}$/.test(placeId)) {
      return res.status(400).json({ error: 'Invalid place id' });
    }
    const details = await getPlaceDetails(placeId);
    res.json(details);
  } catch (err) {
    next(err);
  }
});

function sendPlaceholderPhoto(res, seed) {
  // Clean, appetizing SVG illustration for mock / fallback
  const hash = String(seed || 'photo').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const bgColors = ['#1E293B', '#0F172A', '#134E4A', '#312E81', '#701A75', '#7C2D12'];
  const bg = bgColors[hash % bgColors.length];
  const emojis = ['🍜', '🍣', '🍛', '☕', '🍔', '🍢', '🍰', '🍱'];
  const emoji = emojis[hash % emojis.length];

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${bg};stop-opacity:1" />
          <stop offset="100%" style="stop-color:#020617;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="600" height="400" fill="url(#grad)" rx="16"/>
      <circle cx="300" cy="180" r="80" fill="rgba(255,255,255,0.08)"/>
      <text x="300" y="210" font-size="72" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
      <text x="300" y="320" font-size="20" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-weight="600" fill="#94A3B8" text-anchor="middle">Gulshan Dining Experience</text>
    </svg>
  `;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.send(svg);
}

// Google photo resource names look like places/{placeId}/photos/{photoRef}
const GOOGLE_PHOTO_NAME = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

/**
 * GET /api/places/photo
 * Photo proxy endpoint - Streams Google photo without exposing GOOGLE_SERVER_KEY
 */
router.get('/places/photo', async (req, res) => {
  const name = typeof req.query.name === 'string' ? req.query.name : '';
  const width = Math.min(Math.max(parseInt(req.query.maxWidth, 10) || 600, 50), 1600);

  // Anything that isn't a real Google photo name never reaches Google, so the server
  // key can't be attached to a client-shaped URL.
  if (
    !process.env.GOOGLE_SERVER_KEY ||
    process.env.USE_MOCK_DATA === 'true' ||
    !GOOGLE_PHOTO_NAME.test(name) ||
    name.startsWith('places/mock_') ||
    name.startsWith('places/trio_')
  ) {
    return sendPlaceholderPhoto(res, name);
  }

  try {
    quotaManager.checkAndRecordGoogleApiCall('photos');
    const googlePhotoUrl = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${width}`;
    const googleRes = await fetch(googlePhotoUrl, {
      headers: { 'X-Goog-Api-Key': process.env.GOOGLE_SERVER_KEY },
      signal: AbortSignal.timeout(8000)
    });
    const contentType = googleRes.headers.get('content-type') || '';
    if (!googleRes.ok || !contentType.startsWith('image/')) {
      return sendPlaceholderPhoto(res, name);
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buffer = await googleRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    logger.warn({ err: err.message }, 'Photo proxy failed, serving placeholder');
    sendPlaceholderPhoto(res, name);
  }
});

/**
 * GET /api/taste/default
 */
router.get('/taste/default', (req, res) => {
  res.json(getDefaultTasteProfile());
});

/**
 * POST /api/taste/event
 * Stateless calculation of updated profile after an interaction signal
 */
router.post('/taste/event', (req, res) => {
  const { currentProfile, event } = req.body;
  // The pool feeds min/max over every item; cap it so a huge array can't pin the CPU.
  const candidatePool = Array.isArray(req.body.candidatePool) ? req.body.candidatePool.slice(0, 50) : [];
  const updated = recordEvent(currentProfile, event);

  // Link to bandit personal weights if event contains chosen restaurant
  const chosen = event && (event.restaurant || event.chosenCandidate);
  if (chosen && typeof chosen === 'object') {
    updateBanditWeights(deviceKey(req), chosen, candidatePool);

    logEvalEvent({
      sessionId: anonSessionId(req),
      eventType: event.type || 'open',
      priority: event.priority || 'Best Overall',
      chosenCandidateId: chosen.id,
      topRankedIds: candidatePool.length > 0 ? candidatePool.map(c => c?.id) : [chosen.id]
    });
  }

  res.json({ updatedProfile: updated });
});

/**
 * GET /api/bandit/weights (or /api/v1/bandit/weights)
 * Get current learned personal weights, guardrail bounds, and plain language explanation
 */
router.get('/bandit/weights', (req, res) => {
  res.json(getBanditProfile(deviceKey(req)));
});

/**
 * POST /api/bandit/update (or /api/v1/bandit/update)
 * Directly update bandit weights with a chosen candidate
 */
router.post('/bandit/update', (req, res) => {
  const { chosenRestaurant, candidatePool } = req.body;
  if (!chosenRestaurant || typeof chosenRestaurant !== 'object') {
    return res.status(400).json({ error: 'chosenRestaurant is required' });
  }

  const pool = Array.isArray(candidatePool) ? candidatePool.slice(0, 50) : [];
  const updatedProfile = updateBanditWeights(deviceKey(req), chosenRestaurant, pool);
  res.json(updatedProfile);
});

/**
 * POST /api/bandit/reset (or /api/v1/bandit/reset)
 * Reset bandit weights to default baseline
 */
router.post('/bandit/reset', (req, res) => {
  const resetProfile = resetBanditProfile(deviceKey(req));
  res.json({
    success: true,
    message: 'Bandit personal weights reset to baseline.',
    profile: resetProfile
  });
});

/**
 * POST /api/bandit/toggle (or /api/v1/bandit/toggle)
 * Toggle personal weights on or off
 */
router.post('/bandit/toggle', (req, res) => {
  const { enabled } = req.body;
  const profile = setBanditEnabled(deviceKey(req), enabled);
  res.json({
    success: true,
    enabled: profile.enabled,
    profile
  });
});

/**
 * POST /api/feedback
 * Anonymous tester feedback on recommendations
 */
router.post('/feedback', (req, res) => {
  try {
    const { areaName, cuisine, priority, topPickId, answer, reason } = req.body;

    if (!answer || !['Yes', 'No', 'Not sure'].includes(answer)) {
      return res.status(400).json({ error: 'Valid answer (Yes, No, Not sure) is required' });
    }

    const record = {
      timestamp: new Date().toISOString(),
      areaName: typeof areaName === 'string' ? areaName.slice(0, 80) : 'Gulshan / Banani',
      cuisine: typeof cuisine === 'string' ? cuisine.slice(0, 40) : 'All',
      priority: typeof priority === 'string' ? priority.slice(0, 40) : 'Best Overall',
      topPickId: typeof topPickId === 'string' ? topPickId.slice(0, 256) : null,
      answer,
      reason: typeof reason === 'string' ? reason.slice(0, 300) : ''
    };

    appendJsonl('feedback.jsonl', record);

    res.json({ success: true, message: 'Thank you for your feedback!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record feedback' });
  }
});

/**
 * POST /api/meal-time/search (or /api/v1/meal-time/search)
 * Time-aware dining recommendations constrained by total available trip time
 */
router.post('/meal-time/search', async (req, res) => {
  if (!featureFlags.mealTimeMode) {
    return res.status(403).json({
      error: 'Meal-Time Mode feature is currently disabled.',
      flag: 'mealTimeMode'
    });
  }

  try {
    const {
      mode = 'lunch',
      availableMinutes = 45,
      leaveAt = null,
      origin,
      destination = 'same-as-origin',
      transport = 'car',
      diningStyle = 'dine_in',
      bufferPreference = 'Balanced',
      filters = {},
      tasteProfile = null
    } = req.body;

    // Validate transport mode
    if (transport === 'public_transport') {
      // In Dhaka, Routes API does not reliably return scheduled transit GTFS data for local buses
      return res.status(400).json({
        error: "Public transport times aren't available here. We suggest rickshaw or CNG auto.",
        suggestedTransport: ['rickshaw', 'cng']
      });
    }

    // Input validations
    const validModes = ['breakfast', 'lunch', 'snacks', 'dinner'];
    if (typeof mode !== 'string' || !validModes.includes(mode.toLowerCase())) {
      return res.status(400).json({ error: `Invalid mode. Must be one of: ${validModes.join(', ')}` });
    }

    const availNum = Number(availableMinutes);
    if (isNaN(availNum) || availNum < 15 || availNum > 360) {
      return res.status(400).json({ error: 'availableMinutes must be a number between 15 and 360' });
    }

    const validBuffers = ['Balanced', 'Safe', 'Flexible'];
    if (bufferPreference && !validBuffers.includes(bufferPreference)) {
      return res.status(400).json({ error: `bufferPreference must be one of: ${validBuffers.join(', ')}` });
    }

    if (leaveAt !== null && leaveAt !== undefined && Number.isNaN(new Date(leaveAt).getTime())) {
      return res.status(400).json({ error: 'leaveAt must be a valid ISO date-time' });
    }

    // Resolve origin
    let originCoords = { lat: 23.7785, lng: 90.4178, name: 'Gulshan 1' };
    if (origin) {
      if (typeof origin === 'object') {
        const c = parseCoords(origin.lat, origin.lng);
        if (!c) return res.status(400).json({ error: 'origin must have valid lat and lng' });
        originCoords = { ...c, name: typeof origin.name === 'string' ? origin.name : 'Custom Origin' };
      } else if (typeof origin === 'string' && PRESET_LOCATIONS[origin]) {
        originCoords = PRESET_LOCATIONS[origin];
      }
    }

    let destinationResolved = destination;
    if (destination && typeof destination === 'object') {
      const c = parseCoords(destination.lat, destination.lng);
      if (!c) return res.status(400).json({ error: 'destination must have valid lat and lng' });
      destinationResolved = { ...c, name: typeof destination.name === 'string' ? destination.name : 'Destination' };
    }

    const searchResult = await searchMealTime({
      mode: mode.toLowerCase(),
      availableMinutes: availNum,
      leaveAt,
      origin: originCoords,
      destination: destinationResolved,
      transport,
      diningStyle,
      bufferPreference,
      filters,
      tasteProfile
    });

    res.json(searchResult);
  } catch (err) {
    logger.error({ err }, 'Error in /meal-time/search');
    res.status(500).json({ error: 'Internal error in meal-time recommendation engine' });
  }
});

/**
 * POST /api/meal-time/feedback (or /api/v1/meal-time/feedback)
 * Anonymous meal-time completion feedback for tuning wait & eat benchmarks
 */
router.post('/meal-time/feedback', (req, res) => {
  try {
    const { mode, venueType, plannedMinutes, actualMinutes, wasLate, rating } = req.body;

    if (typeof mode !== 'string' || typeof actualMinutes !== 'number' || !Number.isFinite(actualMinutes)) {
      return res.status(400).json({ error: 'mode and actualMinutes are required' });
    }

    const record = {
      timestamp: new Date().toISOString(),
      mode: mode.slice(0, 20),
      venueType: typeof venueType === 'string' ? venueType.slice(0, 40) : 'quick-service',
      plannedMinutes: Number(plannedMinutes) || null,
      actualMinutes: Number(actualMinutes),
      wasLate: Boolean(wasLate),
      rating: Number(rating) || null
    };

    appendJsonl('mealtime-feedback.jsonl', record);

    res.json({ success: true, message: 'Meal-time feedback recorded successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record meal-time feedback' });
  }
});

const APK_METADATA_FILE = path.join(__dirname, '..', 'data', 'apk-metadata.json');

export function loadApkMetadata() {
  try {
    if (fs.existsSync(APK_METADATA_FILE)) {
      return JSON.parse(fs.readFileSync(APK_METADATA_FILE, 'utf8'));
    }
  } catch (err) {
    logger.warn({ err }, 'Failed reading apk-metadata.json; falling back to dynamic default');
  }
  return {
    appName: 'KHABO KOTHAY?',
    appNameBn: 'খাবো কোথায়?',
    version: pkg.version || '1.1.0',
    apkSize: '64.98 MB',
    apkSizeBytes: 68135777,
    sha256: 'E5E8D00B8DA110EC7390A57315C76DA1AFD1C8C9B1FC5E54178272CA17D31353',
    packageId: 'com.khabokothay.app',
    googleDriveFolderUrl: 'https://drive.google.com/drive/folders/1IqB-z_mpcQlKE4fgXzq5ZukaP2k9QTnu',
    directDownloadUrl: '/downloads/khabo-kothay-latest.apk',
    qrDownloadUrl: '/downloads/khabo-kothay-qr.png',
    qrDriveUrl: '/downloads/khabo-kothay-drive-qr.png',
    minAndroidVersion: 'Android 8.0+ (Oreo)',
    targetSdk: 'Android 14 (API 34)'
  };
}

export const APK_METADATA = new Proxy({}, {
  get(target, prop) {
    const meta = loadApkMetadata();
    return meta[prop];
  },
  has(target, prop) {
    const meta = loadApkMetadata();
    return prop in meta;
  },
  ownKeys() {
    const meta = loadApkMetadata();
    return Reflect.ownKeys(meta);
  },
  getOwnPropertyDescriptor(target, prop) {
    const meta = loadApkMetadata();
    return Reflect.getOwnPropertyDescriptor(meta, prop);
  }
});

/**
 * GET /api/download-info (or /api/apk/meta)
 * Returns APK version, size, checksums, and hosting links dynamically generated from release data
 */
router.get(['/download-info', '/apk/meta'], (req, res) => {
  res.json(loadApkMetadata());
});

/**
 * GET /api/qr
 * Query: url (string), format ('png'|'svg'|'dataurl'), size (number)
 * Generates and returns rendered QR code
 */
router.get('/qr', async (req, res) => {
  try {
    const rawUrl = req.query.url || `${req.protocol}://${req.get('host')}/download`;
    const format = (req.query.format || req.query.type || 'svg').toLowerCase();
    const size = Math.min(Math.max(parseInt(req.query.size, 10) || 512, 128), 2048);

    if (format === 'png') {
      const buf = await QRCode.toBuffer(rawUrl, {
        width: size,
        margin: 2,
        color: { dark: '#171717', light: '#FFFFFF' }
      });
      res.setHeader('Content-Type', 'image/png');
      return res.send(buf);
    }

    if (format === 'dataurl') {
      const dataUrl = await QRCode.toDataURL(rawUrl, {
        width: size,
        margin: 2,
        color: { dark: '#171717', light: '#FFFFFF' }
      });
      return res.json({ dataUrl, url: rawUrl });
    }

    // Default SVG format
    const svgStr = await QRCode.toString(rawUrl, {
      type: 'svg',
      width: size,
      margin: 2,
      color: { dark: '#171717', light: '#FFFFFF' }
    });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(svgStr);
  } catch (err) {
    logger.error({ err }, 'Error generating dynamic QR code');
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

function appendJsonl(fileName, record) {
  const file = dataFile(fileName);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(record) + '\n', 'utf8');
}


// ==========================================
// F1 & F14: App Version, Releases & Feature Flags
// ==========================================

router.get('/app/version', (req, res) => {
  const channel = req.headers['x-app-channel'] || req.query.channel || 'stable';
  const latest = getLatestRelease(channel);
  if (!latest) {
    return res.status(404).json({ error: { code: 'NO_RELEASE_FOUND', message: 'No published release found for this channel' } });
  }
  res.json(latest);
});

router.get('/app/releases', (req, res) => {
  const channel = req.headers['x-app-channel'] || req.query.channel || 'stable';
  const releases = getPublishedReleases(channel);
  res.json({ releases });
});

router.get('/app/feature-flags', (req, res) => {
  const installId = req.headers['x-install-id'] || req.query.installId || 'anonymous';
  const versionCode = req.headers['x-app-version-code'] || req.query.versionCode || 0;
  const channel = req.headers['x-app-channel'] || req.query.channel || 'stable';

  const result = evaluateFlags({ installId, versionCode, channel });

  const clientEtag = req.headers['if-none-match'];
  if (clientEtag && clientEtag === result.etag) {
    return res.status(304).end();
  }

  res.setHeader('ETag', result.etag);
  res.setHeader('Cache-Control', 'public, max-age=21600');
  res.json(result);
});

router.get('/admin/feature-flags', requireAdmin, (req, res) => {
  res.json(getAllFlags());
});

router.patch('/admin/feature-flags/:key', requireAdmin, (req, res) => {
  try {
    const updated = updateFlag(req.params.key, req.body, {
      who: req.headers['x-admin-who'] || 'admin',
      ip: req.ip,
      requestId: req.id
    });
    res.json({ success: true, flag: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/admin/releases', requireAdmin, (req, res) => {
  res.json(getAllReleases());
});

router.post('/admin/releases', requireAdmin, (req, res) => {
  try {
    const draft = createReleaseDraft(req.body, {
      who: req.headers['x-admin-who'] || 'admin',
      ip: req.ip,
      requestId: req.id
    });
    res.status(201).json({ success: true, release: draft });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/admin/releases/:id/publish', requireAdmin, (req, res) => {
  try {
    const published = publishRelease(req.params.id, {
      who: req.headers['x-admin-who'] || 'admin',
      ip: req.ip,
      requestId: req.id
    });
    res.json({ success: true, release: published });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/admin/releases/:id/withdraw', requireAdmin, (req, res) => {
  try {
    const withdrawn = withdrawRelease(req.params.id, {
      who: req.headers['x-admin-who'] || 'admin',
      ip: req.ip,
      requestId: req.id
    });
    res.json({ success: true, release: withdrawn });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/admin/audit-logs', requireAdmin, (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const logs = getAuditLogs({
    limit,
    action: req.query.action || null,
    target: req.query.target || null
  });
  res.json({ logs });
});


// ==========================================
// F15: Opt-In Diagnostics & Problem Reports
// ==========================================

router.post('/diagnostics/consent', (req, res) => {
  try {
    const installId = req.headers['x-install-id'] || req.body.installId || 'anonymous';
    const result = recordConsent({
      installId,
      consentType: req.body.consentType || 'crash_reporting',
      granted: req.body.granted,
      textVersion: req.body.textVersion || '1.0',
      timestamp: req.body.timestamp,
      ip: req.ip
    });
    res.json({ success: true, consent: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/diagnostics/crash-reports', (req, res) => {
  try {
    const report = recordCrashReport({
      errorCategory: req.body.errorCategory,
      message: req.body.message,
      stackTrace: req.body.stackTrace,
      appVersion: req.headers['x-app-version-name'] || req.body.appVersion || '4.0.0',
      versionCode: req.headers['x-app-version-code'] || req.body.versionCode || 3,
      deviceMeta: req.body.deviceMeta || {},
      requestId: req.headers['x-request-id'] || req.body.requestId || null
    });
    res.status(201).json({ success: true, reportId: report.id, fingerprint: report.fingerprint });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/diagnostics/problem-reports', (req, res) => {
  try {
    if (!req.body.description || req.body.description.trim().length === 0) {
      return res.status(400).json({ error: 'Problem description is required' });
    }
    const report = recordProblemReport({
      category: req.body.category || 'GENERAL',
      description: req.body.description,
      appVersion: req.headers['x-app-version-name'] || req.body.appVersion || '4.0.0',
      versionCode: req.headers['x-app-version-code'] || req.body.versionCode || 3,
      requestId: req.headers['x-request-id'] || req.body.requestId || null,
      screenshotBase64: req.body.screenshotBase64 || null
    });
    res.status(201).json({
      success: true,
      referenceNumber: report.referenceNumber,
      message: 'Problem report recorded successfully'
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/admin/diagnostics', requireAdmin, (req, res) => {
  res.json(getDiagnosticsOverview());
});


// ==========================================
// F3: Ask In Your Own Words (Natural Search)
// ==========================================

/**
 * POST /api/search/interpret
 * Parses natural language query into structured, editable criteria
 */
router.post('/search/interpret', (req, res) => {
  const { query } = req.body || {};
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  const result = parseNaturalQuery(query);
  res.json(result);
});

/**
 * POST /api/search/confirm
 * Executes search using user-reviewed/edited criteria via existing ranking engine
 */
router.post('/search/confirm', async (req, res, next) => {
  try {
    const { criteria, lat, lng } = req.body || {};
    if (!criteria) {
      return res.status(400).json({ error: 'Confirmed criteria is required' });
    }

    // Default to Dhaka center coordinates if user has not shared GPS
    // (Gulshan-2: 23.7925, 90.4078)
    const searchLat = Number(lat) || 23.7925;
    const searchLng = Number(lng) || 90.4078;

    // Map extracted criteria into existing rankRestaurants schema
    const options = {
      cuisine: criteria.cuisine || undefined,
      maxPrice: criteria.budget?.amount || undefined,
      partySize: criteria.partySize || 1,
      mealTime: criteria.mealTime || undefined
    };

    const results = await rankRestaurants({
      lat: searchLat,
      lng: searchLng,
      options
    });

    res.json({
      success: true,
      appliedCriteria: criteria,
      resultsCount: results?.candidates?.length || 0,
      candidates: results?.candidates || [],
      topPicks: results?.topPicks || []
    });
  } catch (err) {
    next(err);
  }
});


// ==========================================
// F2: Fare Check & Estimation Service
// ==========================================

router.post('/fare-estimates', (req, res) => {
  try {
    const { origin, destination, transportType, distanceKm, quoteBdt } = req.body || {};
    const estimate = estimateFareRange({ origin, destination, transportType, distanceKm });

    let comparison = null;
    if (quoteBdt !== undefined && quoteBdt !== null) {
      comparison = compareFareQuote({ quoteBdt, estimate });
    }

    res.json({
      estimate,
      comparison
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/fare-reports', (req, res) => {
  try {
    const report = addFareReport(req.body, { ip: req.ip, requestId: req.id });
    res.status(201).json({
      success: true,
      report,
      message: 'Fare report received and queued for community moderation'
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/fare-reports', requireAdmin, (req, res) => {
  const reports = loadFareReports();
  res.json({ reports });
});


// ==========================================
// F4 & F6: Group Mode & Community Dish Prices
// ==========================================

router.post('/groups', (req, res) => {
  try {
    const clientIp = req.ip || req.socket?.remoteAddress;
    const result = createGroupSession({ ...req.body, clientIp });
    res.status(201).json({
      success: true,
      session: result.session,
      hostKey: result.hostKey,
      participantId: result.participantId,
      participantSecret: result.participantSecret
    });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.get('/groups/:token', (req, res) => {
  const session = getGroupSession(req.params.token);
  if (!session) {
    return res.status(404).json({ error: 'Group session not found or expired' });
  }
  res.json({ session });
});

router.post('/groups/:token/join', (req, res) => {
  try {
    const result = joinGroupSession(req.params.token, req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.post('/groups/:token/votes', (req, res) => {
  try {
    const result = castVote(req.params.token, req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.post('/groups/:token/close', (req, res) => {
  try {
    const result = closeGroupSession(req.params.token, req.body);
    res.json({ success: true, session: result });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.post('/dish-price-reports', (req, res) => {
  try {
    const report = addDishPriceReport(req.body);
    res.status(201).json({ success: true, report });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/dish-prices', (req, res) => {
  const result = getDishPrices(req.query);
  res.json(result);
});

export default router;
