-- Categoría nueva "Gym" (gasto) para los espacios que ya existen (los nuevos la reciben de
-- src/lib/default-categories.json). No se duplica si ya hay una igual; el color se asigna solo.
INSERT INTO "categories" ("id", "workspace_id", "name", "type", "icon")
SELECT gen_random_uuid(), w."id", 'Gym', 'EXPENSE'::"TransactionType", 'dumbbell'
FROM "workspaces" w
WHERE EXISTS (SELECT 1 FROM "categories" c WHERE c."workspace_id" = w."id")
ON CONFLICT ("workspace_id", "name", "type") DO NOTHING;
