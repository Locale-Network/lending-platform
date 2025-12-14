/*
  Warnings:

  - You are about to drop the column `credit_score_proof_id` on the `credit_scores` table. All the data in the column will be lost.
  - You are about to drop the column `debt_service_proof_id` on the `debt_services` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "credit_score_proofs_credit_score_id_key";

-- DropIndex
DROP INDEX "credit_scores_credit_score_proof_id_key";

-- DropIndex
DROP INDEX "credit_scores_loan_application_id_key";

-- DropIndex
DROP INDEX "debt_service_proofs_debt_service_id_key";

-- DropIndex
DROP INDEX "debt_services_debt_service_proof_id_key";

-- DropIndex
DROP INDEX "debt_services_loan_application_id_key";

-- DropIndex
DROP INDEX "loan_applications_credit_score_id_key";

-- DropIndex
DROP INDEX "loan_applications_debt_service_id_key";

-- DropIndex
DROP INDEX "loan_applications_plaid_item_access_token_id_key";

-- DropIndex
DROP INDEX "plaid_item_access_tokens_item_id_key";

-- DropIndex
DROP INDEX "plaid_item_access_tokens_loan_application_id_key";

-- AlterTable
ALTER TABLE "credit_scores" DROP COLUMN "credit_score_proof_id";

-- AlterTable
ALTER TABLE "debt_services" DROP COLUMN "debt_service_proof_id";
