-- Public Profiles and Forks Migration
-- Adds public profile fields to User, public visibility to Item, Fork model

-- AlterTable: Add public profile fields to User
ALTER TABLE "User" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "username" TEXT;

-- AlterTable: Add public visibility and fork tracking to Item
ALTER TABLE "Item" ADD COLUMN     "forkedFromId" TEXT,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tmdbId" INTEGER,
ADD COLUMN     "tmdbType" TEXT;

-- CreateTable: Fork model for tracking forked items
CREATE TABLE "Fork" (
    "id" TEXT NOT NULL,
    "sourceItemId" TEXT NOT NULL,
    "targetItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fork_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Fork indexes
CREATE INDEX "Fork_sourceItemId_idx" ON "Fork"("sourceItemId");
CREATE INDEX "Fork_userId_idx" ON "Fork"("userId");
CREATE UNIQUE INDEX "Fork_sourceItemId_userId_key" ON "Fork"("sourceItemId", "userId");

-- CreateIndex: Item indexes for public profile queries
CREATE INDEX "Item_isPublic_updatedAt_idx" ON "Item"("isPublic", "updatedAt" DESC);
CREATE INDEX "Item_userId_isPublic_idx" ON "Item"("userId", "isPublic");
CREATE INDEX "Item_forkedFromId_idx" ON "Item"("forkedFromId");

-- AddForeignKey: Item self-reference for fork tracking
ALTER TABLE "Item" ADD CONSTRAINT "Item_forkedFromId_fkey" FOREIGN KEY ("forkedFromId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Fork foreign keys
ALTER TABLE "Fork" ADD CONSTRAINT "Fork_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Fork" ADD CONSTRAINT "Fork_targetItemId_fkey" FOREIGN KEY ("targetItemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Fork" ADD CONSTRAINT "Fork_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex: Case-insensitive unique index on username
-- Uses LOWER() function for case-insensitive uniqueness while allowing NULL values
-- Prisma doesn't support case-insensitive unique constraints natively
CREATE UNIQUE INDEX "User_username_ci_key" ON "User" (LOWER("username")) WHERE "username" IS NOT NULL;
