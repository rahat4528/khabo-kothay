# Architecture & Engineering Decisions (ADR)

## Phase P1 Decisions: Reliability, Cost Control and Operations

### 1. Coarse Spatial Grid for Candidate Caching (~300 meters)
- **Decision**: Round GPS coordinates to a ~300m grid cell (`0.0027°` latitude and `0.0029°` longitude in Dhaka) when checking the candidate cache.
- **Rationale**: Diners searching from nearby spots (e.g. across the street, a block away in Gulshan-1, or around Notun Bazar) are searching within the exact same radius. Caching by coarse grid reduces redundant Google Places text search API calls by up to 75%.
- **TTL**: 10 minutes (`600s`).

### 2. Stale-While-Revalidate (SWR) with 5-Minute Grace Window
- **Decision**: When a cache entry is expired but within the 5-minute grace window, immediately serve the cached result and trigger background asynchronous revalidation.
- **Rationale**: Mobile network latencies in Dhaka can vary wildly. SWR ensures mobile clients receive near-instantaneous recommendations (<50ms) without waiting for network hops, while keeping data fresh.

### 3. Dual-Layer Cache Architecture (Memory + Optional Upstash Redis)
- **Decision**: Keep a synchronous high-speed in-memory LRU/TTL store as primary, with optional asynchronous fire-and-forget sync to Upstash Redis via REST API when configured.
- **Rationale**: Standard Node.js async Redis calls can introduce latency spikes or crashing hazards if the Redis server goes down. The hybrid adapter ensures synchronous in-memory hits, and if Redis is unreachable, seamlessly continues operations without user-facing impact.

### 4. Lazy Place Details Loading
- **Decision**: Candidate searches (`/recommend` and `/restaurants/search`) only request basic place information (id, name, location, rating, price level, photos). Detailed fields (phone numbers, full weekly opening hours, website) are queried only when `/api/v1/places/:id/details` is explicitly invoked by opening a restaurant modal.
- **Rationale**: Directly halves Google Maps Platform API SKU costs.

### 5. Multi-Tiered Cost Control: Device Daily Limits & Global Monthly Kill-Switch
- **Decision**: Enforce a 50 search/day limit per device (`X-Device-Id` or IP). Enforce a 10,000 monthly request budget. When the monthly budget is exceeded or kill-switch is flipped, the engine never throws HTTP 500; instead, it returns cached/mock candidates marked with `isBudgetFallback: true` and a polite transparent message.
- **Rationale**: Protects operators against unexpected cloud billing spikes while maintaining an uninterrupted user experience.

### 6. Backward-Compatible API Versioning (`/api/v1` and `/api`)
- **Decision**: Implement `/api/v1` as the canonical versioned root documented in [docs/openapi.yaml](file:///docs/openapi.yaml), while mounting `/api` as a transparent alias.
- **Rationale**: Guarantees existing mobile APKs, web clients, and prior test suites continue running without regressions.

### 7. Structured Logging with Strict PII Redaction (pino)
- **Decision**: Use `pino` with request IDs (`X-Request-Id`). Redact auth tokens, cookies, phone numbers, and coarse-grain GPS coordinates.
- **Rationale**: Complies with GDPR/privacy principles and ensures no identifiable user coordinates are stored in server logs.

### 8. EAS Update Channel Segmentation
- **Decision**: Map EAS build profiles to dedicated channels: `development`, `preview`, and `production`.
- **Rationale**: Enables over-the-air hotfixes for JavaScript bundle updates without requiring users to download and reinstall new standalone `.apk` files.

## Phase P2 Decisions: Smarter Decisions (Recommendation Intelligence)

### 9. Departure Time Predictions & Diurnal Traffic Curve Fallback
- **Decision**: Request future predicted traffic with Routes API `departureTime` at +0, +15, +30, and +60 minutes for the top 3 picks. If Google API is unreachable, quota-throttled, or in mock mode, gracefully fall back to a modeled Dhaka diurnal traffic congestion curve based on rush hours (08:30-10:30 and 16:30-20:30).
- **Labeling Rule**: Every prediction item and suggestion MUST be explicitly labeled `predicted` (`isPrediction: true`) to comply with truth-in-data principles.

### 10. Time-Budget Mode ("I have 45 minutes")
- **Decision**: Model total time needed as `2 * oneWayTravelTimeMinutes` (round-trip travel) plus a configurable `diningDurationMinutes` mapped by cuisine in `server/config/context.json` (e.g., Coffee: 15m, Fast food: 20m, Bangladeshi/Biriyani: 30-35m, Fine dining: 60m).
- **Enforcement**: Drops candidates whose total round-trip + dining time exceeds user's budget. Furthermore, drops candidates that close before estimated arrival + dining duration.

### 11. Bounded Multi-Armed Bandit with Simplex Projection
- **Decision**: Use an epsilon-greedy bandit algorithm to personalize factor weights (`time`, `cost`, `rating`, `distance`, `price`, `traffic`, `taste`) based on implicit choice signals (opens, directions, ratings).
- **Guardrails**:
  - Strict lower bound: `0.05` (5%).
  - Strict upper bound: `0.50` (50%).
  - Weights are projected onto the probability simplex so that $\sum w_i = 1.0$.
  - Slow learning rate: $\eta = 0.05$.
  - Provide an on/off toggle and a reset button that restores default baseline weights.
  - Explain personalization in plain language (e.g. "You often pick faster places, so speed counts a bit more for you now.").

### 12. Strict Unverified Dietary Preferences & Allergen Disclaimer
- **Decision**: Filter candidates by Halal, Vegetarian, No Beef, and Spice Level using cuisine baseline characteristics in `server/config/preferences.json`.
- **Safety Directive**: Google Places data for dietary attributes is unreliable. All returned preference matches are labeled `unverified`.
- **Allergen Notice**: The app MUST NEVER claim allergen safety anywhere. Responses and UI include: *"Dietary and spice preferences are unverified and estimated. Never rely on this for allergen safety."*

### 13. Counterfactual Trade-off Explanations
- **Decision**: Compute what candidate would have won under an alternative priority (Cheapest or Fastest) and compare against the active top pick.
- **Format**: Show concise counterfactual trade-offs: *"If you chose Cheapest: B saves ৳40 but adds 12 min."*

### 14. Anonymized Evaluation Harness & Replay Framework
- **Decision**: Implement an opt-in evaluation logger that stores impressions, opens, and directions in `server/data/eval-sessions.jsonl` without PII. Provide `scripts/eval.js` to compute top-1 and top-3 hit rates and Mean Reciprocal Rank (MRR) across weight configurations, with an A/B testing flag.

### 15. Progressive Web App (PWA) vs Native Android App Trade-offs
- **Decision**: Deliver an installable PWA for initial testing on Android phones via Chrome before shipping the standalone APK.
- **Capabilities Delivered by PWA**:
  - Instant installation from Google Chrome without Play Store dependencies.
  - Offline app shell caching via Service Worker (`public/sw.js`).
  - Standalone fullscreen display (`display: standalone`) with matching theme colors.
  - Fast updates upon page reload via `skipWaiting`.
- **What a PWA Cannot Do (Postponed for Native App)**:
  - Native push notification channels and alarms when the browser process is inactive.
  - Android home screen dynamic app shortcuts and app icon notification badges.
  - Background geofencing and continuous background GPS tracking.
  - Android 13+ Material You system-themed monochrome launcher icons (requires native Android XML adaptive icon configuration).
  - Hardware-level haptic engine integration and Play Integrity device attestation.

### 16. Dhaka Location Database Geographic Scope and Modeling Decisions
- **Decision**: Define geographic coverage using two nested levels:
  - **Level 1 (Core Dhaka)**: Dhaka North City Corporation (DNCC, 54 wards) and Dhaka South City Corporation (DSCC, 75 wards).
  - **Level 2 (Greater Dhaka / Metropolitan Planning Area)**: RAJUK Detailed Area Plan (DAP) coverage area (~1,528 km²). Includes Savar Upazila urban/industrial clusters (Savar town, Ashulia, Birulia, Aminbazar, Hemayetpur), Keraniganj Upazila urban fringe (Hasnabad, Zinjira, Tegharia, Jhilmil, Aganagar), Tongi and Gazipur urban corridor (GCC wards 43–57, Board Bazar, Gazipur Chowrasta), and Narayanganj urban corridor (NCC, Fatullah, Siddhirganj, Chashara, Kanchpur).
- **Exclusion Boundary**: Outlying rural upazilas of Gazipur (Kaliakair, Kapasia, Sreepur, Kaliganj), Narayanganj (Araihazar, Sonargaon, Rupganj outer rural tracts), Munshiganj, and Manikganj are excluded from metropolitan dining search to prevent irrelevant remote matches.
- **Hierarchy Distinction**: Administrative hierarchy (Division → District → City Corporation → Ward / Thana) is strictly decoupled from local geographic perception and common address usage (Broad Area → Sub-area → Sector / Block / Road / Landmark). Wards do not strictly equal neighborhoods, and police stations do not define dining zones.
- **Subdivision Policy**: Verified subdivisions (e.g. Uttara Sectors 1-18, Mirpur 1-14, Gulshan 1-2, Badda zones, Old Dhaka mohallas) are indexed with distinct geographic centers and bounding features while preserving parent area relationships.
- **Safety and Anti-Fabrication**: Any unverified administrative or coordinate details are flagged as UNCERTAIN or approximate local boundaries based on physical geography (rivers, rail tracks, canals, arterial roads). Center coordinates do not represent polygon boundaries.

### 17. Meal-Time Mode Architecture, Feasibility Hard Gate & Assumptions
- **Product Proposition**: A time-aware recommendation system, not a restaurant filter. The user's available time is the TOTAL round-trip time from departure to return (or arrival at final destination), never just dining time.
- **Core Feasibility Formula**:
  - `Total required time = outbound travel + waiting/ordering + eating + return travel + safety buffer`.
  - `Spare time = available time - total required time`.
  - Feasible only if `spare time >= 0` AND the restaurant is open at expected arrival through finish time (`arrival + wait + eat`) plus a 30-minute last-order margin before closing.
  - Feasibility is a hard gate: high rating, popularity, or proximity can NEVER override feasibility.
- **Status Classification**:
  - `SAFE`: `spare time >= 3` minutes.
  - `TIGHT`: `0 <= spare time < 3` minutes (e.g. 45 min total on 45 min available).
  - `NOT_RECOMMENDED`: `spare time < 0` minutes (excluded from results, except in Flexible slightly-over section).
  - Statuses are ALWAYS rendered with an icon AND text label, never color alone.
- **Safety Buffer Preferences**:
  - `Balanced` (default): 1.0x baseline buffer (`max(minBuffer, 10% of trip)`) + vehicle and traffic extras (car +3 parking, ride-share +4 pickup/+1 drop-off, motorcycle +1, bicycle +1, moderate traffic +1, heavy traffic +3).
  - `Safe`: 1.5x multiplier on buffer.
  - `Flexible`: 0.5x multiplier on buffer (minimum 2 minutes). Flexible also exposes places exceeding time by up to 5 minutes in a separate, collapsed section "Slightly over your time (+N min)" with warning.
- **Independent Legs & Predicted Return Traffic**:
  - Outbound (origin -> restaurant) and Return (restaurant -> destination) legs are calculated independently without assuming symmetry.
  - Return leg departure time is set to `leaveTime + outbound + wait + eat` and explicitly labeled "predicted traffic".
  - Time zone is strictly enforced as `Asia/Dhaka` across UTC/midnight crossovers.
- **Dhaka Public Transport Policy**:
  - Google Routes API does not reliably return scheduled transit GTFS in Dhaka. Public transport requests return a 400 error advising that public transport times aren't available in Dhaka and recommending Rickshaw or CNG.
- **Device-Only Saved Places**:
  - Office, Home, and University coordinates are stored strictly on the local device (`localStorage` / `AsyncStorage`), never logged, sent to analytics, or persisted server-side.
- **Cost Control Pipeline**:
  - 1. Search candidates with minimal field mask.
  - 2. Prune by geometry straight-line distance limit: `maxOneWayMinutes * fastestPlausibleSpeed`.
  - 3. Single Routes matrix outbound and return capped at 20 candidates.
  - 4. Apply time and opening feasibility gates.
  - 5. Fetch detailed field mask (`servesBreakfast`, `servesLunch`, `servesDinner`, `takeout`, `dineIn`) only for top 10.
- **Opening & Service Verification**:
  - Explicit `servesLunch = false` (or mode equivalent) eliminates the place.
  - Missing meal service or hours flags the place as `Meal service unverified` or `Hours unverified` rather than guessing or silently omitting.
  - Crowding/rush is based on time-of-day heuristics (+3m peak lunch, +5m peak dinner) and clearly labeled as estimated.
- **No-Result Experience**:
  - Never display generic "No restaurants found".
  - Shows "No restaurants safely fit your X-minute break." with computed alternatives (Takeaway, Quicker venues, Add 15 min, Different transport) with real counts and shortest time needed for any restaurant.
- **Feature Flag**:
  - Enclosed behind `mealTimeMode` flag (controlled via `FEATURE_MEAL_TIME_MODE`).


## Phase P0 Decisions: Native Java Android App & Python FastAPI Architecture Transition

### 12. Native Android App (Java 17, Material 3, MVVM) & Python FastAPI Transition
- **Decision**: Port client layer to native Java 17 under `/android` following Android Blueprint v3 specifications, and port backend engine to Python FastAPI under `/api`. Keep `/server` and `/mobile` as legacy references until parity checks pass.
- **Contract First**: `docs/openapi.json` is the sole source of truth.
- **Environment & Android SDK Prerequisite**:
  - OpenJDK 17.0.20.1 Temurin is verified and present on the system.
  - Android SDK (ANDROID_HOME), sdkmanager, and Gradle require installation or environment variable configuration on Windows. Android Studio with bundled Android SDK (API 34/35) and cmdline-tools is required for building `/android`.
- **Backend Fixes Prior to Android Cutover**:
  - All Section 8 bugs (price propagation, error handling, cold-boot timeout, empty lists) were resolved and verified in the backend layer with 100% test coverage before beginning the native client skeleton.

## Phase F Decisions: Shared Foundation (v4 Blueprint)

### 13. Discrete Feature Flags
- **Decision**: Define 11 discrete feature flags in \`FeatureFlags.java\` (Android) and \`Settings\` (FastAPI): \`outingCost\`, \`closingAlerts\`, \`budgetTracker\`, \`occasionFilters\`, \`homeWidget\`, \`parkingAccess\`, \`hiddenGems\` (false), \`seasonalGuides\`, \`dishSearch\`, \`wantToTry\`, \`geofenceReminders\` (false).
- **Rationale**: Allows toggling any feature off cleanly without regression or breaking app builds.

### 14. Centralized Notification Registry
- **Decision**: Centralize all notifications in \`NotificationHelper\` across 5 channels (\`closing_soon\`, \`budget\`, \`guides\`, \`reminders\`, \`nearby\`).
- **Enforcement**:
  - Global master switch + per-channel switches.
  - Quiet hours strictly enforced (default 23:00 to 07:00 Asia/Dhaka).
  - Global daily cap of 3 notifications across all channels combined.
  - \`POST_NOTIFICATIONS\` permission requested only when the user explicitly enables an alert.

### 15. WorkManager Conventions & Battery Reality
- **Decision**: All background tasks use WorkManager with \`NetworkType.CONNECTED\` and \`setRequiresBatteryNotLow(true)\`. No exact alarms.
- **User Disclosure**: Inform users in UI that notifications may experience delays due to manufacturer battery savers and Android Doze mode.

### 16. Device-First Privacy Strategy
- **Decision**: Full adherence to \`docs/PRIVACY_MATRIX.md\`. Personal locations (Home, Office, Uni), spend history, budget settings, and accessibility needs remain exclusively in on-device SQLite. The server receives only boolean/derived request flags.

### 17. Timezone Asia/Dhaka & Clock Abstraction
- **Decision**: System clock locked to \`Asia/Dhaka\` zone with \`Clock\` interface allowing deterministic time manipulation in unit tests via \`FakeClock\`.

### 18. Room Versioned Migrations & Exported Schemas
- **Decision**: Room database set to \`exportSchema = true\` with versioned migration pipeline for the 6 new tables: \`favorite_alert\`, \`budget_settings\`, \`spend_entries\`, \`want_to_try\`, \`saved_guide\`, \`guide_reminder\`.

## Phase Fix 1 Decisions: Navigation Clarity, Bottom Bar & Accessible Actions

### 12. Material 3 Bottom Navigation Bar with Mandatory Labeled Mode
- **Decision**: Configure `BottomNavigationView` / `NavigationBarView` with `labelVisibilityMode="labeled"` strictly capped at 5 destinations: Home, Meal-Time, Search, Saved, Me.
- **Rationale**: On mobile devices without hover cursors, small icon-only buttons lead to guesswork and mis-taps. Visible text labels alongside icons ensure unambiguous affordances for all daily dining workflows.

### 13. Top-Level Drawer vs. Detail Back Arrow Hierarchy
- **Decision**: Top-level screens feature an accessible hamburger button opening a navigation drawer for secondary utilities (Seasonal Guides, Add Spot, Bill Splitter, Notifications & Alerts, Settings, Help & Diagnostics, About). Detail screens strictly replace the hamburger icon with an accessible back arrow (`<-`) per standard Android navigation conventions.
- **Rationale**: Keeps primary everyday actions one tap away without burying core dining discovery, while maintaining clear hierarchical depth.

### 14. Universal Content & State Descriptions
- **Decision**: Every icon-only element receives bilingual `contentDescription` attributes in `values/strings.xml` and `values-bn/strings.xml`. All toggle controls (Favorite, Want to Try, Closing Alert Bell) dynamically set state descriptions via `ViewCompat.setStateDescription` (e.g., "Saved" vs "Not saved").
- **Rationale**: Full compliance with Android TalkBack accessibility, large font scaling (200%), and WCAG 48dp minimum touch targets.

## Release-Gate Decisions

### 19. Licensing & Repository Copyright
- **Decision**: No license file is committed (`LICENSE` kept absent from repository index).
- **Rationale**: Per project release gate specification, no open-source license has been chosen yet. Without an explicit license file, default copyright applies and all rights are reserved by the repository owner until explicitly designated.

## 15-Features Upgrade Decisions (Phase 0: Master Audit Baseline)

### 20. Preservation of Existing Architecture & Live Production Deployment
- **Decision**: Retain the Node.js Express backend (`server/`) as the active production server deployed on Render (`https://khabo-kothay-backend.onrender.com`), serving `/api` and `/api/v1` routes. The Python FastAPI stub (`api/`) is archived as a reference prototype.
- **Rationale**: Full compliance with Section 1.1 and 1.2 (Technology Policy). Extending the existing tested, live-deployed backend eliminates deployment disruption and preserves all existing 159 Vitest tests, ranking weights, and Meal-Time scheduling algorithms.

### 21. Android Native Java MVVM Architecture Preservation
- **Decision**: The React Native Expo application in `/mobile` is designated as the official production mobile client (`com.khabokothay.app`), with the native Java prototype in `/android` archived as a reference prototype.
- **Rationale**: Section 1.5 strictly prohibits changing package name or signing keys to ensure seamless update installation over existing builds (`versionCode` strictly monotonic). Java code style will be consistently maintained across all new Android features.

### 22. Phase-by-Phase Delivery & Reversible Commits
- **Decision**: Strictly execute the 8 delivery phases (Phase 0 through Phase 8) following the Section 0 protocol. Each phase executes on `feat/<phase>-<short-name>`, runs full baseline and regression test suites, documents mobile verification steps, commits with isolated tags, and logs `git revert <hash>` undo commands in `docs/FIXLOG.md`.
- **Rationale**: Guarantees zero regression, immediate reversibility, and total visibility for every incremental capability.

### 23. Safety-First Build Order (Safety Net Preceding Features)
- **Decision**: Build F14 (Remote Feature Flags & Audit Trail), F1 (Update Checker & Server Enforcement), and F15 (Consent & Crash Capture) in Phase 1 before building F2–F13.
- **Rationale**: Ensures every subsequent feature can be immediately toggled, staged, or disabled via remote killswitch without requiring emergency APK rebuilds or user lockout.
