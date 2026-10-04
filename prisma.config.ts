import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Por defecto usa la base de DESARROLLO (.env.local).
// Para producción: ENV_FILE=.env.prod (lo hacen los scripts `npm run db:deploy:prod`).
config({ path: process.env.ENV_FILE ?? ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Las migraciones usan la conexión directa (session pooler, puerto 5432).
    // La app usa DATABASE_URL (transaction pooler, puerto 6543) en src/lib/db.ts.
    url: process.env["DIRECT_URL"],
  },
});
