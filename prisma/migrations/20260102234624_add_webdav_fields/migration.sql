-- AlterTable
ALTER TABLE "SftpConnection" ADD COLUMN     "encryptedWebdavPassword" TEXT,
ADD COLUMN     "webdavUrl" TEXT,
ADD COLUMN     "webdavUsername" TEXT;
