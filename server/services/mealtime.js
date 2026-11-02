import { globalCache, getCoarseGrid } from './cache.js';
import featureFlags from '../config/featureFlags.js';
import quotaManager from '../services/quota.js';
import mealTimeConfig from '../../config/mealtime.json' with { type: 'json' };
import mealKeywordsConfig from '../../config/meal-keywords.json' with { type: 'json' };
import thresholdsConfig from '../config/thresholds.json' with { type: 'json' };
import { PRESET_LOCATIONS, MOCK_RESTAURANTS, getMockCandidates } from './mock.js';
import { determineTrafficLevel, computeTravelTimes } from './routes.js';
import { getDhakaTrafficMultiplier } from './predictions.js';
import logger from './logger.js';

/**
 * Returns current date and hour parsed in Asia/Dhaka time zone (UTC+6)
 */
export function getDhakaTimeParts(inputDate = new Date()) {
  const date = new Date(inputDate);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    hour12: false,
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short'
  });
  const parts = formatter.formatToParts(date);
  const hours = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10) % 24;
  const minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const fractionalHour = hours + (minutes / 60);

  return {
    date,
    hour: fractionalHour,
    hours,
    minutes
  };
}

/**
 * Preselects Meal Mode based on Asia/Dhaka time of day:
 * - before 10:30: Breakfast
 * - 11:30 - 15:00: Lunch (10:30-11:30 maps smoothly to Lunch)
 * - 16:00 - 19:00: Snacks (15:00-16:00 maps smoothly to Snacks)
 * - from 19:00: Dinner (late night until 06:00 maps to Dinner/Late Night)
 */
export function getCurrentMealMode(inputDate = new Date()) {
  const { hour } = getDhakaTimeParts(inputDate);

  if (hour >= 6.0 && hour < 10.5) {
    return 'breakfast';
  } else if (hour >= 10.5 && hour < 15.0) {
    return 'lunch';
  } else if (hour >= 15.0 && hour < 19.0) {
    return 'snacks';
  } else {
    return 'dinner';
  }
}

/**
 * Infers appropriate venue type from restaurant metadata or cuisine
 */
export function inferVenueType(restaurant) {
  const type = (restaurant.primaryType || '').toLowerCase();
  const cuisine = (restaurant.cuisine || '').toLowerCase();
  const name = (restaurant.displayName || '').toLowerCase();

  if (type.includes('bakery') || name.includes('bakery') || cuisine.includes('bakery')) {
    return 'bakery';
  }
  if (type.includes('cafe') || type.includes('coffee') || name.includes('cafe') || cuisine.includes('cafe') || cuisine.includes('coffee')) {
    return 'cafe';
  }
  if (type.includes('fast_food') || cuisine.includes('burger') || cuisine.includes('fast food') || name.includes('burger')) {
    return 'quick-service';
  }
  if (name.includes('street') || name.includes('fuchka') || name.includes('cha') || cuisine.includes('street')) {
    return 'street food';
  }
  if (restaurant.priceLevel >= 3 || cuisine.includes('fine dining') || name.includes('fine')) {
    return 'fine dining';
  }
  if (cuisine.includes('biriyani') || cuisine.includes('kabab') || cuisine.includes('bangladeshi') || cuisine.includes('indian')) {
    return 'casual dining';
  }
  return 'quick-service';
}

/**
 * Calculates complete required time breakdown and safety buffer
 */
export function calculateTimeBreakdown({
  availableMinutes,
  outboundTravelMinutes,
  returnTravelMinutes,
  mode = 'lunch',
  venueType = 'quick-service',
  diningStyle = 'dine_in',
  transport = 'car',
  trafficLevel = 'Moderate',
  bufferPreference = 'Balanced',
  leaveAtDate = new Date()
}) {
  const modeSpec = mealTimeConfig.modes[mode] || mealTimeConfig.modes.lunch;
  const venueSpec = mealTimeConfig.venueTypeMatrix[venueType] || mealTimeConfig.venueTypeMatrix['quick-service'];
  const { hour } = getDhakaTimeParts(leaveAtDate);

  // 1. Determine wait / ordering time
  let waitMinutes = venueSpec.waitMinutes;
  // Apply peak hour adjustments for the active meal mode
  if (modeSpec.peakHours) {
    const { startHour, endHour, extraWaitMinutes } = modeSpec.peakHours;
    if (hour >= startHour && hour <= endHour) {
      waitMinutes += extraWaitMinutes;
    }
  }

  // 2. Determine eating time
  let eatMinutes = venueSpec.eatMinutes;
  if (diningStyle === 'takeaway') {
    // For takeaway, eating at the restaurant is 0 ("Eat after you get back")
    eatMinutes = 0;
    // Pickup wait is typically shorter
    waitMinutes = Math.min(waitMinutes, 4);
  }

  // 3. Safety buffer calculation
  // Extras in config:
  // - heavy traffic +3, moderate traffic +1
  // - car +3 (parking & walking from parking)
  // - ride-share +4 pickup and +1 drop-off (+5 total)
  // - motorcycle +1, bicycle +1, walking 0
  let extras = 0;
  if (trafficLevel === 'Heavy') {
    extras += mealTimeConfig.buffer.extras.heavyTrafficMinutes;
  } else if (trafficLevel === 'Moderate') {
    extras += mealTimeConfig.buffer.extras.moderateTrafficMinutes;
  }

  if (transport === 'car') {
    extras += mealTimeConfig.buffer.extras.carMinutes;
  } else if (transport === 'ride-share') {
    extras += (mealTimeConfig.buffer.extras.rideSharePickupMinutes + mealTimeConfig.buffer.extras.rideShareDropoffMinutes);
  } else if (transport === 'motorcycle') {
    extras += mealTimeConfig.buffer.extras.motorcycleMinutes;
  } else if (transport === 'bicycle') {
    extras += mealTimeConfig.buffer.extras.bicycleLockingMinutes;
  } else if (transport === 'rickshaw' || transport === 'cng') {
    extras += 1;
  }

  const travelWaitEatSum = outboundTravelMinutes + waitMinutes + eatMinutes + returnTravelMinutes;
  const baseBuffer = Math.max(
    mealTimeConfig.buffer.minBufferMinutes,
    Math.round(travelWaitEatSum * mealTimeConfig.buffer.basePercentage)
  ) + extras;

  // Apply buffer multiplier based on user preference
  const multiplier = mealTimeConfig.buffer.multipliers[bufferPreference] ?? 1.0;
  let bufferMinutes = Math.round(baseBuffer * multiplier);
  if (bufferPreference === 'Flexible') {
    bufferMinutes = Math.max(mealTimeConfig.buffer.flexibleMinMinutes, bufferMinutes);
  }

  // Total required time
  const totalRequiredMinutes = outboundTravelMinutes + waitMinutes + eatMinutes + returnTravelMinutes + bufferMinutes;
  const spareMinutes = availableMinutes - totalRequiredMinutes;

  // Status computation
  let status = 'SAFE';
  if (spareMinutes < 0) {
    status = 'NOT_RECOMMENDED';
  } else if (spareMinutes < mealTimeConfig.thresholds.safeMinSpareMinutes) {
    status = 'TIGHT';
  }

  return {
    outbound: outboundTravelMinutes,
    wait: waitMinutes,
    eat: eatMinutes,
    return: returnTravelMinutes,
    buffer: bufferMinutes,
    total: totalRequiredMinutes,
    availableMinutes,
    spareMinutes,
    status,
    isTakeaway: diningStyle === 'takeaway',
    bufferPreference,
    multiplier
  };
}

/**
 * Checks opening hours against arrival, wait, eating time, and last-order margin.
 * Handles 24-hour places, midnight-crossing hours, and missing hours policy.
 */
export function checkOpeningFeasibility(restaurant, arrivalDate, finishDate, mode, unknownHoursPolicy = 'include_flagged') {
  const flags = [];
  const hours = restaurant.regularOpeningHours || restaurant.currentOpeningHours;

  // Meal service flag check (servesBreakfast, servesLunch, servesDinner)
  let mealServiceVerified = false;
  if (mode === 'breakfast') {
    if (restaurant.servesBreakfast === false) {
      return { passes: false, rejectionReason: 'Does not serve breakfast', flags: ['Does not serve breakfast'] };
    }
    mealServiceVerified = Boolean(restaurant.servesBreakfast);
  } else if (mode === 'lunch') {
    if (restaurant.servesLunch === false) {
      return { passes: false, rejectionReason: 'Does not serve lunch', flags: ['Does not serve lunch'] };
    }
    mealServiceVerified = Boolean(restaurant.servesLunch);
  } else if (mode === 'dinner') {
    if (restaurant.servesDinner === false) {
      return { passes: false, rejectionReason: 'Does not serve dinner', flags: ['Does not serve dinner'] };
    }
    mealServiceVerified = Boolean(restaurant.servesDinner);
  }

  if (!mealServiceVerified) {
    flags.push('Meal service unverified');
  }

  // If opening hours are completely missing
  if (!hours || (!hours.closingTime && !hours.weekdayDescriptions && hours.openNow === undefined)) {
    if (unknownHoursPolicy === 'exclude') {
      return { passes: false, rejectionReason: 'Opening hours unknown' };
    }
    flags.push('Hours unverified');
    return {
      passes: true,
      openAtArrival: true,
      closesAt: 'Unlisted',
      finishAt: finishDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Dhaka' }),
      minutesUntilClose: null,
      flags,
      mealServiceVerified
    };
  }

  // Check 24-hour places
  if (hours.is24Hours || (hours.weekdayDescriptions && hours.weekdayDescriptions.some(d => d.toLowerCase().includes('open 24 hours') || d.toLowerCase().includes('24 hours')))) {
    return {
      passes: true,
      openAtArrival: true,
      closesAt: 'Open 24 Hours',
      finishAt: finishDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Dhaka' }),
      minutesUntilClose: 999,
      flags,
      mealServiceVerified
    };
  }

  // Parse closing time
  let closeH = 23;
  let closeM = 0;
  if (hours.closingTime) {
    const parts = hours.closingTime.split(':');
    closeH = parseInt(parts[0], 10);
    closeM = parseInt(parts[1], 10) || 0;
  } else if (hours.weekdayDescriptions && hours.weekdayDescriptions.length > 0) {
    // Attempt parse from description string (e.g., "11:00 AM – 11:00 PM")
    const desc = hours.weekdayDescriptions[0];
    const match = desc.match(/–\s*(\d{1,2}):?(\d{2})?\s*(AM|PM)/i);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = match[2] ? parseInt(match[2], 10) : 0;
      const isPm = match[3].toUpperCase() === 'PM';
      if (isPm && h < 12) h += 12;
      if (!isPm && h === 12) h = 0;
      closeH = h;
      closeM = m;
    }
  }

  // Work in Dhaka minutes-since-midnight. (Building the close time from the arrival's UTC
  // date put it a day early for arrivals between 00:00 and 06:00 Dhaka time.)
  const arrivalDhaka = getDhakaTimeParts(arrivalDate);
  const arrivalMin = arrivalDhaka.hours * 60 + arrivalDhaka.minutes;
  const closeMin = closeH * 60 + closeM;

  let openMin = null;
  if (typeof hours.openTime === 'string' && /^\d{1,2}:\d{2}$/.test(hours.openTime)) {
    const [oh, om] = hours.openTime.split(':').map(Number);
    openMin = oh * 60 + om;
  }

  let minutesFromArrivalToClose;
  if (openMin !== null) {
    const crossesMidnight = closeMin <= openMin;
    const openAtArrival = crossesMidnight
      ? (arrivalMin >= openMin || arrivalMin < closeMin)
      : (arrivalMin >= openMin && arrivalMin < closeMin);
    if (!openAtArrival) {
      return { passes: false, rejectionReason: `Not open at arrival (opens ${hours.openTime})`, flags, openAtArrival: false, minutesUntilClose: 0 };
    }
    minutesFromArrivalToClose = crossesMidnight && arrivalMin >= openMin
      ? closeMin + 1440 - arrivalMin
      : closeMin - arrivalMin;
  } else {
    minutesFromArrivalToClose = closeMin - arrivalMin;
    // Early-morning close (< 6 AM) seen from an afternoon/evening arrival is tomorrow's close
    if (closeH < 6 && arrivalDhaka.hours >= 12) {
      minutesFromArrivalToClose += 1440;
    }
  }
  const minutesFromFinishToClose = minutesFromArrivalToClose - Math.round((finishDate.getTime() - arrivalDate.getTime()) / 60000);

  // Hard gate 1: Must be open at arrival
  if (minutesFromArrivalToClose <= 0) {
    return { passes: false, rejectionReason: 'Closed before arrival', flags, openAtArrival: false, minutesUntilClose: 0 };
  }

  // Hard gate 2: Must remain open for whole stay + last-order margin (30 min)
  // i.e., finishDate must be <= closeDate
  if (minutesFromFinishToClose < 0) {
    return { passes: false, rejectionReason: `Closes too soon (in ${minutesFromArrivalToClose} min)`, flags, openAtArrival: true, minutesUntilClose: minutesFromArrivalToClose };
  }

  const closesAtStr = `${closeH > 12 ? closeH - 12 : closeH === 0 ? 12 : closeH}:${closeM.toString().padStart(2, '0')} ${closeH >= 12 ? 'pm' : 'am'}`;
  const finishAtStr = finishDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Dhaka' });

  return {
    passes: true,
    openAtArrival: true,
    closesAt: closesAtStr,
    finishAt: finishAtStr,
    minutesUntilClose: minutesFromArrivalToClose,
    flags,
    mealServiceVerified
  };
}

/**
 * Calculates direct trip vs detour minutes and route efficiency
 */
export function calculateDetour(origin, destination, candidateLocation, transport = 'car') {
  // If origin and destination are the exact same location
  const isSame = (
    Math.abs(origin.lat - destination.lat) < 0.001 &&
    Math.abs(origin.lng - destination.lng) < 0.001
  );

  // Approximation helper for Dhaka coordinates in km
  const getDistKm = (p1, p2) => {
    const dLat = (p1.lat - p2.lat) * 111.0;
    const dLng = (p1.lng - p2.lng) * 102.0;
    return Math.sqrt(dLat * dLat + dLng * dLng) * 1.3;
  };

  const transportSpeedKmh = mealTimeConfig.transportModes[transport]?.speedKmh || 18.0;

  if (isSame) {
    const outboundKm = getDistKm(origin, { lat: candidateLocation.latitude, lng: candidateLocation.longitude });
    const roundTripKm = outboundKm * 2;
    const roundTripMinutes = Math.round((roundTripKm / transportSpeedKmh) * 60);
    return {
      isRoundTrip: true,
      detourMinutes: roundTripMinutes,
      directMinutes: 0,
      routeEfficiency: 1.0 // Maximum route efficiency since returning to origin
    };
  }

  const directKm = getDistKm(origin, destination);
  const leg1Km = getDistKm(origin, { lat: candidateLocation.latitude, lng: candidateLocation.longitude });
  const leg2Km = getDistKm({ lat: candidateLocation.latitude, lng: candidateLocation.longitude }, destination);

  const directMinutes = Math.max(1, Math.round((directKm / transportSpeedKmh) * 60));
  const viaRestaurantMinutes = Math.round(((leg1Km + leg2Km) / transportSpeedKmh) * 60);
  const detourMinutes = Math.max(0, viaRestaurantMinutes - directMinutes);

  // Route efficiency score between 0.1 and 1.0
  const routeEfficiency = Number((1 / (1 + (detourMinutes / 8))).toFixed(2));

  return {
    isRoundTrip: false,
    detourMinutes,
    directMinutes,
    routeEfficiency
  };
}

/**
 * Bayesian-smoothed rating calculation
 */
function computeBayesianRating(rating, reviewCount) {
  const R = rating || 4.0;
  const v = reviewCount || 20;
  const C = 25; // prior review count weight
  const m = 4.2; // prior mean rating
  return ((v * R) + (C * m)) / (v + C);
}

/**
 * Multi-factor ranking score for feasible candidates
 */
export function scoreMealTimeCandidate(candidate, mode, userBudget = 2, tasteProfile = null) {
  const modeSpec = mealTimeConfig.modes[mode] || mealTimeConfig.modes.lunch;
  const w = modeSpec.weights;

  // 1. Spare time comfort: (0 to 1, max saturated at 20 min spare)
  const spareScore = Math.min(1.0, Math.max(0, candidate.timeBreakdown.spareMinutes / 20.0));

  // 2. Speed score: 1 - (totalRequired / availableMinutes)
  const speedScore = Math.min(1.0, Math.max(0, 1.0 - (candidate.timeBreakdown.total / candidate.availableMinutes)));

  // 3. Traffic reliability
  let trafficScore = 0.75;
  if (candidate.trafficLevel === 'Low') trafficScore = 1.0;
  if (candidate.trafficLevel === 'Moderate') trafficScore = 0.75;
  if (candidate.trafficLevel === 'Heavy') trafficScore = 0.40;

  // 4. Opening margin score
  const openMinutes = candidate.openCheck.minutesUntilClose ?? 60;
  const openMarginScore = Math.min(1.0, Math.max(0, openMinutes / 120.0));

  // 5. Route efficiency score
  const routeScore = candidate.detour.routeEfficiency;

  // 6. Preference / Cuisine match
  let prefScore = 0.6;
  if (tasteProfile && candidate.cuisine) {
    const affinity = tasteProfile[candidate.cuisine] || 0.5;
    prefScore = affinity;
  }

  // 7. Budget score
  let budgetScore = 0.8;
  if (candidate.priceLevel) {
    if (candidate.priceLevel <= userBudget) {
      budgetScore = 1.0;
    } else if (candidate.priceLevel === userBudget + 1) {
      budgetScore = 0.6;
    } else {
      budgetScore = 0.3;
    }
  }

  // 8. Bayesian rating score: normalized to [0, 1]
  const bayesRating = computeBayesianRating(candidate.rating, candidate.userRatingCount);
  const ratingScore = Math.min(1.0, Math.max(0, (bayesRating - 3.2) / 1.8));

  // Weighted total
  let totalScore = (
    spareScore * w.spare +
    speedScore * w.speed +
    trafficScore * w.traffic +
    openMarginScore * w.openMargin +
    routeScore * w.route +
    prefScore * w.pref +
    budgetScore * w.budget +
    ratingScore * w.rating
  );

  // Soft penalty if opening hours unverified
  if (candidate.openCheck.flags.includes('Hours unverified')) {
    totalScore -= 0.08;
  }

  return {
    totalScore: Number(Math.max(0, totalScore).toFixed(4)),
    components: {
      spareScore: Number(spareScore.toFixed(2)),
      speedScore: Number(speedScore.toFixed(2)),
      trafficScore: Number(trafficScore.toFixed(2)),
      openMarginScore: Number(openMarginScore.toFixed(2)),
      routeScore: Number(routeScore.toFixed(2)),
      prefScore: Number(prefScore.toFixed(2)),
      budgetScore: Number(budgetScore.toFixed(2)),
      ratingScore: Number(ratingScore.toFixed(2))
    }
  };
}

/**
 * Generates natural plain-language reason for why this candidate was picked
 */
export function generateMealTimeReason(candidate) {
  const { spareMinutes, outbound, wait, eat, return: retTime } = candidate.timeBreakdown;
  const traffic = candidate.trafficLevel ? candidate.trafficLevel.toLowerCase() : 'moderate';
  const openStr = candidate.openCheck.closesAt ? `open until ${candidate.openCheck.closesAt}` : 'hours unverified';

  if (candidate.timeBreakdown.isTakeaway) {
    return `Takeaway fits with ${spareMinutes} min spare: order in ${wait} min, ${traffic} traffic back, eat after return.`;
  }

  if (spareMinutes >= 5) {
    return `Fits comfortably with ${spareMinutes} min spare (${outbound}m there, ${wait + eat}m stay, ${retTime}m return), ${traffic} traffic, ${openStr}.`;
  } else if (spareMinutes >= 0) {
    return `Tight fit: takes ${candidate.timeBreakdown.total} min of your ${candidate.availableMinutes} min, ${traffic} traffic, finish before last orders.`;
  } else {
    return `Slightly over your time by ${Math.abs(spareMinutes)} min (${candidate.timeBreakdown.total} min total). Recommended only if you can extend.`;
  }
}

/**
 * Geometry pruning: skips places that exceed the maximum plausible distance for the available time
 */
export function pruneCandidatesByGeometry(candidates, origin, availableMinutes, transport = 'car') {
  const minWait = 3;
  const minEat = 10;
  const minBuffer = 3;
  const maxOneWayMinutes = Math.max(2, (availableMinutes - minWait - minEat - minBuffer) / 2);
  const speedKmh = mealTimeConfig.transportModes[transport]?.speedKmh || 18.0;

  // Maximum plausible straight-line distance in meters with 1.6 factor for Dhaka road winding
  const maxDistMeters = (maxOneWayMinutes / 60) * speedKmh * 1000 * 1.6;

  return candidates.filter(c => {
    if (!c.location || !c.location.latitude) return true;
    const dLat = (c.location.latitude - origin.lat) * 111000;
    const dLng = (c.location.longitude - origin.lng) * 102000;
    const distM = Math.sqrt(dLat * dLat + dLng * dLng);
    return distM <= maxDistMeters;
  });
}

/**
 * Re-runs relaxation checks to provide computed alternatives when 0 places fit
 */
export function computeNoResultAlternatives(allProcessedCandidates, availableMinutes) {
  const alternatives = [];

  // 1. Takeaway relaxation: What if user takes away? (eat time = 0)
  const takeawayFits = allProcessedCandidates.filter(c => {
    const tb = calculateTimeBreakdown({
      availableMinutes,
      outboundTravelMinutes: c.timeBreakdown.outbound,
      returnTravelMinutes: c.timeBreakdown.return,
      mode: c.mode,
      venueType: c.venueType,
      diningStyle: 'takeaway',
      transport: c.transport,
      trafficLevel: c.trafficLevel,
      bufferPreference: c.timeBreakdown.bufferPreference
    });
    return tb.spareMinutes >= 0 && c.openCheck.passes;
  });

  if (takeawayFits.length > 0) {
    alternatives.push({
      type: 'takeaway',
      count: takeawayFits.length,
      label: `Takeaway (${takeawayFits.length} places fit — eat after you get back)`
    });
  }

  // 2. Add 15 minutes: What if available + 15?
  const plus15Fits = allProcessedCandidates.filter(c => {
    const tb = calculateTimeBreakdown({
      availableMinutes: availableMinutes + 15,
      outboundTravelMinutes: c.timeBreakdown.outbound,
      returnTravelMinutes: c.timeBreakdown.return,
      mode: c.mode,
      venueType: c.venueType,
      diningStyle: c.diningStyle,
      transport: c.transport,
      trafficLevel: c.trafficLevel,
      bufferPreference: c.timeBreakdown.bufferPreference
    });
    return tb.spareMinutes >= 0 && c.openCheck.passes;
  });

  if (plus15Fits.length > 0) {
    alternatives.push({
      type: 'add_time',
      count: plus15Fits.length,
      label: `Add 15 minutes (${plus15Fits.length} places fit with ${availableMinutes + 15} min)`
    });
  }

  // 3. Quicker venue types (quick-service / bakery / cafe)
  const quickFits = allProcessedCandidates.filter(c => {
    if (['quick-service', 'bakery', 'cafe'].includes(c.venueType)) {
      return c.timeBreakdown.total <= availableMinutes + 3;
    }
    return false;
  });

  if (quickFits.length > 0) {
    alternatives.push({
      type: 'quicker_venues',
      count: quickFits.length,
      label: `Quicker venue types (${quickFits.length} quick-service places fit)`
    });
  }

  // 4. Shortest feasible time needed
  const minTimeNeeded = Math.min(
    ...allProcessedCandidates.map(c => c.timeBreakdown.total).filter(t => !isNaN(t) && t > 0)
  );

  return {
    alternatives,
    shortestFeasibleTime: isFinite(minTimeNeeded) ? minTimeNeeded : null
  };
}

/**
 * Main Search Handler for Meal-Time Mode
 */
export async function searchMealTime({
  mode = 'lunch',
  availableMinutes = 45,
  leaveAt = null,
  origin = { lat: 23.8103, lng: 90.4125, name: 'Dhaka' },
  destination = 'same-as-origin',
  transport = 'car',
  diningStyle = 'dine_in',
  bufferPreference = 'Balanced',
  filters = {},
  tasteProfile = null
}) {
  if (!featureFlags.mealTimeMode) {
    throw new Error('Meal-Time Mode feature flag is currently disabled.');
  }

  const leaveAtDate = leaveAt ? new Date(leaveAt) : new Date();
  const availableMinNum = Number(availableMinutes) || 45;

  // Resolve return destination
  let destCoords = origin;
  let isSameDestination = true;
  if (destination && destination !== 'same-as-origin') {
    if (destination.lat && destination.lng) {
      destCoords = destination;
      isSameDestination = false;
    } else if (typeof destination === 'string' && PRESET_LOCATIONS[destination]) {
      destCoords = PRESET_LOCATIONS[destination];
      isSameDestination = false;
    }
  }

  // Cost control 1: Candidate retrieval. Meal-Time Mode ranks the curated Dhaka dataset in
  // both modes; only the travel-time lookups below go to Google when keys are configured.
  const isMock = process.env.USE_MOCK_DATA === 'true' || !process.env.GOOGLE_SERVER_KEY;
  const rawCandidates = getMockCandidates(filters.cuisine || 'All', filters.budget, origin);

  // Cost control 2: Prune candidates by geometry before matrix API calls, and cap at the
  // 20 that get a routed travel time (the rest used to fall through with a made-up 10 min).
  const candidates = pruneCandidatesByGeometry(rawCandidates, origin, availableMinNum, transport).slice(0, 20);

  // Cost control 3: Compute outbound and return travel legs
  // Outbound: Origin -> Restaurant
  const speedMps = (mealTimeConfig.transportModes[transport]?.speedKmh || 18.0) * 1000 / 3600;
  const outboundLegs = await computeTravelTimes(origin, candidates, isMock);
  const outboundMap = new Map(outboundLegs.map(l => {
    if (Number.isFinite(l.durationSeconds) && l.durationSeconds > 0) return [l.id, l];
    // Routing unavailable (straight-line fallback has no duration). Feasibility is a hard
    // gate, so estimate conservatively from distance instead of treating it as 0-1 min.
    const roadMeters = (l.distanceMeters || 1500) * 1.3;
    return [l.id, { ...l, durationSeconds: Math.round(roadMeters / speedMps), trafficLevel: 'Moderate', isTravelTimeEstimated: true }];
  }));

  // Compute return leg: Restaurant -> Destination with predicted traffic
  // Return departure is leaveAt + outbound + wait + eat
  const returnLegs = candidates.map(c => {
    const outLeg = outboundMap.get(c.id) || { durationSeconds: 600, distanceMeters: 1500, trafficLevel: 'Moderate' };
    const outMins = Math.round(outLeg.durationSeconds / 60);

    // If returning to same location, apply diurnal return traffic multiplier
    let retDurationSec = outLeg.durationSeconds;
    if (isSameDestination) {
      // Return journey occurs later in the day: calculate predicted traffic multiplier
      const futureReturnDate = new Date(leaveAtDate.getTime() + (outMins + 25) * 60000);
      const multOut = getDhakaTrafficMultiplier(leaveAtDate);
      const multRet = getDhakaTrafficMultiplier(futureReturnDate);
      const trafficShiftRatio = multRet / multOut;
      retDurationSec = Math.max(300, Math.round(outLeg.durationSeconds * trafficShiftRatio));
    } else {
      // Calculate geometric distance from candidate to distinct return destination
      const dLat = (destCoords.lat - c.location.latitude) * 111000;
      const dLng = (destCoords.lng - c.location.longitude) * 102000;
      const distM = Math.max(400, Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 1.3));
      retDurationSec = Math.round((distM / speedMps) * 1.2);
    }

    return {
      id: c.id,
      durationSeconds: retDurationSec,
      trafficLevel: determineTrafficLevel(retDurationSec, Math.round(retDurationSec * 0.85))
    };
  });
  const returnMap = new Map(returnLegs.map(l => [l.id, l]));

  // Process all candidates through feasibility gates
  const feasibleResults = [];
  const flexibleResults = [];
  const allEvaluated = [];

  for (const c of candidates) {
    const outLeg = outboundMap.get(c.id) || { durationSeconds: 600, distanceMeters: 1500, trafficLevel: 'Moderate' };
    const retLeg = returnMap.get(c.id) || { durationSeconds: 600, trafficLevel: 'Moderate' };

    const outMins = Math.max(1, Math.round(outLeg.durationSeconds / 60));
    const retMins = Math.max(1, Math.round(retLeg.durationSeconds / 60));
    const venueType = inferVenueType(c);

    // 1. Time Breakdown & Buffer
    const timeBreakdown = calculateTimeBreakdown({
      availableMinutes: availableMinNum,
      outboundTravelMinutes: outMins,
      returnTravelMinutes: retMins,
      mode,
      venueType,
      diningStyle,
      transport,
      trafficLevel: outLeg.trafficLevel,
      bufferPreference,
      leaveAtDate
    });

    // 2. Expected finish Date for opening hours check
    const arrivalDate = new Date(leaveAtDate.getTime() + outMins * 60000);
    const finishDate = new Date(arrivalDate.getTime() + (timeBreakdown.wait + timeBreakdown.eat + mealTimeConfig.thresholds.lastOrderMarginMinutes) * 60000);
    const backByDate = new Date(leaveAtDate.getTime() + timeBreakdown.total * 60000);

    // 3. Opening check
    const openCheck = checkOpeningFeasibility(c, arrivalDate, finishDate, mode, mealTimeConfig.thresholds.unknownHoursPolicy);

    // 4. Detour calculation
    const detour = calculateDetour(origin, destCoords, c.location, transport);

    const evaluated = {
      placeId: c.id,
      name: c.displayName,
      formattedAddress: c.formattedAddress,
      rating: c.rating,
      userRatingCount: c.userRatingCount,
      priceLevel: c.priceLevel,
      cuisine: c.cuisine,
      venueType,
      mode,
      diningStyle,
      transport,
      trafficLevel: outLeg.trafficLevel,
      returnTrafficLevel: retLeg.trafficLevel,
      timeBreakdown,
      availableMinutes: availableMinNum,
      spareMinutes: timeBreakdown.spareMinutes,
      status: timeBreakdown.status,
      backByTime: backByDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Dhaka' }),
      openCheck,
      detour,
      flags: [...(openCheck.flags || [])],
      phoneNumber: c.nationalPhoneNumber || null,
      websiteUri: c.websiteUri || null,
      location: c.location || null
    };

    if (outLeg.isTravelTimeEstimated) {
      evaluated.flags.push('Travel time estimated from distance');
    }
    if (retLeg.durationSeconds !== outLeg.durationSeconds) {
      evaluated.flags.push('Traffic predicted');
    }
    evaluated.flags.push('Waiting time estimated');

    allEvaluated.push(evaluated);

    // Hard Feasibility Filter:
    // Open check must pass AND spareMinutes >= 0
    if (openCheck.passes && timeBreakdown.spareMinutes >= 0) {
      const { totalScore, components } = scoreMealTimeCandidate(evaluated, mode, filters.budget || 2, tasteProfile);
      evaluated.score = totalScore;
      evaluated.scoreComponents = components;
      evaluated.reasons = [generateMealTimeReason(evaluated)];
      feasibleResults.push(evaluated);
    } else if (
      bufferPreference === 'Flexible' &&
      openCheck.passes &&
      timeBreakdown.spareMinutes < 0 &&
      timeBreakdown.spareMinutes >= -mealTimeConfig.buffer.flexibleMaxOverMinutes
    ) {
      // In Flexible mode, places over by up to 5 minutes are grouped in flexibleResults
      const { totalScore, components } = scoreMealTimeCandidate(evaluated, mode, filters.budget || 2, tasteProfile);
      evaluated.score = totalScore;
      evaluated.scoreComponents = components;
      evaluated.reasons = [generateMealTimeReason(evaluated)];
      flexibleResults.push(evaluated);
    }
  }

  // Sort feasible and flexible candidates by score descending
  feasibleResults.sort((a, b) => b.score - a.score);
  flexibleResults.sort((a, b) => b.score - a.score);

  // If no feasible results, compute alternatives
  let suggestions = [];
  let shortestFeasibleTime = null;
  if (feasibleResults.length === 0) {
    const altAnalysis = computeNoResultAlternatives(allEvaluated, availableMinNum);
    suggestions = altAnalysis.alternatives;
    shortestFeasibleTime = altAnalysis.shortestFeasibleTime;
  }

  const summary = {
    feasibleCount: feasibleResults.length,
    flexibleCount: flexibleResults.length,
    mode,
    availableMinutes: availableMinNum,
    bufferPreference,
    shortestFeasibleTime,
    message: feasibleResults.length > 0
      ? `Found ${feasibleResults.length} restaurants that safely fit your ${availableMinNum}-minute ${mode}.`
      : `No restaurants safely fit your ${availableMinNum}-minute ${mode}.`
  };

  const assumptions = [
    'All travel times and predicted traffic are estimated using Dhaka road models.',
    'Waiting and eating times are estimated from venue type benchmarks.',
    'A 30-minute last-order margin before restaurant closing is enforced.',
    'Feasibility is a hard gate: popularity or ratings never override your time limit.'
  ];

  return {
    summary,
    results: feasibleResults,
    flexibleResults,
    suggestions,
    assumptions
  };
}

export default {
  getDhakaTimeParts,
  getCurrentMealMode,
  inferVenueType,
  calculateTimeBreakdown,
  checkOpeningFeasibility,
  calculateDetour,
  scoreMealTimeCandidate,
  generateMealTimeReason,
  pruneCandidatesByGeometry,
  computeNoResultAlternatives,
  searchMealTime
};
