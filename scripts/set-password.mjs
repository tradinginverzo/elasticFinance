// Pone una contraseña nueva a un usuario existente (p. ej. si la olvidó y no le llega el correo).
// Uso:
//   npm run user:password        → base de DESARROLLO (.env.local)
//   npm run user:password:prod   → base de PRODUCCIÓN (.env.prod)
// Pide el email y la contraseña nueva por la terminal; la contraseña no se muestra al escribirla.
import { createInterface } from "node:readline";

import { createClient } from "@supabase/supabase-js";

const MIN_LENGTH = 8;
const target = process.argv.includes("--prod") ? "PRODUCCIÓN" : "DESARROLLO";

function ask(question, { hidden = false } = {}) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    // Ocultamos lo que se escribe: solo mostramos la pregunta.
    rl._writeToOutput = (text) => {
      if (text.includes(question)) rl.output.write(text);
    };
  }
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      if (hidden) rl.output.write("\n");
      rl.close();
      resolve(answer.trim());
    }),
  );
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

console.log(`\nCambiar contraseña en ${target}\n`);

const email = (await ask("Email del usuario: ")).toLowerCase();

// Buscamos el usuario por email (pocas cuentas: basta con la primera página).
const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (listError) {
  console.error("No se pudo leer la lista de usuarios:", listError.message);
  process.exit(1);
}
const user = list.users.find((u) => u.email?.toLowerCase() === email);
if (!user) {
  console.error(`No existe ningún usuario con el email ${email} en ${target}.`);
  process.exit(1);
}

const password = await ask(`Contraseña nueva (mín. ${MIN_LENGTH} caracteres): `, { hidden: true });
const confirm = await ask("Repite la contraseña: ", { hidden: true });

if (password.length < MIN_LENGTH) {
  console.error(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`);
  process.exit(1);
}
if (password !== confirm) {
  console.error("Las contraseñas no coinciden.");
  process.exit(1);
}

const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
if (error) {
  console.error("No se pudo cambiar la contraseña:", error.message);
  process.exit(1);
}

console.log(`✓ Contraseña actualizada para ${email} en ${target}.`);
