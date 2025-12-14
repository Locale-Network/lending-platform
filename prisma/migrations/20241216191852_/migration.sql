/*
  Warnings:

  - You are about to drop the column `credit_score_id` on the `loan_applications` table. All the data in the column will be lost.
  - You are about to drop the column `debt_service_id` on the `loan_applications` table. All the data in the column will be lost.
  - You are about to drop the column `plaid_item_access_token_id` on the `loan_applications` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[credit_score_id]` on the table `credit_score_proofs` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[debt_service_id]` on the table `debt_service_proofs` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "loan_applications" DROP COLUMN "credit_score_id",
DROP COLUMN "debt_service_id",
DROP COLUMN "plaid_item_access_token_id";

-- CreateIndex
CREATE UNIQUE INDEX "credit_score_proofs_credit_score_id_key" ON "credit_score_proofs"("credit_score_id");

-- CreateIndex
CREATE UNIQUE INDEX "debt_service_proofs_debt_service_id_key" ON "debt_service_proofs"("debt_service_id");
