-- Added nullable, backfilled, then tightened. Adding a NOT NULL column outright
-- fails the moment the table already has a row in it, and settled payments have
-- been writing outbox rows since phase 1
ALTER TABLE "outbox_event" ADD COLUMN "merchantId" UUID;
ALTER TABLE "outbox_event" ADD COLUMN "mode" "KeyMode";

-- Every existing row was written by the settlement service, which has always
-- put both of these in the payload
UPDATE "outbox_event"
SET "merchantId" = ("payload"->>'merchantId')::UUID,
    "mode"       = ("payload"->>'mode')::"KeyMode"
WHERE "merchantId" IS NULL;

DELETE FROM "outbox_event" WHERE "merchantId" IS NULL OR "mode" IS NULL;

ALTER TABLE "outbox_event" ALTER COLUMN "merchantId" SET NOT NULL;
ALTER TABLE "outbox_event" ALTER COLUMN "mode" SET NOT NULL;
