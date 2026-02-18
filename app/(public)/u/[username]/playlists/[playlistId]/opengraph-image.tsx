/**
 * Dynamic OpenGraph image for public playlists.
 * Shows playlist name, item count, and first item's TMDB backdrop if available.
 */

import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const alt = "CanonCore Playlist";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function PlaylistOGImage({
  params,
}: {
  params: Promise<{ username: string; playlistId: string }>;
}) {
  const { playlistId } = await params;

  const playlist = await prisma.playlist.findFirst({
    where: { id: playlistId, isPublic: true },
    select: {
      name: true,
      description: true,
      user: { select: { username: true, name: true } },
      playlistItems: {
        where: { item: { isPublic: true } },
        orderBy: { order: "asc" },
        take: 1,
        select: {
          item: { select: { tmdbBackdropPath: true } },
        },
      },
      _count: { select: { playlistItems: true } },
    },
  });

  const name = playlist?.name ?? "Playlist";
  const description = playlist?.description?.slice(0, 120) ?? "";
  const ownerName = playlist?.user?.name ?? playlist?.user?.username ?? "";
  const itemCount = playlist?._count?.playlistItems ?? 0;
  const backdropPath = playlist?.playlistItems[0]?.item?.tmdbBackdropPath;
  const backdropUrl = backdropPath
    ? `https://image.tmdb.org/t/p/w1280${backdropPath}`
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
            fontSize: 16,
            fontWeight: 500,
            color: "#808080",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            marginBottom: 12,
          }}
        >
          Playlist &middot; {itemCount} {itemCount === 1 ? "item" : "items"}
        </div>
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
