'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Check, X, AlertCircle, Truck, Plus, Minus } from 'lucide-react'

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
}

export default function SellosPendientesPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [cargando, setCargando] = useState(true)
  const [aprobando, setAprobando] = useState<string | null>(null)

  const [fleets, setFleets] = useState<any[]>([])
  const [selectedFleets, setSelectedFleets] = useState<Record<string, string>>({})
  const [tiemposPrep, setTiemposPrep] = useState<Record<string, number>>({})
  const [solicitandoMoto, setSolicitandoMoto] = useState<Record<string, boolean>>({})
  const [verificandoPago, setVerificandoPago] = useState<Record<string, boolean>>({})

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
      cargarPendientes()
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
      cargarPendientes()
    } catch (err: any) {
      alert('Error al solicitar moto: ' + err.message)
    } finally {
      setSolicitandoMoto(prev => ({ ...prev, [order.id]: false }))
    }
  }

  const cargarPendientes = async () => {
    setCargando(true)
    const businessId = document.cookie.match(/session_business_id=([^;]+)/)?.[1]
    const branchId = document.cookie.match(/session_branch_id=([^;]+)/)?.[1]

    let query = supabase
      .from('orders')
      .select('*, clientes(nombre, puntos), delivery_requests(id, estado, biker_id, bikers(nombre, telefono))')
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
            {orders.map(order => {
              const activeReq = order.delivery_requests?.find(
                (req: any) => req.estado !== 'cancelado_biker' && req.estado !== 'cancelado_restaurante'
              )

              return (
                <div key={order.id} className="bg-zinc-900/80 border border-zinc-700 rounded-2xl p-6">
                  <div className="flex flex-col md:flex-row justify-between gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <span className={`w-2 h-2 rounded-full ${order.tipo === 'delivery' ? 'bg-blue-500' : 'bg-amber-500'} animate-pulse`} />
                        <span className="text-xs font-black uppercase text-zinc-400">{order.tipo}</span>
                        <span className="text-xs text-zinc-600 font-mono">
                          {new Date(order.created_at).toLocaleString('es-MX')}
                        </span>
                        
                        <span className="w-1 h-1 bg-zinc-800 rounded-full" />
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                          order.metodo_pago === 'transferencia' 
                            ? 'bg-purple-950/60 text-purple-300 border-purple-800/80' 
                            : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
                        }`}>
                          💵 {order.metodo_pago || 'efectivo'}
                        </span>
                        
                        {order.metodo_pago === 'transferencia' && (
                          <>
                            <span className="w-1 h-1 bg-zinc-800 rounded-full" />
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                              order.pago_verificado 
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' 
                                : 'bg-amber-950/80 text-amber-300 border-amber-800 animate-pulse'
                            }`}>
                              {order.pago_verificado ? '✓ Pago Verificado' : '⏳ Pago Pendiente'}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Cliente</p>
                          <p className="font-bold text-white text-sm">{order.nombre_cliente}</p>
                          <p className="text-zinc-400 text-xs font-mono mt-0.5">{order.telefono_cliente}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Dirección</p>
                          <p className="text-zinc-300 text-xs leading-relaxed">
                            {order.calle} {order.numero}, {order.colonia}
                          </p>
                          {order.lat_entrega && order.lng_entrega && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${order.lat_entrega},${order.lng_entrega}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 hover:underline text-xs flex items-center gap-1 mt-1.5 font-bold"
                            >
                              📍 Ver en Google Maps
                            </a>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Total de Compra</p>
                          <p className="text-amber-400 font-black text-base">${order.total.toLocaleString()} MXN</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Detalle</p>
                          <p className="text-zinc-300 text-xs font-semibold">{(order.items as any[]).length} artículo(s)</p>
                        </div>
                      </div>

                      {/* Advertencia de transferencia pendiente */}
                      {order.metodo_pago === 'transferencia' && !order.pago_verificado && (
                        <div className="bg-amber-950/40 border border-amber-900/60 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="flex items-start gap-2.5">
                            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-bold text-amber-200">Validación de Transferencia Bancaria</p>
                              <p className="text-xs text-amber-400 mt-0.5">Valida el comprobante bancario antes de despachar este pedido o solicitar repartidor.</p>
                            </div>
                          </div>
                          <button
                            onClick={() => verificarPago(order.id)}
                            disabled={verificandoPago[order.id]}
                            className="bg-amber-600 hover:bg-amber-500 text-white font-extrabold px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0 shadow-sm"
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
                          {activeReq ? (
                            <div className="bg-blue-950/30 border border-blue-900/50 rounded-2xl p-4 space-y-2">
                              <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4 text-blue-400 animate-bounce" />
                                <p className="text-xs font-bold text-blue-200">
                                  Estado del Envío: <span className="uppercase text-blue-400 font-extrabold">{activeReq.estado}</span>
                                </p>
                              </div>
                              {activeReq.bikers ? (
                                <p className="text-xs text-blue-300">
                                  Repartidor asignado: <span className="font-bold">{activeReq.bikers.nombre}</span> ({activeReq.bikers.telefono})
                                </p>
                              ) : (
                                <p className="text-xs text-blue-300 font-medium">Buscando repartidor disponible en la flota...</p>
                              )}
                            </div>
                          ) : (
                            <div className="bg-zinc-800/40 border border-zinc-800 rounded-2xl p-4 space-y-3">
                              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                <div>
                                  <p className="text-xs font-bold text-zinc-200">🚀 Solicitar Entrega a Domicilio</p>
                                  <p className="text-[11px] text-zinc-500">Elige la empresa y el tiempo estimado para que el repartidor recoja el pedido.</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <label className="text-[11px] font-bold text-zinc-400 uppercase">Flota:</label>
                                  <select
                                    value={selectedFleets[order.id] || (fleets.length > 0 ? fleets[0].id : '')}
                                    onChange={(e) => setSelectedFleets(prev => ({ ...prev, [order.id]: e.target.value }))}
                                    className="bg-zinc-950 border border-zinc-800 text-white rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                                <div className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5">
                                  <span className="text-[11px] text-zinc-400 font-bold uppercase">Recogida:</span>
                                  <div className="flex items-center gap-2.5">
                                    <button
                                      onClick={() => {
                                        const current = tiemposPrep[order.id] || 15
                                        const next = Math.max(5, current - 5)
                                        setTiemposPrep(prev => ({ ...prev, [order.id]: next }))
                                      }}
                                      className="w-6 h-6 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-300 flex items-center justify-center transition-colors"
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-xs font-extrabold text-white w-12 text-center">
                                      {tiemposPrep[order.id] || 15} min
                                    </span>
                                    <button
                                      onClick={() => {
                                        const current = tiemposPrep[order.id] || 15
                                        const next = Math.min(90, current + 5)
                                        setTiemposPrep(prev => ({ ...prev, [order.id]: next }))
                                      }}
                                      className="w-6 h-6 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-300 flex items-center justify-center transition-colors"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                <div className="w-full sm:w-auto flex flex-col sm:flex-row items-end sm:items-center gap-2">
                                  {order.metodo_pago === 'transferencia' && !order.pago_verificado && (
                                    <span className="text-[10px] text-amber-400 font-bold bg-amber-950/55 px-2 py-1 rounded-lg border border-amber-900/60">
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
                                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-sm"
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
                        className="flex-1 md:flex-none bg-green-800 hover:bg-green-700 text-white font-black py-3 px-6 rounded-xl text-sm uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-4 h-4" /> {aprobando === order.id ? 'Aprobando...' : 'Aprobar'}
                      </button>
                      <button
                        onClick={() => rechazar(order)}
                        disabled={!!aprobando}
                        className="flex-1 md:flex-none bg-red-950 hover:bg-red-900 border border-red-900 text-red-400 hover:text-white font-black py-3 px-6 rounded-xl text-sm uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
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
