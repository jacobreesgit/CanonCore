/**
 * Check seed user's item hierarchy.
 * Usage: pnpm run db:check-seed
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: "seed@canoncore.com" },
  });

  if (!user) {
    console.log("❌ Seed user not found");
    return;
  }

  console.log("👤 User:", user.email);
  console.log("─".repeat(50));

  // Get all root items
  const rootItems = await prisma.item.findMany({
    where: { userId: user.id, parentId: null },
    orderBy: { order: "asc" },
  });

  for (const root of rootItems) {
    await printTree(root.id, 0);
  }

  // Summary
  const totalItems = await prisma.item.count({
    where: { userId: user.id },
  });
  const totalFiles = await prisma.itemFile.count({
    where: { item: { userId: user.id } },
  });

  console.log("─".repeat(50));
  console.log(`📊 Total: ${totalItems} items, ${totalFiles} files`);
}

async function printTree(itemId: string, depth: number) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: {
      children: { orderBy: { order: "asc" } },
      _count: { select: { files: true } },
    },
  });

  if (!item) return;

  const indent = "  ".repeat(depth);
  const fileCount =
    item._count.files > 0 ? ` (${item._count.files} files)` : "";
  const orderInfo = `[o:${item.order}]`;

  console.log(`${indent}${orderInfo} ${item.name}${fileCount}`);

  for (const child of item.children) {
    await printTree(child.id, depth + 1);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
