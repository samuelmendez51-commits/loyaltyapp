import './globals.css'
import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'

// Tipografía Sans-serif para datos, botones y UI (Limpio y moderno)
const inter = Inter({ 
  subsets: ['latin'], 
  variable: '--font-inter',
  display: 'swap',
})

// Tipografía Serif para títulos elegantes y branding (Lujo y tradición)
const playfair = Playfair_Display({ 
  subsets: ['latin'], 
  variable: '--font-playfair',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'La Burrería Club | VIP',
  description: 'Sistema VIP de Fidelidad y Punto de Venta Premium',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${inter.variable} ${playfair.variable}`} style={{ backgroundColor: '#050505' }}>
      <body 
        className="bg-[#050505] text-white font-sans antialiased selection:bg-[#b91c1c]/40 selection:text-white min-h-screen flex flex-col"
        style={{ backgroundColor: '#050505', margin: 0, color: '#ffffff' }}
      >
        
        {/* Efecto de luz difusa de fondo (Atmósfera Hemlock/Sakura) */}
        <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#b91c1c] blur-[150px] opacity-10 pointer-events-none z-0"></div>
        <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#d4af37] blur-[150px] opacity-5 pointer-events-none z-0"></div>
        
        {/* Contenedor principal */}
        <div className="relative z-10 flex-1 flex flex-col">
          {children}
        </div>
      </body>
    </html>
  )
}