'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Clock,
  MapPin,
  Phone,
  MessageSquare,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  Wifi,
  Navigation,
  Package,
  DollarSign,
  Check,
  Bike
} from 'lucide-react'

// ── Interfaces ─────────────────────────────────────────────────────────────
interface Order {
  id: string
  business_id: string
  nombre_cliente: string
  telefono_cliente: string
  calle: string
  numero: string
  colonia: string
  referencia?: string
  notas?: string
  tipo: string
  items: any
  total: number
  estado: string
  metodo_pago?: string
  created_at: string
  aceptado_at?: string
  listo_at?: string
  repartidor_solicitado_at?: string
  tengo_el_pedido_at?: string
  entregado_at?: string
  lat_entrega?: number
  lng_entrega?: number
  delayed_minutes?: number
}

export default function BikerDashboardPage() {
  const params = useParams()
  const slug = (params.slug as string) || ''

  const [business, setBusiness] = useState<any>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [cargando, setCargando] = useState(true)
  const [connected, setConnected] = useState(true)
  const [procesandoId, setProcesandoId] = useState<string | null>(null)

  // 1. Cargar negocio al montar
  useEffect(() => {
    if (!slug) return
    supabase.from('businesses')
      .select('*')
      .eq('slug', slug.toLowerCase().trim())
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setBusiness(data)
        } else {
          setCargando(false)
        }
      })
  }, [slug])

  // 2. Cargar órdenes y suscribirse Realtime
  useEffect(() => {
    if (!business?.id) return
    setCargando(true)

    // Cargar órdenes del negocio que tengan repartidor solicitado y no estén entregadas
    supabase.from('orders')
      .select('*')
      .eq('business_id', business.id)
      .not('repartidor_solicitado_at', 'is', null)
      .is('entregado_at', null)
      .order('repartidor_solicitado_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('Error al cargar órdenes:', error)
        if (data) setOrders(data as Order[])
        setCargando(false)
      })

    // Suscribirse a cambios en tiempo real
    const channel = supabase.channel(`biker_orders_${business.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `business_id=eq.${business.id}`
      }, (payload) => {
        setConnected(true)
        if (payload.eventType === 'INSERT') {
          const newOrder = payload.new as Order
          if (newOrder.repartidor_solicitado_at && !newOrder.entregado_at) {
            setOrders(prev => {
              if (prev.some(o => o.id === newOrder.id)) return prev
              return [newOrder, ...prev]
            })
          }
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as Order
          if (!updated.repartidor_solicitado_at || updated.entregado_at) {
            // Eliminar de la lista activa
            setOrders(prev => prev.filter(o => o.id !== updated.id))
          } else {
            // Actualizar o insertar
            setOrders(prev => {
              if (prev.some(o => o.id === updated.id)) {
                return prev.map(o => o.id === updated.id ? updated : o)
              } else {
                return [updated, ...prev]
              }
            })
          }
        } else if (payload.eventType === 'DELETE') {
          setOrders(prev => prev.filter(o => o.id !== payload.old.id))
        }
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [business?.id])

  // ── ACCIONES DEL BIKER ────────────────────────────────────────────────────
  
  // Aceptar pedido (Tomar pedido) -> cambia estado a 'en_camino' y registra 'tengo_el_pedido_at'
  const handleTomarPedido = async (orderId: string) => {
    setProcesandoId(orderId)
    try {
      const nowStr = new Date().toISOString()
      
      // Actualización reactiva optimista
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, estado: 'en_camino', tengo_el_pedido_at: nowStr } : o))
      
      const { error } = await supabase.from('orders')
        .update({
          estado: 'en_camino',
          tengo_el_pedido_at: nowStr
        })
        .eq('id', orderId)

      if (error) throw error
    } catch (e) {
      console.error('Error al tomar pedido:', e)
      alert('⚠️ No se pudo tomar el pedido. Reintenta.')
    } finally {
      setProcesandoId(null)
    }
  }

  // Entregar pedido -> cambia estado a 'entregado' y registra 'entregado_at'
  const handleEntregado = async (orderId: string) => {
    setProcesandoId(orderId)
    try {
      const nowStr = new Date().toISOString()
      
      // Eliminación reactiva optimista
      setOrders(prev => prev.filter(o => o.id !== orderId))
      
      const { error } = await supabase.from('orders')
        .update({
          estado: 'entregado',
          entregado_at: nowStr
        })
        .eq('id', orderId)

      if (error) throw error
    } catch (e) {
      console.error('Error al entregar pedido:', e)
      alert('⚠️ Error al registrar entrega. Reintenta.')
    } finally {
      setProcesandoId(null)
    }
  }

  // Helpers
  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  const getCleanPhone = (phone: string) => {
    return phone?.replace(/\D/g, '') || ''
  }

  // Clasificación de órdenes de la v44
  // SECCIÓN 1: Solicitudes Activas (Pedidos por Recoger)
  // `repartidor_solicitado_at` no nulo, but `tengo_el_pedido_at` and `entregado_at` are null
  const pedidosPorRecoger = orders.filter(o => o.repartidor_solicitado_at && !o.tengo_el_pedido_at && !o.entregado_at)

  // SECCIÓN 2: Mi Ruta (Llevando al Cliente)
  // `tengo_el_pedido_at` no nulo, but `entregado_at` is null
  const miRuta = orders.filter(o => o.tengo_el_pedido_at && !o.entregado_at)

  if (cargando && !business) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center text-zinc-650">
        <RefreshCw className="w-8 h-8 animate-spin text-[#dc2626] mb-4" />
        <p className="text-xs font-bold uppercase tracking-widest font-mono">Conectando Portal Biker...</p>
      </div>
    )
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center text-zinc-650 p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-4" />
        <h2 className="text-sm font-bold uppercase tracking-widest font-mono text-[#09090b] mb-2">Comercio No Vinculado</h2>
        <p className="text-xs text-zinc-500 max-w-xs font-medium">El subdominio proporcionado no pertenece a un negocio activo de LoyaltyClub.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-800 flex flex-col font-sans selection:bg-[#dc2626] selection:text-white">
      
      {/* ── CABECERA ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-zinc-200 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#dc2626] rounded-xl flex items-center justify-center shadow-md shadow-red-500/10 shrink-0">
            <Bike className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-serif font-black text-sm text-[#09090b] uppercase tracking-tight truncate max-w-[150px] sm:max-w-xs">
              {business.nombre}
            </h1>
            <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5">Ruta de Reparto</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-[#fafafa] border border-zinc-200 px-3 py-1.5 rounded-full shrink-0">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-rose-500 animate-pulse'} inline-block`} />
          <span className="text-[9px] font-mono font-bold text-zinc-650 uppercase tracking-wider">
            {connected ? 'En Línea' : 'Sincronizando'}
          </span>
        </div>
      </header>

      {/* ── CONTENIDO PRINCIPAL (MOBILE-FIRST) ── */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-6 space-y-8 pb-24">
        
        {/* =========================================================================
            SECCIÓN 2: MI RUTA ("Llevando al Cliente") - PRIORIDAD VISUAL MÁXIMA
            ========================================================================= */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-black uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
            <span>🛵 Mi Ruta Activa</span>
            {miRuta.length > 0 && (
              <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded text-[9px] font-mono">
                {miRuta.length}
              </span>
            )}
          </h2>

          {miRuta.length === 0 ? (
            <div className="bg-zinc-100/40 border border-zinc-200 rounded-3xl p-6 text-center">
              <p className="text-xs text-zinc-500 font-mono">No tienes pedidos en camino actualmente.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {miRuta.map(order => {
                const cleanPhone = getCleanPhone(order.telefono_cliente)
                const isCash = order.metodo_pago === 'efectivo'
                return (
                  <div key={order.id} className="bg-white border-2 border-emerald-500 rounded-3xl p-5 shadow-md relative overflow-hidden space-y-4 animate-fadeIn">
                    
                    {order.delayed_minutes && order.delayed_minutes > 0 ? (
                      <div className="bg-rose-600 text-white border border-rose-500 rounded-2xl p-4 text-xs font-black flex items-center gap-2 animate-pulse uppercase tracking-wider text-center justify-center">
                        <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                        <span>⚠️ COCINA REPORTA RETRASO DE {order.delayed_minutes} MINUTOS EN ESTA ORDEN</span>
                      </div>
                    ) : null}

                    {/* Alerta de ruta activa */}
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-mono font-black bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-lg uppercase">
                          #{order.id.slice(-4).toUpperCase()}
                        </span>
                        <h3 className="font-black text-lg text-[#09090b] mt-2 leading-tight">
                          {order.nombre_cliente}
                        </h3>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-mono text-zinc-500 block">Tomado a las</span>
                        <span className="text-xs font-bold font-mono text-zinc-700">{formatTime(order.tengo_el_pedido_at || '')}</span>
                      </div>
                    </div>

                    {/* Dirección Gigante */}
                    <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-2">
                      <div className="flex items-start gap-2.5">
                        <MapPin className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider leading-none">Dirección de Entrega</p>
                          <p className="text-sm font-black text-[#09090b] mt-1 leading-relaxed">
                            {order.calle} {order.numero}, {order.colonia}
                          </p>
                          {order.referencia && (
                            <p className="text-xs text-amber-600 font-bold mt-1.5">
                              📍 Ref: {order.referencia}
                            </p>
                          )}
                        </div>
                      </div>

                      {order.lat_entrega && order.lng_entrega && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${order.lat_entrega},${order.lng_entrega}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-1.5 bg-white hover:bg-zinc-50 border border-zinc-200 py-3.5 rounded-xl text-xs font-bold text-zinc-700 transition-colors mt-2"
                        >
                          <Navigation className="w-4 h-4 text-emerald-600" />
                          Navegar con Google Maps
                        </a>
                      )}
                    </div>

                    {/* Cobro y Forma de Pago */}
                    <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 rounded-2xl p-4 font-mono">
                      <div>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Pago al Entregar</p>
                        <p className={`text-xs font-bold mt-1 ${isCash ? 'text-amber-600' : 'text-zinc-650'}`}>
                          {isCash ? '💵 EFECTIVO' : '💳 TRANSFERENCIA'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-[#09090b] font-mono">${order.total}</span>
                      </div>
                    </div>

                    {/* Notas del cliente */}
                    {order.notas && (
                      <p className="text-xs text-zinc-650 bg-zinc-50 p-3 rounded-xl border border-zinc-200 leading-relaxed font-mono">
                        <strong>Comentarios:</strong> {order.notas}
                      </p>
                    )}

                    {/* Acceso rápido a Llamadas/WhatsApp */}
                    {cleanPhone && (
                      <div className="grid grid-cols-2 gap-3">
                        <a
                          href={`tel:${cleanPhone}`}
                          className="flex items-center justify-center gap-2 bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 py-3.5 rounded-2xl text-xs font-black uppercase text-zinc-700 transition-all active:scale-95 cursor-pointer"
                        >
                          <Phone className="w-4 h-4 text-sky-600" /> Llamar
                        </a>
                        <a
                          href={`https://wa.me/${cleanPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 py-3.5 rounded-2xl text-xs font-black uppercase text-zinc-700 transition-all active:scale-95 cursor-pointer"
                        >
                          <MessageSquare className="w-4 h-4 text-emerald-600" /> WhatsApp
                        </a>
                      </div>
                    )}

                    {/* Botón de Cierre Gigante */}
                    <button
                      onClick={() => handleEntregado(order.id)}
                      disabled={procesandoId === order.id}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white font-black text-sm uppercase py-5 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer select-none"
                    >
                      {procesandoId === order.id ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <><Check className="w-5 h-5 stroke-[3px]" /> Entregado en Domicilio</>
                      )}
                    </button>

                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* =========================================================================
            SECCIÓN 1: SOLICITUDES ACTIVAS ("Pedidos por Recoger")
            ========================================================================= */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-black uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
            <span>📥 Pedidos por Recoger</span>
            {pedidosPorRecoger.length > 0 && (
              <span className="bg-zinc-100 text-zinc-650 border border-zinc-200 px-1.5 py-0.5 rounded text-[9px] font-mono">
                {pedidosPorRecoger.length}
              </span>
            )}
          </h2>

          {pedidosPorRecoger.length === 0 ? (
            <div className="bg-zinc-100/20 border border-zinc-200 rounded-3xl p-8 text-center space-y-2">
              <Clock className="w-8 h-8 text-zinc-400 mx-auto" />
              <p className="text-xs text-zinc-500 font-mono">Sin pedidos pendientes de recolección.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pedidosPorRecoger.map(order => {
                const elapsedMin = Math.floor((Date.now() - new Date(order.repartidor_solicitado_at || order.created_at).getTime()) / 60000)
                return (
                  <div key={order.id} className="bg-white border border-zinc-200 rounded-3xl p-5 shadow-sm space-y-4 relative overflow-hidden animate-fadeIn">
                    
                    {order.delayed_minutes && order.delayed_minutes > 0 ? (
                      <div className="bg-rose-600 text-white border border-rose-500 rounded-2xl p-4 text-xs font-black flex items-center gap-2 animate-pulse uppercase tracking-wider text-center justify-center">
                        <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                        <span>⚠️ COCINA REPORTA RETRASO DE {order.delayed_minutes} MINUTOS EN ESTA ORDEN</span>
                      </div>
                    ) : null}

                    {/* Alerta de Pedido Solicitado */}
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-mono font-bold bg-zinc-100 text-zinc-650 px-2 py-0.5 rounded-lg uppercase">
                          #{order.id.slice(-4).toUpperCase()}
                        </span>
                        <h4 className="font-bold text-base text-[#09090b] mt-2 leading-tight">
                          {order.nombre_cliente}
                        </h4>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-mono text-zinc-500 block">Solicitado hace</span>
                        <span className="text-xs font-black font-mono text-amber-600">{elapsedMin} min</span>
                      </div>
                    </div>

                    {/* Dirección resumida */}
                    <div className="flex items-start gap-2 text-xs text-zinc-650 bg-zinc-50 p-3.5 rounded-xl border border-zinc-200">
                      <MapPin className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-zinc-700 leading-normal">{order.calle} {order.numero}, {order.colonia}</p>
                      </div>
                    </div>

                    {/* Botón Tomar Pedido Gigante */}
                    <button
                      onClick={() => handleTomarPedido(order.id)}
                      disabled={procesandoId === order.id || miRuta.length >= 3}
                      className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 text-white font-black text-sm uppercase py-4.5 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer select-none"
                    >
                      {procesandoId === order.id ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : miRuta.length >= 3 ? (
                        <span>🚫 Ruta Llena (Máx. 3)</span>
                      ) : (
                        <><Bike className="w-5 h-5" /> Tomar Pedido</>
                      )}
                    </button>

                  </div>
                )
              })}
            </div>
          )}
        </section>

      </main>

    </div>
  )
}
