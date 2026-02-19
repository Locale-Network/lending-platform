-- CreateEnum
CREATE TYPE "JurisdictionType" AS ENUM ('US_PERSON', 'NON_US_PERSON');

-- AlterEnum
ALTER TYPE "ExemptionType" ADD VALUE 'REG_S';

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "jurisdiction_certified_at" TIMESTAMP(3),
ADD COLUMN     "jurisdiction_country" VARCHAR(2),
ADD COLUMN     "jurisdiction_state" VARCHAR(2),
ADD COLUMN     "jurisdiction_type" "JurisdictionType",
ADD COLUMN     "reg_s_certifications" JSONB;

-- CreateTable
CREATE TABLE "allowed_states" (
    "id" TEXT NOT NULL,
    "state_code" VARCHAR(2) NOT NULL,
    "state_name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allowed_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "allowed_states_state_code_key" ON "allowed_states"("state_code");

-- CreateIndex
CREATE INDEX "allowed_states_is_active_idx" ON "allowed_states"("is_active");

-- Seed Missouri as initial allowed state
INSERT INTO "allowed_states" ("id", "state_code", "state_name", "is_active", "created_at", "updated_at")
VALUES (gen_random_uuid()::text, 'MO', 'Missouri', true, NOW(), NOW());

-- Backfill existing certified users as US_PERSON
UPDATE "accounts"
SET "jurisdiction_type" = 'US_PERSON',
    "jurisdiction_certified_at" = "accreditation_certified_at"
WHERE "accreditation_certified_at" IS NOT NULL;
