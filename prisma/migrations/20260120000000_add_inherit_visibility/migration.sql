-- AlterTable
ALTER TABLE "Item" ADD COLUMN "inheritVisibility" BOOLEAN NOT NULL DEFAULT false;

-- Explicitly set existing items (safety measure, CR-1)
UPDATE "Item" SET "inheritVisibility" = false;
