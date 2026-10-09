import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { db } from "@/lib/db";

// Captura con el teléfono: el PC muestra un QR con un enlace de un solo uso
// (/captura/<token>) que deja subir UNA factura al espacio de quien lo generó, sin iniciar sesión.
// Solo guardamos el hash del token; el enlace caduca a los 10 minutos.

export const CAPTURE_MINUTES = 10;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createCaptureSession(userId: string, workspaceId: string) {
  const token = randomBytes(32).toString("base64url");
  const session = await db.captureSession.create({
    data: {
      userId,
      workspaceId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + CAPTURE_MINUTES * 60 * 1000),
    },
  });
  return { session, token };
}

// Sesión aún usable desde el teléfono (esperando la foto y sin caducar), o null.
export async function findWaitingSession(token: string) {
  if (!/^[\w-]{20,100}$/.test(token)) return null;
  const session = await db.captureSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { workspace: { select: { name: true } } },
  });
  if (!session || session.status !== "WAITING") return null;
  if (session.expiresAt < new Date()) {
    await db.captureSession.update({ where: { id: session.id }, data: { status: "EXPIRED" } });
    return null;
  }
  return session;
}
