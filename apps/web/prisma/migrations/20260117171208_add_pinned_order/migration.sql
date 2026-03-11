-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "pinnedOrder" INTEGER;

-- CreateIndex
CREATE INDEX "Item_userId_pinnedOrder_idx" ON "Item"("userId", "pinnedOrder");
