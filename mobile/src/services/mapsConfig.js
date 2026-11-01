let extraConfig = {};
try {
  const Constants = require('expo-constants');
  extraConfig = (Constants?.default || Constants)?.expoConfig?.extra || {};
} catch {}

/**
 * Validates whether Google Maps SDK for Android is configured
 */
export const checkGoogleMapsKeyConfigured = () => {
  return Boolean(
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY ||
    process.env.GOOGLE_MAPS_ANDROID_KEY ||
    extraConfig.googleMapsApiKey
  );
};

export default {
  checkGoogleMapsKeyConfigured
};
