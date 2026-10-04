// Aplica a PRODUCCIÓN (proyecto Supabase "elastic-finance") las migraciones ya probadas
// en desarrollo, y crea/actualiza el bucket de facturas.
// Uso: npm run db:deploy:prod   (lee las claves de .env.prod)
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const ENV_FILE = ".env.prod";

if (!existsSync(ENV_FILE)) {
  console.error(`Falta ${ENV_FILE} con las claves de producción.`);
  process.exit(1);
}

const run = (command) =>
  execSync(command, {
    stdio: "inherit",
    env: { ...process.env, ENV_FILE },
  });

console.log("→ Migraciones en PRODUCCIÓN");
run("npx prisma migrate deploy");

console.log("→ Bucket de facturas en PRODUCCIÓN");
run(`node --env-file=${ENV_FILE} scripts/setup-storage.mjs`);
