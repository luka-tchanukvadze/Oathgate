-- The rate cache lived only in memory, so every restart began with nothing to
-- fall back on. A deploy followed by one slow upstream request was a 503 and
-- nothing could be quoted, which is the one moment the stale window exists for.
-- CreateTable
CREATE TABLE "exchange_rate" (
    "pair" VARCHAR(24) NOT NULL,
    "rate" DECIMAL(38,18) NOT NULL,
    "fetchedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "exchange_rate_pkey" PRIMARY KEY ("pair")
);
