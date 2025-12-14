/*
  Warnings:

  - The primary key for the `proofs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `address` on the `proofs` table. All the data in the column will be lost.
  - Added the required column `chain_account_address` to the `proofs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "proofs" DROP CONSTRAINT "proofs_pkey",
DROP COLUMN "address",
ADD COLUMN     "chain_account_address" VARCHAR(255) NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE VARCHAR(255),
ADD CONSTRAINT "proofs_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "proofs_id_seq";

-- AddForeignKey
ALTER TABLE "proofs" ADD CONSTRAINT "proofs_chain_account_address_fkey" FOREIGN KEY ("chain_account_address") REFERENCES "chain_accounts"("address") ON DELETE CASCADE ON UPDATE CASCADE;
