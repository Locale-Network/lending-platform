-- CreateEnum
CREATE TYPE "KYCVerificationStatus" AS ENUM ('active', 'success', 'failed', 'expired', 'canceled', 'pending_review');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('BORROWER', 'APPROVER', 'ADMIN');

-- CreateTable
CREATE TABLE "proofs" (
    "id" SERIAL NOT NULL,
    "address" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proof" JSONB NOT NULL,
    "context" JSONB NOT NULL,

    CONSTRAINT "proofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" SERIAL NOT NULL,
    "account_id" VARCHAR(255),
    "name" VARCHAR(255),
    "official_name" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

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

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_verifications" (
    "identity_verification_id" VARCHAR(255) NOT NULL,
    "chain_account_address" VARCHAR(255) NOT NULL,
    "status" "KYCVerificationStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "kyc_verifications_pkey" PRIMARY KEY ("identity_verification_id")
);

-- CreateTable
CREATE TABLE "chain_accounts" (
    "address" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'BORROWER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chain_accounts_pkey" PRIMARY KEY ("address")
);

-- CreateIndex
CREATE UNIQUE INDEX "kyc_verifications_chain_account_address_key" ON "kyc_verifications"("chain_account_address");

-- CreateIndex
CREATE INDEX "kyc_verifications_chain_account_address_idx" ON "kyc_verifications"("chain_account_address");

-- AddForeignKey
ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_chain_account_address_fkey" FOREIGN KEY ("chain_account_address") REFERENCES "chain_accounts"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
