import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'burreria-red': '#D32F2F',    // El rojo intenso de las letras [1]
        'burreria-orange': '#FF4500', // El naranja vibrante [1, 6]
        'burreria-dark': '#1A1A1A',   // El fondo oscuro del logo [1]
        'burreria-gold': '#FFD700',   // Para las estrellas iluminadas [2]
      },
    },
  },
  plugins: [],
};
export default config;