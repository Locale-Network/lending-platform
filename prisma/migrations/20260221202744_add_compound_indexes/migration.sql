-- CreateIndex
CREATE INDEX "payment_records_loan_application_id_status_idx" ON "payment_records"("loan_application_id", "status");

-- CreateIndex
CREATE INDEX "yield_distributions_source_block_number_loan_application_id_idx" ON "yield_distributions"("source_block_number", "loan_application_id");
