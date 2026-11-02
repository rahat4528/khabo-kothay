import { REAL_DHAKA_RESTAURANTS } from '../data/dhaka-restaurants.js';

export const PRESET_LOCATIONS = {
  "Bailey Road": { lat: 23.7410, lng: 90.4072, name: "Bailey Road" },
  "Banani": { lat: 23.7937, lng: 90.4046, name: "Banani Road 11" },
  "Baridhara": { lat: 23.7998, lng: 90.4215, name: "Baridhara Diplomatic Zone" },
  "Bashundhara R/A": { lat: 23.8164, lng: 90.4278, name: "Bashundhara R/A Gate" },
  "Dhanmondi": { lat: 23.7465, lng: 90.3760, name: "Dhanmondi Road 27" },
  "Gulshan 1": { lat: 23.7785, lng: 90.4178, name: "Gulshan 1 Circle" },
  "Gulshan 2": { lat: 23.7925, lng: 90.4150, name: "Gulshan 2 Circle" },
  "Mirpur": { lat: 23.8071, lng: 90.3686, name: "Mirpur 10 Circle" },
  "Notun Bazar": { lat: 23.7975, lng: 90.4234, name: "Notun Bazar Bus Stand" },
  "Uttara": { lat: 23.8728, lng: 90.3984, name: "Uttara Sector 3" }
};

export const MOCK_RESTAURANTS = REAL_DHAKA_RESTAURANTS;

export function normalizeCuisine(cuisine) {
  if (!cuisine || cuisine === 'All') return 'All';
  const c = String(cuisine).trim().toLowerCase();
  if (c === 'biryani' || c === 'biriyani') return 'biriyani';
  if (c === 'kabab' || c === 'kebab') return 'kabab';
  if (c === 'cafe' || c === 'coffee') return 'cafe';
  if (c === 'bangladeshi' || c === 'bengali') return 'bangladeshi';
  return c;
}

export function matchesCuisine(restaurantCuisine, targetCuisine) {
  if (!targetCuisine || targetCuisine === 'All') return true;
  const targetNorm = normalizeCuisine(targetCuisine);
  const restNorm = normalizeCuisine(restaurantCuisine);
  if (targetNorm === restNorm) return true;
  if ((targetNorm === 'cafe' && restNorm === 'coffee') || (targetNorm === 'coffee' && restNorm === 'cafe')) return true;
  if ((targetNorm === 'burger' && restNorm === 'fast food') || (targetNorm === 'fast food' && restNorm === 'burger')) return true;
  return false;
}

export function getMockCandidates(cuisine, budget = null, origin = null) {
  let list = [...MOCK_RESTAURANTS];
  if (cuisine && cuisine !== "All") {
    const cuisineFiltered = list.filter(r => matchesCuisine(r.cuisine, cuisine));
    if (cuisineFiltered.length > 0) {
      list = cuisineFiltered;
    }
  }
  if (budget) {
    const budgetNum = parseInt(budget, 10);
    if (!isNaN(budgetNum)) {
      const budgetMaxMap = { 1: 500, 2: 1200, 3: 2500, 4: 10000 };
      const maxAllowedCost = budgetMaxMap[budgetNum] || 2000;
      const budgetFiltered = list.filter(r => {
        if (r.estimatedCostPerPersonBdt && r.estimatedCostPerPersonBdt <= maxAllowedCost) return true;
        if (r.priceLevel !== null && r.priceLevel <= budgetNum) return true;
        return false;
      });
      if (budgetFiltered.length > 0) {
        list = budgetFiltered;
      }
    }
  }
  if (origin && origin.lat && origin.lng) {
    list.sort((a, b) => {
      const distA = Math.hypot(a.location.latitude - origin.lat, a.location.longitude - origin.lng);
      const distB = Math.hypot(b.location.latitude - origin.lat, b.location.longitude - origin.lng);
      return distA - distB;
    });
  }
  return list.slice(0, 25);
}

