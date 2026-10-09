// Solo en el navegador: prepara una foto de factura antes de subirla.

const MAX_SIDE = 2000; // px: suficiente para leer un ticket y pesa mucho menos

// Achica la foto y la pasa a JPEG (también convierte las HEIC del iPhone, si el navegador las abre).
export async function compressImage(file: Blob): Promise<Blob> {
  if (file.type === "application/pdf") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file; // el servidor decide si el formato original vale
  }
}
