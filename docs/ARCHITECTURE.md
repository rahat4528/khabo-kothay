# System Architecture

## Overview
**Khabo Kothay?** (Bangla: খাবো কোথায়?) is a full-stack, traffic-aware dining recommendation system for Gulshan, Banani, Baridhara, and Notun Bazar in Dhaka, Bangladesh. It solves the critical question: *"Where should I actually go right now, and why?"*

Instead of purely listing nearby places by geometric distance, it factors in real-time Dhaka road traffic (Routes API), multi-modal transit costs (rickshaw, CNG, car, walk), user culinary taste affinity, time-of-day mood, and candidate-set rating reliability (Bayesian average).

---


---

## Production Stack & Reference Prototypes
- **Production Backend (`/server`)**: Node.js & Express server deployed live on Render, providing `/api` and `/api/v1` endpoints with Redis persistence and hybrid rate limiting.
- **Production Mobile App (`/mobile`)**: React Native Expo application built via EAS Build (`com.khabokothay.app`), distributed to end users.
- **Archived Prototypes (`/android`, `/api`)**: Native Java app and Python FastAPI stubs are archived as reference prototypes.

## High-Level Architecture Diagram

```mermaid
graph TD
    subgraph Clients
        Web["Web Frontend (Vanilla JS ES Modules)"]
        Mobile["Android Mobile App (React Native Expo)"]
    end

    subgraph BackendGateway["Node.js / Express Server (Port 3000)"]
        Pino["Structured Logger (pino) + Request IDs"]
        Middleware["Helmet • CORS • Rate Limiter • App Token Auth"]
        Quota["Quota Manager (Device Limits & Kill-Switch)"]
        RoutesV1["Versioned API (/api/v1) & Legacy (/api)"]
        Probes["Liveness (/health) & Readiness (/ready)"]
    end

    subgraph CacheLayer["Dual-Layer Cache Backend"]
        MemCache["In-Memory Cache (Coarse 300m Grid + SWR)"]
        RedisCache["Optional Upstash Redis REST Sync"]
    end

    subgraph ServiceLayer["Services Layer"]
        Places["places.js (Lazy Details & Text Search)"]
        RoutesSvc["routes.js (2-min SWR Matrix Cache)"]
        Cost["cost.js (Dhaka Fares Model)"]
        Recommend["recommend.js (Multi-factor Scoring)"]
        Taste["taste.js (EMA & Decay Engine)"]
        Mood["mood.js (Mood Mapping & Hour Signal)"]
        Discovery["discovery.js (Cuisine Similarity)"]
        Collab["collaborative.js (Cosine Similarity Matrix)"]
        Weather["weather.js (Open-Meteo Integration)"]
    end

    subgraph ExternalAPIs["External Services"]
        GooglePlaces["Google Places API (New)"]
        GoogleRoutes["Google Routes API"]
        OpenMeteo["Open-Meteo Weather API"]
    end

    Web -->|HTTP / JSON| Pino
    Mobile -->|X-App-Token + JSON| Pino
    Pino --> Middleware
    Middleware --> Quota
    Quota --> RoutesV1
    RoutesV1 --> CacheLayer
    RoutesV1 --> Recommend
    RoutesV1 --> Probes
    Recommend --> Places
    Recommend --> RoutesSvc
    Recommend --> Cost
    Recommend --> Taste
    Recommend --> Mood
    Recommend --> Discovery
    Recommend --> Collab
    Recommend --> Weather

    Places -->|GOOGLE_SERVER_KEY| GooglePlaces
    RoutesSvc -->|GOOGLE_SERVER_KEY| GoogleRoutes
    Weather --> OpenMeteo
```

---

## Security Model & Key Isolation

1. **Google Server Key (`GOOGLE_SERVER_KEY`)**:
   - Used strictly on the Node.js backend.
   - Never sent to the browser or embedded into the mobile APK.
   - Places photos are streamed via the backend proxy endpoint `GET /api/places/photo?name=...` so Google API credentials never touch the client.
2. **Google Browser Key (`GOOGLE_BROWSER_KEY`)**:
   - Exposed only through `GET /api/config` for rendering Google Maps JavaScript API on the web.
   - Must be restricted in Google Cloud Console by **HTTP Referrer** (e.g. `https://your-domain.com/*` or `http://localhost:*`).
3. **Android Maps Key (`EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY`)**:
   - Restricted in Google Cloud Console by **Android Package Name** (`com.khabokothay.app`) and **SHA-1 Certificate Fingerprint**.
4. **Mobile API Deterrent (`X-App-Token`)**:
   - A secret token (`APP_CLIENT_TOKEN`) checked by the Express server for mobile app traffic.
5. **Content Security Policy (CSP)**:
   - Helmet configured to allow Google Maps scripts, Google static tiles, and font assets while blocking unauthorized scripts.

---

## Data Flow & Scoring Pipeline

```mermaid
sequenceDiagram
    participant User as User / App
    participant Express as Express /api/recommend
    participant Places as Places Service
    participant Routes as Routes Service
    participant Engine as Recommendation Engine

    User->>Express: POST /api/recommend (lat, lng, cuisine, priority, budget, tasteProfile, mood)
    Express->>Places: Search Candidates (20 max)
    Places-->>Express: Return Candidates
    Express->>Routes: computeTravelTimes (TRAFFIC_AWARE drive + static)
    Routes-->>Express: Return duration, distance, trafficLevel
    Express->>Engine: rankRestaurants(candidates, weights, taste, weather)
    Note over Engine: 1. Bayesian Rating calculation<br/>2. Min-max normalization<br/>3. Budget & closing penalties<br/>4. Discovery badge assignment<br/>5. Generate trade-off reason text
    Engine-->>Express: Ranked list + top picks
    Express-->>User: JSON response with badges, reasons & breakdowns
```

---

## How to Add a New Recommendation Factor

1. **Update Weights**: Add the factor weight in [server/config/weights.json](file:///server/config/weights.json) under each priority preset.
2. **Calculate Raw Value**: Calculate the raw metric in a helper service (e.g., parking availability, outdoor seating).
3. **Normalize Factor**: Inside `rankRestaurants()` in [server/services/recommend.js](file:///server/services/recommend.js), normalize the raw metric across candidates to a `0.0 - 1.0` ratio.
4. **Blend into Score**: Multiply by `weights[factorName]` and add to `baseScore`.
5. **Update Reason Generator**: Extend `generateRecommendationReason()` to highlight the factor when significant.
6. **Add Unit Test**: Add assertions in [server/tests/recommend.test.js](file:///server/tests/recommend.test.js).

---

## How to Add a New Mobile Screen

1. Create screen component in `mobile/src/features/<feature>/<FeatureScreen>.js`.
2. Add route to `mobile/App.js` in either `BottomTabs` or `Stack.Navigator`.
3. Add English and Bangla translation strings in `mobile/src/i18n/en.js` and `mobile/src/i18n/bn.js`.
4. Wrap new endpoints in `mobile/src/api/client.js`.

---

## Phase P2 Recommendation Intelligence Architecture

```mermaid
flowchart TD
    UserReq[User Search Request] --> FilterPool[Spatial & Time-Budget Filter]
    FilterPool --> CandidateCheck[Check Round-Trip + Cuisine Dining Duration]
    CandidateCheck --> PrefCheck[Unverified Dietary & Spice Filter]
    PrefCheck --> TrafficPredict[Routes API Departure Time Matrix]
    TrafficPredict --> Scoring[Bayesian + Weights + Context Signals]
    Scoring --> BanditWeights[Simplex Bounded Bandit [0.05, 0.50]]
    BanditWeights --> TopPicks[Ranked Results & Top 3 Picks]
    TopPicks --> Explain[Counterfactual & Prediction Suggestions]
    Explain --> Client[Mobile App / Web UI]
```

### 1. Departure Time Prediction Pipeline
- Top 3 candidate places are evaluated across offsets `+0`, `+15`, `+30`, and `+60` minutes.
- When Google Routes API is enabled, queries `v2:computeRoutes` with `departureTime`.
- When in mock mode or during Google API rate limits, falls back to a modeled Dhaka diurnal traffic curve (rush hours at 08:30-10:30 and 16:30-20:30).
- If departing later saves $\ge 3$ minutes, generates an actionable advice label: *"Leave in 30 min to save 11 min (predicted)"*.

### 2. Time-Budget Mode
- Formulates total journey time: $T_{\text{total}} = 2 \times T_{\text{one-way}} + T_{\text{dine}}(cuisine)$.
- Drops places exceeding the user's available time.
- Drops places that close before $T_{\text{arrival}} + T_{\text{dine}}$.

### 3. Personal Weights Bandit
- Factor weights normalized to sum to 1.0 with strict bounds: $w_i \in [0.05, 0.50]$.
- Updates via stochastic feedback loop with learning rate $\eta = 0.05$.
- Produces plain-language explanation notes and provides an instant reset endpoint.

---

## Meal-Time Mode Architecture

```mermaid
flowchart TD
    ClientReq[POST /api/v1/meal-time/search] --> CostPrune[Geometry Pruning: maxOneWayMinutes * maxSpeed]
    CostPrune --> MatrixOutbound[Outbound Route Matrix: Origin -> Candidates]
    MatrixOutbound --> MatrixReturn[Return Route Matrix: Candidates -> Destination with Predicted Departure]
    MatrixReturn --> TimeGate[Feasibility Gate: Spare Time >= 0?]
    TimeGate -->|No| AltEngine[Relaxation Suggestions Engine: Takeaway, +15m, Quicker Venues]
    TimeGate -->|Yes| OpenGate[Opening Check: Arrival through Finish + 30m Last Order]
    OpenGate --> DetailMask[Fetch Serves Meal & Dine-In/Takeout Mask for Top 10]
    DetailMask --> Ranker[Bayesian Rating + Mode Specific Weights]
    Ranker --> Response[Feasible Results + Segmented Time Bars + Explanations]
```

### Core Architecture Components (`server/services/mealtime.js`)
1. **Time Breakdown Calculator**:
   - Computes $T_{\text{outbound}}$, $T_{\text{wait}}$, $T_{\text{eat}}$, $T_{\text{return}}$, and $T_{\text{buffer}}$.
   - $T_{\text{buffer}} = \max(\text{minBuffer}, \% \text{trip}) \times \text{multiplier} + \text{extras}$ (traffic extras + vehicle parking/pickup extras).
   - Takeaway mode sets $T_{\text{eat}} = 0$ at venue ("eat after return").
2. **Two-Leg Independent Routing**:
   - Outbound leg from origin at `leaveAt` (or now).
   - Return leg to destination calculated at `leaveAt + outbound + wait + eat`, labeled "predicted traffic".
   - Detour calculation compares `outbound + return` with direct origin-to-destination time.
3. **Opening & Service Feasibility Gate**:
   - Validates venue is open at expected arrival time in `Asia/Dhaka`.
   - Ensures venue remains open through finish time plus 30-minute kitchen last-order buffer.
   - Respects 24-hour schedules and midnight-crossing operating hours.
   - Eliminates places where `servesLunch = false` (or mode equivalent); flags unverified hours/service without dropping.
4. **Cost Control Pipeline**:
   - Minimal field mask on candidate search.
   - Straight-line geometric bounding prune before route matrix.
   - Two batched Routes API matrices capped at 20 candidates.
   - Detailed field mask only for top 10 ranked candidates.
5. **Computed Alternatives Engine**:
   - When 0 places fit safely, re-runs engine with isolated relaxations: takeaway dining, quicker venue types, adding 15 minutes, or switching transport.
   - Returns real counts and shortest feasible break time.
6. **Anonymous Tuning Feedback Loop (`scripts/tune-mealtime.js`)**:
   - Processes user feedback on actual total trip duration.
   - Recommends updated wait and eat durations per `(mode, venueType)` when $\ge 5$ records exist, outputting to `config/mealtime.suggested.json`.


