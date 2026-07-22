-- CreateEnum
CREATE TYPE "EmailSource" AS ENUM ('DATABASE', 'CACHE', 'PERMUTATION', 'HUNTER', 'APOLLO', 'PROSPEO', 'DROPCONTACT', 'PEOPLE_DATA_LABS');

-- CreateEnum
CREATE TYPE "EmailVerifyStatus" AS ENUM ('VALID', 'ACCEPT_ALL', 'UNKNOWN', 'INVALID', 'GUESSED');

-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "linkedinUrl" TEXT,
    "funding" JSONB,
    "executives" JSONB,
    "socials" JSONB,
    "pressPages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rssFeeds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pressReleases" JSONB,
    "podcasts" JSONB,
    "awards" JSONB,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceCache" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "SourceCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDiscovery" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "personKey" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "email" TEXT,
    "status" "EmailVerifyStatus" NOT NULL DEFAULT 'UNKNOWN',
    "source" "EmailSource" NOT NULL DEFAULT 'PERMUTATION',
    "confidence" INTEGER,
    "phone" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDiscovery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyProfile_domain_key" ON "CompanyProfile"("domain");

-- CreateIndex
CREATE INDEX "CompanyProfile_refreshedAt_idx" ON "CompanyProfile"("refreshedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SourceCache_key_key" ON "SourceCache"("key");

-- CreateIndex
CREATE INDEX "SourceCache_kind_idx" ON "SourceCache"("kind");

-- CreateIndex
CREATE INDEX "SourceCache_expiresAt_idx" ON "SourceCache"("expiresAt");

-- CreateIndex
CREATE INDEX "EmailDiscovery_accountId_idx" ON "EmailDiscovery"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDiscovery_accountId_personKey_domain_key" ON "EmailDiscovery"("accountId", "personKey", "domain");

-- AddForeignKey
ALTER TABLE "EmailDiscovery" ADD CONSTRAINT "EmailDiscovery_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
