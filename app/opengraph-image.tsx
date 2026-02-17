/**
 * Default OpenGraph image for the application.
 * Generated server-side using Next.js ImageResponse (Satori).
 */

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "CanonCore - Media Library Manager";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    <div
      style={{
        background:
          "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 72,
          fontWeight: 700,
          color: "white",
          marginBottom: 16,
        }}
      >
        CanonCore
      </div>
      <div
        style={{
          fontSize: 28,
          color: "#a0a0a0",
        }}
      >
        Organise, track, and share your media library
      </div>
    </div>,
    { ...size }
  );
}
