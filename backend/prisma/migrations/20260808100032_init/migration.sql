-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMING', 'PAID', 'UNDERPAID', 'EXPIRED', 'REVERSED', 'FAILED');

-- CreateEnum
CREATE TYPE "KeyMode" AS ENUM ('TEST', 'LIVE');

-- CreateEnum
CREATE TYPE "EntryDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateTable
CREATE TABLE "merchant" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "settlementCurrency" VARCHAR(10) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "apiKeyId" UUID,
    "mode" "KeyMode" NOT NULL,
    "fiatAmount" DECIMAL(38,0) NOT NULL,
    "fiatCurrency" VARCHAR(10) NOT NULL,
    "cryptoAmount" DECIMAL(38,0) NOT NULL,
    "cryptoCurrency" VARCHAR(10) NOT NULL,
    "quotedRate" DECIMAL(38,18) NOT NULL,
    "address" TEXT NOT NULL,
    "derivationIndex" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chain_tx" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "txid" TEXT NOT NULL,
    "blockHash" TEXT,
    "amount" DECIMAL(38,0) NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "seenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "chain_tx_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "mode" "KeyMode" NOT NULL,
    "balance" DECIMAL(38,0) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entry" (
    "id" UUID NOT NULL,
    "transferId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "direction" "EntryDirection" NOT NULL,
    "amount" DECIMAL(38,0) NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "paymentId" UUID,
    "reversesId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "keyHash" CHAR(64) NOT NULL,
    "keyPrefix" VARCHAR(24) NOT NULL,
    "mode" "KeyMode" NOT NULL,
    "name" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_key" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "idempotency_key_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "merchant_email_key" ON "merchant"("email");

-- CreateIndex
CREATE INDEX "payment_status_expiresAt_idx" ON "payment"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "payment_merchantId_mode_createdAt_idx" ON "payment"("merchantId", "mode", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_address_key" ON "payment"("address");

-- CreateIndex
CREATE INDEX "chain_tx_paymentId_idx" ON "chain_tx"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "chain_tx_txid_paymentId_key" ON "chain_tx"("txid", "paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "account_merchantId_currency_mode_key" ON "account"("merchantId", "currency", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entry_reversesId_key" ON "ledger_entry"("reversesId");

-- CreateIndex
CREATE INDEX "ledger_entry_accountId_createdAt_idx" ON "ledger_entry"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "ledger_entry_transferId_idx" ON "ledger_entry"("transferId");

-- CreateIndex
CREATE INDEX "ledger_entry_paymentId_idx" ON "ledger_entry"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "api_key_keyHash_key" ON "api_key"("keyHash");

-- CreateIndex
CREATE INDEX "api_key_merchantId_mode_idx" ON "api_key"("merchantId", "mode");

-- CreateIndex
CREATE INDEX "idempotency_key_expiresAt_idx" ON "idempotency_key"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_key_merchantId_key_key" ON "idempotency_key"("merchantId", "key");

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_key"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chain_tx" ADD CONSTRAINT "chain_tx_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "ledger_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_key" ADD CONSTRAINT "idempotency_key_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
