-- Nombre y apellido por separado (antes: un único display_name).
ALTER TABLE "profiles" ADD COLUMN "first_name" TEXT,
ADD COLUMN "last_name" TEXT;

-- Conservamos lo que hubiera en display_name como nombre.
UPDATE "profiles" SET "first_name" = "display_name" WHERE "display_name" IS NOT NULL;

ALTER TABLE "profiles" DROP COLUMN "display_name";