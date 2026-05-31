'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Check, X, Clock, AlertCircle } from 'lucide-react'

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
  cliente_id?: string | null
  clientes: { nombre: string; puntos: number } | null
}

export default function SellosPendientesTenantPage() {
  const { slug } = useParams()
  const [orders, setOrders] = useState<Order[]>([])
  const [cargando, setCargando] = useState(true)
  const [aprobando, setAprobando] = useState<string | null>(null)
  const [businessId, setBusinessId] = useState('')

  const getCookieVal = (name: string) => {
    if (typeof document === 'undefined') return ''
    return document.cookie.match(new RegExp(`${name}=([^;]+)`))?.[1] || ''
  }

  const cargarPendientes = async (bId: string) => {
    setCargando(true)
    const branchId = getCookieVal('session_branch_id')

    let query = supabase
      .from('orders')
      .select('*, clientes(nombre, puntos)')
      .eq('sello_otorgado', true)
      .eq('sello_aprobado', false)
      .eq('sello_rechazado', false)
      .order('created_at', { ascending: false })

    if (bId) query = query.eq('business_id', bId)
    if (branchId) query = query.eq('branch_id', branchId)

    const { data } = await query
    if (data) setOrders(data as any[])
    setCargando(false)
  }

  useEffect(() => {
    const init = async () => {
      let bId = getCookieVal('session_business_id')
      if (!bId && slug) {
        const { data } = await supabase
          .from('businesses')
          .select('id')
          .eq('slug', slug)
          .maybeSingle()
        if (data) bId = data.id
      }
      if (bId) {
        setBusinessId(bId)
        cargarPendientes(bId)
      } else {
        setCargando(false)
      }
    }
    init()
  }, [slug])

  const aprobar = async (order: Order) => {
    setAprobando(order.id)
    const userId = getCookieVal('session_user_id')
    const bId = businessId || getCookieVal('session_business_id')

    await supabase.from('orders').update({
      sello_aprobado: true,
      estado: 'aprobado',
      aprobado_por: userId || null,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id)

    if (order.clientes && order.cliente_id) {
      await supabase.from('tracking_events').insert({
        business_id: bId || null,
        cliente_id: order.cliente_id,
        order_id: order.id,
        event_type: 'approved_by_staff',
        metadata: { aprobado_por: userId, total: order.total },
      })
    }

    setAprobando(null)
    if (bId) cargarPendientes(bId)
  }

  const rechazar = async (order: Order) => {
    if (!confirm(`¿Marcar el pedido de ${order.nombre_cliente} como FALSO y quitar el sello?`)) return
    setAprobando(order.id)
    const bId = businessId || getCookieVal('session_business_id')

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
        business_id: bId || null,
        cliente_id: order.cliente_id,
        order_id: order.id,
        event_type: 'rejected_fraud',
        metadata: { razon: 'Pedido falso - acción del staff' },
      })
    }

    setAprobando(null)
    if (bId) cargarPendientes(bId)
  }

  const aprobarTodas = async () => {
    if (!confirm(`¿Aprobar TODOS los ${orders.length} sellos pendientes?`)) return
    for (const order of orders) await aprobar(order)
  }

  return (
    <main className="min-h-screen bg-[#fafafa] text-[#09090b] font-sans p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Link 
              href="/dashboard" 
              className="text-[#71717a] hover:text-[#09090b] text-xs font-semibold flex items-center gap-1.5 transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" /> Volver al Dashboard
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-[#09090b]">⏳ Validación de Sellos</h1>
            <p className="text-[#71717a] text-sm mt-0.5">Pedidos esperando validación y auditoría manual del staff</p>
          </div>
          {orders.length > 1 && (
            <button
              onClick={aprobarTodas}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-5 py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-sm"
            >
              ✓ Aprobar Todas ({orders.length})
            </button>
          )}
        </div>

        {cargando ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#e4e4e7] border-t-[#dc2626] rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white border border-[#e4e4e7] rounded-3xl p-16 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto text-emerald-600 mb-4">
              <Check className="w-6 h-6" />
            </div>
            <p className="font-bold text-lg text-[#09090b]">¡Todo al día!</p>
            <p className="text-[#71717a] text-sm mt-1">No hay sellos pendientes de validación en este momento.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => (
              <div key={order.id} className="bg-white border border-[#e4e4e7] rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row justify-between gap-6">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${order.tipo === 'delivery' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                      <span className="text-xs font-bold uppercase tracking-wider text-[#71717a]">{order.tipo}</span>
                      <span className="w-1 h-1 bg-[#e4e4e7] rounded-full" />
                      <span className="text-xs text-[#a1a1aa] font-mono">
                        {new Date(order.created_at).toLocaleString('es-MX')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-[10px] text-[#71717a] uppercase font-bold tracking-wider mb-1">Cliente</p>
                        <p className="font-bold text-[#09090b] text-sm">{order.nombre_cliente}</p>
                        <p className="text-[#71717a] text-xs font-mono mt-0.5">{order.telefono_cliente}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#71717a] uppercase font-bold tracking-wider mb-1">Dirección</p>
                        <p className="text-[#52525b] text-xs leading-relaxed">
                          {order.calle} {order.numero}, {order.colonia}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#71717a] uppercase font-bold tracking-wider mb-1">Total de Compra</p>
                        <p className="text-[#dc2626] font-extrabold text-base">${order.total.toLocaleString()} MXN</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#71717a] uppercase font-bold tracking-wider mb-1">Detalle</p>
                        <p className="text-[#52525b] text-xs font-semibold">{(order.items as any[]).length} artículo(s)</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex md:flex-col gap-2.5 justify-center shrink-0">
                    <button
                      onClick={() => aprobar(order)}
                      disabled={!!aprobando}
                      className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" /> {aprobando === order.id ? 'Aprobando...' : 'Aprobar'}
                    </button>
                    <button
                      onClick={() => rechazar(order)}
                      disabled={!!aprobando}
                      className="flex-1 md:flex-none border border-red-200 text-[#dc2626] hover:bg-red-50 font-bold py-2.5 px-6 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <X className="w-4 h-4" /> Rechazar
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
