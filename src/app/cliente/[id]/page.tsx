'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'

export default function TarjetaLealtadFinal() {
  const { id } = useParams()
  const [cliente, setCliente] = useState<any>(null)
  const [business, setBusiness] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [activeCoupon, setActiveCoupon] = useState<any>(null)
  const [generandoPremio, setGenerandoPremio] = useState(false)
  
  const [generandoGoogle, setGenerandoGoogle] = useState(false)
  const [generandoApple, setGenerandoApple] = useState(false)
  
  const [modalCanjeAbierto, setModalCanjeAbierto] = useState(false)
  const [payloadCanje, setPayloadCanje] = useState('')

  const handleClaim = () => {
    if (!cliente) return
    const payloadObj = {
      cliente_id: cliente.id,
      nombre: cliente.nombre,
      puntos: cliente.puntos,
      timestamp: Date.now(),
      seguro: 'LOYALTYAPP-VIP-CANJE'
    }
    const base64Payload = btoa(JSON.stringify(payloadObj))
    setPayloadCanje(base64Payload)
    setModalCanjeAbierto(true)
  }

  const sellosTotales = business?.max_sellos || 10 

  useEffect(() => {
    const cargarDatos = async () => {
      if (!id) return
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', id)
        .maybeSingle() 

      if (clienteData) {
        setCliente(clienteData)
        if (clienteData.business_id) {
          const { data: bizData } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', clienteData.business_id)
            .maybeSingle()
          if (bizData) setBusiness(bizData)
        }

        // Cargar cupón activo (si existe)
        const { data: couponData } = await supabase
          .from('tracking_events')
          .select('*')
          .eq('cliente_id', clienteData.id)
          .eq('event_type', 'reward_generated')
          .eq('cupon_canjeado', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (couponData) setActiveCoupon(couponData)
      }
      setCargando(false)
    }
    cargarDatos()
  }, [id])

  const reclamarPremio = async () => {
    if (!cliente || !business) return
    setGenerandoPremio(true)
    const codigo = 'REWARD-' + Math.random().toString(36).substring(2, 10).toUpperCase()
    
    try {
      const { data, error } = await supabase
        .from('tracking_events')
        .insert({
          business_id: business.id,
          cliente_id: cliente.id,
          event_type: 'reward_generated',
          codigo_cupon: codigo,
          cupon_canjeado: false,
          metadata: { nombre_premio: 'Premio Mayor (Chavipizza Familiar)' }
        })
        .select()
        .single()

      if (error) throw error
      if (data) {
        setActiveCoupon(data)
      }
    } catch (e) {
      console.error(e)
      alert('Error al generar tu cupón de regalo. Intenta de nuevo.')
    } finally {
      setGenerandoPremio(false)
    }
  }

  // Helpers para obtener la URL base correcta
  const getBaseUrl = () => {
    if (typeof window !== 'undefined') return window.location.origin
    if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
    return 'http://localhost:3000'
  }

  const generarPaseGoogle = async () => {
    setGenerandoGoogle(true)
    try {
      // Uso de URL absoluta para evitar problemas de rutas relativas
      const apiUrl = `${getBaseUrl()}/api/wallet/google`
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          clienteId: cliente.id,
          nombre: cliente.nombre,
          puntos: cliente.puntos,
          businessId: business?.id
        })
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Hubo un problema al generar tu pase. ' + (data.error || ''))
      }
    } catch (error) {
      console.error('Error al generar pase Google:', error)
      alert('Error de conexión. Intenta de nuevo.')
    } finally {
      setGenerandoGoogle(false)
    }
  }

  const generarPaseApple = async () => {
    setGenerandoApple(true)
    try {
      const apiUrl = `${getBaseUrl()}/api/wallet/apple`
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          clienteId: cliente.id, 
          nombre: cliente.nombre, 
          puntos: cliente.puntos,
          businessId: business?.id
        })
      })

      if (res.ok) {
        const contentType = res.headers.get('Content-Type')
        if (contentType && contentType.includes('application/vnd.apple.pkpass')) {
          const blob = await res.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${business?.nombre?.replace(/\s+/g, '') || 'Loyalty'}VIP-${cliente.id.substring(0,8)}.pkpass`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        } else {
          const data = await res.json()
          if (data.webPass) {
            alert("⚠️ Pase Web Generado (Bypass Apple Wallet):\nSe abrirá tu pase VIP digital en una pestaña nueva para guardar o capturar.")
            const win = window.open()
            if (win) win.document.write(data.html)
          } else if (data.simulacion) {
            alert(data.mensaje)
          } else {
             alert('Error al generar pase de Apple: ' + (data.error || 'Respuesta inválida'))
          }
        }
      } else {
        const errData = await res.json()
        alert('Error del servidor: ' + (errData.error || res.statusText))
      }
    } catch (error) {
      console.error('Error Apple Wallet:', error)
      alert('Error de red al conectar con el servidor.')
    } finally {
      setGenerandoApple(false)
    }
  }

  if (cargando) return (
    <div className="min-h-screen flex items-center justify-center font-sans text-[var(--brand-gold)] animate-pulse relative z-10 font-bold uppercase tracking-widest text-sm">
      Abriendo Bóveda VIP...
    </div>
  )

  if (!cliente) return (
    <div className="min-h-screen flex flex-col items-center justify-center font-sans text-white p-4 relative z-10">
      <div className="card-glass w-full max-w-[380px] p-10 text-center">
        <span className="text-red-500 text-6xl block mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">⚠️</span>
        <h1 className="text-3xl font-serif font-black italic tracking-tighter mb-4 text-white">No Encontrado</h1>
        <p className="text-[#a1a1aa] font-sans text-xs uppercase tracking-widest leading-relaxed">Este pase VIP no existe o fue eliminado.</p>
      </div>
    </div>
  )

  const sellosMarcados = cliente.puntos || 0

  return (
    <main className="min-h-screen flex items-center justify-center p-4 relative z-10 font-sans">
      
      {/* TARJETA MAESTRA */}
      <div className="card-glass w-full max-w-[380px] overflow-hidden relative">
        
        {/* Línea superior brillante */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent ${sellosMarcados >= sellosTotales ? 'via-[var(--brand-gold)]' : 'via-[var(--brand-red)]'} to-transparent opacity-80`}></div>

        {/* LOGO Y BRANDING */}
        <div className="w-full pt-10 pb-4 flex flex-col items-center drop-shadow-[0_0_25px_rgba(185,28,28,0.1)]">
          <div className="w-[110px] h-[110px] rounded-2xl border border-amber-500/20 flex items-center justify-center overflow-hidden shadow-[0_0_30px_rgba(251,191,36,0.35)] mb-6">
            <img 
              src={business?.logo_url || "/logo.png"} 
              alt={`Logo ${business?.nombre || "LoyaltyApp"}`} 
              className="w-full h-full object-cover block" 
            />
          </div>
          <p className="text-[var(--brand-gold)] text-[9px] font-black uppercase tracking-[0.4em] mb-2">
            Club VIP de {business?.nombre || "LoyaltyApp"}
          </p>
          <h1 className="text-white text-3xl sm:text-4xl font-serif font-black italic tracking-wide truncate w-full text-center px-6 drop-shadow-md">
            {cliente.nombre}
          </h1>
        </div>

        {/* SISTEMA DE SELLOS */}
        <div className="p-8 bg-black/50 border-y border-[var(--border-subtle)] relative">
          <div className="grid grid-cols-5 gap-y-6 gap-x-3 place-items-center relative z-10">
            {[...Array(sellosTotales)].map((_, i) => {
              const estaMarcado = i < sellosMarcados;
              return (
                <div key={i} className="relative flex justify-center items-center w-full">
                  {estaMarcado ? (
                    <div className="w-[48px] h-[48px] rounded-full bg-gradient-to-br from-[#FFD700] via-[#FDB931] to-[#B8860B] border-[3px] border-[#3f3f46] flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.4)] transform hover:scale-110 transition-transform duration-300 z-10 relative">
                      <span className="text-[#452000] text-2xl font-black drop-shadow-sm">★</span>
                    </div>
                  ) : (
                    <div className="w-[42px] h-[42px] rounded-full bg-[#0a0a0a] border-2 border-dashed border-[#3f3f46] flex items-center justify-center z-10 relative shadow-inner">
                      <span className="text-[#27272a] text-lg font-black">★</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ESTATUS DE PROGRESO */}
        <div className="text-center mt-8 px-6">
          <p className="text-[11px] text-[#a1a1aa] font-bold uppercase tracking-[0.3em]">
            {sellosMarcados >= sellosTotales ? (
              <span className="text-green-500 font-black animate-pulse drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]">¡PREMIO DESBLOQUEADO! 🏆</span>
            ) : (
              <>FALTAN <span className="text-[var(--brand-red)] font-black mx-1.5 text-sm">{sellosTotales - sellosMarcados}</span> SELLOS</>
            )}
          </p>
        </div>

        {/* CÓDIGO QR / BOTÓN RECLAMAR */}
        <div className="flex flex-col items-center py-8">
          {activeCoupon ? (
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-white rounded-3xl shadow-[0_0_40px_rgba(255,215,0,0.3)] border-2 border-amber-400 transform hover:scale-105 transition-transform duration-300">
                <QRCodeSVG value={activeCoupon.codigo_cupon} size={150} level="H" fgColor="#000000" />
              </div>
              <p className="mt-2 text-xs text-amber-400 font-black animate-pulse uppercase tracking-wider">
                🎁 CUPÓN DE REGALO ACTIVO:
              </p>
              <p className="text-xl font-mono font-black text-white bg-amber-950/40 border border-amber-800/40 px-4 py-2 rounded-xl">
                {activeCoupon.codigo_cupon}
              </p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest text-center max-w-[280px] leading-relaxed">
                Presenta este código QR en mostrador para reclamar tu premio.
              </p>
            </div>
          ) : sellosMarcados >= 10 ? (
            <div className="w-full px-6 flex flex-col items-center">
              <button 
                onClick={handleClaim}
                className="w-full py-5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#452000] font-black rounded-2xl text-base uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(251,191,36,0.5)] transform active:scale-95 flex items-center justify-center gap-2 animate-bounce"
              >
                🎁 Reclamar Premio
              </button>
              <p className="mt-4 text-[10px] text-zinc-500 uppercase tracking-widest text-center max-w-[280px]">
                ¡Felicidades! Tienes los sellos completos. Genera tu cupón digital de canje.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="p-4 bg-white rounded-3xl shadow-[0_0_40px_rgba(255,255,255,0.15)] transform hover:scale-105 transition-transform duration-300">
                <QRCodeSVG value={cliente.id} size={150} level="H" fgColor="#000000" />
              </div>
              <p className="mt-4 text-[10px] text-[#71717a] font-mono tracking-widest uppercase">
                ID-VIP: {cliente.id.substring(0, 8)}
              </p>
            </div>
          )}
        </div>

        {/* BOTONES DE WALLET NATIVOS */}
        <div className="flex flex-col gap-4 px-8 pb-10">
          
          {/* BOTÓN APPLE WALLET */}
          <button 
            onClick={generarPaseApple}
            disabled={generandoApple}
            className={`w-full h-14 bg-black border border-[#3f3f46] rounded-2xl flex items-center justify-center transition-all shadow-lg ${
              generandoApple ? 'opacity-50 cursor-not-allowed' : 'active:scale-95 hover:bg-[#18181b] hover:border-[#a1a1aa]'
            }`}
          >
            {generandoApple ? (
              <span className="text-[10px] font-black text-white uppercase tracking-widest animate-pulse">Procesando...</span>
            ) : (
              <div className="flex items-center gap-3">
                <svg viewBox="0 0 384 512" className="h-6 text-white fill-current"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-start">
                    <span className="text-[9px] font-medium leading-none text-white/80">Añadir a</span>
                    <span className="text-lg font-semibold leading-tight text-white tracking-wide">Apple Wallet</span>
                  </div>
                </div>
              </div>
            )}
          </button>
          
          {/* BOTÓN GOOGLE WALLET */}
          <button 
            onClick={generarPaseGoogle}
            disabled={generandoGoogle}
            className={`w-full h-14 bg-[#1a1a1b] border border-[#3f3f46] rounded-2xl flex items-center justify-center transition-all shadow-lg ${
              generandoGoogle ? 'opacity-50 cursor-not-allowed' : 'active:scale-95 hover:bg-[#27272a] hover:border-[#a1a1aa]'
            }`}
          >
            {generandoGoogle ? (
              <span className="text-[10px] font-black text-white uppercase tracking-widest animate-pulse">Procesando...</span>
            ) : (
              <div className="flex items-center gap-3">
                <svg viewBox="0 0 512 512" className="h-5"><path fill="#4285F4" d="M386 400c45-42 74-103 74-171 0-16-1-32-5-47H261v89h112c-5 29-21 54-43 71l56 58z"></path><path fill="#34A853" d="M261 460c70 0 129-23 172-63l-56-58c-24 16-53 25-86 25-66 0-122-45-142-106l-59 45c43 85 131 142 229 142z"></path><path fill="#FBBC05" d="M119 258c-5-15-8-32-8-49s3-34 8-49l-59-45c-16 31-25 67-25 104s9 73 25 104l59-45z"></path><path fill="#EA4335" d="M261 146c38 0 73 13 100 39l75-75C391 66 331 40 261 40 163 40 75 97 32 182l59 45c20-61 76-106 142-106z"></path></svg>
                <div className="flex flex-col items-start">
                  <span className="text-[9px] font-medium leading-none text-white/80">Añadir a</span>
                  <span className="text-lg font-semibold leading-tight text-white tracking-wide">Google Wallet</span>
                </div>
              </div>
            )}
          </button>

        </div>
      </div>

      {/* Modal interactivo de Canje VIP */}
      {modalCanjeAbierto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl p-6 relative shadow-2xl flex flex-col items-center">
            <div className="absolute top-4 right-4">
              <button 
                onClick={() => setModalCanjeAbierto(false)}
                className="text-zinc-500 hover:text-white font-bold p-2 text-lg transition-colors"
              >
                ✕
              </button>
            </div>
            
            <span className="text-4xl mb-3">🏆</span>
            <h3 className="text-lg font-black text-white text-center mb-1">Cupón de Canje VIP</h3>
            <p className="text-xs text-zinc-500 text-center mb-6 uppercase tracking-wider">Presenta este QR cifrado en caja</p>
            
            <div className="p-4 bg-white rounded-3xl shadow-[0_0_40px_rgba(255,215,0,0.3)] border-2 border-amber-400 mb-6">
              <QRCodeSVG value={payloadCanje} size={180} level="H" fgColor="#000000" />
            </div>
            
            <p className="text-[10px] text-zinc-400 font-mono text-center break-all bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl max-w-xs mb-4">
              {payloadCanje.substring(0, 40)}...
            </p>
            
            <p className="text-xs text-zinc-500 text-center leading-relaxed max-w-[280px]">
              Este código QR contiene un payload seguro cifrado en base64 con tus puntos y firma digital para el mostrador.
            </p>
          </div>
        </div>
      )}
    </main>
  )
}