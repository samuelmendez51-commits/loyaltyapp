'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const [clienteId, setClienteId] = useState('')
  const [cliente, setCliente] = useState<any>(null)
  const [historial, setHistorial] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => { params.then(p => setClienteId(p.id)) }, [params])

  useEffect(() => {
    if (!clienteId) return
    cargarTodo()
  }, [clienteId])

  const cargarTodo = async () => {
    setCargando(true)
    const [cliRes, histRes, ordRes] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', clienteId).single(),
      supabase.from('historial_puntos').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(30),
      supabase.from('orders').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(30),
    ])
    if (cliRes.data) setCliente(cliRes.data)
    if (histRes.data) setHistorial(histRes.data)
    if (ordRes.data) setOrders(ordRes.data)
    setCargando(false)
  }

  // Métricas calculadas
  const totalPedidos = orders.length
  const ticketPromedio = totalPedidos > 0
    ? orders.reduce((s, o) => s + (o.total || 0), 0) / totalPedidos
    : 0
  const pedidosFalsos = orders.filter(o => o.sello_rechazado).length
  const tasaCancelacion = totalPedidos > 0 ? ((pedidosFalsos / totalPedidos) * 100).toFixed(1) : '0.0'

  // Frecuencia: días promedio entre pedidos aprobados
  const pedidosAprobados = orders.filter(o => o.sello_aprobado).sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  let frecuenciaPromedio = 0
  if (pedidosAprobados.length > 1) {
    const diffs = pedidosAprobados.slice(1).map((o, i) => {
      const prev = new Date(pedidosAprobados[i].created_at).getTime()
      const curr = new Date(o.created_at).getTime()
      return (curr - prev) / 86400000
    })
    frecuenciaPromedio = diffs.reduce((s, d) => s + d, 0) / diffs.length
  }

  if (cargando) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-zinc-800 border-t-red-600 rounded-full animate-spin" />
    </div>
  )

  if (!cliente) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white">
      <div className="text-center">
        <p className="text-4xl mb-4">👤</p>
        <h1 className="text-xl font-black">Cliente no encontrado</h1>
        <Link href="/dashboard" className="text-red-400 text-sm mt-4 block">← Volver</Link>
      </div>
    </div>
  )

  return (
    <main className="min-h-screen bg-[#050505] text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link href="/dashboard" className="text-xs text-zinc-500 hover:text-zinc-300 mb-4 block">← Volver al Dashboard</Link>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-red-800 to-red-950 rounded-2xl flex items-center justify-center">
              <span className="text-3xl">👤</span>
            </div>
            <div>
              <h1 className="text-2xl font-black">{cliente.nombre}</h1>
              <p className="text-zinc-400 font-mono">{cliente.telefono}</p>
              <p className="text-zinc-600 text-xs">Miembro desde {new Date(cliente.created_at).toLocaleDateString('es-MX')}</p>
            </div>
          </div>
        </div>

        {/* Sellos actuales */}
        <div className="bg-zinc-900/80 border border-zinc-700 rounded-2xl p-6">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-4">Progreso de Lealtad</p>
          <div className="flex items-center gap-4">
            <span className="text-5xl font-black text-amber-400">{cliente.puntos}</span>
            <div className="flex-1">
              <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all"
                  style={{ width: `${Math.min((cliente.puntos / 10) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1">{cliente.puntos}/10 sellos</p>
            </div>
          </div>
        </div>

        {/* KPIs calculados */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Pedidos', valor: totalPedidos, color: 'text-white' },
            { label: 'Ticket Promedio', valor: `$${ticketPromedio.toFixed(0)}`, color: 'text-amber-400' },
            { label: 'Frec. (días)', valor: frecuenciaPromedio > 0 ? frecuenciaPromedio.toFixed(1) : '—', color: 'text-blue-400' },
            { label: 'Tasa Cancelación', valor: `${tasaCancelacion}%`, color: pedidosFalsos > 0 ? 'text-red-400' : 'text-green-400' },
          ].map((kpi, i) => (
            <div key={i} className="bg-zinc-900/80 border border-zinc-700 rounded-2xl p-4">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">{kpi.label}</p>
              <p className={`text-2xl font-black ${kpi.color}`}>{kpi.valor}</p>
            </div>
          ))}
        </div>

        {/* Historial de pedidos */}
        <div className="bg-zinc-900/80 border border-zinc-700 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="text-sm font-black text-zinc-300 uppercase tracking-widest">Historial de Pedidos</h2>
          </div>
          <div className="divide-y divide-zinc-800">
            {orders.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-8">Sin pedidos registrados</p>
            ) : orders.map(order => (
              <div key={order.id} className="p-4 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${
                      order.sello_aprobado ? 'bg-green-500' :
                      order.sello_rechazado ? 'bg-red-500' : 'bg-amber-500'
                    }`} />
                    <span className="text-xs text-zinc-500 font-mono">
                      {new Date(order.created_at).toLocaleDateString('es-MX')}
                    </span>
                    <span className="text-xs text-zinc-600 uppercase">{order.tipo}</span>
                  </div>
                  <p className="text-sm font-bold text-white">
                    {(order.items as any[]).map((i: any) => i.nombre).join(', ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-amber-400 font-black">${(order.total || 0).toLocaleString()}</p>
                  <p className={`text-xs font-bold ${
                    order.sello_aprobado ? 'text-green-400' :
                    order.sello_rechazado ? 'text-red-400' : 'text-zinc-500'
                  }`}>
                    {order.sello_aprobado ? '✅ Sello' : order.sello_rechazado ? '❌ Rechazado' : '⏳ Pendiente'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
