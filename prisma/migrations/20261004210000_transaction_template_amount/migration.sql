-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "template_amount_cents" BIGINT;


-- Movimientos ya vinculados a un gasto fijo: tomamos su monto habitual actual.
UPDATE "transactions" t SET "template_amount_cents" = tt."amount_cents" FROM "transaction_templates" tt WHERE t."template_id" = tt."id" AND t."template_amount_cents" IS NULL;
