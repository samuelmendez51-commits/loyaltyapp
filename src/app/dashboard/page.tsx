'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { 
  LayoutDashboard, 
  Users, 
  UtensilsCrossed, 
  Map, 
  Settings, 
  UserCheck, 
  TrendingUp, 
  QrCode, 
  UserPlus, 
  MoreVertical, 
  Menu, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  RefreshCw,
  HelpCircle,
  Lock,
  Download,
  AlertTriangle,
  Clock,
  Briefcase,
  FileSpreadsheet,
  Check,
  Plus,
  Trash2,
  DollarSign,
  PieChart as PieIcon,
  BarChart3 as BarIcon,
  PhoneCall,
  Smartphone
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'

interface Cliente {
  id: string; nombre: string; puntos: number; telefono: string
  fecha_nacimiento: string | null; created_at: string
}
interface Historial {
  id: string; cliente_id: string; tipo_movimiento: string; cantidad: number
  created_at: string; descripcion: string; clientes: { nombre: string }
}
interface Business {
  id: string; nombre: string; slug: string; logo_url: string
  telefono_whatsapp: string; max_sellos: number; monto_minimo_sello: number
  estado: string; fecha_vencimiento: string; latitude: number; longitude: number;
  direccion?: string; hora_apertura?: string; hora_cierre?: string;
  banner_url?: string;
  moneda?: string;
}

// ── Componente: Countdown de vencimiento ────────────────────────────────────
function CountdownBanner({ business }: { business: Business }) {
  const [tiempo, setTiempo] = useState<{ dias: number; horas: number; minutos: number } | null>(null)

  useEffect(() => {
    const calcular = () => {
      const diff = new Date(business.fecha_vencimiento).getTime() - Date.now()
      if (diff <= 0) { setTiempo(null); return }
      setTiempo({
        dias: Math.floor(diff / 86400000),
        horas: Math.floor((diff % 86400000) / 3600000),
        minutos: Math.floor((diff % 3600000) / 60000),
      })
    }
    calcular()
    const iv = setInterval(calcular, 60000)
    return () => clearInterval(iv)
  }, [business.fecha_vencimiento])

  if (!tiempo || tiempo.dias > 5) return null

  return (
    <div className={`w-full rounded-2xl p-4 border flex flex-col sm:flex-row items-center justify-between gap-3 ${
      tiempo.dias < 1
        ? 'bg-red-950/40 border-red-700 animate-pulse'
        : 'bg-amber-950/30 border-amber-800/40'
    }`}>
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-amber-400">⚠️ Suscripción por vencer</p>
        <p className="text-zinc-300 font-bold text-xs mt-1">Lo invitamos a renovar su suscripción para no perder el acceso.</p>
      </div>
      <div className={`text-center px-4 py-1.5 rounded-xl font-black font-mono text-base ${
        tiempo.dias < 1 ? 'text-red-400 bg-red-950 border border-red-900/40' : 'text-amber-400 bg-amber-950/50 border border-amber-800/40'
      }`}>
        {tiempo.dias > 0 ? `${tiempo.dias}d : ` : ''}{String(tiempo.horas).padStart(2,'0')}h : {String(tiempo.minutos).padStart(2,'0')}m
      </div>
    </div>
  )
}

// ── Componente: Estrellas ────────────────────────────────────────────────────
const StarActive = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8 text-amber-400 fill-current drop-shadow-[0_0_6px_rgba(212,175,55,0.6)]">
    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
  </svg>
)
const StarInactive = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8 text-zinc-800 fill-current">
    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" stroke="#3f3f46" strokeWidth="1" />
  </svg>
)

export default function DashboardPage() {
  const [pestaña, setPestaña] = useState('metricas')
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [quickToolsOpen, setQuickToolsOpen] = useState(false)
  const quickToolsRef = useRef<HTMLDivElement>(null)

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [historial, setHistorial] = useState<Historial[]>([])
  const [business, setBusiness] = useState<Business | null>(null)
  const [cargando, setCargando] = useState(true)
  const [sellosHoy, setSellosHoy] = useState(0)
  const [premiosCanjeados, setPremiosCanjeados] = useState(0)
  const [sellosPendientesCount, setSellosPendientesCount] = useState(0)

  // ── MOTORES: WhatsApp y Horarios ──────────────────
  const [horaApertura, setHoraApertura] = useState('14:00')
  const [horaCierre, setHoraCierre] = useState('22:00')
  const [guardandoHorario, setGuardandoHorario] = useState(false)

  // ── MOTORES: CRUD Empleados ──────────────────
  const [empleados, setEmpleados] = useState<any[]>([])
  const [cargandoEmpleados, setCargandoEmpleados] = useState(false)
  const [nuevoEmpNombre, setNuevoEmpNombre] = useState('')
  const [nuevoEmpEmail, setNuevoEmpEmail] = useState('')
  const [nuevoEmpPin, setNuevoEmpPin] = useState('')
  const [nuevoEmpRol, setNuevoEmpRol] = useState('empleado')

  // ── MOTORES: Auditoría y Banderas Rojas ──────────────────
  const [sociosSospechosos, setSociosSospechosos] = useState<Record<string, boolean>>({})
  const [modalAjusteSocio, setModalAjusteSocio] = useState<{ id: string, nombre: string, puntos: number, direccion: 'suma' | 'resta' } | null>(null)
  const [motivoAjuste, setMotivoAjuste] = useState('')
  const [guardandoAjuste, setGuardandoAjuste] = useState(false)

  // ── MOTORES: Métricas & KPIs (Recharts alternable) ──────────────────
  const [tipoGrafica, setTipoGrafica] = useState<'barras' | 'pastel'>('barras')

  // ── MOTORES: Geocercas Slider e iPhone Mockup ──────────────────
  const [radioGeocerca, setRadioGeocerca] = useState(500) // en metros
  const [mostrariPhoneNotif, setMostrariPhoneNotif] = useState(false)

  // ── MOTORES: Gestor de Modificadores en el Dashboard ──────────────────
  const [productoSeleccionadoModAdmin, setProductoSeleccionadoModAdmin] = useState<any | null>(null)
  const [productoEditarSeleccionado, setProductoEditarSeleccionado] = useState<any | null>(null)
  const [categoriasExpandidas, setCategoriasExpandidas] = useState<Record<string, boolean>>({})
  const [modificadoresProducto, setModificadoresProducto] = useState<any[]>([])
  const [cargandoMods, setCargandoMods] = useState(false)
  const [nuevoModNombre, setNuevoModNombre] = useState('')
  const [nuevoModRequerido, setNuevoModRequerido] = useState(false)
  const [nuevaOpcionNombre, setNuevaOpcionNombre] = useState<Record<string, string>>({})
  const [nuevaOpcionPrecio, setNuevaOpcionPrecio] = useState<Record<string, string>>({})

  // Estados para Configuración de Lealtad y Geolocalización
  const [premios, setPremios] = useState<any[]>([])
  const [montoMinimo, setMontoMinimo] = useState<string>('0')
  const [maxStamps, setMaxStamps] = useState<string>('10')
  const [guardandoConfig, setGuardandoConfig] = useState(false)
  const [geoLat, setGeoLat] = useState<string>('')
  const [geoLng, setGeoLng] = useState<string>('')
  
  // Branding configurable
  const [nombreNegocio, setNombreNegocio] = useState('')
  const [logoNegocio, setLogoNegocio] = useState('')
  const [colorPrimario, setColorPrimario] = useState('#ef4444')

  // Inputs para agregar premio
  const [nuevoSelloReq, setNuevoSelloReq] = useState<string>('3')
  const [nuevoNombrePremio, setNuevoNombrePremio] = useState<string>('')
  const [nuevoDescPremio, setNuevoDescPremio] = useState<string>('')
  const [nuevoTipoPremio, setNuevoTipoPremio] = useState<'intermedio' | 'final'>('intermedio')

  // Estados para Menú & QR
  const [productosMenu, setProductosMenu] = useState<any[]>([])
  const [nuevoNombreProd, setNuevoNombreProd] = useState('')
  const [nuevoDescProd, setNuevoDescProd] = useState('')
  const [nuevoPrecioProd, setNuevoPrecioProd] = useState<string>('0')
  const [esUpsellProd, setEsUpsellProd] = useState(false)
  const [guardandoProducto, setGuardandoProducto] = useState(false)
  const [whatsappNegocio, setWhatsappNegocio] = useState('')
  const [guardandoWhatsapp, setGuardandoWhatsapp] = useState(false)
  
  // Categorías de menú y PWA / Push
  const [nuevoGrupoNombre, setNuevoGrupoNombre] = useState('')
  const [nuevoGrupoDesc, setNuevoGrupoDesc] = useState('')
  const [gruposMenu, setGruposMenu] = useState<any[]>([])
  const [grupoSeleccionadoProd, setGrupoSeleccionadoProd] = useState('')
  const [guardandoGrupo, setGuardandoGrupo] = useState(false)
  const [imagenArchivo, setImagenArchivo] = useState<File | null>(null)
  const [mensajePush, setMensajePush] = useState('¡Pasa por tus recompensas!')
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  // Preview wallet
  const [previewId, setPreviewId] = useState('')
  const [previewPuntos, setPreviewPuntos] = useState(0)
  const [previewNombre, setPreviewNombre] = useState('Socio VIP')

  // Wallet
  const [descargandoApple, setDescargandoApple] = useState(false)
  const [descargandoGoogle, setDescargandoGoogle] = useState(false)
  const [os, setOs] = useState('desktop')

  // QR tabs
  const [tipoQR, setTipoQR] = useState<'mesa' | 'delivery'>('delivery')

  useEffect(() => {
    if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) setOs('ios')
    else if (navigator.userAgent.match(/Android/i)) setOs('android')
    
    const handlePrompt = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handlePrompt)

    // Click outside dropdown
    const handleOutsideClick = (e: MouseEvent) => {
      if (quickToolsRef.current && !quickToolsRef.current.contains(e.target as Node)) {
        setQuickToolsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    
    cargarDatos()

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  // Nuevos Estados: Redes Sociales y Horario Semanal por Día
  const [linkFacebook, setLinkFacebook] = useState('')
  const [linkInstagram, setLinkInstagram] = useState('')
  const [linkTiktok, setLinkTiktok] = useState('')
  const [linkYoutube, setLinkYoutube] = useState('')
  const [horarioSemanal, setHorarioSemanal] = useState<any>({
    lunes: { cerrado: true, apertura: '14:00', cierre: '22:00' },
    martes: { cerrado: false, apertura: '14:00', cierre: '21:30' },
    miercoles: { cerrado: false, apertura: '14:00', cierre: '21:30' },
    jueves: { cerrado: false, apertura: '14:00', cierre: '21:30' },
    viernes: { cerrado: false, apertura: '14:00', cierre: '22:00' },
    sabado: { cerrado: false, apertura: '14:00', cierre: '22:00' },
    domingo: { cerrado: false, apertura: '14:00', cierre: '21:30' }
  })
  const [suspensionModalProd, setSuspensionModalProd] = useState<any | null>(null)
  const [googleMapsCargado, setGoogleMapsCargado] = useState(false)

  // Cargar Google Maps dinámicamente en el tab geocercas
  useEffect(() => {
    if (pestaña !== 'geocercas') return
    if (!geoLat || !geoLng) return
    if (typeof window === 'undefined') return

    const initMap = () => {
      const google = (window as any).google
      if (!google) return

      const center = { lat: Number(geoLat) || 19.421583, lng: Number(geoLng) || -102.067222 }
      const mapDiv = document.getElementById('google-map-selector')
      if (!mapDiv) return

      const map = new google.maps.Map(mapDiv, {
        center: center,
        zoom: 15,
        mapId: 'DEMO_MAP_ID',
        disableDefaultUI: false,
        zoomControl: true,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#131314' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#131314' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
          { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
          { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#26262b' }] },
          { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212124' }] },
          { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b1' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0c0c0d' }] }
        ]
      })

      const marker = new google.maps.Marker({
        position: center,
        map: map,
        draggable: true,
        title: 'Ubicación de tu Negocio'
      })

      google.maps.event.addListener(marker, 'dragend', () => {
        const pos = marker.getPosition()
        if (pos) {
          setGeoLat(pos.lat().toFixed(6))
          setGeoLng(pos.lng().toFixed(6))
        }
      })

      map.addListener('click', (e: any) => {
        if (e.latLng) {
          marker.setPosition(e.latLng)
          setGeoLat(e.latLng.lat().toFixed(6))
          setGeoLng(e.latLng.lng().toFixed(6))
        }
      })
    }

    if ((window as any).google && (window as any).google.maps) {
      initMap()
      setGoogleMapsCargado(true)
      return
    }

    const script = document.createElement('script')
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => {
      initMap()
      setGoogleMapsCargado(true)
    }
    document.head.appendChild(script)

  }, [pestaña, geoLat, geoLng])

  const getCookieVal = (name: string) => {
    if (typeof document === 'undefined') return ''
    return document.cookie.match(new RegExp(`${name}=([^;]+)`))?.[1] || ''
  }

  const cargarDatos = async () => {
    setCargando(true)
    const businessId = getCookieVal('session_business_id')

    // Cargar negocio y su configuración
    const activeBizId = businessId || ''
    if (activeBizId) {
      const { data: biz } = await supabase.from('businesses').select('*').eq('id', activeBizId).maybeSingle()
      if (biz) {
        setBusiness(biz as Business)
        setMontoMinimo(String(biz.monto_minimo_sello || 0))
        setMaxStamps(String(biz.max_sellos || 10))
        setGeoLat(biz.latitude || '')
        setGeoLng(biz.longitude || '')
        setWhatsappNegocio(biz.telefono_whatsapp || '')
        setMensajePush(biz.mensaje_push || '¡Pasa por tus recompensas!')
        setNombreNegocio(biz.nombre || '')
        setLogoNegocio(biz.logo_url || '')
        setColorPrimario(biz.color_primario || '#ef4444')

        // Cargar redes sociales y horario semanal
        let linkFb = (biz as any).link_facebook || ''
        let linkIg = (biz as any).link_instagram || ''
        let linkTk = (biz as any).link_tiktok || ''
        let linkYt = (biz as any).link_youtube || ''
        let horarioSem = (biz as any).horario_semanal || null

        // Decodificar horarios y campos desde fallback JSON en direccion
        let apertura = biz.hora_apertura || '14:00'
        let cierre = biz.hora_cierre || '22:00'
        
        if (biz.direccion && biz.direccion.includes('{')) {
          try {
            const jsonStart = biz.direccion.indexOf('{')
            const jsonStr = biz.direccion.substring(jsonStart)
            const parsed = JSON.parse(jsonStr)
            if (parsed.hora_apertura) apertura = parsed.hora_apertura
            if (parsed.hora_cierre) cierre = parsed.hora_cierre
            if (parsed.facebook) linkFb = parsed.facebook
            if (parsed.instagram) linkIg = parsed.instagram
            if (parsed.tiktok) linkTk = parsed.tiktok
            if (parsed.youtube) linkYt = parsed.youtube
            if (parsed.horario_semanal) horarioSem = parsed.horario_semanal
          } catch(err) {
            console.warn("Error parsing schedule fallback JSON:", err)
          }
        }
        
        setLinkFacebook(linkFb)
        setLinkInstagram(linkIg)
        setLinkTiktok(linkTk)
        setLinkYoutube(linkYt)
        if (horarioSem) setHorarioSemanal(horarioSem)

        setHoraApertura(apertura)
        setHoraCierre(cierre)
      }
      
      const { data: rData } = await supabase
        .from('loyalty_rewards')
        .select('*')
        .eq('business_id', activeBizId)
        .order('sello_requerido')
      if (rData) setPremios(rData)

      // Cargar categorías de menú
      const { data: gData } = await supabase
        .from('menu_groups')
        .select('*')
        .eq('business_id', activeBizId)
        .order('orden')
      if (gData) {
        setGruposMenu(gData)
        if (gData.length > 0) setGrupoSeleccionadoProd(gData[0].id)
      }

      // Cargar productos del menú con lazy checker
      const { data: pData } = await supabase
        .from('menu_products')
        .select('*')
        .eq('business_id', activeBizId)
        .order('created_at', { ascending: false })
      
      if (pData) {
        const ahora = new Date()
        let huboCambio = false

        const productosProcesados = await Promise.all(pData.map(async (prod: any) => {
          if (!prod.disponible && prod.suspension_hasta && new Date(prod.suspension_hasta) < ahora) {
            await supabase
              .from('menu_products')
              .update({ disponible: true, suspension_tipo: 'indefinida', suspension_hasta: null })
              .eq('id', prod.id)
            huboCambio = true
            return { ...prod, disponible: true, suspension_tipo: 'indefinida', suspension_hasta: null }
          }
          return prod
        }))

        setProductosMenu(productosProcesados)
        if (huboCambio) {
          setTimeout(() => { cargarDatos() }, 200)
        }
      }
    } else {
      // Fallback
      const { data: biz } = await supabase.from('businesses').select('*').eq('slug', 'laburreria').maybeSingle()
      if (biz) {
        setBusiness(biz as Business)
        setMontoMinimo(String(biz.monto_minimo_sello || 0))
        setMaxStamps(String(biz.max_sellos || 10))
        setGeoLat(biz.latitude || '')
        setGeoLng(biz.longitude || '')
        setWhatsappNegocio(biz.telefono_whatsapp || '')
        setMensajePush(biz.mensaje_push || '¡Pasa por tus recompensas!')

        let apertura = biz.hora_apertura || '14:00'
        let cierre = biz.hora_cierre || '22:00'
        if (biz.direccion && biz.direccion.includes('{')) {
          try {
            const jsonStart = biz.direccion.indexOf('{')
            const jsonStr = biz.direccion.substring(jsonStart)
            const parsed = JSON.parse(jsonStr)
            if (parsed.hora_apertura) apertura = parsed.hora_apertura
            if (parsed.hora_cierre) cierre = parsed.hora_cierre
          } catch(err) {}
        }
        setHoraApertura(apertura)
        setHoraCierre(cierre)

        const { data: rData } = await supabase
          .from('loyalty_rewards')
          .select('*')
          .eq('business_id', biz.id)
          .order('sello_requerido')
        if (rData) setPremios(rData)

        const { data: gData } = await supabase
          .from('menu_groups')
          .select('*')
          .eq('business_id', biz.id)
          .order('orden')
        if (gData) {
          setGruposMenu(gData)
          if (gData.length > 0) setGrupoSeleccionadoProd(gData[0].id)
        }

        const { data: pData } = await supabase
          .from('menu_products')
          .select('*')
          .eq('business_id', biz.id)
          .order('created_at', { ascending: false })
        if (pData) setProductosMenu(pData)
      }
    }

    // Clientes
    let qCli = supabase.from('clientes').select('*').order('created_at', { ascending: false })
    if (businessId) qCli = qCli.eq('business_id', businessId)
    const { data: dataClientes } = await qCli
    if (dataClientes) {
      setClientes(dataClientes)
      if (dataClientes.length > 0 && !previewId) {
        setPreviewId(dataClientes[0].id)
        setPreviewNombre(dataClientes[0].nombre)
        setPreviewPuntos(dataClientes[0].puntos)
      }
    }

    // Historial y Fraude
    const { data: dataHistorial } = await supabase
      .from('historial_puntos').select('*, clientes(nombre)')
      .order('created_at', { ascending: false }).limit(60)
    if (dataHistorial) {
      setHistorial(dataHistorial as any)
      const hoyStr = new Date().toISOString().split('T')[0]
      setSellosHoy(dataHistorial.filter((h: any) => h.created_at.startsWith(hoyStr) && h.tipo_movimiento === 'suma').reduce((a: number, c: any) => a + c.cantidad, 0))
      setPremiosCanjeados(dataHistorial.filter((h: any) => h.tipo_movimiento === 'canje' || h.descripcion?.includes('CANJEAD')).length)

      const sospechosos: Record<string, boolean> = {}
      const sumasPorCliente: Record<string, number[]> = {}
      
      dataHistorial.forEach((h: any) => {
        if (h.tipo_movimiento === 'suma' || h.tipo_movimiento === 'canje') {
          const cId = h.cliente_id
          const time = new Date(h.created_at).getTime()
          if (!sumasPorCliente[cId]) sumasPorCliente[cId] = []
          sumasPorCliente[cId].push(time)
        }
      })
      
      Object.entries(sumasPorCliente).forEach(([cId, tiempos]) => {
        tiempos.sort((a, b) => a - b)
        for (let i = 0; i < tiempos.length - 2; i++) {
          if (tiempos[i + 2] - tiempos[i] <= 5 * 60 * 1000) {
            sospechosos[cId] = true
            break
          }
        }
      })
      setSociosSospechosos(sospechosos)
    }

    // Sellos pendientes count
    if (businessId) {
      const { count } = await supabase.from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('sello_otorgado', true)
        .eq('sello_aprobado', false)
        .eq('sello_rechazado', false)
      setSellosPendientesCount(count || 0)
    }

    await cargarEmpleados(activeBizId || businessId)
    setCargando(false)
  }

  // ── MOTORES: Cargar Empleados CRUD ──────────────────
  const cargarEmpleados = async (activeBizId?: string) => {
    const businessId = activeBizId || getCookieVal('session_business_id') || business?.id
    if (!businessId) return
    setCargandoEmpleados(true)
    const { data } = await supabase
      .from('business_users')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
    if (data) setEmpleados(data)
    setCargandoEmpleados(false)
  }

  const agregarEmpleado = async (e: React.FormEvent) => {
    e.preventDefault()
    const businessId = getCookieVal('session_business_id') || business?.id
    if (!businessId || !nuevoEmpNombre.trim() || !nuevoEmpPin.trim()) return
    
    if (!/^\d{4}$/.test(nuevoEmpPin)) {
      alert('⚠️ El PIN debe ser de exactamente 4 dígitos numéricos')
      return
    }

    const { error } = await supabase
      .from('business_users')
      .insert({
        business_id: businessId,
        nombre: nuevoEmpNombre.trim(),
        email: nuevoEmpEmail.trim().toLowerCase() || null,
        pin: nuevoEmpPin.trim(),
        rol: nuevoEmpRol,
        activo: true
      })

    if (error) {
      alert('Error al agregar empleado: ' + error.message)
    } else {
      setNuevoEmpNombre('')
      setNuevoEmpEmail('')
      setNuevoEmpPin('')
      alert('✅ Miembro del staff agregado con éxito')
      cargarEmpleados()
    }
  }

  const eliminarEmpleado = async (id: string) => {
    if (!confirm('¿Eliminar a este miembro del staff permanentemente?')) return
    const { error } = await supabase.from('business_users').delete().eq('id', id)
    if (error) alert('Error al eliminar: ' + error.message)
    else cargarEmpleados()
  }

  // ── MOTORES: Horario Comercial WhatsApp ──────────────────
  const guardarHorarioNegocio = async () => {
    const businessId = getCookieVal('session_business_id') || business?.id
    if (!businessId) return
    setGuardandoHorario(true)
    
    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          hora_apertura: horaApertura,
          hora_cierre: horaCierre
        })
        .eq('id', businessId)

      if (error) throw error
      alert('✅ Horarios guardados correctamente en base de datos')
    } catch (e) {
      console.warn("No se pudieron guardar las columnas hora_apertura/hora_cierre, usando fallback en columna 'direccion':", e)
      
      const direccionActual = business?.direccion || ''
      let nuevaDireccion = direccionActual
      const jsonStart = direccionActual.indexOf('{')
      const direccionReal = jsonStart !== -1 ? direccionActual.substring(0, jsonStart).trim() : direccionActual
      
      const configJson = JSON.stringify({ hora_apertura: horaApertura, hora_cierre: horaCierre })
      nuevaDireccion = `${direccionReal} ${configJson}`
      
      const { error: fallbackError } = await supabase
        .from('businesses')
        .update({ direccion: nuevaDireccion })
        .eq('id', businessId)
        
      if (fallbackError) {
        alert('Error al guardar horarios: ' + fallbackError.message)
      } else {
        alert('✅ Horarios guardados con éxito (Modo Resiliencia)')
      }
    } finally {
      setGuardandoHorario(false)
      cargarDatos()
    }
  }

  const guardarWhatsappNegocio = async () => {
    const businessId = getCookieVal('session_business_id') || business?.id
    if (!businessId) return
    setGuardandoWhatsapp(true)
    
    const { error } = await supabase
      .from('businesses')
      .update({ telefono_whatsapp: whatsappNegocio })
      .eq('id', businessId)

    if (error) {
      alert('Error al guardar WhatsApp: ' + error.message)
    } else {
      alert('✅ WhatsApp guardado con éxito')
      cargarDatos()
    }
    setGuardandoWhatsapp(false)
  }

  const probarConexionWhatsApp = () => {
    if (!whatsappNegocio) return alert('Por favor ingresa un número de WhatsApp primero')
    const msg = `*LoyaltyApp Enterprise* 📲✨\n¡Tu conexión de notificaciones de mostrador está ACTIVA! Listo para recibir pedidos del Club VIP.`
    const url = `https://wa.me/${whatsappNegocio}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  // ── MOTORES: Alternador de Producto Agotado ──────────────────
  const toggleDisponibilidadProducto = async (prodId: string, actualDisponible: boolean) => {
    // Si se está activando (actualDisponible es false, entonces pasará a true)
    const dataUpdate: any = { disponible: !actualDisponible }
    if (!actualDisponible) {
      dataUpdate.suspension_tipo = 'indefinida'
      dataUpdate.suspension_hasta = null
    }

    const { error } = await supabase
      .from('menu_products')
      .update(dataUpdate)
      .eq('id', prodId)

    if (error) {
      // Fallback si no existen las columnas de suspensión
      const { error: fallbackErr } = await supabase
        .from('menu_products')
        .update({ disponible: !actualDisponible })
        .eq('id', prodId)
      if (fallbackErr) alert('Error al actualizar disponibilidad')
      else cargarDatos()
    } else {
      cargarDatos()
    }
  }

  const aplicarSuspensionProducto = async (tipo: 'temporal' | 'turno' | 'indefinida', minutos: number = 0) => {
    if (!suspensionModalProd) return
    setGuardandoConfig(true)
    
    let suspensionHasta: string | null = null
    const ahora = new Date()

    if (tipo === 'temporal') {
      suspensionHasta = new Date(ahora.getTime() + minutos * 60000).toISOString()
    } else if (tipo === 'turno') {
      // Reactivar al inicio de la jornada del siguiente día activo
      const prox = new Date()
      prox.setDate(prox.getDate() + 1)
      prox.setHours(9, 0, 0, 0) // Default 9 AM
      suspensionHasta = prox.toISOString()
    }

    try {
      const { error } = await supabase
        .from('menu_products')
        .update({
          disponible: false,
          suspension_tipo: tipo,
          suspension_hasta: suspensionHasta
        } as any)
        .eq('id', suspensionModalProd.id)
      
      if (error) {
        // Fallback
        const { error: fallbackErr } = await supabase
          .from('menu_products')
          .update({ disponible: false })
          .eq('id', suspensionModalProd.id)
        if (fallbackErr) throw fallbackErr
      }

      alert('✅ Platillo suspendido con éxito')
      setSuspensionModalProd(null)
      cargarDatos()
    } catch(err: any) {
      alert('Error al suspender: ' + err.message)
    } finally {
      setGuardandoConfig(false)
    }
  }

  const toggleCategoriaActiva = async (catId: string, actualActivo: boolean) => {
    const { error } = await supabase
      .from('menu_groups')
      .update({ activo: !actualActivo })
      .eq('id', catId)
    if (error) {
      alert('Error al actualizar categoría')
    } else {
      cargarDatos()
    }
  }

  const eliminarProductoMenu = async (prodId: string) => {
    if (!confirm('¿Eliminar este producto del menú?')) return
    const { error } = await supabase
      .from('menu_products')
      .delete()
      .eq('id', prodId)
    if (error) {
      alert('Error al eliminar producto: ' + error.message)
    } else {
      alert('✅ Producto eliminado con éxito')
      cargarDatos()
    }
  }

  // ── MOTORES: Lógica CRUD Modificadores en Mostrador ──────────────────
  const abrirGestorModificadores = async (prod: any) => {
    setProductoSeleccionadoModAdmin(prod)
    setCargandoMods(true)
    
    const { data, error } = await supabase
      .from('product_modifiers')
      .select('*, modifier_options(*)')
      .eq('product_id', prod.id)
      
    if (error) {
      console.error(error)
    } else if (data) {
      setModificadoresProducto(data)
    }
    setCargandoMods(false)
  }

  const crearModificador = async () => {
    if (!productoSeleccionadoModAdmin || !nuevoModNombre.trim()) return
    const { data, error } = await supabase
      .from('product_modifiers')
      .insert({
        product_id: productoSeleccionadoModAdmin.id,
        nombre: nuevoModNombre.trim(),
        requerido: nuevoModRequerido
      })
      .select()
      .single()
      
    if (error) {
      alert('Error al crear modificador: ' + error.message)
    } else {
      setNuevoModNombre('')
      setNuevoModRequerido(false)
      abrirGestorModificadores(productoSeleccionadoModAdmin)
    }
  }

  const eliminarModificador = async (id: string) => {
    if (!confirm('¿Eliminar este grupo de modificadores y todas sus opciones?')) return
    const { error } = await supabase.from('product_modifiers').delete().eq('id', id)
    if (error) alert('Error al eliminar modificador: ' + error.message)
    else abrirGestorModificadores(productoSeleccionadoModAdmin)
  }

  const agregarOpcionModificador = async (modifierId: string) => {
    const nombre = nuevaOpcionNombre[modifierId]?.trim()
    const precio = Number(nuevaOpcionPrecio[modifierId] || 0)
    
    if (!nombre) return alert('Ingresa un nombre para la opción')
    
    const { error } = await supabase
      .from('modifier_options')
      .insert({
        modifier_id: modifierId,
        nombre,
        precio_extra: precio
      })
      
    if (error) {
      alert('Error al agregar opción: ' + error.message)
    } else {
      setNuevaOpcionNombre(prev => ({ ...prev, [modifierId]: '' }))
      setNuevaOpcionPrecio(prev => ({ ...prev, [modifierId]: '0' }))
      abrirGestorModificadores(productoSeleccionadoModAdmin)
    }
  }

  const eliminarOpcionModificador = async (opcionId: string) => {
    const { error } = await supabase.from('modifier_options').delete().eq('id', opcionId)
    if (error) alert('Error al eliminar opción: ' + error.message)
    else abrirGestorModificadores(productoSeleccionadoModAdmin)
  }

  // ── MOTORES: Métricas Recharts e CSV ──────────────────
  const obtenerDatosVentas = () => {
    const ventasPorDia: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const diaStr = d.toLocaleDateString('es-MX', { weekday: 'short' })
      ventasPorDia[diaStr] = 0
    }
    historial.forEach(h => {
      const diaStr = new Date(h.created_at).toLocaleDateString('es-MX', { weekday: 'short' })
      if (ventasPorDia[diaStr] !== undefined) {
        if (h.tipo_movimiento === 'suma') ventasPorDia[diaStr] += h.cantidad
      }
    })
    return Object.entries(ventasPorDia).map(([name, sellos]) => ({
      name,
      Ventas: sellos * 120,
      Sellos: sellos
    }))
  }

  const obtenerDatosProductos = () => {
    if (productosMenu.length === 0) {
      return [
        { name: 'Burrito Gigante', value: 45 },
        { name: 'Tacos Especiales', value: 30 },
        { name: 'Quesadillas Clásicas', value: 15 },
        { name: 'Refrescos / Bebidas', value: 10 }
      ]
    }
    return productosMenu.slice(0, 4).map((p, idx) => {
      const valoresSimulados = [45, 30, 20, 10]
      return {
        name: p.nombre,
        value: valoresSimulados[idx] || 10
      }
    })
  }

  const exportarCSV = () => {
    if (historial.length === 0) return alert('No hay transacciones para exportar')
    let csvContent = "data:text/csv;charset=utf-8,ID,Socio,Tipo de Movimiento,Cantidad,Descripcion,Fecha\n"
    historial.forEach(h => {
      const fila = `"${h.id}","${h.clientes?.nombre || 'Socio'}","${h.tipo_movimiento}","${h.cantidad}","${h.descripcion}","${new Date(h.created_at).toLocaleString('es-MX')}"`
      csvContent += fila + "\n"
    })
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `LoyaltyApp-Auditoria-${business?.slug || 'comercio'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ── MOTORES: Ajuste de Puntos con Motivo Obligatorio ──────────────────
  const abrirModalAjuste = (clienteId: string, clienteNombre: string, puntosActuales: number, direccion: 'suma' | 'resta') => {
    setModalAjusteSocio({ id: clienteId, nombre: clienteNombre, puntos: puntosActuales, direccion })
    setMotivoAjuste('')
  }

  const ejecutarAjustePuntos = async () => {
    if (!modalAjusteSocio || !motivoAjuste.trim()) return alert('Debe indicar un motivo de auditoría obligatorio')
    setGuardandoAjuste(true)
    const { id, puntos, direccion } = modalAjusteSocio
    const cantidad = direccion === 'suma' ? 1 : -1
    const nuevosPuntos = Math.max(0, Math.min(Number(maxStamps), puntos + cantidad))
    
    const adminUser = getCookieVal('session_user') || 'Administrador'
    const descripcionMov = `Ajuste manual: ${motivoAjuste.trim()} (Firma: ${adminUser})`

    const { error: dbError } = await supabase.from('clientes').update({ puntos: nuevosPuntos }).eq('id', id)
    if (dbError) {
      alert('Error en base de datos al ajustar: ' + dbError.message)
      setGuardandoAjuste(false)
      return
    }
    
    await supabase.from('historial_puntos').insert([{
      cliente_id: id,
      tipo_movimiento: direccion,
      cantidad: 1,
      descripcion: descripcionMov
    }])
    
    await supabase.from('tracking_events').insert([{
      business_id: business?.id || getCookieVal('session_business_id'),
      cliente_id: id,
      event_type: direccion === 'suma' ? 'approved_by_staff' : 'rejected_fraud',
      metadata: { razon: motivoAjuste.trim(), manual: true, ejecutado_por: adminUser }
    }])
    
    if (id === previewId) setPreviewPuntos(nuevosPuntos)
    setMotivoAjuste('')
    setModalAjusteSocio(null)
    alert('✅ Puntos ajustados y firma de auditoría registrada')
    cargarDatos()
    setGuardandoAjuste(false)
  }

  const eliminarCliente = async (id: string) => {
    if (!confirm('¿Eliminar este socio VIP definitivamente?')) return
    await supabase.from('clientes').delete().eq('id', id)
    cargarDatos()
  }

  const guardarReglasNegocio = async (e: React.FormEvent) => {
    e.preventDefault()
    const businessId = getCookieVal('session_business_id') || business?.id
    if (!businessId) return
    setGuardandoConfig(true)
    
    // Generar el JSON fallback de direccion por compatibilidad
    const direccionTexto = business?.direccion && !business.direccion.includes('{') 
      ? business.direccion 
      : (business?.direccion?.split('|')[0]?.trim() || 'Calle Principal 123')
      
    const fallbackJson = JSON.stringify({
      hora_apertura: horaApertura,
      hora_cierre: horaCierre,
      facebook: linkFacebook,
      instagram: linkInstagram,
      tiktok: linkTiktok,
      youtube: linkYoutube,
      horario_semanal: horarioSemanal
    })
    const direccionCompuesta = `${direccionTexto} | ${fallbackJson}`

    try {
      // 1. Intentar guardar en columnas nativas (si existen)
      const { error } = await supabase
        .from('businesses')
        .update({ 
          nombre: nombreNegocio.trim(),
          logo_url: logoNegocio.trim(),
          color_primario: colorPrimario.trim(),
          monto_minimo_sello: Number(montoMinimo), 
          max_sellos: Number(maxStamps),
          // Columnas V12
          link_facebook: linkFacebook.trim(),
          link_instagram: linkInstagram.trim(),
          link_tiktok: linkTiktok.trim(),
          link_youtube: linkYoutube.trim(),
          horario_semanal: horarioSemanal,
          direccion: direccionCompuesta
        } as any)
        .eq('id', businessId)

      if (error) {
        // Fallback si fallan las columnas
        console.warn("Supabase native columns not found, using JSON fallback in direccion:", error.message)
        const { error: fallbackError } = await supabase
          .from('businesses')
          .update({
            nombre: nombreNegocio.trim(),
            logo_url: logoNegocio.trim(),
            color_primario: colorPrimario.trim(),
            monto_minimo_sello: Number(montoMinimo), 
            max_sellos: Number(maxStamps),
            direccion: direccionCompuesta
          })
          .eq('id', businessId)
        
        if (fallbackError) throw fallbackError
      }

      alert('✅ Reglas, Redes Sociales y Horario Semanal guardados correctamente')
      cargarDatos()
    } catch(err: any) {
      alert('Error al guardar la configuración: ' + err.message)
    } finally {
      setGuardandoConfig(false)
    }
  }

  const agregarPremio = async (e: React.FormEvent) => {
    e.preventDefault()
    const businessId = getCookieVal('session_business_id') || business?.id
    if (!businessId || !nuevoNombrePremio.trim()) return
    setGuardandoConfig(true)

    const { error } = await supabase.from('loyalty_rewards').insert({ business_id: businessId, sello_requerido: Number(nuevoSelloReq), nombre: nuevoNombrePremio.trim(), descripcion: nuevoDescPremio.trim(), tipo: nuevoTipoPremio })
    if (error) alert('Error al crear el premio')
    else { setNuevoNombrePremio(''); setNuevoDescPremio(''); alert('✅ Premio añadido correctamente'); cargarDatos() }
    setGuardandoConfig(false)
  }

  const eliminarPremio = async (id: string) => {
    if (!confirm('¿Eliminar este premio definitivamente?')) return
    setGuardandoConfig(true)
    const { error } = await supabase.from('loyalty_rewards').delete().eq('id', id)
    if (error) alert('Error al eliminar')
    else cargarDatos()
    setGuardandoConfig(false)
  }

  const parseCoordenada = (coordenadaStr: string | number | null | undefined): number => {
    if (!coordenadaStr) return 0
    const limpia = String(coordenadaStr).trim()
    if (/^-?\d+(\.\d+)?$/.test(limpia)) return parseFloat(limpia)

    const dmsRegex = /(\d+)\s*°\s*(\d+)\s*'\s*(\d+(?:\.\d+)?)\s*"\s*([NnSsEeOoWw])/
    const match = limpia.match(dmsRegex)
    if (match) {
      const grados = parseFloat(match[1])
      const minutos = parseFloat(match[2])
      const segundos = parseFloat(match[3])
      const direccion = match[4].toUpperCase()
      let decimal = grados + (minutos / 60) + (segundos / 3600)
      if (direccion === 'S' || direccion === 'O' || direccion === 'W') decimal = -decimal
      return parseFloat(decimal.toFixed(6))
    }
    const parsed = parseFloat(limpia.replace(/[^\d.-]/g, ''))
    return isNaN(parsed) ? 0 : parsed
  }

  const guardarGeolocalizacion = async () => {
    const businessId = getCookieVal('session_business_id') || business?.id
    if (!businessId) return
    setGuardandoConfig(true)

    const latDecimal = parseCoordenada(geoLat)
    const lngDecimal = parseCoordenada(geoLng)
    
    const { error } = await supabase.from('businesses').update({ latitude: latDecimal, longitude: lngDecimal, mensaje_push: mensajePush }).eq('id', businessId)
    if (error) alert('Error al guardar la ubicación y mensaje push')
    else { alert('✅ Ubicación geográfica y mensaje push configurados con éxito'); setGeoLat(String(latDecimal)); setGeoLng(String(lngDecimal)); cargarDatos() }
    setGuardandoConfig(false)
  }

  const agregarCategoriaMenu = async (e: React.FormEvent) => {
    e.preventDefault()
    const businessId = getCookieVal('session_business_id') || business?.id
    if (!businessId || !nuevoGrupoNombre.trim()) return
    setGuardandoGrupo(true)

    const { data: nuevaCat, error } = await supabase.from('menu_groups').insert({ business_id: businessId, nombre: nuevoGrupoNombre.trim(), descripcion: nuevoGrupoDesc.trim(), orden: gruposMenu.length + 1 }).select('id').single()
    if (error) alert('Error al agregar la categoría: ' + error.message)
    else { setNuevoGrupoNombre(''); setNuevoGrupoDesc(''); if (nuevaCat) setGrupoSeleccionadoProd(nuevaCat.id); alert('✅ Categoría agregada correctamente'); cargarDatos() }
    setGuardandoGrupo(false)
  }

  const eliminarCategoriaMenu = async (id: string) => {
    if (!confirm('¿Eliminar esta categoría? Esto podría afectar a los productos asociados.')) return
    setGuardandoGrupo(true)
    const { error } = await supabase.from('menu_groups').delete().eq('id', id)
    if (error) alert('Error al eliminar la categoría: ' + error.message)
    else cargarDatos()
    setGuardandoGrupo(false)
  }

  const [subiendoMenu, setSubiendoMenu] = useState(false)

  const handleMenuUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    const businessId = getCookieVal('session_business_id') || business?.id
    if (!businessId) return alert('No se encontró el ID del negocio')
    
    setSubiendoMenu(true)
    const fileExt = file.name.split('.').pop()
    const fileName = `${businessId}/menu-completo.${fileExt}`
    
    try {
      const { data, error } = await supabase.storage.from('menu-images').upload(fileName, file, { cacheControl: '3600', upsert: true })
      if (error) throw error
      const { data: publicUrlData } = supabase.storage.from('menu-images').getPublicUrl(fileName)
      const publicUrl = publicUrlData.publicUrl
      const { error: dbError } = await supabase.from('businesses').update({ banner_url: publicUrl }).eq('id', businessId)
      if (dbError) throw dbError
      alert(`🎉 ¡Menú subido con éxito!\nURL Pública: ${publicUrl}`)
      cargarDatos()
    } catch (err: any) {
      alert('Error al subir el menú: ' + err.message)
    } finally {
      setSubiendoMenu(false)
    }
  }

  const subirImagenProducto = async (file: File): Promise<string> => {
    const businessId = getCookieVal('session_business_id') || business?.id
    if (!businessId) return ''
    const fileExt = file.name.split('.').pop()
    const fileName = `${businessId}/${Date.now()}.${fileExt}`
    
    try {
      const { data, error } = await supabase.storage.from('menu-images').upload(fileName, file, { cacheControl: '3600', upsert: true })
      if (error) throw error
      const { data: publicUrlData } = supabase.storage.from('menu-images').getPublicUrl(fileName)
      return publicUrlData.publicUrl
    } catch (err: any) {
      console.warn("Storage upload failed, using high-quality fallback: ", err.message)
      const nameLower = nuevoNombreProd.toLowerCase()
      if (nameLower.includes('burrito')) return 'https://images.unsplash.com/photo-1626700051175-6518c4793fde?q=80&w=600&auto=format&fit=crop'
      else if (nameLower.includes('taco')) return 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?q=80&w=600&auto=format&fit=crop'
      else if (nameLower.includes('pizza')) return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=600&auto=format&fit=crop'
      else if (nameLower.includes('burger') || nameLower.includes('hamburguesa')) return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=600&auto=format&fit=crop'
      else if (nameLower.includes('refresco') || nameLower.includes('bebida')) return 'https://images.unsplash.com/photo-1497534446932-c925b458314e?q=80&w=600&auto=format&fit=crop'
      return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop'
    }
  }

  const agregarProductoMenu = async (e: React.FormEvent) => {
    e.preventDefault()
    const businessId = getCookieVal('session_business_id') || business?.id
    if (!businessId || !nuevoNombreProd.trim() || !nuevoPrecioProd.trim()) return
    setGuardandoProducto(true)

    try {
      let grupoId = grupoSeleccionadoProd
      if (!grupoId) {
        if (gruposMenu.length > 0) {
          grupoId = gruposMenu[0].id
        } else {
          const { data: nuevoGrupo, error: grupoError } = await supabase.from('menu_groups').insert({ business_id: businessId, nombre: 'General', orden: 1 }).select('id').single()
          if (grupoError) throw grupoError
          grupoId = nuevoGrupo.id
        }
      }

      let imageUrl = ''
      if (imagenArchivo) {
        imageUrl = await subirImagenProducto(imagenArchivo)
      } else {
        const nameLower = nuevoNombreProd.toLowerCase()
        if (nameLower.includes('burrito')) imageUrl = 'https://images.unsplash.com/photo-1626700051175-6518c4793fde?q=80&w=600&auto=format&fit=crop'
        else if (nameLower.includes('taco')) imageUrl = 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?q=80&w=600&auto=format&fit=crop'
        else if (nameLower.includes('pizza')) imageUrl = 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=600&auto=format&fit=crop'
        else if (nameLower.includes('burger') || nameLower.includes('hamburguesa')) imageUrl = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=600&auto=format&fit=crop'
        else if (nameLower.includes('refresco') || nameLower.includes('bebida')) imageUrl = 'https://images.unsplash.com/photo-1497534446932-c925b458314e?q=80&w=600&auto=format&fit=crop'
        else imageUrl = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop'
      }

      const { error: prodError } = await supabase.from('menu_products').insert({ business_id: businessId, group_id: grupoId, nombre: nuevoNombreProd.trim(), descripcion: nuevoDescProd.trim(), precio: Number(nuevoPrecioProd), imagen_url: imageUrl, disponible: true, es_upsell: esUpsellProd })
      if (prodError) throw prodError
      alert('✅ Producto agregado con éxito al menú')
      setNuevoNombreProd('')
      setNuevoDescProd('')
      setNuevoPrecioProd('0')
      setEsUpsellProd(false)
      setImagenArchivo(null)
      const fileInput = document.getElementById('product-image-input') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      cargarDatos()
    } catch (err: any) {
      alert('Error al agregar el producto: ' + err.message)
    } finally {
      setGuardandoProducto(false)
    }
  }

  const descargarPaseApple = async () => {
    if (!previewId) return alert('Selecciona un cliente')
    setDescargandoApple(true)
    try {
      const res = await fetch('/api/wallet/apple', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId: previewId, nombre: previewNombre, puntos: previewPuntos, businessId: business?.id }) })
      const contentType = res.headers.get('Content-Type')
      if (contentType && contentType.includes('application/vnd.apple.pkpass')) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `LoyaltyApp-${previewId.substring(0,8)}.pkpass`
        document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); document.body.removeChild(a)
      } else {
        const data = await res.json()
        if (data.webPass) {
          alert("⚠️ Pase Web Generado (Bypass Apple Wallet):\nSe abrirá en una nueva pestaña como pase de respaldo.")
          const win = window.open()
          if (win) win.document.write(data.html)
        } else alert('Error: ' + (data.error || 'Fallo de firma'))
      }
    } catch { alert('Error generando pase Apple') }
    finally { setDescargandoApple(false) }
  }

  const descargarPaseGoogle = async () => {
    if (!previewId) return alert('Selecciona un cliente')
    setDescargandoGoogle(true)
    try {
      const res = await fetch('/api/wallet/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: previewId, nombre: previewNombre, puntos: previewPuntos }) })
      const data = await res.json()
      if (data.url) window.open(data.url, '_blank')
      else throw new Error(data.error)
    } catch { alert('Error generando pase Google') }
    finally { setDescargandoGoogle(false) }
  }

  const menuPublicoUrl = business ? `${typeof window !== 'undefined' ? window.location.origin : ''}/${business.slug}/menu` : ''
  const clientesAlLimite = clientes.filter(c => c.puntos >= Number(maxStamps) - 2)

  const TABS = [
    { id: 'metricas', label: '📊 Métricas', icon: LayoutDashboard },
    { id: 'clientes', label: '👥 Socios VIP', icon: Users },
    { id: 'empleados', label: '🛡️ Empleados', icon: UserCheck },
    { id: 'menu_qr', label: '🍽️ Menú & QR', icon: UtensilsCrossed },
    { id: 'geocercas', label: '🗺️ Geo & Push', icon: Map },
    { id: 'configuracion', label: '⚙️ Reglas', icon: Settings },
  ]

  const cerrarSesion = async () => {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.warn("Signout failed or no active session:", e)
    }
    localStorage.clear()
    sessionStorage.clear()
    const cookies = ['session_rol','session_user','session_business_id','session_branch_id','session_user_id']
    cookies.forEach(c => document.cookie = `${c}=; path=/; Max-Age=0`)
    window.location.href = '/login'
  }

  const forzarSincronizacionPWA = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) registration.unregister()
        alert('🔄 Sincronización Forzada PWA exitosa. Limpiando caché y recargando...')
        window.location.reload()
      })
    } else alert('PWA no soportada en este navegador.')
  }

  const [resumenCierreCaja, setResumenCierreCaja] = useState<any | null>(null)
  const cerrarCaja = () => {
    setResumenCierreCaja({
      fecha: new Date().toLocaleDateString('es-MX', { dateStyle: 'full' }),
      sellos: sellosHoy,
      canjes: premiosCanjeados,
      nuevosSocios: clientes.filter(c => {
        const hoy = new Date().toISOString().split('T')[0]
        return c.created_at.startsWith(hoy)
      }).length,
      recabado: sellosHoy * 120
    })
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex font-sans">
      
      {/* ── SIDEBAR DE NAVEGACIÓN PROFESIONAL ────────────────────────────────── */}
      <aside className={`bg-[#0c0c0c] border-r border-zinc-900 transition-all duration-300 flex flex-col justify-between z-30 shrink-0 sticky top-0 h-screen ${
        sidebarExpanded ? 'w-64' : 'w-20'
      }`}>
        <div className="flex flex-col">
          <div className="h-20 border-b border-zinc-900 flex items-center justify-between px-5">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-amber-700 rounded-xl flex items-center justify-center shadow-lg shadow-amber-900/20 shrink-0">
                <span className="text-lg">⭐</span>
              </div>
              {sidebarExpanded && (
                <span className="font-serif font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-300">
                  LoyaltyApp
                </span>
              )}
            </div>
            <button onClick={() => setSidebarExpanded(!sidebarExpanded)} className="text-zinc-500 hover:text-white transition-colors">
              {sidebarExpanded ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
          </div>

          <nav className="p-3 space-y-1.5 flex-1">
            {TABS.map(tab => {
              const TabIcon = tab.icon
              const isSelected = pestaña === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setPestaña(tab.id)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                    isSelected 
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-inner' 
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  <TabIcon className={`w-5 h-5 shrink-0 ${isSelected ? 'text-amber-400' : 'text-zinc-500'}`} />
                  {sidebarExpanded && <span>{tab.label.split(' ')[1] || tab.label}</span>}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-zinc-900">
          {deferredPrompt && (
            <button
              onClick={async () => {
                deferredPrompt.prompt()
                const { outcome } = await deferredPrompt.userChoice
                if (outcome === 'accepted') setDeferredPrompt(null)
              }}
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black uppercase tracking-widest py-3 rounded-xl text-[10px] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
            >
              <Download className="w-4 h-4" />
              {sidebarExpanded && <span>Instalar App</span>}
            </button>
          )}
          {sidebarExpanded && (
            <p className="text-center text-zinc-700 text-[9px] uppercase tracking-widest mt-3 font-mono">
              LoyaltyApp v8 · Biturbo
            </p>
          )}
        </div>
      </aside>

      {/* ── AREA PRINCIPAL DE CONTENIDO ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        
        <header className="h-20 border-b border-zinc-900 bg-[#0c0c0c]/85 backdrop-blur-md sticky top-0 z-20 px-6 sm:px-8 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-serif font-black truncate">
              {business?.nombre || 'LoyaltyApp'}
              <span className="ml-2.5 text-xs font-sans font-bold uppercase tracking-widest text-zinc-500">
                Mostrador B2B
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/escaner">
              <button className="bg-zinc-900 border border-zinc-800 text-zinc-200 hover:text-white font-bold uppercase tracking-widest py-2.5 px-4 rounded-xl text-xs hover:bg-zinc-800 transition-all flex items-center gap-2">
                <QrCode className="w-4 h-4 text-amber-500" />
                <span className="hidden md:inline">Cámara Lector</span>
              </button>
            </Link>
            <Link href="/registro">
              <button className="bg-gradient-to-r from-amber-600 to-amber-700 text-white font-black uppercase tracking-widest py-2.5 px-4 rounded-xl text-xs hover:brightness-110 transition-all shadow-[0_0_15px_rgba(212,175,55,0.2)] flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                <span className="hidden md:inline">Registrar Socio</span>
              </button>
            </Link>

            {getCookieVal('session_rol') === 'superadmin' && (
              <Link href="/superadmin">
                <button className="bg-purple-950/40 border border-purple-800/60 text-purple-300 font-bold py-2.5 px-4 rounded-xl text-xs hover:bg-purple-900/50 transition-all uppercase tracking-widest">
                  👑 Volver a Dios
                </button>
              </Link>
            )}

            <div className="relative" ref={quickToolsRef}>
              <button
                onClick={() => setQuickToolsOpen(!quickToolsOpen)}
                className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {quickToolsOpen && (
                <div className="absolute right-0 mt-2 z-50 bg-[#121212] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden min-w-[200px] py-1">
                  <button
                    onClick={() => { alert('Para soporte técnico o comercial contáctenos en: soporte@loyaltyapp.com'); setQuickToolsOpen(false) }}
                    className="w-full px-4 py-3 text-left text-xs font-bold text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors flex items-center gap-2 border-b border-zinc-900"
                  >
                    <HelpCircle className="w-4 h-4 text-blue-400" /> Soporte
                  </button>
                  <button
                    onClick={() => { forzarSincronizacionPWA(); setQuickToolsOpen(false) }}
                    className="w-full px-4 py-3 text-left text-xs font-bold text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors flex items-center gap-2 border-b border-zinc-900"
                  >
                    <RefreshCw className="w-4 h-4 text-green-400 animate-spin" style={{ animationDuration: '4s' }} /> Forzar Sincronización PWA
                  </button>
                  <button
                    onClick={() => { cerrarCaja(); setQuickToolsOpen(false) }}
                    className="w-full px-4 py-3 text-left text-xs font-bold text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors flex items-center gap-2 border-b border-zinc-900"
                  >
                    <Clock className="w-4 h-4 text-amber-400" /> Cerrar Caja de Turno
                  </button>
                  <button
                    onClick={cerrarSesion}
                    className="w-full px-4 py-3 text-left text-xs font-bold text-red-400 hover:bg-zinc-900 hover:text-red-300 transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 sm:p-8 space-y-6 overflow-y-auto">
          {business && <CountdownBanner business={business} />}

          {/* ────────────────── PESTAÑA: METRICAS ────────────────── */}
          {pestaña === 'metricas' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Sellos Entregados Hoy', valor: sellosHoy, emoji: '⭐', color: 'text-amber-400', desc: 'Sello del ledger actual' },
                  { label: 'Premios Canjeados', valor: premiosCanjeados, emoji: '🎁', color: 'text-green-400', desc: 'Canjes en mostrador' },
                  { label: 'Tarjetas VIP Activas', valor: clientes.length, emoji: '💳', color: 'text-white', desc: 'Clientes totales' },
                ].map((kpi, i) => (
                  <div key={i} className="bg-[#121212] border border-zinc-900 rounded-2xl p-6 shadow-2xl relative overflow-hidden group hover:border-zinc-800 transition-colors">
                    <div className="absolute right-0 bottom-0 text-7xl opacity-5 translate-y-3 translate-x-2 select-none group-hover:scale-110 transition-transform">{kpi.emoji}</div>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">{kpi.label}</p>
                    <p className={`text-4xl font-black mt-2 font-mono ${kpi.color}`}>{kpi.valor}</p>
                    <p className="text-[10px] text-zinc-600 mt-2">{kpi.desc}</p>
                  </div>
                ))}
              </div>

              {sellosPendientesCount > 0 && (
                <Link href="/dashboard/sellos-pendientes">
                  <div className="bg-amber-950/20 border border-amber-900/40 rounded-2xl p-4 flex items-center justify-between hover:bg-amber-950/30 transition-all cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
                      <div>
                        <p className="text-amber-400 font-bold text-xs">⏳ {sellosPendientesCount} sello{sellosPendientesCount !== 1 ? 's' : ''} pendiente{sellosPendientesCount !== 1 ? 's' : ''} de validación en mostrador</p>
                        <p className="text-zinc-500 text-[10px] uppercase tracking-wider mt-0.5">Haz clic aquí para validar pedidos y otorgar sellos VIP</p>
                      </div>
                    </div>
                    <span className="text-amber-400 font-black">→</span>
                  </div>
                </Link>
              )}

              <div className="bg-[#121212] border border-zinc-900 rounded-2xl p-6 shadow-2xl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-zinc-900 pb-5">
                  <div>
                    <h3 className="text-sm font-black text-zinc-300 uppercase tracking-widest">📈 Rendimiento Comercial y Fidelidad</h3>
                    <p className="text-zinc-500 text-[10px] mt-0.5">Alterna y analiza las métricas de tu Club de Fidelización</p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-1 flex">
                      <button onClick={() => setTipoGrafica('barras')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${tipoGrafica === 'barras' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                        <BarIcon className="w-3.5 h-3.5" /> Ventas y Sellos
                      </button>
                      <button onClick={() => setTipoGrafica('pastel')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${tipoGrafica === 'pastel' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                        <PieIcon className="w-3.5 h-3.5" /> Platillos Estrella
                      </button>
                    </div>
                    <button onClick={exportarCSV} className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-bold py-2 px-4 rounded-xl text-xs uppercase tracking-widest flex items-center gap-1.5 transition-colors">
                      <FileSpreadsheet className="w-4 h-4 text-green-500" /> Exportar CSV
                    </button>
                  </div>
                </div>

                <div className="w-full h-80">
                  {tipoGrafica === 'barras' ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={obtenerDatosVentas()}>
                        <XAxis dataKey="name" stroke="#52525b" fontSize={11} tickLine={false} />
                        <YAxis stroke="#52525b" fontSize={11} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff' }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Sellos" name="Sellos VIP" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Ventas" name="Venta Est. ($)" fill="#b91c1c" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={obtenerDatosProductos()} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                          {obtenerDatosProductos().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#f59e0b', '#b91c1c', '#3b82f6', '#10b981'][index % 4]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff' }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {clientesAlLimite.length > 0 && (
                <div className="bg-[#121212] border border-zinc-900 rounded-2xl p-6 shadow-2xl">
                  <h3 className="text-xs uppercase tracking-widest font-black text-amber-400 mb-4 flex items-center gap-2">
                    <Plus className="w-4 h-4 animate-bounce" /> A punto del Premio ({clientesAlLimite.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {clientesAlLimite.map(c => (
                      <div key={c.id} className="bg-black/30 border border-zinc-900 rounded-xl p-4 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-sm text-white">{c.nombre}</p>
                          <p className="text-xs text-zinc-500 font-mono mt-0.5">{c.telefono}</p>
                        </div>
                        <span className="bg-amber-950/40 border border-amber-900/30 text-amber-400 px-3.5 py-1 rounded-full text-xs font-black font-mono">
                          {c.puntos}/{maxStamps}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-[#121212] border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-5 border-b border-zinc-900">
                  <h3 className="text-xs uppercase tracking-widest font-black text-zinc-400">Auditoría Global de Movimientos</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-black/40 border-b border-zinc-900">
                      <tr>{['Socio','Tipo','Cantidad','Motivo / Descripción','Fecha'].map(h => <th key={h} className="px-5 py-3 text-left text-zinc-500 font-black uppercase tracking-widest">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900/50">
                      {historial.map(h => (
                        <tr key={h.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-5 py-3 font-bold text-white">{h.clientes?.nombre || 'Socio'}</td>
                          <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${h.tipo_movimiento === 'suma' ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'}`}>{h.tipo_movimiento}</span></td>
                          <td className="px-5 py-3 font-mono font-bold text-amber-400">{h.cantidad} ★</td>
                          <td className="px-5 py-3 text-zinc-400">{h.descripcion}</td>
                          <td className="px-5 py-3 text-zinc-650 font-mono">{new Date(h.created_at).toLocaleString('es-MX')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ────────────────── PESTAÑA: SOCIOS VIP ────────────────── */}
          {pestaña === 'clientes' && (
            <div className="bg-[#121212] border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-zinc-900">
                <h2 className="text-sm font-black text-zinc-300 uppercase tracking-widest">Fidelidad de Socios Registrados</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-black/40 border-b border-zinc-900">
                    <tr>{['Socio VIP','Estado de Fraude','Progreso de Fidelidad','Ajustes Manuales'].map(h => <th key={h} className="px-6 py-4 text-left text-zinc-500 font-black uppercase tracking-widest">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900/50">
                    {clientes.map(c => {
                      const sospechoso = sociosSospechosos[c.id]
                      return (
                        <tr key={c.id} className="hover:bg-white/5 transition-colors group cursor-pointer" onMouseEnter={() => { setPreviewId(c.id); setPreviewNombre(c.nombre); setPreviewPuntos(c.puntos) }}>
                          <td className="px-6 py-4">
                            <Link href={`/dashboard/clientes/${c.id}`}>
                              <div className="font-bold text-sm text-white group-hover:text-amber-400 transition-colors">{c.nombre}</div>
                              <div className="text-zinc-500 font-mono text-[10px] mt-0.5">{c.telefono || 'Sin tel.'}</div>
                            </Link>
                          </td>
                          <td className="px-6 py-4">
                            {sospechoso ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-950/70 border border-red-800 text-red-400 animate-pulse">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Suspicaz (Múltiples Scans)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-green-950/30 border border-green-900/30 text-green-400">
                                <Check className="w-3 h-3" /> Seguro
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-1.5 bg-zinc-955 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(c.puntos / Number(maxStamps)) * 100}%` }} />
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${c.puntos >= Number(maxStamps) ? 'bg-amber-900/30 text-amber-400 border-amber-700/40' : 'bg-zinc-900 text-zinc-400 border-zinc-800'}`}>{c.puntos}/{maxStamps} ★</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button onClick={() => abrirModalAjuste(c.id, c.nombre, c.puntos, 'resta')} className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 transition-colors flex items-center justify-center font-bold text-base">−</button>
                              <button onClick={() => abrirModalAjuste(c.id, c.nombre, c.puntos, 'suma')} className="w-8 h-8 rounded-lg bg-red-950/30 border border-red-900/30 text-red-400 hover:bg-red-900/40 transition-colors flex items-center justify-center font-bold text-base">+</button>
                              <button onClick={() => eliminarCliente(c.id)} className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-900 text-zinc-600 hover:text-red-500 hover:border-red-900/20 transition-colors flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ────────────────── PESTAÑA: EMPLEADOS ────────────────── */}
          {pestaña === 'empleados' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 bg-[#121212] border border-zinc-900 rounded-2xl p-6 shadow-2xl space-y-4">
                <div>
                  <h3 className="font-serif font-black text-lg text-white">Añadir Cajero / Staff</h3>
                  <p className="text-zinc-500 text-[10px] uppercase tracking-wider mt-0.5 font-bold">Asigna PIN y nivel de acceso</p>
                </div>
                <form onSubmit={agregarEmpleado} className="space-y-4">
                  <div>
                    <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Nombre Completo</label>
                    <input type="text" value={nuevoEmpNombre} onChange={e => setNuevoEmpNombre(e.target.value)} placeholder="Ej: Marcos Solís" className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-600 transition-colors" required />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Email (Opcional)</label>
                    <input type="email" value={nuevoEmpEmail} onChange={e => setNuevoEmpEmail(e.target.value)} placeholder="Ej: marcos@negocio.com" className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-600 transition-colors" />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">PIN de Seguridad (4 dígitos)</label>
                    <input type="password" maxLength={4} inputMode="numeric" value={nuevoEmpPin} onChange={e => setNuevoEmpPin(e.target.value.replace(/\D/g, ''))} placeholder="Ej: 4321" className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white font-mono text-center tracking-[0.5em] focus:outline-none focus:border-amber-600 transition-colors" required />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Nivel de Acceso (RBAC)</label>
                    <select value={nuevoEmpRol} onChange={e => setNuevoEmpRol(e.target.value)} className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-600 transition-colors">
                      <option value="empleado">Staff Cajero (Solo Lector QR)</option>
                      <option value="admin_comercio">Administrador (Control Total)</option>
                    </select>
                  </div>
                  <button type="submit" className="w-full bg-gradient-to-r from-amber-600 to-amber-700 text-white font-black py-3.5 rounded-xl uppercase tracking-widest text-xs transition-all hover:brightness-110 shadow-lg">💾 Guardar Staff</button>
                </form>
              </div>

              <div className="lg:col-span-2 bg-[#121212] border border-zinc-900 rounded-2xl p-6 shadow-2xl">
                <div className="mb-6">
                  <h3 className="font-serif font-black text-lg text-white">Miembros de Staff Activos</h3>
                  <p className="text-zinc-500 text-[10px] uppercase tracking-wider mt-0.5 font-bold">Autorizados para validar cupones y puntos</p>
                </div>
                {cargandoEmpleados ? (
                  <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-zinc-800 border-t-amber-500 rounded-full animate-spin" /></div>
                ) : empleados.length === 0 ? (
                  <div className="text-center py-12 text-zinc-650"><p className="text-4xl mb-3">🛡️</p><p className="font-bold">No hay cajeros agregados</p></div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {empleados.map(emp => (
                      <div key={emp.id} className="bg-black/30 border border-zinc-900 rounded-xl p-4 flex justify-between items-center group">
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-white truncate">{emp.nombre}</p>
                          <p className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">{emp.email || 'Acceso por PIN'}</p>
                          <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${emp.rol === 'admin_comercio' ? 'bg-purple-950/40 border border-purple-800/40 text-purple-400' : 'bg-zinc-800 border border-zinc-700 text-zinc-400'}`}>{emp.rol === 'admin_comercio' ? 'Admin' : 'Cajero / Staff'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-zinc-950 px-2 py-1 rounded border border-zinc-900 text-zinc-400">••••</span>
                          <button onClick={() => eliminarEmpleado(emp.id)} className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-red-950/30 hover:border-red-900/30 text-zinc-500 hover:text-red-400 flex items-center justify-center transition-colors shrink-0"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ────────────────── PESTAÑA: MENÚ & QR ────────────────── */}
          {pestaña === 'menu_qr' && (
            <div className="space-y-6">
              
              <div className="bg-[#121212] border border-zinc-900 rounded-2xl p-6 shadow-2xl">
                <h3 className="font-serif font-black text-lg text-white mb-1">🔗 Tu Menú Digital e Invitación VIP</h3>
                <p className="text-zinc-500 text-xs mb-4">Escanea el QR en mostrador o comparte el enlace para pedidos y registro en el Club VIP.</p>
                <div className="bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 font-mono text-xs text-zinc-300 break-all mb-4 flex justify-between items-center">
                  <span>{menuPublicoUrl || 'Generando enlace...'}</span>
                  {menuPublicoUrl && <button onClick={() => { navigator.clipboard.writeText(menuPublicoUrl); alert('✅ Enlace copiado') }} className="text-amber-400 hover:text-amber-300 text-xs font-bold uppercase tracking-wider ml-4 shrink-0">Copiar</button>}
                </div>
                <div className="flex gap-2 mb-6">
                  {(['delivery','mesa'] as const).map(tipo => (
                    <button key={tipo} onClick={() => setTipoQR(tipo)} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${tipoQR === tipo ? 'bg-zinc-800 border-zinc-700 text-white' : 'border-zinc-900 text-zinc-500 hover:text-zinc-300'}`}>{tipo === 'delivery' ? '🛵 Delivery' : '🍽️ Mesa'}</button>
                  ))}
                </div>
                {menuPublicoUrl ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="bg-white p-4 rounded-2xl shadow-2xl"><QRCodeSVG value={`${menuPublicoUrl}?tipo=${tipoQR}`} size={180} /></div>
                    <p className="text-xs text-zinc-550 text-center">QR para <strong className="text-zinc-300">{tipoQR === 'delivery' ? 'Pedidos a Domicilio' : 'Comer en Restaurante'}</strong></p>
                    <button onClick={() => {
                      const svg = document.querySelector('svg')
                      if (!svg) return
                      const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a'); a.href = url; a.download = `QR-${tipoQR}-${business?.slug}.svg`
                      document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); document.body.removeChild(a)
                    }} className="border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white font-bold py-2.5 px-6 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-2"><Download className="w-4 h-4" /> Exportar QR Alta Calidad</button>
                  </div>
                ) : <div className="text-center py-6 text-zinc-650 text-xs">Cargando...</div>}
              </div>

              <div className="bg-[#121212] border border-zinc-900 rounded-2xl p-6 shadow-2xl space-y-6">
                <div>
                  <h3 className="font-serif font-black text-lg text-white mb-1">📱 Módulo WhatsApp y Horarios de Servicio</h3>
                  <p className="text-zinc-500 text-xs">Administra tu número de pedidos y restringe compras fuera de horas comerciales.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-450 uppercase font-black block">Teléfono WhatsApp de Pedidos</label>
                  <div className="flex gap-3">
                    <input type="text" value={whatsappNegocio} onChange={(e) => setWhatsappNegocio(e.target.value)} placeholder="Ej: 521234567890" className="flex-1 bg-black/50 border border-zinc-850 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-amber-600 transition-colors" />
                    <button onClick={guardarWhatsappNegocio} disabled={guardandoWhatsapp} className="bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-white font-black px-6 py-3 rounded-xl text-xs uppercase tracking-widest transition-all disabled:opacity-50">{guardandoWhatsapp ? '...' : '💾 Guardar'}</button>
                    <button onClick={probarConexionWhatsApp} className="bg-green-950/40 border border-green-900/50 hover:bg-green-900/50 text-green-400 font-black px-4 py-3 rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-1 transition-all"><PhoneCall className="w-3.5 h-3.5" /> Probar Conexión</button>
                  </div>
                </div>
                <div className="border-t border-zinc-900 pt-6 space-y-4">
                  <p className="text-xs font-black text-amber-400 uppercase tracking-widest">⌚ Ajuste de Horas Comerciales de Compra</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1">Hora de Apertura (HH:MM)</label>
                      <input type="time" value={horaApertura} onChange={e => setHoraApertura(e.target.value)} className="w-full bg-black/50 border border-zinc-850 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-amber-600 transition-colors" />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1">Hora de Cierre (HH:MM)</label>
                      <input type="time" value={horaCierre} onChange={e => setHoraCierre(e.target.value)} className="w-full bg-black/50 border border-zinc-850 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-amber-600 transition-colors" />
                    </div>
                  </div>
                  <button onClick={guardarHorarioNegocio} disabled={guardandoHorario} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-3 rounded-xl uppercase tracking-widest text-xs transition-all disabled:opacity-50">{guardandoHorario ? 'Guardando...' : '💾 Guardar Horarios y Bloquear Carta'}</button>
                </div>
              </div>

              {/* Subir Menú PDF/IMG */}
              <div className="bg-[#121212] border border-zinc-900 rounded-2xl p-6 shadow-2xl">
                <h3 className="font-serif font-black text-lg text-white mb-1">📋 Menú Completo (PDF o Imagen)</h3>
                <p className="text-zinc-500 text-xs mb-4">Sube la carta completa para tus comensales.</p>
                <input type="file" accept="image/*,application/pdf" hidden id="menu-upload" onChange={handleMenuUpload} />
                <div onClick={() => document.getElementById('menu-upload')?.click()} className="border-2 border-dashed border-zinc-800 hover:border-amber-500 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all bg-black/20 hover:bg-black/40 group">
                  {subiendoMenu ? (
                    <div className="flex flex-col items-center gap-3"><div className="w-8 h-8 border-2 border-zinc-800 border-t-amber-500 rounded-full animate-spin" /><span className="text-xs text-amber-500 font-bold uppercase tracking-widest animate-pulse">Subiendo...</span></div>
                  ) : <div className="text-center space-y-2"><span className="text-4xl block group-hover:scale-110 transition-transform">📁</span><span className="font-bold text-xs text-zinc-300 block group-hover:text-white transition-colors">Selecciona tu archivo</span></div>}
                </div>
                {business?.banner_url && (
                  <div className="mt-4 bg-zinc-950 border border-zinc-900 rounded-xl p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl">📄</span>
                      <div className="min-w-0"><a href={business.banner_url} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 font-bold hover:underline truncate block">{business.banner_url}</a></div>
                    </div>
                    <span className="bg-green-950/50 border border-green-800/40 text-green-400 text-[9px] font-black px-2 py-0.5 rounded-full uppercase shrink-0">Activo</span>
                  </div>
                )}
              </div>

              {/* Categorías del Menú */}
              <div className="bg-[#121212] border border-zinc-900 rounded-2xl p-6 shadow-2xl">
                <h3 className="font-serif font-black text-lg text-white mb-1">📁 Categorías del Menú</h3>
                <form onSubmit={agregarCategoriaMenu} className="bg-black/20 border border-zinc-850 rounded-xl p-4 mb-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Nombre</label>
                      <input type="text" value={nuevoGrupoNombre} onChange={(e) => setNuevoGrupoNombre(e.target.value)} placeholder="Ej: Entradas" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none" required />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Descripción</label>
                      <input type="text" value={nuevoGrupoDesc} onChange={(e) => setNuevoGrupoDesc(e.target.value)} placeholder="Ej: Platillos para iniciar" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none" />
                    </div>
                  </div>
                  <button type="submit" disabled={guardandoGrupo} className="bg-amber-600 hover:bg-amber-500 text-white font-black px-4 py-2 rounded-xl uppercase tracking-widest text-[9px] transition-all">{guardandoGrupo ? '...' : '➕ Crear Categoría'}</button>
                </form>
                <div className="flex flex-wrap gap-2">
                  {gruposMenu.map(grupo => (
                    <div key={grupo.id} className="bg-black/40 border border-zinc-850 rounded-xl px-3 py-2 flex items-center gap-2">
                      <div><span className="font-bold text-xs text-white">{grupo.nombre}</span></div>
                      <button type="button" onClick={() => eliminarCategoriaMenu(grupo.id)} className="text-red-500 hover:text-red-400 text-xs font-bold p-1 ml-2">✕</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Productos en tu menú */}
              <div className="bg-[#121212] border border-zinc-900 rounded-2xl p-6 shadow-2xl">
                <h3 className="font-serif font-black text-lg text-white mb-1">🍽️ Productos en tu Carta Digital</h3>
                <p className="text-zinc-500 text-xs mb-6">Configura tus productos y define modificadores de forma interactiva.</p>
                
                <form onSubmit={agregarProductoMenu} className="bg-black/20 border border-zinc-850 rounded-2xl p-5 mb-6 space-y-4">
                  <p className="text-xs font-black text-amber-400 uppercase tracking-wider">Añadir Platillo / Bebida</p>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Nombre del Platillo</label>
                      <input type="text" value={nuevoNombreProd} onChange={(e) => setNuevoNombreProd(e.target.value)} placeholder="Ej: Platillo Especial" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-amber-600 transition-colors" required />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Categoría</label>
                      <select value={grupoSeleccionadoProd} onChange={(e) => setGrupoSeleccionadoProd(e.target.value)} className="w-full bg-zinc-955 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs" required>
                        {gruposMenu.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                        {gruposMenu.length === 0 && <option value="">General</option>}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Precio (MXN)</label>
                      <input type="number" value={nuevoPrecioProd} onChange={(e) => setNuevoPrecioProd(e.target.value)} placeholder="Ej: 120" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-amber-600 transition-colors" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Descripción</label>
                      <input type="text" value={nuevoDescProd} onChange={(e) => setNuevoDescProd(e.target.value)} placeholder="Ej: Con queso fundido y carne al gusto" className="w-full bg-zinc-955 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Imagen (Opcional)</label>
                      <input id="product-image-input" type="file" accept="image/*" onChange={(e) => { if (e.target.files && e.target.files.length > 0) setImagenArchivo(e.target.files[0]) }} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-white text-xs file:bg-zinc-800 file:border-none file:text-white file:text-xs file:py-1 file:px-2" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 py-2">
                    <input
                      type="checkbox"
                      id="es-upsell-checkbox"
                      checked={esUpsellProd}
                      onChange={e => setEsUpsellProd(e.target.checked)}
                      className="w-4 h-4 rounded bg-zinc-950 border border-zinc-800 text-amber-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <label htmlFor="es-upsell-checkbox" className="text-[10px] text-zinc-400 uppercase font-black cursor-pointer">⭐ Recomendar en Venta Cruzada (Upsell Predictivo)</label>
                  </div>
                  <button type="submit" disabled={guardandoProducto} className="bg-amber-600 hover:bg-amber-500 text-white font-black px-5 py-2.5 rounded-xl uppercase tracking-widest text-[9px] transition-all">{guardandoProducto ? '...' : '➕ Agregar Producto'}</button>
                </form>

                <div className="space-y-4">
                  {gruposMenu.map(grupo => {
                    const productosDeEsteGrupo = productosMenu.filter(p => p.group_id === grupo.id)
                    const estaExpandida = categoriasExpandidas[grupo.id] !== false // default expandida
                    return (
                      <div key={grupo.id} className="border border-zinc-900 rounded-2xl overflow-hidden bg-black/20">
                        {/* Encabezado Categoría (Rappi Style) */}
                        <div className="flex items-center justify-between p-4 bg-[#18181b]/50 border-b border-zinc-900 select-none">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setCategoriasExpandidas(prev => ({ ...prev, [grupo.id]: !estaExpandida }))}
                              className="text-zinc-500 hover:text-white transition-colors text-sm"
                            >
                              {estaExpandida ? '▼' : '▶'}
                            </button>
                            <div>
                              <h4 className="font-bold text-xs sm:text-sm text-white flex items-center gap-2">
                                {grupo.nombre}
                                <span className="text-[9px] bg-zinc-800 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded-full font-mono">
                                  {productosDeEsteGrupo.length} producto(s)
                                </span>
                                {productosDeEsteGrupo.length === 0 && (
                                  <span className="text-[8px] bg-amber-950/60 text-amber-500 border border-amber-900/50 px-2 py-0.5 rounded-full uppercase font-black">Incompleta</span>
                                )}
                              </h4>
                              {grupo.descripcion && <p className="text-[10px] text-zinc-550 mt-0.5">{grupo.descripcion}</p>}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 sm:gap-6">
                            {/* Switch Categoria Activa */}
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider hidden sm:inline">Activa</span>
                              <div
                                onClick={() => toggleCategoriaActiva(grupo.id, grupo.activo !== false)}
                                className={`w-8 h-4 rounded-full p-0.5 cursor-pointer transition-all ${
                                  grupo.activo !== false ? 'bg-green-800 flex justify-end' : 'bg-zinc-800 flex justify-start'
                                }`}
                              >
                                <div className="w-3 h-3 bg-white rounded-full shadow-sm" />
                              </div>
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => {
                                setGrupoSeleccionadoProd(grupo.id)
                                document.getElementById('add-product-form')?.scrollIntoView({ behavior: 'smooth' })
                              }}
                              className="text-[9px] text-amber-500 hover:text-amber-400 font-black uppercase tracking-widest border border-amber-950/30 bg-amber-950/10 px-2.5 py-1 rounded-lg hover:bg-amber-950/20 transition-all shrink-0"
                            >
                              ➕ Agregar producto
                            </button>
                          </div>
                        </div>

                        {/* Listado de productos (Rappi rows) */}
                        {estaExpandida && (
                          <div className="p-4 divide-y divide-zinc-900 space-y-3.5">
                            {productosDeEsteGrupo.length === 0 ? (
                              <div className="text-center py-6 text-zinc-600 text-xs">
                                <p className="text-xl mb-1">🌮</p>
                                <p className="font-bold">Sin productos en esta categoría</p>
                                <button
                                  onClick={() => {
                                    setGrupoSeleccionadoProd(grupo.id)
                                    document.getElementById('add-product-form')?.scrollIntoView({ behavior: 'smooth' })
                                  }}
                                  className="text-amber-500 hover:underline mt-1 font-bold block mx-auto text-[10px]"
                                >
                                  Añadir el primer platillo
                                </button>
                              </div>
                            ) : (
                              productosDeEsteGrupo.map((prod, pIdx) => (
                                <div key={prod.id} className={`flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between ${pIdx > 0 ? 'pt-3.5' : ''}`}>
                                  <div className="flex gap-3.5 items-center min-w-0">
                                    <div className="w-14 h-14 bg-zinc-900 rounded-xl overflow-hidden border border-zinc-850 shrink-0 relative shadow-inner">
                                      <img src={prod.imagen_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=100'} alt="" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="min-w-0 space-y-0.5">
                                      <h5 className="font-bold text-white text-xs sm:text-sm tracking-wide flex items-center gap-1.5 flex-wrap">
                                        {prod.nombre}
                                        {prod.es_upsell && (
                                          <span className="text-[8px] bg-amber-950 text-amber-500 border border-amber-900 px-2 py-0.5 rounded-full uppercase font-black tracking-widest">Upsell</span>
                                        )}
                                      </h5>
                                      {prod.descripcion && <p className="text-[10px] text-zinc-500 line-clamp-1 max-w-md">{prod.descripcion}</p>}
                                      <p className="text-xs font-mono font-black text-amber-400">${Number(prod.precio).toFixed(0)} MXN</p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-4 w-full sm:w-auto justify-end pt-2 sm:pt-0">
                                    {/* Toggle disponible */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (prod.disponible) {
                                          setSuspensionModalProd(prod)
                                        } else {
                                          toggleDisponibilidadProducto(prod.id, false)
                                        }
                                      }}
                                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wider transition-all select-none shadow-sm cursor-pointer ${
                                        prod.disponible 
                                          ? 'bg-green-950/40 border-green-900/40 text-green-400 hover:bg-green-900/30' 
                                          : 'bg-red-950/40 border-red-900/40 text-red-400 hover:bg-red-900/30'
                                      }`}
                                      title={prod.disponible ? 'Poner platillo fuera de servicio' : 'Activar platillo'}
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse shrink-0" />
                                      {prod.disponible ? (
                                        <span>Disponible</span>
                                      ) : (
                                        <span>
                                          Agotado
                                          {prod.suspension_tipo === 'temporal' && ' (⏳ temp)'}
                                          {prod.suspension_tipo === 'turno' && ' (🌅 turno)'}
                                        </span>
                                      )}
                                    </button>
                                    
                                    {/* Editar producto */}
                                    <button
                                      type="button"
                                      onClick={() => setProductoEditarSeleccionado(prod)}
                                      className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-850 text-blue-400 hover:text-blue-300 hover:bg-zinc-800 hover:border-blue-900/30 flex items-center justify-center transition-all shadow-sm shrink-0"
                                      title="Editar platillo y modificadores"
                                    >
                                      ✏️
                                    </button>
                                    
                                    {/* Eliminar producto */}
                                    <button
                                      type="button"
                                      onClick={() => eliminarProductoMenu(prod.id)}
                                      className="w-8 h-8 rounded-xl bg-red-950/20 border border-red-950/40 text-zinc-500 hover:text-red-400 hover:border-red-900/20 flex items-center justify-center transition-all shadow-sm shrink-0"
                                      title="Eliminar platillo"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Sin categoría */}
                  {productosMenu.filter(p => !gruposMenu.some(g => g.id === p.group_id)).length > 0 && (
                    <div className="border border-zinc-900 rounded-2xl overflow-hidden bg-black/20">
                      <div className="p-4 bg-[#18181b]/50 border-b border-zinc-900">
                        <h4 className="font-bold text-xs text-white">General / Sin Categorizar</h4>
                      </div>
                      <div className="p-4 space-y-3">
                        {productosMenu.filter(p => !gruposMenu.some(g => g.id === p.group_id)).map(prod => (
                          <div key={prod.id} className="flex gap-4 items-center justify-between">
                            <div className="flex gap-3 items-center min-w-0">
                              <div className="w-12 h-12 bg-zinc-900 rounded-lg overflow-hidden border border-zinc-850 shrink-0">
                                <img src={prod.imagen_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=100'} alt="" className="w-full h-full object-cover" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-white text-xs truncate">{prod.nombre}</p>
                                <p className="text-[9px] text-zinc-550 font-mono">${Number(prod.precio).toFixed(0)} MXN</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setProductoEditarSeleccionado(prod)}
                                className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 text-blue-400 hover:text-blue-300 hover:bg-zinc-800 flex items-center justify-center transition-colors"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                onClick={() => eliminarProductoMenu(prod.id)}
                                className="w-8 h-8 rounded-xl bg-red-950/20 border border-red-950/40 text-red-400 flex items-center justify-center transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ────────────────── PESTAÑA: GEOCERCAS ────────────────── */}
          {pestaña === 'geocercas' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#121212] border border-zinc-900 rounded-2xl p-6 shadow-2xl space-y-6">
                  <div>
                    <h3 className="font-serif font-black text-lg text-white mb-1">📍 Localización y Geocerca Satelital</h3>
                    <p className="text-zinc-500 text-xs">Define la ubicación de tu restaurante para el radar Push.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1">Latitud</label>
                      <input type="text" value={geoLat} onChange={(e) => setGeoLat(e.target.value)} placeholder="Ej: 19°25'17.7&quot;N o 19.421583" className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-amber-600 transition-colors" />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1">Longitud</label>
                      <input type="text" value={geoLng} onChange={(e) => setGeoLng(e.target.value)} placeholder="Ej: 102°04'02.0&quot;W o -102.067222" className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-amber-600 transition-colors" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400 font-bold uppercase tracking-wider">Radio Alerta Push</span>
                      <span className="text-amber-400 font-black font-mono">{radioGeocerca} metros</span>
                    </div>
                    <input type="range" min={100} max={5000} step={50} value={radioGeocerca} onChange={e => setRadioGeocerca(Number(e.target.value))} className="w-full accent-amber-500 bg-zinc-950 h-2 rounded-lg cursor-pointer" />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-black block mb-1">Mensaje de Alerta Push Lockscreen</label>
                    <textarea value={mensajePush} onChange={(e) => setMensajePush(e.target.value)} placeholder="Ej: ¡Pasa por tu burrito! Tienes premios esperando..." className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-amber-600 transition-colors h-20 resize-none" required />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={guardarGeolocalizacion} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-black py-3 rounded-xl uppercase tracking-widest text-xs transition-all">📍 Guardar Coordenadas</button>
                    <button onClick={() => { setMostrariPhoneNotif(true); if (navigator.vibrate) navigator.vibrate(200) }} className="bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-zinc-200 font-bold px-5 py-3 rounded-xl text-xs uppercase tracking-widest transition-all flex items-center gap-1.5"><Smartphone className="w-4 h-4 text-amber-500" /> Simular Alerta</button>
                  </div>
                </div>
                <div className="bg-[#121212] border border-zinc-900 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl">
                  <div>
                    <h3 className="font-serif font-black text-lg text-white">🗺️ Radar Geocercas Satelital</h3>
                    <p className="text-zinc-500 text-xs">Haz click en el mapa o arrastra el marcador para configurar con precisión absoluta.</p>
                  </div>
                  <div className="w-full rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 relative h-72">
                    <div id="google-map-selector" className="w-full h-full" style={{ minHeight: '280px' }} />
                    {!googleMapsCargado && (
                      <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-xs text-zinc-400">
                        Cargando Google Maps...
                      </div>
                    )}
                  </div>
                  <div className="bg-zinc-950/40 border border-zinc-850 rounded-xl p-3 text-[10px] text-zinc-500 leading-relaxed space-y-1">
                    <p className="font-bold text-amber-500 uppercase tracking-wider">💡 Instrucciones de API Key (Google Cloud):</p>
                    <p>1. Ve a la consola de Google Cloud Developer.</p>
                    <p>2. Crea un proyecto y habilita **Maps JavaScript API**.</p>
                    <p>3. Genera una Credencial API Key y configúrala como `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` en tu archivo `.env.local`.</p>
                    <p className="italic text-zinc-650">(Actualmente ejecutando en modo de desarrollo sin cargo, totalmente funcional para seleccionar y fijar coordenadas).</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ────────────────── PESTAÑA: CONFIGURACIÓN REGLAS ────────────────── */}
          {pestaña === 'configuracion' && (
            <div className="space-y-6">
              <form onSubmit={guardarReglasNegocio} className="bg-[#121212] border border-zinc-900 rounded-2xl p-6 shadow-2xl space-y-6 animate-in fade-in duration-200">
                <div>
                  <h3 className="font-serif font-black text-lg text-white mb-1">⚙️ Reglas & Personalización del Club</h3>
                  <p className="text-zinc-550 text-xs">Administra las condiciones de lealtad y la identidad visual de tu marca.</p>
                </div>

                {/* Sección de Branding */}
                <div className="border-t border-zinc-900/60 pt-4 space-y-4">
                  <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest font-sans">1. Identidad Visual (White-Label)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs font-black text-zinc-400 uppercase tracking-wider mb-2">Nombre Comercial de Empresa</label>
                      <input type="text" value={nombreNegocio} onChange={(e) => setNombreNegocio(e.target.value)} placeholder="Ej: Morisquetas Apatzingán" className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-600 transition-colors" required />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-zinc-400 uppercase tracking-wider mb-2">Icono Emoji o URL de Logo</label>
                      <input type="text" value={logoNegocio} onChange={(e) => setLogoNegocio(e.target.value)} placeholder="Ej: 🍔 o enlace a imagen" className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-600 transition-colors" required />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-zinc-400 uppercase tracking-wider mb-2">Color del Tema de Marca</label>
                      <div className="flex gap-3">
                        <input type="color" value={colorPrimario} onChange={(e) => setColorPrimario(e.target.value)} className="w-14 h-12 bg-black/50 border border-zinc-800 rounded-xl p-1 cursor-pointer focus:outline-none" />
                        <input type="text" value={colorPrimario} onChange={(e) => setColorPrimario(e.target.value)} placeholder="#ef4444" className="flex-1 bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none font-mono" required />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sección de Reglas de Puntos */}
                <div className="border-t border-zinc-900/60 pt-4 space-y-4">
                  <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest font-sans">2. Condiciones de Recompensas</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-black text-zinc-400 uppercase tracking-wider mb-2">Monto Mínimo por Sello ({business?.moneda || 'MXN'})</label>
                      <input type="number" value={montoMinimo} onChange={(e) => setMontoMinimo(e.target.value)} className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-600 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-zinc-400 uppercase tracking-wider mb-2">Total de Sellos por Tarjeta VIP</label>
                      <input type="number" value={maxStamps} onChange={(e) => setMaxStamps(e.target.value)} className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none" />
                    </div>
                  </div>
                </div>

                {/* Sección de Redes Sociales */}
                <div className="border-t border-zinc-900/60 pt-4 space-y-4">
                  <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest font-sans">3. Redes Sociales & Contacto</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-zinc-400 uppercase tracking-wider mb-2">Facebook Link</label>
                      <input type="text" value={linkFacebook} onChange={e => setLinkFacebook(e.target.value)} placeholder="Ej: https://facebook.com/minegocio" className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-600 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-zinc-400 uppercase tracking-wider mb-2">Instagram Link</label>
                      <input type="text" value={linkInstagram} onChange={e => setLinkInstagram(e.target.value)} placeholder="Ej: https://instagram.com/minegocio" className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-600 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-zinc-400 uppercase tracking-wider mb-2">TikTok Link</label>
                      <input type="text" value={linkTiktok} onChange={e => setLinkTiktok(e.target.value)} placeholder="Ej: https://tiktok.com/@minegocio" className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-600 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-zinc-400 uppercase tracking-wider mb-2">YouTube Link</label>
                      <input type="text" value={linkYoutube} onChange={e => setLinkYoutube(e.target.value)} placeholder="Ej: https://youtube.com/c/minegocio" className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-600 transition-colors" />
                    </div>
                  </div>
                </div>

                {/* Sección de Horarios Diarios Detallados */}
                <div className="border-t border-zinc-900/60 pt-4 space-y-4">
                  <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest font-sans">4. Horario de Jornada Semanal Comercial</p>
                  <p className="text-zinc-500 text-xs">Configura los horarios comerciales y días de descanso individualmente para cada día.</p>
                  
                  <div className="bg-black/20 border border-zinc-850 rounded-2xl p-4 divide-y divide-zinc-900">
                    {Object.keys(horarioSemanal).map((dia) => {
                      const config = horarioSemanal[dia]
                      const nombresDias: Record<string, string> = {
                        lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
                        jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo'
                      }
                      return (
                        <div key={dia} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                          <div className="flex items-center gap-3">
                            <span className="w-24 text-sm font-bold text-white capitalize">{nombresDias[dia]}</span>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input 
                                type="checkbox" 
                                checked={!config.cerrado} 
                                onChange={e => {
                                  const cerrado = !e.target.checked
                                  setHorarioSemanal((prev: any) => ({
                                    ...prev,
                                    [dia]: { ...prev[dia], cerrado }
                                  }))
                                }}
                                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                              />
                              <span className={`text-xs font-black uppercase tracking-wider ${!config.cerrado ? 'text-green-500' : 'text-red-500'}`}>
                                {!config.cerrado ? 'Abierto' : 'Descanso'}
                              </span>
                            </label>
                          </div>
                          
                          {!config.cerrado ? (
                            <div className="flex items-center gap-2">
                              <input 
                                type="time" 
                                value={config.apertura || '14:00'} 
                                onChange={e => {
                                  const val = e.target.value
                                  setHorarioSemanal((prev: any) => ({
                                    ...prev,
                                    [dia]: { ...prev[dia], apertura: val }
                                  }))
                                }}
                                className="bg-black/40 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-600 font-mono"
                              />
                              <span className="text-zinc-550 text-xs">a</span>
                              <input 
                                type="time" 
                                value={config.cierre || '22:00'} 
                                onChange={e => {
                                  const val = e.target.value
                                  setHorarioSemanal((prev: any) => ({
                                    ...prev,
                                    [dia]: { ...prev[dia], cierre: val }
                                  }))
                                }}
                                className="bg-black/40 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-600 font-mono"
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-600 uppercase font-black tracking-widest italic py-1 bg-zinc-950/40 px-3 rounded-lg border border-zinc-900">
                              🔋💤 Descanso comercial
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="border-t border-zinc-900/60 pt-4 flex justify-end">
                  <button type="submit" disabled={guardandoConfig} className="bg-amber-600 hover:bg-amber-500 text-white font-black px-6 py-3 rounded-xl uppercase tracking-widest text-xs transition-all shadow-[0_0_15px_rgba(245,158,11,0.25)]">💾 Guardar Configuración</button>
                </div>
              </form>

              <div className="bg-[#121212] border border-zinc-900 rounded-2xl p-6 shadow-2xl">
                <h3 className="font-serif font-black text-lg text-white mb-1">🎁 Recompensas del Club VIP</h3>
                <form onSubmit={agregarPremio} className="bg-black/20 border border-zinc-800 rounded-2xl p-5 mb-6 space-y-4">
                  <p className="text-xs font-black text-amber-400 uppercase tracking-wider">Añadir Nuevo Premio</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Sello Requerido</label>
                      <input type="number" min={1} max={maxStamps} value={nuevoSelloReq} onChange={(e) => setNuevoSelloReq(e.target.value)} className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-white text-xs" required />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Nombre del Premio</label>
                      <input type="text" value={nuevoNombrePremio} onChange={(e) => setNuevoNombrePremio(e.target.value)} placeholder="Ej: Burrito de Asada Gratis" className="w-full bg-zinc-955 border border-zinc-850 rounded-xl px-3 py-2 text-white text-xs" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Descripción</label>
                      <input type="text" value={nuevoDescPremio} onChange={(e) => setNuevoDescPremio(e.target.value)} placeholder="Ej: Válido en mostrador" className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-white text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Tipo de Premio</label>
                      <select value={nuevoTipoPremio} onChange={(e) => setNuevoTipoPremio(e.target.value as any)} className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-white text-xs">
                        <option value="intermedio">Intermedio</option>
                        <option value="final">Final (Premio Mayor)</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" disabled={guardandoConfig} className="bg-amber-600 hover:bg-amber-500 text-white font-black px-5 py-2.5 rounded-xl uppercase tracking-widest text-[9px] transition-all">➕ Agregar Premio</button>
                </form>
                <div className="space-y-3">
                  <p className="text-xs font-black text-zinc-400 uppercase tracking-wider">Premios Configurados</p>
                  {premios.map(premio => (
                    <div key={premio.id} className="py-3 flex justify-between items-center gap-4 border-b border-zinc-900/40">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border ${premio.tipo === 'final' ? 'bg-amber-955 text-amber-400 border-amber-800' : 'bg-zinc-950 text-zinc-400 border-zinc-850'}`}>{premio.sello_requerido}</span>
                        <div><p className="font-bold text-white text-xs">{premio.nombre}</p></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${premio.tipo === 'final' ? 'bg-amber-950 text-amber-400 border-amber-800' : 'bg-zinc-900 border border-zinc-850'}`}>{premio.tipo}</span>
                        <button onClick={() => eliminarPremio(premio.id)} className="w-8 h-8 rounded-lg bg-red-955/20 text-red-500 hover:bg-red-950/40 flex items-center justify-center text-xs transition-colors ml-2">🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── COLUMNA DERECHA PERMANENTE: MONEDERO WALLET PREVIEW ──────────────── */}
      <aside className="w-80 border-l border-zinc-900 bg-[#0c0c0c] p-6 hidden xl:flex flex-col justify-start sticky top-0 h-screen overflow-y-auto shrink-0 z-10 space-y-6">
        <div>
          <h2 className="text-xs uppercase tracking-widest font-black text-zinc-500 flex items-center justify-between">Monedero Virtual VIP <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" /></h2>
          <p className="text-zinc-600 text-[10px] uppercase tracking-wider mt-1 font-bold">Tarjeta Digital del Socio VIP</p>
        </div>
        <div className="w-full aspect-[0.63] max-w-[260px] mx-auto rounded-[24px] shadow-2xl p-5 flex flex-col justify-between relative overflow-hidden border-2 border-zinc-850 bg-zinc-955">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-zinc-505 font-bold">Tarjeta Socio</p>
              <h4 className="text-xs font-serif font-black tracking-wide text-amber-400 truncate w-32 mt-0.5">{business?.nombre || 'LoyaltyApp'}</h4>
            </div>
            <div className="w-9 h-9 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-sm shadow overflow-hidden">
              {logoNegocio ? (
                logoNegocio.startsWith('http') || logoNegocio.startsWith('/') || logoNegocio.startsWith('data:') ? (
                  <img src={logoNegocio} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-base">{logoNegocio}</span>
                )
              ) : (
                <span className="text-base">✨</span>
              )}
            </div>
          </div>
          <div className="relative z-10 mt-4">
            <p className="text-[9px] uppercase tracking-widest text-zinc-505 font-bold">Miembro VIP</p>
            <p className="font-bold text-white text-sm truncate mt-0.5">{previewNombre}</p>
          </div>
          <div className="relative z-10 grid grid-cols-5 gap-2 my-4">
            {[...Array(Number(maxStamps))].map((_, i) => (
              <div key={i} className="aspect-square flex items-center justify-center shrink-0">
                {i < previewPuntos ? <StarActive /> : <StarInactive />}
              </div>
            ))}
          </div>
          <div className="relative z-10 border-t border-zinc-900 pt-3 flex justify-between items-end">
            <div>
              <p className="text-[8px] uppercase tracking-widest text-zinc-505 font-bold">Estado Total</p>
              <p className="font-mono text-base font-black text-amber-400 mt-0.5">{previewPuntos}/{maxStamps} <span className="text-[10px] text-zinc-400">★</span></p>
            </div>
            <div className="bg-white p-1 rounded-lg shadow-md shrink-0"><QRCodeSVG value={`LOYALTYAPP-VIP-SOCIO-${previewId}`} size={42} /></div>
          </div>
        </div>
        <div className="space-y-2 border-t border-zinc-900 pt-5">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Emitir Pase Físico</p>
          <button onClick={descargarPaseApple} disabled={descargandoApple} className="w-full bg-[#1e1e1e] hover:bg-[#282828] border border-zinc-800 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"><span></span> {descargandoApple ? 'Generando...' : 'Apple Wallet'}</button>
          <button onClick={descargarPaseGoogle} disabled={descargandoGoogle} className="w-full bg-[#1e1e1e] hover:bg-[#282828] border border-zinc-800 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"><span>🤖</span> {descargandoGoogle ? 'Emitiendo...' : 'Google Wallet'}</button>
        </div>
      </aside>

      {/* ── MODAL: CERRAR CAJA DE TURNO ────────────────────────────────────── */}
      {resumenCierreCaja && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-zinc-805 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setResumenCierreCaja(null)} className="absolute top-4 right-4 text-zinc-505 hover:text-white text-xl">✕</button>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto text-3xl">💰</div>
              <div>
                <h3 className="text-xl font-serif font-black text-white">Resumen de Cierre de Caja</h3>
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest mt-1">{resumenCierreCaja.fecha}</p>
              </div>
              <div className="bg-black/40 border border-zinc-850 rounded-2xl p-5 text-left space-y-3 font-mono text-xs">
                <div className="flex justify-between"><span className="text-zinc-500">Sellos VIP Emitidos:</span><span className="text-amber-400 font-bold">{resumenCierreCaja.sellos} sellos</span></div>
                <div className="flex justify-between"><span className="text-zinc-550">Premios Canjeados:</span><span className="text-green-400 font-bold">{resumenCierreCaja.canjes} canjes</span></div>
                <div className="flex justify-between"><span className="text-zinc-550">Nuevos VIPs Registrados:</span><span className="text-blue-400 font-bold">+{resumenCierreCaja.nuevosSocios}</span></div>
                <div className="border-t border-zinc-900 pt-3 flex justify-between text-sm font-sans font-black"><span className="text-zinc-400">Venta Estimada VIP:</span><span className="text-white">${resumenCierreCaja.recabado.toLocaleString()} MXN</span></div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setResumenCierreCaja(null)} className="flex-1 py-3 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-400">Volver</button>
                <button onClick={() => { alert('Caja cerrada con éxito'); setResumenCierreCaja(null) }} className="flex-1 py-3 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-xl text-xs font-black uppercase">Confirmar Cierre</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: AJUSTE DE PUNTOS CON MOTIVO OBLIGATORIO ───────────────── */}
      {modalAjusteSocio && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#27272a] rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setModalAjusteSocio(null)} className="absolute top-4 right-4 text-zinc-505 hover:text-white text-xl">✕</button>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-lg">⚖️</div>
                <div>
                  <h4 className="text-sm font-black text-white">Auditoría Anti-Fraude VIP</h4>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Ajuste manual de puntos</p>
                </div>
              </div>
              <div className="bg-black/30 border border-zinc-900 rounded-xl p-3 text-xs">
                <p className="text-zinc-500">Socio: <strong className="text-white">{modalAjusteSocio.nombre}</strong></p>
                <p className="text-zinc-500 mt-1">Ajuste: <strong className={modalAjusteSocio.direccion === 'suma' ? 'text-green-400' : 'text-red-400'}>{modalAjusteSocio.direccion === 'suma' ? 'Sumar +1 sello' : 'Restar -1 sello'}</strong></p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-400 uppercase font-black block">Motivo Obligatorio de Auditoría</label>
                <textarea value={motivoAjuste} onChange={e => setMotivoAjuste(e.target.value)} placeholder="Ej: Pedido offline no registrado o Corrección de error de scanner" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white h-20 resize-none" required />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setModalAjusteSocio(null)} className="flex-1 py-2.5 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-400">Cancelar</button>
                <button onClick={ejecutarAjustePuntos} disabled={!motivoAjuste.trim() || guardandoAjuste} className="flex-1 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-xl text-xs font-black uppercase">{guardandoAjuste ? '...' : 'Registrar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: SUSPENSIÓN TEMPORAL DE STOCK ───────────────── */}
      {suspensionModalProd && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#27272a] rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setSuspensionModalProd(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-white text-xl">✕</button>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-lg">⏳</div>
                <div>
                  <h4 className="text-sm font-black text-white">Suspensión Fina de Platillo</h4>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Reactivación automática e inteligente</p>
                </div>
              </div>
              
              <div className="bg-black/30 border border-zinc-900 rounded-xl p-3.5 text-xs">
                <p className="text-zinc-500">Producto: <strong className="text-white">{suspensionModalProd.nombre}</strong></p>
                <p className="text-zinc-500 mt-1">Precio: <strong className="text-amber-400">${Number(suspensionModalProd.precio).toFixed(0)} MXN</strong></p>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] text-zinc-400 uppercase font-black block tracking-wider">Opciones de Suspensión:</p>
                
                <div className="grid grid-cols-1 gap-2">
                  <button 
                    onClick={() => aplicarSuspensionProducto('temporal', 30)}
                    className="w-full bg-[#1c1c1e] hover:bg-zinc-800 border border-zinc-850 text-white rounded-xl py-3 px-4 text-xs font-bold text-left flex items-center justify-between cursor-pointer"
                  >
                    <span>⏳ Suspender por 30 minutos</span>
                    <span className="text-[9px] bg-red-950/40 border border-red-900/30 text-red-400 px-2 py-0.5 rounded-full">Reactivar 30m</span>
                  </button>
                  <button 
                    onClick={() => aplicarSuspensionProducto('temporal', 60)}
                    className="w-full bg-[#1c1c1e] hover:bg-zinc-800 border border-zinc-850 text-white rounded-xl py-3 px-4 text-xs font-bold text-left flex items-center justify-between cursor-pointer"
                  >
                    <span>⏳ Suspender por 1 hora</span>
                    <span className="text-[9px] bg-red-950/40 border border-red-900/30 text-red-400 px-2 py-0.5 rounded-full">Reactivar 1h</span>
                  </button>
                  <button 
                    onClick={() => aplicarSuspensionProducto('temporal', 120)}
                    className="w-full bg-[#1c1c1e] hover:bg-zinc-800 border border-zinc-850 text-white rounded-xl py-3 px-4 text-xs font-bold text-left flex items-center justify-between cursor-pointer"
                  >
                    <span>⏳ Suspender por 2 horas</span>
                    <span className="text-[9px] bg-red-950/40 border border-red-900/30 text-red-400 px-2 py-0.5 rounded-full">Reactivar 2h</span>
                  </button>
                  <button 
                    onClick={() => aplicarSuspensionProducto('turno')}
                    className="w-full bg-[#1c1c1e] hover:bg-zinc-800 border border-zinc-850 text-white rounded-xl py-3 px-4 text-xs font-bold text-left flex items-center justify-between cursor-pointer"
                  >
                    <span>🌅 Hasta el Siguiente Turno</span>
                    <span className="text-[9px] bg-amber-950/40 border border-amber-900/30 text-amber-400 px-2 py-0.5 rounded-full">Próxima Jornada</span>
                  </button>
                  <button 
                    onClick={() => aplicarSuspensionProducto('indefinida')}
                    className="w-full bg-red-950/20 hover:bg-red-900/10 border border-red-900/30 text-red-400 rounded-xl py-3 px-4 text-xs font-black text-left flex items-center justify-between cursor-pointer"
                  >
                    <span>🚫 Suspender Indefinidamente</span>
                    <span className="text-[9px] bg-red-950/40 border border-red-900/30 text-red-400 px-2 py-0.5 rounded-full">Manual</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: SIMULADOR DE PUSH IPHONE ───────────────── */}
      {mostrariPhoneNotif && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="relative w-[300px] h-[600px] bg-[#1a1a1a] rounded-[48px] border-[6px] border-zinc-800 shadow-[0_0_50px_rgba(251,191,36,0.15)] flex flex-col justify-start overflow-hidden">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-full z-45 flex items-center justify-center gap-1.5 px-3">
              <div className="w-16 h-1 bg-zinc-800 rounded-full" /><div className="w-2.5 h-2.5 bg-zinc-900 rounded-full" />
            </div>
            <div className="w-full h-full bg-black p-5 pt-12 flex flex-col justify-between relative">
              <div className="bg-[#1c1c1e]/90 border border-zinc-800 rounded-2xl p-3.5 shadow-2xl relative z-20 w-full animate-bounce mt-4">
                <div className="flex items-center gap-2 mb-1.5 justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 bg-amber-500 rounded flex items-center justify-center text-[10px]">⭐</div>
                    <span className="text-[9px] text-zinc-450 font-bold uppercase tracking-wider">LoyaltyApp</span>
                  </div>
                  <span className="text-[8px] text-zinc-550">Ahora</span>
                </div>
                <h4 className="text-white text-[10px] font-black">{business?.nombre || 'Negocio VIP'}</h4>
                <p className="text-zinc-300 text-[9px] mt-0.5 leading-tight">{mensajePush}</p>
              </div>
              <div className="relative z-20 text-center pb-2">
                <button onClick={() => setMostrariPhoneNotif(false)} className="bg-zinc-900 border border-zinc-850 text-zinc-400 font-bold py-2 px-5 rounded-2xl text-[9px] uppercase tracking-widest">✕ Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: GESTOR DE MODIFICADORES DEL MENÚ (ADMINISTRADOR) ───────────────── */}
      {productoSeleccionadoModAdmin && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#27272a] rounded-3xl p-6 w-full max-w-lg shadow-2xl relative max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <button 
              onClick={() => setProductoSeleccionadoModAdmin(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white text-xl"
            >
              ✕
            </button>
            
            <div className="flex gap-4 mb-6 border-b border-zinc-900 pb-4">
              <div className="w-12 h-12 bg-zinc-900 rounded-xl overflow-hidden shrink-0 border border-zinc-800">
                <img src={productoSeleccionadoModAdmin.imagen_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=100'} alt="" className="w-full h-full object-cover" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white">Gestionar Opciones de Platillo</h4>
                <p className="text-xs text-zinc-400 font-serif">{productoSeleccionadoModAdmin.nombre}</p>
              </div>
            </div>

            {/* Crear nuevo grupo de modificadores */}
            <div className="bg-black/30 border border-zinc-850 rounded-2xl p-4 mb-4 space-y-3 shrink-0">
              <p className="text-[10px] text-amber-500 font-black uppercase tracking-wider">Crear Grupo de Modificadores (ej: Elige tu Proteína)</p>
              <div className="flex gap-3">
                <input 
                  type="text" 
                  value={nuevoModNombre}
                  onChange={e => setNuevoModNombre(e.target.value)}
                  placeholder="Ej: Elige tu Salsa"
                  className="flex-1 bg-zinc-950 border border-zinc-805 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-600"
                />
                <label className="flex items-center gap-2 cursor-pointer bg-zinc-950 px-3 rounded-xl border border-zinc-805 select-none text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                  <input 
                    type="checkbox" 
                    checked={nuevoModRequerido}
                    onChange={e => setNuevoModRequerido(e.target.checked)}
                    className="accent-amber-500"
                  />
                  ¿Obligatorio?
                </label>
                <button 
                  onClick={crearModificador}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-widest transition-all"
                >
                  ➕ Añadir
                </button>
              </div>
            </div>

            {/* Listar modificadores actuales */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {cargandoMods ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-zinc-800 border-t-amber-500 rounded-full animate-spin" />
                </div>
              ) : modificadoresProducto.length === 0 ? (
                <p className="text-zinc-655 text-xs py-8 text-center uppercase tracking-wider font-bold">Sin grupos de opciones configurados. Añade el primero aquí arriba.</p>
              ) : (
                modificadoresProducto.map(mod => (
                  <div key={mod.id} className="bg-black/20 border border-zinc-900 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">{mod.nombre}</span>
                        {mod.requerido && <span className="bg-red-955/60 border border-red-900/50 text-red-400 text-[8px] font-black px-2 py-0.5 rounded-full uppercase">Requerido</span>}
                      </div>
                      <button 
                        onClick={() => eliminarModificador(mod.id)}
                        className="text-red-500 hover:text-red-400 text-xs font-bold transition-colors"
                      >
                        Eliminar Grupo
                      </button>
                    </div>

                    {/* Opciones del modificador */}
                    <div className="space-y-2">
                      {mod.modifier_options?.map((opt: any) => (
                        <div key={opt.id} className="flex justify-between items-center bg-zinc-950 px-3 py-2 rounded-xl border border-zinc-900 text-xs font-mono">
                          <span className="text-zinc-300">{opt.nombre}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-amber-500 font-bold">+${Number(opt.precio_extra).toFixed(0)} MXN</span>
                            <button 
                              onClick={() => eliminarOpcionModificador(opt.id)}
                              className="text-zinc-500 hover:text-red-500 transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Agregar opción a este modificador */}
                    <div className="flex gap-2 pt-1.5 border-t border-dashed border-zinc-900">
                      <input 
                        type="text" 
                        value={nuevaOpcionNombre[mod.id] || ''}
                        onChange={e => setNuevaOpcionNombre(prev => ({ ...prev, [mod.id]: e.target.value }))}
                        placeholder="Ej: Salsa Habanera"
                        className="flex-1 bg-zinc-950 border border-zinc-900 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-600"
                      />
                      <input 
                        type="number" 
                        value={nuevaOpcionPrecio[mod.id] || '0'}
                        onChange={e => setNuevaOpcionPrecio(prev => ({ ...prev, [mod.id]: e.target.value }))}
                        placeholder="+$ MXN"
                        className="w-20 bg-zinc-955 border border-zinc-900 rounded-lg px-2 py-1.5 text-xs text-center text-amber-500 font-mono focus:outline-none focus:border-amber-600"
                      />
                      <button 
                        onClick={() => agregarOpcionModificador(mod.id)}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-3 py-1.5 rounded-lg text-xs transition-all uppercase"
                      >
                        ➕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-zinc-900 pt-4 flex shrink-0">
              <button 
                onClick={() => setProductoSeleccionadoModAdmin(null)}
                className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-xl font-black uppercase tracking-wider text-xs shadow-lg hover:brightness-110 transition-all text-center animate-pulse"
              >
                Cerrar y Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {productoEditarSeleccionado && (
        <EditarProductoModal
          producto={productoEditarSeleccionado}
          gruposMenu={gruposMenu}
          onClose={() => setProductoEditarSeleccionado(null)}
          onSuccess={() => { setProductoEditarSeleccionado(null); cargarDatos() }}
        />
      )}

    </div>
  )
}

// Componente Modal de Edición de Producto (Estilo Rappi Partner)
function EditarProductoModal({
  producto,
  gruposMenu,
  onClose,
  onSuccess
}: {
  producto: any
  gruposMenu: any[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [nombre, setNombre] = useState(producto.nombre)
  const [groupId, setGroupId] = useState(producto.group_id)
  const [precio, setPrecio] = useState(producto.precio)
  const [descripcion, setDescripcion] = useState(producto.descripcion || '')
  const [esUpsell, setEsUpsell] = useState(producto.es_upsell || false)
  const [imagenUrl, setImagenUrl] = useState(producto.imagen_url || '')
  const [guardando, setGuardando] = useState(false)
  const [imagenArchivo, setImagenArchivo] = useState<File | null>(null)

  // Modificadores integrados
  const [modificadores, setModificadores] = useState<any[]>([])
  const [cargandoMods, setCargandoMods] = useState(false)
  const [nuevoModNombre, setNuevoModNombre] = useState('')
  const [nuevoModRequerido, setNuevoModRequerido] = useState(false)
  const [nuevaOpcionNombre, setNuevaOpcionNombre] = useState<Record<string, string>>({})
  const [nuevaOpcionPrecio, setNuevaOpcionPrecio] = useState<Record<string, string>>({})

  useEffect(() => {
    cargarModificadores()
  }, [])

  const cargarModificadores = async () => {
    setCargandoMods(true)
    const { data } = await supabase
      .from('product_modifiers')
      .select('*, modifier_options(*)')
      .eq('product_id', producto.id)
    if (data) setModificadores(data)
    setCargandoMods(false)
  }

  const crearModificador = async () => {
    if (!nuevoModNombre.trim()) return
    const { error } = await supabase
      .from('product_modifiers')
      .insert({
        product_id: producto.id,
        nombre: nuevoModNombre.trim(),
        requerido: nuevoModRequerido
      })
    if (error) alert('Error al crear modificador')
    else {
      setNuevoModNombre('')
      setNuevoModRequerido(false)
      cargarModificadores()
    }
  }

  const eliminarModificador = async (id: string) => {
    if (!confirm('¿Eliminar este grupo de modificadores?')) return
    await supabase.from('product_modifiers').delete().eq('id', id)
    cargarModificadores()
  }

  const agregarOpcion = async (modId: string) => {
    const optNombre = nuevaOpcionNombre[modId]?.trim()
    const optPrecio = Number(nuevaOpcionPrecio[modId] || 0)
    if (!optNombre) return
    
    await supabase.from('modifier_options').insert({
      modifier_id: modId,
      nombre: optNombre,
      precio_extra: optPrecio
    })
    setNuevaOpcionNombre(prev => ({ ...prev, [modId]: '' }))
    setNuevaOpcionPrecio(prev => ({ ...prev, [modId]: '0' }))
    cargarModificadores()
  }

  const eliminarOpcion = async (optId: string) => {
    await supabase.from('modifier_options').delete().eq('id', optId)
    cargarModificadores()
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)

    let finalImageUrl = imagenUrl

    if (imagenArchivo) {
      const extension = imagenArchivo.name.split('.').pop()
      const path = `${producto.business_id || 'prod'}/${producto.id}-${Date.now()}.${extension}`
      const { data, error: uploadError } = await supabase.storage
        .from('menu-assets')
        .upload(path, imagenArchivo, { upsert: true })
      
      if (!uploadError && data) {
        const { data: { publicUrl } } = supabase.storage.from('menu-assets').getPublicUrl(path)
        finalImageUrl = publicUrl
      }
    }

    const { error } = await supabase
      .from('menu_products')
      .update({
        nombre,
        group_id: groupId,
        precio: Number(precio),
        descripcion,
        es_upsell: esUpsell,
        imagen_url: finalImageUrl
      })
      .eq('id', producto.id)

    if (error) {
      alert('Error al guardar: ' + error.message)
    } else {
      alert('✅ Producto actualizado')
      onSuccess()
    }
    setGuardando(false)
  }

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#121212] border border-[#27272a] rounded-3xl p-6 sm:p-8 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-black text-white">Editar Producto</h2>
            <p className="text-zinc-500 text-xs">Ajusta los detalles de tu menú y modificadores en el mismo lugar</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl">✕</button>
        </div>

        <form onSubmit={guardar} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="sm:col-span-2 space-y-4">
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Nombre del Platillo</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-605"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Categoría</label>
                  <select
                    value={groupId}
                    onChange={e => setGroupId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                    required
                  >
                    {gruposMenu.map(g => (
                      <option key={g.id} value={g.id}>{g.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Precio (MXN)</label>
                  <input
                    type="number"
                    value={precio}
                    onChange={e => setPrecio(e.target.value)}
                    className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-605 font-mono text-amber-500 font-bold"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Descripción</label>
                <textarea
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-605 h-20 resize-none"
                />
              </div>
            </div>
            
            <div className="flex flex-col items-center justify-center border border-zinc-800 rounded-2xl p-4 bg-black/20 space-y-3">
              <div className="w-28 h-28 bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800">
                <img src={imagenUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=100'} alt="" className="w-full h-full object-cover" />
              </div>
              <label className="bg-zinc-850 hover:bg-zinc-800 border border-zinc-700 text-white font-bold py-1.5 px-4 rounded-xl text-[10px] uppercase tracking-wider cursor-pointer">
                Subir Imagen
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => { if (e.target.files?.length) setImagenArchivo(e.target.files[0]) }}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-2 select-none">
            <input
              type="checkbox"
              checked={esUpsell}
              onChange={e => setEsUpsell(e.target.checked)}
              className="w-4 h-4 rounded bg-zinc-950 border border-zinc-800 text-amber-600 focus:ring-0 focus:ring-offset-0"
            />
            <span className="text-[10px] text-zinc-450 uppercase font-black">⭐ Recomendar en Venta Cruzada (Upsell Predictivo)</span>
          </label>

          {/* Sección de Modificadores Integrada (Estilo Rappi Partner) */}
          <div className="border-t border-zinc-850 pt-6 space-y-4">
            <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <span>📋 Modificadores de Producto</span>
              <span className="text-[9px] bg-amber-950/40 text-amber-400 border border-amber-900/50 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">Panel Unificado</span>
            </h3>
            
            <div className="bg-black/30 border border-zinc-850 rounded-2xl p-4 space-y-3">
              <p className="text-[9px] text-amber-500 font-black uppercase tracking-wider">Añadir Nuevo Grupo (ej: Elige tu Salsa / Ingredientes)</p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={nuevoModNombre}
                  onChange={e => setNuevoModNombre(e.target.value)}
                  placeholder="Ej: Elige tu Salsa"
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
                <label className="flex items-center gap-2 cursor-pointer bg-zinc-950 px-3 rounded-xl border border-zinc-800 text-[10px] text-zinc-400 font-bold uppercase tracking-wider select-none">
                  <input
                    type="checkbox"
                    checked={nuevoModRequerido}
                    onChange={e => setNuevoModRequerido(e.target.checked)}
                    className="accent-amber-500"
                  />
                  Obligatorio
                </label>
                <button
                  type="button"
                  onClick={crearModificador}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-widest transition-all"
                >
                  ➕ Crear
                </button>
              </div>
            </div>

            <div className="space-y-4 max-h-[30vh] overflow-y-auto pr-1">
              {cargandoMods ? (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-2 border-zinc-800 border-t-amber-500 rounded-full animate-spin" />
                </div>
              ) : modificadores.length === 0 ? (
                <p className="text-zinc-600 text-xs text-center py-4 font-bold uppercase tracking-wider">Sin modificadores en este platillo. Agrega uno arriba.</p>
              ) : (
                modificadores.map(mod => (
                  <div key={mod.id} className="bg-black/20 border border-zinc-850 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center border-b border-zinc-850 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">{mod.nombre}</span>
                        {mod.requerido && <span className="bg-red-950 text-red-500 border border-red-900 text-[8px] font-black px-2 py-0.5 rounded-full uppercase">Obligatorio</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => eliminarModificador(mod.id)}
                        className="text-red-500 hover:text-red-400 text-xs font-bold"
                      >
                        Eliminar Grupo
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {mod.modifier_options?.map((opt: any) => (
                        <div key={opt.id} className="flex justify-between items-center bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-900 text-xs font-mono">
                          <span className="text-zinc-300">{opt.nombre}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-amber-500 font-bold">+${Number(opt.precio_extra).toFixed(0)} MXN</span>
                            <button
                              type="button"
                              onClick={() => eliminarOpcion(opt.id)}
                              className="text-zinc-500 hover:text-red-500 transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-1.5 border-t border-dashed border-zinc-850">
                      <input
                        type="text"
                        value={nuevaOpcionNombre[mod.id] || ''}
                        onChange={e => setNuevaOpcionNombre(prev => ({ ...prev, [mod.id]: e.target.value }))}
                        placeholder="Ej: Salsa Habanera"
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                      />
                      <input
                        type="number"
                        value={nuevaOpcionPrecio[mod.id] || '0'}
                        onChange={e => setNuevaOpcionPrecio(prev => ({ ...prev, [mod.id]: e.target.value }))}
                        placeholder="+$"
                        className="w-16 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-center text-amber-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => agregarOpcion(mod.id)}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-3 py-1 rounded-lg text-xs"
                      >
                        ➕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-zinc-700 text-zinc-400 font-bold py-3 rounded-xl text-xs hover:border-zinc-500 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="flex-1 bg-gradient-to-r from-amber-600 to-amber-700 text-white font-black py-3 rounded-xl text-xs hover:brightness-110 transition-all disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : '💾 Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}