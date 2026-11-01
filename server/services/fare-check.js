import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';
import { recordAuditLog } from './audit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FARES_DATA_FILE = path.join(__dirname, '..', 'data', 'fare-reports.json');
const BOOTSTRAP_CSV = path.join(__dirname, '..', '..', 'docs', 'fare-log.csv');

// Distance Band Definitions
export const DISTANCE_BANDS = [
  { id: 'short', maxKm: 1.5, label: 'Under 1.5 km' },
  { id: 'medium', maxKm: 3.5, label: '1.5 - 3.5 km' },
  { id: 'medium_long', maxKm: 7.0, label: '3.5 - 7.0 km' },
  { id: 'long', maxKm: 999.0, label: 'Above 7.0 km' }
];

export function getDistanceBand(distanceKm) {
  const km = Number(distanceKm) || 0;
  for (const band of DISTANCE_BANDS) {
    if (km <= band.maxKm) return band.id;
  }
  return 'long';
}

/**
 * Load fare reports from JSON or bootstrap from docs/fare-log.csv
 */
export function loadFareReports() {
  try {
    if (fs.existsSync(FARES_DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(FARES_DATA_FILE, 'utf8'));
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (err) {
    logger.error({ err }, 'Failed reading fare-reports.json; bootstrapping from CSV');
  }

  // Bootstrap from fare-log.csv
  const bootstrapped = [];
  try {
    if (fs.existsSync(BOOTSTRAP_CSV)) {
      const lines = fs.readFileSync(BOOTSTRAP_CSV, 'utf8').trim().split('\n');
      // date,mode,from_area,to_area,distance_km,minutes,traffic,fare_paid_bdt
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(s => s.trim());
        if (parts.length >= 8) {
          const [date, mode, fromArea, toArea, dist, mins, traffic, fare] = parts;
          if (mode === 'rickshaw' || mode === 'cng') {
            bootstrapped.push({
              id: `fare-boot-${i}`,
              origin: fromArea,
              destination: toArea,
              transportType: mode,
              fareBdt: Number(fare),
              distanceKm: Number(dist),
              durationMinutes: Number(mins),
              traffic: traffic,
              isQuoted: false,
              source: 'admin-collected',
              timestamp: new Date(date).toISOString(),
              reportedAt: new Date(date).toISOString(),
              status: 'verified'
            });
          }
        }
      }
    }
  } catch (err) {
    logger.error({ err }, 'Failed bootstrapping fare data from CSV');
  }

  saveFareReports(bootstrapped);
  return bootstrapped;
}

export function saveFareReports(reports) {
  try {
    const dir = path.dirname(FARES_DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FARES_DATA_FILE, JSON.stringify(reports, null, 2), 'utf8');
  } catch (err) {
    logger.error({ err }, 'Failed saving fare reports');
  }
}

/**
 * Robust median and percentile calculation with age weighting
 */
export function calculateWeightedFares(reports) {
  if (!reports || reports.length === 0) return null;

  const now = Date.now();
  const halfLifeMs = 30 * 24 * 60 * 60 * 1000; // 30 days half-life

  // 1. Calculate weights and collect fares
  const weighted = reports.map(r => {
    const ageMs = Math.max(0, now - new Date(r.timestamp || r.reportedAt).getTime());
    const weight = Math.pow(0.5, ageMs / halfLifeMs);
    return { fare: r.fareBdt, weight };
  }).sort((a, b) => a.fare - b.fare);

  if (weighted.length === 0) return null;

  // 2. Outlier trimming via median and Median Absolute Deviation (MAD)
  const fares = weighted.map(w => w.fare);
  const median = fares[Math.floor(fares.length / 2)];
  const absDevs = fares.map(f => Math.abs(f - median)).sort((a, b) => a - b);
  const mad = absDevs[Math.floor(absDevs.length / 2)] || 1;

  // Filter out values beyond 2.5 MAD from median (unless sample too small)
  const filtered = fares.length >= 6
    ? weighted.filter(w => Math.abs(w.fare - median) <= Math.max(2.5 * mad, 15))
    : weighted;

  if (filtered.length === 0) return null;

  // 3. Compute weighted percentiles
  const totalWeight = filtered.reduce((sum, item) => sum + item.weight, 0);
  let cumulative = 0;
  let p25 = filtered[0].fare;
  let p50 = median;
  let p75 = filtered[filtered.length - 1].fare;

  for (const item of filtered) {
    cumulative += item.weight;
    const ratio = cumulative / totalWeight;
    if (ratio >= 0.25 && p25 === filtered[0].fare) p25 = item.fare;
    if (ratio >= 0.50 && p50 === median) p50 = item.fare;
    if (ratio >= 0.75) {
      p75 = item.fare;
      break;
    }
  }

  return {
    lowerBound: Math.round(p25),
    median: Math.round(p50),
    upperBound: Math.round(Math.max(p75, p25 + 5)),
    sampleCount: filtered.length
  };
}

/**
 * Estimate Reference Range for a journey
 */
export function estimateFareRange({ origin, destination, transportType, distanceKm }) {
  const mode = (transportType || 'rickshaw').toLowerCase();
  const dist = Number(distanceKm) || 1.5;
  const band = getDistanceBand(dist);
  const reports = loadFareReports().filter(r => r.transportType === mode);

  let candidatePool = [];
  let fallbackLevel = 4;
  let levelReason = '';

  // Level 1: Same area pair + mode
  if (origin && destination) {
    const origLower = origin.toLowerCase();
    const destLower = destination.toLowerCase();
    const level1 = reports.filter(r =>
      (r.origin.toLowerCase().includes(origLower) && r.destination.toLowerCase().includes(destLower)) ||
      (r.origin.toLowerCase().includes(destLower) && r.destination.toLowerCase().includes(origLower))
    );
    if (level1.length >= 2) {
      candidatePool = level1;
      fallbackLevel = 1;
      levelReason = `Based on ${level1.length} reports for trips between ${origin} and ${destination}`;
    }
  }

  // Level 2: Same distance band + mode
  if (candidatePool.length === 0) {
    const level2 = reports.filter(r => getDistanceBand(r.distanceKm) === band);
    if (level2.length >= 2) {
      candidatePool = level2;
      fallbackLevel = 2;
      levelReason = `Based on ${level2.length} reports for similar ${mode} distances (${dist} km)`;
    }
  }

  // Level 3: All reports for this mode
  if (candidatePool.length === 0 && reports.length >= 2) {
    candidatePool = reports;
    fallbackLevel = 3;
    levelReason = `Based on ${reports.length} general ${mode} reports in Dhaka`;
  }

  // Level 4: Insufficient data
  if (candidatePool.length === 0) {
    return {
      hasEstimate: false,
      message: 'Not enough local fare data to estimate this journey reliably.',
      fallbackLevel: 4
    };
  }

  const stats = calculateWeightedFares(candidatePool);
  if (!stats) {
    return {
      hasEstimate: false,
      message: 'Not enough local fare data to estimate this journey reliably.',
      fallbackLevel: 4
    };
  }

  const quality = stats.sampleCount >= 8 ? 'Good' : stats.sampleCount >= 4 ? 'Medium' : 'Low';

  return {
    hasEstimate: true,
    transportType: mode,
    estimatedLowerBound: stats.lowerBound,
    estimatedMedian: stats.median,
    estimatedUpperBound: stats.upperBound,
    distanceKm: dist,
    dataQuality: quality,
    explanation: levelReason,
    disclaimer: 'This is an estimated reference range and may be incomplete.',
    timestamp: new Date().toISOString()
  };
}

/**
 * Compare user quote with reference range
 */
export function compareFareQuote({ quoteBdt, estimate }) {
  if (!estimate || !estimate.hasEstimate) {
    return {
      comparison: 'UNKNOWN',
      message: 'Not enough local fare data to estimate this journey reliably.'
    };
  }

  const quote = Number(quoteBdt);
  const { estimatedLowerBound, estimatedUpperBound } = estimate;

  if (quote < estimatedLowerBound) {
    return {
      comparison: 'BELOW_RANGE',
      difference: estimatedLowerBound - quote,
      message: 'Your quote is below the estimated reference range. This is an estimate and may be incomplete.'
    };
  }
  if (quote > estimatedUpperBound) {
    return {
      comparison: 'ABOVE_RANGE',
      difference: quote - estimatedUpperBound,
      message: 'Your quote is above the estimated reference range. This is an estimate and may be incomplete.'
    };
  }
  return {
    comparison: 'WITHIN_RANGE',
    difference: 0,
    message: 'Your quote falls within the estimated reference range. This is an estimate and may be incomplete.'
  };
}

/**
 * Submit community fare report
 */
export function addFareReport(data, { ip = 'unknown', requestId = null } = {}) {
  const mode = (data.transportType || '').toLowerCase();
  if (mode !== 'rickshaw' && mode !== 'cng') {
    throw new Error('Invalid transportType: must be rickshaw or cng');
  }

  const fare = Number(data.fareBdt);
  if (!fare || fare < 10 || fare > 2000) {
    throw new Error('Fare must be between 10 and 2000 BDT');
  }

  if (!data.origin || typeof data.origin !== 'string' || data.origin.trim().length === 0 || data.origin.length > 60) {
    throw new Error('Origin is required and must be <= 60 characters');
  }
  if (!data.destination || typeof data.destination !== 'string' || data.destination.trim().length === 0 || data.destination.length > 60) {
    throw new Error('Destination is required and must be <= 60 characters');
  }

  const reports = loadFareReports();

  // Deduplication check: same origin, destination, mode, fare within last 10 minutes
  const tenMinsAgo = Date.now() - 10 * 60 * 1000;
  const isDuplicate = reports.some(r =>
    r.origin.toLowerCase() === data.origin.toLowerCase() &&
    r.destination.toLowerCase() === data.destination.toLowerCase() &&
    r.transportType === mode &&
    r.fareBdt === fare &&
    new Date(r.timestamp).getTime() > tenMinsAgo
  );

  if (isDuplicate) {
    throw new Error('Duplicate report detected within recent window');
  }

  const newReport = {
    id: `fare-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    origin: data.origin,
    destination: data.destination,
    transportType: mode,
    fareBdt: fare,
    distanceKm: Number(data.distanceKm) || 1.5,
    isQuoted: Boolean(data.isQuoted),
    note: data.note ? String(data.note).substring(0, 200) : null,
    source: 'community-reported',
    timestamp: new Date().toISOString(),
    status: 'pending_moderation'
  };

  reports.push(newReport);
  saveFareReports(reports);

  return newReport;
}

export default {
  DISTANCE_BANDS,
  getDistanceBand,
  loadFareReports,
  saveFareReports,
  calculateWeightedFares,
  estimateFareRange,
  compareFareQuote,
  addFareReport
};
