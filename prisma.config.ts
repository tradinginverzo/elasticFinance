import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local" });

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
