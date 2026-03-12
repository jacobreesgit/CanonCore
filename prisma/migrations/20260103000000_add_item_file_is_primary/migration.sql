-- AlterTable
ALTER TABLE "ItemFile" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ItemFile_itemId_fileType_isPrimary_idx" ON "ItemFile"("itemId", "fileType", "isPrimary");
