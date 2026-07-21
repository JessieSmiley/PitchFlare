-- AlterTable
ALTER TABLE "Angle" ADD COLUMN "selected" BOOLEAN NOT NULL DEFAULT false;

-- Preserve existing choices: any angle already promoted to a campaign's
-- primary angle counts as selected under the new multi-select model.
UPDATE "Angle" a
SET "selected" = true
FROM "Campaign" c
WHERE c."primaryAngleId" = a."id";
