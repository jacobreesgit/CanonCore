-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('FOLDER', 'FILE');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('SYNCED', 'PENDING_UPLOAD', 'PENDING_DOWNLOAD', 'CONFLICT', 'ERROR');

-- CreateEnum
CREATE TYPE "AuthType" AS ENUM ('PASSWORD', 'PRIVATE_KEY');

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "connectionId" TEXT,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "sftpModifiedAt" TIMESTAMP(3),
ADD COLUMN     "sftpPath" TEXT,
ADD COLUMN     "size" BIGINT,
ADD COLUMN     "syncStatus" "SyncStatus" NOT NULL DEFAULT 'SYNCED',
ADD COLUMN     "type" "ItemType" NOT NULL DEFAULT 'FOLDER';

-- CreateTable
CREATE TABLE "SftpConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 22,
    "username" TEXT NOT NULL,
    "authType" "AuthType" NOT NULL DEFAULT 'PASSWORD',
    "encryptedCredential" TEXT NOT NULL,
    "basePath" TEXT NOT NULL DEFAULT '/',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastConnectedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SftpConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SftpConnection_userId_idx" ON "SftpConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SftpConnection_userId_name_key" ON "SftpConnection"("userId", "name");

-- CreateIndex
CREATE INDEX "Item_connectionId_sftpPath_idx" ON "Item"("connectionId", "sftpPath");

-- CreateIndex
CREATE INDEX "Item_syncStatus_idx" ON "Item"("syncStatus");

-- AddForeignKey
ALTER TABLE "SftpConnection" ADD CONSTRAINT "SftpConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SftpConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
