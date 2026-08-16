-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'DEAD_LETTER');

-- CreateTable
CREATE TABLE "webhook_endpoint" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "mode" "KeyMode" NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "secretCiphertext" TEXT NOT NULL,
    "secretPrefix" VARCHAR(24) NOT NULL,
    "events" TEXT[],
    "disabledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "webhook_endpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_delivery" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "endpointId" UUID NOT NULL,
    "outboxEventId" UUID NOT NULL,
    "mode" "KeyMode" NOT NULL,
    "eventType" VARCHAR(60) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3),
    "deliveredAt" TIMESTAMPTZ(3),
    "lastResponseStatus" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "webhook_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_attempt" (
    "id" UUID NOT NULL,
    "deliveryId" UUID NOT NULL,
    "attempt" INTEGER NOT NULL,
    "responseStatus" INTEGER,
    "error" VARCHAR(500),
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_endpoint_merchantId_mode_idx" ON "webhook_endpoint"("merchantId", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_endpoint_merchantId_mode_url_key" ON "webhook_endpoint"("merchantId", "mode", "url");

-- CreateIndex
CREATE INDEX "webhook_delivery_status_nextAttemptAt_idx" ON "webhook_delivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "webhook_delivery_merchantId_mode_createdAt_idx" ON "webhook_delivery"("merchantId", "mode", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_delivery_endpointId_outboxEventId_key" ON "webhook_delivery"("endpointId", "outboxEventId");

-- CreateIndex
CREATE INDEX "webhook_attempt_deliveryId_idx" ON "webhook_attempt"("deliveryId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_attempt_deliveryId_attempt_key" ON "webhook_attempt"("deliveryId", "attempt");

-- AddForeignKey
ALTER TABLE "webhook_endpoint" ADD CONSTRAINT "webhook_endpoint_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_delivery" ADD CONSTRAINT "webhook_delivery_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_delivery" ADD CONSTRAINT "webhook_delivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "webhook_endpoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_delivery" ADD CONSTRAINT "webhook_delivery_outboxEventId_fkey" FOREIGN KEY ("outboxEventId") REFERENCES "outbox_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_attempt" ADD CONSTRAINT "webhook_attempt_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "webhook_delivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
