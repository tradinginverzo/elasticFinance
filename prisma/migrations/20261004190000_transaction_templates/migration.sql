-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "template_id" UUID;

-- CreateTable
CREATE TABLE "transaction_templates" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "account_id" UUID,
    "category_id" UUID,
    "merchant" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transaction_templates_workspace_id_idx" ON "transaction_templates"("workspace_id");

-- CreateIndex
CREATE INDEX "transactions_template_id_date_idx" ON "transactions"("template_id", "date");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "transaction_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_templates" ADD CONSTRAINT "transaction_templates_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_templates" ADD CONSTRAINT "transaction_templates_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_templates" ADD CONSTRAINT "transaction_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- RLS: solo el servidor (Prisma) accede a esta tabla.
ALTER TABLE "transaction_templates" ENABLE ROW LEVEL SECURITY;
