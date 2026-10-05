import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

// En desarrollo Next recarga módulos en caliente; reutilizamos una sola instancia
// para no abrir una conexión nueva en cada recarga. Si cambia DATABASE_URL en .env.local,
// se crea una nueva (si no, seguiría usando la conexión con las credenciales viejas).
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaUrl?: string;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

const cached =
  globalForPrisma.prismaUrl === process.env.DATABASE_URL ? globalForPrisma.prisma : undefined;

export const db = cached ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  if (!cached) void globalForPrisma.prisma?.$disconnect();
  globalForPrisma.prisma = db;
  globalForPrisma.prismaUrl = process.env.DATABASE_URL;
}
