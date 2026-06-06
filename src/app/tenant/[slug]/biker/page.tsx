'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Wifi, WifiOff, MapPin, Package, CheckCircle, XCircle, Clock, Navigation, LogOut, Loader2, AlertTriangle } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
interface Biker {
  id: string
  nombre: string
  fleet_id: string
  rol: 'biker' | 'admin_flota'
  conectado: boolean
  current_session_id?: string | null
  activo_hasta?: string | null
}

interface DeliveryRequest {
  id: string
  fleet_id: string
  restaurante_id: string
  descripcion: string | null
  direccion_entrega: string
  referencia?: string | null
  nombre_cliente?: string | null
  telefono_cliente?: string | null
  distancia_km?: number | null
  tarifa_base?: number | null
  tarifa_extra?: number | null
  total_cobrado?: number | null
  lat_entrega: number | null
  lng_entrega: number | null
  nota_biker: string | null
  estado: 'pendiente' | 'aceptado' | 'en_camino' | 'completado' | 'cancelado_biker' | 'cancelado_restaurante'
  biker_id: string | null
  created_at: string
  // Join con businesses
  businesses?: { nombre: string }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: GPS Broadcast (transmite posición vía canal efímero — sin writes a BD)
// ─────────────────────────────────────────────────────────────────────────────
function useGPSBroadcast(fleetId: string, bikerId: string, conectado: boolean) {
  const channelRef = useRef<any>(null)
  const watchIdRef = useRef<number | null>(null)
  const lastBroadcastRef = useRef<number>(0)
  const THROTTLE_MS = 12_000 // 12 segundos — evita saturar Supabase Realtime

  useEffect(() => {
    if (!conectado || !fleetId || !bikerId) {
      channelRef.current?.unsubscribe()
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      return
    }

    // Canal de broadcast de la flota (efímero — no escribe en PostgreSQL)
    channelRef.current = supabase
      .channel(`fleet:${fleetId}:bikers`)
      .subscribe()

    if (!navigator.geolocation) return

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now()
        if (now - lastBroadcastRef.current < THROTTLE_MS) return
        lastBroadcastRef.current = now

        channelRef.current?.send({
          type: 'broadcast',
          event: 'biker_location',
          payload: {
            biker_id: bikerId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
            ts: now,
          },
        })
      },
      (err) => console.warn('[GPS Broadcast]', err.message),
      { enableHighAccuracy: true, maximumAge: 8000, timeout: 15000 }
    )

    return () => {
      channelRef.current?.unsubscribe()
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [conectado, fleetId, bikerId])
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const getCookie = (name: string) =>
  typeof document === 'undefined'
    ? ''
    : document.cookie.match(new RegExp(`${name}=([^;]+)`))?.[1] || ''

function tiempoTranscurrido(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  return `${Math.floor(diff / 3600)}h`
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE: Badge de estado
// ─────────────────────────────────────────────────────────────────────────────
function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pendiente:             { label: 'Disponible',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    aceptado:              { label: 'Aceptado',    cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    en_camino:             { label: 'En camino',   cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    completado:            { label: 'Entregado',   cls: 'bg-green-50 text-green-700 border-green-200' },
    cancelado_biker:       { label: 'Cancelado',   cls: 'bg-red-50 text-red-700 border-red-200' },
    cancelado_restaurante: { label: 'Cancelado',   cls: 'bg-zinc-50 text-zinc-500 border-zinc-200' },
  }
  const { label, cls } = map[estado] || map['pendiente']
  return (
    <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PANTALLA: Login Biker
// ─────────────────────────────────────────────────────────────────────────────
function LoginBiker({ fleetId, onLogin }: { fleetId: string; onLogin: (b: Biker) => void }) {
  const params = useParams()
  const slug = (params?.slug as string) || ''
  const [telefono, setTelefono] = useState('')
  const [pin, setPin] = useState('')
  const [paso, setPaso] = useState<'telefono' | 'pin'>('telefono')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const intentarLogin = async () => {
    const telefonoLimpio = telefono.replace(/\D/g, '')
    if (telefonoLimpio.length !== 10) {
      setError('El teléfono debe tener 10 dígitos.')
      setPaso('telefono')
      return
    }
    if (pin.length < 4) return
    setCargando(true)
    setError('')
    try {
      const { data, error: err } = await supabase
        .from('bikers')
        .select('*')
        .eq('fleet_id', fleetId)
        .eq('telefono', telefonoLimpio)
        .eq('pin', pin)
        .eq('activo', true)
        .maybeSingle()

      if (err || !data) {
        setError('Teléfono o PIN incorrectos. Intenta de nuevo.')
        setPin('')
      } else {
        // Verificar admisión y bloqueos
        if (data.estado_aprobacion === 'pendiente') {
          setError('Tu solicitud de ingreso está pendiente de aprobación.')
          setPin('')
        } else if (data.estado_aprobacion === 'rechazado') {
          setError('Tu solicitud de ingreso ha sido rechazada.')
          setPin('')
        } else if (data.bloqueado_permanente) {
          setError('Tu acceso ha sido bloqueado de forma indefinida.')
          setPin('')
        } else if (data.bloqueado_hasta && new Date(data.bloqueado_hasta) > new Date()) {
          setError(`Acceso suspendido temporalmente hasta el ${new Date(data.bloqueado_hasta).toLocaleString('es-MX')}.`)
          setPin('')
        } else {
          // Generar UUID de sesión único
          const newSessionId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2) + Date.now().toString(36))
          
          // Actualizar en base de datos
          const { error: updErr } = await supabase
            .from('bikers')
            .update({ current_session_id: newSessionId })
            .eq('id', data.id)

          if (updErr) {
            setError('Error al iniciar sesión única. Intenta de nuevo.')
            return
          }

          // Guardar en cookie local
          document.cookie = `biker_session_id=${newSessionId}; path=/; SameSite=Lax`
          
          onLogin({ ...data, current_session_id: newSessionId } as Biker)
        }
      }
    } finally {
      setCargando(false)
    }
  }

  const handleDigito = (d: string) => {
    if (pin.length >= 6) return
    const nuevo = pin + d
    setPin(nuevo)
  }

  const irAPin = async () => {
    const telefonoLimpio = telefono.replace(/\D/g, '')
    if (telefonoLimpio.length !== 10) {
      setError('El teléfono debe tener exactamente 10 dígitos.')
      return
    }
    setCargando(true)
    setError('')
    try {
      const { data, error: err } = await supabase
        .from('bikers')
        .select('id, activo')
        .eq('fleet_id', fleetId)
        .eq('telefono', telefonoLimpio)
        .maybeSingle()

      if (err) {
        setError('Error al verificar el teléfono. Intenta nuevamente.')
      } else if (!data) {
        setError('Este teléfono no está registrado como repartidor en esta flota.')
      } else if (!data.activo) {
        setError('Tu cuenta de repartidor está desactivada. Contacta al administrador.')
      } else {
        setPaso('pin')
      }
    } catch (e) {
      setError('Error de conexión al verificar el teléfono.')
    } finally {
      setCargando(false)
    }
  }

  const isBikersSubdomain = typeof window !== 'undefined' && window.location.hostname.startsWith('bikers.')
  const registroUrl = isBikersSubdomain ? '/registro' : `/${slug}/registro`

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-xs space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <img
            src="/bikers.png"
            alt="Bikers Logo"
            className="w-16 h-16 mx-auto object-contain rounded-2xl"
          />
          <h1 className="text-2xl font-black text-[#09090b] tracking-tight mt-3">Portal Biker</h1>
          <p className="text-sm text-[#71717a]">
            {paso === 'telefono' ? 'Ingresa tu número de teléfono' : 'Ingresa tu PIN de acceso'}
          </p>
        </div>

        {paso === 'telefono' ? (
          <div className="space-y-4 animate-fadeIn">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">
                Número de Celular
              </label>
              <input
                type="tel"
                maxLength={10}
                value={telefono}
                onChange={e => {
                  setError('')
                  setTelefono(e.target.value.replace(/\D/g, ''))
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') irAPin()
                }}
                className="w-full bg-white border border-[#e4e4e7] rounded-xl px-4 py-3 text-base text-[#09090b] placeholder-[#a1a1aa] focus:outline-none focus:border-[#2563eb] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] transition-all font-semibold text-center tracking-wider"
                placeholder="Ej: 4521234567"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex flex-col gap-2 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#dc2626] shrink-0" />
                  <p className="text-xs font-semibold text-[#dc2626]">{error}</p>
                </div>
                {error.includes('no está registrado') && (
                  <Link
                    href={registroUrl}
                    className="w-full py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-xl text-xs font-black uppercase text-center tracking-wider transition-colors inline-block"
                  >
                    📝 Registrarse en esta Flota
                  </Link>
                )}
              </div>
            )}

            <button
              onClick={irAPin}
              disabled={cargando}
              className="w-full h-12 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_4px_12px_rgba(37,99,235,0.2)] flex items-center justify-center cursor-pointer"
            >
              {cargando ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Siguiente'}
            </button>
          </div>
        ) : (
          <div className="space-y-6 animate-fadeIn">
            {/* PIN Display */}
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all ${
                    i < pin.length
                      ? 'bg-[#2563eb] border-[#2563eb]'
                      : 'bg-white border-[#e4e4e7]'
                  }`}
                >
                  {i < pin.length && <div className="w-3 h-3 rounded-full bg-white" />}
                </div>
              ))}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex flex-col gap-2 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#dc2626] shrink-0" />
                  <p className="text-xs font-semibold text-[#dc2626]">{error}</p>
                </div>
                {(error.includes('Teléfono o PIN') || error.includes('no está registrado')) && (
                  <Link
                    href={registroUrl}
                    className="w-full py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-xl text-xs font-black uppercase text-center tracking-wider transition-colors inline-block"
                  >
                    📝 Registrarse en esta Flota
                  </Link>
                )}
              </div>
            )}

            {/* Teclado numérico */}
            <div className="grid grid-cols-3 gap-3">
              {['1','2','3','4','5','6','7','8','9','⌫','0','✓'].map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    if (key === '⌫') { setPin(p => p.slice(0, -1)); setError('') }
                    else if (key === '✓') intentarLogin()
                    else handleDigito(key)
                  }}
                  disabled={cargando}
                  className={`h-14 rounded-2xl font-bold text-lg transition-all active:scale-95 border ${
                    key === '✓'
                      ? 'bg-[#2563eb] border-[#2563eb] text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-[#1d4ed8]'
                      : key === '⌫'
                      ? 'bg-[#fafafa] border-[#e4e4e7] text-[#71717a] hover:bg-[#f4f4f5]'
                      : 'bg-white border-[#e4e4e7] text-[#09090b] hover:bg-[#fafafa] shadow-sm'
                  }`}
                >
                  {cargando && key === '✓' ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : key}
                </button>
              ))}
            </div>

            <button
              onClick={() => { setPaso('telefono'); setError(''); setPin('') }}
              className="w-full text-center text-xs font-black text-[#71717a] hover:text-[#2563eb] uppercase tracking-wider transition-colors pt-2 block"
            >
              ← Cambiar Teléfono
            </button>
          </div>
        )}

        {/* Enlace de Registro Público */}
        <div className="text-center pt-2 border-t border-[#f4f4f5]">
          <Link
            href={registroUrl}
            className="text-xs font-bold text-[#2563eb] hover:text-[#1d4ed8] hover:underline transition-colors uppercase tracking-wider"
          >
            ¿No tienes cuenta? Regístrate aquí
          </Link>
        </div>
      </div>
    </div>
  )
}

// Helper para calcular la tarifa real en base al tabulador y las condiciones de la flota
function calcularTarifaReal(request: DeliveryRequest, fleet: any) {
  const tabulador = fleet?.tabulador
  const dist = request.distancia_km || 1.0

  let tBase = 40
  let tExtra = 0
  let extraKm = 0
  let extraLluvia = 0
  let extraNocturno = 0

  if (tabulador) {
    const rangos = tabulador.rangos || []
    const baseExtraKm = tabulador.base_extra_km || 12
    const precioExtraKm = tabulador.precio_extra_km || 5
    const recargoLluvia = tabulador.recargo_lluvia || 5
    const recargoNocturno = tabulador.recargo_nocturno || 5

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
        extraKm = Math.ceil(dist - limiteRango) * precioExtraKm
      }
    }

    if (dist >= baseExtraKm) {
      tBase = 65 // precio máximo a los 11km
      extraKm = Math.ceil(dist - 11) * precioExtraKm
    }

    tExtra += extraKm

    // Lluvia activa globalmente
    const lluviaActiva = fleet.tarifa_lluvia_activa ?? false
    if (lluviaActiva) {
      extraLluvia = recargoLluvia
      tExtra += extraLluvia
    }

    // Horario nocturno automático
    const nocturnoInicio = fleet.horario_nocturno_inicio || '21:30'
    const fechaCreacion = new Date(request.created_at)
    const horaCreacionStr = fechaCreacion.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
    if (horaCreacionStr >= nocturnoInicio || horaCreacionStr < '06:00') {
      extraNocturno = recargoNocturno
      tExtra += extraNocturno
    }
  }

  return {
    base: tBase,
    extraKm,
    extraLluvia,
    extraNocturno,
    extra: tExtra,
    total: tBase + tExtra
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTAL PRINCIPAL BIKER
// ─────────────────────────────────────────────────────────────────────────────
export default function BikerPortal() {
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null)

  // Modal de resumen y confirmación de cobro final
  const [showResumenModal, setShowResumenModal] = useState(false)
  const [resumenDesglose, setResumenDesglose] = useState<{
    base: number
    extraKm: number
    extraLluvia: number
    extraNocturno: number
    extra: number
    total: number
  } | null>(null)

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      setErrorGlobal(`Error global: ${e.message} en ${e.filename}:${e.lineno}`)
    }
    const handleRejection = (e: PromiseRejectionEvent) => {
      setErrorGlobal(`Rechazo de promesa: ${e.reason}`)
    }
    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  const params = useParams()
  const slug = (params?.slug as string) || ''
  const [fleet, setFleet] = useState<any>(null)
  const [biker, setBiker] = useState<Biker | null>(null)
  const [conectado, setConectado] = useState(false)
  const [cargandoFleet, setCargandoFleet] = useState(true)
  const [restaurandoSesion, setRestaurandoSesion] = useState(false)

  // Viaje activo del biker (aceptado/en_camino)
  const [viajeActivo, setViajeActivo] = useState<DeliveryRequest | null>(null)
  // Pool de solicitudes pendientes (solo visible si conectado)
  const [pendientes, setPendientes] = useState<DeliveryRequest[]>([])

  const [procesando, setProcesando] = useState(false)
  const [notificacion, setNotificacion] = useState<{ tipo: 'ok' | 'error'; msg: string } | null>(null)

  // Estadísticas del día
  const [stats, setStats] = useState({ ganancias: 0, servicios: 0, minutosConexion: 0 })

  // ── Verificar admisión y bloqueos en sesión activa ───────────────────────
  const verificarBikerStatus = useCallback(async () => {
    if (!biker) return true
    
    const { data, error } = await supabase
      .from('bikers')
      .select('estado_aprobacion, bloqueado_hasta, bloqueado_permanente, current_session_id, activo_hasta')
      .eq('id', biker.id)
      .maybeSingle()

    if (error || !data) return true

    const isPending = data.estado_aprobacion !== 'aprobado'
    const isPermBlocked = data.bloqueado_permanente
    const isTempBlocked = data.bloqueado_hasta && new Date(data.bloqueado_hasta) > new Date()
    const sessionMismatch = data.current_session_id && data.current_session_id !== getCookie('biker_session_id')
    const isExpired = data.activo_hasta && new Date(data.activo_hasta) < new Date()

    if (sessionMismatch) {
      // Candado de sesión única: forzar logout inmediato
      document.cookie = 'biker_session_id=; path=/; max-age=0'
      await supabase.from('bikers').update({ conectado: false }).eq('id', biker.id)
      setBiker(null)
      setConectado(false)
      setViajeActivo(null)
      setPendientes([])
      alert('Tu sesión ha expirado porque se inició sesión en otro dispositivo.')
      return false
    }

    if (isPending || isPermBlocked || isTempBlocked) {
      // Bloqueo normal
      await supabase.from('bikers').update({ conectado: false }).eq('id', biker.id)
      setBiker(null)
      setConectado(false)
      setViajeActivo(null)
      setPendientes([])
      
      let msg = 'Acceso restringido.'
      if (data.estado_aprobacion === 'pendiente') msg = 'Tu cuenta está pendiente de aprobación.'
      else if (data.estado_aprobacion === 'rechazado') msg = 'Tu cuenta ha sido rechazada.'
      else if (isPermBlocked) msg = 'Tu cuenta ha sido bloqueada permanentemente.'
      else if (isTempBlocked) {
        msg = `Tu cuenta está suspendida temporalmente hasta el ${new Date(data.bloqueado_hasta).toLocaleString('es-MX')}.`
      }
      alert(msg)
      return false
    }

    if (isExpired && conectado) {
      // Expiración de crédito: desconectar al biker
      await supabase.from('bikers').update({ conectado: false }).eq('id', biker.id)
      setConectado(false)
      alert('Tu tiempo de acceso ha expirado. Por favor, realiza una recarga con el modulador de la flota.')
    }

    return true
  }, [biker, conectado])

  useEffect(() => {
    if (!biker) return
    verificarBikerStatus()
    
    // Verificar cada 20 segundos
    const intv = setInterval(() => verificarBikerStatus(), 20000)
    return () => clearInterval(intv)
  }, [biker, verificarBikerStatus])

  // GPS Broadcast — cero writes a BD por ping
  useGPSBroadcast(fleet?.id || '', biker?.id || '', conectado)

  // ── Restaurar sesión del biker en base al cookie `biker_session_id` ──────
  useEffect(() => {
    const sessionId = getCookie('biker_session_id')
    if (!sessionId) {
      setRestaurandoSesion(false)
      return
    }

    setRestaurandoSesion(true)
    const restaurarSesion = async () => {
      try {
        const { data, error } = await supabase
          .from('bikers')
          .select('*')
          .eq('current_session_id', sessionId)
          .eq('activo', true)
          .maybeSingle()

        if (error) throw error

        if (data && data.estado_aprobacion === 'aprobado' && !data.bloqueado_permanente) {
          const blockUntil = data.bloqueado_hasta ? new Date(data.bloqueado_hasta) : null
          if (!blockUntil || blockUntil <= new Date()) {
            setBiker(data as Biker)
            setConectado(data.conectado)
          } else {
            document.cookie = 'biker_session_id=; path=/; max-age=0'
          }
        } else {
          document.cookie = 'biker_session_id=; path=/; max-age=0'
        }
      } catch (err) {
        console.warn('[Biker Session Restore] Falló restauración:', err)
      } finally {
        setRestaurandoSesion(false)
      }
    }
    restaurarSesion()
  }, [])

  // ── Cargar flota por slug ────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return

    const cargarFlota = async () => {
      setCargandoFleet(true)
      try {
        const { data: biz, error: bizError } = await supabase
          .from('businesses')
          .select('id, nombre, slug')
          .eq('slug', slug)
          .maybeSingle()

        if (bizError || !biz) {
          console.warn('[Biker Load Fleet] Error o no biz:', bizError)
          setFleet(null)
          return
        }

        const { data: fls, error: flError } = await supabase
          .from('delivery_fleets')
          .select('*')
          .eq('business_id', biz.id)
          .eq('activo', true)

        if (flError) {
          console.warn('[Biker Load Fleet] Error fl:', flError)
        }
        const fl = fls && fls.length > 0 ? fls[0] : null
        setFleet(fl ? { ...fl, biz_nombre: biz.nombre } : null)
      } catch (err) {
        console.error('[Biker Load Fleet] Rejection:', err)
        setFleet(null)
      } finally {
        setCargandoFleet(false)
      }
    }

    cargarFlota()
  }, [slug])

  // ── Mostrar notificación temporal ────────────────────────────────────────
  const notif = useCallback((tipo: 'ok' | 'error', msg: string) => {
    setNotificacion({ tipo, msg })
    setTimeout(() => setNotificacion(null), 3000)
  }, [])

  // ── Conectar / Desconectar ───────────────────────────────────────────────
  const toggleConectado = async () => {
    if (!biker || !fleet) return
    
    const ok = await verificarBikerStatus()
    if (!ok) return

    // Cargar activo_hasta para verificar vencimiento, y datos de conexión
    const { data: bInfo } = await supabase
      .from('bikers')
      .select('activo_hasta, conectado_desde, minutos_conexion_hoy')
      .eq('id', biker.id)
      .maybeSingle()

    if (bInfo && bInfo.activo_hasta && new Date(bInfo.activo_hasta) < new Date()) {
      alert('Tu cuenta está vencida. No puedes conectarte hasta realizar una recarga de créditos/tiempo.')
      return
    }

    const nuevoEstado = !conectado
    setProcesando(true)
    try {
      const nowStr = new Date().toISOString()
      const updatePayload: any = {
        conectado: nuevoEstado,
      }

      if (nuevoEstado) {
        updatePayload.conectado_desde = nowStr
        updatePayload.ultimo_ping = nowStr
      } else {
        // Calcular y acumular duración
        if (bInfo && bInfo.conectado_desde) {
          const start = new Date(bInfo.conectado_desde).getTime()
          const end = Date.now()
          const diffMinutes = Math.max(0, Math.floor((end - start) / 60000))
          updatePayload.minutos_conexion_hoy = (bInfo.minutos_conexion_hoy || 0) + diffMinutes
        }
        updatePayload.conectado_desde = null
      }

      await supabase
        .from('bikers')
        .update(updatePayload)
        .eq('id', biker.id)

      setConectado(nuevoEstado)
      if (!nuevoEstado) {
        // Al desconectar: limpiar el pool de pendientes
        setPendientes([])
      }
      cargarStatsHoy()
    } finally {
      setProcesando(false)
    }
  }

  // ── Cargar estadísticas del día (ganancias, servicios, minutos de conexión) ──
  const cargarStatsHoy = useCallback(async () => {
    if (!biker) return
    try {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const hoyIso = hoy.toISOString()

      // Fetch completed requests today
      const { data: requestsToday } = await supabase
        .from('delivery_requests')
        .select('total_cobrado')
        .eq('biker_id', biker.id)
        .eq('estado', 'completado')
        .gte('created_at', hoyIso)

      let totalGanado = 0
      let countServicios = 0
      if (requestsToday) {
        countServicios = requestsToday.length
        totalGanado = requestsToday.reduce((acc, curr) => acc + (Number(curr.total_cobrado) || 0), 0)
      }

      // Fetch biker's minutos_conexion_hoy and conectado_desde
      const { data: bInfo } = await supabase
        .from('bikers')
        .select('minutos_conexion_hoy, conectado_desde')
        .eq('id', biker.id)
        .maybeSingle()

      let minConexion = 0
      if (bInfo) {
        minConexion = bInfo.minutos_conexion_hoy || 0
        if (bInfo.conectado_desde) {
          const start = new Date(bInfo.conectado_desde).getTime()
          const diffMinutes = Math.max(0, Math.floor((Date.now() - start) / 60000))
          minConexion += diffMinutes
        }
      }

      setStats({
        ganancias: totalGanado,
        servicios: countServicios,
        minutosConexion: minConexion
      })
    } catch (e) {
      console.error('Error al cargar estadísticas:', e)
    }
  }, [biker])

  // Polling para mantener actualizadas las estadísticas (ej. minutos de conexión)
  useEffect(() => {
    if (!biker) return
    cargarStatsHoy()
    const intv = setInterval(() => cargarStatsHoy(), 60000)
    return () => clearInterval(intv)
  }, [biker, cargarStatsHoy])

  // ── Cargar viaje activo del biker ────────────────────────────────────────
  const cargarViajeActivo = useCallback(async () => {
    if (!biker) return
    const { data } = await supabase
      .from('delivery_requests')
      .select('*, businesses!restaurante_id(nombre)')
      .eq('biker_id', biker.id)
      .in('estado', ['aceptado', 'en_camino'])
      .maybeSingle()
    setViajeActivo(data as DeliveryRequest | null)
  }, [biker])

  // ── Cargar solicitudes pendientes de la flota ────────────────────────────
  const cargarPendientes = useCallback(async () => {
    if (!fleet || !conectado) return
    const { data } = await supabase
      .from('delivery_requests')
      .select('*, businesses!restaurante_id(nombre)')
      .eq('fleet_id', fleet.id)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: true })
    setPendientes((data as DeliveryRequest[]) || [])
  }, [fleet, conectado])

  // ── Suscripción Realtime a cambios en delivery_requests ──────────────────
  useEffect(() => {
    if (!fleet || !biker) return
    cargarViajeActivo()
    cargarStatsHoy()
    if (conectado) cargarPendientes()

    const channel = supabase
      .channel(`delivery_requests_fleet_${fleet.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_requests', filter: `fleet_id=eq.${fleet.id}` },
        () => {
          cargarViajeActivo()
          cargarStatsHoy()
          if (conectado) cargarPendientes()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fleet, biker, conectado, cargarViajeActivo, cargarPendientes, cargarStatsHoy])

  // ── ACCIÓN: ¡YO! — Reclamar viaje (RPC atómica anti-race-condition) ─────
  const reclamarViaje = async (requestId: string) => {
    if (!biker || procesando) return
    setProcesando(true)
    try {
      const { data: ganado, error } = await supabase
        .rpc('reclamar_viaje', { p_request_id: requestId, p_biker_id: biker.id })

      if (error) throw error
      if (ganado) {
        notif('ok', '¡Viaje reclamado! Dirígete al restaurante.')
        await cargarViajeActivo()
        await cargarPendientes()
      } else {
        notif('error', 'Otro biker llegó primero. Sigue en espera.')
        await cargarPendientes()
      }
    } catch (e) {
      notif('error', 'Error al reclamar. Intenta de nuevo.')
    } finally {
      setProcesando(false)
    }
  }

  // ── ACCIÓN: Avanzar estado del viaje (Recogí → Entregué) ─────────────────
  const avanzarEstado = async () => {
    if (!viajeActivo || procesando) return

    // Si el siguiente estado es completado, abrimos el modal de cobro final
    if (viajeActivo.estado === 'en_camino') {
      const desglose = calcularTarifaReal(viajeActivo, fleet)
      setResumenDesglose(desglose)
      setShowResumenModal(true)
      return
    }

    setProcesando(true)
    try {
      await supabase
        .from('delivery_requests')
        .update({ estado: 'en_camino', recogido_at: new Date().toISOString() })
        .eq('id', viajeActivo.id)
      notif('ok', '¡Pedido recogido! Llevas el paquete.')
      await cargarViajeActivo()
    } catch {
      notif('error', 'Error al actualizar el estado.')
    } finally {
      setProcesando(false)
    }
  }

  // ── ACCIÓN: Confirmar entrega final con tarifas recalculadas ──────────────
  const confirmarEntregaFinal = async () => {
    if (!viajeActivo || !resumenDesglose || procesando) return
    setProcesando(true)
    try {
      await supabase
        .from('delivery_requests')
        .update({
          estado: 'completado',
          entregado_at: new Date().toISOString(),
          tarifa_base: resumenDesglose.base,
          tarifa_extra: resumenDesglose.extra,
          total_cobrado: resumenDesglose.total
        })
        .eq('id', viajeActivo.id)
      
      notif('ok', '¡Entrega completada! Bien hecho 🎉')
      setShowResumenModal(false)
      setResumenDesglose(null)
      setViajeActivo(null)
      await cargarStatsHoy()
    } catch (e) {
      notif('error', 'Error al completar la entrega.')
    } finally {
      setProcesando(false)
    }
  }

  // ── ACCIÓN: Cancelar viaje (regresa a pendiente para el pool) ─────────────
  const cancelarViaje = async () => {
    if (!viajeActivo || !biker || procesando) return
    if (!confirm('¿Cancelar este viaje? Volverá al pool para otros repartidores.')) return
    setProcesando(true)
    try {
      const { data: ok } = await supabase
        .rpc('cancelar_viaje_biker', {
          p_request_id: viajeActivo.id,
          p_biker_id: biker.id,
          p_motivo: 'Cancelado por el biker desde el portal',
        })
      if (ok) {
        notif('ok', 'Viaje cancelado. Volvió al pool.')
        setViajeActivo(null)
        if (conectado) await cargarPendientes()
      }
    } catch {
      notif('error', 'Error al cancelar.')
    } finally {
      setProcesando(false)
    }
  }

  // ── ACCIÓN: Cerrar sesión ─────────────────────────────────────────────────
  const cerrarSesion = async () => {
    if (biker) {
      await supabase.from('bikers').update({ conectado: false }).eq('id', biker.id)
    }
    setBiker(null)
    setConectado(false)
    setViajeActivo(null)
    setPendientes([])
  }

  if (errorGlobal) {
    return (
      <div className="p-6 bg-red-50 text-red-700 min-h-screen font-mono text-xs" style={{ backgroundColor: '#fef2f2', color: '#991b1b', padding: '24px' }}>
        <h1 className="font-bold text-lg mb-2">Error de Ejecución</h1>
        <p>{errorGlobal}</p>
      </div>
    )
  }

  // ── Estados de carga ─────────────────────────────────────────────────────
  if (cargandoFleet || restaurandoSesion) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#dc2626] animate-spin" />
      </div>
    )
  }

  if (!fleet) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-[#dc2626] mb-4" />
        <h2 className="text-xl font-bold text-[#09090b]">Flota no encontrada</h2>
        <p className="text-sm text-[#71717a] mt-2">Este portal no corresponde a ninguna flota activa.</p>
      </div>
    )
  }

  if (!biker) {
    return <LoginBiker fleetId={fleet.id} onLogin={(b) => { setBiker(b); setConectado(b.conectado) }} />
  }

  // ── Render principal ─────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#fafafa] font-sans pb-8">

      {/* Notificación Toast */}
      {notificacion && (
        <div className={`fixed top-4 left-4 right-4 z-50 rounded-2xl p-4 shadow-lg border flex items-center gap-3 animate-slideUp ${
          notificacion.tipo === 'ok'
            ? 'bg-white border-green-200'
            : 'bg-white border-red-200'
        }`}>
          {notificacion.tipo === 'ok'
            ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            : <XCircle className="w-5 h-5 text-[#dc2626] shrink-0" />
          }
          <p className="text-sm font-semibold text-[#09090b]">{notificacion.msg}</p>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-[#e4e4e7] px-4 py-4 flex items-center justify-between sticky top-0 z-30 shadow-[0_1px_0_#e4e4e7]">
        <div className="flex items-center gap-3">
          <img
            src="/bikers.png"
            alt="Bikers Logo"
            className="w-9 h-9 object-contain rounded-xl shrink-0"
          />
          <div>
            <p className="text-[10px] text-[#a1a1aa] font-semibold uppercase tracking-wide">{fleet.biz_nombre}</p>
            <p className="text-sm font-bold text-[#09090b]">{biker.nombre}</p>
          </div>
        </div>
        <button
          onClick={cerrarSesion}
          className="flex items-center gap-1.5 text-[10px] font-bold text-[#71717a] hover:text-[#dc2626] uppercase tracking-wider transition-colors border border-[#e4e4e7] rounded-xl px-3 py-2 hover:border-red-200 hover:bg-red-50"
        >
          <LogOut className="w-3.5 h-3.5" />
          Salir
        </button>
      </header>

      <div className="max-w-sm mx-auto px-4 pt-6 space-y-5">

        {/* ── PANEL DE ESTADÍSTICAS DEL DÍA ── */}
        <div className="grid grid-cols-3 gap-2 animate-fadeIn">
          {/* Ganancias Card */}
          <div className="bg-white border border-[#e4e4e7] rounded-2xl p-3 flex flex-col items-center text-center justify-between shadow-xs">
            <span className="text-[18px]">💵</span>
            <div className="mt-1">
              <p className="text-[13px] font-black text-[#09090b] font-mono leading-none">
                ${stats.ganancias.toFixed(0)}
              </p>
              <p className="text-[8px] font-bold text-[#71717a] uppercase tracking-wider mt-1">
                Ganado
              </p>
            </div>
          </div>

          {/* Servicios Card */}
          <div className="bg-white border border-[#e4e4e7] rounded-2xl p-3 flex flex-col items-center text-center justify-between shadow-xs">
            <span className="text-[18px]">🛵</span>
            <div className="mt-1">
              <p className="text-[13px] font-black text-[#09090b] font-mono leading-none">
                {stats.servicios}
              </p>
              <p className="text-[8px] font-bold text-[#71717a] uppercase tracking-wider mt-1">
                Viajes
              </p>
            </div>
          </div>

          {/* Conexión Card */}
          <div className="bg-white border border-[#e4e4e7] rounded-2xl p-3 flex flex-col items-center text-center justify-between shadow-xs">
            <span className="text-[18px]">⏱️</span>
            <div className="mt-1 text-center">
              <p className="text-[12px] font-black text-[#09090b] font-mono leading-none truncate w-full">
                {Math.floor(stats.minutosConexion / 60)}h {stats.minutosConexion % 60}m
              </p>
              <p className="text-[8px] font-bold text-[#71717a] uppercase tracking-wider mt-1">
                Conexión
              </p>
            </div>
          </div>
        </div>

        {/* ── SWITCH: Conectado / Desconectado ── */}
        <div className={`rounded-3xl border p-5 transition-all ${
          conectado
            ? 'bg-white border-green-200 shadow-[0_2px_12px_rgba(22,163,74,0.08)]'
            : 'bg-white border-[#e4e4e7]'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                conectado ? 'bg-green-50' : 'bg-[#fafafa]'
              }`}>
                {conectado
                  ? <Wifi className="w-5 h-5 text-green-600" />
                  : <WifiOff className="w-5 h-5 text-[#a1a1aa]" />
                }
              </div>
              <div>
                <p className="text-sm font-bold text-[#09090b]">
                  {conectado ? 'Conectado' : 'Desconectado'}
                </p>
                <p className="text-[10px] text-[#71717a] font-medium">
                  {conectado ? 'Recibiendo alertas de pedidos' : 'No recibirás nuevos viajes'}
                </p>
              </div>
            </div>
            {/* Toggle switch */}
            <button
              onClick={toggleConectado}
              disabled={procesando}
              className={`w-14 h-8 rounded-full transition-all duration-300 relative focus:outline-none ${
                conectado ? 'bg-green-500' : 'bg-[#d4d4d8]'
              } ${procesando ? 'opacity-60' : ''}`}
              id="toggle-conectado"
              aria-label={conectado ? 'Desconectarse' : 'Conectarse'}
            >
              <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${
                conectado ? 'left-7' : 'left-1'
              }`} />
            </button>
          </div>
        </div>

        {/* ── VIAJE ACTIVO ── */}
        {viajeActivo && (
          <div className="bg-white border border-[#e4e4e7] rounded-3xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.06)] animate-fadeIn">
            {/* Banner estado */}
            <div className={`px-5 py-3 flex items-center justify-between ${
              viajeActivo.estado === 'en_camino' ? 'bg-indigo-50' : 'bg-blue-50'
            }`}>
              <p className={`text-xs font-black uppercase tracking-wider ${
                viajeActivo.estado === 'en_camino' ? 'text-indigo-700' : 'text-blue-700'
              }`}>
                {viajeActivo.estado === 'en_camino' ? '🛵 En camino — llevas el pedido' : '📦 Recoge el pedido'}
              </p>
              <EstadoBadge estado={viajeActivo.estado} />
            </div>

            <div className="p-5 space-y-4">
              {/* Restaurante */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#fef2f2] rounded-xl flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 text-[#dc2626]" />
                </div>
                <div>
                  <p className="text-[10px] text-[#a1a1aa] font-semibold uppercase tracking-wide">Restaurante</p>
                  <p className="text-sm font-bold text-[#09090b]">
                    {(viajeActivo.businesses as any)?.nombre || 'Restaurante'}
                  </p>
                  {viajeActivo.descripcion && (
                    <p className="text-xs text-[#71717a] mt-0.5">{viajeActivo.descripcion}</p>
                  )}
                </div>
              </div>

              {/* Dirección de entrega */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#fef2f2] rounded-xl flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-[#dc2626]" />
                </div>
                <div>
                  <p className="text-[10px] text-[#a1a1aa] font-semibold uppercase tracking-wide">Dirección de entrega</p>
                  <p className="text-sm font-semibold text-[#09090b]">{viajeActivo.direccion_entrega}</p>
                  {viajeActivo.referencia && (
                    <p className="text-xs text-[#dc2626] font-semibold mt-1">
                      📍 Ref: {viajeActivo.referencia}
                    </p>
                  )}
                  {viajeActivo.nota_biker && (
                    <p className="text-xs text-[#71717a] mt-0.5 italic">{viajeActivo.nota_biker}</p>
                  )}
                </div>
              </div>

              {/* Cliente y Detalles del Viaje */}
              {(viajeActivo.nombre_cliente || viajeActivo.telefono_cliente || (viajeActivo as any).distancia_km || viajeActivo.total_cobrado) && (
                <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-2xl p-4.5 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold border-b border-[#e4e4e7] pb-2">
                    <span className="text-[#09090b]">Detalles del Envío</span>
                    {(viajeActivo as any).distancia_km && (
                      <span className="bg-zinc-100 text-[#71717a] font-mono px-2 py-0.5 rounded-lg text-[10px]">
                        📍 {Number((viajeActivo as any).distancia_km).toFixed(1)} km
                      </span>
                    )}
                  </div>
                  
                  {/* Nombre y teléfono */}
                  <div className="space-y-1.5">
                    {viajeActivo.nombre_cliente && (
                      <p className="text-xs font-semibold text-[#09090b] flex items-center gap-1.5">
                        👤 <span className="font-normal text-[#71717a]">Cliente:</span> {viajeActivo.nombre_cliente}
                      </p>
                    )}
                    {viajeActivo.telefono_cliente && (
                      <div className="text-xs font-semibold text-[#09090b] flex items-center gap-1.5">
                        📞 <span className="font-normal text-[#71717a]">Teléfono:</span>
                        <a
                          href={`tel:${viajeActivo.telefono_cliente}`}
                          className="text-[#dc2626] font-mono font-bold hover:underline flex items-center gap-1 bg-[#fef2f2] border border-[#fee2e2] px-2.5 py-1 rounded-xl"
                        >
                          {viajeActivo.telefono_cliente}
                        </a>
                      </div>
                    )}
                  </div>

                  {viajeActivo.total_cobrado && (
                    <div className="border-t border-[#e4e4e7] pt-2 flex justify-between items-center text-xs font-bold">
                      <span className="text-[#71717a]">Cobro al Entregar:</span>
                      <span className="bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-xl font-mono text-sm">
                        ${Number(viajeActivo.total_cobrado).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Enlace a maps si hay coords */}
              {viajeActivo.lat_entrega && viajeActivo.lng_entrega && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${viajeActivo.lat_entrega},${viajeActivo.lng_entrega}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs font-bold text-[#dc2626] hover:underline"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Abrir ruta en Google Maps
                </a>
              )}

              {/* Botón de progresión */}
              <button
                onClick={avanzarEstado}
                disabled={procesando}
                className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black py-4 rounded-2xl uppercase tracking-widest text-sm transition-all active:scale-95 shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {procesando
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : viajeActivo.estado === 'aceptado'
                  ? <><CheckCircle className="w-5 h-5" /> Recogí el pedido</>
                  : <><CheckCircle className="w-5 h-5" /> Entregué el pedido</>
                }
              </button>

              {/* Botón cancelar (solo si aún no está en_camino con entrega) */}
              {viajeActivo.estado === 'aceptado' && (
                <button
                  onClick={cancelarViaje}
                  disabled={procesando}
                  className="w-full border border-[#e4e4e7] text-[#71717a] hover:border-red-200 hover:text-[#dc2626] hover:bg-red-50 font-semibold py-3 rounded-2xl text-xs uppercase tracking-wider transition-all"
                >
                  Cancelar viaje
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── POOL DE SOLICITUDES PENDIENTES ── */}
        {conectado && !viajeActivo && (
          <div className="space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#09090b]">Viajes disponibles</h2>
              {pendientes.length > 0 && (
                <span className="text-[10px] font-black text-[#dc2626] bg-[#fef2f2] border border-[#fee2e2] px-2 py-0.5 rounded-full">
                  {pendientes.length} disponible{pendientes.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {pendientes.length === 0 ? (
              <div className="bg-white border border-[#e4e4e7] rounded-3xl p-8 text-center space-y-3">
                <Clock className="w-10 h-10 text-[#d4d4d8] mx-auto" />
                <p className="text-sm font-semibold text-[#71717a]">Sin solicitudes por ahora</p>
                <p className="text-xs text-[#a1a1aa]">Cuando un restaurante solicite un repartidor, aparecerá aquí.</p>
              </div>
            ) : (
              pendientes.map(req => (
                <div
                  key={req.id}
                  className="bg-white border border-[#e4e4e7] rounded-3xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.04)] animate-fadeIn"
                >
                  <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                    <p className="text-xs font-black text-amber-700 uppercase tracking-wider">
                      📍 Nuevo pedido
                    </p>
                    <span className="text-[10px] text-amber-600 font-mono">
                      hace {tiempoTranscurrido(req.created_at)}
                    </span>
                  </div>

                  <div className="p-5 space-y-3">
                    <div>
                      <p className="text-[10px] text-[#a1a1aa] font-semibold uppercase tracking-wide">Restaurante</p>
                      <p className="text-sm font-bold text-[#09090b]">
                        {(req.businesses as any)?.nombre || 'Restaurante'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#a1a1aa] font-semibold uppercase tracking-wide">Entregar en</p>
                      <p className="text-sm font-semibold text-[#52525b]">{req.direccion_entrega}</p>
                      {req.referencia && (
                        <p className="text-xs text-[#dc2626] font-medium mt-0.5">
                          📍 Ref: {req.referencia}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-bold font-mono">
                      {(req as any).distancia_km !== undefined && (req as any).distancia_km !== null && (
                        <span className="bg-zinc-100 text-[#71717a] px-2 py-0.5 rounded-lg border border-[#e4e4e7]">
                          📍 {Number((req as any).distancia_km).toFixed(1)} km
                        </span>
                      )}
                      {req.total_cobrado !== undefined && req.total_cobrado !== null && (
                        <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-lg border border-green-200">
                          💵 ${Number(req.total_cobrado).toFixed(2)}
                        </span>
                      )}
                    </div>

                    {req.descripcion && (
                      <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-xl p-3">
                        <p className="text-xs text-[#71717a]">{req.descripcion}</p>
                      </div>
                    )}

                    <button
                      onClick={() => reclamarViaje(req.id)}
                      disabled={procesando}
                      className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black py-4 rounded-2xl text-lg tracking-widest transition-all active:scale-95 shadow-[0_4px_16px_rgba(220,38,38,0.25)] disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {procesando
                        ? <Loader2 className="w-6 h-6 animate-spin" />
                        : '¡YO!'
                      }
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Estado: desconectado sin viaje ── */}
        {!conectado && !viajeActivo && (
          <div className="bg-white border border-[#e4e4e7] rounded-3xl p-8 text-center space-y-4 animate-fadeIn">
            <WifiOff className="w-12 h-12 text-[#d4d4d8] mx-auto" />
            <div>
              <p className="text-sm font-bold text-[#09090b]">Estás desconectado</p>
              <p className="text-xs text-[#71717a] mt-1">
                Activa el switch de arriba para empezar a recibir solicitudes de viaje y transmitir tu ubicación.
              </p>
            </div>
            <button
              onClick={toggleConectado}
              disabled={procesando}
              className="bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black py-3.5 px-8 rounded-2xl text-sm uppercase tracking-widest transition-all active:scale-95 shadow-md disabled:opacity-60"
            >
              Conectarme ahora
            </button>
          </div>
        )}

        {/* Modal: Resumen de Entrega (Costo Real a Cobrar) */}
        {showResumenModal && viajeActivo && resumenDesglose && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white border border-[#e4e4e7] rounded-3xl max-w-sm w-full p-6 shadow-xl space-y-5 animate-scaleUp">
              <div className="text-center space-y-1.5">
                <span className="text-[10px] font-black text-[#dc2626] tracking-widest uppercase bg-red-50 border border-red-100 px-3 py-1 rounded-full">
                  💵 Resumen de Entrega
                </span>
                <h3 className="text-base font-bold text-[#09090b] pt-2">Costo Real a Cobrar</h3>
                <p className="text-xs text-[#71717a]">
                  Revisa el desglose de tarifas calculado por el sistema antes de finalizar.
                </p>
              </div>

              <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-2xl p-4.5 space-y-3 font-mono text-xs">
                {viajeActivo.direccion_entrega && (
                  <div className="font-sans border-b border-[#e4e4e7] pb-3 mb-2 space-y-1 text-left">
                    <span className="text-[9px] text-[#a1a1aa] font-bold uppercase tracking-wider block">Destino</span>
                    <span className="text-xs font-semibold text-[#09090b] block truncate">{viajeActivo.direccion_entrega}</span>
                    {viajeActivo.referencia && (
                      <span className="text-[10px] font-medium text-[#dc2626] block">📍 Ref: {viajeActivo.referencia}</span>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center text-[#52525b]">
                  <span className="font-sans">Distancia Real:</span>
                  <span className="font-bold text-[#09090b]">
                    {viajeActivo.distancia_km ? Number(viajeActivo.distancia_km).toFixed(1) : '1.0'} km
                  </span>
                </div>

                <div className="flex justify-between items-center text-[#52525b]">
                  <span className="font-sans">Tarifa Base (KM):</span>
                  <span className="font-bold text-[#09090b]">${resumenDesglose.base.toFixed(2)}</span>
                </div>

                {resumenDesglose.extraKm > 0 && (
                  <div className="flex justify-between items-center text-[#52525b]">
                    <span className="font-sans">Exceso de KM:</span>
                    <span className="font-bold text-[#09090b]">${resumenDesglose.extraKm.toFixed(2)}</span>
                  </div>
                )}

                {resumenDesglose.extraLluvia > 0 && (
                  <div className="flex justify-between items-center text-blue-600">
                    <span className="font-sans">🌧️ Recargo Lluvia:</span>
                    <span className="font-bold">${resumenDesglose.extraLluvia.toFixed(2)}</span>
                  </div>
                )}

                {resumenDesglose.extraNocturno > 0 && (
                  <div className="flex justify-between items-center text-[#dc2626]">
                    <span className="font-sans">🌙 Recargo Nocturno:</span>
                    <span className="font-bold">${resumenDesglose.extraNocturno.toFixed(2)}</span>
                  </div>
                )}

                <div className="border-t border-dashed border-[#e4e4e7] pt-3 flex justify-between items-center text-sm font-black text-[#09090b]">
                  <span className="font-sans">Total a Cobrar:</span>
                  <span className="text-base text-green-700">${resumenDesglose.total.toFixed(2)} MXN</span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={confirmarEntregaFinal}
                  disabled={procesando}
                  className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black py-3.5 rounded-2xl uppercase tracking-widest text-xs transition-all active:scale-95 shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {procesando ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Confirmar Entrega
                    </>
                  )}
                </button>

                <button
                  onClick={() => setShowResumenModal(false)}
                  disabled={procesando}
                  className="w-full border border-[#e4e4e7] text-[#71717a] hover:bg-zinc-50 font-semibold py-3 rounded-2xl text-xs uppercase tracking-wider transition-all"
                >
                  Regresar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
