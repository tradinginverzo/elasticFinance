"use server";

import { headers } from "next/headers";
import QRCode from "qrcode";

import { createCaptureSession } from "@/lib/capture";
import { requireWorkspace } from "@/lib/context";
import { db } from "@/lib/db";
import { toReceiptViews } from "@/lib/receipts";

// PC: crea el enlace de un solo uso para tomar la foto con el teléfono y su código QR.
export async function startPhoneCapture() {
  const { profile, workspace } = await requireWorkspace();
  const { session, token } = await createCaptureSession(profile.id, workspace.id);

  // El enlace usa la misma dirección con la que se abrió la app en el PC.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const url = `${proto}://${host}/captura/${token}`;
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

  return {
    sessionId: session.id,
    url,
    qrSvg,
    expiresAt: session.expiresAt.toISOString(),
    // Desde "localhost" el teléfono no puede abrir el enlace (apunta a sí mismo).
    localOnly: /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host),
  };
}

// PC: pregunta si el teléfono ya subió la foto (se consulta cada pocos segundos).
export async function checkPhoneCapture(sessionId: string): Promise<
  | { status: "WAITING" | "EXPIRED" }
  | { status: "UPLOADED"; receiptId: string; previewUrl: string | null; isPdf: boolean }
> {
  const { profile } = await requireWorkspace();
  const session = await db.captureSession.findFirst({
    where: { id: sessionId, userId: profile.id },
    include: { receipt: true },
  });
  if (!session) return { status: "EXPIRED" };

  if (session.status === "UPLOADED" && session.receipt) {
    await db.captureSession.update({ where: { id: session.id }, data: { status: "COMPLETED" } });
    const [view] = await toReceiptViews([session.receipt]);
    return {
      status: "UPLOADED",
      receiptId: session.receipt.id,
      previewUrl: view.url,
      isPdf: session.receipt.mimeType === "application/pdf",
    };
  }
  if (session.status === "WAITING" && session.expiresAt > new Date()) return { status: "WAITING" };
  if (session.status === "WAITING") {
    await db.captureSession.update({ where: { id: session.id }, data: { status: "EXPIRED" } });
  }
  return { status: "EXPIRED" };
}

// PC: se cerró la ventana del QR sin recibir foto; el enlace deja de servir.
export async function cancelPhoneCapture(sessionId: string) {
  const { profile } = await requireWorkspace();
  await db.captureSession.updateMany({
    where: { id: sessionId, userId: profile.id, status: "WAITING" },
    data: { status: "EXPIRED" },
  });
}
