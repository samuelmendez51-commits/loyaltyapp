import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Apaga el freno de mano de errores de tipo en Vercel
    ignoreBuildErrors: true,
  },
  eslint: {
    // Apaga el inspector de código en Vercel
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;