-- Lets the chain watcher rotate instead of reading the same oldest rows every
-- sweep. Null means never checked, and null sorts first under NULLS FIRST, so a
-- payment created a moment ago is looked at before anything already seen.
-- AlterTable
ALTER TABLE "payment" ADD COLUMN "lastCheckedAt" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "payment_mode_lastCheckedAt_idx" ON "payment"("mode", "lastCheckedAt");

-- The plain unique let a disabled endpoint keep holding its url, so a merchant
-- moving a webhook to a staging address and back was refused with a 409 by a
-- row that is no longer delivering anything. Postgres only enforces a partial
-- index over the rows matching its WHERE, so a disabled endpoint stops
-- competing for the name the moment it is disabled.
-- DropIndex
DROP INDEX "webhook_endpoint_merchantId_mode_url_key";

-- CreateIndex
CREATE UNIQUE INDEX "webhook_endpoint_active_url_key"
  ON "webhook_endpoint"("merchantId", "mode", "url")
  WHERE "disabledAt" IS NULL;
