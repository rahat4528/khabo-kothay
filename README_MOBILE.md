# Android Mobile App Build & Deployment Guide

This guide provides copy-paste instructions to run, build, and deploy the Android mobile app for **Khabo Kothay?** (Bangla: খাবো কোথায়?) using React Native and Expo.

---

## 1. Quick Local Development (Expo Go / Emulator)

To run the app locally on your machine or test on your Android device:

```bash
# 1. Navigate to the mobile folder
cd mobile

# 2. Set the backend API URL to your machine's local IP address
# On Android Emulator: use http://10.0.2.2:3000
# On a physical device: use http://<YOUR_LOCAL_IP>:3000 (e.g. http://192.168.0.115:3000)
export EXPO_PUBLIC_API_BASE_URL="http://10.0.2.2:3000"
export EXPO_PUBLIC_APP_CLIENT_TOKEN="<your_app_client_token>"

# 3. Start Expo development server
npx expo start
```

Press `a` in the terminal to launch the Android emulator, or scan the QR code using the **Expo Go** app on your physical Android phone (ensure phone and PC are on the same Wi-Fi network).

---

## 2. Deploying the Backend to HTTPS (Render)

Because physical mobile devices and production APKs require secure HTTPS connections to access network resources:

1. Create a free account at [Render.com](https://render.com/).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository.
4. Set Build Command: `npm install`
5. Set Start Command: `npm run start`
6. Add the following **Environment Variables** in Render:
   - `PORT`: `3000`
   - `USE_MOCK_DATA`: `true` (or `false` if using real Google Cloud keys)
   - `GOOGLE_SERVER_KEY`: `<your_google_server_key>`
   - `GOOGLE_BROWSER_KEY`: `<your_google_browser_key>`
   - `APP_CLIENT_TOKEN`: `<your_app_client_token>`
7. Click **Deploy**. Render will generate a URL like: `https://khabo-kothay.onrender.com`.

---

## 3. Creating the Google Maps SDK for Android Key

To show interactive Google Maps inside the native Android APK:

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Maps SDK for Android**.
3. Go to **APIs & Services** → **Credentials** → **Create Credentials** → **API Key**.
4. Click **Edit Key** and configure:
   - **Application restrictions**: Select **Android apps**.
   - Add your package name: `com.khabokothay.app` (or your custom package name).
   - Enter your **SHA-1 certificate fingerprint**.
5. To get your SHA-1 fingerprint from EAS:
   ```bash
   eas credentials -p android
   ```
   Select your build profile to view the keystore SHA-1 fingerprint.

---

## 4. Building the Standalone APK with EAS Build

Generate a direct installable `.apk` file for your Android phone:

```bash
# Step 1: Install EAS CLI globally
npm install -g eas-cli

# Step 2: Login to your Expo account
eas login

# Step 3: Configure EAS project ID (if first time)
eas init

# Step 4: Build standalone preview APK
eas build -p android --profile preview
```

### Installing the APK on your Android Phone:
1. When EAS build completes, it will output a download URL and a QR code in the terminal.
2. Open the URL or scan the QR code on your Android device to download the `.apk`.
3. Open the downloaded file. When prompted, toggle **Allow from this source** under your phone's *Install Unknown Apps* security settings.
4. Tap **Install** and enjoy Khabo Kothay? on your phone!

---

## 5. Before a Public Google Play Store Release Checklist

Before uploading an `.aab` (Android App Bundle) to Google Play Console:

- [ ] **Package Name**: Verify `com.khabokothay.app` in [mobile/app.config.js](file:///mobile/app.config.js) or replace with your registered package name.
- [ ] **App Check / Play Integrity**: Replace the basic `X-App-Token` header with **Google Play Integrity API** or **Firebase App Check** for cryptographic request attestation.
- [ ] **Production Build Command**:
  ```bash
  eas build -p android --profile production
  ```
  This generates an `.aab` file ready for the Google Play Console internal test track.
- [ ] **Data Safety Form**:
  - Location: Approximate and precise location collected only when in use to calculate travel times and route options. Location data is **not shared with third parties** and **not stored on servers**.
  - Diagnostics: Optional crash logs.
- [ ] **Privacy Policy URL**: Host a publicly accessible privacy policy stating that taste profile affinities and search history remain strictly on the local device storage.
- [ ] **Google Maps Terms of Service**: Verify compliance with Google Maps Platform caching terms (place details and travel matrix data must only be cached short-term).
