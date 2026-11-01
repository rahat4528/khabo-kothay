import thresholdsConfig from '../config/thresholds.json' with { type: 'json' };
import featureFlags from '../config/featureFlags.js';
import globalCache from './cache.js';
import redisStore from './redis-store.js';

const costControl = thresholdsConfig.costControl || {
  dailySearchLimitPerDevice: 50,
  monthlyGlobalRequestBudget: 10000
};

class QuotaAndUsageManager {
  constructor() {
    this.deviceDailyUsage = new Map(); // key: `${deviceId}_${dateStr}` -> count
    this.deviceUsageDate = this.getCurrentDateKey();
    this.monthlyUsage = {
      monthKey: this.getCurrentMonthKey(),
      count: 0,
      budget: costControl.monthlyGlobalRequestBudget || 10000,
      killSwitchActive: false
    };
    this.endpointCounters = new Map(); // key: endpoint -> { count, totalDurationMs, errors }
    this.totalRequests = 0;
    this.googleDailyDate = this.getCurrentDateKey();
    this.googleDailyCalls = 0;
    this.googleCallsBreakdown = { places: 0, routes: 0 };
  }

  getCurrentDateKey() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  getCurrentMonthKey() {
    return new Date().toISOString().slice(0, 7); // YYYY-MM
  }

  async syncFromRedis() {
    if (!redisStore.isConfigured()) return;
    try {
      const today = this.getCurrentDateKey();
      const remote = await redisStore.get('google_daily_calls:' + today);
      if (typeof remote === 'number' && remote > this.googleDailyCalls) {
        this.googleDailyCalls = remote;
      }
    } catch {}
  }

  /**
   * Hard daily cap on external Google Places & Routes API requests (fails closed)
   */
  checkAndRecordGoogleApiCall(apiName = 'places') {
    const maxGoogleDaily = parseInt(process.env.MAX_GOOGLE_REQUESTS_PER_DAY || '200', 10);
    const today = this.getCurrentDateKey();
    if (this.googleDailyDate !== today) {
      this.googleDailyDate = today;
      this.googleDailyCalls = 0;
      this.googleCallsBreakdown = { places: 0, routes: 0 };
    }

    if (this.googleDailyCalls >= maxGoogleDaily) {
      const err = new Error(`Daily Google API request cap reached (${this.googleDailyCalls}/${maxGoogleDaily}). Failing closed to prevent unexpected costs.`);
      err.statusCode = 429;
      err.code = 'GOOGLE_DAILY_CAP_EXCEEDED';
      throw err;
    }

    this.googleDailyCalls++;
    if (this.googleCallsBreakdown[apiName] !== undefined) {
      this.googleCallsBreakdown[apiName]++;
    } else {
      this.googleCallsBreakdown[apiName] = 1;
    }

    if (redisStore.isConfigured()) {
      redisStore.set('google_daily_calls:' + today, this.googleDailyCalls, 86400).catch?.(() => {});
    }

    return {
      count: this.googleDailyCalls,
      limit: maxGoogleDaily,
      remaining: maxGoogleDaily - this.googleDailyCalls
    };
  }

  /**
   * Check and record a search request against device daily limit
   */
  checkAndRecordDeviceSearch(deviceId) {
    if (!featureFlags.enableDeviceDailyLimit) {
      return { allowed: true, count: 0, limit: Infinity };
    }

    const today = this.getCurrentDateKey();
    if (this.deviceUsageDate !== today) {
      // Counters are per-day; drop yesterday's keys instead of keeping them forever.
      this.deviceDailyUsage.clear();
      this.deviceUsageDate = today;
    }
    const key = `${deviceId}_${today}`;
    const current = this.deviceDailyUsage.get(key) || 0;
    const limit = costControl.dailySearchLimitPerDevice || 50;

    if (current >= limit) {
      return {
        allowed: false,
        count: current,
        limit,
        resetAt: `${today}T23:59:59Z`,
        message: `Daily search limit reached (${limit}/${limit}). Please try again tomorrow.`
      };
    }

    this.deviceDailyUsage.set(key, current + 1);
    return {
      allowed: true,
      count: current + 1,
      limit,
      remaining: limit - (current + 1)
    };
  }

  /**
   * Check global monthly budget status
   */
  checkGlobalMonthlyBudget() {
    const currentMonth = this.getCurrentMonthKey();
    if (this.monthlyUsage.monthKey !== currentMonth) {
      // New calendar month reset
      this.monthlyUsage.monthKey = currentMonth;
      this.monthlyUsage.count = 0;
      this.monthlyUsage.killSwitchActive = false;
    }

    if (!featureFlags.enableMonthlyBudgetKillSwitch) {
      return { isExceeded: false, count: this.monthlyUsage.count, budget: this.monthlyUsage.budget };
    }

    const isExceeded = this.monthlyUsage.killSwitchActive || (this.monthlyUsage.count >= this.monthlyUsage.budget);
    return {
      isExceeded,
      killSwitchActive: this.monthlyUsage.killSwitchActive,
      count: this.monthlyUsage.count,
      budget: this.monthlyUsage.budget,
      friendlyMessage: isExceeded
        ? 'Global search capacity limit reached for this period. Showing cached dining options.'
        : null
    };
  }

  /**
   * Record every API request by endpoint and response status
   */
  recordEndpointHit(endpoint, status = 200, durationMs = 0) {
    this.totalRequests++;

    // Increment monthly counter
    const currentMonth = this.getCurrentMonthKey();
    if (this.monthlyUsage.monthKey !== currentMonth) {
      this.monthlyUsage.monthKey = currentMonth;
      this.monthlyUsage.count = 0;
    }
    this.monthlyUsage.count++;

    // Check if auto kill-switch should trip
    if (this.monthlyUsage.count >= this.monthlyUsage.budget) {
      this.monthlyUsage.killSwitchActive = true;
    }

    // Endpoint aggregation
    const cleanEndpoint = endpoint.replace(/\?.*$/, '');
    const current = this.endpointCounters.get(cleanEndpoint) || { count: 0, totalDurationMs: 0, errors: 0 };
    current.count++;
    current.totalDurationMs += durationMs;
    if (status >= 400) {
      current.errors++;
    }
    this.endpointCounters.set(cleanEndpoint, current);
  }

  /**
   * Toggle kill switch manually
   */
  setKillSwitch(active) {
    this.monthlyUsage.killSwitchActive = Boolean(active);
    return this.monthlyUsage.killSwitchActive;
  }

  /**
   * Get administrative usage metrics
   */
  getUsageReport() {
    const cacheStats = globalCache.getStats();
    const endpoints = {};
    for (const [ep, data] of this.endpointCounters.entries()) {
      endpoints[ep] = {
        count: data.count,
        avgDurationMs: data.count > 0 ? Math.round(data.totalDurationMs / data.count) : 0,
        errors: data.errors
      };
    }

    const today = this.getCurrentDateKey();
    let todaySearches = 0;
    let activeDevicesToday = 0;
    for (const [key, count] of this.deviceDailyUsage.entries()) {
      if (key.endsWith(today)) {
        todaySearches += count;
        activeDevicesToday++;
      }
    }

    return {
      totalRequests: this.totalRequests,
      currentMonth: {
        month: this.monthlyUsage.monthKey,
        requests: this.monthlyUsage.count,
        budget: this.monthlyUsage.budget,
        killSwitchActive: this.monthlyUsage.killSwitchActive,
        budgetConsumedPercent: Number(((this.monthlyUsage.count / this.monthlyUsage.budget) * 100).toFixed(1))
      },
      today: {
        date: today,
        searches: todaySearches,
        activeDevices: activeDevicesToday,
        googleApiCalls: this.googleDailyCalls,
        googleApiLimit: parseInt(process.env.MAX_GOOGLE_REQUESTS_PER_DAY || '200', 10),
        googleCallsBreakdown: this.googleCallsBreakdown
      },
      endpoints,
      cache: cacheStats
    };
  }

  resetDailyUsage() {
    this.deviceDailyUsage.clear();
  }
}

export const quotaManager = new QuotaAndUsageManager();
export default quotaManager;
