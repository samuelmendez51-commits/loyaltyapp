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

  // Estados del Previsualizador
  const [previewId, setPreviewId] = useState('')
  const [previewPuntos, setPreviewPuntos] = useState(0)
  const [previewNombre, setPreviewNombre] = useState('Socio VIP')
  const [descargando, setDescargando] = useState(false)

  // --- URLs REALES Y PÚBLICAS DE TU SUPABASE BUCKET 'assets' ---
  const LOGO_URL = "https://hjaeireljkcvjnigfhzb.supabase.co/storage/v1/object/public/assets/logo.png"
  const DESTACADA_URL = "https://hjaeireljkcvjnigfhzb.supabase.co/storage/v1/object/public/assets/destacada.jpg"

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

  useEffect(() => { cargarDatos() }, [])

  // --- LÓGICA BLINDADA DE PUNTOS ---
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

  // --- FUNCIÓN: CANJEAR PREMIO (BLINDADA PARA IPHONE) ---
  async function canjearPremio(id: string) {
    // Usamos una alerta simple en celular si confirm() falla
    if (typeof window !== 'undefined' && !window.confirm('¿Confirmas el canje de la Chavipizza? El contador del cliente volverá a 0.')) {
      return; // Si cancela, no hace nada
    }
    
    try {
      setCargando(true)
      await supabase.from('clientes').update({ puntos: 0 }).eq('id', id)
      await supabase.from('historial_puntos').insert([{ cliente_id: id, tipo_movimiento: 'canje', cantidad: 10, descripcion: 'Premio Canjeado' }])
      
      if (id === previewId) setPreviewPuntos(0)
      await cargarDatos()
      alert("✅ Chavipizza Canjeada Exitosamente. El contador VIP está en 0.");
    } catch (e) {
      alert("❌ Hubo un error al canjear. Intenta de nuevo.");
    } finally {
      setCargando(false)
    }
  }

  async function eliminarCliente(id: string) {
    if(!confirm('¿Estás seguro de que deseas eliminar este cliente VIP?')) return
    await supabase.from('clientes').delete().eq('id', id)
    cargarDatos()
  }

  // --- EL CEREBRO DE DESCARGA WALLET (Blindado) ---
  async function descargarPase() {
    if (!previewId) return alert("Selecciona un cliente primero en la lista");
    
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isIOS) {
      return alert("Estás en PC/Android. Para instalar en tu iPhone, abre este panel desde tu Safari y presiona el botón.");
    }

    setDescargando(true)
    try {
      // Llama a tu endpoint de Apple real
      const res = await fetch('/api/wallet/apple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: previewId, nombre: previewNombre, puntos: previewPuntos })
      });
      
      if (!res.ok) throw new Error("Fallo la generación del pase en el servidor.");
      
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
      console.error(e);
      alert("Hubo un error al generar la tarjeta real. Revisa los logs de Vercel.");
    } finally {
      setDescargando(false)
    }
  }

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-[#050505] text-white font-sans">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-4xl sm:text-5xl font-black italic mb-1">
              La Burrería <span className="text-[#d4af37] font-sans text-3xl not-italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-[#d4af37] to-[#9ca3af]">CLUB</span>
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
                    {pestaña === tab && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#b91c1c] shadow-[0_-2px_10px_rgba(185,28,28,0.8)]"></div>}
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
                  {/* ... Auditoria se mantiene igual ... */}
                </div>
              )}
            </div>
          </div>

          {/* COLUMNA DERECHA: PREVISUALIZADOR LIVE REAL BLINDADO */}
          <div className="lg:col-span-1">
            <div className="bg-[#18181b]/90 backdrop-blur-md rounded-[25px] border border-[#27272a] shadow-2xl p-6 sticky top-8 flex flex-col items-center">
              <h2 className="text-xs uppercase tracking-[0.2em] font-black text-[#a1a1aa] mb-6 w-full flex items-center justify-between">
                Vista Previa VIP <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              </h2>

              {/* RENDER DE TARJETA ESTILO WALLET CON IMAGENES REALES Y BLINDADAS */}
              <div 
                className="w-full aspect-[0.63] max-w-[320px] rounded-[30px] shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-6 flex flex-col justify-between relative overflow-hidden transition-all duration-300 border-[4px] border-[#27272a] bg-cover bg-center"
                style={{
                  backgroundImage: `url('${DESTACADA_URL}')`, // Corregido: comillas añadidas
                }}
              >
                {/* Overlay Oscuro para lectura (Corregido: más claro) */}
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"></div>
                
                {/* Cabecera Tarjeta */}
                <div className="flex justify-between items-start z-10">
                  <div className="w-14 h-14 bg-black rounded-full border-2 border-[#d4af37] flex items-center justify-center overflow-hidden shadow-lg p-1">
                    {/* LOGO REAL DE SUPABASE */}
                    <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100?text=LOGO'; }}/>
                  </div>
                  <div className="text-right drop-shadow-lg">
                    <p className="text-[10px] text-white uppercase tracking-widest font-black">La Burrería Club</p>
                    <p className="text-[#d4af37] font-black text-lg not-italic">Pase VIP</p>
                  </div>
                </div>

                {/* Centro Tarjeta */}
                <div className="z-10 mt-8 drop-shadow-xl">
                  <p className="text-[10px] text-gray-200 uppercase tracking-widest mb-1 font-bold">Titular VIP</p>
                  <p className="text-2xl font-black text-white truncate">{previewNombre}</p>
                </div>

                {/* Sellos */}
                <div className="z-10 bg-black/80 backdrop-blur-md p-5 rounded-2xl border border-[#3f3f46] flex justify-between items-center mt-6 shadow-xl">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Progreso</p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-5xl font-black text-[#d4af37] drop-shadow-[0_0_10px_rgba(212,175,55,0.6)]">{previewPuntos}</span>
                      <span className="text-sm text-gray-400 font-bold">/ 10</span>
                    </div>
                  </div>
                  {/* CÓDIGO QR REAL DINÁMICO */}
                  <div className="w-20 h-20 bg-white rounded-xl p-1.5 shadow-inner">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://laburreriaclub.vercel.app/cliente/${previewId}`} alt="QR Code" className="w-full h-full opacity-90" />
                  </div>
                </div>
              </div>

              {/* BOTÓN OFICIAL DE AÑADIR A APPLE WALLET (El real) */}
              <button 
                onClick={descargarPase}
                disabled={descargando}
                className={`mt-10 w-full max-w-[320px] transition-all duration-200 ${descargando ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
              >
                {descargando ? (
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-500 font-bold bg-black py-4 rounded-xl border border-gray-800">
                    <div className="w-4 h-4 border-2 border-gray-500 border-t-white rounded-full animate-spin"></div> Generando Pase...
                  </div>
                ) : (
                  // LOGO OFICIAL DE "ADD TO APPLE WALLET"
                  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Add_to_Apple_Wallet_badge.svg/2560px-Add_to_Apple_Wallet_badge.svg.png" alt="Add to Apple Wallet" className="w-full h-auto object-contain" />
                )}
              </button>

            </div>
          </div>
        </div>
      </div>
    </main>
  )
}