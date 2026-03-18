import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "CanonCore",
  slug: "canoncore",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "canoncore",
  userInterfaceStyle: "dark",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.canoncore.mobile",
    config: {
      usesNonExemptEncryption: false,
    },
    associatedDomains: ["applinks:canoncore.com"],
    infoPlist: {
      NSCameraUsageDescription:
        "CanonCore uses the camera to set your profile picture.",
      NSPhotoLibraryUsageDescription:
        "CanonCore accesses your photo library to set your profile picture.",
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType:
            "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
        },
      ],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0a0a0a",
    },
    package: "com.canoncore.mobile",
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "canoncore.com",
            pathPrefix: "/u/",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
    permissions: [
      "android.permission.INTERNET",
      "android.permission.CAMERA",
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.READ_MEDIA_AUDIO",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
      "android.permission.RECEIVE_BOOT_COMPLETED",
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-sqlite",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#0a0a0a",
        image: "./assets/splash-icon.png",
        resizeMode: "contain",
      },
    ],
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    [
      "react-native-google-cast",
      {
        iosStartDiscoveryAfterFirstTapOnCastButton: true,
      },
    ],
    [
      "expo-build-properties",
      {
        ios: {
          deploymentTarget: "16.0",
        },
        android: {
          minSdkVersion: 26,
          targetSdkVersion: 35,
          compileSdkVersion: 35,
        },
      },
    ],
  ],
  updates: {
    url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID ?? "0f4d7ba7-5f00-4599-8b04-7af8989625fd"}`,
  },
  runtimeVersion: {
    policy: "appVersion" as const,
  },
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
    eas: {
      projectId:
        process.env.EAS_PROJECT_ID ?? "0f4d7ba7-5f00-4599-8b04-7af8989625fd",
    },
  },
});
