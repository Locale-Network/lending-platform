-- CreateEnum for transaction types
CREATE TYPE "TransactionType" AS ENUM ('STAKE', 'UNSTAKE', 'CLAIM_REWARDS', 'POOL_DEPOSIT', 'POOL_WITHDRAWAL');

-- CreateEnum for transaction status
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable for stake transactions
CREATE TABLE "stake_transactions" (
    "id" TEXT NOT NULL,
    "investor_address" VARCHAR(255) NOT NULL,
    "pool_id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "shares" DOUBLE PRECISION,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "transaction_hash" VARCHAR(255),
    "blockchain_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "stake_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stake_transactions_investor_address_idx" ON "stake_transactions"("investor_address");
CREATE INDEX "stake_transactions_pool_id_idx" ON "stake_transactions"("pool_id");
CREATE INDEX "stake_transactions_type_idx" ON "stake_transactions"("type");
CREATE INDEX "stake_transactions_status_idx" ON "stake_transactions"("status");
CREATE INDEX "stake_transactions_created_at_idx" ON "stake_transactions"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "stake_transactions" ADD CONSTRAINT "stake_transactions_investor_address_fkey" FOREIGN KEY ("investor_address") REFERENCES "accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stake_transactions" ADD CONSTRAINT "stake_transactions_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "loan_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Function to increment pool statistics when staking
CREATE OR REPLACE FUNCTION increment_pool_stats(
    p_pool_id TEXT,
    p_amount DOUBLE PRECISION
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE loan_pools
    SET
        total_staked = total_staked + p_amount,
        available_liquidity = available_liquidity + p_amount,
        updated_at = NOW()
    WHERE id = p_pool_id;

    -- Update investor count if this is a new investor
    UPDATE loan_pools
    SET
        total_investors = (
            SELECT COUNT(DISTINCT investor_address)
            FROM investor_stakes
            WHERE pool_id = p_pool_id AND status = 'ACTIVE'
        ),
        updated_at = NOW()
    WHERE id = p_pool_id;
END;
$$;

-- Function to decrement pool statistics when unstaking
CREATE OR REPLACE FUNCTION decrement_pool_stats(
    p_pool_id TEXT,
    p_amount DOUBLE PRECISION
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE loan_pools
    SET
        total_staked = GREATEST(total_staked - p_amount, 0),
        available_liquidity = GREATEST(available_liquidity - p_amount, 0),
        updated_at = NOW()
    WHERE id = p_pool_id;

    -- Update investor count
    UPDATE loan_pools
    SET
        total_investors = (
            SELECT COUNT(DISTINCT investor_address)
            FROM investor_stakes
            WHERE pool_id = p_pool_id AND status = 'ACTIVE'
        ),
        updated_at = NOW()
    WHERE id = p_pool_id;
END;
$$;

-- Function to calculate user's current rewards for a stake
CREATE OR REPLACE FUNCTION calculate_stake_rewards(
    p_stake_id TEXT
)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
AS $$
DECLARE
    v_rewards DOUBLE PRECISION;
    v_staked_amount DOUBLE PRECISION;
    v_apy DOUBLE PRECISION;
    v_days_staked INTEGER;
BEGIN
    SELECT
        s.staked_amount,
        COALESCE(p.annualized_return, 12.0),
        EXTRACT(DAY FROM (NOW() - s.staked_at))::INTEGER
    INTO v_staked_amount, v_apy, v_days_staked
    FROM investor_stakes s
    JOIN loan_pools p ON s.pool_id = p.id
    WHERE s.id = p_stake_id;

    -- Calculate simple interest: principal * (apy / 365 / 100) * days
    v_rewards := v_staked_amount * (v_apy / 365.0 / 100.0) * v_days_staked;

    RETURN ROUND(v_rewards::numeric, 2);
END;
$$;
