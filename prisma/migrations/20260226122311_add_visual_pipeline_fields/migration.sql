-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "dominantColour" TEXT,
ADD COLUMN     "tmdbLogoPath" TEXT;

-- AlterTable
ALTER TABLE "ItemFile" ADD COLUMN     "isLogo" BOOLEAN NOT NULL DEFAULT false;
