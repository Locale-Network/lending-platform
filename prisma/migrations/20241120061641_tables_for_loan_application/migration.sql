-- DropForeignKey
ALTER TABLE "kyc_verifications" DROP CONSTRAINT "kyc_verifications_chain_account_address_fkey";

-- DropForeignKey
ALTER TABLE "plaid_item_access_tokens" DROP CONSTRAINT "plaid_item_access_tokens_chain_account_address_fkey";

-- CreateTable
CREATE TABLE "loan_applications" (
    "id" TEXT NOT NULL,
    "chain_account_address" VARCHAR(255) NOT NULL,
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
    "credit_score_id" TEXT,
    "has_outstanding_loans" BOOLEAN NOT NULL DEFAULT false,
    "terms_agreement" BOOLEAN NOT NULL DEFAULT false,
    "risk_acknowledgment" BOOLEAN NOT NULL DEFAULT false,
    "is_submitted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outstanding_loans" (
    "id" TEXT NOT NULL,
    "loan_application_id" TEXT NOT NULL,
    "chain_account_address" VARCHAR(255) NOT NULL,
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
    "chain_account_address" VARCHAR(255) NOT NULL,
    "loan_application_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "score_range_min" INTEGER NOT NULL,
    "score_range_max" INTEGER NOT NULL,
    "score_type" VARCHAR(255) NOT NULL,
    "credit_bureau" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loan_applications_credit_score_id_key" ON "loan_applications"("credit_score_id");

-- CreateIndex
CREATE INDEX "loan_applications_chain_account_address_idx" ON "loan_applications"("chain_account_address");

-- CreateIndex
CREATE INDEX "outstanding_loans_chain_account_address_idx" ON "outstanding_loans"("chain_account_address");

-- CreateIndex
CREATE INDEX "outstanding_loans_loan_application_id_idx" ON "outstanding_loans"("loan_application_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_scores_loan_application_id_key" ON "credit_scores"("loan_application_id");

-- CreateIndex
CREATE INDEX "credit_scores_chain_account_address_idx" ON "credit_scores"("chain_account_address");

-- CreateIndex
CREATE INDEX "credit_scores_loan_application_id_idx" ON "credit_scores"("loan_application_id");

-- AddForeignKey
ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_chain_account_address_fkey" FOREIGN KEY ("chain_account_address") REFERENCES "chain_accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plaid_item_access_tokens" ADD CONSTRAINT "plaid_item_access_tokens_chain_account_address_fkey" FOREIGN KEY ("chain_account_address") REFERENCES "chain_accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_chain_account_address_fkey" FOREIGN KEY ("chain_account_address") REFERENCES "chain_accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outstanding_loans" ADD CONSTRAINT "outstanding_loans_loan_application_id_fkey" FOREIGN KEY ("loan_application_id") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outstanding_loans" ADD CONSTRAINT "outstanding_loans_chain_account_address_fkey" FOREIGN KEY ("chain_account_address") REFERENCES "chain_accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_scores" ADD CONSTRAINT "credit_scores_chain_account_address_fkey" FOREIGN KEY ("chain_account_address") REFERENCES "chain_accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_scores" ADD CONSTRAINT "credit_scores_loan_application_id_fkey" FOREIGN KEY ("loan_application_id") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
