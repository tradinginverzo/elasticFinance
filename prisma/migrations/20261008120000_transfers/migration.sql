-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'TRANSFER';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "to_account_id" UUID;

-- CreateIndex
CREATE INDEX "transactions_to_account_id_idx" ON "transactions"("to_account_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- (Se compara como texto: un valor nuevo de un enum no se puede usar en la misma transacción que lo crea.)
-- Una transferencia siempre tiene cuenta de destino, distinta de la de origen; los demás movimientos no tienen.
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transfer_accounts_check" CHECK (
  ("type"::text = 'TRANSFER' AND "to_account_id" IS NOT NULL AND "to_account_id" <> "account_id")
  OR ("type"::text <> 'TRANSFER' AND "to_account_id" IS NULL)
);
