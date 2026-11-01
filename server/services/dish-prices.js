import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DISHES_FILE = path.join(__dirname, '..', 'data', 'dish-prices.json');

// Baseline seed dish prices
const SEED_DISH_PRICES = [
  {
    id: 'dish-1',
    restaurantId: 'mock_kacchi_1',
    restaurantName: 'Grand Nawab Kacchi',
    dishName: 'Kacchi Biryani (Basmati)',
    priceBdt: 450,
    portion: 'Full',
    source: 'community-reported',
    timestamp: '2026-10-10T12:00:00.000Z',
    status: 'verified'
  },
  {
    id: 'dish-2',
    restaurantId: 'mock_kacchi_1',
    restaurantName: 'Grand Nawab Kacchi',
    dishName: 'Kacchi Biryani (Basmati)',
    priceBdt: 470,
    portion: 'Full',
    source: 'community-reported',
    timestamp: '2026-10-12T14:30:00.000Z',
    status: 'verified'
  },
  {
    id: 'dish-3',
    restaurantId: 'mock_jap_1',
    restaurantName: 'Tokyo Ramen Bar',
    dishName: 'Shoyu Ramen',
    priceBdt: 680,
    portion: 'Regular Bowl',
    source: 'restaurant-confirmed',
    timestamp: '2026-10-08T18:00:00.000Z',
    status: 'verified'
  }
];

export function loadDishReports() {
  try {
    if (fs.existsSync(DISHES_FILE)) {
      const data = JSON.parse(fs.readFileSync(DISHES_FILE, 'utf8'));
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (err) {
    logger.error({ err }, 'Failed reading dish-prices.json');
  }
  return [...SEED_DISH_PRICES];
}

export function saveDishReports(reports) {
  try {
    const dir = path.dirname(DISHES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DISHES_FILE, JSON.stringify(reports, null, 2), 'utf8');
  } catch (err) {
    logger.error({ err }, 'Failed saving dish prices');
  }
}

export function addDishPriceReport({ restaurantId, restaurantName, dishName, priceBdt, portion = 'Regular', context = 'dine_in' }) {
  if (!dishName || !priceBdt) {
    throw new Error('dishName and priceBdt are required');
  }
  if (typeof dishName !== 'string' || dishName.trim().length === 0 || dishName.trim().length > 80) {
    throw new Error('dishName must be between 1 and 80 characters');
  }

  const price = Number(priceBdt);
  if (!Number.isFinite(price) || price < 10 || price > 50000) {
    throw new Error('Price must be between 10 and 50000 BDT');
  }

  const reports = loadDishReports();

  // Find existing median for outlier checking (0.3x - 3.0x rule)
  const existingForDish = reports.filter(r =>
    r.status === 'verified' && (
      (restaurantId && r.restaurantId === restaurantId) ||
      r.dishName.toLowerCase() === dishName.toLowerCase()
    )
  );

  let status = 'verified';
  if (existingForDish.length >= 2) {
    const fares = existingForDish.map(r => r.priceBdt).sort((a, b) => a - b);
    const median = fares[Math.floor(fares.length / 2)];
    if (price < 0.3 * median || price > 3.0 * median) {
      status = 'pending_moderation'; // Outlier flagged for review
    }
  }

  const newReport = {
    id: `dish-rep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    restaurantId: restaurantId || 'unknown',
    restaurantName: restaurantName || 'Restaurant',
    dishName: String(dishName).trim(),
    priceBdt: price,
    portion: String(portion).trim(),
    context,
    source: 'community-reported',
    timestamp: new Date().toISOString(),
    status
  };

  reports.push(newReport);
  saveDishReports(reports);

  return newReport;
}

export function getDishPrices({ restaurantId, dishName }) {
  const reports = loadDishReports().filter(r => r.status === 'verified');
  let matching = reports;

  if (restaurantId) {
    matching = matching.filter(r => r.restaurantId === restaurantId);
  }
  if (dishName) {
    matching = matching.filter(r => r.dishName.toLowerCase().includes(dishName.toLowerCase()));
  }

  if (matching.length === 0) {
    return {
      dishName: dishName || 'Unknown Dish',
      hasData: false,
      message: 'Price information is limited for this dish.'
    };
  }

  const prices = matching.map(r => r.priceBdt).sort((a, b) => a - b);
  const medianPrice = prices[Math.floor(prices.length / 2)];
  const newestReport = matching.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

  return {
    dishName: matching[0].dishName,
    hasData: true,
    medianPriceBdt: medianPrice,
    reportsCount: matching.length,
    newestReportDate: newestReport.timestamp,
    disclaimer: 'Community-reported, not an official menu price.',
    recentReports: matching.slice(-5)
  };
}

export default {
  loadDishReports,
  saveDishReports,
  addDishPriceReport,
  getDishPrices
};
