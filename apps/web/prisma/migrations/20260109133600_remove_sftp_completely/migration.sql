/*
  Warnings:

  - You are about to drop the column `connectionId` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `sftpModifiedAt` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `sftpPath` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `sftpModifiedAt` on the `ItemFile` table. All the data in the column will be lost.
  - You are about to drop the column `sftpPath` on the `ItemFile` table. All the data in the column will be lost.
  - You are about to drop the `SftpConnection` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Item" DROP CONSTRAINT "Item_connectionId_fkey";

-- DropForeignKey
ALTER TABLE "SftpConnection" DROP CONSTRAINT "SftpConnection_userId_fkey";

-- DropIndex
DROP INDEX "Item_connectionId_sftpPath_idx";

-- DropIndex
DROP INDEX "ItemFile_itemId_sftpPath_idx";

-- DropIndex
DROP INDEX "ItemFile_itemId_sftpPath_key";

-- AlterTable
ALTER TABLE "Item" DROP COLUMN "connectionId",
DROP COLUMN "sftpModifiedAt",
DROP COLUMN "sftpPath";

-- AlterTable
ALTER TABLE "ItemFile" DROP COLUMN "sftpModifiedAt",
DROP COLUMN "sftpPath";

-- DropTable
DROP TABLE "SftpConnection";

-- DropEnum
DROP TYPE "AuthType";
