-- Staking Events Table
-- Stores indexed events from the StakingPool contract for historical queries
-- This table is populated by the event indexer, not by API writes

CREATE TABLE IF NOT EXISTS "staking_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_type" TEXT NOT NULL,
  "pool_id" TEXT NOT NULL,
  "user_address" TEXT NOT NULL,
  "amount" TEXT NOT NULL,
  "shares" TEXT,
  "fee" TEXT,
  "unlock_time" TIMESTAMPTZ,
  "transaction_hash" TEXT NOT NULL UNIQUE,
  "block_number" BIGINT NOT NULL,
  "block_timestamp" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT "staking_events_type_check" CHECK (
    "event_type" IN ('STAKED', 'UNSTAKE_REQUESTED', 'UNSTAKED', 'UNSTAKE_CANCELLED')
  )
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS "idx_staking_events_user" ON "staking_events"("user_address");
CREATE INDEX IF NOT EXISTS "idx_staking_events_pool" ON "staking_events"("pool_id");
CREATE INDEX IF NOT EXISTS "idx_staking_events_type" ON "staking_events"("event_type");
CREATE INDEX IF NOT EXISTS "idx_staking_events_block" ON "staking_events"("block_number" DESC);

-- Indexer State Table
-- Tracks the last indexed block for each contract
CREATE TABLE IF NOT EXISTS "indexer_state" (
  "contract" TEXT PRIMARY KEY,
  "last_indexed_block" BIGINT NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Add contractPoolId to loan_pools table if not exists
ALTER TABLE "loan_pools" ADD COLUMN IF NOT EXISTS "contract_pool_id" TEXT;

-- Comments
COMMENT ON TABLE "staking_events" IS 'Indexed events from StakingPool contract for historical queries. Source of truth is on-chain.';
COMMENT ON TABLE "indexer_state" IS 'Tracks indexer progress per contract';
