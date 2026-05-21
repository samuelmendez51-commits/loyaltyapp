import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'La Burrería Club',
  description: 'Sistema VIP de Fidelidad y Punto de Venta',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="bg-[#0a0a0a] text-white antialiased selection:bg-red-600/30">
        {children}
      </body>
    </html>
  )
}