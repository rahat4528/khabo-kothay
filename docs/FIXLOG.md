# Fix Log & Safety Net Tracker — Khabo Kothay?
# Protocol: Section 2 Safety-Net Protocol

## Overview
Tracking the execution and verification of Five Quality Fixes:
1. Fix 1: Confusing Icons: Clean Bottom Bar and Menu
2. Fix 2: Screen Freezes After a Tap: Optimistic UI
3. Fix 3: Pages Load Everything at Once: Pagination
4. Fix 4: Too Many Database Calls: N+1 Queries (and N+1 Google Calls)
5. Fix 5: Users Stuck Waiting: Background Jobs

---

## Fix 1: Confusing Icons: Clean Bottom Bar and Menu
- **Status**: Plan submitted (Waiting for user approval "go ahead")
- **Branch**: `fix/1-clean-bottom-bar-and-menu` (to be created upon approval)
- **Baseline Test Result**: Pending approval
- **Verification Result**: Pending
- **Commit Hash**: Pending
- **Undo Command**: `git revert <hash>` (Pending)

---

# 15 Features Upgrade Phase Log (Section 0 & 26 Protocol)

## Phase 0: Master Audit & Baseline Verification
- **Status**: Completed & Verified
- **Branch**: `feat/phase-0-audit`
- **Baseline Test Result**: 
  - Node.js (Vitest): 159/159 tests passed across 25 suites (Duration: 9.37s)
  - Python (Pytest): 4/4 tests passed (86% coverage, Duration: 3.39s)
  - Android: Java 17 Temurin detected, unit tests mapped
- **Verification Result**: Verified live Render backend (`https://khabo-kothay-backend.onrender.com`), inspected all existing engines and data stores, created `docs/UPGRADE_AUDIT.md`.
- **Commit Hash**: 2cb61bb
- **Tag**: `phase-0-audit`
- **Undo Command**: `git revert 2cb61bb`

## Phase 1A: Safety Net (Shared Foundations, F14 Remote Flags, F1 Update Checker)
- **Status**: Completed & Verified
- **Branch**: `feat/1a-safety-net`
- **Baseline Test Result**: 169/169 tests passed across 26 suites
- **Verification Result**: Tested remote feature flags, stable hash assignment, What's New release metadata, and server HTTP 426 upgrade required enforcement.
- **Commit Hash**: `ef6306e`
- **Tag**: `phase-1a-safety-net`
- **Undo Command**: `git revert ef6306e`

## Phase 1B: Diagnostics (F15 Consented Crash Reports & Problem Reports)
- **Status**: Completed & Verified
- **Branch**: `feat/1b-diagnostics`
- **Baseline Test Result**: 176/176 tests passed across 27 suites
- **Verification Result**: Verified explicit opt-in consent, secret/PII redaction, stack trace fingerprinting, problem report reference numbers, and admin diagnostics dashboard.
- **Commit Hash**: `781e1ca`
- **Tag**: `phase-1b-diagnostics`
- **Undo Command**: `git revert 781e1ca`

## Phase 2: Search (F3 Ask In Your Own Words)
- **Status**: Completed & Verified
- **Branch**: `feat/2-search-ask`
- **Baseline Test Result**: 183/183 tests passed across 28 suites
- **Verification Result**: Verified 3 canonical Section 6 examples, 65-item labeled corpus (90.8% accuracy in docs/ASK_PARSER.md), ambiguity detection, voice input helper, and search confirmation API.
- **Commit Hash**: `2c43a55`
- **Tag**: `phase-2-search`
- **Undo Command**: `git revert 2c43a55`

## Phase 3: Fare (F2 Fare Check & Estimation Service)
- **Status**: Completed & Verified
- **Branch**: `feat/3-fare-check`
- **Baseline Test Result**: 192/192 tests passed across 29 suites
- **Verification Result**: Verified distance bands, reference range calculations, MAD outlier trimming, user quote comparison ("below", "within", "above"), and community reporting with duplicate prevention.
- **Commit Hash**: `e2cc9e5`
- **Tag**: `phase-3-fare`
- **Undo Command**: `git revert e2cc9e5`

## Phase 4: Discovery & Group (F4 Group Mode, F5 Swipe, F6 Dish Prices, F8 Diet, F7 Rain)
- **Status**: Completed & Verified
- **Branch**: `feat/4-discovery-group`
- **Baseline Test Result**: 199/199 tests passed across 30 suites
- **Verification Result**: Verified 128-bit unguessable tokens, fair multi-origin travel ranking algorithm (docs/GROUP_RANKING.md), voting/closing flow, community dish prices, and dietary disclaimers.
- **Commit Hash**: `6bb8946`
- **Tag**: `phase-4-discovery`
- **Undo Command**: `git revert 6bb8946`

## Phase 5: Convenience (F9 Lunch Reminder, F10 Share Trip, F11 Pay-Me, F12 Simple, F13 Food Story)
- **Status**: Completed & Verified
- **Branch**: `feat/5-convenience`
- **Baseline Test Result**: 199/199 tests passed across 30 suites; Android helpers verified
- **Verification Result**: Verified WorkManager lunch alerts (zero background GPS), public directions trip sharing, encrypted local-only bKash/Nagad wallet lines, Simple Mode toggle, and on-device Food Story recaps.
- **Commit Hash**: `1105e9f`
- **Tag**: `phase-5-convenience`
- **Undo Command**: `git revert 1105e9f`

## Phase 6: Hardening & Verification
- **Status**: Completed & Verified
- **Branch**: `feat/6-hardening`
- **Baseline Test Result**: 203/203 total passing tests (Vitest 199/199, Pytest 4/4 with 86% coverage)
- **Verification Result**: Verified comprehensive Privacy Matrix (docs/PRIVACY_MATRIX.md) covering all 15 features and full test report (docs/TEST_REPORT.md).
- **Commit Hash**: `62195db`
- **Tag**: `phase-6-hardening`
- **Undo Command**: `git revert 62195db`

## Phase 7: Roadmap (Future Features Documentation)
- **Status**: Completed & Verified
- **Branch**: `feat/7-roadmap`
- **Verification Result**: Documented architectural prerequisites in docs/ROADMAP.md for Card & Wallet Offers, Multi-Stop Outing Planner, and Delivery Integration per Section 19.
- **Commit Hash**: `f624306`
- **Tag**: `phase-7-roadmap`
- **Undo Command**: `git revert f624306`


## Phase 1 Fix 1: Group Session Access Control & Host Key Authentication
- **Status**: Completed & Verified
- **Problem**: Any participant could obtain creatorId and participantIds from public session accessors, allowing unauthorized participants to close group sessions or cast impersonated votes.
- **Fix**:
  - Generated unguessable 256-bit `hostKey` returned once only upon session creation, stored as a SHA-256 hash, verified with `crypto.timingSafeEqual` in `closeGroupSession`.
  - Returned strictly public session views from `getGroupSession` and `joinGroupSession` (omitting `creatorId`, `hostKey`, foreign `participantId`s, and raw voter mappings).
  - Issued per-participant secret on join and enforced `timingSafeEqual` secret verification in `castVote`.
  - Aggregated votes into candidate counts (`voteCounts`) without exposing voter identities.
- **Files**:
  - `server/services/group-mode.js`
  - `server/routes/api.js`
  - `server/tests/phase4-discovery-group.test.js`
- **Verification Result**: Verified with 201/201 passing Vitest tests including 403 authorization checks on rogue session close and impersonated voting attempts.
- **Commit Hash**: `8ea397f`
- **Undo Command**: `git revert 8ea397f`


## Phase 1 Fix 2: Group Session Expiry Enforcement, Input Caps, and Atomic Persistence
- **Status**: Completed & Verified
- **Problem**: Session expiry was checked only on cold start; expired sessions remained accessible for reads, votes, and closing; session store had no IP rate limit or session count ceiling; inputs were unvalidated; file writes were synchronous and non-atomic.
- **Fix**:
  - Enforced expiry check returning HTTP 404 in all accessors (`getGroupSession`, `joinGroupSession`, `castVote`, and `closeGroupSession`) and auto-purging expired entries.
  - Implemented periodic background sweep via `.unref()` timer (`SWEEP_INTERVAL_MS = 5 min`).
  - Added global ceiling (`MAX_TOTAL_SESSIONS = 500`) and per-IP limit (`MAX_SESSIONS_PER_IP = 10`) returning HTTP 429 when exceeded.
  - Validated and capped inputs: `creatorName` (30), `name` (30), `startingArea` (40), `dietaryPreferences` (allowlist of 8 standard tags), and `candidateId` (non-empty string <= 64 chars).
  - Replaced blocking direct file overwrite with atomic temp-file write + rename (`saveSessionsSync`) and debounced saves (`scheduleSave`).
- **Files**:
  - `server/services/group-mode.js`
  - `server/routes/api.js`
  - `server/tests/phase4-discovery-group.test.js`
- **Verification Result**: Verified with 204/204 passing Vitest tests including 404 tests on expired sessions across all 4 accessors, input sanitization tests, and IP rate-limit tests.
- **Commit Hash**: `92b357b`
- **Undo Command**: `git revert 92b357b`


## Phase 1 Fix 3: Remove Public App Token & Enforce Fail-Closed Production Behavior
- **Status**: Completed & Verified
- **Problem**: The string `gulshan_app_secret_token_2026` was hardcoded in multiple documentation files, mobile configs, source files, and tests; server/index.js had a hardcoded fallback that allowed unauthenticated requests unless they claimed to be mobile.
- **Fix**:
  - Removed every occurrence of hardcoded token and fallback value across mobile configs, server index, scripts, docs, and test configurations.
  - Implemented fail-closed logic: in production (`NODE_ENV === 'production'`), if `APP_CLIENT_TOKEN` is unset on Render, the server logs an error and rejects mobile-claiming requests with HTTP 500 rather than silently falling back.
  - Replaced literal strings in CI workflow (`.github/workflows/ci.yml`) and `vitest.config.js` with environment variable references.
  - Explicitly documented across `README.md`, `README_MOBILE.md`, and `RELEASE.md` that `APP_CLIENT_TOKEN` is a build-time client identifier (soft deterrent against automated scrapers), not a user secret.
- **Files**:
  - `server/index.js`
  - `mobile/app.json`
  - `mobile/app.config.js`
  - `mobile/src/api/client.js`
  - `vitest.config.js`
  - `.github/workflows/ci.yml`
  - `scripts/smoke-test.js`
  - `scripts/secret_scan.py`
  - `README.md`, `README_MOBILE.md`, `RELEASE.md`
  - `server/tests/api.test.js`
  - `mobile/__tests__/api.test.js`
- **Verification Result**: Verified with 205/205 passing Vitest tests (including fail-closed production test), zero credential leaks via security-check.js and secret_scan.py.
- **Commit Hash**: `7128aaf`
- **Undo Command**: `git revert 7128aaf`


## Phase 1 Fix 4: Patch Vulnerable Dependencies & Upgrade Vitest
- **Status**: Completed & Verified
- **Problem**: Production dependencies `body-parser` (high DoS, trailing bytes) and `qs` (moderate DoS, non-callable toString) had unpatched vulnerabilities; dev dependency `tinypool` (critical RCE via prototype pollution in worker options) was bundled via legacy `vitest` 2.x; CI workflow included deprecated EOL Node 18.x and lacked automated production vulnerability gating.
- **Fix**:
  - Ran `npm audit fix` patching `body-parser` to 1.20.9 and `qs` to 6.16.2 (`found 0 vulnerabilities` in production dependencies).
  - Upgraded `vitest` and `@vitest/coverage-v8` to 5.0.5, resolving critical `tinypool` vulnerability.
  - Added `npm audit --omit=dev --audit-level=high` step to `.github/workflows/ci.yml`.
  - Removed EOL Node 18.x from GitHub Actions CI matrix, retaining active LTS versions (20.x, 22.x).
  - Added Windows EPERM file-lock fallback in `saveSessionsSync`.
- **Files**:
  - `package.json`
  - `package-lock.json`
  - `.github/workflows/ci.yml`
  - `server/services/group-mode.js`
- **Verification Result**: Verified with 205/205 passing Vitest tests on v5.0.5, 0 npm audit vulnerabilities (`npm audit --omit=dev`), and successful security-check.js / verify-i18n-keys.js runs.
- **Commit Hash**: `073ac66` (production deps), `02a19f8` (vitest upgrade & CI)
- **Undo Command**: `git revert 02a19f8 && git revert 073ac66`


## Phase 1 Fix 5: Fix Broken APK Download Fallback, Metadata Generation, and Clean URLs
- **Status**: Completed & Verified
- **Problem**: Missing APK downloads (`/downloads/khabo-kothay-latest.apk`) were caught by the SPA fallback in `server/index.js`, serving `index.html` with status 200 as an APK file; APK metadata in `server/routes/api.js` was hardcoded; download.html had conflicting size fallback (61.06 MB vs 64.98 MB); Google Drive link included a fragile account-index `/u/5/`; EAS link in `RELEASE.md` was expired.
- **Fix**:
  - Updated SPA fallback in `server/index.js` to return HTTP 404 for any path with a file extension or matching `/api`.
  - Created `scripts/generate-apk-metadata.js` to dynamically compute and write `server/data/apk-metadata.json` (version, size, sha256 checksum) without hardcoding.
  - Updated `server/routes/api.js` to dynamically load `apk-metadata.json` via `loadApkMetadata` with `APK_METADATA` proxy backwards compatibility.
  - Unified size badge in `download.html` and `download-page.js` to 64.98 MB.
  - Stripped Google Drive account index `/u/5/` and updated `RELEASE.md` to target permanent GitHub Releases hosting.
- **Files**:
  - `server/index.js`
  - `server/routes/api.js`
  - `public/download.html`
  - `public/js/download-page.js`
  - `scripts/generate-apk-metadata.js`
  - `RELEASE.md`
  - `server/tests/download-qr.test.js`
- **Verification Result**: Verified with 207/207 passing Vitest tests (including 404 on missing `.apk` requests, verification that `/u/5/` is not leaked, and valid dynamic metadata).
- **Commit Hash**: `240de96`
- **Undo Command**: `git revert 240de96`


## Phase 1 Fix 6: Map Tab Google Maps API Key Configuration & Accessible List Fallback
- **Status**: Completed & Verified
- **Problem**: `android.config.googleMaps.apiKey` was missing from `mobile/app.json` and `mobile/app.config.js`. Without this key configured during native build, `react-native-maps` renders a blank/gray screen on Android devices. Additionally, MapTabScreen had no fallback UI if the key was omitted.
- **Fix**:
  - Added `android.config.googleMaps.apiKey` and `extra.googleMapsApiKey` to `mobile/app.config.js` reading from `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY` or `GOOGLE_MAPS_ANDROID_KEY`.
  - Added template configuration to `mobile/app.json`.
  - Created `mobile/src/services/mapsConfig.js` to detect whether Google Maps SDK for Android is configured.
  - Updated `mobile/src/features/results/MapTabScreen.js` to detect key configuration and gracefully display an accessible, proximity-ranked list view with direction buttons and accessibility labels instead of a blank screen when the key is omitted.
  - Added Vitest configuration parameter `testTimeout: 10000` to prevent worker pool contention timeouts on Windows.
- **Files**:
  - `mobile/app.config.js`
  - `mobile/app.json`
  - `mobile/src/services/mapsConfig.js`
  - `mobile/src/features/results/MapTabScreen.js`
  - `mobile/__tests__/map-tab.test.js`
  - `vitest.config.js`
- **Verification Result**: Verified with 210/210 passing Vitest tests (including 3 new tests in `mobile/__tests__/map-tab.test.js` testing unconfigured fallback detection, environment key detection, and app.config.js integration), passing security checks and 0 secret leaks.
- **Commit Hash**: `5a74848`
- **Undo Command**: `git revert 5a74848`


## Phase 1 Fix 7: API Base URL Harmonization & EAS Profile Wiring
- **Status**: Completed & Verified
- **Problem**: Mobile app configs and fallbacks were referencing `https://khabo-kothay.onrender.com`. Live verification confirmed that `khabo-kothay.onrender.com/api/health` returned 404, while `https://khabo-kothay-backend.onrender.com/api/health` responded with HTTP 200 (live Render backend defined in `render.yaml`). An APK built with previous configs failed to reach the server. Furthermore, `mobile/eas.json` had no `env` variables configured for build profiles, relying solely on runtime fallbacks.
- **Fix**:
  - Pointed default `apiBaseUrl` in `mobile/app.json` and `mobile/app.config.js` to `https://khabo-kothay-backend.onrender.com`.
  - Added `EXPO_PUBLIC_API_BASE_URL` to development, preview, and production profiles in `mobile/eas.json`.
  - Updated `mobile/src/api/client.js` default fallback to the live URL and added warning detection (`isLocalhostUrl`) if pointing to localhost/loopback in production.
  - Synchronized references across `README_MOBILE.md`, `docs/POLISH_AUDIT.md`, and `scripts/check_links.py`.
  - Added unit tests in `mobile/__tests__/api.test.js` validating live URL defaults, localhost detection, production warning logging, and `eas.json` profile configurations.
- **Files**:
  - `mobile/app.json`
  - `mobile/app.config.js`
  - `mobile/eas.json`
  - `mobile/src/api/client.js`
  - `mobile/__tests__/api.test.js`
  - `scripts/check_links.py`
  - `README_MOBILE.md`
  - `docs/POLISH_AUDIT.md`
- **Verification Result**: Verified with 214/214 passing Vitest tests (4 new tests in `mobile/__tests__/api.test.js`), passing security check, clean i18n keys parity, and 0 secret leaks.
- **Commit Hash**: `4a35fa1`
- **Undo Command**: `git revert 4a35fa1`


## Phase 1 Fix 8: In-Memory LRU Photo Cache, Photo Quota Guard & Per-IP Rate Limiting
- **Status**: Completed & Verified
- **Problem**: `/api/places/photo` was un-cached in memory, so rapid client scrolling repeatedly hit Google Places media endpoints or regenerated placeholders. Additionally, photo requests lacked per-IP rate limiting, allowing rapid bursts to exhaust daily server quota.
- **Fix**:
  - Implemented `PhotoCache` in `server/services/photo-cache.js` providing in-memory LRU caching with capacity (200 items / 50MB) and 1-hour TTL.
  - Wired cache lookup in `server/routes/api.js` returning `X-Cache: HIT` for cached photos and `X-Cache: MISS` for newly fetched/generated ones.
  - Guarded photo requests against daily Google API request cap in `quotaManager`, gracefully serving SVG placeholder with `X-Quota-Fallback: true` instead of throwing an unhandled exception or crashing.
  - Added dedicated per-IP rate limiting (`photoLimiter`, 60 req/min) on `/api/places/photo` and bypassed `/places/photo` from the general 120/15min API limiter in `server/index.js` to ensure photo scrolling doesn't block search.
  - Added unit and HTTP integration tests in `server/tests/photo-cache.test.js`.
- **Files**:
  - `server/services/photo-cache.js`
  - `server/routes/api.js`
  - `server/index.js`
  - `server/tests/photo-cache.test.js`
- **Verification Result**: Verified with 219/219 passing Vitest tests (5 new tests in `server/tests/photo-cache.test.js`), passing security check, clean i18n keys parity, and 0 secret leaks.
- **Commit Hash**: `5ff3f6d`
- **Undo Command**: `git revert 5ff3f6d`


## Phase 1 Fix 9: Confirmed Criteria Search Engine Wiring & Feature Flags Cache Hardening
- **Status**: Completed & Verified
- **Problem**:
  - `POST /api/search/confirm` was calling `rankRestaurants({ lat, lng, options })` with no `candidates` and without `userLocation`, causing `rankRestaurants` to immediately exit and return empty `[]` every time.
  - `/search/confirm` did not call `enforceDeviceQuota`, bypassing daily search limit controls.
  - `/search/confirm` did not validate criteria types or ranges (allowing unbounded party sizes, invalid mealtimes, and oversized strings).
  - `/api/app/feature-flags` returned `Cache-Control: public, max-age=21600` for user-evaluated flags (`installId`, `versionCode`, `channel`), potentially leaking or caching user-specific feature flags across shared caches.
  - `/api/app/feature-flags` crashed with HTTP 500 when query parameters were passed as arrays (e.g. `?channel=a&channel=b`).
- **Fix**:
  - Validated criteria fields in `server/routes/api.js`: cuisine string max 40 chars, budget amount non-negative finite number, partySize integer between 1 and 50, mealTime in allowlist.
  - Enforced `enforceDeviceQuota` on confirmed searches.
  - Retrived candidates via `searchRestaurants` and passed `{ candidates, userLocation: { lat, lng }, cuisine, priority, budget }` to `rankRestaurants`, returning ranked candidates and top picks.
  - Coerced query and header parameters (`installId`, `versionCode`, `channel`) to primitives before passing to `evaluateFlags`, and hardened `evaluateFlags` in `server/services/flags.js` against non-string/array arguments.
  - Replaced public cache header on `/api/app/feature-flags` with `Cache-Control: private, max-age=60` and `Vary: X-Install-Id, X-App-Version-Code, X-App-Channel`.
  - Added tests in `server/tests/phase2-ask-parser.test.js` validating ranked results return, 400 schema rejections, array query resilience, and private cache headers.
- **Files**:
  - `server/routes/api.js`
  - `server/services/flags.js`
  - `server/tests/phase2-ask-parser.test.js`
- **Verification Result**: Verified with 221/221 passing Vitest tests (2 new tests in `server/tests/phase2-ask-parser.test.js`), passing security check, clean i18n keys parity, and 0 secret leaks.
- **Commit Hash**: `bbc1cf1`
- **Undo Command**: `git revert bbc1cf1`


## Phase 1 Fix 10: Unauthenticated Write Endpoint Hardening & PII Protection
- **Status**: Completed & Verified
- **Problem**:
  - `POST /api/diagnostics/crash`, `POST /api/diagnostics/problem`, `POST /api/dish-prices`, and `POST /api/fare-reports` were unauthenticated write endpoints lacking endpoint-specific rate limiting and body size boundaries, exposing the server to disk-fill and denial-of-service vectors.
  - Problem reports accepted unbounded `description`, crash reports accepted unbounded `stackTrace`, and `screenshotBase64` lacked size caps.
  - `getDiagnosticsOverview` read entire `.jsonl` files synchronously into memory.
  - Consent records stored raw client IP in plain text on disk.
  - `redactSensitiveText` in `diagnostics.js` contained an email regex typo (`[A-Z|a-z]{2,}`) failing on short or modern TLDs.
- **Fix**:
  - Configured dedicated rate limiters: `diagnosticsLimiter` (10 req/hr per IP) on consent and problem/crash reports; `communityWriteLimiter` (20 req/hr per IP) on dish prices and fare reports.
  - Implemented `enforceBodySizeLimit` middleware enforcing 16KB for dish prices and fare reports, 32KB for crash reports, and 100KB for problem reports (returning HTTP 413 for oversized payloads).
  - Capped string fields: `description <= 1000` chars, `stackTrace <= 4000` chars, `dishName <= 80` chars, `origin` and `destination` `<= 60` chars, and dropped `screenshotBase64` exceeding 100KB.
  - Implemented `tailLines` to stream-read only the latest 500 lines rather than reading whole `.jsonl` files synchronously into memory, and added automatic file rotation at 5MB (`checkAndRotateJsonl`).
  - Pseudonymized IPs in consent records using truncated SHA-256 (`ipHash`) rather than persisting plain-text IPs.
  - Fixed email redaction regex to `/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g`.
  - Added test coverage in `server/tests/phase1b-diagnostics.test.js` validating IP hashing, email redaction, 413 payload rejections, and string caps.
- **Files**:
  - `server/services/diagnostics.js`
  - `server/services/dish-prices.js`
  - `server/services/fare-check.js`
  - `server/routes/api.js`
  - `server/tests/phase1b-diagnostics.test.js`
- **Verification Result**: Verified with 224/224 passing Vitest tests (3 new tests in `server/tests/phase1b-diagnostics.test.js`), passing security check, clean i18n keys parity, and 0 secret leaks.
- **Commit Hash**: `84d62fd`
- **Undo Command**: `git revert 84d62fd`


## Phase 1 Fix 13: Content Security Policy & CORS Hardening
- **Status**: Completed & Verified
- **Problem**:
  - Helmet CSP permitted `'unsafe-eval'` and `'unsafe-inline'` in `script-src`.
  - An inline script was present in `public/index.html` for theme initialization.
  - Express CORS was wide open (`app.use(cors())`), allowing any arbitrary website to make cross-origin requests.
  - FastAPI in `api/app/main.py` used the invalid CORS configuration `allow_origins=["*"]` combined with `allow_credentials=True`.
- **Fix**:
  - Removed `'unsafe-eval'` and `'unsafe-inline'` from `scriptSrc` in `server/index.js` CSP.
  - Extracted the inline theme script into `public/js/theme-init.js` and loaded it via `<script src="/js/theme-init.js"></script>`.
  - Restricted CORS in `server/index.js` to an env-configured origin list (`CORS_ALLOWED_ORIGINS` or live backend domain and localhost), while continuing to allow non-browser native mobile and server-to-server requests without Origin headers.
  - Fixed FastAPI CORS in `api/app/main.py` by scoping `allow_origins` to explicitly permitted local and production origins.
  - Added test coverage in `server/tests/security.test.js` validating strict CSP directives, lack of `'unsafe-eval'`/`'unsafe-inline'`, allowed CORS with credentials, and rejection of unauthorized origins.
- **Files**:
  - `server/index.js`
  - `public/index.html`
  - `public/js/theme-init.js`
  - `api/app/main.py`
  - `server/tests/security.test.js`
- **Verification Result**: Verified with 227/227 passing Vitest tests (3 new tests in `server/tests/security.test.js`), passing security check, clean i18n keys parity, and 0 secret leaks.
- **Commit Hash**: `06dcc9f`
- **Undo Command**: `git revert 06dcc9f`
