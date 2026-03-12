/**
 * Dynamic OpenGraph image for user profiles.
 * Shows username and item count with cinematic dark styling.
 */

import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

// Note: No `export const runtime = "edge"` — Prisma requires Node.js runtime.
export const alt = "CanonCore Profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ProfileOGImage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const user = await prisma.user.findFirst({
    where: {
      username: { equals: username, mode: "insensitive" },
      isPublic: true,
    },
    select: {
      name: true,
      username: true,
      _count: { select: { items: { where: { isPublic: true } } } },
    },
  });

  const displayName = user?.name ?? `@${username}`;
  const itemCount = user?._count.items ?? 0;

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
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 44,
          fontWeight: 700,
          color: "white",
          marginBottom: 24,
        }}
      >
        {(displayName[0] ?? "?").toUpperCase()}
      </div>
      <div
        style={{
          fontSize: 48,
          fontWeight: 700,
          color: "white",
          marginBottom: 8,
        }}
      >
        {displayName}
      </div>
      <div style={{ fontSize: 24, color: "#a0a0a0" }}>
        {itemCount} public {itemCount === 1 ? "item" : "items"} on CanonCore
      </div>
    </div>,
    { ...size }
  );
}
