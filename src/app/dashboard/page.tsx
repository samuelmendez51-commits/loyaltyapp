'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Cliente {
  id: string
  nombre: string
  puntos: number
  telefono: string
  fecha_nacimiento: string | null
}

interface Historial {
  id: string
  cliente_id: string
  tipo_movimiento: string
  cantidad: number
  created_at: string
  clientes: { nombre: string }
}

export default function DashboardPro() {
  const [pestaña, setPestaña] = useState('clientes')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [historial, setHistorial] = useState<Historial[]>([])
  const [cargando, setCargando] = useState(true)

  async function cargarDatos() {
    setCargando(true)
    const { data: dataClientes } = await supabase.from('clientes').select('*').order('created_at', { ascending: false })
    if (dataClientes) setClientes(dataClientes)

    const { data: dataHistorial } = await supabase.from('historial_puntos').select('*, clientes(nombre)').order('created_at', { ascending: false }).limit(50)
    if (dataHistorial) setHistorial(dataHistorial as any)
    
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  async function ajustarPuntos(id: string, puntosActuales: number, cantidad: number) {
    const nuevosPuntos = puntosActuales + cantidad
    if (nuevosPuntos < 0) return
    await supabase.from('clientes').update({ puntos: nuevosPuntos }).eq('id', id)
    await supabase.from('historial_puntos').insert([{ cliente_id: id, tipo_movimiento: cantidad > 0 ? 'suma' : 'resta', cantidad: Math.abs(cantidad), descripcion: 'Ajuste manual' }])
    cargarDatos()
  }

  return (
    <main className="min-h-screen p-4 sm:p-8 sm:py-12">
      <div className="max-w-7xl mx-auto space-y-10 relative z-10">
        
        {/* HEADER: Elegancia pura */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-4xl sm:text-5xl font-black italic mb-1">
              La Burrería <span className="text-[#d4af37] font-sans text-3xl not-italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-[#d4af37] to-[#9ca3af]">CLUB</span>
            </h1>
            <p className="text-[#a1a1aa] font-sans text-xs uppercase tracking-[0.3em] font-bold">Panel Administrativo</p>
          </div>
          
          <Link href="/registro">
            <button className="w-full sm:w-auto bg-gradient-to-r from-[#dc2626] to-[#991b1b] text-white font-black uppercase tracking-widest py-3 px-6 rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:from-[#ef4444] hover:to-[#dc2626] active:scale-95 text-xs flex justify-center items-center gap-2 cursor-pointer border border-[#ef4444]/50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Nuevo VIP
            </button>
          </Link>
        </div>

        {/* MÉTRICAS (Estilo grandes corporativos) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-[#18181b]/90 backdrop-blur-md rounded-[25px] border border-[#27272a] shadow-[0_20px_40px_rgba(0,0,0,0.8)] p-8 flex flex-col justify-center items-center text-center">
            <div className="text-[#a1a1aa] font-sans text-xs uppercase tracking-widest font-bold mb-3">Socios Activos</div>
            <div className="text-6xl font-serif text-white">{clientes.length}</div>
          </div>
          <div className="bg-[#18181b]/90 backdrop-blur-md rounded-[25px] border border-[#27272a] shadow-[0_20px_40px_rgba(0,0,0,0.8)] p-8 flex flex-col justify-center items-center text-center border-t-4 border-t-[#b91c1c] relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#b91c1c] to-transparent"></div>
            <div className="text-[#a1a1aa] font-sans text-xs uppercase tracking-widest font-bold mb-3">Sellos Repartidos</div>
            <div className="text-6xl font-sans font-black text-[#b91c1c]">
              {clientes.reduce((acc, curr) => acc + curr.puntos, 0)}
            </div>
          </div>
          <div className="bg-[#18181b]/90 backdrop-blur-md rounded-[25px] border border-[#27272a] shadow-[0_20px_40px_rgba(0,0,0,0.8)] p-8 flex flex-col justify-center items-center text-center">
            <div className="text-[#a1a1aa] font-sans text-xs uppercase tracking-widest font-bold mb-3">Última Actividad</div>
            <div className="text-xl font-serif text-[#d4af37] mt-4">Hace unos minutos</div>
          </div>
        </div>

        {/* CONTENEDOR PRINCIPAL */}
        <div className="bg-[#18181b]/90 backdrop-blur-md rounded-[25px] border border-[#27272a] shadow-[0_20px_40px_rgba(0,0,0,0.8)] overflow-hidden">
          
          {/* NAVEGACIÓN PESTAÑAS (Toggle estilizado) */}
          <div className="flex border-b border-[#3f3f46] bg-black/40">
            {['clientes', 'auditoria'].map((tab) => (
              <button
                key={tab}
                onClick={() => setPestaña(tab)}
                className={`flex-1 py-5 px-4 font-sans font-bold uppercase tracking-widest text-[11px] transition-all relative ${
                  pestaña === tab ? 'text-white' : 'text-[#71717a] hover:text-[#a1a1aa]'
                }`}
              >
                {tab}
                {pestaña === tab && (
                  <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#b91c1c] shadow-[0_-2px_10px_rgba(185,28,28,0.8)]"></div>
                )}
              </button>
            ))}
          </div>
          
          {cargando ? (
            <div className="p-20 flex flex-col items-center justify-center gap-4">
              <div className="w-8 h-8 border-4 border-[#27272a] border-t-[#b91c1c] rounded-full animate-spin"></div>
              <p className="text-[#a1a1aa] font-sans font-bold uppercase tracking-widest text-xs">Sincronizando...</p>
            </div>
          ) : (
            <div className="p-0">
              {pestaña === 'clientes' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-sans">
                    <thead className="bg-[#0a0a0a] border-b border-[#3f3f46]">
                      <tr>
                        <th className="px-8 py-5 text-[#a1a1aa] text-[10px] uppercase tracking-widest font-black">Nombre / Identidad</th>
                        <th className="px-8 py-5 text-center text-[#a1a1aa] text-[10px] uppercase tracking-widest font-black">Contacto</th>
                        <th className="px-8 py-5 text-center text-[#a1a1aa] text-[10px] uppercase tracking-widest font-black">Estatus VIP</th>
                        <th className="px-8 py-5 text-right text-[#a1a1aa] text-[10px] uppercase tracking-widest font-black">Control</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#27272a]">
                      {clientes.map((cliente) => (
                        <tr key={cliente.id} className="hover:bg-black/20 transition-colors group">
                          <td className="px-8 py-5">
                            <div className="font-bold text-lg text-white group-hover:text-[#d4af37] transition-colors">{cliente.nombre}</div>
                            {cliente.fecha_nacimiento && <div className="text-xs text-[#71717a] mt-1 font-mono">Nac: {cliente.fecha_nacimiento}</div>}
                          </td>
                          <td className="px-8 py-5 text-center text-[#a1a1aa] font-mono text-sm">{cliente.telefono || '—'}</td>
                          <td className="px-8 py-5 text-center">
                            <span className="inline-flex items-center gap-1 bg-[#b91c1c]/10 text-[#b91c1c] px-4 py-1.5 rounded-full font-black text-sm border border-[#b91c1c]/20">
                              {cliente.puntos} <span className="text-lg">★</span>
                            </span>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex justify-end gap-3">
                              <button onClick={() => ajustarPuntos(cliente.id, cliente.puntos, -1)} className="w-10 h-10 rounded-xl bg-[#18181b] hover:bg-[#27272a] flex items-center justify-center transition-colors border border-[#3f3f46]">➖</button>
                              <button onClick={() => ajustarPuntos(cliente.id, cliente.puntos, 1)} className="w-10 h-10 rounded-xl bg-[#b91c1c]/10 text-[#b91c1c] hover:bg-[#b91c1c]/20 border border-[#b91c1c]/30 flex items-center justify-center transition-colors">➕</button>
                              {/* RUTA CORREGIDA: Apunta directo a /cliente/[id] */}
                              <Link href={`/cliente/${cliente.id}`}>
                                <button className="h-10 px-4 rounded-xl bg-[#d4af37]/10 text-[#d4af37] hover:bg-[#d4af37]/20 border border-[#d4af37]/30 flex items-center justify-center transition-colors font-bold text-xs uppercase tracking-wider shadow-[0_0_10px_rgba(212,175,55,0.1)]">
                                  Ver Tarjeta
                                </button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {pestaña === 'auditoria' && (
                <div className="p-8 space-y-4">
                  {historial.length === 0 ? <p className="text-center text-[#71717a] font-sans py-10">Historial limpio.</p> : null}
                  {historial.map((mov) => (
                    <div key={mov.id} className="flex justify-between items-center bg-[#000000]/50 p-5 rounded-2xl border border-[#27272a] hover:border-[#3f3f46] transition-colors font-sans">
                      <div>
                        <p className="text-white font-bold text-base">{mov.clientes?.nombre}</p>
                        <p className="text-[#a1a1aa] text-xs mt-1 font-mono">{new Date(mov.created_at).toLocaleString()}</p>
                      </div>
                      <div className={`font-black text-lg px-4 py-2 rounded-xl border flex items-center justify-center min-w-[60px] ${mov.tipo_movimiento === 'suma' ? 'bg-[#b91c1c]/10 text-[#b91c1c] border-[#b91c1c]/30 shadow-[0_0_10px_rgba(185,28,28,0.2)]' : 'bg-[#27272a] text-[#a1a1aa] border-[#3f3f46]'}`}>
                        {mov.tipo_movimiento === 'suma' ? '+' : '-'}{mov.cantidad}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}