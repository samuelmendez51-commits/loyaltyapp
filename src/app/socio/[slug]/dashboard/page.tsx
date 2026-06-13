'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ChefHat,
  Bell,
  Clock,
  Settings,
  History,
  Truck,
  CheckCircle,
  Play,
  Check,
  AlertTriangle,
  RefreshCw,
  Printer,
  Sliders,
  DollarSign,
  Info
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
  tipo: string
  items: any
  total: number
  estado: string
  created_at: string
  aceptado_at?: string
  listo_at?: string
  repartidor_solicitado_at?: string
  tengo_el_pedido_at?: string
  entregado_at?: string
  delayed_minutes?: number
}

export default function SocioDashboardPage() {
  const params = useParams()
  const slug = (params.slug as string) || ''

  const [business, setBusiness] = useState<any>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [cargando, setCargando] = useState(true)
  const [pestanaActiva, setPestanaActiva] = useState<'pedidos' | 'repartidor' | 'ordenes' | 'configuracion'>('pedidos')
  
  // Realtime Connection State
  const [connected, setConnected] = useState(true)
  const [delayMenuOrderId, setDelayMenuOrderId] = useState<string | null>(null)

  // Configuration state
  const [config, setConfig] = useState({
    auto_aceptar: false,
    imprimir_automatico: false,
    tiene_autocorte: true,
    tipo_impresora: 'bluetooth',
    config_impresora: '',
    tamano_fuente: 'normal'
  })
  const [cargandoConfig, setCargandoConfig] = useState(true)
  const [imprimiendo, setImprimiendo] = useState(false)

  // Solicitar Repartidor states
  const [requestActivo, setRequestActivo] = useState<any>(null)
  const [solicitando, setSolicitando] = useState(false)

  // Historial/Órdenes states
  const getBeginningOfMonth = () => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  }
  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0]
  }
  const [fechaInicio, setFechaInicio] = useState(getBeginningOfMonth())
  const [fechaFin, setFechaFin] = useState(getTodayDate())
  const [historialOrdenes, setHistorialOrdenes] = useState<Order[]>([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)

  // Timer Tick for semáforo countdown
  const [currentTime, setCurrentTime] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 10000)
    return () => clearInterval(interval)
  }, [])

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

  // 2. Cargar configuración de hardware reactiva
  useEffect(() => {
    if (!business?.id) return
    setCargandoConfig(true)
    supabase.from('terminal_config')
      .select('*')
      .eq('business_id', business.id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (data) {
          setConfig({
            auto_aceptar: data.auto_aceptar || false,
            imprimir_automatico: data.imprimir_automatico || false,
            tiene_autocorte: data.tiene_autocorte || false,
            tipo_impresora: data.tipo_impresora || 'bluetooth',
            config_impresora: data.config_impresora || '',
            tamano_fuente: data.tamano_fuente || 'normal'
          })
        } else {
          const { data: newC } = await supabase.from('terminal_config')
            .insert({
              business_id: business.id,
              auto_aceptar: false,
              imprimir_automatico: false,
              tiene_autocorte: true,
              tipo_impresora: 'bluetooth',
              config_impresora: '',
              tamano_fuente: 'normal'
            })
            .select()
            .single()
          if (newC) {
            setConfig({
              auto_aceptar: newC.auto_aceptar,
              imprimir_automatico: newC.imprimir_automatico,
              tiene_autocorte: newC.tiene_autocorte,
              tipo_impresora: newC.tipo_impresora,
              config_impresora: newC.config_impresora || '',
              tamano_fuente: newC.tamano_fuente
            })
          }
        }
        setCargandoConfig(false)
      })
  }, [business?.id])

  // 3. Cargar solicitudes de repartidor activas
  const checkActiveRequest = useCallback(async () => {
    if (!business?.id) return
    const { data } = await supabase
      .from('delivery_requests')
      .select('*, bikers(nombre, telefono)')
      .eq('restaurante_id', business.id)
      .not('estado', 'in', '("completado","cancelado_restaurante")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) setRequestActivo(data)
    else setRequestActivo(null)
  }, [business?.id])

  useEffect(() => {
    checkActiveRequest()
    if (!business?.id) return

    const channel = supabase.channel(`socio_delivery_${business.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'delivery_requests',
        filter: `restaurante_id=eq.${business.id}`
      }, () => {
        checkActiveRequest()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [business?.id, checkActiveRequest])

  // 4. Suscripción Realtime a Órdenes Activas
  useEffect(() => {
    if (!business?.id) return
    setCargando(true)

    // Cargar órdenes iniciales activas en cocina
    supabase.from('orders')
      .select('*')
      .eq('business_id', business.id)
      .in('estado', ['pendiente', 'preparacion', 'listo'])
      .is('tengo_el_pedido_at', null)
      .is('entregado_at', null)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setOrders(data)
        setCargando(false)
      })

    const channel = supabase.channel(`socio_orders_${business.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `business_id=eq.${business.id}`
      }, (payload) => {
        setConnected(true)
        if (payload.eventType === 'INSERT') {
          const newOrder = payload.new as Order
          setOrders(prev => {
            if (prev.some(o => o.id === newOrder.id)) return prev
            if (['pendiente', 'preparacion', 'listo'].includes(newOrder.estado) && !newOrder.tengo_el_pedido_at && !newOrder.entregado_at) {
              return [...prev, newOrder]
            }
            return prev
          })
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as Order
          setOrders(prev => {
            if (!['pendiente', 'preparacion', 'listo'].includes(updated.estado) || updated.tengo_el_pedido_at || updated.entregado_at) {
              return prev.filter(o => o.id !== updated.id)
            }
            if (prev.some(o => o.id === updated.id)) {
              return prev.map(o => o.id === updated.id ? updated : o)
            } else {
              return [...prev, updated]
            }
          })
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

  // 5. Cargar Historial de Órdenes
  const cargarHistorial = useCallback(async () => {
    if (!business?.id) return
    setCargandoHistorial(true)
    try {
      const start = new Date(fechaInicio + 'T00:00:00').toISOString()
      const end = new Date(fechaFin + 'T23:59:59').toISOString()
      
      const { data, error } = await supabase.from('orders')
        .select('*')
        .eq('business_id', business.id)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false })

      if (error) throw error
      setHistorialOrdenes(data || [])
    } catch (e: any) {
      console.error('Error al cargar historial:', e)
    } finally {
      setCargandoHistorial(false)
    }
  }, [business?.id, fechaInicio, fechaFin])

  useEffect(() => {
    if (pestanaActiva === 'ordenes') {
      cargarHistorial()
    }
  }, [pestanaActiva, cargarHistorial])

  // ── Handlers de Órdenes ──────────────────────────────────────────────────
  const handleAceptar = async (orderId: string) => {
    try {
      const now = new Date().toISOString()
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, estado: 'preparacion', aceptado_at: now } : o))
      await supabase.from('orders')
        .update({ estado: 'preparacion', aceptado_at: now })
        .eq('id', orderId)
    } catch (e) {
      console.error(e)
    }
  }

  const handleListo = async (orderId: string) => {
    try {
      const now = new Date().toISOString()
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, estado: 'listo', listo_at: now } : o))
      await supabase.from('orders')
        .update({ estado: 'listo', listo_at: now })
        .eq('id', orderId)
    } catch (e) {
      console.error(e)
    }
  }

  const handleReportarRetraso = async (orderId: string, minutes: number | null) => {
    try {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, delayed_minutes: minutes ?? undefined } : o))
      await supabase.from('orders')
        .update({ delayed_minutes: minutes })
        .eq('id', orderId)
    } catch (e) {
      console.error(e)
    }
  }

  const handleEntregado = async (orderId: string) => {
    try {
      const now = new Date().toISOString()
      setOrders(prev => prev.filter(o => o.id !== orderId))
      await supabase.from('orders')
        .update({ estado: 'entregado', entregado_at: now })
        .eq('id', orderId)
    } catch (e) {
      console.error(e)
    }
  }

  // ── Handler de Repartidor ─────────────────────────────────────────────────
  const handlePedirMoto = async () => {
    if (!business?.id) return
    setSolicitando(true)
    try {
      const { data: fleets } = await supabase
        .from('delivery_fleets')
        .select('id')
        .eq('activo', true)
        .limit(1)

      if (!fleets || fleets.length === 0) {
        alert('⚠️ Error: No hay flotas de reparto activas en la plataforma.')
        setSolicitando(false)
        return
      }

      const { error } = await supabase
        .from('delivery_requests')
        .insert({
          fleet_id: fleets[0].id,
          restaurante_id: business.id,
          descripcion: 'Solicitado desde la Terminal de Cocina',
          direccion_entrega: 'Recolección en Cocina (Tablet)',
          distancia_km: 1.0,
          tarifa_base: 40,
          tarifa_extra: 0,
          total_cobrado: 40,
          estado: 'pendiente'
        })

      if (error) throw error
      alert('🏍️ ¡Moto solicitada! Alerta global enviada a los repartidores.')
      checkActiveRequest()
    } catch (e: any) {
      alert('Error al solicitar repartidor: ' + e.message)
    } finally {
      setSolicitando(false)
    }
  }

  const handleCancelarRequest = async () => {
    if (!requestActivo) return
    if (!confirm('¿Cancelar esta solicitud de repartidor?')) return
    try {
      await supabase
        .from('delivery_requests')
        .update({ estado: 'cancelado_restaurante', cancelado_at: new Date().toISOString() })
        .eq('id', requestActivo.id)
      setRequestActivo(null)
    } catch (err: any) {
      alert('Error al cancelar: ' + err.message)
    }
  }

  // ── Handler de Configuración ──────────────────────────────────────────────
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!business?.id) return
    try {
      const { error } = await supabase.from('terminal_config')
        .update({
          auto_aceptar: config.auto_aceptar,
          imprimir_automatico: config.imprimir_automatico,
          tiene_autocorte: config.tiene_autocorte,
          tipo_impresora: config.tipo_impresora,
          config_impresora: config.config_impresora,
          tamano_fuente: config.tamano_fuente,
          updated_at: new Date().toISOString()
        })
        .eq('business_id', business.id)

      if (error) throw error
      alert('💾 ¡Configuración guardada correctamente!')
    } catch (err: any) {
      alert('Error al guardar configuración: ' + err.message)
    }
  }

  const handleImprimirPrueba = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!config.config_impresora) return
    setImprimiendo(true)
    try {
      const response = await fetch('/api/hardware/print-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tipo_impresora: config.tipo_impresora,
          config_impresora: config.config_impresora,
          tamano_fuente: config.tamano_fuente,
          tiene_autocorte: config.tiene_autocorte,
          tenant: business?.name || slug
        })
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Error desconocido')
      }
      alert('💾 ¡Impresión de prueba enviada con éxito!')
    } catch (err: any) {
      alert('Error al imprimir página de prueba: ' + err.message)
    } finally {
      setImprimiendo(false)
    }
  }

  // ── Lógica del Semáforo ──────────────────────────────────────────────────
  const getOldestWaitTime = () => {
    const activeWaitOrders = orders.filter(o => o.estado === 'pendiente' || o.estado === 'preparacion')
    if (activeWaitOrders.length === 0) return 0
    const oldestTime = Math.min(...activeWaitOrders.map(o => new Date(o.created_at).getTime()))
    return Math.floor((currentTime - oldestTime) / 60000)
  }

  const elapsed = getOldestWaitTime()
  const activeCount = orders.filter(o => o.estado === 'pendiente' || o.estado === 'preparacion').length

  let semaforoBg = 'bg-emerald-500 text-white'
  let semaforoLabel = 'Cocina al día 🍳'
  let semaforoSub = 'No hay órdenes retrasadas'

  if (activeCount > 0) {
    if (elapsed < 15) {
      semaforoBg = 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.25)]'
      semaforoLabel = `Demora Cocina: ${elapsed} min`
      semaforoSub = `Cola activa: ${activeCount} pedido(s)`
    } else if (elapsed <= 25) {
      semaforoBg = 'bg-amber-500 text-zinc-950 shadow-[0_0_15px_rgba(245,158,11,0.25)] font-bold'
      semaforoLabel = `Demora Moderada: ${elapsed} min ⏳`
      semaforoSub = 'Agilizar tiempos de cocción'
    } else {
      semaforoBg = 'bg-rose-600 text-white shadow-[0_0_25px_rgba(225,29,72,0.35)] animate-pulse'
      semaforoLabel = `ALERTA DE RETRASO: ${elapsed} min 🚨`
      semaforoSub = 'Prioridad absoluta - Cocina saturada'
    }
  }

  const getParsedItems = (items: any) => {
    if (!items) return []
    if (Array.isArray(items)) return items
    try {
      return JSON.parse(items)
    } catch (e) {
      return []
    }
  }

  if (cargando && !business) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400">
        <RefreshCw className="w-8 h-8 animate-spin text-[#dc2626] mb-4" />
        <p className="text-sm font-semibold uppercase tracking-widest font-mono">Conectando con la base de datos de socios...</p>
      </div>
    )
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 p-6">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-4" />
        <p className="text-sm font-bold uppercase tracking-widest font-mono text-white mb-2">Comercio No Encontrado</p>
        <p className="text-xs text-zinc-500 text-center max-w-sm">Verifica que el subdominio corresponda a un restaurante válido registrado en LoyaltyClub.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex font-sans overflow-hidden h-screen text-[#09090b]">
      
      {/* ── SIDEBAR DE LA TABLET ── */}
      <aside className="w-64 bg-zinc-950 text-white flex flex-col justify-between p-6 shrink-0 shadow-2xl relative z-20">
        <div className="space-y-8">
          
          {/* Logo y Marca */}
          <div className="flex items-center gap-3 border-b border-zinc-900 pb-5">
            <div className="w-10 h-10 bg-[#dc2626] rounded-xl flex items-center justify-center shadow-lg shadow-red-950/20 shrink-0">
              <span className="text-xl">🍳</span>
            </div>
            <div className="min-w-0">
              <h1 className="font-serif font-black text-white text-lg truncate leading-tight">{business.nombre}</h1>
              <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5">Terminal de Cocina</p>
            </div>
          </div>

          {/* Menú de pestañas */}
          <nav className="space-y-2">
            {[
              { id: 'pedidos', label: 'Monitor de Pedidos', icon: ChefHat },
              { id: 'repartidor', label: 'Pedir Repartidor', icon: Truck },
              { id: 'ordenes', label: 'Auditoría Mensual', icon: History },
              { id: 'configuracion', label: 'Config. Hardware', icon: Settings },
            ].map(tab => {
              const Icon = tab.icon
              const active = pestanaActiva === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setPestanaActiva(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                    active
                      ? 'bg-[#fef2f2] text-[#dc2626] border border-red-500/10 shadow-lg'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#dc2626]' : 'text-zinc-500'}`} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Footer info */}
        <div className="space-y-3 border-t border-zinc-900 pt-4">
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-rose-500'} inline-block shrink-0`} />
            <span className="text-zinc-400 uppercase tracking-wider">{connected ? 'Servidor Realtime' : 'Desconectado'}</span>
          </div>
          <p className="text-[9px] text-zinc-600 font-mono tracking-widest uppercase">LoyaltyClub v14 · Kitchen Tablet</p>
        </div>
      </aside>

      {/* ── AREA PRINCIPAL DE PANTALLA ── */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#fafafa]">
        
        {/* Cabecera Superior del Área de Contenido */}
        <header className="h-16 border-b border-zinc-200 bg-white flex items-center justify-between px-6 shrink-0 shadow-sm relative z-10">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">
            {pestanaActiva === 'pedidos' ? 'Panel de Preparación' : pestanaActiva === 'repartidor' ? 'Solicitar Biker de Flota' : pestanaActiva === 'ordenes' ? 'Historial de Órdenes' : 'Ajustes de Impresoras'}
          </h2>
          <div className="text-xs font-mono font-bold text-zinc-500">
            {new Date(currentTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </header>

        {/* Cuerpo Dinámico */}
        <section className="flex-1 overflow-y-auto p-6 bg-[#fafafa]">
          <div className="h-full">

            {/* A) PESTAÑA: PEDIDOS */}
            {pestanaActiva === 'pedidos' && (
              <div className="space-y-6 h-full flex flex-col">
                
                {/* Semáforo Superior */}
                <div className={`p-5 rounded-2xl flex items-center justify-between transition-all duration-300 ${semaforoBg}`}>
                  <div className="space-y-1">
                    <h3 className="text-lg font-black tracking-wider uppercase font-mono">{semaforoLabel}</h3>
                    <p className="text-xs opacity-90">{semaforoSub}</p>
                  </div>
                  <div className="text-4xl">
                    {elapsed >= 25 ? '🚨' : elapsed >= 15 ? '⏳' : '🟢'}
                  </div>
                </div>

                {/* Grid de 3 columnas de preparación */}
                {cargando ? (
                  <div className="flex-1 flex items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 animate-spin text-[#dc2626]" />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-6 flex-1 items-start min-h-0 overflow-y-auto pb-8">
                    
                    {/* Columna 1: Pendientes */}
                    <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm flex flex-col space-y-4">
                      <div className="border-b border-zinc-100 pb-3 flex justify-between items-center">
                        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                          📥 Pendientes ({orders.filter(o => o.estado === 'pendiente').length})
                        </h4>
                      </div>
                      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                        {orders.filter(o => o.estado === 'pendiente').map(order => {
                          const items = getParsedItems(order.items)
                          const minElapsed = Math.floor((currentTime - new Date(order.created_at).getTime()) / 60000)
                          return (
                            <div key={order.id} className="border border-zinc-200 rounded-xl p-4 hover:border-zinc-300 transition-colors shadow-sm space-y-3 relative overflow-hidden bg-[#fafafa]">
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-[10px] font-mono font-bold bg-zinc-200 px-2 py-0.5 rounded-full text-zinc-800 uppercase">
                                    #{order.id.slice(-4).toUpperCase()}
                                  </span>
                                  <h5 className="font-bold text-sm text-zinc-900 mt-1.5">{order.nombre_cliente}</h5>
                                </div>
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${order.tipo === 'delivery' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                                  {order.tipo}
                                </span>
                              </div>

                              <div className="border-t border-b border-zinc-100 py-2.5 my-1.5 space-y-1.5">
                                {items.map((item: any, idx: number) => (
                                  <div key={idx} className="flex justify-between text-xs font-medium text-zinc-700">
                                    <span>{item.cantidad || item.qty || 1}x {item.nombre || item.name}</span>
                                  </div>
                                ))}
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Hace {minElapsed} min</span>
                                <span className="font-bold text-zinc-700 text-xs">${order.total}</span>
                              </div>

                              {order.notas && (
                                <p className="text-[10px] text-zinc-500 bg-amber-50/50 p-2 rounded-lg border border-amber-100 leading-relaxed">
                                  <strong>Nota:</strong> {order.notas}
                                </p>
                              )}

                              <button
                                onClick={() => handleAceptar(order.id)}
                                className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold text-xs py-2 px-3 rounded-lg uppercase tracking-wider transition-colors flex items-center justify-center gap-1 shadow-sm active:scale-[0.98]"
                              >
                                <Play className="w-3 h-3 fill-current" /> Aceptar
                              </button>
                            </div>
                          )
                        })}
                        {orders.filter(o => o.estado === 'pendiente').length === 0 && (
                          <p className="text-zinc-400 text-xs text-center py-8 font-mono">Sin pedidos pendientes</p>
                        )}
                      </div>
                    </div>

                    {/* Columna 2: En Preparación */}
                    <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm flex flex-col space-y-4">
                      <div className="border-b border-zinc-100 pb-3 flex justify-between items-center">
                        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                          🍳 En Cocción ({orders.filter(o => o.estado === 'preparacion').length})
                        </h4>
                      </div>
                      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                        {orders.filter(o => o.estado === 'preparacion').map(order => {
                          const items = getParsedItems(order.items)
                          const minElapsed = Math.floor((currentTime - new Date(order.created_at).getTime()) / 60000)
                          return (
                            <div key={order.id} className="border border-zinc-200 rounded-xl p-4 hover:border-zinc-300 transition-colors shadow-sm space-y-3 relative overflow-hidden bg-[#fafafa]">
                              {order.delayed_minutes && order.delayed_minutes > 0 ? (
                                <div className="bg-rose-50 text-rose-700 border border-rose-150 rounded-lg p-2 text-xs font-bold flex items-center gap-1.5 animate-pulse">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>Cocina reporta retraso de +{order.delayed_minutes} min</span>
                                </div>
                              ) : null}

                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-[10px] font-mono font-bold bg-amber-100 px-2 py-0.5 rounded-full text-amber-800 uppercase">
                                    #{order.id.slice(-4).toUpperCase()}
                                  </span>
                                  <h5 className="font-bold text-sm text-zinc-900 mt-1.5">{order.nombre_cliente}</h5>
                                </div>
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${order.tipo === 'delivery' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                                  {order.tipo}
                                </span>
                              </div>

                              <div className="border-t border-b border-zinc-100 py-2.5 my-1.5 space-y-1.5">
                                {items.map((item: any, idx: number) => (
                                  <div key={idx} className="flex justify-between text-xs font-medium text-zinc-700">
                                    <span>{item.cantidad || item.qty || 1}x {item.nombre || item.name}</span>
                                  </div>
                                ))}
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Preparando: {minElapsed} min</span>
                                <span className="font-bold text-zinc-700 text-xs">${order.total}</span>
                              </div>

                              {order.notas && (
                                <p className="text-[10px] text-zinc-500 bg-amber-50/50 p-2 rounded-lg border border-amber-100 leading-relaxed">
                                  <strong>Nota:</strong> {order.notas}
                                </p>
                              )}

                              <div className="flex gap-2 relative">
                                <button
                                  onClick={() => handleListo(order.id)}
                                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-lg uppercase tracking-wider transition-colors flex items-center justify-center gap-1 shadow-sm active:scale-[0.98]"
                                >
                                  <Check className="w-3.5 h-3.5" /> Listo
                                </button>
                                
                                <div className="relative">
                                  <button
                                    onClick={() => setDelayMenuOrderId(delayMenuOrderId === order.id ? null : order.id)}
                                    className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs py-2 px-3 rounded-lg uppercase tracking-wider transition-colors flex items-center justify-center gap-1 shadow-sm border border-zinc-200"
                                  >
                                    ⏳ Retraso
                                  </button>
                                  
                                  {delayMenuOrderId === order.id && (
                                    <div className="absolute right-0 bottom-full mb-2 w-32 bg-white border border-zinc-200 rounded-xl shadow-xl z-30 py-1 text-xs">
                                      <button
                                        onClick={() => {
                                          handleReportarRetraso(order.id, 10)
                                          setDelayMenuOrderId(null)
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-zinc-50 font-semibold text-zinc-700"
                                      >
                                        +10 min
                                      </button>
                                      <button
                                        onClick={() => {
                                          handleReportarRetraso(order.id, 15)
                                          setDelayMenuOrderId(null)
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-zinc-50 font-semibold text-zinc-700"
                                      >
                                        +15 min
                                      </button>
                                      <button
                                        onClick={() => {
                                          handleReportarRetraso(order.id, 25)
                                          setDelayMenuOrderId(null)
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-zinc-50 font-semibold text-zinc-700"
                                      >
                                        +25 min
                                      </button>
                                      {order.delayed_minutes && order.delayed_minutes > 0 ? (
                                        <button
                                          onClick={() => {
                                            handleReportarRetraso(order.id, null)
                                            setDelayMenuOrderId(null)
                                          }}
                                          className="w-full text-left px-3 py-2 hover:bg-rose-50 font-semibold text-rose-600 border-t border-zinc-100"
                                        >
                                          Quitar Retraso
                                        </button>
                                      ) : null}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        {orders.filter(o => o.estado === 'preparacion').length === 0 && (
                          <p className="text-zinc-400 text-xs text-center py-8 font-mono">Sin pedidos en cocción</p>
                        )}
                      </div>
                    </div>

                    {/* Columna 3: Listos para Despachar */}
                    <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm flex flex-col space-y-4">
                      <div className="border-b border-zinc-100 pb-3 flex justify-between items-center">
                        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                          🏁 Listos / Despachar ({orders.filter(o => o.estado === 'listo').length})
                        </h4>
                      </div>
                      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                        {orders.filter(o => o.estado === 'listo').map(order => {
                          const items = getParsedItems(order.items)
                          return (
                            <div key={order.id} className="border border-zinc-200 rounded-xl p-4 hover:border-zinc-300 transition-colors shadow-sm space-y-3 relative overflow-hidden bg-emerald-50/25 border-emerald-100">
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-[10px] font-mono font-bold bg-emerald-100 px-2 py-0.5 rounded-full text-emerald-800 uppercase">
                                    #{order.id.slice(-4).toUpperCase()}
                                  </span>
                                  <h5 className="font-bold text-sm text-zinc-900 mt-1.5">{order.nombre_cliente}</h5>
                                </div>
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                  Listo
                                </span>
                              </div>

                              <div className="border-t border-b border-emerald-100 py-2.5 my-1.5 space-y-1.5">
                                {items.map((item: any, idx: number) => (
                                  <div key={idx} className="flex justify-between text-xs font-semibold text-emerald-950">
                                    <span>{item.cantidad || item.qty || 1}x {item.nombre || item.name}</span>
                                  </div>
                                ))}
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-zinc-500">
                                <span>Tipo: <strong>{order.tipo.toUpperCase()}</strong></span>
                                <span className="font-bold text-zinc-800 text-xs">${order.total}</span>
                              </div>

                              <button
                                onClick={() => handleEntregado(order.id)}
                                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs py-2 px-3 rounded-lg uppercase tracking-wider transition-colors flex items-center justify-center gap-1 shadow-sm active:scale-[0.98]"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Entregar Pedido
                              </button>
                            </div>
                          )
                        })}
                        {orders.filter(o => o.estado === 'listo').length === 0 && (
                          <p className="text-zinc-400 text-xs text-center py-8 font-mono">Sin pedidos listos</p>
                        )}
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* B) PESTAÑA: SOLICITAR REPARTIDOR */}
            {pestanaActiva === 'repartidor' && (
              <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
                <div className="bg-white border border-zinc-200 rounded-3xl p-8 shadow-sm flex flex-col items-center text-center space-y-6">
                  <div className="w-20 h-20 bg-red-50 border border-red-100 rounded-full flex items-center justify-center shadow-inner">
                    <Truck className="w-10 h-10 text-[#dc2626]" />
                  </div>
                  
                  <div className="space-y-2 max-w-md">
                    <h3 className="text-xl font-black text-zinc-900 uppercase tracking-tight font-serif">Llamar Repartidor Express</h3>
                    <p className="text-sm text-zinc-500 leading-relaxed">
                      Envía una alerta global inmediata al pool de bikers de tu flota local. El primer biker disponible aceptará el viaje y se dirigirá a la cocina.
                    </p>
                  </div>

                  {requestActivo ? (
                    <div className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-2xl p-6 text-left space-y-4 animate-pulse">
                      <div className="flex justify-between items-center border-b border-zinc-150 pb-3">
                        <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Solicitud de Biker Activa</span>
                        <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                          {requestActivo.estado === 'pendiente' ? 'Buscando Repartidor...' : `Asignado: ${requestActivo.bikers?.nombre || 'Biker'}`}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-zinc-400 block font-mono text-[9px] uppercase tracking-wider">Dirección</span>
                          <span className="font-bold text-zinc-800">{requestActivo.direccion_entrega}</span>
                        </div>
                        <div>
                          <span className="text-zinc-400 block font-mono text-[9px] uppercase tracking-wider">Fecha / Hora</span>
                          <span className="font-bold text-zinc-800">{new Date(requestActivo.created_at).toLocaleTimeString('es-MX')}</span>
                        </div>
                      </div>
                      
                      {requestActivo.bikers && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-emerald-900">{requestActivo.bikers.nombre}</p>
                            <p className="text-[10px] text-emerald-700 font-mono mt-0.5">Tel: {requestActivo.bikers.telefono || '—'}</p>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={handleCancelarRequest}
                        className="w-full bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 hover:text-rose-700 font-bold text-xs py-3 rounded-xl uppercase tracking-wider transition-colors"
                      >
                        ❌ Cancelar Solicitud de Moto
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handlePedirMoto}
                      disabled={solicitando}
                      className="w-full max-w-sm bg-gradient-to-r from-[#dc2626] to-red-600 hover:from-red-650 hover:to-red-750 text-white font-black text-sm uppercase tracking-widest py-5 px-8 rounded-2xl shadow-xl shadow-red-500/10 hover:shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer"
                    >
                      {solicitando ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          <span>Despachando Moto...</span>
                        </>
                      ) : (
                        <>
                          <span>PEDIR UNA MOTO 🏍️</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* C) PESTAÑA: ORDENES */}
            {pestanaActiva === 'ordenes' && (
              <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm animate-fadeIn">
                <div className="p-6 border-b border-zinc-200 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white">
                  <div>
                    <h3 className="font-bold text-zinc-900 text-sm uppercase tracking-wider">Historial de Órdenes</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">Auditoría del mes corriente</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <input
                      type="date"
                      value={fechaInicio}
                      onChange={e => setFechaInicio(e.target.value)}
                      className="border border-zinc-200 bg-slate-50 px-3 py-2 rounded-xl focus:outline-none focus:border-[#dc2626] text-xs font-mono"
                    />
                    <span className="text-zinc-400">al</span>
                    <input
                      type="date"
                      value={fechaFin}
                      onChange={e => setFechaFin(e.target.value)}
                      className="border border-zinc-200 bg-slate-50 px-3 py-2 rounded-xl focus:outline-none focus:border-[#dc2626] text-xs font-mono"
                    />
                    <button
                      onClick={cargarHistorial}
                      className="bg-zinc-900 text-white px-4 py-2 rounded-xl hover:bg-zinc-800 transition-colors uppercase text-[10px] font-bold tracking-wider"
                    >
                      Filtrar
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#fafafa] border-b border-zinc-200 text-zinc-500">
                      <tr>
                        {['Fecha / Hora', 'Orden', 'Cliente', 'Tipo', 'Productos', 'Total (MXN)', 'Estado'].map(h => (
                          <th key={h} className="px-5 py-4 font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {cargandoHistorial ? (
                        <tr>
                          <td colSpan={7} className="text-center py-12">
                            <RefreshCw className="w-6 h-6 animate-spin text-[#dc2626] mx-auto" />
                          </td>
                        </tr>
                      ) : (
                        historialOrdenes.map(order => {
                          const items = getParsedItems(order.items)
                          return (
                            <tr key={order.id} className="hover:bg-[#fafafa] transition-colors">
                              <td className="px-5 py-4 font-mono text-zinc-500 whitespace-nowrap">
                                {new Date(order.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                              </td>
                              <td className="px-5 py-4 font-mono font-bold text-zinc-900">
                                #{order.id.slice(-4).toUpperCase()}
                              </td>
                              <td className="px-5 py-4 font-bold text-zinc-850">
                                {order.nombre_cliente}
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                  order.tipo === 'delivery' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-amber-50 text-amber-600 border border-amber-200'
                                }`}>
                                  {order.tipo}
                                </span>
                              </td>
                              <td className="px-5 py-4 min-w-[200px] text-zinc-650">
                                <div className="space-y-0.5">
                                  {items.map((it: any, i: number) => (
                                    <div key={i}>{it.cantidad || it.qty || 1}x {it.nombre || it.name}</div>
                                  ))}
                                </div>
                              </td>
                              <td className="px-5 py-4 font-bold font-mono text-zinc-900">
                                ${order.total}
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap">
                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase border ${
                                  order.estado === 'entregado' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                  order.estado === 'rechazado' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                                  'bg-zinc-50 text-zinc-600 border-zinc-200'
                                }`}>
                                  {order.estado}
                                </span>
                              </td>
                            </tr>
                          )
                        })
                      )}
                      {historialOrdenes.length === 0 && !cargandoHistorial && (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-zinc-400 font-mono">
                            No hay órdenes en el rango de fechas seleccionado
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* D) PESTAÑA: CONFIGURACIÓN */}
            {pestanaActiva === 'configuracion' && (
              <div className="max-w-2xl mx-auto bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 shadow-sm animate-fadeIn">
                <div className="border-b border-zinc-200 pb-5 mb-6">
                  <h3 className="font-serif font-black text-xl text-zinc-900 uppercase tracking-tight">Configuración de Hardware & Ticket</h3>
                  <p className="text-xs text-zinc-500 mt-1">Conecta impresoras térmicas ESC/POS y automatiza tu flujo de comanda.</p>
                </div>

                {cargandoConfig ? (
                  <div className="flex justify-center py-12">
                    <RefreshCw className="w-6 h-6 animate-spin text-[#dc2626]" />
                  </div>
                ) : (
                  <form onSubmit={handleSaveConfig} className="space-y-6">
                    
                    {/* Interruptores Switches */}
                    <div className="space-y-4">
                      <label className="flex items-center gap-3 bg-zinc-50 border border-zinc-200 rounded-2xl p-4 cursor-pointer select-none hover:bg-zinc-100/50 transition-colors">
                        <input
                          type="checkbox"
                          checked={config.auto_aceptar}
                          onChange={e => setConfig(prev => ({ ...prev, auto_aceptar: e.target.checked }))}
                          className="w-4 h-4 accent-[#dc2626]"
                        />
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-zinc-850">Aceptar Pedidos Automáticamente</p>
                          <p className="text-[11px] text-zinc-500">Mueve los pedidos entrantes a preparación al instante sin intervención manual.</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 bg-zinc-50 border border-zinc-200 rounded-2xl p-4 cursor-pointer select-none hover:bg-zinc-100/50 transition-colors">
                        <input
                          type="checkbox"
                          checked={config.imprimir_automatico}
                          onChange={e => setConfig(prev => ({ ...prev, imprimir_automatico: e.target.checked }))}
                          className="w-4 h-4 accent-[#dc2626]"
                        />
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-zinc-850">Imprimir Ticket Automático</p>
                          <p className="text-[11px] text-zinc-500">Envía la comanda a la impresora ESC/POS configurada al aceptar una orden.</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 bg-zinc-50 border border-zinc-200 rounded-2xl p-4 cursor-pointer select-none hover:bg-zinc-100/50 transition-colors">
                        <input
                          type="checkbox"
                          checked={config.tiene_autocorte}
                          onChange={e => setConfig(prev => ({ ...prev, tiene_autocorte: e.target.checked }))}
                          className="w-4 h-4 accent-[#dc2626]"
                        />
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-zinc-850">Enviar Comando Autocorte</p>
                          <p className="text-[11px] text-zinc-500">Ejecuta la guillotina automática al final de cada impresión de comanda (tickets de 80mm).</p>
                        </div>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Connection Type */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Tipo de Conexión</label>
                        <select
                          value={config.tipo_impresora}
                          onChange={e => setConfig(prev => ({ ...prev, tipo_impresora: e.target.value }))}
                          className="w-full bg-[#fafafa] border border-zinc-200 rounded-xl px-4 py-3 text-[#09090b] text-sm focus:outline-none focus:border-[#dc2626] focus:bg-white transition-colors"
                        >
                          <option value="red_usb">USB (Red Compartida)</option>
                          <option value="wifi">Wi-Fi (IP Red Local)</option>
                          <option value="bluetooth">Bluetooth (MAC / Clave)</option>
                        </select>
                      </div>

                      {/* Printer ID/IP */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Dirección / IP de Impresora</label>
                        <input
                          type="text"
                          value={config.config_impresora}
                          onChange={e => setConfig(prev => ({ ...prev, config_impresora: e.target.value }))}
                          placeholder="Ej: 192.168.1.100 o PrinterName"
                          className="w-full bg-[#fafafa] border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#dc2626] focus:bg-white transition-colors"
                        />
                      </div>
                    </div>

                    {/* Font Size Selector */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Tamaño de Fuente del Ticket</label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { id: 'normal', label: 'Normal' },
                          { id: 'doble_alto', label: 'Doble Alto' }
                        ].map(fSize => (
                          <button
                            key={fSize.id}
                            type="button"
                            onClick={() => setConfig(prev => ({ ...prev, tamano_fuente: fSize.id }))}
                            className={`py-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-colors text-center cursor-pointer ${
                              config.tamano_fuente === fSize.id
                                ? 'bg-zinc-950 border-zinc-950 text-white'
                                : 'bg-slate-50 border-zinc-200 text-zinc-650 hover:bg-slate-100'
                            }`}
                          >
                            {fSize.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 mt-6">
                      <button
                        type="submit"
                        className="flex-1 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold text-xs uppercase tracking-widest py-4 rounded-xl shadow-lg transition-colors cursor-pointer"
                      >
                        💾 Guardar Configuración
                      </button>
                      <button
                        type="button"
                        onClick={handleImprimirPrueba}
                        disabled={!config.config_impresora || imprimiendo}
                        className={`flex-1 font-bold text-xs uppercase tracking-widest py-4 rounded-xl transition-all flex items-center justify-center gap-2 border ${
                          !config.config_impresora || imprimiendo
                            ? 'bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed opacity-60'
                            : 'bg-white border-zinc-300 text-zinc-750 hover:bg-zinc-50 hover:border-zinc-450 cursor-pointer shadow-sm'
                        }`}
                      >
                        {imprimiendo ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            IMPRIMIENDO...
                          </>
                        ) : (
                          '🖨️ IMPRIMIR PÁGINA DE PRUEBA'
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

