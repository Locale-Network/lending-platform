/*
  Warnings:

  - You are about to drop the column `account_address` on the `credit_scores` table. All the data in the column will be lost.
  - You are about to drop the column `credit_bureau` on the `credit_scores` table. All the data in the column will be lost.
  - You are about to drop the column `score` on the `credit_scores` table. All the data in the column will be lost.
  - You are about to drop the column `score_range_max` on the `credit_scores` table. All the data in the column will be lost.
  - You are about to drop the column `score_range_min` on the `credit_scores` table. All the data in the column will be lost.
  - You are about to drop the column `score_type` on the `credit_scores` table. All the data in the column will be lost.
  - You are about to drop the column `account_address` on the `outstanding_loans` table. All the data in the column will be lost.
  - You are about to drop the `proofs` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[credit_score_proof_id]` on the table `credit_scores` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[debt_service_id]` on the table `loan_applications` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[plaid_item_access_token_id]` on the table `loan_applications` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[loan_application_id]` on the table `plaid_item_access_tokens` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `credit_score_equifax` to the `credit_scores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `credit_score_transunion` to the `credit_scores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `loan_application_id` to the `plaid_item_access_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "credit_scores" DROP CONSTRAINT "credit_scores_account_address_fkey";

-- DropForeignKey
ALTER TABLE "outstanding_loans" DROP CONSTRAINT "outstanding_loans_account_address_fkey";

-- DropForeignKey
ALTER TABLE "proofs" DROP CONSTRAINT "proofs_account_address_fkey";

-- DropIndex
DROP INDEX "credit_scores_account_address_idx";

-- DropIndex
DROP INDEX "outstanding_loans_account_address_idx";

-- DropIndex
DROP INDEX "plaid_item_access_tokens_account_address_idx";

-- AlterTable
ALTER TABLE "credit_scores" DROP COLUMN "account_address",
DROP COLUMN "credit_bureau",
DROP COLUMN "score",
DROP COLUMN "score_range_max",
DROP COLUMN "score_range_min",
DROP COLUMN "score_type",
ADD COLUMN     "credit_score_equifax" INTEGER NOT NULL,
ADD COLUMN     "credit_score_proof_id" TEXT,
ADD COLUMN     "credit_score_transunion" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN     "debt_service_id" TEXT,
ADD COLUMN     "plaid_item_access_token_id" TEXT;

-- AlterTable
ALTER TABLE "outstanding_loans" DROP COLUMN "account_address";

-- AlterTable
ALTER TABLE "plaid_item_access_tokens" ADD COLUMN     "loan_application_id" TEXT NOT NULL;

-- DropTable
DROP TABLE "proofs";

-- CreateTable
CREATE TABLE "debt_service_proofs" (
    "id" VARCHAR(255) NOT NULL,
    "debt_service_id" TEXT NOT NULL,
    "proof" JSONB NOT NULL,
    "context" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debt_service_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_score_proofs" (
    "id" VARCHAR(255) NOT NULL,
    "credit_score_id" TEXT NOT NULL,
    "proof" JSONB NOT NULL,
    "context" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_score_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_services" (
    "id" TEXT NOT NULL,
    "loan_application_id" TEXT NOT NULL,
    "net_operating_income" DOUBLE PRECISION NOT NULL,
    "total_debt_service" DOUBLE PRECISION NOT NULL,
    "dscr" DOUBLE PRECISION NOT NULL,
    "debt_service_proof_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debt_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "debt_service_proofs_debt_service_id_key" ON "debt_service_proofs"("debt_service_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_score_proofs_credit_score_id_key" ON "credit_score_proofs"("credit_score_id");

-- CreateIndex
CREATE UNIQUE INDEX "debt_services_loan_application_id_key" ON "debt_services"("loan_application_id");

-- CreateIndex
CREATE UNIQUE INDEX "debt_services_debt_service_proof_id_key" ON "debt_services"("debt_service_proof_id");

-- CreateIndex
CREATE INDEX "debt_services_loan_application_id_idx" ON "debt_services"("loan_application_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_scores_credit_score_proof_id_key" ON "credit_scores"("credit_score_proof_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_applications_debt_service_id_key" ON "loan_applications"("debt_service_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_applications_plaid_item_access_token_id_key" ON "loan_applications"("plaid_item_access_token_id");

-- CreateIndex
CREATE UNIQUE INDEX "plaid_item_access_tokens_loan_application_id_key" ON "plaid_item_access_tokens"("loan_application_id");

-- AddForeignKey
ALTER TABLE "debt_service_proofs" ADD CONSTRAINT "debt_service_proofs_debt_service_id_fkey" FOREIGN KEY ("debt_service_id") REFERENCES "debt_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_score_proofs" ADD CONSTRAINT "credit_score_proofs_credit_score_id_fkey" FOREIGN KEY ("credit_score_id") REFERENCES "credit_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plaid_item_access_tokens" ADD CONSTRAINT "plaid_item_access_tokens_loan_application_id_fkey" FOREIGN KEY ("loan_application_id") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_services" ADD CONSTRAINT "debt_services_loan_application_id_fkey" FOREIGN KEY ("loan_application_id") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
