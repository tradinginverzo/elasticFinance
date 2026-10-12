-- AlterTable
ALTER TABLE "shopping_list_items" ADD COLUMN     "estimate_cents" BIGINT;

-- AlterTable
ALTER TABLE "shopping_lists" ADD COLUMN     "planned_date" DATE;
