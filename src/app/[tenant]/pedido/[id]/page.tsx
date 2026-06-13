'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  CheckCircle,
  Clock,
  Flame,
  Bike,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  MapPin,
  DollarSign,
  CreditCard,
  ShoppingBag,
  User,
  Heart
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
  delivery_status: string
  delivery_token?: string | null
  tengo_el_pedido_at?: string | null
  repartidor_solicitado_at?: string | null
  entregado_at?: string | null
}

export default function OrderTrackingPage() {
  const params = useParams()
  const router = useRouter()
  const tenantSlug = (params?.tenant as string) || ''
  const orderId = (params?.id as string) || ''

  const [order, setOrder] = useState<Order | null>(null)
  const [business, setBusiness] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 1. Cargar Pedido Inicial e Información del Negocio
  useEffect(() => {
    if (!orderId) return

    setLoading(true)
    setError(null)

    supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle()
      .then(async ({ data: orderData, error: orderErr }) => {
        if (orderErr) {
          console.error('Error fetching order:', orderErr)
          setError('Ocurrió un error al cargar la orden.')
          setLoading(false)
          return
        }

        if (!orderData) {
          setError('El pedido no fue encontrado.')
          setLoading(false)
          return
        }

        setOrder(orderData)

        // Cargar información del negocio
        try {
          const { data: bizData } = await supabase
            .from('businesses')
            .select('id, nombre, slug')
            .eq('id', orderData.business_id)
            .maybeSingle()

          if (bizData) {
            setBusiness(bizData)
          }
        } catch (bizErr) {
          console.error('Error fetching business info:', bizErr)
        }

        setLoading(false)
      })
  }, [orderId])

  // 2. Conectar Suscripción Realtime para este Pedido Específico
  useEffect(() => {
    if (!orderId) return

    const channel = supabase
      .channel(`order_tracking_${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`
        },
        (payload) => {
          const updatedOrder = payload.new as Order
          setOrder(updatedOrder)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orderId])

  // 3. Determinar el progreso actual de la orden
  const getStatusStep = (estado: string) => {
    const e = estado?.toLowerCase()
    if (e === 'cancelado') return -1
    if (e === 'delivered' || e === 'entregado') return 3
    if (e === 'in_transit' || e === 'en_camino') return 2
    if (e === 'aprobado' || e === 'ready_to_ship' || e === 'preparing' || e === 'preparando') return 1
    return 0 // pendiente / recibido
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 p-6 font-sans">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-4" />
        <p className="text-sm font-semibold uppercase tracking-widest font-mono text-zinc-300">Cargando Rastreo...</p>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 p-6 font-sans text-center">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-4" />
        <p className="text-sm font-bold uppercase tracking-widest font-mono text-white mb-2">Pedido No Encontrado</p>
        <p className="text-xs text-zinc-500 max-w-xs mb-6">
          {error || 'El número de orden provisto es inválido o no existe en nuestra base de datos.'}
        </p>
        <button
          onClick={() => router.push(`/${tenantSlug}/cliente`)}
          className="px-6 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold uppercase tracking-wider text-white hover:bg-zinc-850 transition-colors cursor-pointer"
        >
          Ir al Inicio
        </button>
      </div>
    )
  }

  const currentStep = getStatusStep(order.estado)
  const isCancelled = order.estado?.toLowerCase() === 'cancelado'

  const steps = [
    {
      title: 'Pedido Recibido',
      description: 'El negocio ha recibido tu pedido y lo está confirmando.',
      icon: Clock
    },
    {
      title: 'En Cocina',
      description: '¡Cocina está preparando tus platillos con mucho amor!',
      icon: Flame
    },
    {
      title: 'En Camino',
      description: 'El repartidor ya lleva tu comida rumbo a tu destino.',
      icon: Bike
    },
    {
      title: 'Entregado con Éxito',
      description: '¡Tu pedido ha sido entregado. Qué lo disfrutes!',
      icon: CheckCircle
    }
  ]

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans pb-12 selection:bg-blue-600 selection:text-white relative overflow-x-hidden">
      
      {/* Glows decorativos */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[350px] bg-gradient-to-b from-blue-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-30 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-850 p-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push(`/${tenantSlug}/cliente`)}
            className="w-9 h-9 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="text-center">
            <h1 className="text-sm font-black tracking-tight text-white leading-tight">Rastreo de Pedido</h1>
            <p className="text-[10px] font-mono text-blue-400 uppercase tracking-wider mt-0.5">
              {business?.nombre || tenantSlug}
            </p>
          </div>

          <div className="w-9 h-9 opacity-0 pointer-events-none" /> {/* Placeholder de balanceo */}
        </div>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto px-4 py-6 space-y-6 relative z-10">
        
        {/* ── ESTADO ACTUAL (BANNER DE ACCIÓN) ── */}
        <section className="animate-fadeIn">
          {isCancelled ? (
            <div className="bg-rose-950/20 border border-rose-900/40 rounded-3xl p-5 text-center space-y-2 backdrop-blur-md shadow-2xl">
              <span className="text-4xl block mb-2">❌</span>
              <h2 className="text-lg font-black text-rose-400 uppercase tracking-wide">Pedido Cancelado</h2>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                Lo sentimos, este pedido ha sido cancelado por el establecimiento o a solicitud del cliente.
              </p>
            </div>
          ) : currentStep === 3 ? (
            <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-3xl p-5 text-center space-y-2 backdrop-blur-md shadow-2xl shadow-emerald-950/25">
              <span className="text-4xl block mb-2">🎉</span>
              <h2 className="text-base font-black text-emerald-400 uppercase tracking-wide leading-snug">¡Buen provecho!</h2>
              <p className="text-xs text-zinc-300">Tu pedido fue entregado con éxito. ¡Gracias por tu preferencia!</p>
              <div className="pt-2 flex justify-center items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> Hecho con sabor local
              </div>
            </div>
          ) : currentStep === 2 ? (
            <div className="bg-amber-950/20 border border-amber-900/40 rounded-3xl p-5 space-y-4 backdrop-blur-md shadow-2xl shadow-amber-950/25">
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center shrink-0 shadow-lg animate-bounce">
                  <Bike className="w-6 h-6 text-amber-400" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-black text-amber-400 uppercase tracking-wide">¡Tu pedido va en camino! 🏍️</h2>
                  <p className="text-xs text-zinc-300">El repartidor se encuentra en ruta para entregar tu orden.</p>
                </div>
              </div>
              
              {order.delivery_token && (
                <div className="bg-zinc-950/60 rounded-xl p-3 border border-zinc-850 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 font-bold text-xs uppercase shadow">
                    <User className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Repartidor Asignado</p>
                    <p className="text-xs font-black text-white">{order.delivery_token}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-zinc-900/60 border border-zinc-850 rounded-3xl p-5 flex gap-4 backdrop-blur-md shadow-xl">
              <div className="w-12 h-12 bg-blue-600/10 border border-blue-500/20 rounded-2xl flex items-center justify-center shrink-0 animate-pulse">
                <Clock className="w-6 h-6 text-blue-400" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-black text-white uppercase tracking-wide">Pedido en Proceso</h2>
                <p className="text-xs text-zinc-400">
                  {currentStep === 1
                    ? 'La cocina está elaborando tu orden al momento.'
                    : 'Estamos registrando tu pedido en el sistema.'}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ── STEPPER VISUAL (ESTATUS DEL PEDIDO) ── */}
        {!isCancelled && (
          <section className="bg-zinc-900/30 border border-zinc-850/60 rounded-3xl p-6 shadow-xl backdrop-blur-sm space-y-6">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono pl-1 border-l-2 border-blue-500">
              Estatus del Envío
            </h3>

            <div className="space-y-0.5">
              {steps.map((step, idx) => {
                const StepIcon = step.icon
                const isCompleted = currentStep >= idx
                const isActive = currentStep === idx

                return (
                  <div key={idx} className="flex gap-4 relative">
                    {/* Línea vertical de conexión */}
                    {idx < steps.length - 1 && (
                      <div
                        className={`absolute left-[21px] top-10 w-0.5 h-12 -translate-x-1/2 transition-colors duration-500 ${
                          currentStep > idx ? 'bg-blue-600' : 'bg-zinc-800'
                        }`}
                      />
                    )}

                    {/* Círculo indicador del paso */}
                    <div className="flex flex-col items-center z-10 shrink-0">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-all duration-500 ${
                          isCompleted
                            ? isActive
                              ? 'bg-zinc-900 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/20 animate-pulse'
                              : 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/35'
                            : 'bg-zinc-950 border-zinc-850 text-zinc-600'
                        }`}
                      >
                        <StepIcon className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Contenido de texto del paso */}
                    <div className="pb-8 pt-1 flex-1">
                      <h4
                        className={`text-sm font-bold transition-colors duration-500 ${
                          isCompleted ? (isActive ? 'text-blue-400' : 'text-white') : 'text-zinc-500'
                        }`}
                      >
                        {step.title}
                      </h4>
                      <p
                        className={`text-xs mt-1 transition-colors duration-500 leading-normal ${
                          isCompleted ? 'text-zinc-400' : 'text-zinc-650'
                        }`}
                      >
                        {step.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── DETALLE DEL PEDIDO ── */}
        <section className="bg-zinc-900 border border-zinc-850 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase">Identificador Folio</p>
              <h4 className="font-black text-sm text-white uppercase mt-0.5">#{order.id.slice(-4).toUpperCase()}</h4>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-mono text-zinc-500 uppercase">Fecha</p>
              <p className="text-xs text-zinc-300 mt-0.5">
                {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          {/* Información del Cliente */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-start">
              <span className="text-zinc-500">Para:</span>
              <span className="text-zinc-200 font-bold">{order.nombre_cliente}</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-zinc-500">Dirección:</span>
              <span className="text-zinc-200 font-bold text-right max-w-[200px]">
                {order.calle || ''} #{order.numero || ''}, {order.colonia || 'Centro'}
              </span>
            </div>
          </div>

          {/* Lista de Artículos */}
          <div className="border-t border-zinc-850 pt-3 space-y-1">
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono mb-2">Desglose de Compra</p>
            {order.items && Array.isArray(order.items) && order.items.length > 0 ? (
              order.items.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-start py-2 border-b border-zinc-950 last:border-0 text-xs">
                  <div className="flex gap-2">
                    <span className="text-blue-500 font-mono font-bold">{item.qty || 1}x</span>
                    <div>
                      <p className="font-bold text-zinc-100">{item.name}</p>
                      {item.notes && <p className="text-[10px] text-zinc-500 italic mt-0.5">Nota: {item.notes}</p>}
                    </div>
                  </div>
                  <span className="text-zinc-300 font-mono font-bold">${Number(item.price || 0).toFixed(2)}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-500 italic py-2">No se detallan artículos.</p>
            )}
          </div>

          {/* Total y Método de Pago */}
          <div className="border-t border-zinc-850 pt-3 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500">Método de Pago:</span>
              <span className={`px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[9px] border flex items-center gap-1 ${
                order.metodo_pago === 'tarjeta'
                  ? 'bg-blue-900/20 border-blue-800 text-blue-400'
                  : 'bg-emerald-900/20 border-emerald-800 text-emerald-400'
              }`}>
                {order.metodo_pago === 'tarjeta' ? (
                  <>
                    <CreditCard className="w-2.5 h-2.5" /> Tarjeta
                  </>
                ) : (
                  <>
                    <DollarSign className="w-2.5 h-2.5" /> Efectivo
                  </>
                )}
              </span>
            </div>

            <div className="flex justify-between items-center bg-zinc-950 rounded-2xl p-4 border border-zinc-850">
              <span className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Total</span>
              <span className="text-base font-black text-blue-400 font-mono">${Number(order.total).toFixed(2)}</span>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}
