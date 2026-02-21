/**
 * Dynamic sitemap generation for search engine indexing.
 * Includes static pages, public profiles, and public items.
 */

import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://canoncore.com";

/**
 * Generates a dynamic sitemap with all indexable pages.
 *
 * @returns Sitemap entries for static pages, public profiles, and public items
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      changeFrequency: "monthly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/explore`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/docs`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/legal`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/legal/privacy-policy`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/legal/terms-of-service`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/legal/cookie-policy`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  // Fetch profiles, items, and playlists in parallel — independent queries
  const [publicUsers, publicItems, publicPlaylists] = await Promise.all([
    prisma.user.findMany({
      where: { isPublic: true, username: { not: null } },
      select: { username: true, updatedAt: true },
    }),
    prisma.item.findMany({
      where: {
        isPublic: true,
        inheritVisibility: false,
        user: { isPublic: true, username: { not: null } },
      },
      select: {
        id: true,
        updatedAt: true,
        user: { select: { username: true } },
      },
    }),
    prisma.playlist.findMany({
      where: {
        isPublic: true,
        user: { isPublic: true, username: { not: null } },
        playlistItems: { some: { item: { isPublic: true } } },
      },
      select: {
        id: true,
        updatedAt: true,
        user: { select: { username: true } },
      },
    }),
  ]);

  const profilePages: MetadataRoute.Sitemap = publicUsers.map((user) => ({
    url: `${BASE_URL}/u/${user.username}`,
    lastModified: user.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const itemPages: MetadataRoute.Sitemap = publicItems.map((item) => ({
    url: `${BASE_URL}/u/${item.user.username}/${item.id}`,
    lastModified: item.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const playlistPages: MetadataRoute.Sitemap = publicPlaylists.map(
    (playlist) => ({
      url: `${BASE_URL}/u/${playlist.user.username}/playlists/${playlist.id}`,
      lastModified: playlist.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })
  );

  return [...staticPages, ...profilePages, ...itemPages, ...playlistPages];
}
