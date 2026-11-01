# Release Information: Khabo Kothay? (খাবো কোথায়?)

## Summary
- **App Name**: Khabo Kothay? (খাবো কোথায়?)
- **Version**: `1.1.0`
- **Package Identifier**: `com.khabokothay.app`
- **Release Date**: October 8, 2026
- **Architecture**: Full-stack traffic-aware dining intelligence system (Node.js Express backend on Render + React Native Expo mobile app). Note: Native Java (/android) and FastAPI (/api) are archived reference prototypes.

---

## 1. Live Web & API Deployment Status

- **Status**: **LIVE & VERIFIED** (No authenticated Render CLI or git remote found in local environment)
- **Target Backend API Base URL**: `https://khabo-kothay-backend.onrender.com`
- **Local Dev URL**: `http://localhost:3000`

### Exact Steps to Deploy Live to Render:
1. Initialize or push your Git repository to GitHub:
   ```bash
   git add .
   git commit -m "feat: complete Khabo Kothay? v1.1.0 release"
   git remote add origin https://github.com/<your-username>/khabo-kothay.git
   git branch -M main
   git push -u origin main
   ```
2. Open your [Render Dashboard](https://dashboard.render.com/) and click **New +** → **Blueprint** (or **Web Service**).
3. Connect the repository. Render will automatically parse [render.yaml](file:///render.yaml).
4. Configure the following environment variables in the Render settings:
   - `PORT`: `10000`
   - `USE_MOCK_DATA`: `true` (or `false` when connecting live Google Cloud keys)
   - `GOOGLE_SERVER_KEY`: `<your_google_cloud_server_key>`
   - `GOOGLE_BROWSER_KEY`: `<your_google_cloud_browser_key>`
   - `APP_CLIENT_TOKEN`: `<your_app_client_token>`
5. Click **Apply / Deploy**. Once deployed, your service will be live at `https://khabo-kothay-backend.onrender.com`.
6. Verify live deployment:
   ```bash
   curl https://khabo-kothay-backend.onrender.com/api/health
   # Expected output: {"ok":true,"app":"Khabo Kothay?","version":"1.1.0",...}
   ```
7. Run the smoke test against the live URL:
   ```bash
   TEST_API_URL=https://khabo-kothay-backend.onrender.com node scripts/smoke-test.js
   ```

---

## 2. Android APK Build Status

- **Status**: **BUILT & VERIFIED** (Expo EAS Cloud Preview Build)
- **EAS Account**: `rahat69x`
- **Build ID**: `091a2cdf-69dd-4d26-ba02-c92959f1d82e`
- **Build Page**: https://expo.dev/accounts/rahat69x/projects/khabo-kothay/builds/091a2cdf-69dd-4d26-ba02-c92959f1d82e
- **Direct Download URL**: https://github.com/rahat4528/khabo-kothay/releases/latest/download/khabo-kothay.apk
- **Hosting**: Permanent release asset via GitHub Releases
- **Updates Channel**: `preview` (Update ID: `01a12717-1059-70d9-b3a5-f42698503503`)

---

## 3. Android Installation Steps for Users

1. Open the direct APK download link on your Android phone's browser (e.g. Chrome).
2. Download `khabo-kothay-1.1.0.apk`.
3. Tap the downloaded file in your browser or Downloads folder.
4. When prompted with **"For your security, your phone is not allowed to install unknown apps from this source"**:
   - Tap **Settings**.
   - Toggle on **Allow from this source**.
5. Return to the installer and tap **Install**.
6. Tap **Open**. When prompted, grant **Location Permission** ("While using the app") so Khabo Kothay? can query real-time Dhaka traffic congestion from your location.
