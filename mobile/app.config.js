module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    eas: {
      projectId: "096074ea-0a29-4eef-af66-d76b22212b86"
    },
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || config.extra?.apiBaseUrl || "https://khabo-kothay.onrender.com",
    appClientToken: process.env.EXPO_PUBLIC_APP_CLIENT_TOKEN || config.extra?.appClientToken || ""
  }
});
