import { NextResponse } from "next/server";

/**
 * Android Digital Asset Links for App Links.
 *
 * Android checks this file at install time to verify the app is authorized
 * to handle URLs from this domain.
 *
 * @see https://developer.android.com/training/app-links/verify-android-applinks
 */
export async function GET() {
  const assetLinks = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.canoncore.mobile",
        sha256_cert_fingerprints: [
          process.env.ANDROID_SHA256_FINGERPRINT ??
            "00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00",
        ],
      },
    },
  ];

  return NextResponse.json(assetLinks, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
