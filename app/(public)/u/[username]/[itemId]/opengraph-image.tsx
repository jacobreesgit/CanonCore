/**
 * Dynamic OpenGraph image for public items.
 * Shows item name and TMDB backdrop if available.
 */

import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

// Note: No `export const runtime = "edge"` — Prisma requires Node.js runtime.
export const alt = "CanonCore Item";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ItemOGImage({
  params,
}: {
  params: Promise<{ username: string; itemId: string }>;
}) {
  const { itemId } = await params;

  const item = await prisma.item.findFirst({
    where: { id: itemId, isPublic: true },
    select: {
      name: true,
      description: true,
      tmdbBackdropPath: true,
      user: { select: { username: true, name: true } },
    },
  });

  const name = item?.name ?? "Item";
  const description = item?.description?.slice(0, 120) ?? "";
  const ownerName = item?.user?.name ?? item?.user?.username ?? "";
  const backdropUrl = item?.tmdbBackdropPath
    ? `https://image.tmdb.org/t/p/w1280${item.tmdbBackdropPath}`
    : null;

  return new ImageResponse(
    <div
      style={{
        background:
          "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: 60,
        fontFamily: "sans-serif",
        position: "relative",
      }}
    >
      {backdropUrl && (
        <img
          src={backdropUrl}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.3,
          }}
        />
      )}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: "white",
            marginBottom: 12,
          }}
        >
          {name}
        </div>
        {description && (
          <div style={{ fontSize: 24, color: "#d0d0d0", marginBottom: 16 }}>
            {description}
          </div>
        )}
        <div style={{ fontSize: 20, color: "#808080" }}>
          by {ownerName} on CanonCore
        </div>
      </div>
    </div>,
    { ...size }
  );
}
