/*
  Warnings:

  - You are about to drop the `chain_accounts` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "credit_scores" DROP CONSTRAINT "credit_scores_account_address_fkey";

-- DropForeignKey
ALTER TABLE "kyc_verifications" DROP CONSTRAINT "kyc_verifications_account_address_fkey";

-- DropForeignKey
ALTER TABLE "loan_applications" DROP CONSTRAINT "loan_applications_account_address_fkey";

-- DropForeignKey
ALTER TABLE "outstanding_loans" DROP CONSTRAINT "outstanding_loans_account_address_fkey";

-- DropForeignKey
ALTER TABLE "plaid_item_access_tokens" DROP CONSTRAINT "plaid_item_access_tokens_account_address_fkey";

-- DropForeignKey
ALTER TABLE "proofs" DROP CONSTRAINT "proofs_account_address_fkey";

-- DropTable
DROP TABLE "chain_accounts";

-- CreateTable
CREATE TABLE "accounts" (
    "address" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'BORROWER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("address")
);

-- AddForeignKey
ALTER TABLE "proofs" ADD CONSTRAINT "proofs_account_address_fkey" FOREIGN KEY ("account_address") REFERENCES "accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_account_address_fkey" FOREIGN KEY ("account_address") REFERENCES "accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plaid_item_access_tokens" ADD CONSTRAINT "plaid_item_access_tokens_account_address_fkey" FOREIGN KEY ("account_address") REFERENCES "accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_account_address_fkey" FOREIGN KEY ("account_address") REFERENCES "accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outstanding_loans" ADD CONSTRAINT "outstanding_loans_account_address_fkey" FOREIGN KEY ("account_address") REFERENCES "accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_scores" ADD CONSTRAINT "credit_scores_account_address_fkey" FOREIGN KEY ("account_address") REFERENCES "accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;
