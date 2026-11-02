import dhakaLocationsRaw from '../data/dhaka-locations.json' with { type: 'json' };

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const ALL_LOCATIONS = dhakaLocationsRaw.map((loc, idx) => {
  const id = (loc.standardizedName || `loc-${idx}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return {
    id,
    name: loc.name || loc.standardizedName,
    standardizedName: loc.standardizedName,
    alternativeNames: Array.isArray(loc.alternativeNames) ? loc.alternativeNames : [],
    type: loc.type || 'Neighborhood',
    thana: loc.thana || '',
    lat: Number(loc.latitude),
    lng: Number(loc.longitude),
    landmarks: Array.isArray(loc.landmarks) ? loc.landmarks : []
  };
});

/**
 * Search Dhaka locations dynamically.
 * Priority order:
 * 1. Exact prefix match on English standardizedName (e.g. typing "A" -> Abdullahpur, Adabor, Aftabnagar...)
 * 2. Exact prefix match on Bangla name (e.g. "উ" -> উত্তরা...)
 * 3. Word starts with query in standardizedName (e.g. "B" -> Merul Badda, North Badda)
 * 4. Substring matches on standardizedName (for queries >= 2 chars)
 * 5. Substring matches on Bangla name (for queries >= 2 chars)
 * 6. Match on alternative names, landmarks, or thana (for queries >= 2 chars)
 *
 * @param {string} query - user input (e.g. "A", "Mirpur", "ধানমন্ডি")
 * @param {object} options - { limit: number }
 * @returns {Array<object>} list of matched locations
 */
export function searchDhakaLocations(query = '', options = {}) {
  const { limit = 30 } = options;
  const q = String(query || '').trim().toLowerCase();

  if (!q) {
    const sorted = [...ALL_LOCATIONS].sort((a, b) =>
      a.standardizedName.localeCompare(b.standardizedName)
    );
    return typeof limit === 'number' && limit > 0 ? sorted.slice(0, limit) : sorted;
  }

  const exactStartStd = [];
  const exactStartBn = [];
  const wordStartStd = [];
  const substringStd = [];
  const substringBn = [];
  const altOrOtherMatches = [];

  for (const loc of ALL_LOCATIONS) {
    const stdLower = loc.standardizedName.toLowerCase();
    const bnLower = loc.name.toLowerCase();

    // 1. Standardized name starts with q
    if (stdLower.startsWith(q)) {
      exactStartStd.push(loc);
      continue;
    }

    // 2. Bangla name starts with q
    if (bnLower.startsWith(q)) {
      exactStartBn.push(loc);
      continue;
    }

    // 3. Word boundary in standardizedName
    const words = stdLower.split(/[\s,/-]+/);
    if (words.some(w => w.startsWith(q))) {
      wordStartStd.push(loc);
      continue;
    }

    // For queries with length >= 2, check substrings and alternatives
    if (q.length >= 2) {
      if (stdLower.includes(q)) {
        substringStd.push(loc);
      } else if (bnLower.includes(q)) {
        substringBn.push(loc);
      } else if (
        loc.alternativeNames.some(alt => alt.toLowerCase().includes(q)) ||
        loc.thana.toLowerCase().includes(q) ||
        loc.landmarks.some(lm => lm.toLowerCase().includes(q))
      ) {
        altOrOtherMatches.push(loc);
      }
    }
  }

  exactStartStd.sort((a, b) => a.standardizedName.localeCompare(b.standardizedName));
  exactStartBn.sort((a, b) => a.name.localeCompare(b.name));
  wordStartStd.sort((a, b) => a.standardizedName.localeCompare(b.standardizedName));
  substringStd.sort((a, b) => a.standardizedName.localeCompare(b.standardizedName));
  substringBn.sort((a, b) => a.name.localeCompare(b.name));

  const results = [
    ...exactStartStd,
    ...exactStartBn,
    ...wordStartStd,
    ...substringStd,
    ...substringBn,
    ...altOrOtherMatches
  ];

  return typeof limit === 'number' && limit > 0 ? results.slice(0, limit) : results;
}

/**
 * Returns all 118 verified Dhaka locations.
 */
export function getAllDhakaLocations() {
  return [...ALL_LOCATIONS].sort((a, b) => a.standardizedName.localeCompare(b.standardizedName));
}

/**
 * Find the closest verified Dhaka area to a given GPS coordinate.
 */
export function findClosestDhakaLocation(lat, lng) {
  const targetLat = Number(lat);
  const targetLng = Number(lng);
  if (Number.isNaN(targetLat) || Number.isNaN(targetLng)) return null;

  let closest = null;
  let minDistanceKm = Infinity;

  for (const loc of ALL_LOCATIONS) {
    const d = haversineDistanceKm(targetLat, targetLng, loc.lat, loc.lng);
    if (d < minDistanceKm) {
      minDistanceKm = d;
      closest = loc;
    }
  }

  return closest ? { location: closest, distanceKm: Math.round(minDistanceKm * 10) / 10 } : null;
}

/**
 * Lookup location by exact or fuzzy name.
 */
export function getDhakaLocationByName(name) {
  if (!name || typeof name !== 'string') return null;
  const n = name.trim().toLowerCase();
  return (
    ALL_LOCATIONS.find(
      loc =>
        loc.standardizedName.toLowerCase() === n ||
        loc.name.toLowerCase() === n ||
        loc.id === n ||
        loc.alternativeNames.some(alt => alt.toLowerCase() === n)
    ) || null
  );
}
