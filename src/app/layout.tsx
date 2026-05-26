import './globals.css'
import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'LoyaltyApp — Sistema Enterprise de Fidelidad',
  description: 'Plataforma SaaS multi-tenant para programas de lealtad en restaurantes. Panel de control premium.',
  manifest: '/manifest.json',
  themeColor: '#b91c1c',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LoyaltyApp',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${playfair.variable}`} style={{ backgroundColor: '#050505' }}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#b91c1c" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="LoyaltyApp" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body
        className="bg-[#050505] text-white font-sans antialiased selection:bg-red-900/40 selection:text-white min-h-screen flex flex-col"
        style={{ backgroundColor: '#050505', margin: 0, color: '#ffffff' }}
      >
        {/* Registro del Service Worker */}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
                .then(function(reg) { console.log('[LoyaltyApp] SW registrado:', reg.scope); })
                .catch(function(err) { console.log('[LoyaltyApp] SW error:', err); });
            });
          }
        ` }} />

        {/* Atmósfera de fondo */}
        <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-red-900 blur-[150px] opacity-[0.07] pointer-events-none z-0" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-amber-900 blur-[150px] opacity-[0.04] pointer-events-none z-0" />

        {/* Contenedor principal */}
        <div className="relative z-10 flex-1 flex flex-col">
          {children}
        </div>
      </body>
    </html>
  )
}