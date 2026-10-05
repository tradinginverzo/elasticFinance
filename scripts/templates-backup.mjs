// Respaldo y copia de gastos/ingresos fijos entre bases (p. ej. de desarrollo a producción).
//
//   npm run templates:export -- --email tu@correo.com
//       Lee los gastos fijos del espacio personal de ese usuario en DESARROLLO (.env.local)
//       y los guarda en backups/gastos-fijos-<fecha>.json.
//
//   npm run templates:import:prod -- --email tu@correo.com --file backups/gastos-fijos-<fecha>.json
//       Muestra qué se copiaría al espacio personal de ese usuario en PRODUCCIÓN (.env.prod).
//       No escribe nada salvo que añadas --apply.
//
// La categoría y la cuenta se emparejan por nombre (cada base tiene las suyas). Si la categoría
// no existe, se crea; si la cuenta no existe, el gasto fijo queda sin cuenta ("Elegir al registrar").
// Los gastos fijos que ya existen con el mismo nombre y tipo se omiten: se puede repetir sin duplicar.
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import pg from "pg";

// Mismas categorías por defecto que crea la app (src/lib/categories.ts).
const DEFAULT_CATEGORIES = JSON.parse(
  readFileSync(new URL("../src/lib/default-categories.json", import.meta.url), "utf8"),
);

const [command, ...rest] = process.argv.slice(2);
const arg = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? null : rest[i + 1];
};
const email = arg("email")?.toLowerCase();
const apply = rest.includes("--apply");

if (!["export", "import"].includes(command) || !email) {
  console.error("Uso: templates-backup.mjs export|import --email tu@correo.com [--file ruta] [--apply]");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  // El espacio personal tiene el mismo id que el usuario (ver src/lib/auth.ts).
  const { rows: profiles } = await client.query(
    "select id from profiles where lower(email) = $1",
    [email],
  );
  if (profiles.length === 0) {
    throw new Error(
      `No hay ningún perfil con el email ${email} en esta base. ` +
        "Entra una vez en la app con esa cuenta (así se crea tu perfil) y vuelve a intentarlo.",
    );
  }
  const workspaceId = profiles[0].id;

  if (command === "export") {
    const { rows } = await client.query(
      `select t.name, t.type, t.amount_cents::text as "amountCents", t.merchant,
              c.name as "categoryName", a.name as "accountName"
         from transaction_templates t
         left join categories c on c.id = t.category_id
         left join accounts a on a.id = t.account_id
        where t.workspace_id = $1
        order by t.type, t.name`,
      [workspaceId],
    );
    mkdirSync("backups", { recursive: true });
    const file = `backups/gastos-fijos-${new Date().toISOString().slice(0, 10)}.json`;
    writeFileSync(file, JSON.stringify({ exportedAt: new Date().toISOString(), email, templates: rows }, null, 2));
    console.log(`✓ ${rows.length} gastos/ingresos fijos guardados en ${file}`);
  } else {
    const file = arg("file");
    if (!file) throw new Error("Falta --file con el respaldo a importar.");
    const { templates } = JSON.parse(readFileSync(file, "utf8"));

    // Consultas una tras otra: una misma conexión de pg no admite consultas en paralelo.
    const { rows: existing } = await client.query(
      "select name, type from transaction_templates where workspace_id = $1",
      [workspaceId],
    );
    const { rows: categories } = await client.query(
      "select id, name, type from categories where workspace_id = $1",
      [workspaceId],
    );
    const { rows: accounts } = await client.query(
      "select id, name from accounts where workspace_id = $1",
      [workspaceId],
    );
    // Si el espacio aún no tiene categorías, creamos primero las de por defecto (las mismas que
    // crea la app en src/lib/categories.ts). Si solo creáramos las del respaldo, la app ya no
    // crearía las demás, porque solo lo hace cuando el espacio no tiene ninguna.
    const defaultsToCreate =
      categories.length === 0
        ? DEFAULT_CATEGORIES.map((c) => ({ ...c, id: randomUUID() }))
        : [];
    categories.push(...defaultsToCreate);
    const key = (name, type) => `${type}:${name.trim().toLowerCase()}`;
    const existingKeys = new Set(existing.map((t) => key(t.name, t.type)));
    const categoryByKey = new Map(categories.map((c) => [key(c.name, c.type), c.id]));
    const accountByName = new Map(accounts.map((a) => [a.name.trim().toLowerCase(), a.id]));

    const plan = templates.map((t) => ({
      ...t,
      skip: existingKeys.has(key(t.name, t.type)),
      categoryId: t.categoryName ? (categoryByKey.get(key(t.categoryName, t.type)) ?? null) : null,
      accountId: t.accountName ? (accountByName.get(t.accountName.trim().toLowerCase()) ?? null) : null,
    }));

    console.table(
      plan.map((t) => ({
        nombre: t.name,
        tipo: t.type === "EXPENSE" ? "gasto" : "ingreso",
        monto: (Number(t.amountCents) / 100).toFixed(2),
        categoría: t.categoryName ? `${t.categoryName}${t.categoryId ? "" : " (se crea)"}` : "—",
        cuenta: t.accountName ? (t.accountId ? t.accountName : "elegir al registrar") : "—",
        acción: t.skip ? "omitir (ya existe)" : "copiar",
      })),
    );
    const toCopy = plan.filter((t) => !t.skip);

    if (defaultsToCreate.length > 0) {
      console.log(`\nEl espacio no tenía categorías: se crearán las ${defaultsToCreate.length} categorías por defecto.`);
    }

    if (!apply) {
      console.log(`\nVista previa: se copiarían ${toCopy.length} de ${plan.length}. No se escribió nada.`);
      console.log("Para copiarlos de verdad, repite el comando añadiendo --apply");
    } else {
      await client.query("begin");
      for (const c of defaultsToCreate) {
        await client.query(
          "insert into categories (id, workspace_id, name, type, icon) values ($1, $2, $3, $4, $5)",
          [c.id, workspaceId, c.name, c.type, c.icon],
        );
      }
      for (const t of toCopy) {
        let categoryId = t.categoryId;
        if (t.categoryName && !categoryId) {
          categoryId = randomUUID();
          await client.query(
            "insert into categories (id, workspace_id, name, type) values ($1, $2, $3, $4)",
            [categoryId, workspaceId, t.categoryName, t.type],
          );
          categoryByKey.set(key(t.categoryName, t.type), categoryId);
          // Otros gastos fijos del respaldo con la misma categoría nueva la reutilizan.
          for (const other of toCopy) {
            if (other.categoryName && key(other.categoryName, other.type) === key(t.categoryName, t.type)) {
              other.categoryId = categoryId;
            }
          }
        }
        await client.query(
          `insert into transaction_templates
             (id, workspace_id, name, type, amount_cents, account_id, category_id, merchant)
           values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [randomUUID(), workspaceId, t.name, t.type, t.amountCents, t.accountId, categoryId, t.merchant],
        );
      }
      await client.query("commit");
      console.log(`\n✓ Copiados ${toCopy.length} gastos/ingresos fijos.`);
    }
  }
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error(`✗ ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
