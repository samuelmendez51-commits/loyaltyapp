'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

function SimulationContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') || 'demo-client'
  const nombre = searchParams.get('nombre') || 'Socio VIP'
  const puntos = Number(searchParams.get('puntos') || 0)
  const businessName = searchParams.get('business_name') || 'La Burrería'
  const businessLogo = searchParams.get('logo_url') || searchParams.get('business_logo') || '⭐'
  const businessBanner = searchParams.get('banner_url') || ''

  const [qrCodeUrl, setQrCodeUrl] = useState('')

  useEffect(() => {
    // Generar un código QR de alta resolución con la API de GoQR
    const targetUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/cliente/${id}`
    setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}&color=09090b&bgcolor=ffffff`)
  }, [id])

  const renderStars = () => {
    const stars = Array.from({ length: 10 }).map((_, idx) => idx < puntos)
    const row1 = stars.slice(0, 6)
    const row2 = stars.slice(6, 10)

    return (
      <div className="bg-[#fafafa] border border-[#f0f0f0] rounded-2xl p-5 my-4 flex flex-col gap-2.5 items-center justify-center">
        {/* Row 1 (6 stars) */}
        <div className="flex gap-2 justify-center items-center">
          {row1.map((filled, idx) => (
            <div key={idx} className="w-8 h-8 rounded-full flex items-center justify-center">
              {filled ? (
                <svg viewBox="0 0 100 100" className="w-8 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#000000" strokeWidth="16" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#f59e0b" strokeWidth="6" />
                  <polygon points="50,18 59,38 81,40 64,55 70,77 50,65 30,77 36,55 19,40 41,38" fill="#000000" stroke="#000000" strokeWidth="10" strokeLinejoin="round" />
                  <polygon points="50,18 59,38 81,40 64,55 70,77 50,65 30,77 36,55 19,40 41,38" fill="#f59e0b" />
                </svg>
              ) : (
                <svg viewBox="0 0 100 100" className="w-8 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#000000" strokeWidth="16" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#d1d5db" strokeWidth="6" />
                  <polygon points="50,18 59,38 81,40 64,55 70,77 50,65 30,77 36,55 19,40 41,38" fill="none" stroke="#000000" strokeWidth="16" strokeLinejoin="round" />
                  <polygon points="50,18 59,38 81,40 64,55 70,77 50,65 30,77 36,55 19,40 41,38" fill="none" stroke="#d1d5db" strokeWidth="6" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          ))}
        </div>
        {/* Row 2 (4 stars) */}
        <div className="flex gap-2 justify-center items-center">
          {row2.map((filled, idx) => (
            <div key={idx} className="w-8 h-8 rounded-full flex items-center justify-center">
              {filled ? (
                <svg viewBox="0 0 100 100" className="w-8 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#000000" strokeWidth="16" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#f59e0b" strokeWidth="6" />
                  <polygon points="50,18 59,38 81,40 64,55 70,77 50,65 30,77 36,55 19,40 41,38" fill="#000000" stroke="#000000" strokeWidth="10" strokeLinejoin="round" />
                  <polygon points="50,18 59,38 81,40 64,55 70,77 50,65 30,77 36,55 19,40 41,38" fill="#f59e0b" />
                </svg>
              ) : (
                <svg viewBox="0 0 100 100" className="w-8 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#000000" strokeWidth="16" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#d1d5db" strokeWidth="6" />
                  <polygon points="50,18 59,38 81,40 64,55 70,77 50,65 30,77 36,55 19,40 41,38" fill="none" stroke="#000000" strokeWidth="16" strokeLinejoin="round" />
                  <polygon points="50,18 59,38 81,40 64,55 70,77 50,65 30,77 36,55 19,40 41,38" fill="none" stroke="#d1d5db" strokeWidth="6" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#fafafa] text-[#09090b] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Luces de fondo estilo Google (sutiles y claras) */}
      <div className="absolute top-[-10%] left-[-10%] w-[350px] h-[350px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[350px] h-[350px] bg-red-500/5 rounded-full blur-[100px] pointer-events-none" />
      
      {/* Branding Superior */}
      <div className="flex items-center gap-2.5 mb-6 relative z-10">
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19.5 4H4.5C3.67 4 3 4.67 3 5.5V18.5C3 19.33 3.67 20 4.5 20H19.5C20.33 20 21 19.33 21 18.5V5.5C21 4.67 20.33 4 19.5 4Z" fill="#ffffff" stroke="#09090b" strokeWidth="1.5"/>
          <path d="M7 9C8.10457 9 9 8.10457 9 7C9 5.89543 8.10457 5 7 5C5.89543 5 5 5.89543 5 7C5 8.10457 5.89543 9 7 9Z" fill="#34A853"/>
          <path d="M17 19C18.1046 19 19 18.1046 19 17C19 15.8954 18.1046 15 17 15C15.8954 15 15 15.8954 15 17C15 18.1046 15.8954 19 17 19Z" fill="#ea4335"/>
          <path d="M17 9C18.1046 9 19 8.10457 19 7C19 5.89543 18.1046 5 17 5C15.8954 5 15 5.89543 15 7C15 8.10457 15.8954 9 17 9Z" fill="#4285F4"/>
          <path d="M7 19C8.10457 19 9 18.1046 9 17C9 15.8954 8.10457 15 7 15C5.89543 15 5 15.8954 5 17C5 18.1046 5.89543 19 7 19Z" fill="#FBBC05"/>
        </svg>
        <span className="text-base font-extrabold tracking-tight text-[#09090b]">Google Wallet</span>
        <span className="bg-[#f4f4f5] border border-[#e4e4e7] text-[9px] text-[#71717a] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">Simulación Dev</span>
      </div>
 
      {/* TARJETA GOOGLE WALLET (IGUALADA AL DISEÑO PREMIUM DE APPLE WALLET) */}
      <div className="w-full max-w-sm bg-white border border-[#e4e4e7] rounded-[24px] p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] relative flex flex-col group overflow-hidden">
        
        {/* Enlace Regresar al Portal */}
        <div className="text-left mb-5">
          <button 
            onClick={() => window.history.back()} 
            className="text-[#71717a] hover:text-[#09090b] text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            ← Regresar al Portal
          </button>
        </div>

        {/* Encabezado de la Tarjeta */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xs font-bold text-[#71717a] uppercase tracking-wider">{businessName}</h2>
            <p className="text-xs font-extrabold text-[#dc2626] mt-0.5">Club de Fidelización</p>
          </div>
          <span className="text-[10px] font-black text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] px-2.5 py-1 rounded-full uppercase tracking-wider">
            Pase VIP
          </span>
        </div>

        {/* Titular del Pase */}
        <div className="mb-4">
          <span className="text-[9px] text-[#a1a1aa] font-semibold uppercase tracking-widest block">Titular</span>
          <h1 className="text-2xl font-black text-[#09090b] tracking-tight mt-1 uppercase">{nombre}</h1>
          <span className="text-[10px] text-[#a1a1aa] font-mono mt-0.5 block">ID: {id.substring(0, 8)}</span>
        </div>

        {/* Grid de Sellos Estilo Apple / Tarjeta Premium */}
        {renderStars()}

        {/* Progreso en números */}
        <div className="text-center my-3">
          <span className="text-2xl font-black text-[#09090b] font-sans">{puntos}</span>
          <span className="text-sm text-[#71717a] font-bold"> / 10 sellos</span>
        </div>
 
        {/* QR Code Container */}
        <div className="flex justify-center my-4">
          <div className="bg-white border border-[#e4e4e7] rounded-2xl p-3 shadow-xs">
            {qrCodeUrl ? (
              <img 
                src={qrCodeUrl} 
                alt="Google Wallet QR Code" 
                className="w-[150px] h-[150px] select-none"
              />
            ) : (
              <div className="w-[150px] h-[150px] bg-[#fafafa] rounded-xl animate-pulse" />
            )}
          </div>
        </div>
 
        {/* Footnote con instrucciones del QR */}
        <p className="text-[10px] text-[#71717a] text-center leading-relaxed mt-4 px-2 font-medium">
          📸 Guarda esta página en tus favoritos o toma una captura de pantalla para acceder a tu pase VIP en cualquier momento.
        </p>
        <p className="text-center font-extrabold text-[#dc2626] text-[11px] uppercase tracking-wider mt-3">
          Muestra el QR en caja para acumular sellos.
        </p>

        {/* Google Footnote */}
        <div className="mt-5 flex justify-between items-center text-[9px] text-[#a1a1aa] font-semibold border-t border-[#f4f4f5] pt-3.5 relative z-10">
          <span>G-Wallet Digital Service</span>
          <span className="font-mono">Google LLC © 2026</span>
        </div>
      </div>
 
      {/* Botón de regreso / info */}
      <div className="mt-6 text-center max-w-xs relative z-10">
        <p className="text-[#a1a1aa] text-[10px] font-semibold leading-relaxed mb-4">
          💡 En producción, este pase se agrega directamente con un click a tu app nativa de <strong>Google Wallet</strong> en Android utilizando tus certificados autorizados de Google Cloud.
        </p>
        <button 
          onClick={() => window.close()} 
          className="bg-white border border-[#e4e4e7] text-[#52525b] hover:text-[#09090b] font-extrabold px-6 py-2.5 rounded-xl text-xs uppercase tracking-widest hover:border-zinc-300 hover:shadow-xs transition-all shadow-xs"
        >
          Cerrar Vista de Pase
        </button>
      </div>
    </main>
  )
}
 
export default function GoogleWalletSimulacion() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#fafafa] text-[#09090b] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#e4e4e7] border-t-[#dc2626] rounded-full animate-spin" />
      </div>
    }>
      <SimulationContent />
    </Suspense>
  )
}
