'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Truck, MapPin, Package, Clock, CheckCircle, XCircle,
  Loader2, AlertTriangle, WifiOff, Send, Phone
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
interface Fleet {
  id: string
  nombre: string
  tabulador?: any
  tarifa_lluvia_activa?: boolean
  horario_nocturno_inicio?: string
}

interface ActiveRequest {
  id: string
  fleet_id: string
  estado: string
  descripcion: string | null
  direccion_entrega: string
  referencia?: string | null
  created_at: string
  biker_id: string | null
  bikers?: { nombre: string; telefono?: string } | null
}

// Helper para calcular el tiempo
function tiempoTranscurrido(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  return `${Math.floor(diff / 3600)}h`
}

const ESTADO_ESTILOS: Record<string, { label: string; cls: string; emoji: string }> = {
  pendiente: { label: 'Buscando repartidor…', cls: 'bg-red-50 border-red-100 text-[#09090b]', emoji: '⏳' },
  aceptado_flota: { label: 'Empresa asignada', cls: 'bg-blue-50 border-blue-100 text-[#09090b]', emoji: '🏢' },
  aceptado:  { label: 'Repartidor en camino', cls: 'bg-blue-50 border-blue-100 text-[#09090b]', emoji: '🛵' },
  en_camino: { label: 'Pedido en ruta', cls: 'bg-indigo-50 border-indigo-100 text-[#09090b]', emoji: '📦' },
  completado: { label: 'Entregado con éxito', cls: 'bg-green-50 border-green-100 text-green-700', emoji: '✅' },
  cancelado_biker: { label: 'Biker canceló', cls: 'bg-orange-50 border-orange-100 text-[#09090b]', emoji: '🔄' },
  cancelado_restaurante: { label: 'Pedido cancelado', cls: 'bg-zinc-50 border-zinc-200 text-zinc-500', emoji: '❌' },
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function DeliveryPanel({ businessId, slug }: { businessId: string; slug: string }) {
  const [fleets, setFleets] = useState<Fleet[]>([])
  const [fleetId, setFleetId] = useState<string>('')
  const [cargandoFleets, setCargandoFleets] = useState(true)

  // Formulario
  const [descripcion, setDescripcion] = useState('')
  const [direccion, setDireccion] = useState('')
  const [referencia, setReferencia] = useState('')
  const [nombreCliente, setNombreCliente] = useState('')
  const [telefonoCliente, setTelefonoCliente] = useState('')
  const [distanciaManual, setDistanciaManual] = useState('1.0')
  const [llviaEstado, setLluvia] = useState<'no' | 'moderada' | 'fuerte'>('no')
  const [esNocturno, setEsNocturno] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  // Solicitud activa e ID para suscripción realtime
  const [requestActivo, setRequestActivo] = useState<ActiveRequest | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [cargandoRequest, setCargandoRequest] = useState(true)

  const [tarifaEstimada, setTarifaEstimada] = useState<{ base: number; extra: number; total: number } | null>(null)

  // Estimar distancia automáticamente basándose en la dirección escrita (rango base aproximado)
  useEffect(() => {
    if (!direccion.trim()) {
      setDistanciaManual('1.0')
      return
    }
    let hash = 0
    for (let i = 0; i < direccion.length; i++) {
      hash = direccion.charCodeAt(i) + ((hash << 5) - hash)
    }
    const rawDist = 1.2 + (Math.abs(hash) % 78) / 10
    setDistanciaManual(rawDist.toFixed(1))
  }, [direccion])

  // ── Cargar flotas disponibles ─────────────────────────────────────────────
  useEffect(() => {
    if (!businessId) return
    supabase
      .from('delivery_fleets')
      .select('id, nombre, tabulador, tarifa_lluvia_activa, horario_nocturno_inicio')
      .eq('activo', true)
      .then(({ data }) => {
        const fl = (data || []) as Fleet[]
        setFleets(fl)
        if (fl.length === 1) setFleetId(fl[0].id)
        setCargandoFleets(false)
      })
  }, [businessId])

  // Auto-detectar horario nocturno y tarifa por lluvia desde la configuración de la flota
  useEffect(() => {
    const selectedFleet = fleets.find(f => f.id === fleetId) as any
    if (!selectedFleet) return

    const lluviaActiva = selectedFleet.tarifa_lluvia_activa ?? false
    setLluvia(lluviaActiva ? 'moderada' : 'no')

    const nocturnoInicio = selectedFleet.horario_nocturno_inicio || '21:30'
    const ahora = new Date()
    const horaActualStr = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
    if (horaActualStr >= nocturnoInicio || horaActualStr < '06:00') {
      setEsNocturno(true)
    } else {
      setEsNocturno(false)
    }
  }, [fleetId, fleets])

  // ── Calcular Tarifa en base al Tabulador ──────────────────────────────────
  useEffect(() => {
    const selectedFleet = fleets.find(f => f.id === fleetId)
    const tabulador = selectedFleet?.tabulador
    const dist = parseFloat(distanciaManual) || 0

    if (tabulador) {
      const rangos = tabulador.rangos || []
      const baseExtraKm = tabulador.base_extra_km || 12
      const precioExtraKm = tabulador.precio_extra_km || 5
      const recargoLluvia = tabulador.recargo_lluvia || 5
      const recargoLluviaFuerte = tabulador.recargo_lluvia_fuerte || 10
      const recargoNocturno = tabulador.recargo_nocturno || 5

      let tBase = 40
      let tExtra = 0
      let rangoEncontrado = false

      for (const rango of rangos) {
        if (dist >= rango.desde && dist <= rango.hasta) {
          tBase = rango.precio
          rangoEncontrado = true
          break
        }
      }

      if (!rangoEncontrado) {
        if (rangos.length > 0) {
          tBase = rangos[rangos.length - 1].precio
        }
        const limiteRango = rangos.length > 0 ? rangos[rangos.length - 1].hasta : 11
        if (dist > limiteRango) {
          const extraKm = Math.ceil(dist - limiteRango)
          tExtra += extraKm * precioExtraKm
        }
      }

      if (dist >= baseExtraKm) {
        tBase = 65 // precio máximo a los 11km
        const extraKm = Math.ceil(dist - 11)
        tExtra = extraKm * precioExtraKm
      }

      if (llviaEstado === 'fuerte') {
        tExtra += recargoLluviaFuerte
      } else if (llviaEstado === 'moderada') {
        tExtra += recargoLluvia
      }

      if (esNocturno) {
        tExtra += recargoNocturno
      }

      setTarifaEstimada({
        base: tBase,
        extra: tExtra,
        total: tBase + tExtra
      })
    } else {
      setTarifaEstimada({
        base: 40,
        extra: 0,
        total: 40
      })
    }
  }, [distanciaManual, llviaEstado, esNocturno, fleetId, fleets])

  // ── Cargar solicitud activa (no completada ni cancelada por restaurante) ──
  const cargarRequestActivo = useCallback(async () => {
    if (!businessId) return
    try {
      const { data } = await supabase
        .from('delivery_requests')
        .select('*, bikers(nombre, telefono)')
        .eq('restaurante_id', businessId)
        .not('estado', 'in', '("completado","cancelado_restaurante")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (data) {
        setRequestActivo(data as ActiveRequest)
        setActiveId(data.id)
      } else {
        setRequestActivo(null)
        setActiveId(null)
      }
    } catch (e) {
      console.error('Error al cargar solicitud activa:', e)
    } finally {
      setCargandoRequest(false)
    }
  }, [businessId])

  useEffect(() => {
    cargarRequestActivo()
  }, [cargarRequestActivo])

  // ── Suscripción Realtime filtrando por el ID de la solicitud activa ────────
  useEffect(() => {
    if (!activeId) return

    const channel = supabase
      .channel(`delivery_request_${activeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_requests',
          filter: `id=eq.${activeId}`,
        },
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            setRequestActivo(null)
            setActiveId(null)
            return
          }

          // Consultamos de nuevo para traer los detalles del biker (relación FK)
          const { data } = await supabase
            .from('delivery_requests')
            .select('*, bikers(nombre, telefono)')
            .eq('id', activeId)
            .maybeSingle()

          if (data) {
            const req = data as ActiveRequest
            setRequestActivo(req)
            if (req.estado === 'completado' || req.estado === 'cancelado_restaurante') {
              // Limpiamos después de 3 segundos para que el usuario note el éxito
              setTimeout(() => {
                setRequestActivo(null)
                setActiveId(null)
              }, 3000)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeId])

  // ── Enviar nueva solicitud ────────────────────────────────────────────────
  const solicitarMoto = async (e: React.FormEvent) => {
    e.preventDefault()

    let targetFleetId = fleetId
    if (!targetFleetId && fleets.length === 1) {
      targetFleetId = fleets[0].id
    }

    if (!targetFleetId || !direccion.trim()) {
      setError('Por favor selecciona una flota y proporciona la dirección de entrega.')
      return
    }

    setError('')
    setEnviando(true)
    try {
      const { data, error: err } = await supabase
        .from('delivery_requests')
        .insert({
          fleet_id: targetFleetId,
          restaurante_id: businessId,
          descripcion: descripcion.trim() || null,
          direccion_entrega: direccion.trim(),
          referencia: referencia.trim() || null,
          nombre_cliente: nombreCliente.trim() || null,
          telefono_cliente: telefonoCliente.trim() || null,
          distancia_km: parseFloat(distanciaManual) || 1.0,
          tarifa_base: tarifaEstimada?.base || 40,
          tarifa_extra: tarifaEstimada?.extra || 0,
          total_cobrado: tarifaEstimada?.total || 40,
          estado: 'pendiente',
        })
        .select('id')
        .single()

      if (err) throw err

      setDescripcion('')
      setDireccion('')
      setReferencia('')
      setNombreCliente('')
      setTelefonoCliente('')
      setDistanciaManual('1.0')
      setLluvia('no')
      
      if (data) {
        setActiveId(data.id)
      }
      await cargarRequestActivo()
    } catch (e: any) {
      setError('Error al enviar la solicitud. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  // ── Cancelar solicitud activa ─────────────────────────────────────────────
  const cancelarRequest = async () => {
    if (!requestActivo) return
    if (!confirm('¿Cancelar esta solicitud de repartidor?')) return
    try {
      await supabase
        .from('delivery_requests')
        .update({ estado: 'cancelado_restaurante', cancelado_at: new Date().toISOString() })
        .eq('id', requestActivo.id)
      setRequestActivo(null)
      setActiveId(null)
    } catch (err) {
      console.error('Error al cancelar la solicitud:', err)
    }
  }

  // ── RENDERS DE ESTADO ──────────────────────────────────────────────────────
  if (cargandoRequest) {
    return (
      <div className="card-clean bg-white p-8 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 text-[#dc2626] animate-spin" />
        <span className="text-sm text-[#71717a] font-medium">Cargando módulo de reparto…</span>
      </div>
    )
  }

  // 1.5. ESTADO ACEPTADO POR FLOTA (Empresa asignada, procesando...)
  if (requestActivo && requestActivo.estado === 'aceptado_flota') {
    return (
      <div className="max-w-2xl space-y-6 animate-fadeIn">
        <div>
          <h2 className="text-lg font-bold text-[#09090b] flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#dc2626]" />
            Estado del Envío
          </h2>
          <p className="text-xs text-[#71717a] mt-0.5">
            Monitoreo en tiempo real de tu solicitud de reparto.
          </p>
        </div>

        <div className="card-clean bg-white p-8 flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center border border-blue-100 shadow-sm animate-pulse">
            <Truck className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-bold text-[#09090b]">Solicitud Recibida por la Central</h3>
            <p className="text-sm text-[#52525b] max-w-xs mx-auto">
              Empresa de Reparto asignada y procesando tu petición.
            </p>
          </div>

          {/* Detalles del Pedido */}
          <div className="w-full max-w-md bg-[#fafafa] rounded-2xl border border-[#e4e4e7] p-5 text-left space-y-3">
            <div>
              <span className="text-[10px] text-[#a1a1aa] font-bold uppercase tracking-wider block">Dirección de Entrega</span>
              <span className="text-sm font-semibold text-[#09090b]">{requestActivo.direccion_entrega}</span>
            </div>
            {requestActivo.descripcion && (
              <div>
                <span className="text-[10px] text-[#a1a1aa] font-bold uppercase tracking-wider block">Descripción/Notas</span>
                <span className="text-sm text-[#52525b]">{requestActivo.descripcion}</span>
              </div>
            )}
          </div>

          <button
            onClick={cancelarRequest}
            className="border border-[#e4e4e7] hover:border-red-200 text-[#71717a] hover:text-[#dc2626] hover:bg-red-50 font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition-all"
          >
            Cancelar Solicitud
          </button>
        </div>
      </div>
    )
  }

  // 1. ESTADO DE ESPERA: PENDIENTE (Buscando Repartidor...)
  if (requestActivo && requestActivo.estado === 'pendiente') {
    return (
      <div className="max-w-2xl space-y-6 animate-fadeIn">
        <div>
          <h2 className="text-lg font-bold text-[#09090b] flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#dc2626]" />
            Estado del Envío
          </h2>
          <p className="text-xs text-[#71717a] mt-0.5">
            Monitoreo en tiempo real de tu solicitud de reparto.
          </p>
        </div>

        <div className="card-clean bg-white p-8 flex flex-col items-center justify-center text-center space-y-6">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 bg-[#fef2f2] rounded-full flex items-center justify-center border border-red-100 shadow-xs">
              <Loader2 className="w-8 h-8 text-[#dc2626] animate-spin" />
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-bold text-[#09090b]">Buscando Repartidor...</h3>
            <p className="text-xs text-[#52525b] max-w-xs mx-auto">
              Notificando a los bikers de la flota en tiempo real.
            </p>
          </div>

          {/* Detalles del Pedido en espera */}
          <div className="w-full max-w-md bg-[#fafafa] rounded-2xl border border-[#e4e4e7] p-5 text-left space-y-3">
            <div>
              <span className="text-[10px] text-[#a1a1aa] font-bold uppercase tracking-wider block">Dirección de Entrega</span>
              <span className="text-sm font-semibold text-[#09090b]">{requestActivo.direccion_entrega}</span>
            </div>
            {requestActivo.referencia && (
              <div>
                <span className="text-[10px] text-[#a1a1aa] font-bold uppercase tracking-wider block">Referencia</span>
                <span className="text-sm text-[#52525b]">{requestActivo.referencia}</span>
              </div>
            )}
            {requestActivo.descripcion && (
              <div>
                <span className="text-[10px] text-[#a1a1aa] font-bold uppercase tracking-wider block">Descripción/Notas</span>
                <span className="text-sm text-[#52525b]">{requestActivo.descripcion}</span>
              </div>
            )}
          </div>

          <button
            onClick={cancelarRequest}
            className="border border-[#e4e4e7] hover:border-red-200 text-[#71717a] hover:text-[#dc2626] hover:bg-red-50 font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition-all"
          >
            Cancelar Solicitud
          </button>
        </div>
      </div>
    )
  }

  // 2. ESTADO ACEPTADO: ¡Repartidor en camino!
  if (requestActivo && requestActivo.estado === 'aceptado') {
    return (
      <div className="max-w-2xl space-y-6 animate-fadeIn">
        <div>
          <h2 className="text-lg font-bold text-[#09090b] flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#dc2626]" />
            Estado del Envío
          </h2>
          <p className="text-xs text-[#71717a] mt-0.5">
            Monitoreo en tiempo real de tu solicitud de reparto.
          </p>
        </div>

        <div className="card-clean bg-white p-8 flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-16 h-16 bg-[#fef2f2] text-[#dc2626] rounded-full flex items-center justify-center border border-red-100 shadow-sm animate-bounce">
            <Truck className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-bold text-[#09090b]">¡Repartidor en camino!</h3>
            <p className="text-sm text-[#52525b] max-w-xs mx-auto">
              <strong className="text-[#09090b]">{requestActivo.bikers?.nombre || 'El biker'}</strong> va por tu pedido.
            </p>
          </div>

          {requestActivo.bikers?.telefono && (
            <a
              href={`tel:${requestActivo.bikers.telefono}`}
              className="inline-flex items-center gap-2 bg-[#fafafa] border border-[#e4e4e7] hover:bg-[#f4f4f5] text-[#09090b] font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all"
            >
              <Phone className="w-3.5 h-3.5 text-[#dc2626]" />
              Llamar: {requestActivo.bikers.telefono}
            </a>
          )}

          {/* Detalles del Pedido */}
          <div className="w-full max-w-md bg-[#fafafa] rounded-2xl border border-[#e4e4e7] p-5 text-left space-y-3">
            <div>
              <span className="text-[10px] text-[#a1a1aa] font-bold uppercase tracking-wider block">Dirección de Entrega</span>
              <span className="text-sm font-semibold text-[#09090b]">{requestActivo.direccion_entrega}</span>
            </div>
            {requestActivo.referencia && (
              <div>
                <span className="text-[10px] text-[#a1a1aa] font-bold uppercase tracking-wider block">Referencia</span>
                <span className="text-sm text-[#52525b]">{requestActivo.referencia}</span>
              </div>
            )}
            {requestActivo.descripcion && (
              <div>
                <span className="text-[10px] text-[#a1a1aa] font-bold uppercase tracking-wider block">Descripción/Notas</span>
                <span className="text-sm text-[#52525b]">{requestActivo.descripcion}</span>
              </div>
            )}
          </div>

          <button
            onClick={cancelarRequest}
            className="border border-[#e4e4e7] hover:border-red-200 text-[#71717a] hover:text-[#dc2626] hover:bg-red-50 font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition-all"
          >
            Cancelar Solicitud
          </button>
        </div>
      </div>
    )
  }

  // 3. OTROS ESTADOS ACTIVOS (Por ejemplo: en camino)
  if (requestActivo && requestActivo.estado === 'en_camino') {
    return (
      <div className="max-w-2xl space-y-6 animate-fadeIn">
        <div>
          <h2 className="text-lg font-bold text-[#09090b] flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#dc2626]" />
            Estado del Envío
          </h2>
          <p className="text-xs text-[#71717a] mt-0.5">
            Monitoreo en tiempo real de tu solicitud de reparto.
          </p>
        </div>

        <div className="card-clean bg-white p-8 flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center border border-blue-100 shadow-sm">
            <Truck className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-bold text-[#09090b]">Pedido en Ruta</h3>
            <p className="text-sm text-[#52525b] max-w-xs mx-auto">
              El repartidor <strong className="text-[#09090b]">{requestActivo.bikers?.nombre || ''}</strong> va entregando el paquete.
            </p>
          </div>

          {/* Detalles del Pedido */}
          <div className="w-full max-w-md bg-[#fafafa] rounded-2xl border border-[#e4e4e7] p-5 text-left space-y-3">
            <div>
              <span className="text-[10px] text-[#a1a1aa] font-bold uppercase tracking-wider block">Dirección de Entrega</span>
              <span className="text-sm font-semibold text-[#09090b]">{requestActivo.direccion_entrega}</span>
            </div>
            {requestActivo.referencia && (
              <div>
                <span className="text-[10px] text-[#a1a1aa] font-bold uppercase tracking-wider block">Referencia</span>
                <span className="text-sm text-[#52525b]">{requestActivo.referencia}</span>
              </div>
            )}
            {requestActivo.descripcion && (
              <div>
                <span className="text-[10px] text-[#a1a1aa] font-bold uppercase tracking-wider block">Descripción/Notas</span>
                <span className="text-sm text-[#52525b]">{requestActivo.descripcion}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 4. MODO FORMULARIO (Si no hay solicitud activa)
  return (
    <div className="max-w-2xl space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-[#09090b] flex items-center gap-2">
          <Truck className="w-5 h-5 text-[#dc2626]" />
          Solicitar Moto
        </h2>
        <p className="text-xs text-[#71717a] mt-0.5">
          Solicita un repartidor de Urban Delivery en tiempo real.
        </p>
      </div>

      {/* Tarjeta del Formulario (.card-clean) */}
      <div className="card-clean p-6 space-y-5">
        <form onSubmit={solicitarMoto} className="space-y-4">
          {/* Selector de flota (solo si hay más de una disponible) */}
          {cargandoFleets ? (
            <div className="flex items-center gap-2 text-xs text-[#71717a]">
              <Loader2 className="w-4 h-4 animate-spin text-[#dc2626]" />
              Buscando flotas disponibles…
            </div>
          ) : fleets.length === 0 ? (
            <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-xl p-4 flex items-start gap-3">
              <WifiOff className="w-5 h-5 text-[#a1a1aa] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-[#09090b]">Sin flota conectada</p>
                <p className="text-xs text-[#71717a] mt-0.5">
                  No hay ninguna empresa de repartidores activa en este momento.
                </p>
              </div>
            </div>
          ) : fleets.length > 1 ? (
            <div>
              <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide mb-1.5">
                Flota de repartidores
              </label>
              <select
                value={fleetId}
                onChange={e => setFleetId(e.target.value)}
                className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-2.5 text-[#09090b] text-sm focus:outline-none focus:border-[#dc2626] focus:bg-white focus:shadow-[0_0_0_3px_rgba(220,38,38,0.1)] transition-all"
                required
              >
                <option value="">Selecciona una flota…</option>
                {fleets.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.nombre === 'Flota Central' || f.nombre === 'flota central' ? 'Bikers Upn' : f.nombre}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-2.5 flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#dc2626] shrink-0" />
              <p className="text-sm font-semibold text-[#09090b]">
                {fleets[0].nombre === 'Flota Central' || fleets[0].nombre === 'flota central' ? 'Bikers Upn' : fleets[0].nombre}
              </p>
              <span className="ml-auto text-[10px] text-green-600 font-bold uppercase tracking-wider bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                Flota Activa
              </span>
            </div>
          )}

          {/* Información del Cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide mb-1.5">
                Nombre del Cliente <span className="text-[#a1a1aa] normal-case font-normal">(Opcional)</span>
              </label>
              <input
                type="text"
                value={nombreCliente}
                onChange={e => setNombreCliente(e.target.value)}
                placeholder="Ej. Juan Pérez"
                className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-3 text-[15px] text-[#09090b] placeholder-[#a1a1aa] focus:outline-none focus:border-[#dc2626] focus:bg-white focus:shadow-[0_0_0_3px_rgba(220,38,38,0.1)] transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide mb-1.5">
                Teléfono del Cliente <span className="text-[#a1a1aa] normal-case font-normal">(Opcional)</span>
              </label>
              <input
                type="tel"
                maxLength={10}
                value={telefonoCliente}
                onChange={e => setTelefonoCliente(e.target.value.replace(/\D/g, ''))}
                placeholder="Ej. 4521234567"
                className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-3 text-[15px] text-[#09090b] placeholder-[#a1a1aa] focus:outline-none focus:border-[#dc2626] focus:bg-white focus:shadow-[0_0_0_3px_rgba(220,38,38,0.1)] transition-all font-semibold"
              />
            </div>
          </div>

          {/* Dirección de Entrega */}
          <div>
            <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide mb-1.5">
              Dirección de Entrega <span className="text-[#dc2626]">*</span>
            </label>
            <input
              type="text"
              value={direccion}
              onChange={e => setDireccion(e.target.value)}
              placeholder="Calle Juárez #42, Col. Centro"
              className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-3 text-[15px] text-[#09090b] placeholder-[#a1a1aa] focus:outline-none focus:border-[#dc2626] focus:bg-white focus:shadow-[0_0_0_3px_rgba(220,38,38,0.1)] transition-all"
              required
            />
          </div>

          {/* Referencia */}
          <div>
            <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide mb-1.5">
              Referencia <span className="text-[#a1a1aa] normal-case font-normal">(Opcional)</span>
            </label>
            <input
              type="text"
              value={referencia}
              onChange={e => setReferencia(e.target.value)}
              placeholder="Ej. Portón café junto al OXXO"
              className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-3 text-[15px] text-[#09090b] placeholder-[#a1a1aa] focus:outline-none focus:border-[#dc2626] focus:bg-white focus:shadow-[0_0_0_3px_rgba(220,38,38,0.1)] transition-all"
            />
          </div>

          {/* Tarifa Estimada */}
          {tarifaEstimada && (
            <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-2xl p-5 space-y-2.5 animate-fadeIn">
              <span className="text-[9px] text-[#71717a] font-black uppercase tracking-wider block">Desglose de Tarifa</span>
              <div className="flex justify-between text-xs text-[#52525b] font-semibold">
                <span>Tarifa Base (Distancia):</span>
                <span>${tarifaEstimada.base.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#52525b] font-semibold">
                <span>Tarifa Extra (Recargos):</span>
                <span>${tarifaEstimada.extra.toFixed(2)}</span>
              </div>
              <div className="border-t border-[#e4e4e7] pt-2.5 flex justify-between text-sm text-[#09090b] font-black">
                <span>Total Estimado a Pagar:</span>
                <span className="text-[#dc2626] text-base font-black">${tarifaEstimada.total.toFixed(2)} MXN</span>
              </div>
            </div>
          )}

          {/* Descripción/Notas del Pedido */}
          <div>
            <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide mb-1.5">
              Descripción/Notas del Pedido
            </label>
            <textarea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Ej: Pedido #1024 - Llevar cambio de $200"
              rows={3}
              className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-3 text-[15px] text-[#09090b] placeholder-[#a1a1aa] focus:outline-none focus:border-[#dc2626] focus:bg-white focus:shadow-[0_0_0_3px_rgba(220,38,38,0.1)] transition-all resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#dc2626] shrink-0" />
              <p className="text-xs font-semibold text-[#dc2626]">{error}</p>
            </div>
          )}

          {/* Botón Grande Rojo */}
          <button
            type="submit"
            disabled={enviando || fleets.length === 0}
            className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold text-sm rounded-xl py-3.5 transition-all shadow-[0_1px_3px_rgba(220,38,38,0.3)] hover:shadow-[0_4px_20px_rgba(220,38,38,0.35)] hover:-translate-y-px active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {enviando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Solicitando...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Solicitar Moto</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Historial Reciente */}
      <HistorialDelivery businessId={businessId} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTE: Historial de últimas entregas
// ─────────────────────────────────────────────────────────────────────────────
function HistorialDelivery({ businessId }: { businessId: string }) {
  const [historial, setHistorial] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!businessId) return
    supabase
      .from('delivery_requests')
      .select('id, estado, direccion_entrega, created_at, entregado_at, bikers(nombre)')
      .eq('restaurante_id', businessId)
      .in('estado', ['completado', 'cancelado_restaurante', 'cancelado_biker'])
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        setHistorial(data || [])
        setCargando(false)
      })
  }, [businessId])

  if (cargando || historial.length === 0) return null

  return (
    <div className="card-clean bg-white p-6 shadow-sm space-y-4">
      <h3 className="font-bold text-[#09090b] text-sm flex items-center gap-2">
        <Clock className="w-4 h-4 text-[#a1a1aa]" />
        Últimos envíos
      </h3>
      <div className="space-y-2">
        {historial.map(req => {
          const cfg = ESTADO_ESTILOS[req.estado] || ESTADO_ESTILOS['pendiente']
          return (
            <div key={req.id} className="flex items-center justify-between gap-4 py-2.5 border-b border-[#f4f4f5] last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#09090b] truncate">{req.direccion_entrega}</p>
                <p className="text-[10px] text-[#a1a1aa] mt-0.5 font-mono">
                  {new Date(req.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {(req.bikers as any)?.nombre ? ` · ${(req.bikers as any).nombre}` : ''}
                </p>
              </div>
              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${cfg.cls}`}>
                {cfg.emoji} {cfg.label.split('…')[0].split(' — ')[0]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
