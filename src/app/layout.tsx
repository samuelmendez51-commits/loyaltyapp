import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
})

export const metadata: Metadata = {
  title: 'LoyaltyApp — Sistema Enterprise de Fidelidad',
  description: 'Plataforma SaaS multi-tenant para programas de lealtad en restaurantes. Panel de control premium.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'LoyaltyApp',
  },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable} style={{ backgroundColor: '#ffffff' }}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LoyaltyApp" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body
        className="bg-white text-[#09090b] font-sans antialiased min-h-screen flex flex-col"
        style={{ backgroundColor: '#ffffff', margin: 0, color: '#09090b' }}
      >
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
                  .then(function(reg) { console.log('[LoyaltyApp] SW registrado:', reg.scope); })
                  .catch(function(err) { console.log('[LoyaltyApp] SW error:', err); });
              });
            }
          `}
        </Script>

        <div className="relative flex-1 flex flex-col">
          {children}
        </div>
      </body>
    </html>
  )
}