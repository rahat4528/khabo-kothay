import banditConfig from '../config/bandit.json' with { type: 'json' };
import featureFlags from '../config/featureFlags.js';
import redisStore from './redis-store.js';

// In-memory store for device/user bandit state. Keys come from client headers/IPs,
// so the map is capped: Map keeps insertion order, and get/set re-inserts to keep
// recently used profiles at the end.
// ponytail: in-memory LRU, profiles reset on restart; move to Redis if they must persist.
const MAX_PROFILES = 5000;
const banditProfiles = new Map();

function storeProfile(deviceId, profile) {
  banditProfiles.delete(deviceId);
  banditProfiles.set(deviceId, profile);
  if (banditProfiles.size > MAX_PROFILES) {
    banditProfiles.delete(banditProfiles.keys().next().value);
  }
  if (redisStore.isConfigured()) {
    redisStore.set('bandit_profile:' + deviceId, profile, 30 * 86400).catch?.(() => {});
  }
  return profile;
}

/**
 * Normalizes an object of weights so they sum to 1.0 while strictly respecting [min, max] bounds
 */
export function projectWeightsToSimplexBounds(weights, minBound = 0.05, maxBound = 0.50) {
  const keys = Object.keys(weights);
  const n = keys.length;
  
  // Ensure each weight is initially clamped
  const clamped = {};
  for (const k of keys) {
    clamped[k] = Math.max(minBound, Math.min(maxBound, Number(weights[k]) || minBound));
  }

  // Iterative projection onto simplex with box constraints
  let iterations = 0;
  while (iterations < 20) {
    const sum = Object.values(clamped).reduce((acc, v) => acc + v, 0);
    const diff = 1.0 - sum;
    if (Math.abs(diff) < 1e-6) break;

    // Find adjustable keys
    const adjustableKeys = keys.filter(k => {
      if (diff > 0) return clamped[k] < maxBound - 1e-5;
      if (diff < 0) return clamped[k] > minBound + 1e-5;
      return false;
    });

    if (adjustableKeys.length === 0) break;

    const delta = diff / adjustableKeys.length;
    for (const k of adjustableKeys) {
      clamped[k] = Math.max(minBound, Math.min(maxBound, clamped[k] + delta));
    }
    iterations++;
  }

  // Round values cleanly to 4 decimal places while ensuring exact sum = 1.0
  const result = {};
  let roundedSum = 0;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    result[k] = Number(clamped[k].toFixed(4));
    roundedSum += result[k];
  }
  const lastKey = keys[keys.length - 1];
  result[lastKey] = Number((1.0 - roundedSum).toFixed(4));
  // Guarantee last key is also within bounds
  result[lastKey] = Math.max(minBound, Math.min(maxBound, result[lastKey]));

  return result;
}

/**
 * Generates a human-friendly note describing the user's learned preference
 */
export function generateBanditExplanation(currentWeights, defaultWeights = banditConfig.defaultWeights) {
  let maxPositiveDelta = 0;
  let dominantKey = null;

  for (const [key, weight] of Object.entries(currentWeights)) {
    const baseline = defaultWeights[key] || 0.10;
    const delta = weight - baseline;
    if (delta > maxPositiveDelta) {
      maxPositiveDelta = delta;
      dominantKey = key;
    }
  }

  if (dominantKey && maxPositiveDelta >= 0.03) {
    return banditConfig.plainLanguageNotes[dominantKey] ||
      `You often prefer ${dominantKey}-focused options, so that counts a bit more for you now.`;
  }

  return banditConfig.plainLanguageNotes.balanced;
}

/**
 * Get or create bandit profile for a device
 */
export function getBanditProfile(deviceId = 'default') {
  const existing = banditProfiles.get(deviceId);
  if (existing) return storeProfile(deviceId, existing);
  return storeProfile(deviceId, {
    deviceId,
    enabled: true,
    weights: { ...banditConfig.defaultWeights },
    updateCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

/**
 * Reset bandit profile to initial configuration
 */
export function resetBanditProfile(deviceId = 'default') {
  const profile = {
    deviceId,
    enabled: true,
    weights: { ...banditConfig.defaultWeights },
    updateCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  return storeProfile(deviceId, profile);
}

/**
 * Set bandit enabled/disabled switch
 */
export function setBanditEnabled(deviceId = 'default', enabled = true) {
  const profile = getBanditProfile(deviceId);
  profile.enabled = Boolean(enabled);
  profile.updatedAt = new Date().toISOString();
  return profile;
}

/**
 * Update personal weights when user selects a restaurant
 * @param {string} deviceId
 * @param {Object} chosenRestaurant - Selected candidate
 * @param {Array} candidateSet - Candidate pool from which it was chosen
 * @returns {Object} Updated profile
 */
export function updateBanditWeights(deviceId, chosenRestaurant, candidateSet = []) {
  if (!featureFlags.enableBanditPersonalWeights) {
    return getBanditProfile(deviceId);
  }

  const profile = getBanditProfile(deviceId);
  if (!profile.enabled) {
    return profile;
  }

  const learningRate = banditConfig.learningRate || 0.05;
  const currentWeights = { ...profile.weights };

  // Calculate relative strengths of chosen restaurant in the candidate set
  const signals = {
    time: 0,
    cost: 0,
    price: 0,
    rating: 0,
    distance: 0,
    traffic: 0,
    taste: 0
  };

  if (candidateSet.length > 1) {
    const durations = candidateSet.map(c => c.durationSeconds || 900);
    const costs = candidateSet.map(c => c.transport?.cheapestEstimatedCostBdt || 50);
    const prices = candidateSet.map(c => c.priceLevel || 2);
    const ratings = candidateSet.map(c => c.rating || 4.0);
    const distances = candidateSet.map(c => c.distanceMeters || 1500);

    const minDur = Math.min(...durations);
    const maxDur = Math.max(...durations);
    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const minRating = Math.min(...ratings);
    const maxRating = Math.max(...ratings);
    const minDist = Math.min(...distances);
    const maxDist = Math.max(...distances);

    const chosenDur = chosenRestaurant.durationSeconds || 900;
    const chosenCost = chosenRestaurant.transport?.cheapestEstimatedCostBdt || 50;
    const chosenPrice = chosenRestaurant.priceLevel || 2;
    const chosenRating = chosenRestaurant.rating || 4.0;
    const chosenDist = chosenRestaurant.distanceMeters || 1500;

    // Relative scoring: 1.0 if best, 0.0 if worst
    signals.time = maxDur > minDur ? (maxDur - chosenDur) / (maxDur - minDur) : 0.5;
    signals.cost = maxCost > minCost ? (maxCost - chosenCost) / (maxCost - minCost) : 0.5;
    signals.price = maxPrice > minPrice ? (maxPrice - chosenPrice) / (maxPrice - minPrice) : 0.5;
    signals.rating = maxRating > minRating ? (chosenRating - minRating) / (maxRating - minRating) : 0.5;
    signals.distance = maxDist > minDist ? (maxDist - chosenDist) / (maxDist - minDist) : 0.5;
    signals.traffic = chosenRestaurant.trafficLevel === 'Low' ? 1.0 : chosenRestaurant.trafficLevel === 'Moderate' ? 0.5 : 0.1;
    signals.taste = (chosenRestaurant.factorBreakdown?.taste || 50) / 100;
  } else {
    // If no context pool, infer from absolute characteristics
    signals.time = chosenRestaurant.durationSeconds < 900 ? 0.8 : 0.3;
    signals.cost = (chosenRestaurant.transport?.cheapestEstimatedCostBdt || 50) < 60 ? 0.8 : 0.3;
    signals.rating = (chosenRestaurant.rating || 4.0) >= 4.3 ? 0.8 : 0.4;
    signals.distance = (chosenRestaurant.distanceMeters || 1500) < 1500 ? 0.8 : 0.3;
    signals.price = (chosenRestaurant.priceLevel || 2) <= 1 ? 0.8 : 0.3;
  }

  // Adjust weights using stochastic gradient step with exploration epsilon
  const minBound = banditConfig.bounds.min || 0.05;
  const maxBound = banditConfig.bounds.max || 0.50;

  for (const factor of Object.keys(currentWeights)) {
    const signal = signals[factor] ?? 0.5;
    // Step: if signal > 0.6 increase, if signal < 0.4 decrease
    const step = (signal - 0.5) * learningRate;
    currentWeights[factor] = Math.max(minBound, Math.min(maxBound, currentWeights[factor] + step));
  }

  // Project strictly onto bounded simplex
  const projected = projectWeightsToSimplexBounds(currentWeights, minBound, maxBound);

  profile.weights = projected;
  profile.updateCount += 1;
  profile.updatedAt = new Date().toISOString();
  profile.explanationNote = generateBanditExplanation(projected);

  return storeProfile(deviceId, profile);
}

export default {
  projectWeightsToSimplexBounds,
  generateBanditExplanation,
  getBanditProfile,
  resetBanditProfile,
  setBanditEnabled,
  updateBanditWeights
};
