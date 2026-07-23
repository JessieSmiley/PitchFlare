-- AlterEnum
ALTER TYPE "ContactFieldSource" ADD VALUE 'AI_INFERRED';

-- CreateTable
CREATE TABLE "CoverageLikelihood" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "campaignId" TEXT,
    "score" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "breakdown" JSONB NOT NULL,
    "rationale" TEXT,
    "modelUsed" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoverageLikelihood_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoverageLikelihood_brandId_contactId_campaignId_key" ON "CoverageLikelihood"("brandId", "contactId", "campaignId");

-- CreateIndex
CREATE INDEX "CoverageLikelihood_brandId_contactId_idx" ON "CoverageLikelihood"("brandId", "contactId");

-- CreateIndex
CREATE INDEX "CoverageLikelihood_campaignId_idx" ON "CoverageLikelihood"("campaignId");

-- AddForeignKey
ALTER TABLE "CoverageLikelihood" ADD CONSTRAINT "CoverageLikelihood_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageLikelihood" ADD CONSTRAINT "CoverageLikelihood_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
