-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN     "target_pool_id" TEXT;

-- CreateIndex
CREATE INDEX "loan_applications_status_idx" ON "loan_applications"("status");

-- CreateIndex
CREATE INDEX "loan_applications_created_at_idx" ON "loan_applications"("created_at");

-- CreateIndex
CREATE INDEX "loan_applications_status_created_at_idx" ON "loan_applications"("status", "created_at");

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_target_pool_id_fkey" FOREIGN KEY ("target_pool_id") REFERENCES "loan_pools"("id") ON DELETE SET NULL ON UPDATE CASCADE;
