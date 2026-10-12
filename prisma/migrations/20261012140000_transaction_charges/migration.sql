-- CreateEnum
CREATE TYPE "ChargeType" AS ENUM ('COMMISSION', 'TAX');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "charge_type" "ChargeType",
ADD COLUMN     "parent_id" UUID;

-- CreateIndex
CREATE INDEX "transactions_parent_id_idx" ON "transactions"("parent_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
