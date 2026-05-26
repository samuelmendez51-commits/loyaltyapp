'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Order {
  id: string
  nombre_cliente: string
  telefono_cliente: string
  calle: string
  numero: string
  colonia: string
  tipo: string
  items: any[]
  total: number
  sello_otorgado: boolean
  sello_aprobado: boolean
  sello_rechazado: boolean
  estado: string
  created_at: string
  clientes: { nombre: string; puntos: number } | null
}

export default function SellosPendientesPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [cargando, setCargando] = useState(true)
  const [aprobando, setAprobando] = useState<string | null>(null)

  const cargarPendientes = async () => {
    setCargando(true)
    const businessId = document.cookie.match(/session_business_id=([^;]+)/)?.[1]
    const branchId = document.cookie.match(/session_branch_id=([^;]+)/)?.[1]

    let query = supabase
      .from('orders')
      .select('*, clientes(nombre, puntos)')
      .eq('sello_otorgado', true)
      .eq('sello_aprobado', false)
      .eq('sello_rechazado', false)
      .order('created_at', { ascending: false })

    if (businessId) query = query.eq('business_id', businessId)
    if (branchId) query = query.eq('branch_id', branchId)

    const { data } = await query
    if (data) setOrders(data as any[])
    setCargando(false)
  }

  useEffect(() => { cargarPendientes() }, [])

  const aprobar = async (order: Order) => {
    setAprobando(order.id)
    const userId = document.cookie.match(/session_user_id=([^;]+)/)?.[1]

    await supabase.from('orders').update({
      sello_aprobado: true,
      estado: 'aprobado',
      aprobado_por: userId || null,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id)

    if (order.clientes && order.cliente_id) {
      await supabase.from('tracking_events').insert({
        business_id: document.cookie.match(/session_business_id=([^;]+)/)?.[1],
        cliente_id: order.cliente_id,
        order_id: order.id,
        event_type: 'approved_by_staff',
        metadata: { aprobado_por: userId, total: order.total },
      })
    }

    setAprobando(null)
    cargarPendientes()
  }

  const rechazar = async (order: Order) => {
    if (!confirm(`¿Marcar el pedido de ${order.nombre_cliente} como FALSO y quitar el sello?`)) return
    setAprobando(order.id)

    await supabase.from('orders').update({
      sello_rechazado: true,
      sello_aprobado: false,
      estado: 'rechazado',
      updated_at: new Date().toISOString(),
    }).eq('id', order.id)

    if (order.cliente_id) {
      const { data: cliente } = await supabase
        .from('clientes').select('puntos').eq('id', order.cliente_id).single()
      if (cliente && cliente.puntos > 0) {
        await supabase.from('clientes').update({ puntos: cliente.puntos - 1 }).eq('id', order.cliente_id)
      }
      await supabase.from('tracking_events').insert({
        business_id: document.cookie.match(/session_business_id=([^;]+)/)?.[1],
        cliente_id: order.cliente_id,
        order_id: order.id,
        event_type: 'rejected_fraud',
        metadata: { razon: 'Pedido falso - acción del staff' },
      })
    }

    setAprobando(null)
    cargarPendientes()
  }

  const aprobarTodas = async () => {
    if (!confirm(`¿Aprobar TODOS los ${orders.length} sellos pendientes?`)) return
    for (const order of orders) await aprobar(order)
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Link href="/dashboard" className="text-xs text-zinc-500 hover:text-zinc-300 mb-2 block">← Volver al Dashboard</Link>
            <h1 className="text-2xl font-black">⏳ Sellos Pendientes</h1>
            <p className="text-zinc-400 text-sm">Pedidos esperando validación del staff</p>
          </div>
          {orders.length > 1 && (
            <button
              onClick={aprobarTodas}
              className="bg-green-800 hover:bg-green-700 text-white font-black px-6 py-3 rounded-xl text-sm uppercase tracking-wider transition-all"
            >
              ✅ Aprobar Todas ({orders.length})
            </button>
          )}
        </div>

        {cargando ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-zinc-800 border-t-amber-500 rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-16 text-center">
            <p className="text-5xl mb-4">✅</p>
            <p className="font-bold text-xl text-white">¡Todo al día!</p>
            <p className="text-zinc-500 text-sm mt-2">No hay sellos pendientes de validación.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => (
              <div key={order.id} className="bg-zinc-900/80 border border-zinc-700 rounded-2xl p-6">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`w-2 h-2 rounded-full ${order.tipo === 'delivery' ? 'bg-blue-500' : 'bg-amber-500'} animate-pulse`} />
                      <span className="text-xs font-black uppercase text-zinc-400">{order.tipo}</span>
                      <span className="text-xs text-zinc-600 font-mono">
                        {new Date(order.created_at).toLocaleString('es-MX')}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase font-bold">Cliente</p>
                        <p className="font-bold text-white">{order.nombre_cliente}</p>
                        <p className="text-zinc-400 text-sm font-mono">{order.telefono_cliente}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase font-bold">Dirección</p>
                        <p className="text-zinc-300 text-sm">
                          {order.calle} {order.numero}, {order.colonia}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase font-bold">Total del Pedido</p>
                        <p className="text-amber-400 font-black text-lg">${order.total.toLocaleString()} MXN</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase font-bold">Productos</p>
                        <p className="text-zinc-300 text-sm">{(order.items as any[]).length} artículo(s)</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex sm:flex-col gap-2 sm:justify-center">
                    <button
                      onClick={() => aprobar(order)}
                      disabled={aprobando === order.id}
                      className="flex-1 sm:flex-none bg-green-800 hover:bg-green-700 text-white font-black py-3 px-6 rounded-xl text-sm uppercase tracking-wider transition-all disabled:opacity-50"
                    >
                      {aprobando === order.id ? '...' : '✅ Aprobar'}
                    </button>
                    <button
                      onClick={() => rechazar(order)}
                      disabled={aprobando === order.id}
                      className="flex-1 sm:flex-none bg-red-950 hover:bg-red-900 border border-red-900 text-red-400 hover:text-white font-black py-3 px-6 rounded-xl text-sm uppercase tracking-wider transition-all disabled:opacity-50"
                    >
                      ❌ Rechazar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
