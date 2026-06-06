'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import {
  Truck, Users, FileText, Check, X, ShieldAlert, ShieldCheck,
  TrendingUp, DollarSign, Clock, Award, Loader2, Wifi, WifiOff,
  UserCheck, UserX, AlertCircle, LogOut, ChevronRight, HelpCircle,
  MapPin, Settings, Calendar, PlusCircle, RefreshCw, Phone, Plus, Minus
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS E INTERFACES
// ─────────────────────────────────────────────────────────────────────────────
interface Biker {
  id: string
  nombre: string
  telefono: string | null
  foto_url: string | null
  conectado: boolean
  estado_aprobacion: 'pendiente' | 'aprobado' | 'rechazado'
  bloqueado_hasta: string | null
  bloqueado_permanente: boolean
  activo_hasta: string | null
  numero_biker?: string | null
}

interface DeliveryRequest {
  id: string
  fleet_id: string
  restaurante_id: string
  biker_id: string | null
  descripcion: string | null
  direccion_entrega: string
  referencia?: string | null
  nombre_cliente?: string | null
  telefono_cliente?: string | null
  distancia_km?: number | null
  estado: string
  created_at: string
  aceptado_flota_at: string | null
  aceptado_at: string | null
  entregado_at: string | null
  tarifa_base: number | null
  tarifa_extra: number | null
  total_cobrado: number | null
  tiempo_estimado_entrega?: number | null
  businesses?: { nombre: string; logo_url?: string | null } | null
  bikers?: { nombre: string } | null
}

export default function ModuladorDashboard() {
  const params = useParams()
  const slug = (params.slug as string) || ''

  // Sesión y estados de carga
  const [cargandoAuth, setCargandoAuth] = useState(true)
  const [fleet, setFleet] = useState<any>(null)
  const [session, setSession] = useState<{ rol: string; user: string; businessId: string } | null>(null)

  console.log("[Modulador] Component Render: cargandoAuth =", cargandoAuth, "session =", session, "fleet =", fleet)

  // Login local
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPin, setLoginPin] = useState('')
  const [loginError, setLoginError] = useState('')
  const [iniciando, setIniciando] = useState(false)

  // Datos principales
  const [bikers, setBikers] = useState<Biker[]>([])
  const [requests, setRequests] = useState<DeliveryRequest[]>([])
  const [tiemposEstimados, setTiemposEstimados] = useState<Record<string, number>>({})
  const [cargandoDatos, setCargandoDatos] = useState(false)

  // Navegación: Servicios, Métricas, Usuarios, Mapa, Configuración
  const [pestana, setPestana] = useState<'servicios' | 'metricas' | 'usuarios' | 'mapa' | 'configuracion'>('servicios')

  // Filtros de fecha para KPIs (que ahora viven arriba de la pestaña Servicios)
  const [filtroFecha, setFiltroFecha] = useState<'hoy' | 'semana' | 'mes'>('hoy')

  // Modales
  const [bikerSeleccionadoBloqueo, setBikerSeleccionadoBloqueo] = useState<Biker | null>(null)
  const [bloqueoTiempo, setBloqueoTiempo] = useState('1') // horas
  
  const [bikerAprobacionModal, setBikerAprobacionModal] = useState<Biker | null>(null)
  const [diasInicialesCarga, setDiasInicialesCarga] = useState('0')
  const [bikerRecargaModal, setBikerRecargaModal] = useState<Biker | null>(null)
  const [diasRecargaCarga, setDiasRecargaCarga] = useState('7')

  // Modal para agregar Biker manualmente
  const [manualBikerModalOpen, setManualBikerModalOpen] = useState(false)
  const [manualNombre, setManualNombre] = useState('')
  const [manualTelefono, setManualTelefono] = useState('')
  const [manualPin, setManualPin] = useState('')
  const [manualDiasRegalo, setManualDiasRegalo] = useState('0')
  const [creandoManual, setCreandoManual] = useState(false)

  // Configuración de la Flota (Formulario reactivo)
  const [confPrecioCredito, setConfPrecioCredito] = useState('0')
  const [confTiempoCredito, setConfTiempoCredito] = useState('7')
  const [confDiasRegalo, setConfDiasRegalo] = useState('0')
  const [actualizandoConf, setActualizandoConf] = useState(false)
  const [confFeedback, setConfFeedback] = useState('')

  const [confHorarioNocturnoInicio, setConfHorarioNocturnoInicio] = useState('21:30')
  const [confTarifaLluviaActiva, setConfTarifaLluviaActiva] = useState(false)
  const [actualizandoLluvia, setActualizandoLluvia] = useState(false)

  // Tabulador de Tarifas
  const [tabuladorRangos, setTabuladorRangos] = useState<{ desde: number; hasta: number; precio: number }[]>([])
  const [tabuladorBaseExtraKm, setTabuladorBaseExtraKm] = useState('12')
  const [tabuladorPrecioExtraKm, setTabuladorPrecioExtraKm] = useState('5')
  const [tabuladorRecargoLluvia, setTabuladorRecargoLluvia] = useState('5')
  const [tabuladorRecargoLluviaFuerte, setTabuladorRecargoLluviaFuerte] = useState('10')
  const [tabuladorRecargoNocturno, setTabuladorRecargoNocturno] = useState('5')

  // ── Leaflet Interactive Map para Repartidores (Mapa) ──────────────────────
  const mapRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const [pingHistory, setPingHistory] = useState<any[]>([])

  // ── Verificar Cookies de Sesión ───────────────────────────────────────────
  const verificarSesion = useCallback(() => {
    if (typeof document === 'undefined') return
    try {
      console.log("[Modulador] verificarSesion iniciada. cookies =", document.cookie)
      const getCookie = (name: string) => {
        try {
          const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
          const val = match ? decodeURIComponent(match[1]) : ''
          console.log(`[Modulador] getCookie(${name}) =`, val)
          return val
        } catch (e) {
          console.warn(`[Modulador] Falló decodeURIComponent para ${name}, reintentando sin decodificar:`, e)
          const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
          return match ? match[1] : ''
        }
      }

      const rol = getCookie('session_rol')
      const user = getCookie('session_user')
      const businessId = getCookie('session_business_id')

      if (rol && (rol === 'admin_flota' || rol === 'admin_comercio') && businessId) {
        console.log("[Modulador] Sesión válida encontrada en cookies:", { rol, user, businessId })
        setSession({ rol, user, businessId })
      } else {
        console.log("[Modulador] No hay sesión de administrador válida en cookies.")
        setSession(null)
      }
    } catch (err) {
      console.error('[Modulador] Error general en verificarSesion:', err)
      setSession(null)
    } finally {
      console.log("[Modulador] setCargandoAuth(false) ejecutado.")
      setCargandoAuth(false)
    }
  }, [])

  useEffect(() => {
    verificarSesion()
  }, [verificarSesion])

  // ── Login Modulador ───────────────────────────────────────────────────────
  const iniciarSesion = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setIniciando(true)

    try {
      const { data: biz } = await supabase
        .from('businesses')
        .select('id, slug')
        .eq('slug', slug)
        .maybeSingle()

      if (!biz) {
        setLoginError('No se encontró información de la flota para este subdominio.')
        setIniciando(false)
        return
      }

      const { data: user, error: userErr } = await supabase
        .from('business_users')
        .select('*')
        .eq('email', loginEmail.toLowerCase())
        .eq('pin', loginPin)
        .eq('business_id', biz.id)
        .eq('activo', true)
        .maybeSingle()

      if (userErr || !user) {
        setLoginError('Credenciales incorrectas o usuario inactivo.')
      } else {
        const base = '; path=/; SameSite=Lax'
        document.cookie = `session_rol=admin_flota${base}`
        document.cookie = `session_user=${user.nombre}${base}`
        document.cookie = `session_business_id=${biz.id}${base}`
        document.cookie = `session_business_slug=${biz.slug}${base}`
        document.cookie = `session_user_id=${user.id}${base}`

        setSession({ rol: 'admin_flota', user: user.nombre, businessId: biz.id })
      }
    } catch (err) {
      setLoginError('Error de red. Intenta de nuevo.')
    } finally {
      setIniciando(false)
    }
  }

  // ── Cerrar Sesión ─────────────────────────────────────────────────────────
  const cerrarSesion = () => {
    const base = '; path=/; Max-Age=0'
    document.cookie = `session_rol=${base}`
    document.cookie = `session_user=${base}`
    document.cookie = `session_business_id=${base}`
    document.cookie = `session_business_slug=${base}`
    document.cookie = `session_user_id=${base}`
    setSession(null)
  }

  // ── Cargar información de la Flota (fleet_id) ─────────────────────────────
  useEffect(() => {
    if (!session?.businessId) return

    supabase
      .from('delivery_fleets')
      .select('*')
      .eq('business_id', session.businessId)
      .eq('activo', true)
      .then(({ data: fls }) => {
        const data = fls && fls.length > 0 ? fls[0] : null
        if (data) {
          setFleet(data)
          setConfPrecioCredito(String(data.precio_credito || '0'))
          setConfTiempoCredito(String(data.tiempo_credito_dias || '7'))
          setConfDiasRegalo(String(data.dias_regalo_nuevo || '0'))
          setConfHorarioNocturnoInicio(data.horario_nocturno_inicio || '21:30')
          setConfTarifaLluviaActiva(data.tarifa_lluvia_activa ?? false)

          const tab = data.tabulador || {}
          setTabuladorRangos(tab.rangos || [])
          setTabuladorBaseExtraKm(String(tab.base_extra_km ?? '12'))
          setTabuladorPrecioExtraKm(String(tab.precio_extra_km ?? '5'))
          setTabuladorRecargoLluvia(String(tab.recargo_lluvia ?? '5'))
          setTabuladorRecargoLluviaFuerte(String(tab.recargo_lluvia_fuerte ?? '10'))
          setTabuladorRecargoNocturno(String(tab.recargo_nocturno ?? '5'))
        }
      })
  }, [session])

  // ── Cargar Datos (Bikers y Solicitudes) ───────────────────────────────────
  const cargarDatos = useCallback(async () => {
    if (!fleet?.id) return
    setCargandoDatos(true)

    try {
      const { data: bikersData } = await supabase
        .from('bikers')
        .select('*')
        .eq('fleet_id', fleet.id)
        .eq('activo', true)
        .order('nombre', { ascending: true })

      const { data: requestsData } = await supabase
        .from('delivery_requests')
        .select('*, businesses!restaurante_id(nombre, logo_url), bikers(nombre)')
        .eq('fleet_id', fleet.id)
        .order('created_at', { ascending: false })

      setBikers((bikersData as Biker[]) || [])
      setRequests((requestsData as DeliveryRequest[]) || [])
    } catch (e) {
      console.error('Error al cargar datos logísticos:', e)
    } finally {
      setCargandoDatos(false)
    }
  }, [fleet])

  useEffect(() => {
    if (fleet?.id) {
      cargarDatos()
    }
  }, [fleet, cargarDatos])

  // ── Suscripción Realtime ──────────────────────────────────────────────────
  useEffect(() => {
    if (!fleet?.id) return

    const channel = supabase
      .channel(`fleet_modulador_realtime_${fleet.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_requests', filter: `fleet_id=eq.${fleet.id}` },
        () => cargarDatos()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bikers', filter: `fleet_id=eq.${fleet.id}` },
        () => cargarDatos()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fleet, cargarDatos])

  // ── Actualizar Configuración de Flota ─────────────────────────────────────
  const guardarConfiguracionFlota = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fleet?.id) return
    setActualizandoConf(true)
    setConfFeedback('')

    try {
      const tabuladorObj = {
        rangos: tabuladorRangos,
        base_extra_km: parseFloat(tabuladorBaseExtraKm) || 12,
        precio_extra_km: parseFloat(tabuladorPrecioExtraKm) || 5,
        recargo_lluvia: parseFloat(tabuladorRecargoLluvia) || 5,
        recargo_lluvia_fuerte: parseFloat(tabuladorRecargoLluviaFuerte) || 10,
        recargo_nocturno: parseFloat(tabuladorRecargoNocturno) || 5,
      }

      const { error } = await supabase
        .from('delivery_fleets')
        .update({
          precio_credito: parseFloat(confPrecioCredito) || 0,
          tiempo_credito_dias: parseInt(confTiempoCredito, 10) || 7,
          dias_regalo_nuevo: parseInt(confDiasRegalo, 10) || 0,
          horario_nocturno_inicio: confHorarioNocturnoInicio,
          tabulador: tabuladorObj
        })
        .eq('id', fleet.id)

      if (error) throw error
      setConfFeedback('Configuración guardada correctamente.')
      
      // Recargar datos locales del fleet
      const { data: updatedFleet } = await supabase
        .from('delivery_fleets')
        .select('*')
        .eq('id', fleet.id)
        .single()
      if (updatedFleet) setFleet(updatedFleet)
    } catch (err) {
      setConfFeedback('Error al guardar la configuración.')
    } finally {
      setActualizandoConf(false)
    }
  }

  // ── Gestión del Tabulador de Tarifas ──────────────────────────────────────
  const agregarRangoTabulador = () => {
    const ultimoRango = tabuladorRangos[tabuladorRangos.length - 1]
    const desde = ultimoRango ? ultimoRango.hasta : 0
    const hasta = desde + 3
    setTabuladorRangos([...tabuladorRangos, { desde, hasta, precio: 30 }])
  }

  const eliminarRangoTabulador = (index: number) => {
    setTabuladorRangos(tabuladorRangos.filter((_, i) => i !== index))
  }

  const actualizarRangoTabulador = (index: number, campo: 'desde' | 'hasta' | 'precio', valor: number) => {
    const nuevos = [...tabuladorRangos]
    nuevos[index] = { ...nuevos[index], [campo]: valor }
    setTabuladorRangos(nuevos)
  }

  const toggleTarifaLluviaGlobal = async () => {
    if (!fleet?.id) return
    setActualizandoLluvia(true)
    const nuevoEstado = !confTarifaLluviaActiva
    try {
      const { error } = await supabase
        .from('delivery_fleets')
        .update({ tarifa_lluvia_activa: nuevoEstado })
        .eq('id', fleet.id)

      if (error) throw error
      setConfTarifaLluviaActiva(nuevoEstado)
      
      const { data: updatedFleet } = await supabase
        .from('delivery_fleets')
        .select('*')
        .eq('id', fleet.id)
        .single()
      if (updatedFleet) setFleet(updatedFleet)
    } catch (err) {
      console.error('Error al cambiar tarifa lluvia:', err)
    } finally {
      setActualizandoLluvia(false)
    }
  }

  // ── ACCIÓN: Aprobación de Biker y Carga Inicial de Créditos ───────────────
  const abrirAprobacionModal = (b: Biker) => {
    setDiasInicialesCarga(String(fleet?.dias_regalo_nuevo || '0'))
    setBikerAprobacionModal(b)
  }

  const procesarAprobacionBiker = async () => {
    if (!bikerAprobacionModal) return

    const dias = parseInt(diasInicialesCarga, 10) || 0
    const activoHasta = new Date()
    activoHasta.setDate(activoHasta.getDate() + dias)

    try {
      await supabase
        .from('bikers')
        .update({
          estado_aprobacion: 'aprobado',
          activo_hasta: activoHasta.toISOString()
        })
        .eq('id', bikerAprobacionModal.id)

      setBikerAprobacionModal(null)
      await cargarDatos()
    } catch (err) {
      alert('Error al aprobar el repartidor.')
    }
  }

  const rechazarBiker = async (bikerId: string) => {
    if (!confirm('¿Rechazar esta solicitud de ingreso?')) return
    try {
      await supabase
        .from('bikers')
        .update({ estado_aprobacion: 'rechazado' })
        .eq('id', bikerId)
      await cargarDatos()
    } catch (err) {
      alert('Error al rechazar.')
    }
  }

  const actualizarNumeroBiker = async (bikerId: string, numeroBiker: string) => {
    try {
      const { error } = await supabase
        .from('bikers')
        .update({ numero_biker: numeroBiker.trim() || null })
        .eq('id', bikerId)

      if (error) throw error
      await cargarDatos()
    } catch (err) {
      console.error('Error al actualizar número biker:', err)
      alert('Error al actualizar el número Biker.')
    }
  }

  // ── ACCIÓN: Recargar Créditos / Acceso Temporal ───────────────────────────
  const abrirRecargaModal = (b: Biker) => {
    setDiasRecargaCarga(String(fleet?.tiempo_credito_dias || '7'))
    setBikerRecargaModal(b)
  }

  const procesarRecargaBiker = async () => {
    if (!bikerRecargaModal) return

    const diasARecargar = parseInt(diasRecargaCarga, 10) || 7
    let baseDate = new Date()
    
    // Si ya tiene saldo activo vigente, sumamos a partir de su vencimiento
    if (bikerRecargaModal.activo_hasta && new Date(bikerRecargaModal.activo_hasta) > new Date()) {
      baseDate = new Date(bikerRecargaModal.activo_hasta)
    }

    baseDate.setDate(baseDate.getDate() + diasARecargar)

    try {
      await supabase
        .from('bikers')
        .update({ activo_hasta: baseDate.toISOString() })
        .eq('id', bikerRecargaModal.id)

      setBikerRecargaModal(null)
      await cargarDatos()
    } catch (err) {
      alert('Error al recargar créditos.')
    }
  }

  // ── ACCIÓN: Bloquear Acceso (Temporal o Permanente) ───────────────────────
  const aplicarBloqueo = async () => {
    if (!bikerSeleccionadoBloqueo) return

    let bloqueadoHasta: string | null = null
    let permanente = false

    if (bloqueoTiempo === 'indefinido') {
      permanente = true
    } else {
      const horas = parseInt(bloqueoTiempo, 10)
      const fin = new Date()
      fin.setHours(fin.getHours() + horas)
      bloqueadoHasta = fin.toISOString()
    }

    try {
      // Forzar desconexión física de sesión única
      await supabase
        .from('bikers')
        .update({
          bloqueado_hasta: bloqueadoHasta,
          bloqueado_permanente: permanente,
          conectado: false,
          current_session_id: null // Invalida cookie local
        })
        .eq('id', bikerSeleccionadoBloqueo.id)

      setBikerSeleccionadoBloqueo(null)
      await cargarDatos()
    } catch (err) {
      alert('Error al aplicar el bloqueo.')
    }
  }

  const desbloquearBiker = async (bikerId: string) => {
    try {
      await supabase
        .from('bikers')
        .update({
          bloqueado_hasta: null,
          bloqueado_permanente: false
        })
        .eq('id', bikerId)
      await cargarDatos()
    } catch (err) {
      alert('Error al desbloquear.')
    }
  }

  // ── ACCIÓN: Crear Biker Manualmente ───────────────────────────────────────
  const abrirManualBikerModal = () => {
    setManualNombre('')
    setManualTelefono('')
    setManualPin('')
    setManualDiasRegalo(String(fleet?.dias_regalo_nuevo || '0'))
    setManualBikerModalOpen(true)
  }

  const crearBikerManualmente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fleet?.id || creandoManual) return
    if (!manualNombre.trim() || !manualTelefono.trim() || !manualPin.trim()) {
      alert('Por favor completa todos los campos obligatorios.')
      return
    }
    if (!/^\d{4,6}$/.test(manualPin.trim())) {
      alert('El PIN debe tener entre 4 y 6 dígitos numéricos.')
      return
    }

    setCreandoManual(true)
    try {
      const dias = parseInt(manualDiasRegalo, 10) || 0
      const activoHasta = new Date()
      activoHasta.setDate(activoHasta.getDate() + dias)

      const { error } = await supabase
        .from('bikers')
        .insert({
          fleet_id: fleet.id,
          nombre: manualNombre.trim(),
          telefono: manualTelefono.trim(),
          pin: manualPin.trim(),
          estado_aprobacion: 'aprobado',
          activo: true,
          activo_hasta: activoHasta.toISOString(),
          conectado: false
        })

      if (error) throw error

      setManualBikerModalOpen(false)
      alert('✅ Repartidor agregado y aprobado exitosamente.')
      await cargarDatos()
    } catch (err: any) {
      console.error(err)
      alert('Error al agregar repartidor: ' + err.message)
    } finally {
      setCreandoManual(false)
    }
  }

  // ── ACCIÓN: Asignación Híbrida/Manual de Solicitudes ──────────────────────
  const aceptarPeticionFlota = async (requestId: string, tiempoMinutos: number) => {
    try {
      await supabase
        .from('delivery_requests')
        .update({
          estado: 'aceptado_flota',
          aceptado_flota_at: new Date().toISOString(),
          tiempo_estimado_entrega: tiempoMinutos
        })
        .eq('id', requestId)
      await cargarDatos()
    } catch (err) {
      alert('Error al aceptar petición.')
    }
  }

  const rechazarPeticionFlota = async (requestId: string) => {
    try {
      await supabase
        .from('delivery_requests')
        .update({
          estado: 'cancelado_restaurante',
          cancelado_at: new Date().toISOString(),
          motivo_cancelacion: 'Rechazado por el Modulador'
        })
        .eq('id', requestId)
      await cargarDatos()
    } catch (err) {
      alert('Error al rechazar petición.')
    }
  }

  const asignarBikerManualmente = async (requestId: string, bikerId: string) => {
    if (!bikerId) return
    try {
      await supabase
        .from('delivery_requests')
        .update({
          biker_id: bikerId,
          estado: 'aceptado',
          aceptado_at: new Date().toISOString()
        })
        .eq('id', requestId)
      await cargarDatos()
    } catch (err) {
      alert('Error al asignar repartidor.')
    }
  }

  // ── LEAFLET GPS BROADCAST MAP ──────────────────────────────────────────────
  useEffect(() => {
    if (pestana !== 'mapa' || !fleet?.id) {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      return
    }

    // Cargar Leaflet dinámicamente
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => {
      const L = (window as any).L
      if (!L) return

      const container = document.getElementById('mapa-modulador-view')
      if (!container) return

      if (mapRef.current) mapRef.current.remove()

      // Centro por defecto: Uruapan/centro o latitud/longitud
      const map = L.map('mapa-modulador-view').setView([19.421583, -102.067222], 13)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; Colaboradores de OpenStreetMap'
      }).addTo(map)

      mapRef.current = map

      // Suscripción Broadcast del canal de tracking
      const markers = markersRef.current
      const trackingChannel = supabase
        .channel(`fleet:${fleet.id}:bikers`)
        .on('broadcast', { event: 'biker_location' }, (payload) => {
          const { biker_id, lat, lng, accuracy, ts } = payload.payload
          const bikerObj = bikers.find(b => b.id === biker_id)
          if (!bikerObj || !lat || !lng) return

          // Agregar a historial rápido de pings
          setPingHistory(prev => {
            const entry = {
              biker: bikerObj.nombre,
              time: new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              lat: lat.toFixed(5),
              lng: lng.toFixed(5),
            }
            return [entry, ...prev.slice(0, 19)]
          })

          if (markers[biker_id]) {
            markers[biker_id].setLatLng([lat, lng])
          } else {
            const bikerMarker = L.marker([lat, lng], {
              icon: L.divIcon({
                className: 'custom-biker-icon',
                html: `
                  <div class="flex flex-col items-center">
                    <div class="bg-[#2563eb] text-white font-bold text-[9px] px-2 py-0.5 rounded-full border border-white shadow-md whitespace-nowrap">
                      🏍️ ${bikerObj.nombre}
                    </div>
                    <div class="w-3.5 h-3.5 bg-[#2563eb] border-2 border-white rounded-full -mt-0.5 shadow-sm"></div>
                  </div>
                `,
                iconSize: [80, 40],
                iconAnchor: [40, 35],
              })
            }).addTo(map)
            markers[biker_id] = bikerMarker
          }
        })
        .subscribe()

      // Limpiar canal
      return () => {
        trackingChannel.unsubscribe()
      }
    }
    document.head.appendChild(script)

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [pestana, fleet, bikers])

  // ── FILTRADO DE SERVICIOS POR FECHA (KPIs) ──────────────────────────────────
  const requestsFiltrados = requests.filter(req => {
    const created = new Date(req.created_at)
    const ahora = new Date()

    if (filtroFecha === 'hoy') {
      return created.toDateString() === ahora.toDateString()
    } else if (filtroFecha === 'semana') {
      const unaSemana = 7 * 24 * 60 * 60 * 1000
      return ahora.getTime() - created.getTime() < unaSemana
    } else if (filtroFecha === 'mes') {
      return created.getMonth() === ahora.getMonth() && created.getFullYear() === ahora.getFullYear()
    }
    return true
  })

  // KPIs
  const metrics = {
    totalCompletados: requestsFiltrados.filter(r => r.estado === 'completado').length,
    totalPendientes: requestsFiltrados.filter(r => ['pendiente', 'aceptado_flota', 'aceptado', 'en_camino'].includes(r.estado)).length,
    totalCancelados: requestsFiltrados.filter(r => ['cancelado_biker', 'cancelado_restaurante'].includes(r.estado)).length,
    revenueBruto: requestsFiltrados
      .filter(r => r.estado === 'completado')
      .reduce((sum, r) => sum + Number(r.total_cobrado || 0), 0),
  }

  // Tiempos promedio
  const auditoriaTiempos = () => {
    let sumaRespuesta = 0 
    let sumaEntrega = 0 
    let countRespuesta = 0
    let countEntrega = 0

    requestsFiltrados.forEach(req => {
      if (req.aceptado_flota_at) {
        const diff = (new Date(req.aceptado_flota_at).getTime() - new Date(req.created_at).getTime()) / 60000
        if (diff > 0) {
          sumaRespuesta += diff
          countRespuesta++
        }
      }
      if (req.aceptado_at && req.entregado_at) {
        const diff = (new Date(req.entregado_at).getTime() - new Date(req.aceptado_at).getTime()) / 60000
        if (diff > 0) {
          sumaEntrega += diff
          countEntrega++
        }
      }
    })

    return {
      promedioRespuesta: countRespuesta > 0 ? (sumaRespuesta / countRespuesta).toFixed(1) : '0',
      promedioEntrega: countEntrega > 0 ? (sumaEntrega / countEntrega).toFixed(1) : '0',
    }
  }
  const tiempos = auditoriaTiempos()

  // Ranking
  const rankingBikers = () => {
    const conteo: Record<string, { nombre: string; viajes: number }> = {}
    requestsFiltrados.forEach(req => {
      if (req.estado === 'completado' && req.biker_id && req.bikers) {
        const bName = req.bikers.nombre
        if (!conteo[req.biker_id]) {
          conteo[req.biker_id] = { nombre: bName, viajes: 0 }
        }
        conteo[req.biker_id].viajes++
      }
    })
    return Object.values(conteo).sort((a, b) => b.viajes - a.viajes)
  }
  const ranking = rankingBikers()

  const listBikersAprobados = bikers.filter(b => b.estado_aprobacion === 'aprobado')
  const listBikersPendientes = bikers.filter(b => b.estado_aprobacion === 'pendiente')

  const pendingReqs = requests.filter(r => r.estado === 'pendiente')
  const activeReqs = requests.filter(r => r.estado === 'aceptado_flota' || r.estado === 'aceptado' || r.estado === 'en_camino')
  const historyReqs = requests.filter(r => r.estado === 'completado' || r.estado === 'cancelado_biker' || r.estado === 'cancelado_restaurante')

  // ── NOTIFICACIONES EN TIEMPO REAL (CHIME & TITULO PARPADEANTE) ─────────────
  const prevPendingCountRef = useRef(0)

  // Solicitar permiso de notificaciones de navegador en el montaje
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Reproducir sonido cuando entra una nueva petición pendiente
  useEffect(() => {
    if (pendingReqs.length > prevPendingCountRef.current) {
      // Play synthesized chime
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
        
        // Primer bip
        const osc1 = audioCtx.createOscillator()
        const gain1 = audioCtx.createGain()
        osc1.connect(gain1)
        gain1.connect(audioCtx.destination)
        osc1.type = 'sine'
        osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime) // D5
        gain1.gain.setValueAtTime(0.15, audioCtx.currentTime)
        gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15)
        osc1.start(audioCtx.currentTime)
        osc1.stop(audioCtx.currentTime + 0.15)

        // Segundo bip (un poco más alto, ligeramente retrasado)
        const osc2 = audioCtx.createOscillator()
        const gain2 = audioCtx.createGain()
        osc2.connect(gain2)
        gain2.connect(audioCtx.destination)
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.12) // A5
        gain2.gain.setValueAtTime(0.15, audioCtx.currentTime + 0.12)
        gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3)
        osc2.start(audioCtx.currentTime + 0.12)
        osc2.stop(audioCtx.currentTime + 0.3)
      } catch (err) {
        console.warn('Play chime failed:', err)
      }

      // Enviar notificación nativa
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('🔔 Solicitud de Moto', {
          body: `Se ha recibido una nueva solicitud de entrega de moto de un negocio.`,
          icon: '/favicon.ico'
        })
      }
    }
    prevPendingCountRef.current = pendingReqs.length
  }, [pendingReqs.length])

  // Parpadeo del título del navegador cuando hay peticiones pendientes
  useEffect(() => {
    if (pendingReqs.length === 0) {
      document.title = 'Modulador - Live Dispatch'
      return
    }

    const originalTitle = 'Modulador - Live Dispatch'
    const flashTitle = `🚨 (${pendingReqs.length}) ¡Nueva Petición!`
    let isOriginal = false

    const timer = setInterval(() => {
      document.title = isOriginal ? originalTitle : flashTitle
      isOriginal = !isOriginal
    }, 1000)

    return () => {
      clearInterval(timer)
      document.title = originalTitle
    }
  }, [pendingReqs.length])

  // ── RENDER CARGA INICIAL ───────────────────────────────────────────────────
  if (cargandoAuth) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#2563eb] animate-spin" />
      </div>
    )
  }

  // ── RENDER: LOGIN FORM ─────────────────────────────────────────────────────
  if (!session) {
    return (
      <main className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-full max-w-[400px] space-y-6 animate-fadeIn">
          {/* Logo */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto shadow-[0_4px_16px_rgba(37,99,235,0.15)] rounded-2xl overflow-hidden bg-white flex items-center justify-center border border-[#e4e4e7]">
              <img src="/bikers.png" alt="Bikers Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#09090b] tracking-tight uppercase">Portal Bikers</h1>
              <p className="text-sm text-[#71717a] mt-1">Control de Flota y Logística de Reparto</p>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-[0_2px_20px_rgba(0,0,0,0.06)] border border-[#f0f0f0] p-8 space-y-5">
            <form onSubmit={iniciarSesion} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">
                  Email de Administrador de Flota
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  className="w-full bg-[#fafafa] border-[1.5px] border-[#e4e4e7] rounded-xl px-4 py-3 text-[15px] text-[#09090b] placeholder-[#a1a1aa] focus:outline-none focus:border-[#2563eb] focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] transition-all"
                  placeholder="admin@flota.com"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">
                  Contraseña / PIN
                </label>
                <input
                  type="password"
                  value={loginPin}
                  onChange={e => setLoginPin(e.target.value)}
                  className="w-full bg-[#fafafa] border-[1.5px] border-[#e4e4e7] rounded-xl px-4 py-3 text-[15px] text-[#09090b] placeholder-[#a1a1aa] focus:outline-none focus:border-[#2563eb] focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>

              {loginError && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-600 text-center font-medium">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={iniciando}
                className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-sm rounded-xl py-3.5 transition-all shadow-[0_1px_3px_rgba(37,99,235,0.3)] hover:shadow-[0_4px_20px_rgba(37,99,235,0.35)] hover:-translate-y-px active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {iniciando ? (
                  <><Loader2 size={16} className="animate-spin" /> Verificando...</>
                ) : 'Ingresar al Tablero'}
              </button>
            </form>
          </div>
        </div>
      </main>
    )
  }

  // ── RENDER TABLERO MODULADOR (4 PESTAÑAS) ──────────────────────────────────
  return (
    <main className="min-h-screen bg-[#fafafa] font-sans flex flex-col md:flex-row">
      
      {/* Sidebar para PC (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-[#e4e4e7] shrink-0 sticky top-0 h-screen">
        <div className="p-6 border-b border-[#e4e4e7] flex items-center gap-3">
          <div className="w-10 h-10 shadow-xs rounded-xl overflow-hidden bg-white flex items-center justify-center border border-[#e4e4e7] shrink-0">
            <img src="/bikers.png" alt="Bikers Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-[10px] text-[#2563eb] font-black uppercase tracking-wider truncate max-w-[140px]">
              PORTAL BIKERS
            </p>
            <h1 className="text-sm font-bold text-[#09090b]">Modulador Central</h1>
          </div>
        </div>

        <nav className="p-4 flex-1 space-y-1.5">
          <button
            onClick={() => setPestana('servicios')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
              pestana === 'servicios'
                ? 'bg-blue-50 text-[#2563eb]'
                : 'text-[#71717a] hover:text-[#09090b] hover:bg-[#fafafa]'
            }`}
          >
            <FileText className="w-4 h-4" />
            Bandeja Operativa
          </button>

          <button
            onClick={() => setPestana('metricas')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
              pestana === 'metricas'
                ? 'bg-blue-50 text-[#2563eb]'
                : 'text-[#71717a] hover:text-[#09090b] hover:bg-[#fafafa]'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Métricas / KPIs
          </button>
          
          <button
            onClick={() => setPestana('usuarios')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all relative ${
              pestana === 'usuarios'
                ? 'bg-blue-50 text-[#2563eb]'
                : 'text-[#71717a] hover:text-[#09090b] hover:bg-[#fafafa]'
            }`}
          >
            <Users className="w-4 h-4" />
            Usuarios / Créditos
            {listBikersPendientes.length > 0 && (
              <span className="ml-auto bg-[#2563eb] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                {listBikersPendientes.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setPestana('mapa')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
              pestana === 'mapa'
                ? 'bg-blue-50 text-[#2563eb]'
                : 'text-[#71717a] hover:text-[#09090b] hover:bg-[#fafafa]'
            }`}
          >
            <MapPin className="w-4 h-4" />
            Repartidores (Mapa)
          </button>

          <button
            onClick={() => setPestana('configuracion')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
              pestana === 'configuracion'
                ? 'bg-blue-50 text-[#2563eb]'
                : 'text-[#71717a] hover:text-[#09090b] hover:bg-[#fafafa]'
            }`}
          >
            <Settings className="w-4 h-4" />
            Configuración
          </button>
        </nav>

        <div className="p-4 border-t border-[#e4e4e7] space-y-3">
          <div className="text-[10px] text-[#71717a] font-medium truncate">
            Modulador: <strong>{session.user}</strong>
          </div>
          <button
            onClick={cerrarSesion}
            className="w-full flex items-center justify-center gap-2 text-xs font-bold text-red-600 hover:bg-red-50 border border-red-100 rounded-xl py-2.5 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Panel Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6">
        
        {/* Header móvil */}
        <header className="md:hidden bg-white border-b border-[#e4e4e7] px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg overflow-hidden bg-white border border-[#e4e4e7] flex items-center justify-center shrink-0">
              <img src="/bikers.png" alt="Bikers Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-sm font-bold text-[#09090b]">Portal Bikers</h1>
          </div>
          <button onClick={cerrarSesion} className="text-red-600">
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        {/* Dynamic Inner views container */}
        <div className="p-6 space-y-6">
          
          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* PESTAÑA: SERVICIOS DISPATCH & KPIs                                */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* PESTAÑA: MÉTRICAS / KPIs                                          */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {pestana === 'metricas' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* KPIs Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e4e4e7] pb-4">
                <div>
                  <h2 className="text-base font-bold text-[#09090b] flex items-center gap-2">
                    <TrendingUp className="w-4.5 h-4.5 text-[#2563eb]" />
                    Métricas del Tablero
                  </h2>
                  <p className="text-xs text-[#71717a] mt-0.5">Volumen y rendimiento financiero acumulado.</p>
                </div>
                <div className="flex bg-[#fafafa] border border-[#e4e4e7] rounded-xl p-1 gap-1 self-start">
                  {(['hoy', 'semana', 'mes'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFiltroFecha(f)}
                      className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                        filtroFecha === f ? 'bg-[#2563eb] text-white shadow-sm' : 'text-[#71717a] hover:text-[#09090b]'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid 4 KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card-clean bg-white p-5 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#2563eb] flex items-center justify-center shrink-0">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wide">Completados</p>
                    <p className="text-lg font-bold text-[#09090b]">{metrics.totalCompletados}</p>
                  </div>
                </div>

                <div className="card-clean bg-white p-5 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wide">Pendientes / Ruta</p>
                    <p className="text-lg font-bold text-[#09090b]">{metrics.totalPendientes}</p>
                  </div>
                </div>

                <div className="card-clean bg-white p-5 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                    <X className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wide">Cancelados</p>
                    <p className="text-lg font-bold text-[#09090b]">{metrics.totalCancelados}</p>
                  </div>
                </div>

                <div className="card-clean bg-white p-5 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wide">Cobrado Neto</p>
                    <p className="text-lg font-bold text-green-600 font-mono">${metrics.revenueBruto.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Tiempos de Auditoría & Ranking */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Auditoría */}
                <div className="card-clean bg-white p-5 space-y-4">
                  <h3 className="text-xs font-bold text-[#09090b] flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#a1a1aa]" />
                    Auditoría de Respuesta de Tiempos
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#fafafa] p-3.5 rounded-xl border border-[#e4e4e7] text-center">
                      <p className="text-[9px] font-bold text-[#52525b] uppercase tracking-wider">Modulador Flota</p>
                      <p className="text-xl font-bold text-[#09090b] mt-1 font-mono">{tiempos.promedioRespuesta}m</p>
                      <p className="text-[8px] text-[#a1a1aa] mt-0.5">Solicitado → Aceptado Flota</p>
                    </div>
                    <div className="bg-[#fafafa] p-3.5 rounded-xl border border-[#e4e4e7] text-center">
                      <p className="text-[9px] font-bold text-[#52525b] uppercase tracking-wider">Biker Entrega</p>
                      <p className="text-xl font-bold text-[#09090b] mt-1 font-mono">{tiempos.promedioEntrega}m</p>
                      <p className="text-[8px] text-[#a1a1aa] mt-0.5">Asignado → Completado</p>
                    </div>
                  </div>
                </div>

                {/* Ranking */}
                <div className="card-clean bg-white p-5 space-y-4">
                  <h3 className="text-xs font-bold text-[#09090b] flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-[#a1a1aa]" />
                    Ranking de Repartidores (Servicios del Periodo)
                  </h3>
                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                    {ranking.length === 0 ? (
                      <p className="text-xs text-[#a1a1aa] text-center py-4">Sin entregas completadas en este período.</p>
                    ) : (
                      ranking.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-[#fafafa] border border-[#e4e4e7] rounded-lg text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#2563eb]">#{idx + 1}</span>
                            <span className="font-semibold text-[#09090b]">{item.nombre}</span>
                          </div>
                          <span className="bg-blue-50 text-[#2563eb] text-[9px] font-bold px-2 py-0.5 rounded-full border border-blue-100">
                            {item.viajes} completados
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* PESTAÑA: BANDEJA OPERATIVA (LIVE DISPATCH)                        */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {pestana === 'servicios' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Listado de Solicitudes Dispatch */}
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#e4e4e7] pb-3.5 gap-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-[#09090b]">Bandeja Operativa (Live Dispatch)</h3>
                    <span className="bg-blue-50 text-[#2563eb] text-[10px] font-black px-2.5 py-1 rounded-full border border-blue-100 uppercase tracking-wider">
                      {requests.length} Totales
                    </span>
                  </div>

                  {/* Interruptor de Recargo de Lluvia Global */}
                  <div className="flex items-center gap-2.5 bg-[#fef2f2] border border-red-100 rounded-xl px-3 py-1.5 shadow-xs">
                    <span className="text-[10px] font-black text-[#dc2626] tracking-wider">🌧️ RECARGO LLUVIA</span>
                    <button
                      type="button"
                      onClick={toggleTarifaLluviaGlobal}
                      disabled={actualizandoLluvia}
                      className={`w-10 h-6 rounded-full transition-all duration-300 relative focus:outline-none ${
                        confTarifaLluviaActiva ? 'bg-red-500' : 'bg-zinc-300'
                      }`}
                      aria-label="Toggle global rain fee"
                    >
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${
                        confTarifaLluviaActiva ? 'left-4.5' : 'left-0.5'
                      }`} />
                    </button>
                  </div>
                </div>

                {requests.length === 0 ? (
                  <div className="card-clean bg-white p-12 text-center text-xs text-[#a1a1aa] border border-[#e4e4e7]">
                    Sin solicitudes en el sistema de reparto.
                  </div>
                ) : (
                  <div className="space-y-8">
                    
                    {/* 1. SECCIÓN: NUEVOS SERVICIOS PENDIENTES */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
                        <h4 className="text-xs font-bold text-[#52525b] uppercase tracking-wider">
                          Nuevas Solicitudes por Aceptar ({pendingReqs.length})
                        </h4>
                      </div>

                      {pendingReqs.length === 0 ? (
                        <div className="card-clean bg-white p-6 text-center text-xs text-[#a1a1aa] border border-[#e4e4e7] border-dashed">
                          ☕ Todo al día. No hay nuevas solicitudes pendientes por aceptar.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {pendingReqs.map(req => {
                            const t = tiemposEstimados[req.id] || 15
                            return (
                              <div key={req.id} className="relative overflow-hidden bg-white border border-[#e4e4e7] hover:border-blue-300 rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-all hover:shadow-[0_4px_16px_rgba(37,99,235,0.08)] flex flex-col md:flex-row md:items-center justify-between gap-5">
                                {/* Visual Accent Line */}
                                <div className="absolute top-0 bottom-0 left-0 w-1 bg-[#2563eb]" />
                                
                                {/* Logo & Restaurant Info */}
                                <div className="flex items-center gap-4 pl-1">
                                  <div className="w-14 h-14 rounded-xl border border-[#e4e4e7] overflow-hidden bg-[#fafafa] flex items-center justify-center shrink-0 shadow-xs">
                                    {req.businesses?.logo_url ? (
                                      <img src={req.businesses.logo_url} alt={req.businesses.nombre} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-sm font-bold text-[#2563eb]">{req.businesses?.nombre?.slice(0, 2).toUpperCase()}</span>
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-[#09090b]">
                                        {req.businesses?.nombre || 'Negocio'}
                                      </span>
                                      <span className="bg-blue-50 text-[#2563eb] text-[9px] font-black px-2 py-0.5 rounded-md border border-blue-100 uppercase tracking-widest font-mono">
                                        #{req.id.slice(-4).toUpperCase()}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-[#a1a1aa] font-semibold mt-0.5">
                                      Solicitado a las {new Date(req.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                    {req.descripcion && (
                                      <p className="text-xs text-[#52525b] mt-1.5 font-medium flex items-center gap-1">
                                        📦 <span className="italic">"{req.descripcion}"</span>
                                      </p>
                                    )}
                                    {req.referencia && (
                                      <p className="text-xs text-[#52525b] mt-1 font-bold flex items-center gap-1">
                                        📌 <span className="text-[#a1a1aa] font-normal">Ref:</span> {req.referencia}
                                      </p>
                                    )}
                                    {(req.nombre_cliente || req.telefono_cliente) && (
                                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[#52525b] font-bold bg-[#fafafa] border border-[#e4e4e7] px-2.5 py-1 rounded-xl w-fit">
                                        {req.nombre_cliente && (
                                          <span className="flex items-center gap-1">
                                            👤 {req.nombre_cliente}
                                          </span>
                                        )}
                                        {req.nombre_cliente && req.telefono_cliente && <span className="text-[#d4d4d8]">|</span>}
                                        {req.telefono_cliente && (
                                          <a
                                            href={`tel:${req.telefono_cliente}`}
                                            className="flex items-center gap-1 text-[#2563eb] hover:underline"
                                          >
                                            📞 {req.telefono_cliente}
                                          </a>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Address / Location Details */}
                                <div className="flex-1 min-w-0 md:border-l md:border-r border-[#e4e4e7] px-0 md:px-5 space-y-2.5">
                                  <div className="flex items-start gap-1.5 text-xs text-[#52525b]">
                                    <MapPin className="w-4 h-4 text-[#2563eb] shrink-0 mt-0.5 animate-pulse" />
                                    <div className="min-w-0">
                                      <p className="font-bold text-[#09090b]">Dirección de Entrega</p>
                                      <p className="text-[11px] text-[#71717a] mt-0.5 truncate" title={req.direccion_entrega}>
                                        {req.direccion_entrega}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Distance & Price breakdown */}
                                  <div className="flex items-center gap-2.5 text-[10px] font-bold pl-5.5 text-[#52525b]">
                                    {req.distancia_km !== undefined && req.distancia_km !== null && (
                                      <span className="bg-[#fafafa] border border-[#e4e4e7] px-2 py-0.5 rounded-lg text-[#71717a] font-mono">
                                        📍 {Number(req.distancia_km).toFixed(1)} km
                                      </span>
                                    )}
                                    {req.total_cobrado !== undefined && req.total_cobrado !== null && (
                                      <span className="bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-lg font-mono">
                                        💵 ${Number(req.total_cobrado).toFixed(2)}
                                        {req.tarifa_extra && req.tarifa_extra > 0 ? (
                                          <span className="text-[8px] font-normal text-green-600 pl-1">
                                            (${Number(req.tarifa_base).toFixed(0)} + ${Number(req.tarifa_extra).toFixed(0)} recargos)
                                          </span>
                                        ) : null}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Stepper & Accept/Reject actions */}
                                <div className="flex flex-wrap items-center gap-4 shrink-0 justify-end">
                                  {/* Stepper control */}
                                  <div className="flex items-center bg-[#fafafa] border border-[#e4e4e7] rounded-xl p-1 gap-1">
                                    <button
                                      onClick={() => setTiemposEstimados({ ...tiemposEstimados, [req.id]: Math.max(5, t - 5) })}
                                      disabled={t <= 5}
                                      className="w-8 h-8 rounded-lg bg-white border border-[#e4e4e7] text-[#09090b] font-bold text-xs flex items-center justify-center hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                                      title="Restar 5 minutos"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    
                                    <span className="w-16 text-center text-xs font-bold text-[#09090b] font-mono select-none">
                                      {t} min
                                    </span>

                                    <button
                                      onClick={() => setTiemposEstimados({ ...tiemposEstimados, [req.id]: Math.min(90, t + 5) })}
                                      disabled={t >= 90}
                                      className="w-8 h-8 rounded-lg bg-white border border-[#e4e4e7] text-[#09090b] font-bold text-xs flex items-center justify-center hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                                      title="Sumar 5 minutos"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => rechazarPeticionFlota(req.id)}
                                      className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-[10px] uppercase tracking-wider px-3.5 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                      Rechazar
                                    </button>

                                    <button
                                      onClick={() => aceptarPeticionFlota(req.id, t)}
                                      className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-[10px] uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      Aceptar
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* 2. SECCIÓN: SERVICIOS EN TRÁNSITO / ACTIVOS */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-[#52525b] uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                        Servicios en Tránsito ({activeReqs.length})
                      </h4>

                      {activeReqs.length === 0 ? (
                        <div className="card-clean bg-white p-6 text-center text-xs text-[#a1a1aa] border border-[#e4e4e7]">
                          No hay entregas activas en curso en este momento.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {activeReqs.map(req => {
                            const estaAceptadoFlota = req.estado === 'aceptado_flota'
                            return (
                              <div key={req.id} className="card-clean bg-white p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#e4e4e7] shadow-xs">
                                <div className="space-y-1.5 flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className="w-8 h-8 rounded-lg border border-[#e4e4e7] overflow-hidden bg-[#fafafa] flex items-center justify-center shrink-0">
                                      {req.businesses?.logo_url ? (
                                        <img src={req.businesses.logo_url} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-[10px] font-bold text-[#2563eb]">{req.businesses?.nombre?.slice(0, 2).toUpperCase()}</span>
                                      )}
                                    </div>
                                    <span className="text-xs font-bold text-[#09090b]">
                                      {req.businesses?.nombre || 'Negocio'}
                                    </span>
                                    <span className="text-[9px] text-[#a1a1aa] font-mono">
                                      #{req.id.slice(-4).toUpperCase()} · {new Date(req.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    
                                    <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                      estaAceptadoFlota ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                      req.estado === 'aceptado' ? 'bg-blue-50 text-[#2563eb] border-blue-200' :
                                      req.estado === 'en_camino' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                      'bg-zinc-50 text-zinc-500 border-zinc-200'
                                    }`}>
                                      {estaAceptadoFlota ? 'Aceptado (Flota)' : req.estado === 'aceptado' ? 'Asignado a Biker' : req.estado === 'en_camino' ? 'En Camino' : req.estado}
                                    </span>

                                    {req.tiempo_estimado_entrega && (
                                      <span className="bg-[#fafafa] text-[#52525b] border border-[#e4e4e7] text-[8px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                                        ⏱️ {req.tiempo_estimado_entrega} min
                                      </span>
                                    )}
                                  </div>

                                  <p className="text-xs text-[#52525b] truncate flex items-center gap-1">
                                    <MapPin className="w-3.5 h-3.5 text-[#2563eb] shrink-0" />
                                    <strong>Destino:</strong> {req.direccion_entrega}
                                  </p>
                                  {req.descripcion && (
                                    <p className="text-xs text-[#71717a] pl-10 italic">
                                      "{req.descripcion}"
                                    </p>
                                  )}
                                  {req.referencia && (
                                    <p className="text-xs text-[#52525b] pl-10 font-bold flex items-center gap-1">
                                      📌 <span className="text-[#a1a1aa] font-normal">Ref:</span> {req.referencia}
                                    </p>
                                  )}

                                  {(req.nombre_cliente || req.telefono_cliente) && (
                                    <div className="text-[10px] text-[#52525b] font-bold pl-10 flex flex-wrap gap-2 items-center">
                                      {req.nombre_cliente && (
                                        <span className="flex items-center gap-1">
                                          👤 {req.nombre_cliente}
                                        </span>
                                      )}
                                      {req.nombre_cliente && req.telefono_cliente && <span className="text-[#d4d4d8]">|</span>}
                                      {req.telefono_cliente && (
                                        <a
                                          href={`tel:${req.telefono_cliente}`}
                                          className="flex items-center gap-1 text-[#2563eb] hover:underline"
                                        >
                                          📞 {req.telefono_cliente}
                                        </a>
                                      )}
                                    </div>
                                  )}

                                  {/* Distance and Price */}
                                  <div className="text-[10px] text-[#52525b] font-bold pl-10 flex flex-wrap gap-2 items-center">
                                    {req.distancia_km !== undefined && req.distancia_km !== null && (
                                      <span className="bg-[#fafafa] border border-[#e4e4e7] px-1.5 py-0.5 rounded font-mono text-[#71717a]">
                                        📍 {Number(req.distancia_km).toFixed(1)} km
                                      </span>
                                    )}
                                    {req.total_cobrado !== undefined && req.total_cobrado !== null && (
                                      <span className="bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded font-mono">
                                        💵 ${Number(req.total_cobrado).toFixed(2)}
                                        {req.tarifa_extra && req.tarifa_extra > 0 ? (
                                          <span className="text-[8px] font-normal text-green-600 pl-1">
                                            (${Number(req.tarifa_base).toFixed(0)} + ${Number(req.tarifa_extra).toFixed(0)} recargos)
                                          </span>
                                        ) : null}
                                      </span>
                                    )}
                                  </div>

                                  {req.bikers?.nombre ? (
                                    <p className="text-[10px] text-[#52525b] font-bold pl-10">
                                      🏍️ Repartidor: <span className="text-[#2563eb]">{req.bikers.nombre}</span>
                                    </p>
                                  ) : (
                                    <p className="text-[10px] text-amber-600 font-bold pl-10">
                                      ⚠️ Pendiente de despacho de repartidor
                                    </p>
                                  )}
                                </div>

                                {/* Acciones de Despacho */}
                                <div className="flex flex-wrap items-center gap-3 shrink-0">
                                  {estaAceptadoFlota && (
                                    <div className="flex items-center gap-1.5 border border-[#e4e4e7] bg-[#fafafa] rounded-xl px-2 py-1 relative">
                                      <Truck className="w-3 h-3 text-[#71717a]" />
                                      <select
                                        onChange={e => asignarBikerManualmente(req.id, e.target.value)}
                                        defaultValue=""
                                        className="bg-transparent text-xs text-[#09090b] font-semibold py-1 pr-6 focus:outline-none cursor-pointer"
                                      >
                                        <option value="" disabled>Despachar Biker...</option>
                                        {listBikersAprobados.map(b => (
                                          <option key={b.id} value={b.id}>
                                            {b.nombre} {b.conectado ? '🟢' : '⚪'}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}

                                  {!estaAceptadoFlota && (
                                    <span className="text-[9px] text-[#a1a1aa] font-bold bg-[#fafafa] px-3 py-1.5 rounded-xl border border-[#e4e4e7] uppercase tracking-wider">
                                      En Tránsito
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* 3. SECCIÓN: HISTORIAL DE SERVICIOS (ÚLTIMOS 10) */}
                    <div className="space-y-3 border-t border-[#e4e4e7] pt-6">
                      <h4 className="text-xs font-bold text-[#a1a1aa] uppercase tracking-wider">
                        Historial de Servicios Recientes
                      </h4>

                      {historyReqs.length === 0 ? (
                        <div className="text-center py-4 text-xs text-[#a1a1aa]">
                          No hay historial de servicios en este período.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                          {historyReqs.slice(0, 10).map(req => {
                            const esCompletado = req.estado === 'completado'
                            return (
                              <div key={req.id} className="bg-[#fafafa] border border-[#e4e4e7] rounded-xl p-3 flex items-center justify-between text-xs transition-colors hover:bg-zinc-50">
                                <div className="space-y-0.5 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-[#09090b]">{req.businesses?.nombre || 'Negocio'}</span>
                                    <span className="text-[9px] text-[#a1a1aa] font-mono">#{req.id.slice(-4).toUpperCase()}</span>
                                    <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
                                      esCompletado ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                                    }`}>
                                      {req.estado}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-[#71717a] truncate">
                                    {req.direccion_entrega}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-[10px] font-mono text-[#09090b]">
                                    {new Date(req.created_at).toLocaleDateString('es-MX')}
                                  </p>
                                  {req.total_cobrado && (
                                    <p className="text-[10px] font-bold text-green-600 font-mono">
                                      ${Number(req.total_cobrado).toFixed(2)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>

            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* PESTAÑA: USUARIOS / CRÉDITOS Y ADMISIÓN                          */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {pestana === 'usuarios' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* 1. Solicitudes de Ingreso */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#09090b] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#2563eb]" />
                  Aspirantes a Ingresar ({listBikersPendientes.length})
                </h3>

                {listBikersPendientes.length === 0 ? (
                  <div className="card-clean bg-white p-6 text-center text-xs text-[#a1a1aa] border border-[#e4e4e7]">
                    Sin solicitudes de admisión pendientes.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {listBikersPendientes.map(b => (
                      <div key={b.id} className="card-clean bg-white p-4 flex items-center justify-between gap-4 border border-[#e4e4e7] shadow-xs">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-blue-50 text-[#2563eb] rounded-xl flex items-center justify-center font-bold text-sm shrink-0">
                            {b.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#09090b]">{b.nombre}</p>
                            <p className="text-[10px] text-[#71717a] font-mono">{b.telefono || 'Sin teléfono'}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[9px] text-[#71717a] uppercase font-bold tracking-wider">Número Biker:</span>
                              <input
                                type="text"
                                defaultValue={b.numero_biker || ''}
                                placeholder="Sin asignar"
                                onBlur={async (e) => {
                                  const newVal = e.target.value.trim()
                                  if (newVal !== (b.numero_biker || '')) {
                                    await actualizarNumeroBiker(b.id, newVal)
                                  }
                                }}
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter') {
                                    const target = e.target as HTMLInputElement
                                    target.blur()
                                  }
                                }}
                                className="bg-[#fafafa] border border-[#e4e4e7] rounded-lg px-2 py-0.5 text-[10px] text-[#09090b] font-mono focus:outline-none focus:border-[#2563eb] w-24"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => abrirAprobacionModal(b)}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] uppercase tracking-wider px-3.5 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-1"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Aprobar
                          </button>
                          <button
                            onClick={() => rechazarBiker(b.id)}
                            className="bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 font-bold text-[10px] uppercase tracking-wider px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            Rechazar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Repartidores Aprobados con Crédito y Bloqueos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#09090b]">Repartidores de la Flota ({listBikersAprobados.length})</h3>
                  <button
                    onClick={abrirManualBikerModal}
                    className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Agregar Repartidor</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {listBikersAprobados.map(b => {
                    const esTemporal = b.bloqueado_hasta && new Date(b.bloqueado_hasta) > new Date()
                    const esPermanente = b.bloqueado_permanente
                    const estaBloqueado = esTemporal || esPermanente

                    const vencido = b.activo_hasta && new Date(b.activo_hasta) < new Date()
                    const fechaFormat = b.activo_hasta
                      ? new Date(b.activo_hasta).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : 'Sin límite'

                    return (
                      <div key={b.id} className="card-clean bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-[#e4e4e7] shadow-xs">
                        
                        <div className="flex items-center gap-3">
                          {b.foto_url ? (
                            <img src={b.foto_url} alt="" className="w-10 h-10 rounded-xl object-cover border shrink-0" />
                          ) : (
                            <div className="w-10 h-10 bg-blue-50 text-[#2563eb] rounded-xl flex items-center justify-center font-bold text-base shrink-0">
                              {b.nombre.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-[#09090b]">{b.nombre}</p>
                              <span className={`w-2 h-2 rounded-full ${b.conectado ? 'bg-green-500 animate-pulse' : 'bg-zinc-300'}`} />
                            </div>
                            <p className="text-[10px] text-[#71717a] font-mono mt-0.5">
                              📞 {b.telefono || 'Sin teléfono'} · ID PIN: {b.id.slice(0, 4)}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[9px] text-[#71717a] uppercase font-bold tracking-wider">Número Biker:</span>
                              <input
                                type="text"
                                defaultValue={b.numero_biker || ''}
                                placeholder="Sin asignar"
                                onBlur={async (e) => {
                                  const newVal = e.target.value.trim()
                                  if (newVal !== (b.numero_biker || '')) {
                                    await actualizarNumeroBiker(b.id, newVal)
                                  }
                                }}
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter') {
                                    const target = e.target as HTMLInputElement
                                    target.blur()
                                  }
                                }}
                                className="bg-[#fafafa] border border-[#e4e4e7] rounded-lg px-2 py-0.5 text-[10px] text-[#09090b] font-mono focus:outline-none focus:border-[#2563eb] w-24"
                              />
                            </div>
                            
                            {/* Créditos / Tiempo Activo */}
                            <div className="flex items-center gap-2 mt-1">
                              <Calendar className="w-3.5 h-3.5 text-[#2563eb]" />
                              <span className={`text-[10px] font-semibold ${vencido ? 'text-red-500 font-bold' : 'text-green-600'}`}>
                                Activo hasta: {fechaFormat} {vencido && '(Vencido)'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Controles de cuenta */}
                        <div className="flex flex-wrap items-center gap-3 justify-end">
                          
                          {/* Botón rápido recarga */}
                          <button
                            onClick={() => abrirRecargaModal(b)}
                            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-[10px] uppercase tracking-wider px-3.5 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-1"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            Recargar Tiempo
                          </button>

                          {estaBloqueado ? (
                            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-1.5">
                              <span className="text-[9px] font-bold text-red-600 flex items-center gap-1">
                                <ShieldAlert className="w-3 h-3" />
                                {esPermanente ? 'Permanente' : 'Suspendido'}
                              </span>
                              <button
                                onClick={() => desbloquearBiker(b.id)}
                                className="text-[10px] font-bold text-[#09090b] hover:text-[#2563eb] hover:underline"
                              >
                                Desbloquear
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setBikerSeleccionadoBloqueo(b)}
                              className="border border-[#e4e4e7] hover:border-red-200 text-[#71717a] hover:text-red-500 hover:bg-red-50 font-bold text-[10px] uppercase tracking-wider px-3 py-2.5 rounded-xl transition-all"
                            >
                              Bloquear
                            </button>
                          )}

                        </div>

                      </div>
                    )
                  })}
                </div>
              </div>

            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* PESTAÑA: REPARTIDORES (MAPA EN TIEMPO REAL)                         */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {pestana === 'mapa' && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <h3 className="text-sm font-bold text-[#09090b]">Mapa de Ubicación en Tiempo Real (GPS Broadcast)</h3>
                <p className="text-xs text-[#71717a] mt-0.5">Mapeo dinámico al vuelo sin escrituras a base de datos.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Mapa Leaflet */}
                <div className="lg:col-span-2 card-clean bg-white p-3 border border-[#e4e4e7] shadow-xs">
                  <div id="mapa-modulador-view" className="w-full h-[400px] rounded-xl bg-[#fafafa]" />
                </div>

                {/* Historial de Pings GPS */}
                <div className="card-clean bg-white p-5 space-y-4 border border-[#e4e4e7]">
                  <h4 className="text-xs font-bold text-[#09090b] flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 text-[#2563eb] animate-spin" />
                    Transmisiones Activas
                  </h4>
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {pingHistory.length === 0 ? (
                      <p className="text-xs text-[#a1a1aa] text-center py-12">Esperando pings de los repartidores conectados...</p>
                    ) : (
                      pingHistory.map((h, i) => (
                        <div key={i} className="bg-[#fafafa] border border-[#e4e4e7] rounded-lg p-2.5 text-[10px] space-y-1 font-mono">
                          <div className="flex justify-between font-bold text-[#09090b]">
                            <span>🏍️ {h.biker}</span>
                            <span className="text-[#a1a1aa] font-normal">{h.time}</span>
                          </div>
                          <div className="text-[#71717a]">
                            Lat: {h.lat} · Lng: {h.lng}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* PESTAÑA: CONFIGURACIÓN MONETIZACIÓN                              */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {pestana === 'configuracion' && (
            <div className="max-w-xl space-y-4 animate-fadeIn">
              <div>
                <h3 className="text-sm font-bold text-[#09090b]">Configuración Financiera de la Flota</h3>
                <p className="text-xs text-[#71717a] mt-0.5">Establece tarifas de recarga y beneficios iniciales.</p>
              </div>

              <div className="card-clean bg-white p-6 shadow-sm border border-[#e4e4e7]">
                <form onSubmit={guardarConfiguracionFlota} className="space-y-4">
                  
                  {/* Precio Crédito */}
                  <div>
                    <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide mb-1.5">
                      Precio de Crédito ($ MXN)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={confPrecioCredito}
                      onChange={e => setConfPrecioCredito(e.target.value)}
                      className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-2.5 text-[#09090b] text-sm focus:outline-none focus:border-[#2563eb] transition-all"
                      required
                    />
                  </div>

                  {/* Días por Crédito */}
                  <div>
                    <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide mb-1.5">
                      Días de Acceso por Crédito (ej. 7 días para semana)
                    </label>
                    <input
                      type="number"
                      value={confTiempoCredito}
                      onChange={e => setConfTiempoCredito(e.target.value)}
                      className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-2.5 text-[#09090b] text-sm focus:outline-none focus:border-[#2563eb] transition-all"
                      required
                    />
                  </div>

                  {/* Días de regalo cortesía */}
                  <div>
                    <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide mb-1.5">
                      Días de Regalo de Cortesía (Nuevos Repartidores)
                    </label>
                    <input
                      type="number"
                      value={confDiasRegalo}
                      onChange={e => setConfDiasRegalo(e.target.value)}
                      className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-2.5 text-[#09090b] text-sm focus:outline-none focus:border-[#2563eb] transition-all"
                      required
                    />
                  </div>

                  <hr className="border-[#e4e4e7] my-5" />

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-[#09090b] uppercase tracking-wider flex items-center gap-1.5">
                      📊 Tabulador de Tarifas por Distancia
                    </h4>
                    <p className="text-[10px] text-[#71717a]">Define rangos de distancia en kilómetros y su precio base.</p>
                  </div>

                  <div className="space-y-2.5">
                    {tabuladorRangos.map((rango, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-[#fafafa] p-3 rounded-xl border border-[#e4e4e7] relative">
                        <div className="flex-1">
                          <label className="block text-[8px] font-bold text-[#71717a] uppercase tracking-wider mb-1">Desde (Km)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={rango.desde}
                            onChange={e => actualizarRangoTabulador(idx, 'desde', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white border border-[#e4e4e7] rounded-lg px-2 py-1 text-xs text-[#09090b] focus:outline-none"
                            required
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-[8px] font-bold text-[#71717a] uppercase tracking-wider mb-1">Hasta (Km)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={rango.hasta}
                            onChange={e => actualizarRangoTabulador(idx, 'hasta', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white border border-[#e4e4e7] rounded-lg px-2 py-1 text-xs text-[#09090b] focus:outline-none"
                            required
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-[8px] font-bold text-[#71717a] uppercase tracking-wider mb-1">Precio ($)</label>
                          <input
                            type="number"
                            step="1"
                            value={rango.precio}
                            onChange={e => actualizarRangoTabulador(idx, 'precio', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white border border-[#e4e4e7] rounded-lg px-2 py-1 text-xs text-[#09090b] focus:outline-none font-bold"
                            required
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => eliminarRangoTabulador(idx)}
                          className="mt-4 p-1.5 rounded-lg bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-colors"
                          title="Eliminar rango"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={agregarRangoTabulador}
                      className="w-full border border-dashed border-[#d4d4d8] text-[#71717a] hover:text-[#09090b] hover:border-[#71717a] rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 bg-[#fafafa]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar Rango de Distancia</span>
                    </button>
                  </div>

                  <hr className="border-[#e4e4e7] my-5" />

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-[#09090b] uppercase tracking-wider">
                      🌧️ Recargos y Excedentes de Km
                    </h4>
                    <p className="text-[10px] text-[#71717a]">Configura tarifas adicionales de clima y horarios especiales.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pb-3">
                    <div>
                      <label className="block text-[9px] font-bold text-[#3f3f46] uppercase tracking-wider mb-1">Km Límite (Tabulador)</label>
                      <input
                        type="number"
                        value={tabuladorBaseExtraKm}
                        onChange={e => setTabuladorBaseExtraKm(e.target.value)}
                        className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-3 py-2 text-xs text-[#09090b] focus:outline-none focus:border-[#2563eb]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-[#3f3f46] uppercase tracking-wider mb-1">Precio por Km Extra ($)</label>
                      <input
                        type="number"
                        value={tabuladorPrecioExtraKm}
                        onChange={e => setTabuladorPrecioExtraKm(e.target.value)}
                        className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-3 py-2 text-xs text-[#09090b] focus:outline-none focus:border-[#2563eb]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-[#3f3f46] uppercase tracking-wider mb-1">Lluvia Moderada ($)</label>
                      <input
                        type="number"
                        value={tabuladorRecargoLluvia}
                        onChange={e => setTabuladorRecargoLluvia(e.target.value)}
                        className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-3 py-2 text-xs text-[#09090b] focus:outline-none focus:border-[#2563eb]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-[#3f3f46] uppercase tracking-wider mb-1">Lluvia Fuerte ($)</label>
                      <input
                        type="number"
                        value={tabuladorRecargoLluviaFuerte}
                        onChange={e => setTabuladorRecargoLluviaFuerte(e.target.value)}
                        className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-3 py-2 text-xs text-[#09090b] focus:outline-none focus:border-[#2563eb]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-[#3f3f46] uppercase tracking-wider mb-1">Horario Nocturno ($)</label>
                      <input
                        type="number"
                        value={tabuladorRecargoNocturno}
                        onChange={e => setTabuladorRecargoNocturno(e.target.value)}
                        className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-3 py-2 text-xs text-[#09090b] focus:outline-none focus:border-[#2563eb]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-[#3f3f46] uppercase tracking-wider mb-1">Inicio Horario Nocturno (ej. 20:00)</label>
                      <input
                        type="text"
                        placeholder="Ej. 20:00"
                        value={confHorarioNocturnoInicio}
                        onChange={e => setConfHorarioNocturnoInicio(e.target.value)}
                        className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-3 py-2 text-xs text-[#09090b] focus:outline-none focus:border-[#2563eb]"
                        required
                      />
                    </div>
                  </div>

                  {/* Feedback */}
                  {confFeedback && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-[#2563eb] font-semibold">
                      {confFeedback}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={actualizandoConf}
                    className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-sm rounded-xl py-3 transition-all flex items-center justify-center gap-1.5"
                  >
                    {actualizandoConf ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Guardar Configuración</span>
                      </>
                    )}
                  </button>

                </form>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Barra de navegación inferior móvil */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#e4e4e7] h-16 z-40 flex items-center justify-around px-2 shadow-lg">
        <button
          onClick={() => setPestana('servicios')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            pestana === 'servicios' ? 'text-[#2563eb]' : 'text-[#a1a1aa]'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span>Bandeja</span>
        </button>

        <button
          onClick={() => setPestana('metricas')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            pestana === 'metricas' ? 'text-[#2563eb]' : 'text-[#a1a1aa]'
          }`}
        >
          <TrendingUp className="w-5 h-5" />
          <span>Métricas</span>
        </button>

        <button
          onClick={() => setPestana('usuarios')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold relative ${
            pestana === 'usuarios' ? 'text-[#2563eb]' : 'text-[#a1a1aa]'
          }`}
        >
          <Users className="w-5 h-5" />
          <span>Créditos</span>
          {listBikersPendientes.length > 0 && (
            <span className="absolute -top-1.5 right-1.5 bg-[#2563eb] text-white text-[8px] px-1 py-0.5 rounded-full font-black animate-pulse">
              {listBikersPendientes.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setPestana('mapa')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            pestana === 'mapa' ? 'text-[#2563eb]' : 'text-[#a1a1aa]'
          }`}
        >
          <MapPin className="w-5 h-5" />
          <span>Mapa</span>
        </button>

        <button
          onClick={() => setPestana('configuracion')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            pestana === 'configuracion' ? 'text-[#2563eb]' : 'text-[#a1a1aa]'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span>Config</span>
        </button>
      </nav>

      {/* ── MODAL: REGISTRAR ADMISIÓN Y CRÉDITOS INICIALES ── */}
      {bikerAprobacionModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 border border-[#e4e4e7] animate-fadeIn space-y-5">
            <div className="flex justify-between items-center pb-2 border-b border-[#f4f4f5]">
              <h3 className="font-bold text-base text-[#09090b] flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-green-600" />
                Aprobar Repartidor
              </h3>
              <button
                onClick={() => setBikerAprobacionModal(null)}
                className="w-7 h-7 rounded-full bg-[#fafafa] flex items-center justify-center hover:bg-[#f4f4f5]"
              >
                <X className="w-4 h-4 text-[#71717a]" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-[#52525b] leading-relaxed">
                Vas a aceptar el ingreso de <strong>{bikerAprobacionModal.nombre}</strong> a la flota. Define los días iniciales de saldo a cargar:
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide mb-1.5">
                  Días de Acceso Iniciales (Carga Regalo)
                </label>
                <input
                  type="number"
                  value={diasInicialesCarga}
                  onChange={e => setDiasInicialesCarga(e.target.value)}
                  className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-2 text-[#09090b] text-sm focus:outline-none focus:border-[#2563eb]"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setBikerAprobacionModal(null)}
                className="flex-1 border border-[#e4e4e7] rounded-xl py-2.5 text-xs font-semibold text-[#71717a] hover:bg-[#fafafa]"
              >
                Cancelar
              </button>
              <button
                onClick={procesarAprobacionBiker}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl py-2.5 shadow-sm"
              >
                Aprobar y Cargar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: RECARGAR CRÉDITOS / ACCESO TEMPORAL ── */}
      {bikerRecargaModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 border border-[#e4e4e7] animate-fadeIn space-y-5">
            <div className="flex justify-between items-center pb-2 border-b border-[#f4f4f5]">
              <h3 className="font-bold text-base text-[#09090b] flex items-center gap-1.5">
                <PlusCircle className="w-5 h-5 text-[#2563eb]" />
                Recargar Tiempo de Acceso
              </h3>
              <button
                onClick={() => setBikerRecargaModal(null)}
                className="w-7 h-7 rounded-full bg-[#fafafa] flex items-center justify-center hover:bg-[#f4f4f5]"
              >
                <X className="w-4 h-4 text-[#71717a]" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-[#52525b] leading-relaxed">
                Recarga tiempo de acceso a <strong>{bikerRecargaModal.nombre}</strong>.
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide mb-1.5">
                  Días a Añadir
                </label>
                <input
                  type="number"
                  value={diasRecargaCarga}
                  onChange={e => setDiasRecargaCarga(e.target.value)}
                  className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-2.5 text-[#09090b] text-sm focus:outline-none focus:border-[#2563eb]"
                  required
                />
                <p className="text-[10px] text-[#71717a] mt-1 italic">
                  Se sumará a su saldo activo o a partir de hoy si ya venció.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setBikerRecargaModal(null)}
                className="flex-1 border border-[#e4e4e7] rounded-xl py-2.5 text-xs font-semibold text-[#71717a] hover:bg-[#fafafa]"
              >
                Cancelar
              </button>
              <button
                onClick={procesarRecargaBiker}
                className="flex-1 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs rounded-xl py-2.5 shadow-sm"
              >
                Aplicar Recarga
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: APLICAR BLOQUEO FLEXIBLE ── */}
      {bikerSeleccionadoBloqueo && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 border border-[#e4e4e7] animate-fadeIn space-y-5">
            <div className="flex justify-between items-center pb-2 border-b border-[#f4f4f5]">
              <h3 className="font-bold text-base text-[#09090b] flex items-center gap-1.5">
                <UserX className="w-5 h-5 text-red-600" />
                Bloquear Acceso Biker
              </h3>
              <button
                onClick={() => setBikerSeleccionadoBloqueo(null)}
                className="w-7 h-7 rounded-full bg-[#fafafa] flex items-center justify-center hover:bg-[#f4f4f5]"
              >
                <X className="w-4 h-4 text-[#71717a]" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-[#52525b] leading-relaxed">
                Configura restricciones de acceso para <strong>{bikerSeleccionadoBloqueo.nombre}</strong>. Su sesión en el dispositivo será cerrada inmediatamente.
              </p>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide mb-1.5">
                  Duración del Bloqueo
                </label>
                <select
                  value={bloqueoTiempo}
                  onChange={e => setBloqueoTiempo(e.target.value)}
                  className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-2.5 text-[#09090b] text-sm focus:outline-none focus:border-[#2563eb]"
                >
                  <option value="1">1 Hora</option>
                  <option value="4">4 Horas</option>
                  <option value="12">12 Horas</option>
                  <option value="24">24 Horas (1 Día)</option>
                  <option value="72">72 Horas (3 Días)</option>
                  <option value="168">168 Horas (7 Días)</option>
                  <option value="indefinido">Indefinido (Permanente)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setBikerSeleccionadoBloqueo(null)}
                className="flex-1 border border-[#e4e4e7] rounded-xl py-2.5 text-xs font-semibold text-[#71717a] hover:bg-[#fafafa]"
              >
                Cancelar
              </button>
              <button
                onClick={aplicarBloqueo}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl py-2.5 shadow-sm"
              >
                Bloquear Acceso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: AGREGAR REPARTIDOR MANUALMENTE ── */}
      {manualBikerModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 border border-[#e4e4e7] animate-fadeIn space-y-5">
            <div className="flex justify-between items-center pb-2 border-b border-[#f4f4f5]">
              <h3 className="font-bold text-base text-[#09090b] flex items-center gap-1.5">
                <PlusCircle className="w-5 h-5 text-[#2563eb]" />
                Agregar Repartidor Manual
              </h3>
              <button
                onClick={() => setManualBikerModalOpen(false)}
                className="w-7 h-7 rounded-full bg-[#fafafa] flex items-center justify-center hover:bg-[#f4f4f5]"
              >
                <X className="w-4 h-4 text-[#71717a]" />
              </button>
            </div>

            <form onSubmit={crearBikerManualmente} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide mb-1.5">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={manualNombre}
                  onChange={e => setManualNombre(e.target.value)}
                  className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-2.5 text-[#09090b] text-sm focus:outline-none focus:border-[#2563eb]"
                  placeholder="Ej: Juan Pérez"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide mb-1.5">
                  Teléfono *
                </label>
                <input
                  type="tel"
                  value={manualTelefono}
                  onChange={e => setManualTelefono(e.target.value)}
                  className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-2.5 text-[#09090b] text-sm focus:outline-none focus:border-[#2563eb]"
                  placeholder="Ej: 4521234567"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide mb-1.5">
                  PIN de Acceso (4-6 dígitos) *
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={manualPin}
                  onChange={e => setManualPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-2.5 text-[#09090b] text-sm focus:outline-none focus:border-[#2563eb] font-mono tracking-widest"
                  placeholder="Ej: 1234"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide mb-1.5">
                  Días de Acceso Iniciales (Carga Regalo)
                </label>
                <input
                  type="number"
                  value={manualDiasRegalo}
                  onChange={e => setManualDiasRegalo(e.target.value)}
                  className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-2.5 text-[#09090b] text-sm focus:outline-none focus:border-[#2563eb]"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setManualBikerModalOpen(false)}
                  className="flex-1 border border-[#e4e4e7] rounded-xl py-2.5 text-xs font-semibold text-[#71717a] hover:bg-[#fafafa]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creandoManual}
                  className="flex-1 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs rounded-xl py-2.5 shadow-sm flex items-center justify-center gap-1.5"
                >
                  {creandoManual ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creando...</>
                  ) : (
                    'Agregar Repartidor'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  )
}
