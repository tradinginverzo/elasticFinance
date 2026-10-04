// Genera los íconos de la app (PWA, iPhone y pestaña del navegador) a partir de un SVG.
// Uso: node scripts/generate-icons.mjs   (vuelve a ejecutarlo si cambias el diseño)
import { mkdirSync, writeFileSync } from "node:fs";

import sharp from "sharp";

const GREEN = "#009966"; // acento de la app (--primary en modo claro)

// Ícono "wallet" de Lucide (el mismo del logo), en un lienzo de 24×24.
const WALLET_PATHS = [
  "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",
  "M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",
];

// `scale`: fracción del lienzo que ocupa la billetera. `radius`: esquinas redondeadas (0 = cuadrado).
function iconSvg({ size, scale, radius }) {
  const iconSize = size * scale;
  const offset = (size - iconSize) / 2;
  const paths = WALLET_PATHS.map((d) => `<path d="${d}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${GREEN}"/>
  <g transform="translate(${offset} ${offset}) scale(${iconSize / 24})" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
</svg>`;
}

async function png(path, options) {
  await sharp(Buffer.from(iconSvg(options))).png().toFile(path);
  console.log("✓", path);
}

mkdirSync("public/icons", { recursive: true });

// Ícono normal (Android/escritorio): esquinas redondeadas.
await png("public/icons/icon-192.png", { size: 192, scale: 0.5, radius: 42 });
await png("public/icons/icon-512.png", { size: 512, scale: 0.5, radius: 112 });
// "Maskable": cuadrado completo con margen, para que Android pueda recortarlo en círculo, etc.
await png("public/icons/icon-maskable-512.png", { size: 512, scale: 0.4, radius: 0 });
// iPhone: cuadrado completo; iOS le aplica sus propias esquinas.
await png("src/app/apple-icon.png", { size: 180, scale: 0.5, radius: 0 });
// Pestaña del navegador.
writeFileSync("src/app/icon.svg", iconSvg({ size: 32, scale: 0.62, radius: 7 }));
console.log("✓ src/app/icon.svg");
