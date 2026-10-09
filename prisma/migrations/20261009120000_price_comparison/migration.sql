-- CreateEnum
CREATE TYPE "ProductUnit" AS ENUM ('ML', 'G', 'UNIT');

-- CreateEnum
CREATE TYPE "PriceSource" AS ENUM ('MANUAL', 'SHOPPING', 'RECEIPT');

-- AlterTable
ALTER TABLE "receipts" ADD COLUMN     "items_saved_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "stores" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "ProductUnit" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_aliases" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "product_id" UUID NOT NULL,

    CONSTRAINT "product_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_entries" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "brand" TEXT,
    "description" TEXT,
    "size_each" DOUBLE PRECISION NOT NULL,
    "pack_count" INTEGER NOT NULL DEFAULT 1,
    "price_cents" BIGINT NOT NULL,
    "regular_price_cents" BIGINT,
    "on_sale" BOOLEAN NOT NULL DEFAULT false,
    "source" "PriceSource" NOT NULL,
    "receipt_id" UUID,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_lists" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "store_id" UUID,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopping_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_list_items" (
    "id" UUID NOT NULL,
    "list_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "note" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price_entry_id" UUID,
    "checked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopping_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stores_workspace_id_name_key" ON "stores"("workspace_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "products_workspace_id_name_key" ON "products"("workspace_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "product_aliases_workspace_id_text_key" ON "product_aliases"("workspace_id", "text");

-- CreateIndex
CREATE INDEX "price_entries_product_id_date_idx" ON "price_entries"("product_id", "date" DESC);

-- CreateIndex
CREATE INDEX "price_entries_receipt_id_idx" ON "price_entries"("receipt_id");

-- CreateIndex
CREATE INDEX "shopping_lists_workspace_id_created_at_idx" ON "shopping_lists"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "shopping_list_items_price_entry_id_key" ON "shopping_list_items"("price_entry_id");

-- CreateIndex
CREATE INDEX "shopping_list_items_list_id_idx" ON "shopping_list_items"("list_id");

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_entries" ADD CONSTRAINT "price_entries_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_entries" ADD CONSTRAINT "price_entries_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_entries" ADD CONSTRAINT "price_entries_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_entries" ADD CONSTRAINT "price_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_entries" ADD CONSTRAINT "price_entries_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "shopping_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_price_entry_id_fkey" FOREIGN KEY ("price_entry_id") REFERENCES "price_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Como el resto de tablas: RLS activado y sin políticas (solo el servidor accede, vía Prisma).
ALTER TABLE "stores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_aliases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "price_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shopping_lists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shopping_list_items" ENABLE ROW LEVEL SECURITY;
