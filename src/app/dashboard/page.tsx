'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// Definición de tipos para typescript
interface Cliente {
  id: string
  nombre: string
  puntos: number
  telefono: string
  fecha_nacimiento: string | null
}

interface Historial {
  id: string
  created_at: string
  puntos_afectados: number
  tipo_movimiento: string
  descripcion: string
  // CORRECCIÓN 1: Cambiamos 'cliente' por 'clientes' (relación nativa de Supabase)
  clientes: { nombre: string } | null 
}

export default function PanelControl() {
  const [pestañaActiva, setPestañaActiva] = useState('clientes')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [historial, setHistorial] = useState<Historial[]>([])
  const [cargando, setCargando] = useState(true)

  async function fetchDatos() {
    setCargando(true)
    
    // Cargar Clientes
    const { data: dataClientes, error: errorClientes } = await supabase
      .from('clientes')
      .select('*')
      .order('id', { ascending: false })

    if (errorClientes) console.warn("Aviso cargando clientes:", errorClientes.message)
    else setClientes(dataClientes || [])

    // CORRECCIÓN 2: Quitamos el alias y usamos la tabla 'clientes' directamente
    const { data: dataHistorial, error: errorHistorial } = await supabase
      .from('historial_puntos')
      .select('*, clientes(nombre)')
      .order('created_at', { ascending: false })
      .limit(50)

    // CORRECCIÓN 3: Cambiamos .error por .warn para evitar la pantalla roja de Next.js
    if (errorHistorial) {
      console.warn("Aviso de auditoría (Supabase):", errorHistorial.message)
      setHistorial([])
    } else {
      setHistorial(dataHistorial || [])
    }

    setCargando(false)
  }

  useEffect(() => {
    fetchDatos()
  }, [])

  async function ajustarPuntos(id: string, nuevosPuntos: number) {
    if (nuevosPuntos < 0) return;

    const cliente = clientes.find(c => c.id === id);
    const puntosPrevios = cliente ? cliente.puntos : 0;
    const diferencia = nuevosPuntos - puntosPrevios;

    const { error } = await supabase
      .from('clientes')
      .update({ puntos: nuevosPuntos })
      .eq('id', id)

    if (!error) {
      await supabase.from('historial_puntos').insert([{
        cliente_id: id,
        puntos_afectados: Math.abs(diferencia),
        tipo_movimiento: diferencia > 0 ? 'suma' : 'resta',
        descripcion: diferencia > 0 ? 'Sello sumado desde panel' : 'Ajuste manual de administrador',
        sucursal_id: null,
        operador_id: null
      }]);

      setClientes(clientes.map(c => c.id === id ? { ...c, puntos: nuevosPuntos } : c))
      fetchDatos(); 
    } else {
      console.warn("No se pudieron actualizar los puntos:", error.message)
    }
  }

  async function eliminarCliente(id: string) {
    if (!confirm('¿Seguro que quieres eliminar este cliente VIP de la base de datos?')) return

    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', id)

    if (!error) {
      setClientes(clientes.filter(c => c.id !== id))
    }
  }

  const formatearFecha = (fechaStr: string | null) => {
    if (!fechaStr) return <span className="text-[#52525b] italic">---</span>;
    try {
      const [year, month, day] = fechaStr.split('-');
      return `${day}-${month}-${year}`;
    } catch (e) {
      return fechaStr;
    }
  }

  const formatearFechaHora = (fechaIso: string) => {
    return new Date(fechaIso).toLocaleString('es-MX', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  }

  const totalPuntosActivos = clientes.reduce((acc, cli) => acc + (cli.puntos || 0), 0)

  return (
    <main 
      className="min-h-screen bg-[#09090b] text-[#ffffff] p-4 sm:p-8 relative selection:bg-[#dc2626]"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0 flex items-center justify-center">
        <div className="absolute w-[350px] h-[350px] bg-[#ffffff] opacity-[0.12] blur-[80px] rounded-full"></div>
        <img 
          src="/logo.png" 
          alt="Watermark Logo" 
          className="relative w-[500px] h-[500px] object-contain opacity-[0.4] z-10" 
        />
      </div>

      <div className="max-w-6xl mx-auto z-10 relative">
        <header className="flex flex-col sm:flex-row justify-between items-center mb-6 border-b border-[#27272a] pb-6 gap-4">
          <div className="text-center sm:text-left">
            <h1 className="text-3xl font-black uppercase italic text-[#ffffff] tracking-tighter">
              Centro de <span className="text-[#dc2626] underline decoration-4 underline-offset-4">Comando</span>
            </h1>
            <p className="text-[#f59e0b] font-bold text-xs uppercase tracking-[0.3em] mt-2">
              Gestión SaaS Multi-Sucursal
            </p>
          </div>
          <a 
            href="/" 
            className="bg-[#27272a] hover:bg-[#ffffff] hover:text-[#000000] text-[#ffffff] border border-[#3f3f46] px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-2"
          >
            <span>Ver Panel Principal</span>
            <span className="text-sm">😎</span>
          </a>
        </header>

        <div className="flex flex-wrap gap-3 mb-8 justify-center sm:justify-start bg-[#18181b]/50 p-2 rounded-2xl border border-[#27272a] backdrop-blur-sm w-fit mx-auto sm:mx-0">
          <button 
            onClick={() => setPestañaActiva('metricas')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${pestañaActiva === 'metricas' ? 'bg-[#dc2626] text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-white'}`}
          >
            📊 Métricas
          </button>
          <button 
            onClick={() => setPestañaActiva('clientes')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${pestañaActiva === 'clientes' ? 'bg-[#dc2626] text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-white'}`}
          >
            👥 Clientes VIP
          </button>
          <button 
            onClick={() => setPestañaActiva('auditoria')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${pestañaActiva === 'auditoria' ? 'bg-[#dc2626] text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-white'}`}
          >
            🛡️ Auditoría
          </button>
        </div>

        {cargando ? (
          <div className="text-center py-20 font-bold text-[#f59e0b] animate-pulse uppercase tracking-widest text-sm">
            Cargando Base de Datos Segura...
          </div>
        ) : (
          <>
            {pestañaActiva === 'metricas' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#18181b]/90 backdrop-blur-md rounded-[25px] border border-[#27272a] p-8 text-center sm:text-left relative overflow-hidden group">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#f59e0b] to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                  <h3 className="text-[#a1a1aa] text-[10px] font-black uppercase tracking-[0.2em]">Total Clientes VIP</h3>
                  <p className="text-6xl font-black text-[#ffffff] mt-4 tracking-tighter">{clientes.length}</p>
                </div>
                <div className="bg-[#18181b]/90 backdrop-blur-md rounded-[25px] border border-[#27272a] p-8 text-center sm:text-left relative overflow-hidden group">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#dc2626] to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                  <h3 className="text-[#a1a1aa] text-[10px] font-black uppercase tracking-[0.2em]">Sellos Circulando</h3>
                  <p className="text-6xl font-black text-[#f59e0b] mt-4 tracking-tighter">{totalPuntosActivos}</p>
                </div>
                <div className="bg-[#18181b]/90 backdrop-blur-md rounded-[25px] border border-[#27272a] p-8 text-center sm:text-left relative overflow-hidden flex flex-col justify-center">
                  <h3 className="text-[#a1a1aa] text-[10px] font-black uppercase tracking-[0.2em] mb-4">Estado del Sistema</h3>
                  <div className="flex items-center justify-center sm:justify-start gap-3">
                    <div className="relative flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500"></span>
                    </div>
                    <span className="text-green-400 font-bold uppercase tracking-widest text-sm">Operativo y Seguro</span>
                  </div>
                </div>
              </div>
            )}

            {pestañaActiva === 'clientes' && (
              <div className="bg-[#18181b]/90 backdrop-blur-md rounded-[25px] shadow-[0_20px_40px_rgba(0,0,0,0.8)] border border-[#27272a] relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#dc2626] via-[#f59e0b] to-[#dc2626]"></div>
                <div className="overflow-x-auto p-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#000000]/60 border-b border-[#27272a]">
                        <th className="px-6 py-5 text-[10px] font-black uppercase text-[#a1a1aa] tracking-[0.2em] whitespace-nowrap">Cliente VIP</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase text-[#a1a1aa] tracking-[0.2em] whitespace-nowrap">Teléfono</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase text-[#a1a1aa] tracking-[0.2em] whitespace-nowrap">Cumpleaños</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase text-[#a1a1aa] tracking-[0.2em] text-center whitespace-nowrap">Sellos</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase text-[#a1a1aa] tracking-[0.2em] text-right whitespace-nowrap">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#27272a]/50">
                      {clientes.length > 0 ? (
                        clientes.map((cliente) => (
                          <tr key={cliente.id} className="hover:bg-[#27272a]/40 transition-colors group">
                            <td className="px-6 py-5 font-black text-[#ffffff] uppercase italic tracking-wide whitespace-nowrap">
                              {cliente.nombre}
                            </td>
                            <td className="px-6 py-5 text-[#a1a1aa] font-mono text-sm tracking-widest whitespace-nowrap">
                              {cliente.telefono || '---'}
                            </td>
                            <td className="px-6 py-5 font-mono text-xs tracking-widest font-bold text-[#f59e0b] whitespace-nowrap">
                              {formatearFecha(cliente.fecha_nacimiento)}
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap">
                              <div className="flex items-center justify-center gap-5">
                                <button 
                                  onClick={() => ajustarPuntos(cliente.id, cliente.puntos - 1)}
                                  className="w-10 h-10 rounded-full border border-[#3f3f46] bg-[#18181b] flex items-center justify-center hover:bg-[#3f3f46] hover:text-white transition-all font-black text-[#a1a1aa] active:scale-90"
                                >
                                  -
                                </button>
                                
                                <div className="flex flex-col items-center justify-center min-w-[50px]">
                                  <span className={`text-2xl font-black ${cliente.puntos >= 6 ? 'text-[#f59e0b] animate-pulse' : 'text-[#ffffff]'}`}>
                                    {cliente.puntos}
                                  </span>
                                  <span className="text-[8px] text-[#71717a] uppercase tracking-widest font-bold">Sellos</span>
                                </div>

                                <button 
                                  onClick={() => ajustarPuntos(cliente.id, cliente.puntos + 1)}
                                  className="w-10 h-10 rounded-full bg-gradient-to-r from-[#dc2626] to-[#991b1b] text-white flex items-center justify-center hover:from-[#ef4444] hover:to-[#dc2626] transition-all shadow-[0_0_15px_rgba(220,38,38,0.4)] font-black active:scale-90"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap">
                              <div className="flex items-center justify-end gap-3">
                                <Link href={`/cliente/${cliente.id}`}>
                                  <button className="bg-[#27272a] hover:bg-[#ffffff] hover:text-[#000000] text-[#ffffff] border border-[#3f3f46] px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95">
                                    Ver Tarjeta
                                  </button>
                                </Link>
                                <button 
                                  onClick={() => eliminarCliente(cliente.id)}
                                  className="text-[10px] font-black uppercase text-[#71717a] hover:text-[#dc2626] transition-colors bg-[#000000]/30 px-3 py-2 rounded-lg border border-transparent hover:border-[#dc2626]/30"
                                >
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-16 text-center">
                            <p className="text-[#71717a] text-sm uppercase tracking-widest font-bold">
                              No hay clientes registrados en la base de datos.
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {pestañaActiva === 'auditoria' && (
              <div className="bg-[#18181b]/90 backdrop-blur-md rounded-[25px] shadow-[0_20px_40px_rgba(0,0,0,0.8)] border border-[#27272a] relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#3f3f46]"></div>
                <div className="overflow-x-auto p-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#000000]/60 border-b border-[#27272a]">
                        <th className="px-6 py-5 text-[10px] font-black uppercase text-[#a1a1aa] tracking-[0.2em] whitespace-nowrap">Fecha y Hora</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase text-[#a1a1aa] tracking-[0.2em] whitespace-nowrap">Cliente</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase text-[#a1a1aa] tracking-[0.2em] whitespace-nowrap">Movimiento</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase text-[#a1a1aa] tracking-[0.2em] whitespace-nowrap">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#27272a]/50">
                      {historial.length > 0 ? (
                        historial.map((registro) => (
                          <tr key={registro.id} className="hover:bg-[#27272a]/40 transition-colors">
                            <td className="px-6 py-5 font-mono text-xs text-[#a1a1aa] tracking-widest whitespace-nowrap">
                              {formatearFechaHora(registro.created_at)}
                            </td>
                            {/* CORRECCIÓN 4: Leer desde 'clientes' y no 'cliente' */}
                            <td className="px-6 py-5 font-black text-[#ffffff] uppercase italic tracking-wide whitespace-nowrap">
                              {registro.clientes?.nombre || 'Cliente Borrado'}
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap">
                              <span className={`inline-flex items-center justify-center px-3 py-1 rounded-md text-xs font-black tracking-widest uppercase border ${
                                registro.tipo_movimiento === 'suma' 
                                ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                              }`}>
                                {registro.tipo_movimiento === 'suma' ? '+' : '-'}{registro.puntos_afectados}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-[#a1a1aa] text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                              {registro.descripcion}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-16 text-center">
                            <p className="text-[#71717a] text-sm uppercase tracking-widest font-bold">
                              No hay movimientos registrados en la auditoría.
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}