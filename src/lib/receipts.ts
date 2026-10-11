import "server-only";

import { randomUUID } from "node:crypto";

import Anthropic from "@anthropic-ai/sdk";

import { getCategories } from "@/lib/categories";
import { db } from "@/lib/db";
import { centsToInput } from "@/lib/money";
import {
  RECEIPT_MAX_BYTES,
  RECEIPT_MIME_TYPES,
  type ReceiptScan,
  type ReceiptView,
} from "@/lib/receipt-types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { onlyFlow } from "@/lib/transaction-types";

export const RECEIPT_BUCKET = "receipts";
const MODEL = "claude-sonnet-5-5";
const SIGNED_URL_SECONDS = 60 * 10;

// Sin clave de Anthropic las facturas se suben igual, pero los datos se escriben a mano.
export function receiptReadingEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function storage() {
  return createSupabaseAdminClient().storage.from(RECEIPT_BUCKET);
}

const EXTENSIONS: Record<(typeof RECEIPT_MIME_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

// Registra una factura nueva y devuelve con qué subir su archivo (o un error si no vale).
export async function startUpload(input: {
  workspaceId: string;
  uploadedById: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<{ error: string } | { error: null; receiptId: string; path: string; token: string }> {
  if (!(RECEIPT_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
    return { error: "Sube una foto (JPG, PNG, WEBP, HEIC) o un PDF." };
  }
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > RECEIPT_MAX_BYTES) {
    return { error: "El archivo pesa más de 10 MB." };
  }
  const extension = EXTENSIONS[input.mimeType as keyof typeof EXTENSIONS];
  const path = `${input.workspaceId}/${randomUUID()}.${extension}`;
  const token = await createReceiptUploadUrl(path);
  const receipt = await db.receipt.create({
    data: {
      workspaceId: input.workspaceId,
      uploadedById: input.uploadedById,
      storagePath: path,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    },
  });
  return { error: null, receiptId: receipt.id, path, token };
}

// URL temporal para que el navegador suba el archivo directo a Storage (sin pasar por el servidor).
export async function createReceiptUploadUrl(path: string) {
  const { data, error } = await storage().createSignedUploadUrl(path);
  if (error) throw error;
  return data.token;
}

export async function deleteReceiptFiles(paths: string[]) {
  if (paths.length > 0) await storage().remove(paths);
}

// Facturas con URLs firmadas para verlas (caducan a los 10 minutos).
export async function toReceiptViews(
  receipts: {
    id: string;
    storagePath: string;
    mimeType: string;
    status: ReceiptView["status"];
    _count?: { priceEntries: number };
  }[],
): Promise<ReceiptView[]> {
  if (receipts.length === 0) return [];
  const { data } = await storage().createSignedUrls(
    receipts.map((r) => r.storagePath),
    SIGNED_URL_SECONDS,
  );
  return receipts.map((r, i) => ({
    id: r.id,
    url: data?.[i]?.signedUrl ?? null,
    mimeType: r.mimeType,
    status: r.status,
    priceCount: r._count?.priceEntries ?? 0,
  }));
}

// Un producto comprado, tal como lo leyó la IA.
export type ExtractedItem = {
  text: string;
  product: string;
  unit: "ML" | "G" | "UNIT";
  brand: string | null;
  size_each: number | null;
  pack_count: number;
  quantity: number;
  line_total: number;
  discount: number | null;
  discount_percent?: number | null; // % de una oferta por categoría (resumen al final, p. ej. Supermaxi)
  taxed?: boolean; // paga IVA aparte (precio de la línea sin IVA)
};

// Lo que guardamos en receipts.extracted_data (la respuesta de la IA, tal cual).
export type Extracted = {
  is_receipt: boolean;
  type: "EXPENSE" | "INCOME";
  total: number | null;
  currency: string | null;
  date: string | null;
  merchant: string | null;
  category: string | null;
  summary: string | null;
  branch?: string | null; // sucursal ("Plaza Las Américas"), si la factura la dice
  line_prices_include_tax?: boolean; // false: los precios de las líneas no traen el IVA (se suma al final)
  tax_rate?: number | null; // p. ej. 15
  tendered?: number | null; // lo que se entregó para pagar (p. ej. el billete de $20)
  change?: number | null; // el cambio o vuelto que se recibió
  items?: ExtractedItem[]; // facturas leídas antes del comparador no los tienen
};

// Formato JSON que la IA debe devolver (structured outputs).
const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    is_receipt: {
      type: "boolean",
      description: "false si la imagen no es una factura, ticket, recibo ni comprobante de pago.",
    },
    type: {
      type: "string",
      enum: ["EXPENSE", "INCOME"],
      description: "EXPENSE si el usuario pagó; INCOME si recibió dinero (p. ej. una factura que él emitió).",
    },
    total: {
      type: ["number", "null"],
      description:
        "TOTAL de la compra (lo que cuesta), con impuestos y propina. NO es lo que el cliente entregó para pagar (efectivo, «recibido», «pago») ni el cambio o vuelto. Número con punto decimal, sin separador de miles.",
    },
    line_prices_include_tax: {
      type: "boolean",
      description:
        "true si el precio de cada línea ya incluye el IVA. false si las líneas van sin IVA y el impuesto se suma al final (p. ej. «Subtotal sin IVA» + «15% IVA», con productos gravados marcados con «I» o «*»).",
    },
    tax_rate: { type: ["number", "null"], description: "Tasa del IVA en %, p. ej. 15. null si no aparece." },
    tendered: {
      type: ["number", "null"],
      description: "Lo que el cliente entregó para pagar, si aparece (efectivo, «recibido», «pago con»). null si no aparece.",
    },
    change: {
      type: ["number", "null"],
      description: "Cambio o vuelto devuelto al cliente, si aparece. null si no aparece.",
    },
    currency: { type: ["string", "null"], description: "Código ISO 4217 (USD, EUR…), si se ve." },
    date: { type: ["string", "null"], description: "Fecha de la compra en formato YYYY-MM-DD." },
    merchant: {
      type: ["string", "null"],
      description:
        "Nombre comercial corto de la cadena o negocio, sin la sucursal (p. ej. «Supermaxi», no «Supermaxi Plaza Las Américas» ni la razón social).",
    },
    branch: {
      type: ["string", "null"],
      description:
        "Sucursal o local, si la factura lo dice (p. ej. «SUPERMAXI PLAZA LAS AMERICAS» → «Plaza Las Américas»). Con mayúsculas normales. null si no aparece.",
    },
    category: {
      type: ["string", "null"],
      description: "La categoría de la lista que mejor encaje, escrita exactamente igual. null si ninguna encaja.",
    },
    summary: {
      type: ["string", "null"],
      description: "Qué se compró, en pocas palabras (máx. 120 caracteres). En español.",
    },
    items: {
      type: "array",
      description:
        "Cada producto comprado. Sin subtotales, impuestos ni líneas de descuento: el descuento va en el producto al que se aplica. Los descuentos pueden estar debajo del producto o en un resumen de ofertas/ahorros al final de la factura (p. ej. Supermaxi): en ese caso relaciona cada oferta del resumen con su producto por el nombre. Vacío si no es una compra de productos.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string", description: "La línea tal como está impresa (sin el precio)." },
          product: {
            type: "string",
            description:
              "Producto genérico en español, singular, sin marca ni medida: «Detergente líquido», «Arroz», «Papel higiénico». Si coincide con un producto ya guardado, escríbelo exactamente igual.",
          },
          unit: {
            type: "string",
            enum: ["ML", "G", "UNIT"],
            description:
              "Cómo se mide el producto por naturaleza, aunque la factura no traiga la medida: ML para líquidos (leche, aceite, agua), G para sólidos que se venden por peso o en paquetes de peso (arroz, café, cereal, carne), UNIT para lo que se cuenta (huevos, rollos, pañales).",
          },
          brand: { type: ["string", "null"], description: "Marca, si se ve." },
          size_each: {
            type: ["number", "null"],
            description:
              "Medida de cada unidad en ml (ML), g (G) o unidades (UNIT), SOLO si aparece impresa en la línea (p. ej. «1000ML», «2KG», «X12»). Lo pesado a granel (0,850 kg de tomate): 850. Si la factura no muestra la medida, null: no la supongas.",
          },
          pack_count: {
            type: "integer",
            description: "Unidades en el paquete (papel 4 rollos → 4; pack 3 × 400 g → 3). Normalmente 1.",
          },
          quantity: { type: "number", description: "Paquetes comprados (en lo pesado a granel, 1)." },
          line_total: {
            type: "number",
            description:
              "Lo pagado por la línea YA RESTANDO su descuento, aunque el descuento aparezca en otra parte de la factura (resumen de ofertas al final).",
          },
          discount_percent: {
            type: ["number", "null"],
            description:
              "Si el resumen de descuentos al final es por categoría o promoción con porcentaje (p. ej. «30 % CEREALES», «20 % HUGGIES PAÑALES», «15 % MARCA PROPIA»), el porcentaje que corresponde a este producto según su nombre. null si ninguno le corresponde con claridad.",
          },
          taxed: {
            type: "boolean",
            description: "true si este producto paga IVA (en muchas facturas va marcado con «I», «G» o «*» junto al precio).",
          },
          discount: {
            type: ["number", "null"],
            description:
              "Descuento u oferta aplicado a esta línea (positivo), tomado de la propia línea o del resumen de ofertas/ahorros al final. null si la factura no muestra descuento para este producto (no lo supongas).",
          },
        },
        required: [
          "text",
          "product",
          "unit",
          "brand",
          "size_each",
          "pack_count",
          "quantity",
          "line_total",
          "discount",
          "discount_percent",
          "taxed",
        ],
      },
    },
  },
  required: [
    "is_receipt",
    "type",
    "total",
    "line_prices_include_tax",
    "tax_rate",
    "tendered",
    "change",
    "currency",
    "date",
    "merchant",
    "branch",
    "category",
    "summary",
    "items",
  ],
};

// Lee la factura con Claude y guarda el resultado. Devuelve un mensaje de error o null.
export async function readReceipt(receiptId: string): Promise<string | null> {
  const receipt = await db.receipt.findUniqueOrThrow({ where: { id: receiptId } });
  if (!receiptReadingEnabled()) return null;
  if (receipt.mimeType === "image/heic" || receipt.mimeType === "image/heif") {
    return fail(receiptId, "La IA no lee fotos HEIC. Escribe los datos a mano.");
  }

  await db.receipt.update({ where: { id: receiptId }, data: { status: "PROCESSING", error: null } });
  try {
    const { data: file, error } = await storage().download(receipt.storagePath);
    if (error) throw error;
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const [categories, products] = await Promise.all([
      getCategories(receipt.workspaceId).then(onlyFlow),
      db.product.findMany({
        where: { workspaceId: receipt.workspaceId },
        select: { name: true },
        orderBy: { name: "asc" },
        take: 400,
      }),
    ]);

    const source =
      receipt.mimeType === "application/pdf"
        ? ({
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          } as const)
        : ({
            type: "image",
            source: {
              type: "base64",
              media_type: receipt.mimeType as "image/jpeg" | "image/png" | "image/webp",
              data: base64,
            },
          } as const);

    const response = await new Anthropic().messages.create({
      model: MODEL,
      max_tokens: 16000, // una factura larga de supermercado trae muchas líneas
      output_config: { effort: "low", format: { type: "json_schema", schema: EXTRACT_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            source,
            {
              type: "text",
              text: [
                "Lee esta factura o ticket para una app de finanzas personales y devuelve sus datos.",
                "Si un dato no se ve con claridad, déjalo en null; no lo inventes.",
                `Categorías de gasto: ${categories.filter((c) => c.type === "EXPENSE").map((c) => c.name).join(", ")}.`,
                `Categorías de ingreso: ${categories.filter((c) => c.type === "INCOME").map((c) => c.name).join(", ")}.`,
                products.length > 0
                  ? `Productos ya guardados (reutiliza estos nombres si coinciden): ${products.map((p) => p.name).join(", ")}.`
                  : "",
              ].join("\n"),
            },
          ],
        },
      ],
    });

    const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
    if (!text) throw new Error(`La IA no devolvió datos (${response.stop_reason}).`);
    const extracted = fixTotal(JSON.parse(text) as Extracted);

    await db.receipt.update({
      where: { id: receiptId },
      // Si ya está en un movimiento sigue "confirmada" (p. ej. al volver a leer sus productos).
      data: { status: receipt.transactionId ? "CONFIRMED" : "PROCESSED", extractedData: extracted, error: null },
    });
    return extracted.is_receipt ? null : "No parece una factura. Revisa los datos.";
  } catch (error) {
    console.error("Error leyendo la factura", receiptId, error);
    return fail(receiptId, "No se pudo leer la factura. Escribe los datos a mano.");
  }
}

// Si la IA tomó como total lo entregado en efectivo ($20) pese a haber cambio ($1,33),
// el total real es la diferencia ($18,67).
export function fixTotal(data: Extracted): Extracted {
  const { total, tendered, change } = data;
  if (total && tendered && change && change > 0 && Math.abs(total - tendered) < 0.005 && tendered > change) {
    return { ...data, total: Math.round((tendered - change) * 100) / 100 };
  }
  return data;
}

async function fail(receiptId: string, message: string) {
  const { transactionId } = await db.receipt.findUniqueOrThrow({ where: { id: receiptId } });
  await db.receipt.update({
    where: { id: receiptId },
    data: { status: transactionId ? "CONFIRMED" : "FAILED", error: message },
  });
  return message;
}

// Datos guardados de la IA → valores del formulario de movimientos.
export async function toReceiptScan(
  extractedData: unknown,
  workspaceId: string,
  workspaceCurrency: string,
): Promise<ReceiptScan | null> {
  if (!extractedData || typeof extractedData !== "object") return null;
  const data = fixTotal(extractedData as Extracted);
  const type = data.type === "INCOME" ? "INCOME" : "EXPENSE";

  const categories = await getCategories(workspaceId);
  const category = data.category
    ? categories.find((c) => c.type === type && c.name.toLowerCase() === data.category!.toLowerCase())
    : undefined;

  const total = typeof data.total === "number" && data.total > 0 ? data.total : null;
  const date = data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : null;
  const otherCurrency =
    data.currency && data.currency.toUpperCase() !== workspaceCurrency ? data.currency.toUpperCase() : null;

  return {
    type,
    amount: total === null ? null : centsToInput(BigInt(Math.round(total * 100))),
    date,
    merchant: data.merchant?.slice(0, 100) || null,
    branch: data.branch?.slice(0, 60) || null,
    categoryId: category?.id ?? null,
    itemCount: data.items?.length ?? 0,
    notes:
      [data.summary, otherCurrency ? `Factura en ${otherCurrency}` : null].filter(Boolean).join(" · ").slice(0, 500) ||
      null,
  };
}
