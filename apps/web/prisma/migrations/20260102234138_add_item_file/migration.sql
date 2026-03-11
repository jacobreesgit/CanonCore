-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('MEDIA', 'ARTWORK', 'SUBTITLE');

-- CreateTable
CREATE TABLE "ItemFile" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sftpPath" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "mimeType" TEXT,
    "size" BIGINT,
    "sftpModifiedAt" TIMESTAMP(3),
    "playbackPosition" DOUBLE PRECISION,
    "playbackDuration" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemFile_itemId_idx" ON "ItemFile"("itemId");

-- CreateIndex
CREATE INDEX "ItemFile_fileType_idx" ON "ItemFile"("fileType");

-- CreateIndex
CREATE UNIQUE INDEX "ItemFile_itemId_sftpPath_key" ON "ItemFile"("itemId", "sftpPath");

-- AddForeignKey
ALTER TABLE "ItemFile" ADD CONSTRAINT "ItemFile_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
