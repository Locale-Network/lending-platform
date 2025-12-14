/*
  Warnings:

  - You are about to drop the column `chain_account_address` on the `credit_scores` table. All the data in the column will be lost.
  - You are about to drop the column `chain_account_address` on the `kyc_verifications` table. All the data in the column will be lost.
  - You are about to drop the column `chain_account_address` on the `loan_applications` table. All the data in the column will be lost.
  - You are about to drop the column `chain_account_address` on the `outstanding_loans` table. All the data in the column will be lost.
  - You are about to drop the column `chain_account_address` on the `plaid_item_access_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `chain_account_address` on the `proofs` table. All the data in the column will be lost.
  - You are about to drop the `accounts` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[account_address]` on the table `kyc_verifications` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `account_address` to the `credit_scores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `account_address` to the `kyc_verifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `account_address` to the `loan_applications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `account_address` to the `outstanding_loans` table without a default value. This is not possible if the table is not empty.
  - Added the required column `account_address` to the `plaid_item_access_tokens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `account_address` to the `proofs` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "credit_scores" DROP CONSTRAINT "credit_scores_chain_account_address_fkey";

-- DropForeignKey
ALTER TABLE "kyc_verifications" DROP CONSTRAINT "kyc_verifications_chain_account_address_fkey";

-- DropForeignKey
ALTER TABLE "loan_applications" DROP CONSTRAINT "loan_applications_chain_account_address_fkey";

-- DropForeignKey
ALTER TABLE "outstanding_loans" DROP CONSTRAINT "outstanding_loans_chain_account_address_fkey";

-- DropForeignKey
ALTER TABLE "plaid_item_access_tokens" DROP CONSTRAINT "plaid_item_access_tokens_chain_account_address_fkey";

-- DropForeignKey
ALTER TABLE "proofs" DROP CONSTRAINT "proofs_chain_account_address_fkey";

-- DropIndex
DROP INDEX "credit_scores_chain_account_address_idx";

-- DropIndex
DROP INDEX "kyc_verifications_chain_account_address_idx";

-- DropIndex
DROP INDEX "kyc_verifications_chain_account_address_key";

-- DropIndex
DROP INDEX "loan_applications_chain_account_address_idx";

-- DropIndex
DROP INDEX "outstanding_loans_chain_account_address_idx";

-- DropIndex
DROP INDEX "plaid_item_access_tokens_chain_account_address_idx";

-- AlterTable
ALTER TABLE "credit_scores" DROP COLUMN "chain_account_address",
ADD COLUMN     "account_address" VARCHAR(255) NOT NULL;

-- AlterTable
ALTER TABLE "kyc_verifications" DROP COLUMN "chain_account_address",
ADD COLUMN     "account_address" VARCHAR(255) NOT NULL;

-- AlterTable
ALTER TABLE "loan_applications" DROP COLUMN "chain_account_address",
ADD COLUMN     "account_address" VARCHAR(255) NOT NULL;

-- AlterTable
ALTER TABLE "outstanding_loans" DROP COLUMN "chain_account_address",
ADD COLUMN     "account_address" VARCHAR(255) NOT NULL;

-- AlterTable
ALTER TABLE "plaid_item_access_tokens" DROP COLUMN "chain_account_address",
ADD COLUMN     "account_address" VARCHAR(255) NOT NULL;

-- AlterTable
ALTER TABLE "proofs" DROP COLUMN "chain_account_address",
ADD COLUMN     "account_address" VARCHAR(255) NOT NULL;

-- DropTable
DROP TABLE "accounts";

-- CreateIndex
CREATE INDEX "credit_scores_account_address_idx" ON "credit_scores"("account_address");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_verifications_account_address_key" ON "kyc_verifications"("account_address");

-- CreateIndex
CREATE INDEX "kyc_verifications_account_address_idx" ON "kyc_verifications"("account_address");

-- CreateIndex
CREATE INDEX "loan_applications_account_address_idx" ON "loan_applications"("account_address");

-- CreateIndex
CREATE INDEX "outstanding_loans_account_address_idx" ON "outstanding_loans"("account_address");

-- CreateIndex
CREATE INDEX "plaid_item_access_tokens_account_address_idx" ON "plaid_item_access_tokens"("account_address");

-- AddForeignKey
ALTER TABLE "proofs" ADD CONSTRAINT "proofs_account_address_fkey" FOREIGN KEY ("account_address") REFERENCES "chain_accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_account_address_fkey" FOREIGN KEY ("account_address") REFERENCES "chain_accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plaid_item_access_tokens" ADD CONSTRAINT "plaid_item_access_tokens_account_address_fkey" FOREIGN KEY ("account_address") REFERENCES "chain_accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_account_address_fkey" FOREIGN KEY ("account_address") REFERENCES "chain_accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outstanding_loans" ADD CONSTRAINT "outstanding_loans_account_address_fkey" FOREIGN KEY ("account_address") REFERENCES "chain_accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_scores" ADD CONSTRAINT "credit_scores_account_address_fkey" FOREIGN KEY ("account_address") REFERENCES "chain_accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;
