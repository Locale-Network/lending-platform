/*
  Warnings:

  - You are about to drop the column `risk_acknowledgment` on the `loan_applications` table. All the data in the column will be lost.
  - You are about to drop the column `terms_agreement` on the `loan_applications` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "LoanApplicationStatus" AS ENUM ('DRAFT', 'PENDING', 'ADDITIONAL_INFO_NEEDED', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "loan_applications" DROP COLUMN "risk_acknowledgment",
DROP COLUMN "terms_agreement",
ADD COLUMN     "status" "LoanApplicationStatus" NOT NULL DEFAULT 'DRAFT';
