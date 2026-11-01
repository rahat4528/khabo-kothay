# Khabo Kothay? (খাবো কোথায়?) – Food Finder

A full-stack, traffic-aware dining recommendation engine and personal food assistant for Gulshan, Banani, Baridhara, and Notun Bazar in Dhaka, Bangladesh.

It answers one single question:
> **"Where should I actually go right now, and why?"**

Instead of just listing nearby spots by straight-line distance, it ranks candidates using real-time road congestion (Google Routes API), multi-modal transit fares (rickshaws, CNGs, ride-shares, walking), restaurant price tier, Bayesian review credibility, personal taste affinity, and time-of-day mood, providing a clear plain-language explanation for every recommendation.

---

## 🏆 Key Logic Handled

A restaurant **1.4 km away with heavy traffic (25 min)** loses to one **2.1 km away with light traffic (12 min)** when the user prioritizes **Fastest** or **Best Overall**.

```
Spot A: 2.4 km • 14 min • ৳৳ • 4.6★ (moderate traffic) ➔ 🌟 Wins Best Overall
Spot B: 1.6 km • 27 min • ৳৳ • 4.5★ (heavy traffic)    ➔ ❌ Loses Fastest
Spot C: 3.1 km • 16 min • ৳৳৳ • 4.7★ (low traffic)      ➔ ⭐ Wins Best Rated
```

---

## ⏱️ Meal-Time Mode ("খাওয়ার সময় মোড")

**"Tell us how much time you have. We'll find food you can actually reach, eat, and get back from before your time runs out."**

Meal-Time Mode is a time-aware recommendation engine that treats feasibility as a **hard constraint** — popularity or ratings can never override your clock.

### Core Feasibility Gate
$$\text{Total Required Time} = T_{\text{outbound}} + T_{\text{wait}} + T_{\text{eat}} + T_{\text{return}} + T_{\text{buffer}}$$
$$\text{Spare Time} = T_{\text{available}} - \text{Total Required Time}$$

A restaurant is feasible **only if** $\text{Spare Time} \ge 0$ **AND** the venue is open at expected arrival through finish time plus a 30-minute kitchen last-order margin.

- **Status Badges**:
  - `SAFE`: Spare time $\ge 3$ minutes.
  - `TIGHT`: $0 \le \text{Spare time} < 3$ minutes (e.g. 45 min total on 45 min break).
  - `NOT_RECOMMENDED`: Spare time $< 0$ (excluded, except in Flexible slightly-over section).
- **Four Modes** (`config/mealtime.json`):
  - **Breakfast**: 30 min default. Quick-service, bakeries, cafes. Preselected before 10:30 AM.
  - **Lunch**: 45 min default. Office-friendly, +3 min peak wait (12:30–14:00). Preselected 11:30–15:00.
  - **Evening Snacks**: 30 min default. Cha, street food, bakeries. Preselected 16:00–19:00.
  - **Dinner**: 90 min default. Full meals, +5 min peak wait (20:00–21:30). Preselected after 19:00.
- **Safety Buffer Preferences**:
  - **Balanced (1.0x)**: Standard baseline + traffic/parking/pickup extras.
  - **Safe (1.5x)**: Extra caution margin for tight appointments.
  - **Flexible (0.5x, min 2m)**: Shows places slightly over by $\le 5$ min in a collapsed section.
- **Independent Return Leg & Predicted Traffic**:
  - Independent calculation for outbound (origin to restaurant) and return (restaurant to destination).
  - Departure time for return leg is set to $\text{leaveTime} + T_{\text{outbound}} + T_{\text{wait}} + T_{\text{eat}}$ and labeled *"predicted traffic"*.
- **Privacy Guarantee**:
  - Saved personal places (Office, Home, University) are stored **device-only** in localStorage / AsyncStorage. They are never logged or sent to analytics.
- **Feature Flag**:
  - Controlled by `FEATURE_MEAL_TIME_MODE=true` (defaults to enabled).

---


---

## 🏛️ System Architecture

Khabo Kothay? is structured across specialized modules:
- **Native Android App (`/android`)**:
  - Written in Java adhering strictly to MVVM (ViewModel, LiveData, Repository pattern).
  - Persistence via Room SQLite database with exported JSON schemas.
  - Network layer via Retrofit 2 and OkHttp with structured error interceptors.
  - UI styled with Material Design 3, bilingual English/Bangla strings with 100% key parity, and full TalkBack accessibility compliance.
- **Python FastAPI Backend (`/api`)**:
  - Serves high-performance JSON endpoints under `/api/v1`.
  - Locked to `Asia/Dhaka` timezone with injectable `Clock` / `FakeClock` for deterministic testing.
  - Strictly typed with Pydantic v2 and PEP 561 marker (`py.typed`).
  - OpenAPI 3.1 contract stored in `docs/openapi.json`.
  - In-memory `UsageGuard` to protect daily Google Cloud API limits and prevent unexpected billing.
- **Legacy Node.js Server (`/server`)**:
  - Backwards-compatible Express server providing fallback mock routing, meal-time logic, and scoring models (159 Vitest test assertions).
- **Legacy Expo Mobile Client (`/mobile`)**:
  - React Native (SDK 52) prototype.

---

## 💻 Windows Setup & Local Development

This project is maintained on Windows with PowerShell (`pwsh`).

### Prerequisites
- **Java Development Kit**: Eclipse Temurin or OpenJDK 17 LTS (Java 17+).
- **Python**: Python 3.11 or newer (Python 3.13 supported).
- **Node.js**: Node.js v20 LTS or v22 LTS (v24 supported).
- **Android Studio / Command Line Tools**: Android SDK with API 34+ build-tools.

### Setting Up the Python FastAPI Server
```powershell
# Create and activate virtual environment (optional)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install requirements
pip install -r api/requirements.txt
pip install ruff mypy pytest pytest-cov pip-audit

# Run the FastAPI development server
uvicorn app.main:app --app-dir api --port 8000 --reload
```
API Documentation will be live at `http://localhost:8000/docs`.

### Setting Up the Android App
1. Copy `android/local.properties.example` to `android/local.properties`:
   ```powershell
   Copy-Item android/local.properties.example android/local.properties
   ```
2. Configure your Android SDK path and Maps API key in `android/local.properties`:
   ```properties
   sdk.dir=C:\Users\<Username>\AppData\Local\Android\Sdk
   MAPS_API_KEY=
   ```
3. Open the `android` folder in Android Studio and build the project.

### Building a Debug APK
To build a local debug APK using the Gradle wrapper:
```powershell
cd android
.\gradlew.bat assembleDebug
```
The resulting binary will be located at:
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🧪 Comprehensive Verification & Test Commands

Every pull request and release gate runs automated verification across all layers:

### 1. Python API Test Suite
```powershell
# Linting & Formatting Check
ruff check api
ruff format --check api

# Static Type Verification
$env:MYPYPATH="api"; mypy -p app

# Automated Pytest Suite with Coverage
python -m pytest --cov=app api/tests

# Dependency Security Audit
pip-audit -r api/requirements.txt
```

### 2. Android Unit Tests
```powershell
cd android
.\gradlew.bat testDebugUnitTest
```
*(Or compile core Java test classes directly against JUnit 4).*

### 3. Legacy Node.js Test Suite
```powershell
npm test
```

### 4. Repository Security & Hygiene
```powershell
# Scan working tree and git history for credentials
python scripts/secret_scan.py

# Placeholder & stub detection
python scripts/find_placeholders.py
```

---

## 🔐 Environment Variables Reference

All credentials and dynamic configurations are managed via `.env` (server) and `local.properties` (Android).
Templates with names only (no sensitive values) are tracked in the repository:
- `.env.example`
- `android/local.properties.example`
- `android/keystore.properties.example`

| Variable Name | Component | Description |
| :--- | :--- | :--- |
| `PORT` | API / Node | Network listening port (default `8000` / `3000`) |
| `USE_MOCK_DATA` | API / Node | Flag to serve realistic Dhaka dining mock data without live APIs |
| `GOOGLE_SERVER_KEY` | API / Node | Google Cloud Maps API key for server-side Places & Routes queries |
| `GOOGLE_BROWSER_KEY` | Node Web | Google Maps JavaScript API key for web map display |
| `MAX_GOOGLE_REQUESTS_PER_DAY` | API / Node | Safety cap to prevent unexpected Google Cloud billing |
| `ADMIN_TOKEN` | API / Node | Shared secret for protected administrative endpoints |
| `DATABASE_URL` | API | Optional relational database connection string |
| `REDIS_URL` | API | Optional Redis cache instance URL |
| `ANTHROPIC_API_KEY` | Server | Optional LLM integration key |
| `APP_CLIENT_TOKEN` | Client / API | Header validation token for trusted mobile requests |
| `MAPS_API_KEY` | Android | Google Maps Platform API key injected at Android build time |

---

## 🛡️ Pre-Commit Hook & Repository Hygiene

To prevent accidental secret leaks and keep the repository clean:
1. Activate the local repository git hooks:
   ```powershell
   git config core.hooksPath .githooks
   ```
2. The hook automatically executes before every commit:
   - Scans all staged files using `scripts/secret_scan.py --staged`.
   - Blocks committing forbidden files (`.env`, `local.properties`, `keystore.properties`, `*.jks`, `*.keystore`, `*.apk`, `*.aab`, `google-services.json`).
   - Blocks any staged file larger than 5 MB.

---

## 🎯 Honesty Rules & Transparency

- **Estimates are Always Labeled**: Transit times, kitchen preparation wait times, return trip traffic predictions, and budget approximations are always labeled in the UI as *estimated* or *predicted*.
- **No Fabricated Data**: We never invent restaurants, addresses, menu prices, ratings, or live traffic conditions. When offline or in mock mode, the app explicitly communicates its mock status to the user.
- **Privacy First**: Sensitive user preferences (Home/Office coordinates, budget constraints, spend tracking) remain strictly stored on the device.

## 🛠️ Technology Stack

- **Backend**: Node.js 18+, Express, ES modules, dotenv, helmet, cors, express-rate-limit.
- **Polyglot High-Performance Architecture**:
  - **C++ (Routing Core)**: 2D KD-Tree spatial index for microsecond k-NN lookups (~350,000 queries/sec), Haversine distance, and multi-criteria Dhaka transit ranking (`engines/routing-core/`).
  - **Python (ML & Analytics Pipeline)**: Multi-Armed Bandit (MAB) with Thompson Sampling & $\epsilon$-greedy exploration, Menu NLP dietary analyzer, and Dhaka transit fare OLS regression (`ml/analytics-pipeline/`).
  - **Java (Enterprise Traffic & Geofencing)**: Jordan Curve ray-casting polygon geofencer, municipal rickshaw zone restrictions, and peak-hour dynamic fare dispatch engine (~3.2M quotes/sec) (`services/traffic-dispatch/`).
- **Frontend (Web)**: HTML5, CSS3 (modern glassmorphism, mobile-first responsive), Vanilla JavaScript (ES modules, no framework).
- **Mobile (Android)**: React Native with Expo (SDK 52), React Navigation, react-native-maps, expo-location, expo-notifications, expo-localization, AsyncStorage.
- **APIs**:
  - Google Places API (New) – Text Search, Details, Photos proxy.
  - Google Routes API – `computeRouteMatrix` (traffic-aware duration & distance) & `computeRoutes` (alternative routes & polylines).
  - Open-Meteo – Weather context for Dhaka (monsoon/rain detection).
- **Testing**: 147 automated tests passing across 23 Vitest suites + Python `unittest` suite + Java JUnit/test suite (`npm run test:all`).
- **Storage**: Modular storage abstraction (`localStorage` for web, `AsyncStorage` for mobile).

---

## 🚀 Quick Start

### 1. Run in Mock Mode (No Google API Keys Needed)

The app comes configured out-of-the-box with `USE_MOCK_DATA=true` and a complete dataset of realistic fake restaurants in Gulshan, Banani, Baridhara, and Notun Bazar with varied ratings, prices, and traffic conditions.

```bash
# Install root dependencies
npm install

# Run the test suite (Vitest)
npm test

# Start the server
npm start
```

Open your browser at: **`http://localhost:3000`**

### 2. Run with Real Google Cloud Keys

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Set the following environment variables:
   ```env
   PORT=3000
   USE_MOCK_DATA=false
   GOOGLE_SERVER_KEY=AIzaSy...YourServerKeyHere
   GOOGLE_BROWSER_KEY=AIzaSy...YourBrowserKeyHere
   APP_CLIENT_TOKEN=<your_app_client_token>
   ```
3. Restart the server:
   ```bash
   npm start
   ```

### 3. Polyglot Engines & High-Speed Benchmarks

Run the high-performance C++, Python, and Java services:

```bash
# 1. C++ High-Speed KD-Tree Spatial Routing Engine
npm run cpp:bench      # Benchmarks 100,000 spatial queries (~350,000 QPS, 2.8 µs latency)

# 2. Python ML & Menu NLP Analytics Pipeline
npm run py:pipeline   # Runs Menu NLP, Fare OLS Regression & MAB Thompson Sampling
npm run py:test       # Runs Python unit test suite

# 3. Java Enterprise Traffic Dispatch & Geofencing Service
npm run java:run      # Runs Jordan Curve ray-caster & multi-mode traffic dispatch (~3.2M QPS)
npm run java:test     # Runs Java unit test suite

# 4. Run All Polyglot Tests in One Command
npm run test:all      # Runs Vitest (147 tests) + Python tests + Java tests
```

---

## ☁️ Google Cloud Setup & Security Guide

### 1. Enable Required APIs in Google Cloud Console
- Go to [Google Cloud Console](https://console.cloud.google.com/).
- Create a new project (e.g. `gulshan-food-finder`).
- Enable the following APIs:
  - **Places API (New)**
  - **Routes API**
  - **Maps JavaScript API**
  - **Maps SDK for Android**

### 2. Set Up Billing & Budget Alerts
- Attach a billing account to your project.
- In **Billing** → **Budgets & alerts**, create an alert at $20 / $50 per month to prevent unexpected charges during high-volume testing.

### 3. API Key Restrictions & Isolation
- **Server Key (`GOOGLE_SERVER_KEY`)**:
  - Restrict by API: select **Places API (New)** and **Routes API**.
  - **Application restrictions**: select **IP addresses** (set to your server's IP address in production).
  - **Security Rule**: This key is used strictly on the server backend. It is **never sent to the browser or mobile app**.
- **Browser Key (`GOOGLE_BROWSER_KEY`)**:
  - Restrict by API: select **Maps JavaScript API**.
  - **Application restrictions**: select **HTTP referrers (websites)**.
  - Add your website domains: `https://your-domain.com/*`, `http://localhost:3000/*`.
- **Android Maps Key**:
  - Restrict by API: select **Maps SDK for Android**.
  - Restrict by application: select **Android apps** with your package name (`com.example.cafefinder`) and keystore SHA-1 fingerprint.

---

## 📝 Assumptions Made

1. **Transport Fares in Dhaka**:
   - Transport rates in [server/config/fares.json](file:///server/config/fares.json) are based on standard Dhaka local fare estimates:
     - Rickshaw: ৳20 base + ৳20/km.
     - CNG Auto-rickshaw: ৳40 base + ৳17/km.
     - Car / Ride-share (Uber/Pathao): ৳60 base + ৳25/km + ৳2/min with congestion multipliers.
   - **Important**: These fares are placeholders for guidance and must be checked and tuned against actual local street rates. All transport costs are explicitly labeled as *"estimated"* throughout the UI.
2. **Traffic Congestion Multipliers**:
   - Routes API duration-to-static-duration ratios: Low (< 1.15), Moderate (1.15 – 1.50), Heavy (> 1.50) based on Gulshan bottlenecks.
3. **Taste Profile & Privacy**:
   - No user tracking without login. All personal taste profile affinities, favorites, and search histories are stored purely in the user's browser `localStorage` or device `AsyncStorage`.
   - The taste profile is transmitted to the recommendation engine as an anonymous request payload and is **never stored or logged in server databases**.
4. **Collaborative Filtering**:
   - Real collaborative filtering requires a multi-user database with account history. In this standalone version, collaborative filtering is gated behind `collaborative.enabled` (default `false`), backed by a 50-user synthetic seed matrix for offline demonstration and testing.
5. **Mobile API Deterrent**:
   - The `X-App-Token` header provides a basic deterrent against unauthorized scraper scripts. In production, this should be superseded by **Google Play Integrity API** or **Firebase App Check**.

---

## 🌐 Render Deployment Steps

To host the backend and web frontend on Render:

1. Push your repository to GitHub.
2. Log in to [Render.com](https://render.com/) and click **New +** → **Web Service**.
3. Select your repository.
4. Configure service parameters:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start`
5. Under **Environment Variables**, define:
   - `PORT`: `3000`
   - `USE_MOCK_DATA`: `true` (or `false` when using live Google Cloud keys)
   - `GOOGLE_SERVER_KEY`: `<your_google_server_key>`
   - `GOOGLE_BROWSER_KEY`: `<your_google_browser_key>`
   - `APP_CLIENT_TOKEN`: `<your_app_client_token>`
6. Click **Create Web Service**. Render will build and deploy your application with an automatic HTTPS URL.

---

## 🔒 Security Audit Verification

A rigorous code scan has been conducted to verify credential safety:
- [server/routes/api.js](file:///server/routes/api.js): `GET /api/config` explicitly returns **only** `googleBrowserKey` and `useMockData`.
- `GET /api/places/photo` proxies Google binary images server-side without redirecting or exposing the key.
- Mobile client codebase (`/mobile`) uses only `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY` and talks strictly to the Express backend via `EXPO_PUBLIC_API_BASE_URL`.

---

## 🧪 Testing

Run the Vitest test suite covering both server algorithms and mobile utilities:
```bash
npm test
```
Outputs:
- Bayesian rating reliability assertions
- Trio A / B / C ranking verification
- Traffic trade-off validation (fast light traffic beating close heavy traffic)
- Taste profile learning, decay, clamping, and dismissal signals
- Discovery similarity mapping and exploration capping
- Mobile formatters and English/Bangla i18n
- P1 contract tests, coarse grid caching, SWR, and quota limit assertions

---

## 💰 Google Cloud Quotas, Budget Alerts & Platform Pricing

> [!IMPORTANT]
> When operating with live Google Cloud API keys, always configure strict billing safeguards in the Google Cloud Console to prevent accidental overdrafts.

1. **Check Current Google Maps Platform Pricing**:
   - Review the official [Google Maps Platform Pricing Guide](https://mapsplatform.google.com/pricing/).
   - Places API (New) Text Search charges per SKU, and Routes API charges per element.
   - Khabo Kothay? minimizes billing by:
     - Caching candidate queries by coarse ~300m spatial grid for 10 minutes.
     - Caching traffic route matrices for 2 minutes with Stale-While-Revalidate (SWR).
     - Loading restaurant details (phone numbers, full opening hours) lazily only when a user taps a card.
2. **Set Quotas and Budget Alerts**:
   - In [Google Cloud Console Billing](https://console.cloud.google.com/billing), create a **Budget Alert** with email notifications at 50%, 80%, 90%, and 100% of your targeted monthly spend.
   - In **APIs & Services** → **Quotas & System Limits**, place daily caps on *Places API (New)* and *Routes API* requests.
3. **Internal Cost Control Kill-Switch**:
   - Khabo Kothay? tracks endpoint consumption at `/api/v1/admin/usage`.
   - When the monthly budget is reached (default 10,000 requests) or the kill-switch is triggered (`POST /api/v1/admin/killswitch`), the API automatically falls back to cached/mock recommendations with a friendly message rather than failing. See [docs/OPERATIONS.md](file:///docs/OPERATIONS.md) for full operational runbooks.
