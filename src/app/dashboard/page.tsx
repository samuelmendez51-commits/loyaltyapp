'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Cliente {
  id: string; nombre: string; puntos: number; telefono: string; fecha_nacimiento: string | null;
}
interface Historial {
  id: string; cliente_id: string; tipo_movimiento: string; cantidad: number; created_at: string; clientes: { nombre: string };
}

export default function DashboardPro() {
  const [pestaña, setPestaña] = useState('clientes')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [historial, setHistorial] = useState<Historial[]>([])
  const [cargando, setCargando] = useState(true)

  const [previewId, setPreviewId] = useState('')
  const [previewPuntos, setPreviewPuntos] = useState(0)
  const [previewNombre, setPreviewNombre] = useState('Socio VIP')
  
  const [descargandoApple, setDescargandoApple] = useState(false)
  const [descargandoGoogle, setDescargandoGoogle] = useState(false)
  const [os, setOs] = useState('unknown')

  const LOGO_URL = "https://hjaeireljkcvjnigfhzb.supabase.co/storage/v1/object/public/assets/logo.png"
  const DESTACADA_URL = "https://hjaeireljkcvjnigfhzb.supabase.co/storage/v1/object/public/assets/destacada.jpg"

  useEffect(() => { 
    cargarDatos() 
    if (typeof navigator !== 'undefined') {
      if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) setOs('ios')
      else if (/Android/i.test(navigator.userAgent)) setOs('android')
      else setOs('desktop')
    }
  }, [])

  async function cargarDatos() {
    setCargando(true)
    const { data: dataClientes } = await supabase.from('clientes').select('*').order('created_at', { ascending: false })
    if (dataClientes) {
      setClientes(dataClientes)
      if (dataClientes.length > 0 && !previewId) {
        setPreviewId(dataClientes[0].id)
        setPreviewNombre(dataClientes[0].nombre)
        setPreviewPuntos(dataClientes[0].puntos)
      }
    }
    const { data: dataHistorial } = await supabase.from('historial_puntos').select('*, clientes(nombre)').order('created_at', { ascending: false }).limit(50)
    if (dataHistorial) setHistorial(dataHistorial as any)
    setCargando(false)
  }

  async function ajustarPuntos(id: string, puntosActuales: number, cantidad: number) {
    let nuevosPuntos = puntosActuales + cantidad
    if (nuevosPuntos < 0) nuevosPuntos = 0
    if (nuevosPuntos > 10) nuevosPuntos = 10 
    if (nuevosPuntos === puntosActuales) return 

    await supabase.from('clientes').update({ puntos: nuevosPuntos }).eq('id', id)
    await supabase.from('historial_puntos').insert([{ cliente_id: id, tipo_movimiento: cantidad > 0 ? 'suma' : 'resta', cantidad: Math.abs(cantidad), descripcion: 'Ajuste manual' }])
    
    if (id === previewId) setPreviewPuntos(nuevosPuntos)
    cargarDatos()
  }

  async function canjearPremio(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('¿Confirmas el canje del Premio VIP? El contador del cliente volverá a 0.')) return;
    try {
      setCargando(true)
      await supabase.from('clientes').update({ puntos: 0 }).eq('id', id)
      await supabase.from('historial_puntos').insert([{ cliente_id: id, tipo_movimiento: 'canje', cantidad: 10, descripcion: 'Premio Canjeado' }])
      if (id === previewId) setPreviewPuntos(0)
      await cargarDatos()
      alert("✅ Premio Canjeado Exitosamente.");
    } catch (e) {
      alert("❌ Hubo un error al canjear.");
    } finally {
      setCargando(false)
    }
  }

  async function eliminarCliente(id: string) {
    if(!confirm('¿Eliminar este cliente VIP definitivamente?')) return
    await supabase.from('clientes').delete().eq('id', id)
    cargarDatos()
  }

  async function descargarPaseApple() {
    if (!previewId) return alert("Selecciona un cliente");
    setDescargandoApple(true)
    try {
      const res = await fetch('/api/wallet/apple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: previewId, nombre: previewNombre, puntos: previewPuntos })
      });
      if (!res.ok) throw new Error("Fallo en servidor de Apple");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LaBurreriaVIP-${previewId.substring(0,8)}.pkpass`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      alert("Error al generar el pase de Apple. Revisa Vercel Logs.");
    } finally {
      setDescargandoApple(false)
    }
  }

  async function descargarPaseGoogle() {
    if (!previewId) return alert("Selecciona un cliente");
    setDescargandoGoogle(true);
    try {
      const res = await fetch('/api/wallet/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: previewId, nombre: previewNombre, puntos: previewPuntos })
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error(data.error || "Fallo en la URL de Google");
      }
    } catch (e) {
      console.error(e);
      alert("Error al generar el pase de Google Wallet.");
    } finally {
      setDescargandoGoogle(false);
    }
  }

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-[#050505] text-white font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-4xl sm:text-5xl font-black italic mb-1">
              La Burrería <span className="font-sans text-3xl not-italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-[#d4af37] to-[#9ca3af]">CLUB</span>
            </h1>
            <p className="text-[#a1a1aa] text-xs uppercase tracking-[0.3em] font-bold">Panel Administrativo</p>
          </div>
          <Link href="/registro">
            <button className="bg-gradient-to-r from-[#dc2626] to-[#991b1b] text-white font-black uppercase tracking-widest py-3 px-6 rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:scale-105 active:scale-95 text-xs flex items-center gap-2 border border-[#ef4444]/50">
              ➕ Nuevo VIP
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUMNA IZQUIERDA: GESTIÓN */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#18181b]/90 backdrop-blur-md rounded-[25px] border border-[#27272a] shadow-2xl overflow-hidden">
              <div className="flex border-b border-[#3f3f46] bg-black/40">
                {['clientes', 'auditoria'].map((tab) => (
                  <button key={tab} onClick={() => setPestaña(tab)} className={`flex-1 py-5 px-4 font-bold uppercase tracking-widest text-[11px] transition-all relative ${ pestaña === tab ? 'text-white' : 'text-[#71717a] hover:text-[#a1a1aa]'}`}>
                    {tab}
                    {pestaña === tab && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#b91c1c] shadow-[0_-2px_10px_rgba(185,28,28,0.8)]"></div>}
                  </button>
                ))}
              </div>
              
              {cargando ? (
                <div className="p-20 flex justify-center"><div className="w-8 h-8 border-4 border-[#27272a] border-t-[#b91c1c] rounded-full animate-spin"></div></div>
              ) : (
                <div className="p-0">
                  {pestaña === 'clientes' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-[#0a0a0a] border-b border-[#3f3f46]">
                          <tr>
                            <th className="px-6 py-4 text-[#a1a1aa] text-[10px] uppercase tracking-widest font-black">Identidad</th>
                            <th className="px-6 py-4 text-center text-[#a1a1aa] text-[10px] uppercase tracking-widest font-black">Estatus VIP</th>
                            <th className="px-6 py-4 text-right text-[#a1a1aa] text-[10px] uppercase tracking-widest font-black">Control</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#27272a]">
                          {clientes.map((cliente) => (
                            <tr key={cliente.id} className="hover:bg-white/5 transition-colors group cursor-pointer" onMouseEnter={() => { setPreviewId(cliente.id); setPreviewNombre(cliente.nombre); setPreviewPuntos(cliente.puntos); }}>
                              <td className="px-6 py-4">
                                <div className="font-bold text-white group-hover:text-[#d4af37] transition-colors">{cliente.nombre}</div>
                                <div className="text-xs text-[#71717a] font-mono">{cliente.telefono || 'Sin teléfono'}</div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-black text-sm border ${cliente.puntos === 10 ? 'bg-[#d4af37]/20 text-[#d4af37] border-[#d4af37]/40 shadow-[0_0_10px_rgba(212,175,55,0.3)]' : 'bg-[#b91c1c]/10 text-[#b91c1c] border-[#b91c1c]/20'}`}>
                                  {cliente.puntos} ★
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex justify-end gap-2 items-center">
                                  {cliente.puntos === 10 ? (
                                    <button onClick={() => canjearPremio(cliente.id)} className="h-8 px-4 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold text-[10px] uppercase tracking-wider animate-pulse border border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.4)] transition-all">
                                      🎁 CANJEAR
                                    </button>
                                  ) : (
                                    <>
                                      <button onClick={() => ajustarPuntos(cliente.id, cliente.puntos, -1)} className="w-8 h-8 rounded-lg bg-[#18181b] border border-[#3f3f46] hover:bg-gray-800 transition-colors">➖</button>
                                      <button onClick={() => ajustarPuntos(cliente.id, cliente.puntos, 1)} className="w-8 h-8 rounded-lg bg-[#b91c1c]/10 border border-[#b91c1c]/30 text-[#b91c1c] hover:bg-[#b91c1c]/20 transition-colors">➕</button>
                                    </>
                                  )}
                                  <button onClick={() => eliminarCliente(cliente.id)} className="w-8 h-8 rounded-lg bg-red-900/20 text-red-500 hover:bg-red-500 hover:text-white transition-colors border border-red-900/50 ml-2">🗑️</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* COLUMNA DERECHA: PREVISUALIZADOR LIVE */}
          <div className="lg:col-span-1">
            <div className="bg-[#18181b]/90 backdrop-blur-md rounded-[25px] border border-[#27272a] shadow-2xl p-6 sticky top-8 flex flex-col items-center">
              <h2 className="text-xs uppercase tracking-[0.2em] font-black text-[#a1a1aa] mb-6 w-full flex items-center justify-between">
                Vista Previa VIP <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              </h2>

              <div 
                className="w-full aspect-[0.63] max-w-[320px] rounded-[30px] shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-6 flex flex-col justify-between relative overflow-hidden transition-all duration-300 border-4 border-[#27272a] bg-cover bg-center"
                style={{ backgroundImage: `url('${DESTACADA_URL}')` }}
              >
                <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"></div>
                
                <div className="flex justify-between items-start z-10">
                  <div className="w-14 h-14 bg-black rounded-full border-2 border-[#d4af37] flex items-center justify-center overflow-hidden shadow-lg p-1">
                    <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <div className="text-right drop-shadow-lg">
                    <p className="text-[10px] text-white uppercase tracking-widest font-black">La Burrería Club</p>
                    <p className="text-[#d4af37] font-black text-lg not-italic">Pase VIP</p>
                  </div>
                </div>

                <div className="z-10 mt-8 drop-shadow-xl">
                  <p className="text-[10px] text-gray-200 uppercase tracking-widest mb-1 font-bold">Titular VIP</p>
                  <p className="text-2xl font-black text-white truncate">{previewNombre}</p>
                </div>

                <div className="z-10 bg-black/80 backdrop-blur-md p-5 rounded-2xl border border-[#3f3f46] flex justify-between items-center mt-6 shadow-xl">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Progreso</p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-5xl font-black text-[#d4af37] drop-shadow-[0_0_10px_rgba(212,175,55,0.6)]">{previewPuntos}</span>
                      <span className="text-sm text-gray-400 font-bold">/ 10</span>
                    </div>
                  </div>
                  <div className="w-20 h-20 bg-white rounded-xl p-1.5 shadow-inner">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://loyaltyapp.vercel.app/cliente/${previewId}`} alt="QR Code" className="w-full h-full opacity-90" />
                  </div>
                </div>
              </div>

              {/* BOTONES INTELIGENTES */}
              <div className="mt-8 w-full max-w-[320px] space-y-4">
                
                {/* BOTÓN APPLE WALLET */}
                {(os === 'ios' || os === 'desktop') && (
                  <button 
                    onClick={descargarPaseApple}
                    disabled={descargandoApple}
                    className={`w-full bg-black text-white h-14 rounded-xl flex items-center justify-center gap-3 border border-gray-800 transition-all ${descargandoApple ? 'opacity-50' : 'hover:bg-gray-900 active:scale-95'}`}
                  >
                    {descargandoApple ? (
                      <span className="text-sm font-bold animate-pulse">Generando Pase...</span>
                    ) : (
                      <>
                        <svg viewBox="0 0 384 512" className="h-6 fill-white"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 24 184.8 8.8 243.6-26 381.1 57.1 484.8 91 484.8c18.5 0 28.5-11.8 51.5-11.8 23 0 32.7 11.8 52.1 11.8 35.5 0 54.3-37 72-68.5 15.6-27.7 21.6-47.2 22.3-48.4-1.2-.5-70.1-26.4-70.2-99.2zM242 84.8c20.8-25.8 34.7-60.1 31.2-94.8-28.5 1.1-64.1 18.6-85.3 43.4-18.8 22-35.5 57.6-31.5 90.9 31.7 2.4 66.7-13.8 85.6-39.5z"/></svg>
                        <div className="flex flex-col items-start leading-none">
                          <span className="text-[10px]">Añadir a</span>
                          <span className="text-[16px] font-semibold">Apple Wallet</span>
                        </div>
                      </>
                    )}
                  </button>
                )}

                {/* BOTÓN GOOGLE WALLET */}
                {(os === 'android' || os === 'desktop') && (
                  <button 
                    onClick={descargarPaseGoogle}
                    disabled={descargandoGoogle}
                    className={`w-full bg-[#1e1e1e] text-white h-14 rounded-xl flex items-center justify-center gap-3 border border-gray-700 transition-all ${descargandoGoogle ? 'opacity-50' : 'hover:bg-gray-800 active:scale-95'}`}
                  >
                    {descargandoGoogle ? (
                      <span className="text-sm font-bold animate-pulse text-gray-400">Firmando Pase...</span>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" className="h-6 w-6"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                        <div className="flex flex-col items-start leading-none text-gray-200">
                          <span className="text-[10px]">Añadir a</span>
                          <span className="text-[16px] font-semibold text-white">Google Wallet</span>
                        </div>
                      </>
                    )}
                  </button>
                )}
                
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}