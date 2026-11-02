/**
 * Storage module abstraction wrapping localStorage
 * Easily swappable for a database or remote storage in the future
 */

const STORAGE_KEYS = {
  PREFERENCES: 'gulshan_finder_prefs',
  FAVORITES: 'gulshan_finder_favorites',
  HISTORY: 'gulshan_finder_history',
  TASTE_PROFILE: 'gulshan_finder_taste_profile',
  TASTE_LEARNING_ENABLED: 'gulshan_finder_learning_enabled',
  TASTE_LOG: 'gulshan_finder_taste_log',
  FOOD_PROFILE: 'gulshan_finder_food_profile'
};

const DEFAULT_FOOD_PROFILE = {
  preferredCuisines: [],
  budgetMin: 200,
  budgetMax: 1200,
  dietary: {
    halal: false,
    vegetarian: false,
    vegan: false,
    no_beef: false
  },
  dislikedFoods: []
};

class AppStorage {
  constructor() {
    this.isAvailable = typeof window !== 'undefined' && Boolean(window.localStorage);
    this.memoryFallback = new Map();
  }

  getItem(key) {
    if (this.isAvailable) {
      try {
        const val = window.localStorage.getItem(key);
        return val ? JSON.parse(val) : null;
      } catch (e) {
        console.warn(`Error reading ${key} from localStorage:`, e);
      }
    }
    return this.memoryFallback.get(key) || null;
  }

  setItem(key, value) {
    if (this.isAvailable) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return;
      } catch (e) {
        console.warn(`Error writing ${key} to localStorage:`, e);
      }
    }
    this.memoryFallback.set(key, value);
  }

  removeItem(key) {
    if (this.isAvailable) {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch (e) {}
    }
    this.memoryFallback.delete(key);
  }

  clear() {
    if (this.isAvailable) {
      try {
        window.localStorage.clear();
      } catch (e) {}
    }
    this.memoryFallback.clear();
  }

  // --- Domain Methods ---

  getPreferences() {
    return this.getItem(STORAGE_KEYS.PREFERENCES) || {
      cuisine: 'All',
      priority: 'Best Overall',
      budget: 2,
      locationPreset: 'Dhaka'
    };
  }

  savePreferences(prefs) {
    const current = this.getPreferences();
    this.setItem(STORAGE_KEYS.PREFERENCES, { ...current, ...prefs });
  }

  getFavorites() {
    return this.getItem(STORAGE_KEYS.FAVORITES) || [];
  }

  isFavorite(placeId) {
    const list = this.getFavorites();
    return list.some(item => item.id === placeId);
  }

  toggleFavorite(restaurant) {
    const list = this.getFavorites();
    const idx = list.findIndex(r => r.id === restaurant.id);
    let isNowFavorite = false;
    if (idx >= 0) {
      list.splice(idx, 1);
      isNowFavorite = false;
    } else {
      list.unshift({
        id: restaurant.id,
        displayName: restaurant.displayName,
        cuisine: restaurant.cuisine,
        priceLevel: restaurant.priceLevel,
        rating: restaurant.rating,
        formattedAddress: restaurant.formattedAddress,
        savedAt: new Date().toISOString()
      });
      isNowFavorite = true;
    }
    this.setItem(STORAGE_KEYS.FAVORITES, list);
    return isNowFavorite;
  }

  getHistory() {
    return this.getItem(STORAGE_KEYS.HISTORY) || [];
  }

  addSearchHistory(searchEntry) {
    const list = this.getHistory();
    // Prepend new search, keep max 20
    const entry = {
      ...searchEntry,
      timestamp: new Date().toISOString(),
      id: Date.now().toString()
    };
    const updated = [entry, ...list.filter(e => 
      !(e.cuisine === searchEntry.cuisine && e.locationName === searchEntry.locationName && e.priority === searchEntry.priority)
    )].slice(0, 20);
    this.setItem(STORAGE_KEYS.HISTORY, updated);
    return updated;
  }

  getTasteProfile() {
    return this.getItem(STORAGE_KEYS.TASTE_PROFILE) || {
      Japanese: 50,
      Bangladeshi: 50,
      Indian: 50,
      Chinese: 50,
      Korean: 50,
      'Fast Food': 50,
      Cafe: 50,
      Kabab: 50,
      Biriyani: 50,
      Dessert: 50,
      Coffee: 50,
      Burger: 50
    };
  }

  saveTasteProfile(profile) {
    this.setItem(STORAGE_KEYS.TASTE_PROFILE, profile);
  }

  isLearningEnabled() {
    const val = this.getItem(STORAGE_KEYS.TASTE_LEARNING_ENABLED);
    return val !== false; // Enabled by default
  }

  setLearningEnabled(enabled) {
    this.setItem(STORAGE_KEYS.TASTE_LEARNING_ENABLED, Boolean(enabled));
  }

  logTasteEvent(event) {
    const logs = this.getItem(STORAGE_KEYS.TASTE_LOG) || [];
    logs.unshift({
      ...event,
      timestamp: new Date().toISOString()
    });
    this.setItem(STORAGE_KEYS.TASTE_LOG, logs.slice(0, 100)); // keep last 100
  }

  getFoodProfile() {
    const p = this.getItem(STORAGE_KEYS.FOOD_PROFILE);
    if (!p) return { ...DEFAULT_FOOD_PROFILE, dietary: { ...DEFAULT_FOOD_PROFILE.dietary } };
    return {
      preferredCuisines: Array.isArray(p.preferredCuisines) ? p.preferredCuisines : [],
      budgetMin: Number.isFinite(p.budgetMin) ? p.budgetMin : 200,
      budgetMax: Number.isFinite(p.budgetMax) ? p.budgetMax : 1200,
      dietary: {
        halal: Boolean(p.dietary?.halal),
        vegetarian: Boolean(p.dietary?.vegetarian),
        vegan: Boolean(p.dietary?.vegan),
        no_beef: Boolean(p.dietary?.no_beef)
      },
      dislikedFoods: Array.isArray(p.dislikedFoods) ? p.dislikedFoods : []
    };
  }

  saveFoodProfile(profile) {
    const current = this.getFoodProfile();
    const updated = {
      ...current,
      ...profile,
      dietary: { ...current.dietary, ...(profile?.dietary || {}) }
    };
    this.setItem(STORAGE_KEYS.FOOD_PROFILE, updated);
    return updated;
  }

  resetFoodProfile() {
    this.setItem(STORAGE_KEYS.FOOD_PROFILE, { ...DEFAULT_FOOD_PROFILE, dietary: { ...DEFAULT_FOOD_PROFILE.dietary } });
    return { ...DEFAULT_FOOD_PROFILE, dietary: { ...DEFAULT_FOOD_PROFILE.dietary } };
  }

  exportAllData() {
    return {
      preferences: this.getPreferences(),
      favorites: this.getFavorites(),
      history: this.getHistory(),
      tasteProfile: this.getTasteProfile(),
      foodProfile: this.getFoodProfile(),
      learningEnabled: this.isLearningEnabled(),
      exportedAt: new Date().toISOString()
    };
  }

  deleteAllData() {
    this.clear();
  }
}

export const appStorage = new AppStorage();
export default appStorage;
