-- Categoría nueva "Inversión" (gasto: lo que se invierte; ingreso: rendimientos) para los espacios
-- que ya existen. No se duplica si ya hay una igual; el color se asigna solo.
INSERT INTO "categories" ("id", "workspace_id", "name", "type", "icon")
SELECT gen_random_uuid(), w."id", 'Inversión', v."type"::"TransactionType", 'trending-up'
FROM "workspaces" w
CROSS JOIN (VALUES ('EXPENSE'), ('INCOME')) AS v("type")
WHERE EXISTS (SELECT 1 FROM "categories" c WHERE c."workspace_id" = w."id")
ON CONFLICT ("workspace_id", "name", "type") DO NOTHING;
