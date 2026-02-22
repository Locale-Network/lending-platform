-- CreateTable
CREATE TABLE "webhook_dedup" (
    "key" VARCHAR(500) NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_dedup_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "rate_limit_entries" (
    "key" VARCHAR(500) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "window_start" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_entries_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "webhook_dedup_expires_at_idx" ON "webhook_dedup"("expires_at");

-- CreateIndex
CREATE INDEX "rate_limit_entries_expires_at_idx" ON "rate_limit_entries"("expires_at");
