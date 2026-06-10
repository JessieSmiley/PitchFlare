-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "briefSummary" TEXT,
ADD COLUMN "briefGeneratedAt" TIMESTAMP(3),
ADD COLUMN "briefModelUsed" TEXT;
