-- Delete all FILE type items (they'll be recreated as ItemFiles on next sync)
DELETE FROM "Item" WHERE "type" = 'FILE';

-- Remove the type column
ALTER TABLE "Item" DROP COLUMN "type";

-- Remove sync-related columns (now tracked on ItemFile)
ALTER TABLE "Item" DROP COLUMN "syncStatus";
ALTER TABLE "Item" DROP COLUMN "checksum";
ALTER TABLE "Item" DROP COLUMN "mimeType";
ALTER TABLE "Item" DROP COLUMN "size";
ALTER TABLE "Item" DROP COLUMN "lastSyncedAt";

-- Drop the ItemType enum
DROP TYPE "ItemType";

-- Drop the SyncStatus enum
DROP TYPE "SyncStatus";
