/*
  Warnings:

  - You are about to drop the column `dscr` on the `debt_services` table. All the data in the column will be lost.
  - You are about to drop the column `net_operating_income` on the `debt_services` table. All the data in the column will be lost.
  - You are about to drop the column `total_debt_service` on the `debt_services` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "debt_services" DROP COLUMN "dscr",
DROP COLUMN "net_operating_income",
DROP COLUMN "total_debt_service",
ADD COLUMN     "transaction_count" INTEGER NOT NULL DEFAULT 0;
