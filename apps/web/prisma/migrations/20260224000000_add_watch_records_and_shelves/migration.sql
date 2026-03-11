-- CreateEnum
CREATE TYPE "WatchSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "SystemPlaylistType" AS ENUM ('WATCHLIST', 'CONTINUE_WATCHING', 'RECENTLY_ADDED', 'WATCH_AGAIN');

-- AlterTable
ALTER TABLE "Playlist" ADD COLUMN "systemType" "SystemPlaylistType",
ADD COLUMN "shelfOrder" INTEGER;

-- CreateTable
CREATE TABLE "WatchRecord" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "WatchSource" NOT NULL DEFAULT 'AUTO',
    "watchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WatchRecord_userId_watchedAt_idx" ON "WatchRecord"("userId", "watchedAt" DESC);

-- CreateIndex
CREATE INDEX "WatchRecord_itemId_userId_watchedAt_idx" ON "WatchRecord"("itemId", "userId", "watchedAt" DESC);

-- CreateIndex (unique constraint: one system playlist per type per user)
CREATE UNIQUE INDEX "Playlist_userId_systemType_key" ON "Playlist"("userId", "systemType");

-- AddForeignKey
ALTER TABLE "WatchRecord" ADD CONSTRAINT "WatchRecord_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchRecord" ADD CONSTRAINT "WatchRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
