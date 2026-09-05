-- AlterTable
ALTER TABLE "merchant" ADD COLUMN     "expiresAt" TIMESTAMPTZ(3),
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "merchant_isDemo_expiresAt_idx" ON "merchant"("isDemo", "expiresAt");
