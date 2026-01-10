-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('SYNCED', 'PENDING', 'SYNCING', 'ERROR');

-- CreateTable
CREATE TABLE "GoogleDriveConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "encryptedAccessToken" TEXT,
    "accessTokenExpiry" TIMESTAMP(3),
    "rootFolderId" TEXT NOT NULL,
    "changePageToken" TEXT,
    "quotaBytesUsed" BIGINT,
    "quotaBytesTotal" BIGINT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "needsReauth" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleDriveConnection_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add Google Drive fields to Item
ALTER TABLE "Item" ADD COLUMN "driveFileId" TEXT;
ALTER TABLE "Item" ADD COLUMN "driveModifiedAt" TIMESTAMP(3);
ALTER TABLE "Item" ADD COLUMN "driveThumbnailUrl" TEXT;
ALTER TABLE "Item" ADD COLUMN "syncStatus" "SyncStatus" NOT NULL DEFAULT 'SYNCED';
ALTER TABLE "Item" ADD COLUMN "syncError" TEXT;
ALTER TABLE "Item" ADD COLUMN "driveConnectionId" TEXT;

-- AlterTable: Make sftpPath optional and add Google Drive fields to ItemFile
ALTER TABLE "ItemFile" ALTER COLUMN "sftpPath" DROP NOT NULL;
ALTER TABLE "ItemFile" ADD COLUMN "driveFileId" TEXT;
ALTER TABLE "ItemFile" ADD COLUMN "syncStatus" "SyncStatus" NOT NULL DEFAULT 'SYNCED';
ALTER TABLE "ItemFile" ADD COLUMN "syncError" TEXT;

-- CreateIndex: GoogleDriveConnection unique userId (single connection per user)
CREATE UNIQUE INDEX "GoogleDriveConnection_userId_key" ON "GoogleDriveConnection"("userId");

-- CreateIndex: Item Drive lookups
CREATE INDEX "Item_driveConnectionId_driveFileId_idx" ON "Item"("driveConnectionId", "driveFileId");
CREATE INDEX "Item_syncStatus_idx" ON "Item"("syncStatus");

-- CreateIndex: ItemFile unique and lookup indexes
CREATE UNIQUE INDEX "ItemFile_itemId_driveFileId_key" ON "ItemFile"("itemId", "driveFileId");
CREATE INDEX "ItemFile_itemId_sftpPath_idx" ON "ItemFile"("itemId", "sftpPath");
CREATE INDEX "ItemFile_itemId_driveFileId_idx" ON "ItemFile"("itemId", "driveFileId");

-- AddForeignKey: GoogleDriveConnection -> User
ALTER TABLE "GoogleDriveConnection" ADD CONSTRAINT "GoogleDriveConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Item -> GoogleDriveConnection
ALTER TABLE "Item" ADD CONSTRAINT "Item_driveConnectionId_fkey" FOREIGN KEY ("driveConnectionId") REFERENCES "GoogleDriveConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
