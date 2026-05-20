import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "La Burrería - Club VIP",
  description: "Plataforma SaaS de Fidelización",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-[#09090b] text-[#ffffff] min-h-screen flex flex-col selection:bg-[#dc2626]`}>
        
        {/* BARRA DE NAVEGACIÓN GLOBAL PREMIUM */}
        <nav className="w-full sticky top-0 z-50 bg-[#09090b]/80 backdrop-blur-md border-b border-[#27272a]">
          <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
            <Link href="/" className="font-black text-xl italic uppercase tracking-tighter hover:scale-105 transition-transform">
              <span className="text-[#ffffff]">LA</span><span className="text-[#dc2626]">BURRERÍA</span>
            </Link>
            <div className="space-x-1 sm:space-x-4 flex items-center">
              <Link href="/escaner" className="text-[#a1a1aa] hover:text-[#ffffff] text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors px-2 py-1 rounded-md hover:bg-[#27272a]/50">
                Escáner
              </Link>
              <Link href="/registro" className="text-[#a1a1aa] hover:text-[#ffffff] text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors px-2 py-1 rounded-md hover:bg-[#27272a]/50">
                Registro
              </Link>
              <Link href="/dashboard" className="bg-[#dc2626] text-white text-[10px] sm:text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg hover:bg-[#ef4444] transition-colors shadow-[0_0_10px_rgba(220,38,38,0.3)]">
                Dashboard
              </Link>
            </div>
          </div>
        </nav>
        
        {/* Aquí se inyecta de forma única cada página sin mezclarse */}
        <main className="flex-1 flex flex-col relative z-0">
          {children}
        </main>

      </body>
    </html>
  );
}