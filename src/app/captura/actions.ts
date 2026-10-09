"use server";

import { findWaitingSession } from "@/lib/capture";
import { db } from "@/lib/db";
import { deleteReceiptFiles, startUpload } from "@/lib/receipts";

// Acciones del teléfono: no hay sesión de usuario, solo el token del QR (un solo uso, 10 minutos).

const EXPIRED = "Este código ya caducó o se usó. Genera otro en el PC.";

// 1) Registra la factura en el espacio de quien generó el QR y devuelve con qué subir la foto.
export async function startCaptureUpload(token: string, mimeType: string, sizeBytes: number) {
  const session = await findWaitingSession(token);
  if (!session) return { error: EXPIRED } as const;

  // Si un intento anterior desde este QR no terminó, se descarta.
  if (session.receiptId) {
    const previous = await db.receipt.findUnique({ where: { id: session.receiptId } });
    if (previous && !previous.transactionId) {
      await db.receipt.delete({ where: { id: previous.id } });
      await deleteReceiptFiles([previous.storagePath]);
    }
  }

  const started = await startUpload({
    workspaceId: session.workspaceId,
    uploadedById: session.userId,
    mimeType,
    sizeBytes,
  });
  if (started.error === null) {
    await db.captureSession.update({ where: { id: session.id }, data: { receiptId: started.receiptId } });
  }
  return started;
}

// 2) Foto subida: avisa al PC (que la está esperando).
export async function finishCaptureUpload(token: string, receiptId: string): Promise<{ error: string | null }> {
  const session = await findWaitingSession(token);
  if (!session) return { error: EXPIRED };
  if (session.receiptId !== receiptId) return { error: "La foto no coincide con este código. Inténtalo de nuevo." };
  await db.captureSession.update({ where: { id: session.id }, data: { status: "UPLOADED" } });
  return { error: null };
}
