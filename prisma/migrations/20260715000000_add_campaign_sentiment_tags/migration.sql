-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "marketSentimentTags" TEXT[];

-- Backfill existing rows so the column reads as an empty list, not NULL.
UPDATE "Campaign" SET "marketSentimentTags" = '{}' WHERE "marketSentimentTags" IS NULL;
