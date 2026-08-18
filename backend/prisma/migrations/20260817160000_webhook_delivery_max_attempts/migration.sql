-- Default is what existing rows get. New rows are given the number the sender
-- actually uses, so the schema default is a migration detail and not a second
-- place the retry policy lives
ALTER TABLE "webhook_delivery" ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 7;
