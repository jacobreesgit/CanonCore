import { NextResponse } from "next/server";

/**
 * Apple App Site Association (AASA) file for Universal Links.
 *
 * iOS checks this file to determine which URL paths should open in the native app.
 * Must be served at /.well-known/apple-app-site-association with no file extension.
 *
 * @see https://developer.apple.com/documentation/bundled-resources/supporting-associated-domains
 */
export async function GET() {
  const association = {
    applinks: {
      apps: [],
      details: [
        {
          appIDs: [
            `${process.env.APPLE_TEAM_ID ?? "XXXXXXXXXX"}.com.canoncore.mobile`,
          ],
          components: [
            {
              "/": "/u/*",
              comment: "Public user profiles",
            },
            {
              "/": "/u/*/*",
              comment: "Public item detail",
            },
            {
              "/": "/u/*/playlists/*",
              comment: "Public playlist detail",
            },
            {
              "/": "/api/*",
              exclude: true,
              comment: "Exclude API routes",
            },
            {
              "/": "/sign-in",
              exclude: true,
              comment: "Exclude auth",
            },
            {
              "/": "/sign-up",
              exclude: true,
              comment: "Exclude auth",
            },
            {
              "/": "/docs/*",
              exclude: true,
              comment: "Exclude docs",
            },
            {
              "/": "/legal/*",
              exclude: true,
              comment: "Exclude legal",
            },
          ],
        },
      ],
    },
  };

  return NextResponse.json(association, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
