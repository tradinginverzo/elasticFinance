"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { CategorySelect } from "@/components/category-select";
import { FormError } from "@/components/form-error";
import { NativeSelect } from "@/components/native-select";
import { ReceiptThumb } from "@/components/receipt-thumb";
import { ReceiptUploader, type UploadedReceipt } from "@/components/receipt-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormAction } from "@/hooks/use-form-action";
import { todayInput } from "@/lib/dates";
import { UsualDiffNote } from "@/components/usual-diff-badge";
import { centsToInput, parseAmountToCents } from "@/lib/money";
import type { ReceiptScan } from "@/lib/receipt-types";
import { cn } from "@/lib/utils";

import { deleteReceipt } from "../facturas/actions";
import { TemplatePicker } from "./template-picker";

import {
  deleteTransaction,
  saveTransaction,
  type TransactionFormState,
} from "./actions";

// Gasto / ingreso, o transferencia entre cuentas (no es ni ingreso ni gasto).
type TransactionType = "EXPENSE" | "INCOME" | "TRANSFER";
type FlowType = Exclude<TransactionType, "TRANSFER">;

const TYPE_OPTIONS = [
  ["EXPENSE", "Gasto", "text-expense"],
  ["INCOME", "Ingreso", "text-income"],
  ["TRANSFER", "Transferencia", "text-foreground"],
] as const;

export type TransactionFormData = {
  id: string;
  type: TransactionType;
  amount: string;
  date: string;
  accountId: string;
  toAccountId: string | null; // solo transferencias
  categoryId: string | null;
  merchant: string | null;
  notes: string | null;
  templateId: string | null;
  // Gasto fijo del que salió y su monto habitual al registrarlo (para marcar si fue distinto).
  usual: { name: string; amountCents: string } | null;
};

// Gasto fijo para rellenar el formulario (ver src/lib/templates.ts).
export type TemplateOption = {
  id: string;
  name: string;
  type: FlowType;
  amountCents: string;
  accountId: string | null;
  categoryId: string | null;
  merchant: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  accountName: string | null;
  registeredOn: string | null; // "2026-10-03" si ya se registró este mes
};

const initialState: TransactionFormState = { error: null };

// Factura adjunta al crear el movimiento. `fromList`: ya estaba subida (viene de /facturas).
export type FormReceipt = UploadedReceipt & { fromList?: boolean };

// Campos que se rellenan con lo leído de la factura. Con un gasto fijo elegido (o en una
// transferencia) solo se toman el monto, la fecha y las notas: el resto ya viene dado.
type ScanFill = Partial<{
  type: FlowType;
  amount: string;
  date: string;
  merchant: string;
  categoryId: string;
  notes: string;
}>;

function fillFromScan(scan: ReceiptScan | null, full: boolean): ScanFill | null {
  if (!scan) return null;
  const fill: ScanFill = {
    amount: scan.amount ?? undefined,
    date: scan.date ?? undefined,
    notes: scan.notes ?? undefined,
  };
  if (full) {
    fill.type = scan.type;
    fill.merchant = scan.merchant ?? undefined;
    fill.categoryId = scan.categoryId ?? undefined;
  }
  return fill;
}

export function TransactionForm({
  transaction,
  accounts,
  categories,
  currency,
  templates = [],
  initialTemplateId = null,
  initialReceipt = null,
  receiptReadingEnabled = false,
}: {
  transaction?: TransactionFormData;
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string; type: FlowType; color: string | null }[];
  currency: string;
  templates?: TemplateOption[];
  initialTemplateId?: string | null;
  initialReceipt?: FormReceipt | null;
  receiptReadingEnabled?: boolean;
}) {
  const { state, onSubmit, pending } = useFormAction(
    saveTransaction.bind(null, transaction?.id ?? null),
    initialState,
  );
  const [templateId, setTemplateId] = useState<string>(
    transaction?.templateId ?? (templates.some((t) => t.id === initialTemplateId) ? initialTemplateId! : ""),
  );
  const template = transaction ? undefined : templates.find((t) => t.id === templateId);
  const [receipt, setReceipt] = useState<FormReceipt | null>(initialReceipt);
  const [scanFill, setScanFill] = useState<ScanFill | null>(() =>
    fillFromScan(initialReceipt?.scan ?? null, !template),
  );
  // Cambia cada vez que llega una factura leída: remonta los campos con los nuevos valores.
  const [scanVersion, setScanVersion] = useState(0);
  const [type, setType] = useState<TransactionType>(
    template?.type ?? scanFill?.type ?? transaction?.type ?? "EXPENSE",
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Valores iniciales de los campos: los del gasto fijo elegido o los del movimiento que se edita.
  // Al elegir otro gasto fijo, los campos se remontan (key) con estos valores; el monto se puede cambiar.
  const base = template
    ? {
        type: template.type,
        amount: centsToInput(BigInt(template.amountCents)),
        accountId: template.accountId ?? accounts[0]?.id,
        categoryId: template.categoryId,
        merchant: template.merchant || template.name,
      }
    : {
        type: transaction?.type,
        amount: transaction?.amount,
        accountId: transaction?.accountId ?? accounts[0]?.id,
        categoryId: transaction?.categoryId ?? null,
        merchant: transaction?.merchant ?? "",
      };
  const prefill = {
    ...base,
    type: scanFill?.type ?? base.type,
    amount: scanFill?.amount ?? base.amount,
    categoryId: scanFill?.categoryId ?? base.categoryId,
    merchant: scanFill?.merchant ?? base.merchant,
  };
  const fieldKey = `${templateId}-${scanVersion}`;

  // Lo que se va escribiendo en "Monto", para comparar en vivo con el monto habitual.
  const [amountText, setAmountText] = useState(prefill.amount ?? "");
  const usual = template
    ? { name: template.name, cents: Number(template.amountCents) }
    : transaction?.usual
      ? { name: transaction.usual.name, cents: Number(transaction.usual.amountCents) }
      : null;
  const typedCents = parseAmountToCents(amountText);

  // Cuentas: "Desde" (o la cuenta del gasto/ingreso) y, en transferencias, "Hacia" (distinta).
  const [fromAccountId, setFromAccountId] = useState(prefill.accountId ?? "");
  const firstOtherAccount = (fromId: string) => accounts.find((a) => a.id !== fromId)?.id ?? "";
  const [toAccountId, setToAccountId] = useState(
    transaction?.toAccountId ?? firstOtherAccount(prefill.accountId ?? ""),
  );
  const isTransfer = type === "TRANSFER";

  function changeFromAccount(id: string) {
    setFromAccountId(id);
    if (id === toAccountId) setToAccountId(firstOtherAccount(id));
  }

  // id = "" deja de usar el gasto fijo (los campos vuelven a quedar vacíos).
  function applyTemplate(id: string) {
    setTemplateId(id);
    const next = templates.find((t) => t.id === id);
    if (next) setType(next.type);
    // El monto de la factura (si hay) manda sobre el habitual del gasto fijo.
    setAmountText(scanFill?.amount ?? (next ? centsToInput(BigInt(next.amountCents)) : ""));
    if (next?.accountId) changeFromAccount(next.accountId);
  }

  function changeType(next: TransactionType) {
    setType(next);
    // Una transferencia no sale de un gasto fijo.
    if (next === "TRANSFER" && templateId) applyTemplate("");
  }
  const [deleting, startDelete] = useTransition();
  const dateRef = useRef<HTMLInputElement>(null);
  const initialScanDate = useRef(scanFill?.date);

  // La fecha por defecto es la de la factura o "hoy" según el reloj del dispositivo
  // (el servidor puede estar en otra zona).
  useEffect(() => {
    if (!transaction && dateRef.current) dateRef.current.value = initialScanDate.current ?? todayInput();
  }, [transaction]);

  function handleReceipt(uploaded: UploadedReceipt) {
    setReceipt(uploaded);
    const fill = fillFromScan(uploaded.scan, !template && type !== "TRANSFER");
    if (!fill) return;
    setScanFill(fill);
    if (fill.type) setType(fill.type);
    if (fill.amount) setAmountText(fill.amount);
    if (fill.date && dateRef.current) dateRef.current.value = fill.date;
    setScanVersion((v) => v + 1);
  }

  // Quitar la factura del formulario: si se subió aquí se borra; si venía de /facturas, queda allí.
  function removeReceipt() {
    if (!receipt) return;
    if (!receipt.fromList) void deleteReceipt(receipt.receiptId);
    setReceipt(null);
  }

  const visibleCategories = categories.filter((c) => c.type === type);
  const toAccounts = accounts.filter((a) => a.id !== fromAccountId);

  function handleDelete() {
    if (!transaction || !confirm("¿Eliminar este movimiento?")) return;
    startDelete(async () => {
      const result = await deleteTransaction(transaction.id);
      setDeleteError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} autoComplete="off" className="flex flex-col gap-5">
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="templateId" value={templateId} />
        <input type="hidden" name="receiptId" value={receipt?.receiptId ?? ""} />

        {!transaction &&
          (receipt ? (
            <ReceiptCard receipt={receipt} onRemove={removeReceipt} />
          ) : (
            <ReceiptUploader
              onUploaded={handleReceipt}
              label={receiptReadingEnabled ? "Leer una factura (foto o PDF)" : "Adjuntar factura (foto o PDF)"}
            />
          ))}

        {!transaction &&
          !isTransfer &&
          (templates.length > 0 ? (
            <TemplatePicker
              templates={templates}
              selectedId={templateId}
              onSelect={applyTemplate}
              currency={currency}
            />
          ) : (
            <Link
              href="/movimientos/fijos/nuevo"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              ¿Pagas lo mismo cada mes? Guarda tus gastos fijos para registrarlos más rápido.
            </Link>
          ))}

        <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Tipo">
          {TYPE_OPTIONS.map(([value, label, activeColor]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={type === value}
              onClick={() => changeType(value)}
              className={cn(
                "h-9 truncate rounded-lg px-1 text-sm font-medium text-muted-foreground transition-colors",
                type === value && "bg-background shadow-sm",
                type === value && activeColor,
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {isTransfer && (
          <p className="-mt-2 text-xs text-muted-foreground">
            Pasa dinero de una cuenta a otra (retiro en efectivo, pago de la tarjeta…). No cuenta como
            ingreso ni como gasto.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="amount">Monto ({currency})</Label>
          <Input
            key={`amount-${fieldKey}`}
            id="amount"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            className="h-12 text-2xl font-semibold tabular-nums md:text-2xl"
            defaultValue={prefill.amount}
            onChange={(e) => setAmountText(e.target.value)}
            required
          />
          {usual && !isTransfer && (
            <UsualDiffNote
              type={type}
              amountCents={typedCents === null ? null : Number(typedCents)}
              usualCents={usual.cents}
              currency={currency}
              name={usual.name}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="date">Fecha</Label>
            <Input
              ref={dateRef}
              id="date"
              name="date"
              type="date"
              autoComplete="off"
              className="h-10"
              defaultValue={transaction?.date}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="accountId">{isTransfer ? "Desde" : "Cuenta"}</Label>
            <NativeSelect
              id="accountId"
              name="accountId"
              value={fromAccountId}
              onChange={(e) => changeFromAccount(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        {isTransfer ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="toAccountId">Hacia</Label>
            {toAccounts.length === 0 ? (
              <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                Necesitas otra cuenta para transferir, por ejemplo «Efectivo» o tu tarjeta.{" "}
                <Link href="/cuentas/nueva" className="font-medium text-primary underline-offset-4 hover:underline">
                  Crear cuenta
                </Link>
              </p>
            ) : (
              <NativeSelect
                id="toAccountId"
                name="toAccountId"
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
              >
                {toAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="categoryId">Categoría</Label>
            <CategorySelect
              // Al cambiar entre gasto e ingreso (o de gasto fijo) cambian las opciones: remontamos el select.
              key={`category-${type}-${fieldKey}`}
              id="categoryId"
              name="categoryId"
              categories={visibleCategories}
              defaultValue={prefill.type === type ? prefill.categoryId : null}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="merchant">
            {type === "EXPENSE" ? "Comercio o descripción" : "Descripción"}
          </Label>
          <Input
            key={`merchant-${fieldKey}`}
            id="merchant"
            name="merchant"
            autoComplete="off"
            className="h-10"
            placeholder={
              type === "EXPENSE"
                ? "Supermercado, farmacia…"
                : type === "INCOME"
                  ? "Sueldo de octubre…"
                  : "Retiro en cajero, pago de la AMEX…"
            }
            defaultValue={prefill.merchant}
            maxLength={100}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="notes">Notas</Label>
          <textarea
            key={`notes-${scanVersion}`}
            id="notes"
            name="notes"
            autoComplete="off"
            rows={2}
            maxLength={500}
            defaultValue={scanFill?.notes ?? transaction?.notes ?? ""}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
          />
        </div>

        <FormError message={state.error} />

        <div className="flex gap-2">
          <Button type="submit" size="lg" className="h-10 flex-1" disabled={pending}>
            {pending ? "Guardando…" : transaction ? "Guardar cambios" : "Guardar"}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-10"
            render={<Link href="/movimientos" />}
            nativeButton={false}
          >
            Cancelar
          </Button>
        </div>
      </form>

      {transaction && (
        <div className="flex flex-col gap-2 border-t pt-6">
          <Button
            variant="destructive"
            className="h-10"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Eliminando…" : "Eliminar movimiento"}
          </Button>
          <FormError message={deleteError} />
        </div>
      )}
    </div>
  );
}

// Factura adjunta al formulario, con lo que pasó al leerla.
function ReceiptCard({ receipt, onRemove }: { receipt: FormReceipt; onRemove: () => void }) {
  const failed = receipt.readingEnabled && receipt.error;
  const message = !receipt.readingEnabled
    ? "Factura adjunta. Escribe los datos del movimiento."
    : (receipt.error ??
      `Datos leídos de la factura. Revísalos antes de guardar.${
        receipt.scan?.itemCount
          ? ` Después podrás guardar ${receipt.scan.itemCount === 1 ? "el precio de su producto" : `los precios de sus ${receipt.scan.itemCount} productos`}.`
          : ""
      }`);
  const itemCount = receipt.scan?.itemCount ?? 0;
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-2">
      <ReceiptThumb url={receipt.previewUrl} isPdf={receipt.isPdf} className="size-14" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className={cn("text-sm", failed ? "text-destructive" : "text-muted-foreground")}>{message}</p>
        {/* Para tickets que solo sirven para comparar precios: sin crear el movimiento. */}
        {itemCount > 0 && (
          <Link
            href={`/facturas/${receipt.receiptId}`}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Solo guardar los precios
          </Link>
        )}
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
        Quitar
      </Button>
    </div>
  );
}
