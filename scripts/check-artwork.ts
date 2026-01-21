/**
 * Quick script to check artwork files for public items.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

async function main() {
  const prisma = new PrismaClient({ adapter });

  const items = await prisma.item.findMany({
    where: {
      isPublic: true,
      inheritVisibility: false,
      user: { isPublic: true },
    },
    select: {
      id: true,
      name: true,
      user: { select: { username: true } },
      files: {
        where: { fileType: "ARTWORK" },
        select: { id: true, driveFileId: true },
        take: 1,
      },
      driveConnection: { select: { id: true } },
    },
    take: 40,
  });

  console.log("\nPublic items artwork check:\n");
  items.forEach((i) => {
    const hasArtwork = i.files[0]?.id ? "✓" : "✗";
    const hasDrive = i.driveConnection?.id ? "✓" : "✗";
    console.log(
      `${hasArtwork} ${hasDrive} | ${i.user?.username?.padEnd(15)} | ${i.name}`
    );
  });
  console.log("\n(✓/✗ = artwork/drive connection)");

  await prisma.$disconnect();
}

main();
