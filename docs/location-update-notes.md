# Khabo Kothay - Inspection & Architecture Notes (Section 1)

## 1. Tech Stack & APK Production
- **Web Frontend**: Vanilla ES6 modules (`public/js/app.js`, `api.js`, `state.js`, `storage.js`, `map.js`, `i18n.js`), responsive CSS custom property tokens (`public/css/style.css`, `theme.css`), SVG vector graphics, PWA Service Worker (`sw.js`).
- **Backend**: Node.js 18+ (Express 4.19, Helmet CSP, Pino logger, rate-limit, Vitest).
- **Mobile Stack**: React Native 0.76.6 / Expo SDK 52 with `@react-navigation/bottom-tabs`, `@react-native-async-storage/async-storage`, `expo-location`, `expo-constants`, `react-native-maps`.
- **Native Android Engine (`android/`)**: Pure native Android project with AGP 8.3.1, Gradle 8.4, Java 17, `com.khabokothay.app`, minSdk 24 (Android 7.0), targetSdk 34 (Android 14), compileSdk 34.
- **APK Production**: Produced via standard Gradle build system (`./gradlew assembleDebug` or `./gradlew assembleRelease`).
- **Root APK Diagnosis (Section 13)**: The legacy file at `khabo-kothay-latest.apk` was previously a 42 KB HTML error page (`<!DOCTYPE html>`) saved with an `.apk` extension. When users tried to install it, Android package manager failed with `AAPT: error: failed opening zip: Invalid file` and `com.android.apksig.apk.ApkFormatException: Malformed APK: not a ZIP archive`. Building the native project with Gradle 8.4 and API 34 SDK produces a genuine, installable 7.49 MB APK (SHA256: `7584E6983BA19CE71DE7DA63FDCA94C6053559B2C12F455DCB67100381A64896`) that verifies under v2 signature scheme and passes 4-byte zipalign.

## 2. Where Area Names Appear
- **Source of Truth**: `server/services/locations.js` containing 118 verified Dhaka neighborhoods and corridors across all Dhaka Thanas.
- **API Endpoint**: `GET /api/locations?q=` and `GET /api/v1/locations?q=` providing case-insensitive, prefix-ranked autocomplete suggestions.
- **Web UI**: Dynamic Combobox `#locationSearchInput`, `#locationCombobox`, `#locationSuggestions` in `public/index.html`.
- **Mobile UI**: `mobile/src/services/location.js` and `HomeScreen.js` dynamic area suggestions.
- **Neutral Defaults**: Neutral Dhaka centroid (`23.8103, 90.4125`) replaces legacy hardcoded Gulshan/Notun Bazar coordinates.

## 3. Location Data Details
- **118 Dhaka Neighborhoods**: Detailed with ID, primary displayName, aliases, coordinates (lat/lng), Thana, and popularity tier.
- **33 Real Dhaka Restaurants**: Located across Dhanmondi, Uttara, Banani, Gulshan, Baridhara, Jamuna Future Park, and Mirpur.
- **Microservices**: Java Geofence Manager (`DhakaGeofenceManager.java`) models Gulshan-1, Gulshan-2, Banani, Mohakhali, Dhanmondi, Uttara, and Mirpur.

## 4. Recommendation Engine
- **Logic**: Multi-attribute ranking in `server/services/recommend.js` and `engines/routing-core`. Combines Haversine distance, travel duration (with Dhaka congestion factor 1.15-1.75x), transit mode fares (Rickshaw, CNG, Uber), budget fit ratio, community ratings, and Thompson Sampling bandit personalization weights.
- **Mealtime Intelligence**: `server/services/mealtime.js` dynamically detects current meal window (Breakfast, Lunch, Evening Snacks, Dinner, Late Night, Sehri, Iftar) and applies contextual multipliers.

## 5. Design System & Tokens
- **Colors**: Brand Primary Coral (`#FF6E40` to `#FF5722`), Deep Navy Ink (`#1E2229`), Light Card Background (`#FFFFFF`), Dark Mode Surfaces (`#12161A`, `#1A2026`).
- **Typography**: System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) with Noto Sans Bengali for Bangla glyphs.
- **Contrast**: 100% compliant with WCAG AAA/AA contrast ratios (0 raw hex violations in codebase).
- **Languages**: 100% bilingual parity (141 matched keys in `public/js/i18n.js` and `mobile/src/i18n/`).

## 6. Brand Logo Assets
- **Format**: Clean, high-definition SVG vector master with crisp geometric curves.
- **Locations**:
  - Web: `public/img/icon.svg`, `public/img/logo.svg`, `public/favicon.svg` (crisp at 16x16 up to 1024x1024).
  - Mobile: `mobile/assets/icon.svg`, `mobile/assets/logo.svg`.
  - Android Native: `android/app/src/main/res/mipmap-*/ic_launcher.webp` and `res/mipmap-anydpi-v26/ic_launcher.xml`.

## 7. Quality Gates & Test Infrastructure
- **Vitest**: 299 automated unit/integration tests across 50 test files.
- **Java Engine Tests**: 18 tests in `TrafficDispatchTest.java`.
- **Python ML Tests**: 9 tests in `test_analytics.py`.
- **Security Check**: `scripts/security-check.js` (zero credential leakage).
- **Secret Scan**: `scripts/secret_scan.py` (zero secrets across tree and git history).

