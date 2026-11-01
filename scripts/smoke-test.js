import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

async function runSmokeTest() {
  const hasKeys = Boolean(process.env.GOOGLE_SERVER_KEY && process.env.USE_MOCK_DATA !== 'true');

  if (!hasKeys) {
    console.log('SKIPPED: no keys (running smoke test in mock data mode instead)');
  } else {
    console.log('Running smoke test against live Google Cloud APIs...');
  }

  const endpoint = `${BASE_URL}/api/recommend`;
  const payload = {
    lat: 23.7975, // Notun Bazar
    lng: 90.4234,
    cuisine: 'Japanese',
    priority: 'Fastest',
    budget: 2
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Token': process.env.APP_CLIENT_TOKEN || ''
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Smoke test HTTP ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const results = data.results || [];

    if (results.length === 0) {
      throw new Error('Smoke test failed: No recommendations returned.');
    }

    const first = results[0];

    // Assertions
    const errors = [];
    if (typeof first.distanceMeters !== 'number') errors.push('Missing distanceMeters number');
    if (typeof first.durationSeconds !== 'number') errors.push('Missing durationSeconds traffic-aware travel time');
    if (!['Low', 'Moderate', 'Heavy'].includes(first.trafficLevel)) errors.push(`Invalid trafficLevel: ${first.trafficLevel}`);
    if (typeof first.transport?.cheapestEstimatedCostBdt !== 'number') errors.push('Missing estimated transit cost');
    if (!first.reason || typeof first.reason !== 'string') errors.push('Missing plain language reason');

    if (errors.length > 0) {
      throw new Error(`Smoke test assertions failed:\n- ${errors.join('\n- ')}`);
    }

    console.log(`✅ Smoke test PASSED: ${results.length} places returned from Notun Bazar.`);
    console.log(`   Top pick: "${first.displayName}"`);
    console.log(`   Distance: ${(first.distanceMeters / 1000).toFixed(1)} km | Travel Time: ${Math.round(first.durationSeconds / 60)} min | Traffic: ${first.trafficLevel}`);
    console.log(`   Transit Cost: ~৳${first.transport.cheapestEstimatedCostBdt} (${first.transport.cheapestFeasibleMode})`);
    console.log(`   Reason: "${first.reason}"`);
    return true;
  } catch (err) {
    console.error('❌ Smoke test failed:', err.message);
    process.exitCode = 1;
    return false;
  }
}

if (process.argv[1] && process.argv[1].endsWith('smoke-test.js')) {
  runSmokeTest();
}

export { runSmokeTest };
