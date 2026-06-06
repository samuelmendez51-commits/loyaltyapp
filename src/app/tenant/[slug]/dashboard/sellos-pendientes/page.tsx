'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Check, X, Clock, AlertCircle, Truck, Plus, Minus } from 'lucide-react'

interface Order {
  id: string
  business_id: string
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
  metodo_pago?: string | null
  pago_verificado?: boolean | null
  lat_entrega?: number | null
  lng_entrega?: number | null
  delivery_requests?: any[] | null
  delivery_status?: 'PENDING' | 'SHIPPED_SCHEDULED' | 'SHIPPED_IMMEDIATE' | 'DELIVERED' | 'CANCELLED' | null
  scheduled_pickup_time?: string | null
  delivery_token?: string | null
}

function DeliveryCountdown({ scheduledTime, onExpire }: { scheduledTime: string; onExpire?: () => void }) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const calculateTime = () => {
      const difference = new Date(scheduledTime).getTime() - Date.now()
      if (difference <= 0) {
        setTimeLeft('00:00')
        if (onExpire) onExpire()
        return
      }
      const totalSeconds = Math.floor(difference / 1000)
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = totalSeconds % 60
      const formattedMin = String(minutes).padStart(2, '0')
      const formattedSec = String(seconds).padStart(2, '0')
      setTimeLeft(`${formattedMin}:${formattedSec}`)
    }

    calculateTime()
    const timer = setInterval(calculateTime, 1000)
    return () => clearInterval(timer)
  }, [scheduledTime])

  return (
    <span className="font-mono font-extrabold text-sm text-[#09090b] tracking-wider bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded-lg shadow-sm">
      {timeLeft}
    </span>
  )
}

export default function SellosPendientesTenantPage() {
  const { slug } = useParams()
  const [orders, setOrders] = useState<Order[]>([])
  const [cargando, setCargando] = useState(true)
  const [aprobando, setAprobando] = useState<string | null>(null)
  const [businessId, setBusinessId] = useState('')

  const [fleets, setFleets] = useState<any[]>([])
  const [selectedFleets, setSelectedFleets] = useState<Record<string, string>>({})
  const [tiemposPrep, setTiemposPrep] = useState<Record<string, number>>({})
  const [solicitandoMoto, setSolicitandoMoto] = useState<Record<string, boolean>>({})
  const [verificandoPago, setVerificandoPago] = useState<Record<string, boolean>>({})
  const [overriding, setOverriding] = useState<Record<string, boolean>>({})

  const ejecutarReadyOverride = async (orderId: string) => {
    setOverriding(prev => ({ ...prev, [orderId]: true }))
    try {
      const res = await fetch('/api/orders/ready-override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ order_id: orderId })
      })

      if (!res.ok) throw new Error(await res.text())

      setOrders(prev =>
        prev.map(o =>
          o.id === orderId
            ? { ...o, delivery_status: 'SHIPPED_IMMEDIATE' }
            : o
        )
      )
    } catch (err: any) {
      console.error('Error executing ready-override:', err)
      alert('Error al notificar al repartidor: ' + err.message)
    } finally {
      setOverriding(prev => ({ ...prev, [orderId]: false }))
    }
  }

  // Cargar flotas
  useEffect(() => {
    const cargarFlotas = async () => {
      const { data } = await supabase
        .from('delivery_fleets')
        .select('id, nombre')
        .eq('activo', true)
      if (data) {
        setFleets(data)
      }
    }
    cargarFlotas()
  }, [])

  const verificarPago = async (orderId: string) => {
    setVerificandoPago(prev => ({ ...prev, [orderId]: true }))
    try {
      const { error } = await supabase
        .from('orders')
        .update({ pago_verificado: true })
        .eq('id', orderId)
      if (error) throw error
      alert('✅ Pago por transferencia verificado e indicado con visto bueno.')
      if (businessId) cargarPendientes(businessId)
    } catch (err: any) {
      alert('Error al verificar pago: ' + err.message)
    } finally {
      setVerificandoPago(prev => ({ ...prev, [orderId]: false }))
    }
  }

  const solicitarBiker = async (order: Order) => {
    const fId = selectedFleets[order.id] || (fleets.length > 0 ? fleets[0].id : '')
    if (!fId) {
      alert('Por favor selecciona una empresa de reparto (flota).')
      return
    }

    const tPrep = tiemposPrep[order.id] || 15
    setSolicitandoMoto(prev => ({ ...prev, [order.id]: true }))

    try {
      const { error } = await supabase
        .from('delivery_requests')
        .insert({
          restaurante_id: order.business_id,
          fleet_id: fId,
          order_id: order.id,
          descripcion: `Pedido de ${order.nombre_cliente} (#${order.id.slice(-4).toUpperCase()})`,
          direccion_entrega: `${order.calle} ${order.numero}, ${order.colonia}`,
          lat_entrega: order.lat_entrega || null,
          lng_entrega: order.lng_entrega || null,
          estado: 'pendiente',
          tiempo_preparacion_estimado: tPrep
        })

      if (error) throw error
      alert('🏍️ Solicitud de moto enviada a la flota con éxito.')
      if (businessId) cargarPendientes(businessId)
    } catch (err: any) {
      alert('Error al solicitar moto: ' + err.message)
    } finally {
      setSolicitandoMoto(prev => ({ ...prev, [order.id]: false }))
    }
  }

  const getCookieVal = (name: string) => {
    if (typeof document === 'undefined') return ''
    return document.cookie.match(new RegExp(`${name}=([^;]+)`))?.[1] || ''
  }

  const cargarPendientes = async (bId: string) => {
    setCargando(true)
    const branchId = getCookieVal('session_branch_id')

    let query = supabase
      .from('orders')
      .select('*, clientes(nombre, puntos), delivery_requests(id, estado, biker_id, bikers(nombre, telefono))')
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
            {orders.map(order => {
              const activeReq = order.delivery_requests?.find(
                (req: any) => req.estado !== 'cancelado_biker' && req.estado !== 'cancelado_restaurante'
              )

              return (
                <div key={order.id} className="bg-white border border-[#e4e4e7] rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col md:flex-row justify-between gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`w-2.5 h-2.5 rounded-full ${order.tipo === 'delivery' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                        <span className="text-xs font-bold uppercase tracking-wider text-[#71717a]">{order.tipo}</span>
                        <span className="w-1 h-1 bg-[#e4e4e7] rounded-full" />
                        <span className="text-xs text-[#a1a1aa] font-mono">
                          {new Date(order.created_at).toLocaleString('es-MX')}
                        </span>
                        
                        <span className="w-1 h-1 bg-[#e4e4e7] rounded-full" />
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          order.metodo_pago === 'transferencia' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          💵 {order.metodo_pago || 'efectivo'}
                        </span>
                        
                        {order.metodo_pago === 'transferencia' && (
                          <>
                            <span className="w-1 h-1 bg-[#e4e4e7] rounded-full" />
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              order.pago_verificado 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-amber-100 text-amber-800 animate-pulse'
                            }`}>
                              {order.pago_verificado ? '✓ Pago Verificado' : '⏳ Pago Pendiente'}
                            </span>
                          </>
                        )}
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
                          {order.lat_entrega && order.lng_entrega && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${order.lat_entrega},${order.lng_entrega}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#2563eb] hover:text-[#1d4ed8] hover:underline text-xs flex items-center gap-1 mt-1.5 font-bold"
                            >
                              📍 Ver en Google Maps
                            </a>
                          )}
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

                      {/* Advertencia de transferencia pendiente */}
                      {order.metodo_pago === 'transferencia' && !order.pago_verificado && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="flex items-start gap-2.5">
                            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-bold text-amber-900">Validación de Transferencia Bancaria</p>
                              <p className="text-xs text-amber-700 mt-0.5">Valida el comprobante bancario antes de despachar este pedido o solicitar repartidor.</p>
                            </div>
                          </div>
                          <button
                            onClick={() => verificarPago(order.id)}
                            disabled={verificandoPago[order.id]}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0 shadow-sm"
                          >
                            {verificandoPago[order.id] ? (
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            ✓ Dar Visto Bueno
                          </button>
                        </div>
                      )}

                      {/* Reparto a domicilio */}
                      {order.tipo === 'delivery' && (
                        <>
                          <style>{`
                            @keyframes motorSlide {
                              0% { transform: translateX(-150%); }
                              100% { transform: translateX(350%); }
                            }
                            .animate-motor-slide {
                              animation: motorSlide 2.5s ease-in-out infinite;
                            }
                          `}</style>

                          {order.delivery_status === 'SHIPPED_SCHEDULED' ? (
                            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 space-y-4">
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div className="flex items-start gap-2.5">
                                  <Clock className="w-5 h-5 text-amber-600 animate-pulse shrink-0 mt-0.5" />
                                  <div>
                                    <p className="text-xs font-black text-amber-950">🏍️ Despacho Pre-programado Diferido</p>
                                    <p className="text-[11px] text-amber-700 mt-0.5 font-medium">
                                      El repartidor está programado para recolectar el pedido.
                                    </p>
                                  </div>
                                </div>
                                {order.scheduled_pickup_time && (
                                  <div className="flex items-center gap-1.5 bg-white border border-amber-200 px-3 py-1.5 rounded-xl shadow-sm shrink-0">
                                    <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wide">Recogida en:</span>
                                    <DeliveryCountdown scheduledTime={order.scheduled_pickup_time} />
                                  </div>
                                )}
                              </div>

                              <button
                                onClick={() => ejecutarReadyOverride(order.id)}
                                disabled={overriding[order.id]}
                                className="w-full bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-600 hover:to-red-700 text-white font-extrabold px-6 py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-red-500/10 active:scale-95 cursor-pointer"
                              >
                                {overriding[order.id] ? (
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <span>⚡ ¡Pedido Listo! Notificar Repartidor Ya</span>
                                )}
                              </button>
                            </div>
                          ) : order.delivery_status === 'SHIPPED_IMMEDIATE' ? (
                            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 space-y-4">
                              <div className="flex items-start gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center border border-emerald-200 animate-bounce shrink-0">
                                  <Truck className="w-4.5 h-4.5" />
                                </div>
                                <div>
                                  <p className="text-xs font-black text-emerald-950">🟢 Repartidor en Ruta Inmediata</p>
                                  <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">
                                    ¡Pedido listo antes de tiempo! El repartidor ha sido alertado para recolección inmediata y va en camino.
                                  </p>
                                </div>
                              </div>

                              <div className="w-full h-2 bg-emerald-100 rounded-full overflow-hidden relative border border-emerald-200">
                                <div className="absolute top-0 bottom-0 w-12 bg-emerald-500 rounded-full animate-motor-slide"></div>
                              </div>
                            </div>
                          ) : activeReq ? (
                            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 space-y-2">
                              <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4 text-blue-600 animate-bounce" />
                                <p className="text-xs font-bold text-blue-900">
                                  Estado del Envío: <span className="uppercase text-blue-700 font-extrabold">{activeReq.estado}</span>
                                </p>
                              </div>
                              {activeReq.bikers ? (
                                <p className="text-xs text-blue-800">
                                  Repartidor asignado: <span className="font-bold">{activeReq.bikers.nombre}</span> ({activeReq.bikers.telefono})
                                </p>
                              ) : (
                                <p className="text-xs text-blue-800 font-medium">Buscando repartidor disponible en la flota...</p>
                              )}
                            </div>
                          ) : (
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                <div>
                                  <p className="text-xs font-bold text-slate-800">🚀 Solicitar Entrega a Domicilio</p>
                                  <p className="text-[11px] text-slate-500">Elige la empresa y el tiempo estimado para que el repartidor recoja el pedido.</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <label className="text-[11px] font-bold text-slate-600 uppercase">Flota:</label>
                                  <select
                                    value={selectedFleets[order.id] || (fleets.length > 0 ? fleets[0].id : '')}
                                    onChange={(e) => setSelectedFleets(prev => ({ ...prev, [order.id]: e.target.value }))}
                                    className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  >
                                    {fleets.map(f => (
                                      <option key={f.id} value={f.id}>
                                        {f.nombre === 'Flota Central' || f.nombre === 'flota central' ? 'Bikers Upn' : f.nombre}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-1">
                                <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
                                  <span className="text-[11px] text-slate-500 font-bold uppercase">Recogida:</span>
                                  <div className="flex items-center gap-2.5">
                                    <button
                                      onClick={() => {
                                        const current = tiemposPrep[order.id] || 15
                                        const next = Math.max(5, current - 5)
                                        setTiemposPrep(prev => ({ ...prev, [order.id]: next }))
                                      }}
                                      className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-xs font-extrabold text-slate-800 w-12 text-center">
                                      {tiemposPrep[order.id] || 15} min
                                    </span>
                                    <button
                                      onClick={() => {
                                        const current = tiemposPrep[order.id] || 15
                                        const next = Math.min(90, current + 5)
                                        setTiemposPrep(prev => ({ ...prev, [order.id]: next }))
                                      }}
                                      className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                <div className="w-full sm:w-auto flex flex-col sm:flex-row items-end sm:items-center gap-2">
                                  {order.metodo_pago === 'transferencia' && !order.pago_verificado && (
                                    <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                                      ⚠️ Requiere Visto Bueno del Pago
                                    </span>
                                  )}
                                  <button
                                    onClick={() => solicitarBiker(order)}
                                    disabled={
                                      (order.metodo_pago === 'transferencia' && !order.pago_verificado) ||
                                      solicitandoMoto[order.id] ||
                                      fleets.length === 0
                                    }
                                    className="w-full sm:w-auto bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-extrabold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-sm"
                                  >
                                    {solicitandoMoto[order.id] ? (
                                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <Truck className="w-4 h-4" />
                                    )}
                                    Solicitar Moto
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
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
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
