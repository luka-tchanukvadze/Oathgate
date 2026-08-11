/*
  Warnings:

  - A unique constraint covering the columns `[merchantId,currency,mode,kind]` on the table `account` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `kind` to the `account` table without a default value. This is not possible if the table is not empty.
  - Added the required column `passwordHash` to the `merchant` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('MERCHANT_BALANCE', 'GATEWAY_WALLET', 'FEES');

-- DropIndex
DROP INDEX "account_merchantId_currency_mode_key";

-- AlterTable
ALTER TABLE "account" ADD COLUMN     "kind" "AccountKind" NOT NULL,
ALTER COLUMN "merchantId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "merchant" ADD COLUMN     "passwordHash" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "payment" ADD COLUMN     "reference" VARCHAR(64);

-- CreateTable
CREATE TABLE "outbox_event" (
    "id" UUID NOT NULL,
    "aggregateType" VARCHAR(40) NOT NULL,
    "aggregateId" UUID NOT NULL,
    "eventType" VARCHAR(60) NOT NULL,
    "payload" JSONB NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_session" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_event_publishedAt_createdAt_idx" ON "outbox_event"("publishedAt", "createdAt");

-- CreateIndex
CREATE INDEX "outbox_event_aggregateType_aggregateId_idx" ON "outbox_event"("aggregateType", "aggregateId");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_session_tokenHash_key" ON "merchant_session"("tokenHash");

-- CreateIndex
CREATE INDEX "merchant_session_merchantId_idx" ON "merchant_session"("merchantId");

-- CreateIndex
CREATE INDEX "merchant_session_expiresAt_idx" ON "merchant_session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "account_merchantId_currency_mode_kind_key" ON "account"("merchantId", "currency", "mode", "kind");

-- CreateIndex
-- Hand-written, Prisma has no syntax for a partial index. The unique above does
-- not constrain the house rows at all, because Postgres treats NULLs as distinct
CREATE UNIQUE INDEX "account_house_unique" ON "account"("currency", "mode", "kind") WHERE "merchantId" IS NULL;

-- CreateIndex
CREATE INDEX "payment_merchantId_mode_reference_idx" ON "payment"("merchantId", "mode", "reference");

-- AddForeignKey
ALTER TABLE "merchant_session" ADD CONSTRAINT "merchant_session_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
