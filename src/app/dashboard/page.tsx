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
  const [previewPuntos, setPreviewPuntos] = useState(0)
  const [previewNombre, setPreviewNombre] = useState('Socio VIP')

  async function cargarDatos() {
    setCargando(true)
    const { data: dataClientes } = await supabase.from('clientes').select('*').order('created_at', { ascending: false })
    if (dataClientes) setClientes(dataClientes)

    const { data: dataHistorial } = await supabase.from('historial_puntos').select('*, clientes(nombre)').order('created_at', { ascending: false }).limit(50)
    if (dataHistorial) setHistorial(dataHistorial as any)
    setCargando(false)
  }

  useEffect(() => { cargarDatos() }, [])

  async function ajustarPuntos(id: string, puntosActuales: number, cantidad: number) {
    const nuevosPuntos = puntosActuales + cantidad
    if (nuevosPuntos < 0) return
    await supabase.from('clientes').update({ puntos: nuevosPuntos }).eq('id', id)
    await supabase.from('historial_puntos').insert([{ cliente_id: id, tipo_movimiento: cantidad > 0 ? 'suma' : 'resta', cantidad: Math.abs(cantidad), descripcion: 'Ajuste manual' }])
    cargarDatos()
  }

  async function eliminarCliente(id: string) {
    if(!confirm('¿Estás seguro de que deseas eliminar este cliente VIP?')) return
    await supabase.from('clientes').delete().eq('id', id)
    cargarDatos()
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

        {/* ESTRUCTURA DE 2 COLUMNAS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUMNA IZQUIERDA: GESTIÓN (Toma 2 espacios) */}
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
                            <tr key={cliente.id} className="hover:bg-white/5 transition-colors group cursor-pointer" onMouseEnter={() => { setPreviewNombre(cliente.nombre); setPreviewPuntos(cliente.puntos); }}>
                              <td className="px-6 py-4">
                                <div className="font-bold text-white group-hover:text-[#d4af37] transition-colors">{cliente.nombre}</div>
                                <div className="text-xs text-[#71717a] font-mono">{cliente.telefono || 'Sin teléfono'}</div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="inline-flex items-center gap-1 bg-[#b91c1c]/10 text-[#b91c1c] px-3 py-1 rounded-full font-black text-sm border border-[#b91c1c]/20">
                                  {cliente.puntos} ★
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => ajustarPuntos(cliente.id, cliente.puntos, -1)} className="w-8 h-8 rounded-lg bg-[#18181b] border border-[#3f3f46] hover:bg-gray-800 transition-colors">➖</button>
                                  <button onClick={() => ajustarPuntos(cliente.id, cliente.puntos, 1)} className="w-8 h-8 rounded-lg bg-[#b91c1c]/10 border border-[#b91c1c]/30 text-[#b91c1c] hover:bg-[#b91c1c]/20 transition-colors">➕</button>
                                  <button onClick={() => eliminarCliente(cliente.id)} className="w-8 h-8 rounded-lg bg-red-900/20 text-red-500 hover:bg-red-500 hover:text-white transition-colors border border-red-900/50">🗑️</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {/* ... (La pestaña de auditoria se mantiene igual internamente) ... */}
                </div>
              )}
            </div>
          </div>

          {/* COLUMNA DERECHA: PREVISUALIZADOR LIVE (Sticky para que siempre se vea) */}
          <div className="lg:col-span-1">
            <div className="bg-[#18181b]/90 backdrop-blur-md rounded-[25px] border border-[#27272a] shadow-2xl p-6 sticky top-8">
              <h2 className="text-xs uppercase tracking-[0.2em] font-black text-[#a1a1aa] mb-6 flex items-center justify-between">
                Live Preview <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              </h2>
              
              {/* SLIDER INTERACTIVO */}
              <div className="mb-8 bg-black/50 p-4 rounded-xl border border-[#3f3f46]">
                <label className="text-[10px] uppercase text-[#71717a] font-bold flex justify-between mb-2">
                  <span>Simulador de Sellos</span>
                  <span className="text-[#d4af37]">{previewPuntos}/10</span>
                </label>
                <input type="range" min="0" max="10" value={previewPuntos} onChange={(e) => setPreviewPuntos(parseInt(e.target.value))} className="w-full h-2 bg-black rounded-lg appearance-none cursor-pointer accent-[#b91c1c]" />
              </div>

              {/* RENDER DE TARJETA ESTILO WALLET */}
              <div className="w-full aspect-[0.63] max-h-[500px] bg-gradient-to-b from-[#111] to-[#000] rounded-3xl border border-[#333] shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-6 flex flex-col justify-between relative overflow-hidden transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37] opacity-10 blur-[50px] rounded-full"></div>
                
                {/* Cabecera Tarjeta */}
                <div className="flex justify-between items-start z-10">
                  <div className="w-12 h-12 bg-black rounded-full border border-[#3f3f46] flex items-center justify-center overflow-hidden">
                    <span className="text-[8px] text-gray-500">LOGO</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">La Burrería Club</p>
                    <p className="text-[#d4af37] font-black text-sm">Pase VIP</p>
                  </div>
                </div>

                {/* Centro Tarjeta */}
                <div className="z-10 mt-8">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Titular</p>
                  <p className="text-xl font-bold text-white truncate">{previewNombre}</p>
                </div>

                {/* Sellos */}
                <div className="z-10 bg-[#18181b]/80 p-4 rounded-2xl border border-[#27272a] flex justify-between items-center mt-6">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Progreso</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-[#b91c1c]">{previewPuntos}</span>
                      <span className="text-xs text-gray-400">/ 10</span>
                    </div>
                  </div>
                  <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center p-1">
                    <div className="w-full h-full bg-black flex items-center justify-center"><span className="text-[8px]">QR MOCK</span></div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </main>
  )
}