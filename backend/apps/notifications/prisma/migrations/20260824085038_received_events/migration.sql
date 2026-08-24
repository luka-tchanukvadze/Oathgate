-- CreateTable
CREATE TABLE "received_event" (
    "id" UUID NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "merchantId" UUID NOT NULL,
    "mode" VARCHAR(10) NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),

    CONSTRAINT "received_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "received_event_merchantId_receivedAt_idx" ON "received_event"("merchantId", "receivedAt");

-- CreateIndex
CREATE INDEX "received_event_processedAt_idx" ON "received_event"("processedAt");
