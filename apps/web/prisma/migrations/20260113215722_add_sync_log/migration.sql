-- CreateEnum
CREATE TYPE "SyncLogAction" AS ENUM ('CREATE', 'RENAME', 'DELETE', 'MOVE', 'UPLOAD', 'DOWNLOAD', 'SYNC');

-- CreateEnum
CREATE TYPE "SyncLogStatus" AS ENUM ('SUCCESS', 'FAILED', 'PENDING');

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "SyncLogAction" NOT NULL,
    "itemId" TEXT,
    "itemName" TEXT,
    "fileId" TEXT,
    "fileName" TEXT,
    "status" "SyncLogStatus" NOT NULL,
    "error" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncLog_userId_createdAt_idx" ON "SyncLog"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SyncLog_userId_status_idx" ON "SyncLog"("userId", "status");

-- CreateIndex
CREATE INDEX "SyncLog_createdAt_idx" ON "SyncLog"("createdAt");

-- AddForeignKey
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
