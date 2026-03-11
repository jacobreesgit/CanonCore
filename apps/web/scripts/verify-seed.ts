/**
 * Quick verification script for seed testing.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function verify() {
  // Get demo user
  const user = await prisma.user.findUnique({
    where: { email: "demo@canoncore.com" },
  });
  if (!user) {
    console.log("No demo user found");
    return;
  }

  // Check pinned items
  const pinned = await prisma.item.findMany({
    where: { userId: user.id, pinnedOrder: { not: null } },
    orderBy: { pinnedOrder: "asc" },
  });
  console.log(
    "\n📌 Pinned items:",
    pinned.length > 0
      ? pinned.map((i) => `${i.name} (order: ${i.pinnedOrder})`).join(", ")
      : "none"
  );

  // Check Movies folder and children
  const moviesFolder = await prisma.item.findFirst({
    where: { userId: user.id, name: "Movies" },
  });
  const movies = moviesFolder
    ? await prisma.item.findMany({ where: { parentId: moviesFolder.id } })
    : [];
  console.log(
    "\n🎬 Movies folder:",
    moviesFolder
      ? `found (pinnedOrder: ${moviesFolder.pinnedOrder})`
      : "NOT FOUND"
  );
  console.log(
    "   Movies inside:",
    movies.map((m) => m.name).join(", ") || "none"
  );
  console.log("   Movie count:", movies.length);

  // Check TV Shows folder and children
  const tvFolder = await prisma.item.findFirst({
    where: { userId: user.id, name: "TV Shows" },
  });
  const tvShows = tvFolder
    ? await prisma.item.findMany({ where: { parentId: tvFolder.id } })
    : [];
  console.log(
    "\n📺 TV Shows folder:",
    tvFolder ? `found (pinnedOrder: ${tvFolder.pinnedOrder})` : "NOT FOUND"
  );
  console.log(
    "   Shows inside:",
    tvShows.map((s) => s.name).join(", ") || "none"
  );

  // Check Doctor Who substructure
  const doctorWho = await prisma.item.findFirst({
    where: { userId: user.id, name: "Doctor Who" },
  });
  if (doctorWho) {
    const doctorWhoChildren = await prisma.item.findMany({
      where: { parentId: doctorWho.id },
    });
    console.log(
      "\n🎭 Doctor Who subfolders:",
      doctorWhoChildren.map((c) => c.name).join(", ") || "none"
    );
  }

  // Check artwork files
  const artworkCount = await prisma.itemFile.count({
    where: { fileType: "ARTWORK" },
  });
  console.log("\n🖼️  Artwork files:", artworkCount);

  // Check Drive connections
  const driveConnections = await prisma.item.count({
    where: { driveFileId: { not: null } },
  });
  console.log("\n☁️  Items with Drive IDs:", driveConnections);

  // Total items
  const totalItems = await prisma.item.count({ where: { userId: user.id } });
  console.log("\n📊 Total items for demo user:", totalItems);

  // Root level items (no parent)
  const rootItems = await prisma.item.findMany({
    where: { userId: user.id, parentId: null },
  });
  console.log(
    "\n🏠 Root level items:",
    rootItems.map((i) => i.name).join(", ") || "none"
  );

  // Check test user items
  const testUser = await prisma.user.findUnique({
    where: { email: "test@canoncore.com" },
  });
  if (testUser) {
    const testUserItems = await prisma.item.count({
      where: { userId: testUser.id },
    });
    console.log("\n👤 Test user items:", testUserItems);
  } else {
    console.log("\n👤 Test user: NOT FOUND");
  }

  // Check all users
  const allUsers = await prisma.user.findMany({
    select: { email: true },
  });
  console.log("\n👥 All users:", allUsers.map((u) => u.email).join(", "));

  await prisma.$disconnect();
}

verify();
