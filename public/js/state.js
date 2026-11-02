import { appStorage } from './storage.js';

class AppState {
  constructor() {
    const prefs = appStorage.getPreferences();
    this.currentLocation = {
      lat: 23.8103,
      lng: 90.4125,
      name: prefs.locationPreset || 'Dhaka'
    };
    this.cuisine = prefs.cuisine || 'All';
    this.mood = null;
    this.priority = prefs.priority || 'Best Overall';
    this.budget = prefs.budget || 2;
    this.openNowOnly = false;
    this.distanceRadius = null;
    this.rawResults = [];
    this.facetFilters = {
      priceMin: 0,
      priceMax: 5000,
      availability: [],
      cuisines: [],
      restaurantTypes: [],
      dietary: [],
      features: []
    };
    this.results = [];
    this.topPicks = null;
    this.activeRestaurant = null;
    this.isLoading = false;
    this.weather = null;
    this.config = {
      googleBrowserKey: '',
      useMockData: true,
      presetLocations: {}
    };
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(changeType) {
    for (const listener of this.listeners) {
      listener(this, changeType);
    }
  }

  setState(updates, changeType = 'update') {
    Object.assign(this, updates);
    this.notify(changeType);
  }

  setLocation(lat, lng, name) {
    this.currentLocation = { lat, lng, name };
    appStorage.savePreferences({ locationPreset: name });
    this.notify('location');
  }

  setCuisine(cuisine) {
    this.cuisine = cuisine;
    this.mood = null; // selecting explicit cuisine resets mood
    appStorage.savePreferences({ cuisine });
    this.notify('filter');
  }

  setMood(mood) {
    this.mood = mood;
    this.notify('mood');
  }

  setPriority(priority) {
    this.priority = priority;
    appStorage.savePreferences({ priority });
    this.notify('priority');
  }

  setBudget(budget) {
    this.budget = budget;
    appStorage.savePreferences({ budget });
    let min = 0;
    let max = 5000;
    if (budget === 1) { min = 0; max = 400; }
    else if (budget === 2) { min = 400; max = 950; }
    else if (budget === 3) { min = 950; max = 2000; }
    else if (budget === 4) { min = 2000; max = 5000; }
    this.facetFilters.priceMin = min;
    this.facetFilters.priceMax = max;
    this.results = this.getFilteredResults();
    this.notify('budget');
  }

  setResults(results, topPicks) {
    this.rawResults = Array.isArray(results) ? results : [];
    this.results = this.getFilteredResults();
    this.topPicks = topPicks;
    this.activeRestaurant = this.results.length > 0 ? this.results[0] : null;
    this.notify('results');
  }

  setFacetFilters(filters) {
    this.facetFilters = { ...this.facetFilters, ...filters };
    this.results = this.getFilteredResults();
    this.notify('facetFilter');
  }

  resetFacetFilters() {
    this.facetFilters = {
      priceMin: 0,
      priceMax: 5000,
      availability: [],
      cuisines: [],
      restaurantTypes: [],
      dietary: [],
      features: []
    };
    this.results = this.getFilteredResults();
    this.notify('facetFilter');
  }

  getFilteredResults() {
    if (!Array.isArray(this.rawResults)) return [];
    const f = this.facetFilters;

    return this.rawResults.filter(r => {
      // 1. Price Range filter: check verified menu items & estimated cost per person
      const min = Number.isFinite(f.priceMin) ? f.priceMin : 0;
      const max = Number.isFinite(f.priceMax) ? f.priceMax : Infinity;

      let matchesPrice = false;
      const costPerPerson = r.estimatedCostPerPersonBdt || r.estimatedCostPerPerson?.amount || r.menu?.estimatedCostPerPerson?.amount;

      // Check estimated cost per person first (definitive BDT metric)
      if (costPerPerson && costPerPerson >= min && costPerPerson <= max) {
        matchesPrice = true;
      }

      // Check menu items
      if (!matchesPrice && r.menu?.items && r.menu.items.length > 0) {
        const itemPrices = r.menu.items.map(i => i.price !== undefined ? i.price : i.priceBdt).filter(Number.isFinite);
        if (itemPrices.length > 0) {
          const minItemPrice = Math.min(...itemPrices);
          const maxItemPrice = Math.max(...itemPrices);
          if (minItemPrice <= max && maxItemPrice >= min) {
            matchesPrice = true;
          }
        }
      }

      // Check price level fallback if neither cost nor items match
      if (!matchesPrice && !costPerPerson && (!r.menu?.items || r.menu.items.length === 0)) {
        const tierMap = {
          1: { min: 0, max: 400 },
          2: { min: 400, max: 950 },
          3: { min: 950, max: 2000 },
          4: { min: 2000, max: 5000 }
        };
        const tier = tierMap[r.priceLevel || 2] || { min: 0, max: 5000 };
        if (tier.min <= max && tier.max >= min) {
          matchesPrice = true;
        }
      }
      if (!matchesPrice) return false;

      // 2. Availability filter
      if (f.availability && f.availability.length > 0) {
        const openStatus = r.openStatus || {};
        const matchesAvail = f.availability.some(av => {
          if (av === 'open_now') return openStatus.isOpen === true;
          if (av === 'closing_soon') return openStatus.isClosingSoon === true;
          if (av === 'open_late') {
            const closeTime = r.regularOpeningHours?.closingTime || '23:00';
            const [cH] = closeTime.split(':').map(Number);
            return cH >= 23 || (cH >= 0 && cH <= 4);
          }
          return false;
        });
        if (!matchesAvail) return false;
      }

      // 3. Cuisine filter
      if (f.cuisines && f.cuisines.length > 0) {
        if (!f.cuisines.some(c => c.toLowerCase() === (r.cuisine || '').toLowerCase())) {
          return false;
        }
      }

      // 4. Restaurant Type filter
      if (f.restaurantTypes && f.restaurantTypes.length > 0) {
        const types = r.restaurantType || ['Dine-in', 'Casual Dining'];
        if (!f.restaurantTypes.some(t => types.includes(t))) {
          return false;
        }
      }

      // 5. Dietary filter
      if (f.dietary && f.dietary.length > 0) {
        if (f.dietary.includes('halal') && r.halal === false) return false;
        if (f.dietary.includes('vegetarian') && !r.vegetarian) return false;
        if (f.dietary.includes('vegan') && !r.vegan) return false;
        if (f.dietary.includes('no_beef') && !r.no_beef) return false;
      }

      // 6. Features filter
      if (f.features && f.features.length > 0) {
        const placeFeatures = r.features || [];
        if (!f.features.every(feat => placeFeatures.includes(feat))) {
          return false;
        }
      }

      return true;
    });
  }

  setOpenNowOnly(val) {
    this.openNowOnly = Boolean(val);
    this.notify('filter');
  }

  setDistanceRadius(meters) {
    this.distanceRadius = meters ? Number(meters) : null;
    this.notify('filter');
  }

  setActiveRestaurant(restaurant) {
    this.activeRestaurant = restaurant;
    this.notify('activeRestaurant');
  }
}

export const state = new AppState();
export default state;
