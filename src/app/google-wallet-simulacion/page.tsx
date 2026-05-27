'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function GoogleWalletSimulacion() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') || 'demo-client'
  const nombre = searchParams.get('nombre') || 'Socio VIP'
  const puntos = Number(searchParams.get('puntos') || 0)
  const businessName = searchParams.get('business_name') || 'LoyaltyApp'
  const businessLogo = searchParams.get('business_logo') || '⭐'

  const [qrCodeUrl, setQrCodeUrl] = useState('')

  useEffect(() => {
    // Generar un código QR de alta resolución con la API de GoQR
    const targetUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/cliente/${id}`
    setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}&color=ffffff&bgcolor=131314`)
  }, [id])

  const starsHtml = Array.from({ length: 10 }).map((_, idx) => idx < puntos)

  return (
    <main className="min-h-screen bg-[#0c0c0d] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Luces de fondo estilo Google */}
      <div className="absolute top-[-10%] left-[-10%] w-[350px] h-[350px] bg-blue-900/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[350px] h-[350px] bg-red-900/10 rounded-full blur-[100px] pointer-events-none" />
      
      {/* Branding Superior */}
      <div className="flex items-center gap-2 mb-8 relative z-10">
        <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19.5 4H4.5C3.67 4 3 4.67 3 5.5V18.5C3 19.33 3.67 20 4.5 20H19.5C20.33 20 21 19.33 21 18.5V5.5C21 4.67 20.33 4 19.5 4Z" fill="#131314" stroke="#e3e3e3" strokeWidth="1.5"/>
          <path d="M7 9C8.10457 9 9 8.10457 9 7C9 5.89543 8.10457 5 7 5C5.89543 5 5 5.89543 5 7C5 8.10457 5.89543 9 7 9Z" fill="#34A853"/>
          <path d="M17 19C18.1046 19 19 18.1046 19 17C19 15.8954 18.1046 15 17 15C15.8954 15 15 15.8954 15 17C15 18.1046 15.8954 19 17 19Z" fill="#ea4335"/>
          <path d="M17 9C18.1046 9 19 8.10457 19 7C19 5.89543 18.1046 5 17 5C15.8954 5 15 5.89543 15 7C15 8.10457 15.8954 9 17 9Z" fill="#4285F4"/>
          <path d="M7 19C8.10457 19 9 18.1046 9 17C9 15.8954 8.10457 15 7 15C5.89543 15 5 15.8954 5 17C5 18.1046 5.89543 19 7 19Z" fill="#FBBC05"/>
        </svg>
        <span className="text-xl font-bold tracking-tight text-white">Google Wallet</span>
        <span className="bg-zinc-800 text-[10px] text-zinc-400 font-bold px-2 py-0.5 rounded-full border border-zinc-700 uppercase">Simulación Dev</span>
      </div>

      {/* TARJETA GOOGLE WALLET */}
      <div className="w-full max-w-sm bg-[#131314] border border-zinc-800 rounded-[24px] p-6 shadow-2xl relative flex flex-col group overflow-hidden">
        {/* Glow sutil */}
        <div className="absolute -inset-px bg-gradient-to-r from-blue-500/20 via-red-500/10 to-yellow-500/20 rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

        {/* Card Header */}
        <div className="flex justify-between items-center mb-8 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-800 border border-zinc-700 rounded-xl flex items-center justify-center text-xl shadow-[0_0_15px_rgba(255,255,255,0.05)] overflow-hidden">
              {businessLogo.startsWith('http') || businessLogo.startsWith('/') || businessLogo.startsWith('data:') ? (
                <img src={businessLogo} alt="" className="w-full h-full object-cover" />
              ) : (
                businessLogo
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">{businessName}</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Tarjeta de Lealtad</p>
            </div>
          </div>
          <span className="text-xs bg-amber-950/40 border border-amber-900/60 text-amber-400 font-black px-3 py-1 rounded-full uppercase tracking-wider">
            Socio VIP
          </span>
        </div>

        {/* Client details */}
        <div className="mb-6 relative z-10">
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-0.5">Titular del Pase</span>
          <h1 className="text-2xl font-black text-white tracking-wide">{nombre}</h1>
          <span className="text-[10px] text-zinc-600 font-mono">ID: {id.substring(0, 8)}</span>
        </div>

        {/* Stamps Accumulator */}
        <div className="bg-[#1e1e20] border border-zinc-800 rounded-2xl p-4 mb-6 relative z-10">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] text-zinc-500 uppercase font-black">Sellos Acumulados</span>
            <span className="text-2xl font-black text-amber-400 font-mono">{puntos} <span className="text-xs text-zinc-600">/ 10</span></span>
          </div>

          <div className="flex flex-wrap gap-2 justify-center py-2 bg-black/40 rounded-xl border border-zinc-850">
            {starsHtml.map((filled, idx) => (
              <span key={idx} className="transition-transform duration-300 hover:scale-125">
                {filled ? (
                  <svg viewBox="0 0 24 24" className="w-6 h-6 text-amber-500 fill-current filter drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="w-6 h-6 text-zinc-700 fill-current">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" stroke="#3f3f46" strokeWidth="1.5" />
                  </svg>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* QR Code */}
        <div className="bg-[#131314] border border-zinc-800 rounded-2xl p-4 flex flex-col items-center justify-center relative z-10">
          {qrCodeUrl ? (
            <img 
              src={qrCodeUrl} 
              alt="Google Wallet QR Code" 
              className="w-48 h-48 rounded-xl border-4 border-zinc-900 shadow-inner filter contrast-125 select-none"
            />
          ) : (
            <div className="w-48 h-48 bg-zinc-900 rounded-xl animate-pulse" />
          )}
          <p className="text-[10px] text-zinc-500 font-mono mt-3 uppercase tracking-widest">Escanea en Mostrador para Sello</p>
        </div>

        {/* Google Footnote */}
        <div className="mt-6 flex justify-between items-center text-[10px] text-zinc-500 border-t border-zinc-850 pt-4 relative z-10">
          <span>G-Wallet Digital Service</span>
          <span className="font-mono">Google LLC © 2026</span>
        </div>
      </div>

      {/* Botón de regreso / info */}
      <div className="mt-8 text-center max-w-xs relative z-10">
        <p className="text-zinc-500 text-xs leading-relaxed mb-4">
          💡 En producción, este pase se agrega directamente con un click a tu app nativa de <strong>Google Wallet</strong> en Android utilizando tus certificados autorizados de Google Cloud.
        </p>
        <button 
          onClick={() => window.close()} 
          className="bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold px-6 py-2.5 rounded-xl text-xs uppercase tracking-widest hover:border-zinc-700 hover:text-white transition-all"
        >
          Cerrar Vista de Pase
        </button>
      </div>
    </main>
  )
}
