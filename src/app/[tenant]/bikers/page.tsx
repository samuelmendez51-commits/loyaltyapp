'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Package,
  Bike,
  MapPin,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  User,
  Navigation,
  CreditCard,
  DollarSign
} from 'lucide-react'

interface Order {
  id: string
  business_id: string
  nombre_cliente: string
  telefono_cliente: string
  calle: string
  numero: string
  colonia: string
  tipo: string
  items: any
  total: number
  estado: string
  metodo_pago?: string
  created_at: string
  delivery_token?: string | null
}

export default function BikersPortalPage() {
  const params = useParams()
  const tenantSlug = (params?.tenant as string) || ''

  const [business, setBusiness] = useState<any>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [cargandoBusiness, setCargandoBusiness] = useState(true)
  const [cargandoOrders, setCargandoOrders] = useState(true)

  const [bikerName, setBikerName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [isEditingName, setIsEditingName] = useState(true)

  const [activeTab, setActiveTab] = useState<'disponibles' | 'mi_ruta'>('disponibles')
  const [procesandoId, setProcesandoId] = useState<string | null>(null)

  // 1. Cargar Nombre del Repartidor de localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('biker_portal_name')
      if (stored) {
        setBikerName(stored)
        setNameInput(stored)
        setIsEditingName(false)
      }
    }
  }, [])

  // Guardar Nombre del Repartidor
  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nameInput.trim()) return
    setBikerName(nameInput.trim())
    localStorage.setItem('biker_portal_name', nameInput.trim())
    setIsEditingName(false)
  }

  // 2. Cargar negocio a partir del Slug del Tenant
  useEffect(() => {
    if (!tenantSlug) return
    setCargandoBusiness(true)
    supabase.from('businesses')
      .select('id, nombre, slug')
      .eq('slug', tenantSlug.toLowerCase().trim())
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setBusiness(data)
        }
        setCargandoBusiness(false)
      })
  }, [tenantSlug])

  // 3. Cargar Pedidos y Configurar Suscripción Realtime
  useEffect(() => {
    if (!business?.id) return
    setCargandoOrders(true)

    // Cargar órdenes iniciales
    supabase.from('orders')
      .select('*')
      .eq('business_id', business.id)
      .in('estado', ['READY_TO_SHIP', 'IN_TRANSIT'])
      .then(({ data, error }) => {
        if (error) console.error('Error al cargar órdenes de reparto:', error)
        if (data) setOrders(data)
        setCargandoOrders(false)
      })

    // Suscripción Realtime a Órdenes
    const channel = supabase.channel(`bikers_portal_realtime_${business.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `business_id=eq.${business.id}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newOrder = payload.new as Order
          if (['READY_TO_SHIP', 'IN_TRANSIT'].includes(newOrder.estado)) {
            setOrders(prev => {
              if (prev.some(o => o.id === newOrder.id)) return prev
              return [newOrder, ...prev]
            })
          }
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as Order
          if (!['READY_TO_SHIP', 'IN_TRANSIT'].includes(updated.estado)) {
            setOrders(prev => prev.filter(o => o.id !== updated.id))
          } else {
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
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [business?.id])

  // ── Acciones de Reparto ───────────────────────────────────────────────────

  // Tomar Pedido -> Cambia estado a 'IN_TRANSIT' y guarda repartidor en 'delivery_token'
  const handleTomarPedido = async (orderId: string) => {
    if (!bikerName.trim()) {
      alert('⚠️ Ingresa tu nombre de repartidor antes de tomar un pedido.')
      setIsEditingName(true)
      return
    }
    setProcesandoId(orderId)
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          estado: 'IN_TRANSIT',
          delivery_status: 'SHIPPED_IMMEDIATE',
          delivery_token: bikerName.trim(),
          tengo_el_pedido_at: new Date().toISOString(),
          repartidor_solicitado_at: new Date().toISOString()
        })
        .eq('id', orderId)

      if (error) throw error
    } catch (e: any) {
      console.error('Error al tomar pedido:', e)
      alert('⚠️ Error al tomar el pedido: ' + e.message)
    } finally {
      setProcesandoId(null)
    }
  }

  // Entregar Pedido -> Cambia estado a 'DELIVERED' y registra entregado_at
  const handleEntregarPedido = async (orderId: string) => {
    setProcesandoId(orderId)
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          estado: 'DELIVERED',
          delivery_status: 'DELIVERED',
          entregado_at: new Date().toISOString()
        })
        .eq('id', orderId)

      if (error) throw error
    } catch (e: any) {
      console.error('Error al entregar pedido:', e)
      alert('⚠️ Error al completar la entrega: ' + e.message)
    } finally {
      setProcesandoId(null)
    }
  }

  // Filtrado de Pedidos por Pestaña
  const pedidosDisponibles = orders.filter(o => o.estado === 'READY_TO_SHIP')
  const misPedidosRuta = orders.filter(
    o => o.estado === 'IN_TRANSIT' && o.delivery_token?.toLowerCase() === bikerName.trim().toLowerCase()
  )

  if (cargandoBusiness) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center text-zinc-650 p-6 font-sans">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-4" />
        <p className="text-xs font-bold uppercase tracking-widest font-mono text-zinc-500">Conectando Portal Biker...</p>
      </div>
    )
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center text-zinc-650 p-6 font-sans text-center">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-4" />
        <p className="text-sm font-bold uppercase tracking-widest font-mono text-[#09090b] mb-2">Comercio No Encontrado</p>
        <p className="text-xs text-zinc-500 max-w-xs font-medium">El enlace de este portal es inválido o no corresponde a una sucursal activa.</p>
      </div>
    )
  }

  if (!bikerName) {
    return (
      <div className="min-h-screen bg-[#fafafa] text-[#09090b] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden select-none">
        {/* Decorative background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-sm space-y-8 relative z-10 text-center animate-fadeIn">
          {/* Animated Icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-3xl flex items-center justify-center shadow-lg border border-blue-400/20 animate-pulse">
              <Bike className="w-10 h-10 text-white" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tight text-[#09090b] leading-tight">Portal de Repartidores</h1>
            <p className="text-xs text-zinc-500 font-medium">
              Bienvenido al portal de entregas para <span className="text-blue-600 font-bold">{business.nombre}</span>.
            </p>
          </div>

          <form onSubmit={handleSaveName} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider pl-1">
                ¿Quién conduce hoy?
              </label>
              <input
                type="text"
                required
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="Ingresa tu nombre..."
                className="w-full bg-white border border-zinc-200 focus:border-blue-500 focus:outline-none rounded-2xl px-5 py-4 text-sm font-semibold placeholder-zinc-400 transition-all text-[#09090b]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-widest rounded-2xl shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              Comenzar Reparto 🚀
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#09090b] flex flex-col font-sans pb-12 selection:bg-blue-600 selection:text-white">
      
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-zinc-200 p-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
              <Bike className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-[#09090b] leading-tight">Portal Biker</h1>
              <p className="text-[10px] font-mono text-blue-600 uppercase tracking-wider mt-0.5">{business.nombre}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">En Línea</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto px-4 py-6 space-y-6">
        
        {/* ── REPARTIDOR ACTIVO ── */}
        <section className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm">
          {isEditingName ? (
            <form onSubmit={handleSaveName} className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Cambiar Nombre de Repartidor</label>
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className="text-[10px] font-bold text-zinc-400 hover:text-zinc-500 uppercase cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  placeholder="Tu Nombre (ej: Samuel M.)"
                  className="flex-1 bg-white border border-zinc-200 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-3 text-sm font-semibold placeholder-zinc-400 transition-colors text-[#09090b]"
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest px-5 rounded-xl shadow transition-colors cursor-pointer"
                >
                  Fijar
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Repartidor Activo</p>
                  <p className="text-sm font-black text-[#09090b]">{bikerName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNameInput(bikerName)
                  setIsEditingName(true)
                }}
                className="text-xs text-blue-600 hover:text-blue-700 font-bold uppercase cursor-pointer transition-colors"
              >
                Cambiar
              </button>
            </div>
          )}
        </section>

        {/* ── TABS ── */}
        <div className="bg-white p-1 rounded-xl border border-zinc-200 grid grid-cols-2 gap-1 relative z-10 shadow-sm">
          <button
            onClick={() => setActiveTab('disponibles')}
            className={`py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'disponibles'
                ? 'bg-[#f4f4f5] text-[#09090b] border border-zinc-200'
                : 'text-zinc-500 hover:text-[#09090b]'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Disponibles</span>
            {pedidosDisponibles.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                {pedidosDisponibles.length}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('mi_ruta')}
            className={`py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'mi_ruta'
                ? 'bg-[#f4f4f5] text-[#09090b] border border-zinc-200'
                : 'text-zinc-500 hover:text-[#09090b]'
            }`}
          >
            <Bike className="w-4 h-4" />
            <span>Mi Ruta</span>
            {misPedidosRuta.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                {misPedidosRuta.length}
              </span>
            )}
          </button>
        </div>

        {/* ── LISTADO DE PEDIDOS ── */}
        <section className="space-y-4">
          {cargandoOrders ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin text-zinc-400" />
              <p className="text-xs text-zinc-400 uppercase tracking-widest font-mono">Buscando comandas...</p>
            </div>
          ) : activeTab === 'disponibles' ? (
            pedidosDisponibles.length === 0 ? (
              <div className="text-center py-12 bg-white border border-dashed border-zinc-200 rounded-2xl p-6">
                <span className="text-3xl block mb-2">📦</span>
                <h3 className="text-sm font-bold text-zinc-700 uppercase">Sin pedidos listos</h3>
                <p className="text-xs text-zinc-500 mt-1 font-medium">Cuando cocina marque una comanda como lista para enviar, aparecerá aquí al instante.</p>
              </div>
            ) : (
              pedidosDisponibles.map(order => (
                <div
                  key={order.id}
                  className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-4 hover:border-zinc-300 transition-colors animate-fadeIn"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-mono font-bold bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-full text-zinc-600 uppercase">
                        #{order.id.slice(-4).toUpperCase()}
                      </span>
                      <h4 className="font-bold text-sm text-[#09090b] mt-2">{order.nombre_cliente}</h4>
                      <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        Colonia: <span className="text-zinc-700 font-semibold">{order.colonia || 'Centro'}</span>
                      </p>
                    </div>
                    
                    <div className="text-right space-y-1">
                      <p className="text-[10px] font-mono text-zinc-400 uppercase">Monto Total</p>
                      <p className="text-sm font-black text-blue-600">${Number(order.total).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-100 pt-3 text-xs">
                    <span className="text-zinc-400">Forma de Pago:</span>
                    <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[9px] border flex items-center gap-1 ${
                      order.metodo_pago === 'tarjeta'
                        ? 'bg-blue-50 border-blue-100 text-blue-600'
                        : 'bg-emerald-50 border-emerald-100 text-emerald-600'
                    }`}>
                      {order.metodo_pago === 'tarjeta' ? (
                        <>
                          <CreditCard className="w-3 h-3" /> Tarjeta
                        </>
                      ) : (
                        <>
                          <DollarSign className="w-3 h-3" /> Efectivo
                        </>
                      )}
                    </span>
                  </div>

                  <button
                    onClick={() => handleTomarPedido(order.id)}
                    disabled={procesandoId !== null}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                  >
                    {procesandoId === order.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      '🚀 Tomar Pedido'
                    )}
                  </button>
                </div>
              ))
            )
          ) : (
            misPedidosRuta.length === 0 ? (
              <div className="text-center py-12 bg-white border border-dashed border-zinc-200 rounded-2xl p-6 font-medium">
                <span className="text-3xl block mb-2">🏍️</span>
                <h3 className="text-sm font-bold text-zinc-700 uppercase">Tu ruta está vacía</h3>
                <p className="text-xs text-zinc-500 mt-1">Ve a la pestaña "Disponibles" para tomar tu primer pedido y empezar tu ruta de reparto.</p>
              </div>
            ) : (
              misPedidosRuta.map(order => (
                <div
                  key={order.id}
                  className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-4 hover:border-zinc-300 transition-colors animate-fadeIn"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-mono font-bold bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full text-amber-700 uppercase">
                        #{order.id.slice(-4).toUpperCase()}
                      </span>
                      <h4 className="font-bold text-sm text-[#09090b] mt-2">{order.nombre_cliente}</h4>
                      <p className="text-xs text-zinc-500 mt-1.5 flex items-center gap-1 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        Dirección: <span className="text-zinc-700 font-semibold">{order.calle || ''} #{order.numero || ''}, {order.colonia || ''}</span>
                      </p>
                    </div>

                    <div className="text-right space-y-1">
                      <p className="text-[10px] font-mono text-zinc-400 uppercase">Monto Total</p>
                      <p className="text-sm font-black text-blue-600">${Number(order.total).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-100 pt-3 text-xs">
                    <span className="text-zinc-400">Cobro del Pedido:</span>
                    <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[9px] border flex items-center gap-1 ${
                      order.metodo_pago === 'tarjeta'
                        ? 'bg-blue-50 border-blue-100 text-blue-600'
                        : 'bg-emerald-50 border-emerald-100 text-emerald-600'
                    }`}>
                      {order.metodo_pago === 'tarjeta' ? 'Tarjeta' : 'Cobrar Efectivo'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 border-t border-zinc-100 pt-3">
                    <button
                      onClick={() => {
                        const direccion = `${order.calle || ''} ${order.numero || ''}`.trim()
                        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion + ' ' + order.colonia + ' Uruapan')}`, '_blank')
                      }}
                      className="w-full py-3 bg-[#f4f4f5] hover:bg-zinc-100 text-emerald-600 border border-zinc-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Navigation className="w-4 h-4" />
                      <span>🗺️ Ver Dirección en Google Maps</span>
                    </button>

                    <button
                      onClick={() => handleEntregarPedido(order.id)}
                      disabled={procesandoId !== null}
                      className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                    >
                      {procesandoId === order.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>✅ Entregado con Éxito</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))
            )
          )}
        </section>
      </main>
    </div>
  )
}
