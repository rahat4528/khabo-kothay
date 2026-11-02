import { globalCache, getCoarseGrid } from './cache.js';
import { getMockCandidates, MOCK_RESTAURANTS } from './mock.js';
import cuisinesConfig from '../config/cuisines.json' with { type: 'json' };
import quotaManager from './quota.js';
import logger from './logger.js';

const PLACES_SEARCH_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const PLACES_SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';
const PLACES_DETAILS_BASE_URL = 'https://places.googleapis.com/v1/places';

/**
 * Normalizes Google price level string or number to integer 1-4 or null
 */
export function normalizePriceLevel(rawPrice) {
  if (rawPrice === null || rawPrice === undefined) return null;
  if (typeof rawPrice === 'number') {
    return (rawPrice >= 1 && rawPrice <= 4) ? rawPrice : null;
  }
  const str = String(rawPrice).toUpperCase();
  if (str.includes('INEXPENSIVE') || str === '1') return 1;
  if (str.includes('MODERATE') || str === '2') return 2;
  if (str.includes('EXPENSIVE') && !str.includes('VERY') || str === '3') return 3;
  if (str.includes('VERY_EXPENSIVE') || str === '4') return 4;
  return null;
}

/**
 * Map cuisine name to keywords or Google primary types
 */
export function getCuisineQuery(cuisine) {
  if (!cuisine || cuisine === 'All') return { keyword: 'restaurant', type: 'restaurant' };
  const kwList = cuisinesConfig.keywords[cuisine] || [cuisine.toLowerCase()];
  return {
    keyword: kwList[0],
    keywords: kwList,
    type: cuisine.toLowerCase().replace(/\s+/g, '_')
  };
}

/**
 * Search candidates near lat, lng using ~300m coarse grid & Stale-While-Revalidate caching
 */
export async function searchRestaurants({ lat, lng, cuisine = 'All', radiusMeters = 3000, budget = null, useMock = false }) {
  const isMock = useMock || process.env.USE_MOCK_DATA === 'true' || !process.env.GOOGLE_SERVER_KEY;
  const { gridLat, gridLng } = getCoarseGrid(lat, lng);
  const cacheKey = `places_grid_${gridLat}_${gridLng}_${cuisine}_${radiusMeters}_${budget || 'all'}`;

  // Kill switch / Monthly budget check
  const budgetStatus = quotaManager.checkGlobalMonthlyBudget();
  if (budgetStatus.isExceeded) {
    logger.warn('Global monthly budget killswitch active; returning cached/mock places.');
    const cachedItem = await globalCache.get(cacheKey);
    if (cachedItem) return cachedItem;
    return getMockCandidates(cuisine, budget, { lat: Number(lat), lng: Number(lng) });
  }

  const fetcher = async () => {
    if (isMock) {
      return getMockCandidates(cuisine, budget, { lat: Number(lat), lng: Number(lng) });
    }

  try {
    quotaManager.checkAndRecordGoogleApiCall('places');
    const apiKey = process.env.GOOGLE_SERVER_KEY;
    const queryInfo = getCuisineQuery(cuisine);

    const requestBody = {
      textQuery: `${queryInfo.keyword} restaurant in Dhaka`,
      locationBias: {
        circle: {
          center: { latitude: Number(lat), longitude: Number(lng) },
          radius: Number(radiusMeters)
        }
      },
      maxResultCount: 20
    };

    const response = await fetch(PLACES_SEARCH_TEXT_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours.openNow,places.regularOpeningHours,places.primaryType,places.photos'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Places API error, falling back to mock data');
      const mockFallback = getMockCandidates(cuisine, budget, { lat: Number(lat), lng: Number(lng) });
      return mockFallback;
    }

    const data = await response.json();
    const rawPlaces = data.places || [];

    const candidates = rawPlaces
      .map(place => {
        // Drop explicitly closed places
        if (place.currentOpeningHours && place.currentOpeningHours.openNow === false) {
          return null;
        }

        const price = normalizePriceLevel(place.priceLevel);
        const displayName = place.displayName?.text || 'Restaurant';

        return {
          id: place.id,
          displayName,
          formattedAddress: place.formattedAddress || 'Dhaka, Bangladesh',
          location: place.location ? {
            latitude: place.location.latitude,
            longitude: place.location.longitude
          } : { latitude: Number(lat), longitude: Number(lng) },
          rating: typeof place.rating === 'number' ? place.rating : 4.0,
          userRatingCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : 50,
          priceLevel: price,
          currentOpeningHours: place.currentOpeningHours || { openNow: true },
          regularOpeningHours: place.regularOpeningHours || null,
          primaryType: place.primaryType || 'restaurant',
          cuisine: cuisine !== 'All' ? cuisine : (place.primaryType || 'Restaurant'),
          photos: place.photos ? place.photos.slice(0, 3).map(p => ({
            name: p.name,
            authorAttributions: p.authorAttributions
          })) : []
        };
      })
      .filter(Boolean)
      return candidates;
    } catch (err) {
      logger.error({ err: err.message }, 'Error fetching Places API, falling back to mock candidates');
      return getMockCandidates(cuisine, budget, { lat: Number(lat), lng: Number(lng) });
    }
  };

  const cachedResult = await globalCache.getWithSWR(cacheKey, fetcher, 600);
  return cachedResult.data || cachedResult;
}

/**
 * Fetch detailed place info for mobile & web detail view
 * Only requests phone & website here to keep costs low
 */
export async function getPlaceDetails(placeId, useMock = false) {
  const isMock = useMock || process.env.USE_MOCK_DATA === 'true' || !process.env.GOOGLE_SERVER_KEY;
  const cacheKey = `place_detail_${placeId}`;

  const cached = globalCache.get(cacheKey);
  if (cached) return cached;

  if (isMock || placeId.startsWith('mock_') || placeId.startsWith('trio_') || placeId.startsWith('dhaka_')) {
    const mockFound = MOCK_RESTAURANTS.find(r => r.id === placeId) || MOCK_RESTAURANTS[0];
    const detail = {
      id: placeId.startsWith('mock_') || placeId.startsWith('trio_') ? placeId : mockFound.id,
      displayName: mockFound.displayName,
      formattedAddress: mockFound.formattedAddress,
      location: mockFound.location,
      rating: mockFound.rating,
      userRatingCount: mockFound.userRatingCount,
      priceLevel: mockFound.priceLevel,
      openNow: mockFound.currentOpeningHours?.openNow ?? true,
      regularOpeningHours: mockFound.regularOpeningHours,
      nationalPhoneNumber: mockFound.nationalPhoneNumber || '+880 1711-000000',
      internationalPhoneNumber: mockFound.nationalPhoneNumber || '+880 1711-000000',
      websiteUri: mockFound.websiteUri || 'https://example.com/restaurant',
      primaryType: mockFound.primaryType,
      cuisine: mockFound.cuisine,
      photos: mockFound.photos || [],
      estimatedCostPerPersonBdt: mockFound.estimatedCostPerPersonBdt || mockFound.menu?.estimatedCostPerPerson?.amount || null,
      costRangeMinBdt: mockFound.costRangeMinBdt || null,
      costRangeMaxBdt: mockFound.costRangeMaxBdt || null,
      priceConfidence: mockFound.priceConfidence || 'Verified',
      costDerivation: mockFound.costDerivation || mockFound.menu?.estimatedCostPerPerson?.derivedFrom || 'Calculated from verified menu item portion averages',
      menuSource: mockFound.menuSource || mockFound.menu?.sourceName || 'Official Listing',
      menuSourceUrl: mockFound.menuSourceUrl || mockFound.menu?.sourceUrl || mockFound.websiteUri || '',
      menuLastUpdated: mockFound.menuLastUpdated || mockFound.menu?.lastChecked || '2026-10-01',
      menu: mockFound.menu || null,
      halal: mockFound.halal ?? null,
      vegetarian: mockFound.vegetarian ?? null,
      no_beef: mockFound.no_beef ?? null,
      servesLunch: mockFound.servesLunch ?? true,
      servesDinner: mockFound.servesDinner ?? true,
      takeout: mockFound.takeout ?? true,
      dineIn: mockFound.dineIn ?? true
    };
    globalCache.set(cacheKey, detail, 1800);
    return detail;
  }

  try {
    quotaManager.checkAndRecordGoogleApiCall('places');
    const apiKey = process.env.GOOGLE_SERVER_KEY;
    const url = `${PLACES_DETAILS_BASE_URL}/${encodeURIComponent(placeId)}`;
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(8000),
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,nationalPhoneNumber,internationalPhoneNumber,websiteUri,regularOpeningHours,currentOpeningHours.openNow,rating,priceLevel,photos'
      }
    });

    if (!response.ok) {
      throw new Error(`Google Place Details failed with code ${response.status}`);
    }

    const data = await response.json();
    const detail = {
      id: data.id,
      displayName: data.displayName?.text || 'Restaurant',
      formattedAddress: data.formattedAddress || '',
      location: data.location,
      rating: data.rating || 4.0,
      priceLevel: normalizePriceLevel(data.priceLevel),
      openNow: data.currentOpeningHours?.openNow ?? true,
      regularOpeningHours: data.regularOpeningHours || null,
      nationalPhoneNumber: data.nationalPhoneNumber || null,
      internationalPhoneNumber: data.internationalPhoneNumber || null,
      websiteUri: data.websiteUri || null,
      photos: data.photos || []
    };

    globalCache.set(cacheKey, detail, 1800); // 30 min cache
    return detail;
  } catch (err) {
    logger.error({ err: err.message, placeId }, 'Error getting place details');
    // Fallback to minimal info
    return {
      id: placeId,
      displayName: 'Dhaka Restaurant',
      formattedAddress: 'Dhaka, Bangladesh',
      rating: 4.5,
      priceLevel: 2,
      openNow: true,
      nationalPhoneNumber: null,
      internationalPhoneNumber: null,
      websiteUri: null,
      photos: []
    };
  }
}
