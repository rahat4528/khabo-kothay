import { globalCache } from './cache.js';

/**
 * Weather context service for Dhaka using Open-Meteo (free, no API key required)
 */
export async function getWeatherContext(lat = 23.7925, lng = 90.4150) {
  const roundedLat = Number(lat).toFixed(2);
  const roundedLng = Number(lng).toFixed(2);
  const cacheKey = `weather_${roundedLat}_${roundedLng}`;

  const cached = globalCache.get(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${roundedLat}&longitude=${roundedLng}&current=temperature_2m,precipitation,rain,weather_code&timezone=Asia%2FDhaka`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // 4s timeout

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Open-Meteo returned status ${res.status}`);
    }

    const data = await res.json();
    const current = data.current || {};
    const rain = (current.rain || 0) + (current.precipitation || 0);
    const tempC = Math.round(current.temperature_2m ?? 28);
    const isRaining = Boolean(rain > 0.1 || (current.weather_code != null && [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(current.weather_code)));

    const result = {
      isRaining,
      tempC,
      precipitationMm: rain,
      condition: isRaining ? 'Rainy' : (tempC > 32 ? 'Hot' : 'Clear'),
      note: isRaining ? 'Monsoon / rain in Dhaka: Rickshaw or car recommended over walking.' : null
    };

    globalCache.set(cacheKey, result, 900); // 15 min TTL
    return result;
  } catch (err) {
    // Graceful fallback for offline / mock testing
    const fallback = {
      isRaining: false,
      tempC: 28,
      precipitationMm: 0,
      condition: 'Clear',
      note: null
    };
    globalCache.set(cacheKey, fallback, 900);
    return fallback;
  }
}
