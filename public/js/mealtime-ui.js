import { esc } from './escape.js';
import { searchMealTimeApi, sendMealTimeFeedbackApi } from './api.js';

// Local storage key for saved personal places (never logged or sent to analytics)
const SAVED_PLACES_KEY = 'khabo_device_saved_places';

export function getSavedPlaces() {
  try {
    const raw = localStorage.getItem(SAVED_PLACES_KEY);
    return raw ? JSON.parse(raw) : { office: null, home: null, university: null };
  } catch (e) {
    return { office: null, home: null, university: null };
  }
}

export function savePlaceLocally(key, placeObj) {
  try {
    const existing = getSavedPlaces();
    existing[key] = placeObj;
    localStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(existing));
  } catch (e) {}
}

// There's no geocoder, so typed area names are matched against the server's preset Dhaka
// areas. Unmatched names are rejected rather than silently given fixed coordinates.
export function resolveArea(name, presets = {}) {
  const q = String(name || '').trim().toLowerCase();
  if (!q) return null;
  for (const [key, spot] of Object.entries(presets)) {
    const k = key.toLowerCase();
    if (k.includes(q) || q.includes(k) || String(spot.name || '').toLowerCase().includes(q)) {
      return { name: spot.name || key, lat: spot.lat, lng: spot.lng };
    }
  }
  return null;
}

export function initMealTimeUI({
  containerId = 'mealTimeControlPanel',
  resultsContainerId = 'resultsContainer',
  resultsHeadingId = 'resultsHeading',
  resultsCountTagId = 'resultsCountTag',
  originGetter,
  presetsGetter = () => ({}),
  onCandidateSelected
}) {
  const container = document.getElementById(containerId);
  const resultsContainer = document.getElementById(resultsContainerId);
  const heading = document.getElementById(resultsHeadingId);
  const countTag = document.getElementById(resultsCountTagId);
  if (!container) return;

  // Determine current Dhaka meal mode
  const now = new Date();
  const dhakaHours = (now.getUTCHours() + 6) % 24;
  let defaultMode = 'lunch';
  let defaultTime = 45;

  if (dhakaHours >= 6 && dhakaHours < 10.5) {
    defaultMode = 'breakfast';
    defaultTime = 30;
  } else if (dhakaHours >= 10.5 && dhakaHours < 15) {
    defaultMode = 'lunch';
    defaultTime = 45;
  } else if (dhakaHours >= 15 && dhakaHours < 19) {
    defaultMode = 'snacks';
    defaultTime = 30;
  } else {
    defaultMode = 'dinner';
    defaultTime = 90;
  }

  let activeMode = defaultMode;
  let activeTime = defaultTime;
  let activeReturnDest = 'same-as-origin';
  let activeTransport = 'car';
  let activeDiningStyle = 'dine_in';
  let activeBuffer = 'Balanced';
  let activeLeaveAt = null;

  // Render Control Panel HTML
  container.innerHTML = `
    <div class="mealtime-panel">
      <!-- 1. Pick a Meal Mode -->
      <div class="control-group">
        <label class="control-label">🍽️ 1. Choose Meal Period</label>
        <div class="chips-scroll-row" id="mealModeChips">
          <button type="button" class="chip meal-mode-chip ${activeMode === 'breakfast' ? 'active' : ''}" data-mode="breakfast" data-default-time="30">
            🌅 Breakfast (30m)
          </button>
          <button type="button" class="chip meal-mode-chip ${activeMode === 'lunch' ? 'active' : ''}" data-mode="lunch" data-default-time="45">
            🍛 Lunch (45m)
          </button>
          <button type="button" class="chip meal-mode-chip ${activeMode === 'snacks' ? 'active' : ''}" data-mode="snacks" data-default-time="30">
            ☕ Evening Snacks (30m)
          </button>
          <button type="button" class="chip meal-mode-chip ${activeMode === 'dinner' ? 'active' : ''}" data-mode="dinner" data-default-time="90">
            🍲 Dinner (90m)
          </button>
        </div>
      </div>

      <!-- 2. Pick Total Available Time -->
      <div class="control-group">
        <label class="control-label">⏱️ 2. Total Time Available (Round-Trip)</label>
        <div class="chips-grid" id="mealTimeDurationChips">
          <button type="button" class="chip time-chip ${activeTime === 15 ? 'active' : ''}" data-time="15">15 min</button>
          <button type="button" class="chip time-chip ${activeTime === 30 ? 'active' : ''}" data-time="30">30 min</button>
          <button type="button" class="chip time-chip ${activeTime === 45 ? 'active' : ''}" data-time="45">45 min</button>
          <button type="button" class="chip time-chip ${activeTime === 60 ? 'active' : ''}" data-time="60">60 min</button>
          <button type="button" class="chip time-chip ${activeTime === 90 ? 'active' : ''}" data-time="90">90 min</button>
          <button type="button" class="chip time-chip" id="customTimeBtn">Custom</button>
        </div>
        <div id="customTimeInputRow" class="custom-time-row hidden">
          <input type="number" id="customTimeInput" class="form-input" min="15" max="360" placeholder="e.g. 50" />
          <span class="input-unit">minutes</span>
        </div>
      </div>

      <!-- 3. Return Destination -->
      <div class="control-group">
        <label class="control-label">📍 3. Where are you returning to?</label>
        <div class="chips-scroll-row" id="mealReturnDestChips">
          <button type="button" class="chip return-dest-chip active" data-dest="same-as-origin">
            ↩️ Same as start
          </button>
          <button type="button" class="chip return-dest-chip" data-dest="office">
            🏢 Office
          </button>
          <button type="button" class="chip return-dest-chip" data-dest="home">
            🏠 Home
          </button>
          <button type="button" class="chip return-dest-chip" data-dest="university">
            🎓 University
          </button>
          <button type="button" class="chip return-dest-chip" data-dest="custom">
            📌 Custom Place
          </button>
        </div>
        <div id="customDestRow" class="custom-dest-row hidden">
          <input type="text" id="customDestName" class="form-input" placeholder="e.g. Banani Road 11 or Dhanmondi 27" />
        </div>
      </div>

      <!-- 4. Transport Mode -->
      <div class="control-group">
        <label class="control-label">🚗 4. How are you travelling?</label>
        <div class="chips-grid" id="mealTransportChips">
          <button type="button" class="chip transport-chip active" data-transport="car">🚗 Car</button>
          <button type="button" class="chip transport-chip" data-transport="walk">🚶 Walk</button>
          <button type="button" class="chip transport-chip" data-transport="rickshaw">🛺 Rickshaw</button>
          <button type="button" class="chip transport-chip" data-transport="cng">🟢 CNG Auto</button>
          <button type="button" class="chip transport-chip" data-transport="ride-share">🚖 Ride-Share</button>
          <button type="button" class="chip transport-chip" data-transport="motorcycle">🏍️ Motorcycle</button>
          <button type="button" class="chip transport-chip" data-transport="bicycle">🚲 Bicycle</button>
          <button type="button" class="chip transport-chip" data-transport="public_transport">🚌 Public Bus</button>
        </div>
      </div>

      <!-- 5. Advanced Options Toggle -->
      <details class="mealtime-advanced-accordion">
        <summary class="advanced-summary">⚙️ Advanced Options (Dining Style, Buffer, Leave At)</summary>
        <div class="advanced-content">
          <div class="advanced-grid">
            <div class="adv-group">
              <label class="control-label">Dining Style:</label>
              <div class="chips-row" id="mealDiningStyleChips">
                <button type="button" class="chip style-chip active" data-style="dine_in">🍽️ Dine-In</button>
                <button type="button" class="chip style-chip" data-style="takeaway">🛍️ Takeaway (Eat after return)</button>
              </div>
            </div>

            <div class="adv-group">
              <label class="control-label">Safety Buffer:</label>
              <div class="chips-row" id="mealBufferChips">
                <button type="button" class="chip buffer-chip active" data-buffer="Balanced">⚖️ Balanced</button>
                <button type="button" class="chip buffer-chip" data-buffer="Safe">🛡️ Safe (+50%)</button>
                <button type="button" class="chip buffer-chip" data-buffer="Flexible">⚡ Flexible (-50%)</button>
              </div>
            </div>

            <div class="adv-group">
              <label class="control-label">Planned Departure:</label>
              <input type="time" id="mealLeaveAtInput" class="form-input" />
              <span class="help-text">Leave blank to plan from right now</span>
            </div>
          </div>
        </div>
      </details>

      <!-- Search Submit Button -->
      <div class="mealtime-action-row">
        <button type="button" id="executeMealTimeSearchBtn" class="btn btn-primary btn-lg btn-block">
          ⏱️ Find Food Within My Time
        </button>
      </div>
    </div>
  `;

  // --- Attach Event Listeners ---

  // 1. Meal Mode Selection
  container.querySelectorAll('.meal-mode-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.meal-mode-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeMode = btn.dataset.mode;
      const defTime = parseInt(btn.dataset.defaultTime, 10);
      activeTime = defTime;

      // Update time chip active state
      container.querySelectorAll('.time-chip').forEach(tb => {
        tb.classList.toggle('active', parseInt(tb.dataset.time, 10) === defTime);
      });
      document.getElementById('customTimeInputRow')?.classList.add('hidden');
    });
  });

  // 2. Time Selection
  container.querySelectorAll('.time-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.time-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (btn.id === 'customTimeBtn') {
        const row = document.getElementById('customTimeInputRow');
        row?.classList.remove('hidden');
        const input = document.getElementById('customTimeInput');
        if (input) {
          input.focus();
          input.oninput = () => {
            const val = parseInt(input.value, 10);
            if (!isNaN(val) && val >= 15) activeTime = val;
          };
        }
      } else {
        document.getElementById('customTimeInputRow')?.classList.add('hidden');
        activeTime = parseInt(btn.dataset.time, 10);
      }
    });
  });

  // 3. Return Destination Selection
  container.querySelectorAll('.return-dest-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.return-dest-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const destType = btn.dataset.dest;
      activeReturnDest = destType;

      const customRow = document.getElementById('customDestRow');
      if (destType === 'custom') {
        customRow?.classList.remove('hidden');
      } else {
        customRow?.classList.add('hidden');
        if (['office', 'home', 'university'].includes(destType)) {
          const saved = getSavedPlaces();
          if (!saved[destType]) {
            // Friendly prompt to store locally on this device
            const spotName = prompt(`Enter the area for your ${destType.toUpperCase()} (saved only on this device):`, 'Dhaka');
            if (spotName) {
              const presets = presetsGetter();
              const spot = resolveArea(spotName, presets);
              if (spot) {
                savePlaceLocally(destType, spot);
              } else {
                alert(`Unknown area "${spotName}". Try one of: ${Object.keys(presets).join(', ')}`);
              }
            }
          }
        }
      }
    });
  });

  // 4. Transport Selection
  container.querySelectorAll('.transport-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.transport-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTransport = btn.dataset.transport;
    });
  });

  // 5. Dining Style Selection
  container.querySelectorAll('.style-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.style-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeDiningStyle = btn.dataset.style;
    });
  });

  // 6. Buffer Selection
  container.querySelectorAll('.buffer-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.buffer-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeBuffer = btn.dataset.buffer;
    });
  });

  // Search Action
  document.getElementById('executeMealTimeSearchBtn')?.addEventListener('click', async () => {
    const origin = originGetter ? originGetter() : { lat: 23.8103, lng: 90.4125, name: 'Dhaka' };
    
    // Resolve leaveAt if time input provided
    let leaveAtIso = null;
    const leaveInput = document.getElementById('mealLeaveAtInput');
    if (leaveInput && leaveInput.value) {
      const parts = leaveInput.value.split(':');
      const leaveDate = new Date();
      leaveDate.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
      leaveAtIso = leaveDate.toISOString();
    }

    // Resolve return destination
    let destPayload = 'same-as-origin';
    if (activeReturnDest !== 'same-as-origin') {
      const saved = getSavedPlaces();
      if (saved[activeReturnDest]) {
        destPayload = saved[activeReturnDest];
      } else if (activeReturnDest === 'custom') {
        const customName = document.getElementById('customDestName')?.value || 'Banani';
        const presets = presetsGetter();
        const spot = resolveArea(customName, presets);
        if (!spot) {
          resultsContainer.innerHTML = `
            <div class="empty-results-card card-glass">
              <h3>⚠️ Unknown return area</h3>
              <p>We couldn't place "${esc(customName)}". Try one of: ${esc(Object.keys(presets).join(', '))}.</p>
            </div>
          `;
          return;
        }
        destPayload = spot;
      }
    }

    resultsContainer.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Calculating time-feasible dining options...</p></div>';

    try {
      const res = await searchMealTimeApi({
        mode: activeMode,
        availableMinutes: activeTime,
        leaveAt: leaveAtIso,
        origin,
        destination: destPayload,
        transport: activeTransport,
        diningStyle: activeDiningStyle,
        bufferPreference: activeBuffer
      });

      renderMealTimeResults({
        data: res,
        resultsContainer,
        heading,
        countTag,
        onCandidateSelected,
        onRelaxationTap: (relaxationType) => {
          if (relaxationType === 'takeaway') {
            container.querySelector('[data-style="takeaway"]')?.click();
            document.getElementById('executeMealTimeSearchBtn')?.click();
          } else if (relaxationType === 'add_time') {
            activeTime += 15;
            document.getElementById('executeMealTimeSearchBtn')?.click();
          }
        }
      });
    } catch (err) {
      resultsContainer.innerHTML = `
        <div class="empty-results-card card-glass">
          <h3>⚠️ Unable to Complete Search</h3>
          <p>${esc(err.message)}</p>
        </div>
      `;
    }
  });
}

const EXPLAIN_LABELS = {
  spareScore: 'Spare time',
  speedScore: 'Total trip speed',
  trafficScore: 'Traffic reliability',
  openMarginScore: 'Time before closing',
  routeScore: 'Route efficiency',
  prefScore: 'Taste match',
  budgetScore: 'Budget fit',
  ratingScore: 'Rating'
};

function directionsHref(r) {
  const loc = r.location;
  const destination = loc && Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)
    ? `${loc.latitude},${loc.longitude}`
    : encodeURIComponent(r.name || '');
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

/**
 * Render Meal-Time Result Cards with Segmented Time Bars
 */
export function renderMealTimeResults({
  data,
  resultsContainer,
  heading,
  countTag,
  onCandidateSelected,
  onRelaxationTap
}) {
  if (heading) heading.textContent = `Time-Feasible Food (${data.summary.mode.toUpperCase()})`;
  if (countTag) countTag.textContent = `${data.results.length} fit your break`;

  if (!data.results || data.results.length === 0) {
    let altsHtml = '';
    if (data.suggestions && data.suggestions.length > 0) {
      altsHtml = `
        <div class="alternatives-box">
          <h4>💡 Computed Alternatives:</h4>
          <div class="alternatives-list">
            ${data.suggestions.map(s => `
              <button type="button" class="btn btn-outline btn-sm alt-btn" data-type="${esc(s.type)}">
                ${esc(s.label)}
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    const shortestText = data.summary.shortestFeasibleTime
      ? `<p class="shortest-time-note">Shortest time needed for any restaurant: <strong>${esc(data.summary.shortestFeasibleTime)} min</strong></p>`
      : '';

    resultsContainer.innerHTML = `
      <div class="no-result-container card-glass">
        <h3>⏳ ${esc(data.summary.message)}</h3>
        <p>Your total trip (travel both ways, waiting, eating, and safety buffer) exceeds your available time.</p>
        ${shortestText}
        ${altsHtml}
      </div>
    `;

    resultsContainer.querySelectorAll('.alt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (onRelaxationTap) onRelaxationTap(btn.dataset.type);
      });
    });
    return;
  }

  let html = '';
  data.results.forEach((r, idx) => {
    const tb = r.timeBreakdown;
    const statusClass = r.status === 'SAFE' ? 'status-safe' : r.status === 'TIGHT' ? 'status-tight' : 'status-not-rec';
    const statusText = r.status === 'SAFE' ? '🟢 Safe Fit' : r.status === 'TIGHT' ? '🟡 Tight Fit' : '🔴 Over Time';

    html += `
      <article class="mealtime-card card-glass" data-id="${esc(r.placeId)}">
        <div class="card-header-row">
          <div class="card-title-group">
            <span class="rank-badge">#${idx + 1}</span>
            <h3 class="restaurant-name">${esc(r.name)}</h3>
            <span class="cuisine-pill">${esc(r.cuisine || 'Various')}</span>
          </div>
          <div class="status-badge ${statusClass}">
            ${statusText}
          </div>
        </div>

        <div class="time-meta-row">
          <span class="meta-item">🏁 <strong>Back by: ${esc(r.backByTime)}</strong></span>
          <span class="meta-item">🕒 <strong>${r.openCheck.closesAt ? `Open until ${esc(r.openCheck.closesAt)}` : 'Hours unverified'}</strong></span>
          <span class="meta-item spare-highlight">⏱️ <strong>${esc(tb.spareMinutes)} min spare</strong></span>
        </div>

        <!-- Segmented Time Bar -->
        <div class="segmented-time-bar-wrapper">
          <div class="segmented-time-bar">
            <div class="segment seg-outbound" style="flex: ${esc(tb.outbound)}" title="Travel There: ${esc(tb.outbound)}m">
              <span class="seg-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span><span class="seg-label">${esc(tb.outbound)}m</span>
            </div>
            <div class="segment seg-wait" style="flex: ${esc(tb.wait)}" title="Wait & Order: ${esc(tb.wait)}m">
              <span class="seg-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span><span class="seg-label">${esc(tb.wait)}m</span>
            </div>
            <div class="segment seg-eat" style="flex: ${tb.eat || 1}" title="Eat: ${esc(tb.eat)}m">
              <span class="seg-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 2v20M6 2v7a3 3 0 0 0 6 0V2M9 9v13"/></svg></span><span class="seg-label">${esc(tb.eat)}m</span>
            </div>
            <div class="segment seg-return" style="flex: ${esc(tb.return)}" title="Travel Back: ${esc(tb.return)}m">
              <span class="seg-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg></span><span class="seg-label">${esc(tb.return)}m</span>
            </div>
            <div class="segment seg-buffer" style="flex: ${esc(tb.buffer)}" title="Safety Buffer: ${esc(tb.buffer)}m">
              <span class="seg-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span><span class="seg-label">${esc(tb.buffer)}m</span>
            </div>
            ${tb.spareMinutes > 0 ? `
              <div class="segment seg-spare" style="flex: ${esc(tb.spareMinutes)}" title="Spare Time: ${esc(tb.spareMinutes)}m">
                <span class="seg-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span><span class="seg-label">${esc(tb.spareMinutes)}m</span>
              </div>
            ` : ''}
          </div>
          <div class="segmented-bar-legend">
            <span>Total: <strong>${esc(tb.total)}m</strong> / ${esc(r.availableMinutes)}m</span>
          </div>
        </div>

        <!-- Plain Language Reason -->
        <p class="mealtime-reason">${esc(r.reasons[0])}</p>

        <!-- Flags -->
        <div class="card-flags-row">
          ${r.flags.map(f => `<span class="flag-chip">⚠️ ${esc(f)}</span>`).join('')}
        </div>

        <!-- Card Actions -->
        <div class="card-footer-actions">
          ${r.phoneNumber ? `<a href="tel:${esc(r.phoneNumber)}" class="btn btn-outline btn-sm">📞 Call</a>` : ''}
          <a href="${esc(directionsHref(r))}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">🧭 Directions</a>
          <button type="button" class="btn btn-secondary btn-sm explain-btn" data-idx="${idx}" aria-expanded="false">🔍 Explain This</button>
        </div>
        <div class="mealtime-explain hidden" id="mealtime-explain-${idx}">
          <p><strong>Score ${esc(Math.round((r.score || 0) * 100))}/100</strong> — how this pick was weighed:</p>
          <ul>
            ${Object.entries(r.scoreComponents || {}).map(([k, v]) => `<li>${esc(EXPLAIN_LABELS[k] || k)}: ${esc(Math.round(v * 100))}%</li>`).join('')}
          </ul>
        </div>
      </article>
    `;
  });

  // Flexible "Slightly over your time" section
  if (data.flexibleResults && data.flexibleResults.length > 0) {
    html += `
      <details class="flexible-results-accordion card-glass">
        <summary class="flex-summary">
          ⚠️ Slightly over your time (${esc(data.flexibleResults.length)} places +1 to +5 min over)
        </summary>
        <p class="flex-warning">These places slightly exceed your ${esc(data.summary.availableMinutes)}-minute break. Only pick them if you have extra leeway.</p>
        <div class="flexible-cards-list">
          ${data.flexibleResults.map(r => `
            <div class="flex-card-row">
              <div class="flex-card-info">
                <strong>${esc(r.name)}</strong> (${esc(r.cuisine)}) • Total: ${esc(r.timeBreakdown.total)} min
              </div>
              <span class="over-chip">+${Math.abs(r.spareMinutes)} min over</span>
            </div>
          `).join('')}
        </div>
      </details>
    `;
  }

  // Trip Feedback Card
  html += `
    <div class="trip-feedback-card card-glass" id="mealTimeFeedbackBox">
      <h4>⏱️ After your trip: How long did it actually take?</h4>
      <div class="trip-feedback-form">
        <input type="number" id="actualMinutesInput" class="form-input form-input-sm" placeholder="Actual total minutes" min="10" max="300" />
        <label class="checkbox-label">
          <input type="checkbox" id="wasLateCheck" /> Was late returning
        </label>
        <button type="button" id="submitMealFeedbackBtn" class="btn btn-primary btn-sm">Submit</button>
      </div>
      <div id="mealFeedbackThanks" class="feedback-thanks hidden">Thanks! This helps tune future wait & eat benchmarks. 🙌</div>
    </div>
  `;

  resultsContainer.innerHTML = html;

  resultsContainer.querySelectorAll('.explain-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = document.getElementById(`mealtime-explain-${btn.dataset.idx}`);
      const open = panel?.classList.toggle('hidden') === false;
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  resultsContainer.querySelectorAll('.mealtime-card').forEach((card, idx) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      if (onCandidateSelected) onCandidateSelected(data.results[idx]);
    });
  });

  // Attach feedback submit handler
  document.getElementById('submitMealFeedbackBtn')?.addEventListener('click', async () => {
    const input = document.getElementById('actualMinutesInput');
    const check = document.getElementById('wasLateCheck');
    const val = parseInt(input?.value, 10);
    if (!isNaN(val) && val > 0) {
      await sendMealTimeFeedbackApi({
        mode: data.summary.mode,
        venueType: data.results[0]?.venueType || 'quick-service',
        plannedMinutes: data.summary.availableMinutes,
        actualMinutes: val,
        wasLate: Boolean(check?.checked)
      });
      document.getElementById('mealFeedbackThanks')?.classList.remove('hidden');
    }
  });
}
