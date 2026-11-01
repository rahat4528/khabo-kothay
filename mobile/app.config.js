module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY || process.env.GOOGLE_MAPS_ANDROID_KEY || config.android?.config?.googleMaps?.apiKey || ""
      }
    }
  },
  extra: {
    ...config.extra,
    eas: {
      projectId: "096074ea-0a29-4eef-af66-d76b22212b86"
    },
    googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY || process.env.GOOGLE_MAPS_ANDROID_KEY || config.android?.config?.googleMaps?.apiKey || "",
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || config.extra?.apiBaseUrl || "https://khabo-kothay.onrender.com",
    appClientToken: process.env.EXPO_PUBLIC_APP_CLIENT_TOKEN || config.extra?.appClientToken || ""
  }
});
