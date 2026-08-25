-- AlterTable
ALTER TABLE "received_event" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastError" VARCHAR(500);
