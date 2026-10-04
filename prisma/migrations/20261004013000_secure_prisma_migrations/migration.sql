-- La tabla interna de Prisma también vive en "public" y Supabase la expondría por su API REST.
-- Le activamos RLS (sin políticas) para que solo el rol postgres pueda verla.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;