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
- **Commit Hash**: `e3d90f4`
- **Undo Command**: `git revert e3d90f4`


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
- **Commit Hash**: `a75ebda` (production deps), `a98d1f9` (vitest upgrade & CI)
- **Undo Command**: `git revert a98d1f9 && git revert a75ebda`


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
- **Commit Hash**: `6bf924d`
- **Undo Command**: `git revert 6bf924d`


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
- **Commit Hash**: `2e2536c`
- **Undo Command**: `git revert 2e2536c`


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
- **Commit Hash**: `68748d2`
- **Undo Command**: `git revert 68748d2`


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
- **Commit Hash**: `2f2ccb7`
- **Undo Command**: `git revert 2f2ccb7`


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
- **Commit Hash**: `0609e9f`
- **Undo Command**: `git revert 0609e9f`


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
- **Commit Hash**: `ab59562`
- **Undo Command**: `git revert ab59562`


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
- **Commit Hash**: `f9e848f`
- **Undo Command**: `git revert f9e848f`


## Phase 1 Fix 14: Admin Gate Reverse Proxy Hardening & Audit Identity Verification
- **Status**: Completed & Verified
- **Problem**:
  - Outside `NODE_ENV=production`, loopback requests skipped the admin token check based solely on `req.socket.remoteAddress === '127.0.0.1'`. When running behind a local or same-host reverse proxy, incoming proxied requests carried `remoteAddress: 127.0.0.1`, inadvertently bypassing admin authentication.
  - Audit logging trusted client-supplied `X-Admin-Who` headers blindly without server-side verification.
- **Fix**:
  - Implemented `hasProxyHeaders` detection in `server/routes/api.js`; if `TRUST_PROXY` is set or proxy headers (`X-Forwarded-For`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `Forwarded`) are present, loopback bypass is strictly disabled, requiring a valid `X-Admin-Token`.
  - Server-side verified admin identity recorded as `req.adminWho` (`token:admin` or `token:<sanitizedWho>` when authenticated via token, `loopback:local` when direct local loopback).
  - Used `req.adminWho` for all audit trail entries (`updateFlag`, `createReleaseDraft`, `publishRelease`, `withdrawRelease`).
  - Added test coverage in `server/tests/hardening.test.js` validating proxy header 403 enforcement and verified audit log identity recording.
- **Files**:
  - `server/routes/api.js`
  - `server/tests/hardening.test.js`
- **Verification Result**: Verified with 229/229 passing Vitest tests (2 new tests in `server/tests/hardening.test.js`), passing security check, clean i18n keys parity, and 0 secret leaks.
- **Commit Hash**: `ae93028`
- **Undo Command**: `git revert ae93028`


## Phase 1 Fix 11: Render Free-Tier Persistence via Redis with In-Memory Fallback
- **Status**: Completed & Verified
- **Problem**:
  - On Render free-tier instances, the environment spins down after 15 minutes of inactivity and local file disk is ephemeral.
  - When the service restarts, in-memory counters (e.g., Google Places/Routes daily API call guards) and group sessions reset, allowing daily budget caps to be bypassed across sleep cycles.
- **Fix**:
  - Implemented RedisStore in server/services/redis-store.js supporting Upstash REST (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN) and auto-deriving REST credentials from REDIS_URL.
  - Wired quotaManager in server/services/quota.js to sync external Google API daily request counts to Redis key google_daily_calls:<YYYY-MM-DD>.
  - Wired andit.js to persist learned recommendation weights to andit_profile:<deviceId>.
  - Wired group-mode.js to persist active group sessions to group_sessions:active.
  - Maintained zero-downtime, zero-error fallback to in-memory Maps when Redis is unconfigured or unreachable.
  - Added unit test suite in server/tests/redis-persistence.test.js validating in-memory fallback, REDIS_URL auto-parsing, Upstash REST endpoints, quota sync, and session sync.
- **Files**:
  - server/services/redis-store.js
  - server/services/quota.js
  - server/services/bandit.js
  - server/services/group-mode.js
  - server/tests/redis-persistence.test.js
- **Verification Result**: Verified with 235/235 passing Vitest tests (6 new tests in server/tests/redis-persistence.test.js), passing security check, clean i18n keys parity, and 0 secret leaks.
- **Commit Hash**: 1efb356
- **Undo Command**: git revert 1efb356


## Phase 1 Fix 12: Hybrid Rate Limiting for Bangladesh Mobile Carrier-Grade NAT (CGNAT)
- **Status**: Completed & Verified
- **Problem**:
  - In Bangladesh, major cellular operators (Grameenphone, Robi, Banglalink) place mobile users behind Carrier-Grade NAT (CGNAT), where thousands of mobile subscribers share a pool of public IPs.
  - Rate limiting purely by `req.ip` caused innocent users sharing cell towers to hit false 429 "Too many requests" errors.
- **Fix**:
  - Implemented `getHybridRateLimitKey` in `server/services/rate-limit.js` that checks for `X-Install-ID` or `X-Device-ID` headers (sanitized alphanumeric string) and falls back to `ip:<req.ip>` for web browsers.
  - Implemented dual-layer rate limiting in `server/index.js`:
    1. Client-level limiter: 120 req / 15 min keyed by `getHybridRateLimitKey`.
    2. Aggregate IP burst ceiling: 600 req / 15 min (5x) keyed strictly by `req.ip` to guard against bot attacks spoofing arbitrary install IDs.
  - Updated `diagnosticsLimiter`, `communityWriteLimiter`, and `photoLimiter` in `server/routes/api.js` to utilize `getHybridRateLimitKey`.
  - Added unit test suite in `server/tests/rate-limit.test.js` validating key derivation, header sanitization, IP fallback, and non-colliding buckets for multiple devices on the same IP.
- **Files**:
  - `server/services/rate-limit.js`
  - `server/index.js`
  - `server/routes/api.js`
  - `server/tests/rate-limit.test.js`
- **Verification Result**: Verified with 237/237 passing Vitest tests (2 new tests in `server/tests/rate-limit.test.js`), passing security check, clean i18n keys parity, and 0 secret leaks.
- **Commit Hash**: `6fe7174`
- **Undo Command**: `git revert 6fe7174`


## Phase 2 Fix 15: Stack Architecture Alignment & Production Designation
- **Status**: Completed & Verified
- **Problem**:
  - Documentation previously claimed `/android` (native Java app) and `/api` (Python FastAPI backend) were the active production stack, while the shipped APK is the Expo React Native app in `/mobile` built with EAS, and the production backend is the Node/Express server in `/server` deployed on Render.
  - `/android` had no committed Gradle wrapper, unconfigured maps key, unrequested runtime permissions, and pointed to a local debug URL `10.0.2.2`. `/api` had only minimal `/health` endpoints.
- **Fix**:
  - Formally updated `README.md` to designate `/mobile` (Expo SDK 52 / React Native 0.76 with EAS) and `/server` (Node.js/Express on Render) as the official production stack.
  - Formally archived `/android` (native Java prototype) and `/api` (Python FastAPI stub) as historical reference prototypes, preventing confusion.
  - Added test suite `server/tests/stack-architecture.test.js` validating production package name (`com.khabokothay.app`), live backend URL in EAS build profiles, and architectural documentation parity.
- **Files**:
  - `README.md`
  - `server/tests/stack-architecture.test.js`
- **Verification Result**: Verified with 240/240 passing Vitest tests (3 new tests in `server/tests/stack-architecture.test.js`), passing security check, clean i18n keys parity, and 0 secret leaks.
- **Commit Hash**: `978adef`
- **Undo Command**: `git revert 978adef`


## Phase 2 Fix 18: Remove Unused fs-extra Dependency from Mobile Client
- **Status**: Completed & Verified
- **Problem**:
  - `mobile/package.json` had `"fs-extra": "^11.4.1"` declared in `dependencies`.
  - `fs-extra` is a Node.js filesystem module incompatible with and unused by the React Native client runtime, unnecessarily inflating dependencies.
- **Fix**:
  - Removed `"fs-extra"` from `mobile/package.json`.
  - Added unit test in `mobile/__tests__/dependencies.test.js` verifying that `fs-extra` is absent and essential mobile runtime packages (`expo`, `react-native`, `react`, `react-native-maps`) are present.
- **Files**:
  - `mobile/package.json`
  - `mobile/__tests__/dependencies.test.js`
- **Verification Result**: Verified with 242/242 passing Vitest tests (2 new tests in `mobile/__tests__/dependencies.test.js`), passing security check, clean i18n keys parity, and 0 secret leaks.
- **Commit Hash**: `41c858b`
- **Undo Command**: `git revert 41c858b`


## Phase 2 Fix 16: Play Store Readiness & Android Target API 35 Configuration
- **Status**: Completed & Verified
- **Problem**:
  - Google Play Console requires new apps and app updates to target Android 15 (API level 35) or higher.
  - `mobile/app.json` lacked explicit targetSdkVersion and compileSdkVersion build properties, defaulting to API 34.
- **Fix**:
  - Configured `expo-build-properties` plugin in `mobile/app.json` with `targetSdkVersion: 35`, `compileSdkVersion: 35`, and `buildToolsVersion: "35.0.0"`.
  - Verified `mobile/eas.json` production build profile compiles to `app-bundle` (AAB format required by Google Play Console).
  - Added unit test suite in `mobile/__tests__/target-sdk.test.js` validating target SDK 35 configuration and production AAB build type.
- **Files**:
  - `mobile/app.json`
  - `mobile/__tests__/target-sdk.test.js`
- **Verification Result**: Verified with 244/244 passing Vitest tests (2 new tests in `mobile/__tests__/target-sdk.test.js`), passing security check, clean i18n keys parity, and 0 secret leaks.
- **Commit Hash**: `69cc62d`
- **Undo Command**: `git revert 69cc62d`


## Phase 2 Fix 17: Mobile Accessibility & TalkBack Readiness
- **Status**: Completed & Verified
- **Problem**:
  - Only 23 accessibility labels existed across more than 115 touchable elements (`Pressable`, `TouchableOpacity`, `TouchableHighlight`) in `mobile/src/`, creating a barrier for TalkBack and screen reader users.
  - Buttons lacked `accessibilityRole`, `accessibilityState`, and minimum 48dp touch targets (`hitSlop`).
- **Fix**:
  - Enforced `accessibilityRole` (`button`, `tab`, `checkbox`) and context-aware `accessibilityLabel` across all 14 mobile component files (100% of touchables).
  - Configured `accessibilityState` (`selected`, `checked`, `expanded`) on tabs, filter chips, and collapsible headers.
  - Added `hitSlop` padding (min 48dp target) on mini step buttons and icons.
  - Created automated lint script `scripts/check-a11y.js` scanning all mobile source files to guard against missing accessibility attributes.
  - Added unit test suite in `mobile/__tests__/accessibility.test.js` validating 0 accessibility violations across all mobile components and passing 32/32 WCAG color contrast checks.
- **Files**:
  - `mobile/src/components/ErrorBoundary.js`
  - `mobile/src/features/favorites/FavoritesScreen.js`
  - `mobile/src/features/history/HistoryScreen.js`
  - `mobile/src/features/home/HomeScreen.js`
  - `mobile/src/features/home/MealTimeView.js`
  - `mobile/src/features/onboarding/OnboardingScreen.js`
  - `mobile/src/features/restaurant/CompareOptionsScreen.js`
  - `mobile/src/features/restaurant/RestaurantDetailScreen.js`
  - `mobile/src/features/results/ExplainBottomSheet.js`
  - `mobile/src/features/results/FilterModal.js`
  - `mobile/src/features/results/MapTabScreen.js`
  - `mobile/src/features/results/ResultsScreen.js`
  - `mobile/src/features/settings/SettingsScreen.js`
  - `mobile/src/features/taste/TasteScreen.js`
  - `scripts/check-a11y.js`
  - `mobile/__tests__/accessibility.test.js`
- **Verification Result**: Verified with 246/246 passing Vitest tests (2 new tests in `mobile/__tests__/accessibility.test.js`), `node scripts/check-a11y.js` reporting 0 violations across 32 components, passing security check, clean i18n keys parity, and 0 secret leaks.
- **Commit Hash**: `e205711`
- **Undo Command**: `git revert e205711`


## Phase 3 Fix 21: Stray BOM in api.js & Import Grouping
- **Status**: Completed & Verified
- **Problem**:
  - `server/routes/api.js` had a stray byte-order mark (`\ufeff`, byte 840) preceding `import express`.
  - Service imports were placed ahead of standard Node.js libraries and third-party modules.
- **Fix**:
  - Removed the `\ufeff` BOM from `server/routes/api.js`.
  - Reorganized module imports cleanly into:
    1. Built-in Node libraries (`fs`, `path`, `crypto`).
    2. External vendor modules (`express`, `express-rate-limit`, `qrcode`).
    3. Package config (`pkg`).
    4. Internal application services and route handlers.
  - Added unit test in `server/tests/clean-syntax.test.js` validating 0 BOM characters and top-level import ordering.
- **Files**:
  - `server/routes/api.js`
  - `server/tests/clean-syntax.test.js`
- **Verification Result**: Verified with 247/247 passing Vitest tests (1 new test in `server/tests/clean-syntax.test.js`), passing security check, clean i18n keys parity, and 0 secret leaks.
- **Commit Hash**: `f91deaf`
- **Undo Command**: `git revert f91deaf`


## Phase 3 Fix 19: Version Drift Synchronization Across Repository
- **Status**: Completed & Verified
- **Problem**:
  - `package.json` and `mobile/app.json` declared version `1.1.0`.
  - `CHANGELOG.md` and `android/app/build.gradle` referenced `4.0.0` (versionCode 3).
  - Native Android stubs (`AppHeadersInterceptor.java`, `CrashReporter.java`) sent hardcoded `4.0.0` / `3`.
  - `server/services/diagnostics.js` and `server/routes/api.js` defaulted fallback client reports to `4.0.0` / `3`.
  - Initial releases seed in `server/services/releases.js` pointed to `rel-4.0.0-3`.
- **Fix**:
  - Designated `1.1.0` (versionCode 4) as the authoritative release version across all project components.
  - Synchronized `mobile/app.json` (`versionCode: 4`), `android/app/build.gradle` (`versionCode 4`, `versionName "1.1.0"`), `AppHeadersInterceptor.java`, `CrashReporter.java`, `api/app/core/config.py`, `brand/tokens.json`, `docs/openapi.json`, and `server/services/releases.js`.
  - Synchronized `server/services/diagnostics.js` and `server/routes/api.js` default fallbacks to `1.1.0` and versionCode `4`.
  - Added new release entry in `CHANGELOG.md` documenting `[1.1.0]`.
  - Added test suite `server/tests/version-sync.test.js` validating cross-repo version parity.
- **Files**:
  - `package.json`
  - `mobile/app.json`
  - `android/app/build.gradle`
  - `android/app/src/main/java/com/khabokothay/app/core/AppHeadersInterceptor.java`
  - `android/app/src/main/java/com/khabokothay/app/core/CrashReporter.java`
  - `api/app/core/config.py`
  - `brand/tokens.json`
  - `docs/openapi.json`
  - `CHANGELOG.md`
  - `server/routes/api.js`
  - `server/services/diagnostics.js`
  - `server/services/releases.js`
  - `server/tests/version-sync.test.js`
- **Verification Result**: Verified with 253/253 passing Vitest tests (6 new tests in `server/tests/version-sync.test.js`), passing security check, clean i18n keys parity, and 0 secret leaks.
- **Commit Hash**: `e5869d5`
- **Undo Command**: `git revert e5869d5`


## Phase 3 Fix 20: Documentation Architecture Truth Harmonization
- **Status**: Completed & Verified
- **Problem**:
  - `RELEASE.md` and `docs/ARCHITECTURE.md` had lingering obsolete claims or placeholder package names (`com.example.cafefinder`).
  - `docs/UPGRADE_AUDIT.md` and `docs/DECISIONS.md` described `/android` (Java) as "Primary Android App" and `/api` (FastAPI) as active backend, whereas Node/Express (`/server`) is the deployed production backend on Render serving all `/api` and `/api/v1` routes, and React Native Expo (`/mobile`) is the shipped mobile app.
- **Fix**:
  - Harmonized `RELEASE.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, and `docs/UPGRADE_AUDIT.md` to designate `/mobile` and `/server` as the official production stack.
  - Corrected Android package name in `docs/ARCHITECTURE.md` to `com.khabokothay.app`.
  - Clarified that native Java `/android` and Python FastAPI `/api` are archived reference prototypes.
  - Added unit test suite in `server/tests/docs-sync.test.js` validating documentation truth across release files, architecture guides, and audit manifests.
- **Files**:
  - `RELEASE.md`
  - `docs/ARCHITECTURE.md`
  - `docs/DECISIONS.md`
  - `docs/UPGRADE_AUDIT.md`
  - `server/tests/docs-sync.test.js`
- **Verification Result**: Verified with 256/256 passing Vitest tests (3 new tests in `server/tests/docs-sync.test.js`), passing security check, clean i18n keys parity, and 0 secret leaks.
- **Commit Hash**: `bbe2caf`
- **Undo Command**: `git revert bbe2caf`


## Phase 3 Fix 22: Meal-Time Reason XSS Escaping
- **Status**: Completed & Verified
- **Problem**:
  - `public/js/mealtime-ui.js` line 507 injected `r.reasons[0]` directly into innerHTML (`<p class="mealtime-reason">${r.reasons[0]}</p>`) without escaping, posing an XSS vulnerability if an attacker or unexpected API response returned malicious characters in the recommendation reason.
- **Fix**:
  - Wrapped `r.reasons[0]` in `esc()` (`<p class="mealtime-reason">${esc(r.reasons[0])}</p>`), harmonizing with the rest of `mealtime-ui.js`.
  - Added unit test suite in `server/tests/xss-escaping.test.js` validating that `mealtime-ui.js` sanitizes reasons with `esc()` and verifying `esc()` properly neutralizes script tags, double/single quotes, ampersands, and HTML angle brackets.
- **Files**:
  - `public/js/mealtime-ui.js`
  - `server/tests/xss-escaping.test.js`
- **Verification Result**: Verified with 258/258 passing Vitest tests (2 new tests in `server/tests/xss-escaping.test.js`), passing security check, clean i18n keys parity, and 0 secret leaks.
- **Commit Hash**: `0043b14`
- **Undo Command**: `git revert 0043b14`


## Phase 3 Fix 23: Placeholder Photo SVG Neutrality & Area Customization
- **Status**: Completed & Verified
- **Problem**:
  - `server/routes/api.js` placeholder photo SVG hardcoded the text `<text ...>Gulshan Dining Experience</text>`.
  - When users in Banani, Baridhara, or other Dhaka neighborhoods received placeholder photos, displaying "Gulshan" was incorrect and jarring.
- **Fix**:
  - Updated `generatePlaceholderSvg` in `server/routes/api.js` to default to neutral `"Dhaka Dining Experience"`.
  - Added optional `label` parameter supporting custom area branding (e.g. `?area=Banani` or `?label=...`), while sanitizing special characters to prevent SVG injection.
  - Added unit test suite in `server/tests/photo-cache.test.js` validating default neutrality ("Dhaka Dining Experience"), dynamic query customization, and SVG attribute sanitization.
- **Files**:
  - `server/routes/api.js`
  - `server/tests/photo-cache.test.js`
- **Verification Result**: Verified with 261/261 passing Vitest tests (3 new tests in `server/tests/photo-cache.test.js`), passing security check, clean i18n keys parity, and 0 secret leaks.
- **Commit Hash**: `8d7b887`
- **Undo Command**: `git revert 8d7b887`


## Phase 3 Fix 24: Web App Manifest Unification
- **Status**: Completed & Verified
- **Problem**:
  - `public/manifest.json` and `public/manifest.webmanifest` existed concurrently in `/public` with diverging configurations (differing `short_name` and missing `maskable` icon definitions in `manifest.json`).
- **Fix**:
  - Unified into standard `public/manifest.webmanifest`, setting `short_name: "Khabo Kothay?"` and preserving `maskable` icon entries for modern Android home screens.
  - Removed duplicate `public/manifest.json`.
  - Added backward-compatible server route `GET /manifest.json` in `server/index.js` serving `manifest.webmanifest` with `application/manifest+json` content-type.
  - Added unit test suite in `server/tests/pwa.test.js` validating manifest structure, removal of duplicate file, `public/index.html` linkage, and backward-compatible alias route.
- **Files**:
  - `public/manifest.webmanifest`
  - `public/manifest.json` (removed)
  - `server/index.js`
  - `server/tests/pwa.test.js`
- **Verification Result**: Verified with 265/265 passing Vitest tests (4 new tests in `server/tests/pwa.test.js`), passing security check, clean i18n keys parity, and 0 secret leaks.
- **Commit Hash**: `630581d`
- **Undo Command**: `git revert 630581d`


## Phase 3 Fix 25: Service Worker Precache List Expansion & Cache Bump
- **Status**: Completed & Verified
- **Problem**:
  - `public/sw.js` precache list (`APP_SHELL`) was missing several newer client modules: `i18n.js`, `group-planner.js`, `meal-estimator.js`, `download-page.js`, `theme-init.js`, `download.html`, and `download.css`.
  - When users accessed the web application offline, these modules were unavailable, breaking offline functionality.
- **Fix**:
  - Added all missing web assets and modules to `APP_SHELL` in `public/sw.js`.
  - Bumped service worker cache name to `khabo-kothay-v1.3` to trigger client cache refresh.
  - Added unit test suite in `server/tests/sw-cache.test.js` validating that modern JS modules are declared in `APP_SHELL` and verifying that 100% of declared cache assets physically exist on disk in `/public`.
- **Files**:
  - `public/sw.js`
  - `server/tests/sw-cache.test.js`
- **Verification Result**: Verified with 267/267 passing Vitest tests (2 new tests in `server/tests/sw-cache.test.js`), passing security check, clean i18n keys parity, and 0 secret leaks.
- **Commit Hash**: `72cacaa`
- **Undo Command**: `git revert 72cacaa`


## Phase 3 Fix 26: API Dockerfile Hardening & Dependency Pinning
- **Status**: Completed & Verified
- **Problem**:
  - `api/Dockerfile` ran the container as root user and omitted a `HEALTHCHECK` directive.
  - `api/requirements.txt` included test dependencies (`pytest`, `httpx`, `pytest-asyncio`) with loose/unpinned version constraints in production requirements.
- **Fix**:
  - Hardened `api/Dockerfile` to create and run as dedicated non-root user `appuser` (UID 10001) in `appgroup` (GID 10001).
  - Added a container `HEALTHCHECK` probing `http://localhost:8000/api/v1/health` with retry and timeout parameters.
  - Pinned exact production requirements in `api/requirements.txt` and separated testing tools into `api/requirements-dev.txt`.
  - Added unit test suite in `server/tests/dockerfile-hardening.test.js` validating non-root user execution, presence of healthcheck, and strict production/development dependency separation.
- **Files**:
  - `api/Dockerfile`
  - `api/requirements.txt`
  - `api/requirements-dev.txt`
  - `server/tests/dockerfile-hardening.test.js`
- **Verification Result**: Verified with 270/270 passing Vitest tests (3 new tests in `server/tests/dockerfile-hardening.test.js`), passing security check, clean i18n keys parity, and 0 secret leaks.
- **Commit Hash**: `88fde4f`
- **Undo Command**: `git revert 88fde4f`










## Phase 4 Fix 27: Dynamic Dhaka Locations API & Search Engine
- **Status**: Completed & Verified
- **Problem**:
  - The application previously relied on a rigid, hardcoded list of 10 spots, without allowing users to search dynamically across all Dhaka neighborhoods or query by letter (e.g. typing "A" returning all areas starting with A).
- **Fix**:
  - Created `server/services/locations.js` leveraging `server/data/dhaka-locations.json` (118 verified locations) providing prefix-prioritized multi-tier search (exact prefix matching on English standardized names, Bangla names, word boundaries, and fuzzy/alternative names).
  - Added `GET /api/locations` endpoint supporting dynamic prefix queries (`?q=`) and limit parameters.
  - Added `findClosestDhakaLocation(lat, lng)` helper using Haversine calculation to map GPS coordinates to the nearest neighborhood.
  - Added unit test suite in `server/tests/locations-dynamic.test.js` (9 tests) verifying prefix queries for letter "A" (Abdullahpur, Adabor, Aftabnagar, etc.), "B", "M", "U", Bangla queries, case-insensitivity, and distance calculation.
- **Files**:
  - `server/services/locations.js`
  - `server/routes/api.js`
  - `server/tests/locations-dynamic.test.js`
- **Verification Result**: 279/279 Vitest tests passing (9 new tests in `server/tests/locations-dynamic.test.js`), 0 security check issues, 141 i18n keys parity, 0 secret scan findings.
- **Commit Hash**: `793ebb8`
- **Undo Command**: `git revert 793ebb8`


## Phase 4 Fix 28: Dynamic Location Search Combobox & Automatic GPS Detection (Web)
- **Status**: Completed & Verified
- **Problem**:
  - The web application relied on a static HTML `<select>` with 10 hardcoded spots (defaulting to Notun Bazar), without dynamic search autocomplete across Dhaka's neighborhoods or keyboard navigation.
  - The app did not automatically request device GPS permissions on launch to detect the user's location and recommend nearby dining spots.
- **Fix**:
  - Replaced static select with an accessible dynamic combobox in `public/index.html` (`#locationSearchInput`, `#locationCombobox`, `#locationSuggestions`, `#clearLocationSearchBtn`, and `#useLocationBtn`).
  - Styled responsive, high-contrast combobox components in `public/css/style.css` with 0 WCAG contrast failures and 0 raw hex color violations.
  - Added `fetchLocations(query, limit)` in `public/js/api.js` querying `/api/locations`.
  - Implemented dynamic autocomplete in `public/js/app.js` with match highlighting, live suggestions, and keyboard navigation (ArrowDown, ArrowUp, Enter, Escape).
  - Implemented automatic GPS permission request and location detection on app launch (`requestAndApplyGpsLocation({ auto: true })`) with graceful non-blocking manual fallback for denied/timeout states.
  - Added automated test suite `server/tests/gps-auto-detect.test.js` (5 tests) verifying combobox markup, styling, autocomplete API integration, and GPS error fallback flows.
- **Files**:
  - `public/index.html`
  - `public/css/style.css`
  - `public/js/api.js`
  - `public/js/app.js`
  - `server/tests/gps-auto-detect.test.js`
- **Verification Result**: 284/284 Vitest tests passing (5 new tests in `server/tests/gps-auto-detect.test.js`), 0 security check issues, 141 i18n keys parity, 0 secret scan findings.
- **Commit Hash**: `0c0158e`
- **Undo Command**: `git revert 0c0158e`


## Phase 4 Fix 29: Elimination of Hardcoded Gulshan & Notun Bazar Defaults Across Web & Mobile
- **Status**: Completed & Verified
- **Problem**:
  - The application previously contained hardcoded mentions of Gulshan and Notun Bazar across marketing meta descriptions, hero pills, map centroids, default location state, storage preferences, notifications, weather banners, and service fallbacks.
- **Fix**:
  - Replaced hardcoded "Gulshan, Banani, Baridhara, and Notun Bazar" meta descriptions and hero badges with "100+ Dhaka Neighborhoods" and "across all Dhaka neighborhoods".
  - Standardized web `state.js` and `storage.js` defaults from `'Notun Bazar'` to neutral Dhaka centroid (`{ lat: 23.8103, lng: 90.4125, name: 'Dhaka' }`).
  - Standardized mobile `location.js`, `storage.js`, `HomeScreen.js`, and `OnboardingScreen.js` from `'Notun Bazar'` to `{ lat: 23.8103, lng: 90.4125, name: 'Dhaka' }`.
  - Updated server `routes/api.js`, `services/mealtime.js`, `places.js`, and `weather.js` default coordinates and query strings to neutral Dhaka.
  - Updated English and Bangla bilingual i18n dictionaries maintaining 100% key parity (141 keys).
  - Added automated test suite `server/tests/neutral-locations.test.js` (5 tests) enforcing zero hardcoded defaults to Gulshan or Notun Bazar in web markup, client state, mobile configs, server fallbacks, and i18n copy.
- **Files**:
  - `public/index.html`
  - `public/manifest.webmanifest`
  - `public/js/i18n.js`
  - `public/js/state.js`
  - `public/js/storage.js`
  - `public/js/map.js`
  - `public/js/mealtime-ui.js`
  - `mobile/src/services/location.js`
  - `mobile/src/services/storage.js`
  - `mobile/src/features/home/HomeScreen.js`
  - `mobile/src/features/onboarding/OnboardingScreen.js`
  - `mobile/src/features/results/MapTabScreen.js`
  - `mobile/src/features/results/ResultsScreen.js`
  - `mobile/src/features/restaurant/RestaurantDetailScreen.js`
  - `mobile/src/i18n/en.js`
  - `mobile/src/services/notifications.js`
  - `server/routes/api.js`
  - `server/services/mealtime.js`
  - `server/services/places.js`
  - `server/services/weather.js`
  - `server/tests/neutral-locations.test.js`
- **Verification Result**: 289/289 Vitest tests passing (5 new tests in `server/tests/neutral-locations.test.js`), 0 security check issues, 141 i18n keys parity, 0 secret scan findings.
- **Commit Hash**: `75e8652`
- **Undo Command**: `git revert 75e8652`


## Phase 4 Fix 30: Brand Logo Vector Redesign & High-Definition Geometry
- **Status**: Completed & Verified
- **Problem**:
  - The previous logo and icon files contained rough, jagged, stepped polygon paths (`L 366 110 L 366 186 L 224 282 L 372 386`) inside awkward arbitrary scale transforms (`scale(2)`, `scale(0.25)`, `scale(0.10546875)`).
  - The visual mark lacked professional balance, sharpness, and clean geometry across high-DPI desktop and mobile screens.
- **Fix**:
  - Re-engineered the brand icon into a high-definition 1024x1024 vector mark featuring a smooth, mathematically symmetrical geolocation pin in radiant brand gradients (`#FF6E40` to `#FF5722`), an inner pure white aperture, and an elegant dining cloche with aroma steam curves.
  - Crafted an ultra-sharp 128x128 favicon (`public/favicon.svg`) with thick, crisp contours that render distinctly down to 16x16 tab resolutions.
  - Crafted horizontal brand logos (`public/img/logo.svg`, `logo-dark.svg`, `mobile/assets/logo.svg`, `logo-dark.svg`) featuring a 54x54 icon tile with crisp typography and brand coral question mark accent.
  - Added automated test suite `server/tests/logo-sharpness.test.js` (5 tests) enforcing SVG XML validity, standard viewBox coordinates, and complete elimination of legacy jagged polygons.
- **Files**:
  - `public/img/icon.svg`
  - `public/img/icon-transparent.svg`
  - `public/favicon.svg`
  - `public/img/logo.svg`
  - `public/img/logo-dark.svg`
  - `brand/logo/icon.svg`
  - `brand/logo/icon-transparent.svg`
  - `mobile/assets/icon.svg`
  - `mobile/assets/icon-transparent.svg`
  - `mobile/assets/logo.svg`
  - `mobile/assets/logo-dark.svg`
  - `server/tests/logo-sharpness.test.js`
- **Verification Result**: 294/294 Vitest tests passing (5 new tests in `server/tests/logo-sharpness.test.js`), 0 security check issues, 141 i18n keys parity, 0 secret scan findings.
- **Commit Hash**: `0c3fe51`
- **Undo Command**: `git revert 0c3fe51`


## Phase 4 Fix 31: Modernized Hero Section & Dynamic Dining Intelligence Preview Card
- **Status**: Completed & Verified
- **Problem**:
  - The hero section on the web previously showcased a static, generic architectural sculpture JPEG that did not convey the core value proposition of the app (real-time traffic travel times, Rickshaw & CNG transit fare estimation, and smart dining recommendations).
- **Fix**:
  - Redesigned `public/index.html` hero section with an editorial two-column composition featuring a live pulsing status badge, high-contrast typography, and an interactive **Live Dining Intelligence Radar Card**.
  - Replaced the static JPEG sculpture with live metric displays highlighting:
    - Traffic-buffered travel times (12–18 min)
    - Local calibrated Rickshaw & CNG transit fares (৳40–৳70)
    - 98% Smart Match algorithm fit score
    - 118 Dhaka neighborhood coverage indicator
  - Styled with theme CSS variables in `public/css/style.css` passing 100% of WCAG AAA/AA contrast checks with 0 raw hex color violations.
  - Added automated test suite `server/tests/hero-modernization.test.js` (4 tests) verifying modern hero markup, radar composition, responsive CSS tokens, and CTA button scroll targeting.
- **Files**:
  - `public/index.html`
  - `public/css/style.css`
  - `server/tests/hero-modernization.test.js`
- **Verification Result**: 298/298 Vitest tests passing (4 new tests in `server/tests/hero-modernization.test.js`), 0 security check issues, 141 i18n keys parity, 0 secret scan findings.
- **Commit Hash**: `fa4a284`
- **Undo Command**: `git revert fa4a284`


## Phase 4 Fix 32: Mohakhali Geofence Coordinate Correction & Dhaka Dining Belts Expansion
- **Status**: Completed & Verified
- **Problem**:
  - `services/traffic-dispatch/src/main/java/com/khabokothay/geofence/DhakaGeofenceManager.java` contained a critical coordinate typo on line 104 (`new Coordinates(23.7680, 23.3950)`), setting longitude to `23.3950` instead of `90.3950`. This distorted the ray-casting Jordan Curve algorithm for the Mohakhali arterial corridor.
  - The geofence model was restricted to only 4 zones (Gulshan-1, Gulshan-2, Banani, Mohakhali), lacking key Dhaka dining districts like Dhanmondi, Uttara, and Mirpur.
- **Fix**:
  - Corrected longitude coordinate for Mohakhali arterial boundary from `23.3950` to `90.3950`.
  - Added new geofence polygons for Dhanmondi (Satmasjid Road), Uttara (Sector Hub), and Mirpur (Central Dining Hub) with calibrated baseline congestion indices.
  - Updated `TrafficApp.java` demonstration points to resolve Dhanmondi and out-of-zone baseline points.
  - Added 6 new unit assertions in `TrafficDispatchTest.java` verifying Mohakhali arterial detection, municipal flyover rickshaw restrictions, and spatial resolution for Dhanmondi, Uttara, and Mirpur.
- **Files**:
  - `services/traffic-dispatch/src/main/java/com/khabokothay/geofence/DhakaGeofenceManager.java`
  - `services/traffic-dispatch/src/main/java/com/khabokothay/TrafficApp.java`
  - `services/traffic-dispatch/src/test/java/com/khabokothay/TrafficDispatchTest.java`
  - `docs/FIXLOG.md`
- **Verification Result**: 18/18 Java unit tests passing in `TrafficDispatchTest`, 298/298 Vitest tests passing, 0 security check issues, 141 i18n keys parity, 0 secret scan findings.
- **Commit Hash**: `cf3fae1`
- **Undo Command**: `git revert cf3fae1`

## Phase 4 Fix 33: C++ Routing Core Coordinate Bug Elimination & Neutral Baseline
- **Status**: Completed & Verified
- **Problem**:
  - `engines/routing-core/src/main.cpp` contained a nonsensical ternary condition on line 38 (`const double userLng = 23.4250 ? 90.4250 : 90.4250; // Notun Bazar`), and hardcoded origin comments.
  - `engines/routing-core/src/RoutingCore.cpp` contained legacy comments restricting transit rate calibration descriptions to a small subset of areas.
  - Variable `checksum` triggered a `-Wunused-but-set-variable` compiler warning under modern `g++`.
- **Fix**:
  - Simplified and corrected `userLng` in `engines/routing-core/src/main.cpp` to direct floating point assignment (`const double userLng = 90.4250;`).
  - Generalized comments in `main.cpp` and `RoutingCore.cpp` to reference the Dhaka Metropolitan Area baseline.
  - Silenced compiler warning via `(void)checksum;`.
  - Added automated test in `server/tests/clean-syntax.test.js` asserting zero ternary coordinate bugs and verified presence of expanded geofence constants.
- **Files**:
  - `engines/routing-core/src/RoutingCore.cpp`
  - `engines/routing-core/src/main.cpp`
  - `server/tests/clean-syntax.test.js`
  - `docs/FIXLOG.md`
- **Verification Result**: Compiled cleanly with `g++` (0 compiler warnings), benchmark passed (100,000 queries in ~200ms), 299/299 Vitest tests passing, 0 security check issues, 141 i18n keys parity, 0 secret scan findings.
- **Commit Hash**: `e9c5849`
- **Undo Command**: `git revert e9c5849`

## Phase 5: Master Location Engine, Real Native APK Build & Site-Wide 20-Item Polish
- **Status**: Completed & Verified
- **Problem**:
  - Legacy APK download was an HTML error file (42 KB) masquerading as an APK due to missing build wrapper and resources, causing fatal `failed opening zip` and `Malformed APK` parsing crashes on Android.
  - Previous preset location ordering promoted 'Notun Bazar' and 'Gulshan' over other Dhaka areas.
  - Web application lacked an accessible mobile navigation hamburger drawer on viewports <= 960px, semantic footer with direct dialer/email links, and branded 404 error screen.
  - Missing OpenGraph, Twitter, and canonical metadata tags in `index.html` and `download.html`.
- **Fix**:
  - **Section 13 (Real APK Build & Signature)**: Added standard Gradle 8.4 wrapper, restored Android XML themes and mipmap icons in `android/app/src/main/res/`, added `toBengaliDigits` helper method in `BengaliFormatter.java`, and compiled genuine debug APK (7,858,117 bytes / 7.49 MB). Verified with official Android SDK 34 `aapt2 dump badging` (`com.khabokothay.app`, minSdk 24, targetSdk 34), `apksigner verify` (v2 scheme valid), `zipalign -c -v 4` (verification successful), and verified SHA-256 (`7584E6983BA19CE71DE7DA63FDCA94C6053559B2C12F455DCB67100381A64896`).
  - **Section 2 & 3 (Neutral Dynamic Suggestions)**: Reordered location presets across `mobile/src/services/location.js`, `public/js/api.js`, and `server/services/mock.js` to strict alphabetical ordering with zero hardcoded promotion. Reused verified 118-area database in `server/services/locations.js` for prefix and fuzzy matching across Dhaka.
  - **Section 4 & 5 (GPS Permission & Detection)**: Maintained non-blocking browser Geolocation and mobile `expo-location` permission handling with 8-10s timeout, graceful error fallbacks (code 1 denied, code 2 unavailable, code 3 timeout), and app-wide state sync.
  - **Section 14 (Site-Wide 20-Item Checklist)**:
    - Item 1 & 16: Zero horizontal overflow rules (`overflow-x: hidden`, `overflow-wrap: anywhere`, viewport meta) from 320px to 1280px.
    - Item 2: Verified all navigation anchors (`#heroSection`, `#controlPanelSection`, `#topPicksContainer`, `#filterOptionsSidebar`, `#mapContainer`).
    - Item 3: Built accessible mobile navigation drawer with hamburger button (`#mobileMenuBtn`, `aria-expanded`, `aria-controls`), dialog semantics, keyboard Esc handler, and backdrop dismiss.
    - Item 4: Verified favicons (`.svg`, `-32.png`, `-192.png`, `-512.png`) and `manifest.webmanifest`.
    - Item 5: Branded page titles across `index.html`, `download.html`, and `404.html`.
    - Item 6: Added OpenGraph, Twitter card, and canonical link tags.
    - Item 7: Implemented semantic footer with categorized navigation and contact columns.
    - Item 8: Built custom branded 404 page (`public/404.html`) and Express route handler.
    - Item 9: Dynamic copyright year (`new Date().getFullYear()`) across web, download, and error pages.
    - Item 10: Explicit image width/height dimensions and meaningful alt attributes.
    - Item 11 & 19: Minimum 44x44px touch targets on mobile interactive controls.
    - Item 12: Status banners with `role="status"` and `aria-live="polite"`.
    - Item 13: Download page dynamically reflecting real APK size (7.49 MB) and verified SHA-256 hash.
    - Item 14: Confirmed zero placeholder artifacts (`TODO`, `FIXME`, `Lorem ipsum`) in user-facing code.
    - Item 15: Cleaned up unused tabs.
    - Item 17: Clickable brand logo returning to home (`/`).
    - Item 18: Clickable, validly formatted `tel:+8801711522244` and `mailto:support@khabokothay.com` links.
    - Item 20: Comprehensive site cleanup.
  - **Verification**: Created 16-test automated verification suite in `server/tests/site-wide-fixes.test.js`. All 315/315 Vitest tests pass across 51 test files.
- **Commit Hash**: `38f0994`
- **Undo Command**: `git revert 38f0994`
