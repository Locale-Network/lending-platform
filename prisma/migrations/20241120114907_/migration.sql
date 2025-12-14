/*
  Warnings:

  - A unique constraint covering the columns `[item_id]` on the table `plaid_item_access_tokens` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "plaid_item_access_tokens_item_id_key" ON "plaid_item_access_tokens"("item_id");
