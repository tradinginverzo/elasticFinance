// Crea (o actualiza) el bucket privado de Supabase Storage para las facturas.
// Uso: npm run setup:storage
// Es idempotente: se puede ejecutar varias veces sin problema.
import { createClient } from "@supabase/supabase-js";

const BUCKET = "receipts";
const options = {
  public: false, // solo el servidor accede; al navegador se le dan URLs firmadas temporales
  fileSizeLimit: 10 * 1024 * 1024, // 10 MB
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "application/pdf",
  ],
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: existing } = await supabase.storage.getBucket(BUCKET);

const { error } = existing
  ? await supabase.storage.updateBucket(BUCKET, options)
  : await supabase.storage.createBucket(BUCKET, options);

if (error) {
  console.error(`Error configurando el bucket "${BUCKET}":`, error.message);
  process.exit(1);
}

console.log(`Bucket "${BUCKET}" ${existing ? "actualizado" : "creado"} (privado).`);
