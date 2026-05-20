'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'

export default function TarjetaLealtadFinal() {
  const { id } = useParams()
  const [cliente, setCliente] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  
  // Estados para saber si estamos generando el pase
  const [generandoGoogle, setGenerandoGoogle] = useState(false)
  const [generandoApple, setGenerandoApple] = useState(false)

  // Total de estampillas por defecto
  const sellosTotales = 10 

  useEffect(() => {
    const cargarDatos = async () => {
      const { data: clienteData, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', id)
        .maybeSingle() 

      if (clienteData) setCliente(clienteData)
      setCargando(false)
    }
    cargarDatos()
  }, [id])

  // ==========================================
  // MOTOR 1: GOOGLE WALLET
  // ==========================================
  const generarPaseGoogle = async () => {
    setGenerandoGoogle(true)
    try {
      const res = await fetch('/api/wallet/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: cliente.id })
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

  // ==========================================
  // MOTOR 2: APPLE WALLET
  // ==========================================
  const generarPaseApple = async () => {
    setGenerandoApple(true)
    try {
      const res = await fetch('/api/wallet/apple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: cliente.id, nombre: cliente.nombre, puntos: cliente.puntos })
      })

      const contentType = res.headers.get('Content-Type')
      
      // Si nos devuelve el archivo físico (.pkpass), forzamos la descarga
      if (contentType && contentType.includes('application/vnd.apple.pkpass')) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'LaBurreriaVIP.pkpass'
        a.click()
        window.URL.revokeObjectURL(url)
      } else {
        // Si no hay llaves aún, nos devuelve la simulación en texto
        const data = await res.json()
        if (data.simulacion) {
          alert(data.mensaje)
        } else {
          alert('Error al generar pase de Apple: ' + data.error)
        }
      }
    } catch (error) {
      console.error('Error Apple Wallet:', error)
      alert('Error de conexión con servidores de Apple.')
    } finally {
      setGenerandoApple(false)
    }
  }

  // PANTALLA DE CARGA
  if (cargando) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center font-sans text-amber-500 animate-pulse">
      Cargando acceso VIP...
    </div>
  )

  // PANTALLA DE ERROR (Cliente no encontrado)
  if (!cliente) return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center font-sans text-white p-4">
      <div className="w-full max-w-[360px] bg-gradient-to-b from-zinc-900 to-black rounded-[30px] border border-zinc-800 p-8 text-center shadow-2xl">
        <span className="text-red-500 text-6xl block mb-4">⚠️</span>
        <h1 className="text-2xl font-black italic tracking-tighter mb-2">CLIENTE NO ENCONTRADO</h1>
        <p className="text-zinc-400 text-sm">Este pase VIP ya no existe o fue eliminado de la base de datos.</p>
      </div>
    </div>
  )

  const sellosMarcados = cliente.puntos || 0

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 selection:bg-red-600">
      
      {/* CONTENEDOR MAESTRO */}
      <div className="w-full max-w-[360px] bg-gradient-to-b from-zinc-900 to-black rounded-[30px] shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden border border-zinc-800 relative">
        
        {/* Brillo decorativo superior */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-red-600"></div>

        {/* LOGO */}
        <div className="w-full pt-8 pb-4 flex justify-center drop-shadow-[0_5px_15px_rgba(239,68,68,0.15)]">
          <img 
            src="/logo.png" 
            alt="Logo La Burrería" 
            className="w-[100px] h-[100px] object-contain block" 
          />
        </div>

        {/* NOMBRE DEL USUARIO Y TÍTULO */}
        <div className="text-center px-6 mb-8">
          <p className="text-amber-500 text-[10px] font-black uppercase tracking-[0.3em] mb-1">
            CLUB VIP DE LA BURRERIA
          </p>
          <h1 className="text-white text-3xl font-black uppercase italic tracking-tighter truncate leading-tight">
            {cliente.nombre}
          </h1>
        </div>

        {/* SISTEMA DE SELLOS: Estética Ultra Premium */}
        <div className="p-6 bg-black/40 border-y border-zinc-800/50">
          <div className="grid grid-cols-5 gap-y-6 gap-x-2 place-items-center">
            {[...Array(sellosTotales)].map((_, i) => {
              const estaMarcado = i < sellosMarcados;
              return (
                <div key={i} className="relative flex justify-center items-center w-full">
                  {estaMarcado ? (
                    <div className="w-[45px] h-[45px] rounded-full bg-gradient-to-br from-[#FFD700] via-[#FDB931] to-[#B8860B] border-[3px] border-black flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.5)] transform hover:scale-110 transition-transform duration-300 z-10 relative">
                      <span className="text-black text-xl font-black drop-shadow-md">★</span>
                    </div>
                  ) : (
                    <div className="w-[40px] h-[40px] rounded-full bg-zinc-900/50 border-2 border-dashed border-zinc-700 flex items-center justify-center z-10 relative shadow-inner">
                      <span className="text-zinc-800 text-sm font-black">★</span>
                    </div>
                  )}
                  
                  {i % 5 !== 4 && (
                     <div className="absolute top-1/2 -right-3 w-4 h-[2px] bg-zinc-800/50 -translate-y-1/2 z-0 hidden sm:block"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* MENSAJE DE PROGRESO */}
        <div className="text-center mt-6 px-4">
          <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
            {sellosMarcados >= sellosTotales ? (
              <span className="text-amber-500 font-black animate-pulse">¡PREMIO DESBLOQUEADO! 🎁</span>
            ) : (
              <>FALTAN <span className="text-red-500 font-black mx-1">{sellosTotales - sellosMarcados}</span> SELLOS</>
            )}
          </p>
        </div>

        {/* CÓDIGO QR */}
        <div className="flex flex-col items-center py-6">
          <div className="p-3 bg-white rounded-2xl shadow-[0_0_20px_rgba(255,255,255,0.1)]">
            <QRCodeSVG value={cliente.id} size={140} level="H" fgColor="#000000" />
          </div>
          <p className="mt-3 text-[10px] text-zinc-600 font-mono tracking-widest">
            ID: {cliente.id.substring(0, 8).toUpperCase()}
          </p>
        </div>

        {/* BOTONES DE WALLET */}
        <div className="flex gap-3 px-6 pb-8">
          
          {/* BOTÓN APPLE WALLET DINÁMICO */}
          <button 
            onClick={generarPaseApple}
            disabled={generandoApple}
            className={`flex-1 h-12 bg-black border border-zinc-800 rounded-xl flex items-center justify-center transition-all shadow-[0_4px_10px_rgba(0,0,0,0.5)] ${
              generandoApple ? 'opacity-50 cursor-not-allowed' : 'active:scale-95 hover:bg-zinc-900'
            }`}
          >
            {generandoApple ? (
              <span className="text-[10px] font-black text-white uppercase tracking-widest animate-pulse">Generando...</span>
            ) : (
              <img src="https://upload.wikimedia.org/wikipedia/commons/b/b3/Add_to_Apple_Wallet_badge.svg" alt="Añadir a Apple Wallet" className="h-7" />
            )}
          </button>
          
          {/* BOTÓN GOOGLE WALLET DINÁMICO */}
          <button 
            onClick={generarPaseGoogle}
            disabled={generandoGoogle}
            className={`flex-1 h-12 bg-[#1a1a1a] border border-zinc-800 rounded-xl flex items-center justify-center transition-all shadow-[0_4px_10px_rgba(0,0,0,0.5)] ${
              generandoGoogle 
                ? 'opacity-50 cursor-not-allowed' 
                : 'active:scale-95 hover:bg-zinc-800'
            }`}
          >
            {generandoGoogle ? (
              <span className="text-[10px] font-black text-white uppercase tracking-widest animate-pulse">Generando...</span>
            ) : (
              <img src="https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg" alt="Añadir a Google Wallet" className="h-5" />
            )}
          </button>

        </div>
      </div>
    </main>
  )
}