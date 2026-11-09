# KHABO KOTHAY? (খাবো কোথায়?) — Master Upgrade Audit
**Document**: `docs/UPGRADE_AUDIT.md`  
**Date**: October 15, 2026  
**Status**: Baseline Completed & Verified  
**Protocol Reference**: Section 0, Section 1, Section 26 (Phase 0)

---

## 1. Executive Summary

This audit establishes the definitive baseline of the **KHABO KOTHAY?** (খাবো কোথায়?) codebase prior to integrating the 15 features (F1 to F15), backend upgrades, Android APK enhancements, production readiness, and GitHub publication.

The application serves Dhaka diners in Gulshan, Banani, Baridhara, Notun Bazar, and surrounding areas answering: *"Where should I actually eat right now, and why?"* using traffic-aware travel times, food preferences, budgets, estimated transport costs, opening hours, and real time constraints.

---

## 2. Discovered Architecture & Technology Stack

### 2.1 Backend Implementations
1. **Primary Active Backend: Node.js Express Server (`/server`)**
   - **Runtime**: Node.js ES Modules (Node 20+).
   - **Framework**: Express with Helmet (CSP configured), CORS, rate limiting, and Pino structured logging.
   - **Live Production Deployment**: Actively deployed on Render at `https://khabo-kothay-backend.onrender.com`.
   - **Core Engines**:
     - Recommendation Engine (`server/services/recommend.js`): Multi-factor scoring (distance, traffic, rating, price, popularity, personal taste) with explicit plain-language rationale.
     - Meal-Time Mode (`server/services/mealtime.js`): Round-trip travel + cuisine-specific dining duration with strict time-budget filtering and closing-soon guards.
     - Cost Engine (`server/services/cost.js`): Distance-based transport estimation for Rickshaw, CNG, and Ride-share.
     - Personalization (`server/services/bandit.js`): Epsilon-greedy multi-armed bandit with simplex projection and box constraints (0.05–0.50).
     - Weather & Context (`server/services/weather.js`, `context.json`): Open-Meteo integration and Dhaka diurnal traffic models.
     - Cost Control & Quotas (`server/services/quota.js`): Daily per-device limits and monthly global killswitch falling back to mock places.
   - **Tests**: 159 tests passing across 25 Vitest test suites (`npm test`).

2. **Archived Reference Architecture: Python FastAPI Server (`/api`)**
   - **Note**: Archived exploration prototype with minimal /health endpoints. Production backend is Node.js Express (/server).
   - **Runtime**: Python 3.11 / 3.13.
   - **Framework**: FastAPI with Pydantic v2, custom `AppError` handlers, and `Clock` abstraction.
   - **State**: Foundation layer created under `/api/v1` with `/health` and budget guards.
   - **Tests**: 4 tests passing in pytest with 86% code coverage.

### 2.2 Client Applications
1. **Archived Android App Prototype: Native Java (`/android`)**
   - **Note**: Historical Java prototype. Official production mobile app is React Native Expo (/mobile).
   - **Package ID**: `com.khabokothay.app`
   - **Version**: `versionCode 3`, `versionName "4.0.0"`
   - **Target / Min SDK**: Compile SDK 34, Target SDK 34, Min SDK 24 (Android 7.0+).
   - **Architecture**: MVVM with `ViewModel`, `LiveData`, ViewBinding, Material 3, Navigation Component.
   - **Local Storage**: Room DB 2.6.1 (`AppDatabase`, `BudgetSettingsEntity`, `FavoriteAlertEntity`, `GuideReminderEntity`, `SavedGuideEntity`, `SpendEntryEntity`, `WantToTryEntity`).
   - **Networking**: Retrofit 2.10.0 + Gson + OkHttp 4.12.0 with logging interceptor.
   - **Background Tasks**: AndroidX WorkManager 2.9.0 (`AppWorkManager`).
   - **Localization**: English (`values/strings.xml`) and Bangla (`values-bn/strings.xml`), `BengaliFormatter.java`.
   - **Branding**: Indigo and Saffron Material 3 color tokens (`brand/tokens.json`).

2. **Official Production Mobile Client (`/mobile`)**
   - React Native Expo SDK 52 application with EAS Build (APK & AAB), bilingual EN/BN support, offline fallback, and accessibility TalkBack readiness.

3. **Legacy Web Client (`/public`)**
   - Static HTML5, CSS3, and JavaScript web client with Leaflet maps.

---

## 3. Feature Inventory & F1–F15 Gap Analysis

| Feature ID | Feature Name | Priority | Current Codebase Status | Gap / Required Work |
| :--- | :--- | :--- | :--- | :--- |
| **F1** | **Update Checker & What's New** | P1 | Minimal `/apk/meta` endpoint exists; no client update logic. | Implement `GET /api/app/version`, `GET /api/app/releases`, HTTP 426 server enforcement, Android soft/forced update dialogs, external download launcher (NO `REQUEST_INSTALL_PACKAGES`), What's New screen in BN/EN, admin release controls. |
| **F2** | **Fare Check** | P1 | Algorithmic transport cost model exists (`cost.js`). | Build crowdsourced statistical estimation service (age weighting, median absolute deviation, 25th-75th percentile), fallback levels, honest no-data states, report validation, admin CSV import, `docs/FARE_METHOD.md`. |
| **F3** | **Ask in Your Own Words** | P1 | Basic keyword search in `/api/restaurants/search`. | Deterministic Banglish/Bangla normalizer + optional LLM parser, ambiguity detection, 60+ labeled test corpus (`server/data/ask-corpus.json`), `docs/ASK_PARSER.md`, editable confirmation UI, speech-to-text with mic permission. |
| **F4** | **Group Mode** | P2 | Not implemented. | Group dining sessions (`khabokothay://group/<token>`), guest joining, privacy-preserving origin submission, fair-ranking algorithm (multi-origin travel time matrix), voting, `docs/GROUP_RANKING.md`. |
| **F5** | **Swipe Mode** | P2 | Not implemented in Android app. | 1-minute taste setup: 10 restaurant cards, swipe/button controls, local taste profile generation feeding ranking as a soft signal. |
| **F6** | **Dish Prices** | P2 | Static price levels (৳ to ৳৳৳৳). | Crowdsourced dish price reporting, age decay (half-life 60d), outlier filtering (0.3x–3x), admin moderation queue, median price display with "community-reported" disclaimer. |
| **F7** | **Rain-Aware Mode** | P2 | Open-Meteo weather service exists (`weather.js`). | Weather-provider interface, precipitation probability threshold (>=50%), nearest-option boost, rickshaw caution note, delivery suggestions, graceful offline/unavailable behavior. |
| **F8** | **Dietary Preferences** | P2 | Basic Halal/Veg boolean filters in backend. | Structured dietary preferences (Halal, Vegetarian, No Beef, Spice Level), per-tag verification levels (restaurant-confirmed, provider-reported, community-reported, unverified, unknown), allergy disclaimer, local device storage. |
| **F9** | **Lunch-Break Reminder** | P3 | Meal-Time engine exists in backend (`mealtime.js`). | Integration with Meal-Time engine, Android WorkManager periodic background worker (inexact window, respects Doze), saved office location (NO background GPS), notification permission prompt upon toggle. |
| **F10** | **Share My Trip** | P3 | Not implemented. | Native share sheet with preview, destination Google Maps directions link (never sender GPS), ETA (only if reliable), optional user note. NO live tracking. |
| **F11** | **Pay-Me Line in Bill Split** | P3 | Basic split calculator in UI without Pay-Me. | Optional bKash/Nagad number stored locally in encrypted storage (Android Keystore / EncryptedSharedPreferences). NEVER sent to backend. Formatted share text preview. |
| **F12** | **Simple Mode** | P3 | Not implemented. | High-accessibility simplified UI: 3 primary actions (Eat now, Call, Directions), high contrast, large typography, screen reader support, honest uncertainty labels preserved. |
| **F13** | **Food Story** | P3 | Not implemented. | 100% on-device monthly/yearly dining recap based on consented local history (saved/opened places, typed spending). Native share sheet image/text recap, privacy review, opt-out. |
| **F14** | **Remote Feature Flags & Staged Rollout** | P4 (Built Early) | Static boolean flags in `FeatureFlags.java`. | Server-side remote flags API, stable hash assignment (`hash(installId + flagKey) % 100 < rolloutPercentage`), client caching with ETag & 6h TTL, compiled-in defaults, admin audit log, emergency killswitch. |
| **F15** | **Opt-In Crash Reports & Report a Problem** | P4 (Built Early) | Basic Sentry stub in backend; no in-app client reporter. | Explicit user consent flow, local uncaught-exception handler with PII/secret redaction, upload on next launch, Report a Problem screen with user-reviewed attachments, admin diagnostics triage. |

---

## 4. Baseline Test & Build Verification

### 4.1 Node.js Backend Tests (`npm test`)
- **Framework**: Vitest v3.0.7
- **Test Suites**: 25 passed (25 files)
- **Tests**: 159 passed (159 tests)
- **Execution Duration**: 9.37s
- **Coverage Areas**:
  - `api.test.js` (12 tests): Server endpoints, recommendation integration, token validation.
  - `mealtime-api.test.js` (6 tests): Time-budget feasibility, closing protection, benchmark tuning.
  - `hardening.test.js` (10 tests): Quota limits, admin token authorization, path traversal protection.
  - `contract.test.js` (11 tests): Kill-switch fallback, backward compatibility.
  - `smarter-decisions.test.js` (16 tests): Departure time predictions, allergen disclaimers, counterfactuals.
  - `bandit.test.js`, `cache.test.js`, `cost.test.js`, `routes.test.js`, `weather.test.js`.

### 4.2 Python FastAPI Backend Tests (`pytest`)
- **Framework**: Pytest 9.1.1, Python 3.13.14
- **Tests**: 4 passed in 3.39s
- **Code Coverage**: 86% across `api/app`
- **Endpoints Checked**: Health check, request ID propagation, clock, error middleware.

### 4.3 Android Java Tests & Environment
- **Java Runtime**: Temurin OpenJDK 17.0.20.1 64-Bit Server VM detected.
- **Unit Tests Discovered**:
  - `BengaliFormatterTest.java`: Bengali digit conversion, currency formatting.
  - `ClockTest.java`: Injectable clock abstraction.
  - `FeatureFlagsTest.java`: Default flag states.
  - `NotificationHelperTest.java`: Notification channel creation and permission checks.
- **APK Verification Note**: Full APK builds will use Android Gradle tooling with package `com.khabokothay.app`.

---

## 5. Security & Privacy Audit

1. **Secret Scanning**:
   - Repository working tree and full commit history scanned: **100% clean**, no Google API keys, tokens, keystores, or database credentials committed.
   - Pre-commit hook active in `.githooks/pre-commit` guarding against forbidden files and secrets.
2. **PII & Permissions**:
   - Android location is strictly opt-in and requested at runtime only when needed.
   - Pay-Me number (F11) stays strictly on device; zero network transmission.
   - Crash reporting (F15) requires explicit opt-in; full redaction of credentials, tokens, and precise coordinates.
   - Update installation (F1) uses external browser intents; NO `REQUEST_INSTALL_PACKAGES` permission.

---

## 6. Phase-by-Phase Roadmap

* **Phase 0**: Master Audit & Safety Baseline *(Current)*.
* **Phase 1A**: Safety Net: Shared Foundations (Section 3), F14 Remote Feature Flags & Audit Log, F1 Update Checker & What's New, Admin Release Controls.
* **Phase 1B**: Diagnostics: F15 Consent, Local Crash Capture & Upload, Report a Problem, Admin Diagnostics.
* **Phase 2**: Search: F3 Ask in Your Own Words (Bangla, English, Banglish normalizer, corpus, confirmation UI, speech-to-text).
* **Phase 3**: Fare: F2 Fare Check (estimation service, fallback tiers, report validation, admin CSV import, `docs/FARE_METHOD.md`).
* **Phase 4**: Discovery & Group: F4 Group Mode, F5 Swipe Mode, F6 Dish Prices, F8 Dietary Preferences, F7 Rain-Aware Mode.
* **Phase 5**: Convenience: F9 Lunch-Break Reminder, F10 Share My Trip, F11 Pay-Me Line, F12 Simple Mode, F13 Food Story.
* **Phase 6**: Hardening: Security verification, RBAC, regression suites, Android build checks, privacy matrix.
* **Phase 7**: Roadmap: Documentation for future features (`docs/ROADMAP.md`).
* **Phase 8**: GitHub Publication: Pre-push safety checks, clean conventional commits, push to `rahat4528/khabo-kothay`.
