-- CreateEnum
CREATE TYPE "KYCVerificationStatus" AS ENUM ('active', 'success', 'failed', 'expired', 'canceled', 'pending_review');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('INVESTOR', 'BORROWER', 'APPROVER', 'ADMIN');

-- CreateEnum
CREATE TYPE "LoanApplicationStatus" AS ENUM ('DRAFT', 'PENDING', 'SUBMITTED', 'ADDITIONAL_INFO_NEEDED', 'APPROVED', 'DISBURSED', 'ACTIVE', 'REPAID', 'REJECTED', 'DEFAULTED');

-- CreateEnum
CREATE TYPE "PoolStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PoolType" AS ENUM ('SMALL_BUSINESS', 'REAL_ESTATE', 'CONSUMER', 'MIXED');

-- CreateEnum
CREATE TYPE "ExemptionType" AS ENUM ('NONE', 'REG_D_506B', 'REG_D_506C', 'REG_A', 'REG_CF');

-- CreateEnum
CREATE TYPE "StakeStatus" AS ENUM ('ACTIVE', 'UNSTAKING', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "BorrowerType" AS ENUM ('SINGLE_BORROWER', 'MULTI_BORROWER', 'SYNDICATED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PPM', 'SUBSCRIPTION_AGREEMENT', 'OPERATING_AGREEMENT', 'USE_OF_FUNDS', 'RISK_DISCLOSURE', 'INVESTOR_QUESTIONNAIRE', 'ACCREDITATION_VERIFICATION', 'FINANCIAL_STATEMENTS', 'LEGAL_OPINION', 'OTHER');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('IPFS', 'ARWEAVE', 'S3');

-- CreateEnum
CREATE TYPE "DSCRCalculationStatus" AS ENUM ('SUBMITTED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RateChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailNotificationType" AS ENUM ('LOAN_APPROVED', 'LOAN_DISBURSED', 'LOAN_REJECTED', 'PAYMENT_DUE', 'PAYMENT_RECEIVED', 'STAKE_CONFIRMED', 'UNSTAKE_READY', 'SECURITY_ALERT', 'POOL_UPDATE', 'MARKETING');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "YieldDistributionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('CIRCLE', 'STRIPE', 'MANUAL');

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "transaction_id" VARCHAR(255),
    "account_id" VARCHAR(255),
    "amount" DOUBLE PRECISION,
    "currency" VARCHAR(255),
    "merchant" VARCHAR(255),
    "merchant_id" VARCHAR(255),
    "date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "loan_application_id" TEXT,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_verifications" (
    "identity_verification_id" VARCHAR(255) NOT NULL,
    "account_address" VARCHAR(255) NOT NULL,
    "status" "KYCVerificationStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "kyc_verifications_pkey" PRIMARY KEY ("identity_verification_id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "address" VARCHAR(255) NOT NULL,
    "eoa_address" VARCHAR(255),
    "privy_user_id" TEXT,
    "email" TEXT,
    "auth_provider" TEXT,
    "role" "Role" NOT NULL DEFAULT 'INVESTOR',
    "borrower_nft_token_id" TEXT,
    "investor_nft_token_id" TEXT,
    "accreditation_certified_at" TIMESTAMP(3),
    "accreditation_method" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "account_address" VARCHAR(255) NOT NULL,
    "email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "investment_updates" BOOLEAN NOT NULL DEFAULT true,
    "earnings_alerts" BOOLEAN NOT NULL DEFAULT true,
    "pool_updates" BOOLEAN NOT NULL DEFAULT false,
    "marketing_emails" BOOLEAN NOT NULL DEFAULT false,
    "security_alerts" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plaid_item_access_tokens" (
    "id" SERIAL NOT NULL,
    "access_token" VARCHAR(255) NOT NULL,
    "item_id" VARCHAR(255) NOT NULL,
    "account_address" VARCHAR(255) NOT NULL,
    "loan_application_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plaid_item_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_applications" (
    "id" TEXT NOT NULL,
    "account_address" VARCHAR(255) NOT NULL,
    "business_legal_name" VARCHAR(255) NOT NULL,
    "business_address" VARCHAR(255) NOT NULL,
    "business_state" VARCHAR(255) NOT NULL,
    "business_city" VARCHAR(255) NOT NULL,
    "business_zip_code" VARCHAR(255) NOT NULL,
    "ein" VARCHAR(255) NOT NULL,
    "business_founded_year" INTEGER NOT NULL,
    "business_legal_structure" VARCHAR(255) NOT NULL,
    "business_website" TEXT,
    "business_primary_industry" VARCHAR(255) NOT NULL,
    "business_description" VARCHAR(255) NOT NULL,
    "plaid_access_token" VARCHAR(255),
    "plaid_transactions_cursor" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "transaction_window_months" INTEGER DEFAULT 3,
    "has_outstanding_loans" BOOLEAN NOT NULL DEFAULT false,
    "lend_score" INTEGER,
    "lend_score_reason_codes" TEXT[],
    "lend_score_retrieved_at" TIMESTAMP(3),
    "loan_amount" BIGINT,
    "requested_amount" BIGINT,
    "funding_urgency" VARCHAR(50),
    "loan_purpose" VARCHAR(100),
    "estimated_credit_score" VARCHAR(20),
    "agreed_to_terms" BOOLEAN NOT NULL DEFAULT false,
    "agreed_to_terms_at" TIMESTAMP(3),
    "is_submitted" BOOLEAN NOT NULL DEFAULT false,
    "status" "LoanApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DOUBLE PRECISION DEFAULT 0,
    "revision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outstanding_loans" (
    "id" TEXT NOT NULL,
    "loan_application_id" TEXT NOT NULL,
    "lender_name" VARCHAR(255) NOT NULL,
    "loan_type" VARCHAR(255) NOT NULL,
    "outstanding_balance" DOUBLE PRECISION NOT NULL,
    "monthly_payment" DOUBLE PRECISION NOT NULL,
    "remaining_months" INTEGER NOT NULL,
    "annual_interest_rate" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outstanding_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_scores" (
    "id" TEXT NOT NULL,
    "loan_application_id" TEXT NOT NULL,
    "credit_score_equifax" INTEGER NOT NULL,
    "credit_score_transunion" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_services" (
    "id" TEXT NOT NULL,
    "loan_application_id" TEXT NOT NULL,
    "transaction_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debt_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notices" (
    "id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_pools" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "pool_type" "PoolType" NOT NULL,
    "status" "PoolStatus" NOT NULL DEFAULT 'DRAFT',
    "pool_size" DOUBLE PRECISION NOT NULL,
    "minimum_stake" DOUBLE PRECISION NOT NULL,
    "management_fee_rate" DOUBLE PRECISION NOT NULL,
    "performance_fee_rate" DOUBLE PRECISION NOT NULL,
    "base_interest_rate" DOUBLE PRECISION NOT NULL,
    "risk_premium_min" DOUBLE PRECISION NOT NULL,
    "risk_premium_max" DOUBLE PRECISION NOT NULL,
    "min_credit_score" INTEGER,
    "max_ltv" DOUBLE PRECISION,
    "allowed_industries" TEXT[],
    "contract_address" VARCHAR(255),
    "contract_pool_id" VARCHAR(66),
    "deploy_tx_hash" VARCHAR(66),
    "deployed_at_block" INTEGER,
    "is_on_chain" BOOLEAN NOT NULL DEFAULT false,
    "exemption_type" "ExemptionType",
    "eligibility_registry_address" VARCHAR(42),
    "max_non_accredited_investors" INTEGER DEFAULT 35,
    "cooldown_period_seconds" INTEGER,
    "maturity_date" TIMESTAMP(3),
    "borrower_type" "BorrowerType" NOT NULL DEFAULT 'MULTI_BORROWER',
    "composite_risk_score" DOUBLE PRECISION,
    "composite_risk_tier" TEXT,
    "weighted_avg_dscr" DOUBLE PRECISION,
    "weighted_avg_rate" DOUBLE PRECISION,
    "weighted_avg_lendscore" DOUBLE PRECISION,
    "diversification_score" DOUBLE PRECISION,
    "hhi_index" DOUBLE PRECISION,
    "composite_calculated_at" TIMESTAMP(3),
    "total_staked" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_investors" INTEGER NOT NULL DEFAULT 0,
    "available_liquidity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "annualized_return" DOUBLE PRECISION,
    "image_url" VARCHAR(500),
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_coming_soon" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pool_documents" (
    "id" TEXT NOT NULL,
    "pool_id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "document_type" "DocumentType" NOT NULL,
    "version" VARCHAR(20) NOT NULL DEFAULT '1.0',
    "storage_provider" "StorageProvider" NOT NULL,
    "storage_hash" VARCHAR(255) NOT NULL,
    "storage_url" VARCHAR(500) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    "checksum" VARCHAR(64),
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "effective_date" TIMESTAMP(3),
    "expiration_date" TIMESTAMP(3),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pool_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investor_stakes" (
    "id" TEXT NOT NULL,
    "pool_id" TEXT NOT NULL,
    "investor_address" VARCHAR(255) NOT NULL,
    "staked_amount" DOUBLE PRECISION NOT NULL,
    "shares" DOUBLE PRECISION NOT NULL,
    "status" "StakeStatus" NOT NULL DEFAULT 'ACTIVE',
    "earned_interest" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "claimed_interest" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "staked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unstaked_at" TIMESTAMP(3),

    CONSTRAINT "investor_stakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pool_loans" (
    "id" TEXT NOT NULL,
    "pool_id" TEXT NOT NULL,
    "loan_application_id" TEXT NOT NULL,
    "principal" DOUBLE PRECISION NOT NULL,
    "interest_rate" DOUBLE PRECISION NOT NULL,
    "term_months" INTEGER NOT NULL,
    "funded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected_return" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "pool_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dscr_calculation_logs" (
    "id" TEXT NOT NULL,
    "loan_application_id" TEXT NOT NULL,
    "transaction_count" INTEGER NOT NULL,
    "window_months" INTEGER NOT NULL,
    "status" "DSCRCalculationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "calculated_rate" DOUBLE PRECISION,
    "notice_index" INTEGER,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "dscr_calculation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_rate_changes" (
    "id" TEXT NOT NULL,
    "loan_application_id" TEXT NOT NULL,
    "current_rate" DOUBLE PRECISION NOT NULL,
    "proposed_rate" DOUBLE PRECISION NOT NULL,
    "rate_change_pct" DOUBLE PRECISION NOT NULL,
    "calculated_dscr" DOUBLE PRECISION,
    "status" "RateChangeStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by" VARCHAR(255),
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "tx_hash" VARCHAR(255),
    "executed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_rate_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_notifications" (
    "id" TEXT NOT NULL,
    "recipient_address" VARCHAR(255) NOT NULL,
    "recipient_email" VARCHAR(255) NOT NULL,
    "type" "EmailNotificationType" NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "body" TEXT NOT NULL,
    "template_data" TEXT,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "scheduled_for" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yield_distributions" (
    "id" TEXT NOT NULL,
    "pool_id" TEXT NOT NULL,
    "contract_pool_id" VARCHAR(66),
    "loan_application_id" TEXT,
    "principal_amount" BIGINT NOT NULL,
    "interest_amount" BIGINT NOT NULL,
    "total_amount" BIGINT NOT NULL,
    "source_block_number" INTEGER NOT NULL,
    "distribution_tx_hash" VARCHAR(66),
    "status" "YieldDistributionStatus" NOT NULL DEFAULT 'PENDING',
    "distributed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "yield_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pool_transfers" (
    "id" TEXT NOT NULL,
    "from_pool" VARCHAR(50) NOT NULL,
    "to_pool" VARCHAR(50) NOT NULL,
    "pool_id" TEXT,
    "amount" BIGINT NOT NULL,
    "transaction_hash" VARCHAR(66) NOT NULL,
    "block_number" INTEGER NOT NULL,
    "initiated_by" VARCHAR(255) NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'COMPLETED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pool_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indexer_state" (
    "id" TEXT NOT NULL DEFAULT 'yield_distribution',
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indexer_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zkfetch_proofs" (
    "id" TEXT NOT NULL,
    "loan_id" TEXT NOT NULL,
    "borrower_address" VARCHAR(255) NOT NULL,
    "proof_hash" VARCHAR(66) NOT NULL,
    "proof_identifier" VARCHAR(255) NOT NULL,
    "proof_data" JSONB NOT NULL,
    "provider" VARCHAR(50),
    "signatures_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMP(3),

    CONSTRAINT "zkfetch_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zkfetch_logs" (
    "id" TEXT NOT NULL,
    "loan_id" TEXT NOT NULL,
    "borrower_address" VARCHAR(255) NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "proof_hash" VARCHAR(66),
    "proof_identifier" VARCHAR(255),
    "success" BOOLEAN NOT NULL DEFAULT false,
    "duration_ms" INTEGER,
    "transaction_count" INTEGER,
    "dscr_value" DOUBLE PRECISION,
    "cartesi_input_hash" VARCHAR(66),
    "error_message" TEXT,
    "error_code" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zkfetch_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_records" (
    "id" TEXT NOT NULL,
    "external_payment_id" VARCHAR(255) NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
    "loan_application_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "confirmed_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "on_chain_tx_hash" VARCHAR(66),
    "on_chain_recorded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_customers" (
    "id" TEXT NOT NULL,
    "stripe_customer_id" VARCHAR(255) NOT NULL,
    "account_address" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stripe_customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transactions_loan_application_id_idx" ON "transactions"("loan_application_id");

-- CreateIndex
CREATE INDEX "transactions_date_idx" ON "transactions"("date");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_loan_application_id_transaction_id_key" ON "transactions"("loan_application_id", "transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_verifications_account_address_key" ON "kyc_verifications"("account_address");

-- CreateIndex
CREATE INDEX "kyc_verifications_account_address_idx" ON "kyc_verifications"("account_address");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_privy_user_id_key" ON "accounts"("privy_user_id");

-- CreateIndex
CREATE INDEX "accounts_email_idx" ON "accounts"("email");

-- CreateIndex
CREATE INDEX "accounts_role_idx" ON "accounts"("role");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_account_address_key" ON "notification_preferences"("account_address");

-- CreateIndex
CREATE INDEX "loan_applications_account_address_idx" ON "loan_applications"("account_address");

-- CreateIndex
CREATE INDEX "outstanding_loans_loan_application_id_idx" ON "outstanding_loans"("loan_application_id");

-- CreateIndex
CREATE INDEX "credit_scores_loan_application_id_idx" ON "credit_scores"("loan_application_id");

-- CreateIndex
CREATE INDEX "debt_services_loan_application_id_idx" ON "debt_services"("loan_application_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_pools_slug_key" ON "loan_pools"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "loan_pools_contract_pool_id_key" ON "loan_pools"("contract_pool_id");

-- CreateIndex
CREATE INDEX "loan_pools_slug_idx" ON "loan_pools"("slug");

-- CreateIndex
CREATE INDEX "loan_pools_status_idx" ON "loan_pools"("status");

-- CreateIndex
CREATE INDEX "loan_pools_pool_type_idx" ON "loan_pools"("pool_type");

-- CreateIndex
CREATE INDEX "pool_documents_pool_id_idx" ON "pool_documents"("pool_id");

-- CreateIndex
CREATE INDEX "pool_documents_document_type_idx" ON "pool_documents"("document_type");

-- CreateIndex
CREATE INDEX "pool_documents_storage_provider_idx" ON "pool_documents"("storage_provider");

-- CreateIndex
CREATE UNIQUE INDEX "pool_documents_pool_id_document_type_version_key" ON "pool_documents"("pool_id", "document_type", "version");

-- CreateIndex
CREATE INDEX "investor_stakes_investor_address_idx" ON "investor_stakes"("investor_address");

-- CreateIndex
CREATE INDEX "investor_stakes_pool_id_idx" ON "investor_stakes"("pool_id");

-- CreateIndex
CREATE UNIQUE INDEX "investor_stakes_pool_id_investor_address_key" ON "investor_stakes"("pool_id", "investor_address");

-- CreateIndex
CREATE INDEX "pool_loans_pool_id_idx" ON "pool_loans"("pool_id");

-- CreateIndex
CREATE INDEX "pool_loans_loan_application_id_idx" ON "pool_loans"("loan_application_id");

-- CreateIndex
CREATE UNIQUE INDEX "pool_loans_pool_id_loan_application_id_key" ON "pool_loans"("pool_id", "loan_application_id");

-- CreateIndex
CREATE INDEX "dscr_calculation_logs_loan_application_id_idx" ON "dscr_calculation_logs"("loan_application_id");

-- CreateIndex
CREATE INDEX "dscr_calculation_logs_status_idx" ON "dscr_calculation_logs"("status");

-- CreateIndex
CREATE INDEX "pending_rate_changes_loan_application_id_idx" ON "pending_rate_changes"("loan_application_id");

-- CreateIndex
CREATE INDEX "pending_rate_changes_status_idx" ON "pending_rate_changes"("status");

-- CreateIndex
CREATE INDEX "pending_rate_changes_created_at_idx" ON "pending_rate_changes"("created_at");

-- CreateIndex
CREATE INDEX "pending_rate_changes_approved_by_idx" ON "pending_rate_changes"("approved_by");

-- CreateIndex
CREATE INDEX "email_notifications_status_idx" ON "email_notifications"("status");

-- CreateIndex
CREATE INDEX "email_notifications_type_idx" ON "email_notifications"("type");

-- CreateIndex
CREATE INDEX "email_notifications_recipient_address_idx" ON "email_notifications"("recipient_address");

-- CreateIndex
CREATE INDEX "email_notifications_scheduled_for_idx" ON "email_notifications"("scheduled_for");

-- CreateIndex
CREATE INDEX "yield_distributions_pool_id_idx" ON "yield_distributions"("pool_id");

-- CreateIndex
CREATE INDEX "yield_distributions_loan_application_id_idx" ON "yield_distributions"("loan_application_id");

-- CreateIndex
CREATE INDEX "yield_distributions_distributed_at_idx" ON "yield_distributions"("distributed_at");

-- CreateIndex
CREATE INDEX "yield_distributions_status_idx" ON "yield_distributions"("status");

-- CreateIndex
CREATE INDEX "yield_distributions_source_block_number_idx" ON "yield_distributions"("source_block_number");

-- CreateIndex
CREATE INDEX "pool_transfers_from_pool_idx" ON "pool_transfers"("from_pool");

-- CreateIndex
CREATE INDEX "pool_transfers_to_pool_idx" ON "pool_transfers"("to_pool");

-- CreateIndex
CREATE INDEX "pool_transfers_pool_id_idx" ON "pool_transfers"("pool_id");

-- CreateIndex
CREATE INDEX "pool_transfers_created_at_idx" ON "pool_transfers"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "indexer_state_key_key" ON "indexer_state"("key");

-- CreateIndex
CREATE UNIQUE INDEX "zkfetch_proofs_proof_hash_key" ON "zkfetch_proofs"("proof_hash");

-- CreateIndex
CREATE INDEX "zkfetch_proofs_loan_id_idx" ON "zkfetch_proofs"("loan_id");

-- CreateIndex
CREATE INDEX "zkfetch_proofs_borrower_address_idx" ON "zkfetch_proofs"("borrower_address");

-- CreateIndex
CREATE INDEX "zkfetch_proofs_created_at_idx" ON "zkfetch_proofs"("created_at");

-- CreateIndex
CREATE INDEX "zkfetch_logs_loan_id_idx" ON "zkfetch_logs"("loan_id");

-- CreateIndex
CREATE INDEX "zkfetch_logs_borrower_address_idx" ON "zkfetch_logs"("borrower_address");

-- CreateIndex
CREATE INDEX "zkfetch_logs_action_idx" ON "zkfetch_logs"("action");

-- CreateIndex
CREATE INDEX "zkfetch_logs_success_idx" ON "zkfetch_logs"("success");

-- CreateIndex
CREATE INDEX "zkfetch_logs_created_at_idx" ON "zkfetch_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_records_external_payment_id_key" ON "payment_records"("external_payment_id");

-- CreateIndex
CREATE INDEX "payment_records_loan_application_id_idx" ON "payment_records"("loan_application_id");

-- CreateIndex
CREATE INDEX "payment_records_status_idx" ON "payment_records"("status");

-- CreateIndex
CREATE INDEX "payment_records_created_at_idx" ON "payment_records"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_customers_stripe_customer_id_key" ON "stripe_customers"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_customers_account_address_key" ON "stripe_customers"("account_address");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_loan_application_id_fkey" FOREIGN KEY ("loan_application_id") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_account_address_fkey" FOREIGN KEY ("account_address") REFERENCES "accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_account_address_fkey" FOREIGN KEY ("account_address") REFERENCES "accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plaid_item_access_tokens" ADD CONSTRAINT "plaid_item_access_tokens_account_address_fkey" FOREIGN KEY ("account_address") REFERENCES "accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plaid_item_access_tokens" ADD CONSTRAINT "plaid_item_access_tokens_loan_application_id_fkey" FOREIGN KEY ("loan_application_id") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_account_address_fkey" FOREIGN KEY ("account_address") REFERENCES "accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outstanding_loans" ADD CONSTRAINT "outstanding_loans_loan_application_id_fkey" FOREIGN KEY ("loan_application_id") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_scores" ADD CONSTRAINT "credit_scores_loan_application_id_fkey" FOREIGN KEY ("loan_application_id") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_services" ADD CONSTRAINT "debt_services_loan_application_id_fkey" FOREIGN KEY ("loan_application_id") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pool_documents" ADD CONSTRAINT "pool_documents_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "loan_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_stakes" ADD CONSTRAINT "investor_stakes_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "loan_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_stakes" ADD CONSTRAINT "investor_stakes_investor_address_fkey" FOREIGN KEY ("investor_address") REFERENCES "accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pool_loans" ADD CONSTRAINT "pool_loans_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "loan_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pool_loans" ADD CONSTRAINT "pool_loans_loan_application_id_fkey" FOREIGN KEY ("loan_application_id") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dscr_calculation_logs" ADD CONSTRAINT "dscr_calculation_logs_loan_application_id_fkey" FOREIGN KEY ("loan_application_id") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_rate_changes" ADD CONSTRAINT "pending_rate_changes_loan_application_id_fkey" FOREIGN KEY ("loan_application_id") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yield_distributions" ADD CONSTRAINT "yield_distributions_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "loan_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yield_distributions" ADD CONSTRAINT "yield_distributions_loan_application_id_fkey" FOREIGN KEY ("loan_application_id") REFERENCES "loan_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pool_transfers" ADD CONSTRAINT "pool_transfers_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "loan_pools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zkfetch_proofs" ADD CONSTRAINT "zkfetch_proofs_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zkfetch_logs" ADD CONSTRAINT "zkfetch_logs_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_loan_application_id_fkey" FOREIGN KEY ("loan_application_id") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_customers" ADD CONSTRAINT "stripe_customers_account_address_fkey" FOREIGN KEY ("account_address") REFERENCES "accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;
