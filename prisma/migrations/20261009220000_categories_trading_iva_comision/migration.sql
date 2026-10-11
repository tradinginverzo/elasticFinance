-- Categorías nuevas "Trading" (gasto e ingreso), "IVA" y "Comisión" (gasto) para los espacios
-- que ya existen. Los espacios nuevos las reciben de src/lib/default-categories.json.
-- Si un espacio ya tiene una con el mismo nombre y tipo, no se duplica.
-- El color se asigna solo (getCategories da uno libre a las que no tienen).
INSERT INTO "categories" ("id", "workspace_id", "name", "type", "icon")
SELECT gen_random_uuid(), w."id", v."name", v."type"::"TransactionType", v."icon"
FROM "workspaces" w
CROSS JOIN (VALUES
  ('Trading', 'EXPENSE', 'candlestick-chart'),
  ('Trading', 'INCOME', 'candlestick-chart'),
  ('IVA', 'EXPENSE', 'receipt'),
  ('Comisión', 'EXPENSE', 'percent')
) AS v("name", "type", "icon")
WHERE EXISTS (SELECT 1 FROM "categories" c WHERE c."workspace_id" = w."id")
ON CONFLICT ("workspace_id", "name", "type") DO NOTHING;
