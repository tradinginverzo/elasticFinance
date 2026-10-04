import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite abrir el servidor de desarrollo desde otros dispositivos de la red local
  // (p. ej. el iPhone en http://192.168.1.67:3000). Solo afecta a `npm run dev`.
  allowedDevOrigins: ["192.168.1.*"],
};

export default nextConfig;
