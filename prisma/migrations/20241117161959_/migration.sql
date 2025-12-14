-- CreateTable
CREATE TABLE "plaid_item_access_tokens" (
    "id" SERIAL NOT NULL,
    "access_token" VARCHAR(255) NOT NULL,
    "item_id" VARCHAR(255) NOT NULL,
    "chain_account_address" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plaid_item_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plaid_item_access_tokens_chain_account_address_idx" ON "plaid_item_access_tokens"("chain_account_address");

-- AddForeignKey
ALTER TABLE "plaid_item_access_tokens" ADD CONSTRAINT "plaid_item_access_tokens_chain_account_address_fkey" FOREIGN KEY ("chain_account_address") REFERENCES "chain_accounts"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
