'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Papa from 'papaparse'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import {
  LayoutDashboard, Users, UtensilsCrossed, Map, Settings,
  UserCheck, TrendingUp, QrCode, UserPlus, MoreVertical,
  Menu as MenuIcon, ChevronLeft, ChevronRight, LogOut,
  RefreshCw, HelpCircle, Download, AlertTriangle, Clock, Loader2,
  FileSpreadsheet, Check, Plus, Trash2, DollarSign, Lock,
  PieChart as PieIcon, BarChart3 as BarIcon, PhoneCall,
  Smartphone, Radio, Pencil, Send,
  Star, Gift, CreditCard, ChevronDown, X, Check as CheckIcon,
  AlertCircle, Coffee, Cake, IceCream2, Copy, ExternalLink
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, PieChart, Pie, Cell, Legend
} from 'recharts'

// ── Interfaces ────────────────────────────────────────────────────────────────
interface Cliente {
  id: string; nombre: string; puntos: number; telefono: string;
  email?: string | null; fecha_nacimiento?: string | null; created_at: string
}
interface Historial {
  id: string; cliente_id: string; tipo_movimiento: string; cantidad: number
  created_at: string; descripcion: string; clientes: { nombre: string }
}
interface Business {
  id: string; nombre: string; slug: string; logo_url: string
  telefono_whatsapp: string; max_sellos: number; monto_minimo_sello: number
  estado: string; fecha_vencimiento: string; latitude: number; longitude: number
  direccion?: string; hora_apertura?: string; hora_cierre?: string
  banner_url?: string; moneda?: string; color_primario?: string
  nombre_contacto?: string; apellido_contacto?: string; telefono_empresa?: string
  reiniciar_sellos_ruleta?: boolean; premios_ruleta?: string[]
}
interface Recompensa {
  id?: string; nombre: string; estampillas_requeridas: number; estado: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const getCookieVal = (name: string) => {
  if (typeof document === 'undefined') return ''
  return document.cookie.match(new RegExp(`${name}=([^;]+)`))?.[1] || ''
}

// ── Sub-componente: Countdown Banner ─────────────────────────────────────────
function CountdownBanner({ business }: { business: Business }) {
  const [tiempo, setTiempo] = useState<{ dias: number; horas: number; minutos: number } | null>(null)
  useEffect(() => {
    const calcular = () => {
      const diff = new Date(business.fecha_vencimiento).getTime() - Date.now()
      if (diff <= 0) { setTiempo(null); return }
      setTiempo({ dias: Math.floor(diff / 86400000), horas: Math.floor((diff % 86400000) / 3600000), minutos: Math.floor((diff % 3600000) / 60000) })
    }
    calcular()
    const iv = setInterval(calcular, 60000)
    return () => clearInterval(iv)
  }, [business.fecha_vencimiento])

  if (!tiempo || tiempo.dias > 5) return null
  return (
    <div className={`w-full rounded-2xl p-4 border flex flex-col sm:flex-row items-center justify-between gap-3 ${
      tiempo.dias < 1 ? 'bg-red-50 border-red-200 animate-pulse' : 'bg-amber-50 border-amber-200'
    }`}>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-amber-600">⚠️ Suscripción por Vencer</p>
        <p className="text-sm text-[#52525b] mt-0.5">Renueva para no perder el acceso al sistema.</p>
      </div>
      <div className={`text-center px-4 py-1.5 rounded-xl font-bold font-mono text-base ${
        tiempo.dias < 1 ? 'text-red-600 bg-red-100' : 'text-amber-600 bg-amber-100'
      }`}>
        {tiempo.dias > 0 ? `${tiempo.dias}d ` : ''}{String(tiempo.horas).padStart(2, '0')}h : {String(tiempo.minutos).padStart(2, '0')}m
      </div>
    </div>
  )
}

// ── Sub-componente: Modal de Ajuste de Puntos ─────────────────────────────────
function ModalAjuste({ modal, motivo, setMotivo, guardando, onConfirmar, onCerrar }: any) {
  if (!modal) return null
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 border border-[#e4e4e7] animate-fadeIn">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[#09090b]">Ajuste Manual de Sellos</h3>
          <button onClick={onCerrar} className="w-7 h-7 rounded-full bg-[#fafafa] flex items-center justify-center hover:bg-[#f4f4f5]">
            <X className="w-4 h-4 text-[#71717a]" />
          </button>
        </div>
        <p className="text-sm text-[#52525b] mb-4">
          {modal.direccion === 'suma' ? '➕ Agregar' : '➖ Quitar'} 1 sello a <strong>{modal.nombre}</strong>
        </p>
        <div className="space-y-2 mb-5">
          <label className="text-xs font-semibold text-[#3f3f46] uppercase tracking-wide block">Motivo de Auditoría *</label>
          <input
            type="text"
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            className="input-clean text-sm"
            placeholder="Ej: Error en conteo, sello de cortesía..."
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onCerrar} className="flex-1 border border-[#e4e4e7] rounded-xl py-2.5 text-sm font-semibold text-[#52525b] hover:bg-[#fafafa] transition-colors">Cancelar</button>
          <button
            onClick={onConfirmar}
            disabled={!motivo.trim() || guardando}
            className="flex-1 btn-primary py-2.5 text-sm disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── DASHBOARD PRINCIPAL ───────────────────────────────────────────────────────
export default function DashboardPage() {
  // ── Tenant: slug extraído del subdominio vía rewrite del middleware ──────────
  const slug = (useParams().slug as string) || ''

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

  // ── CONFIGURACIÓN (Solo Empresa y Horarios) ──────────────────────────────────
  const [nombreNegocio, setNombreNegocio] = useState('')
  const [nombreContacto, setNombreContacto] = useState('')
  const [apellidoContacto, setApellidoContacto] = useState('')
  const [telefonoEmpresa, setTelefonoEmpresa] = useState('')
  const [guardandoConfig, setGuardandoConfig] = useState(false)
  const [guardandoHorarios, setGuardandoHorarios] = useState(false)

  // Horarios Estilo Rappi (Lunes a Domingo)
  const [horariosSemanales, setHorariosSemanales] = useState<any[]>([
    { dia_text: 'Lunes', abierto: true, apertura: '14:00', cierre: '22:00' },
    { dia_text: 'Martes', abierto: true, apertura: '14:00', cierre: '22:00' },
    { dia_text: 'Miércoles', abierto: true, apertura: '14:00', cierre: '22:00' },
    { dia_text: 'Jueves', abierto: true, apertura: '14:00', cierre: '22:00' },
    { dia_text: 'Viernes', abierto: true, apertura: '14:00', cierre: '22:00' },
    { dia_text: 'Sábado', abierto: true, apertura: '14:00', cierre: '22:00' },
    { dia_text: 'Domingo', abierto: true, apertura: '14:00', cierre: '22:00' },
  ])

  // ── REDES SOCIALES & WHATSAPP ───────────────────────────────────────────────
  const [linkFacebook, setLinkFacebook] = useState('')
  const [linkInstagram, setLinkInstagram] = useState('')
  const [linkTiktok, setLinkTiktok] = useState('')
  const [linkYoutube, setLinkYoutube] = useState('')
  const [whatsappNegocio, setWhatsappNegocio] = useState('')
  const [guardandoWhatsapp, setGuardandoWhatsapp] = useState(false)
  const [guardandoRedes, setGuardandoRedes] = useState(false)

  // ── MENÚ & QR ───────────────────────────────────────────────────────────────
  const [menuLocal, setMenuLocal] = useState<any>(null)
  const [menuDomicilio, setMenuDomicilio] = useState<any>(null)
  const [subiendoMenuLocal, setSubiendoMenuLocal] = useState(false)
  const [subiendoMenuDomicilio, setSubiendoMenuDomicilio] = useState(false)
  const [tipoQR, setTipoQR] = useState<'local' | 'domicilio'>('local')

  // ── SOCIOS VIP ──────────────────────────────────────────────────────────────
  const [sociosSospechosos, setSociosSospechosos] = useState<Record<string, boolean>>({})
  const [modalAjusteSocio, setModalAjusteSocio] = useState<{ id: string; nombre: string; puntos: number; direccion: 'suma' | 'resta' } | null>(null)
  const [motivoAjuste, setMotivoAjuste] = useState('')
  const [guardandoAjuste, setGuardandoAjuste] = useState(false)
  const [maxStamps, setMaxStamps] = useState('10')
  const [clienteSeleccionadoModal, setClienteSeleccionadoModal] = useState<Cliente | null>(null)

  // ── SOCIOS VIP EDICIÓN ──
  const [clienteAEditar, setClienteAEditar] = useState<Cliente | null>(null)
  const [editCliNombre, setEditCliNombre] = useState('')
  const [editCliTelefono, setEditCliTelefono] = useState('')
  const [editCliEmail, setEditCliEmail] = useState('')
  const [editCliFechaNacimiento, setEditCliFechaNacimiento] = useState('')
  const [guardandoEdicionCli, setGuardandoEdicionCli] = useState(false)

  // ── CONFIGURACIÓN GEOPUSH ──────────────────────────────────────────────────
  const [geoPushLat, setGeoPushLat] = useState(19.421583)
  const [geoPushLng, setGeoPushLng] = useState(-102.067222)
  const [geoPushRadius, setGeoPushRadius] = useState(500)
  const [geoPushMsg, setGeoPushMsg] = useState('¡Estás cerca de tu premio VIP! Pasa por tus sellos.')
  const [geoPushId, setGeoPushId] = useState<string | null>(null)
  const [guardandoGeoPush, setGuardandoGeoPush] = useState(false)

  // ── PROMEDIOS & GAMIFICACIÓN (Configuración de Ruleta) ──────────────────────
  const [premio1, setPremio1] = useState('Café Gratis')
  const [premio2, setPremio2] = useState('Postre Sorpresa')
  const [premio3, setPremio3] = useState('Bebida Grande')
  const [premio4, setPremio4] = useState('20% Descuento')
  const [reiniciarSellosAuto, setReiniciarSellosAuto] = useState(true)
  const [guardandoPromociones, setGuardandoPromociones] = useState(false)
  const [montoMinimoRuleta, setMontoMinimoRuleta] = useState('0')

  // ── RULETA INTERMEDIA (Gamificación por Rangos de Sellos) ───────────────────
  const [ruletaConfig, setRuletaConfig] = useState<any>({})
  const [nuevoSelloAct, setNuevoSelloAct] = useState('3')
  const [nuevoP1, setNuevoP1] = useState('')
  const [nuevoP2, setNuevoP2] = useState('')
  const [nuevoP3, setNuevoP3] = useState('')
  const [nuevoP4, setNuevoP4] = useState('')

  // ── EDICIÓN E IMÁGENES DE PROGRAMAS ──────────────────────────────────────────
  const [programaAEditar, setProgramaAEditar] = useState<any>(null)
  const [progLogoFile, setProgLogoFile] = useState<File | null>(null)
  const [progPortadaFile, setProgPortadaFile] = useState<File | null>(null)
  const [progLogoUrl, setProgLogoUrl] = useState('')
  const [progPortadaUrl, setProgPortadaUrl] = useState('')
  const [subiendoLogoProg, setSubiendoLogoProg] = useState(false)
  const [subiendoPortadaProg, setSubiendoPortadaProg] = useState(false)

  // ── IMPORTACIÓN MASIVA CSV ───────────────────────────────────────────────────
  const [mostrarImportador, setMostrarImportador] = useState(false)
  const [importando, setImportando] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importTotal, setImportTotal] = useState(0)
  const [importInsertados, setImportInsertados] = useState(0)
  const [importDuplicados, setImportDuplicados] = useState(0)
  const [importErrores, setImportErrores] = useState(0)
  const [importFinalizado, setImportFinalizado] = useState(false)
  const importFileRef = useRef<HTMLInputElement>(null)

  const importarClientesCSV = useCallback(async (files: FileList) => {
    const businessId = business?.id
    if (!businessId || importando) return
    setImportando(true)
    setImportFinalizado(false)
    setImportProgress(0)
    setImportTotal(0)
    setImportInsertados(0)
    setImportDuplicados(0)
    setImportErrores(0)

    // Parsear todos los archivos
    const todosLosClientes: { nombre: string; telefono: string }[] = []
    const promesas = Array.from(files).map(file => new Promise<void>(resolve => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          const rows = result.data as Record<string, string>[]
          rows.forEach(row => {
            const keys = Object.keys(row)
            const telKey = keys.find(k => /phone\s*1\s*-\s*value/i.test(k))
              || keys.find(k => /tel|phone|cel|numero|num|movil|móvil|whatsapp/i.test(k))
            const nomKey = keys.find(k => /family\s*name|apellido/i.test(k))
            if (!telKey) return
            const tel = (row[telKey] || '').toString().replace(/[^0-9]/g, '').slice(-10)
            const nom = nomKey ? (row[nomKey] || '').toString().trim() : ''
            if (tel.length === 10) {
              todosLosClientes.push({ nombre: nom || `Cliente ${tel}`, telefono: tel })
            }
          })
          resolve()
        },
        error: () => resolve()
      })
    }))
    await Promise.all(promesas)

    // Deduplicar por teléfono dentro del archivo
    const mapa = new Map<string, { nombre: string; telefono: string }>()
    todosLosClientes.forEach(c => { if (!mapa.has(c.telefono)) mapa.set(c.telefono, c) })
    const unicos = Array.from(mapa.values())
    setImportTotal(unicos.length)

    // Obtener teléfonos ya existentes en Supabase para este negocio
    const { data: existentes } = await supabase
      .from('clientes').select('telefono').eq('business_id', businessId)
    const telefonosExistentes = new Set((existentes || []).map((e: any) => e.telefono))

    const nuevos = unicos.filter(c => !telefonosExistentes.has(c.telefono))
    const duplicados = unicos.length - nuevos.length
    setImportDuplicados(duplicados)

    // Insertar en lotes de 200
    const BATCH = 200
    let insertados = 0
    let errores = 0
    for (let i = 0; i < nuevos.length; i += BATCH) {
      const lote = nuevos.slice(i, i + BATCH).map(c => ({
        business_id: businessId,
        nombre: c.nombre,
        telefono: c.telefono,
        puntos: 0,
        verificado: true,
      }))
      const { error } = await supabase.from('clientes').insert(lote)
      if (error) { errores += lote.length } else { insertados += lote.length }
      setImportProgress(i + BATCH)
      setImportInsertados(insertados)
      setImportErrores(errores)
      // Pequeña pausa para no saturar
      await new Promise(r => setTimeout(r, 150))
    }

    setImportando(false)
    setImportFinalizado(true)
    cargarClientes()
  }, [business, importando])

  // ── OPERACIÓN DE PREMIOS (CANJES) ───────────────────────────────────────────
  const [premiosCanjesList, setPremiosCanjesList] = useState<any[]>([])
  const [cargandoCanjes, setCargandoCanjes] = useState(false)

  // ── EMPLEADOS ───────────────────────────────────────────────────────────────
  const [empleados, setEmpleados] = useState<any[]>([])
  const [cargandoEmpleados, setCargandoEmpleados] = useState(false)
  const [nuevoEmpNombre, setNuevoEmpNombre] = useState('')
  const [nuevoEmpEmail, setNuevoEmpEmail] = useState('')
  const [nuevoEmpPin, setNuevoEmpPin] = useState('')
  const [nuevoEmpRol, setNuevoEmpRol] = useState('empleado')

  // Editar Empleado Modal State
  const [empleadoAEditar, setEmpleadoAEditar] = useState<any | null>(null)
  const [editEmpNombre, setEditEmpNombre] = useState('')
  const [editEmpEmail, setEditEmpEmail] = useState('')
  const [editEmpPin, setEditEmpPin] = useState('')
  const [editEmpRol, setEditEmpRol] = useState('empleado')
  const [guardandoEdicionEmp, setGuardandoEdicionEmp] = useState(false)

  // ── LEALTAD: Crear Tarjetas ─────────────────────────────────────────────────
  const [programas, setProgramas] = useState<any[]>([])
  const [mostrarCrearPrograma, setMostrarCrearPrograma] = useState(false)
  const [tipoSeleccionado, setTipoSeleccionado] = useState<'estampillas' | 'gift_card' | 'niveles' | null>(null)
  const [pasoLealtad, setPasoLealtad] = useState<'selector' | 'config' | 'recompensas'>('selector')

  // Config Estampillas
  const [nombreClub, setNombreClub] = useState('')
  const [maxDia, setMaxDia] = useState<string>('1')
  const [maxDiaOtro, setMaxDiaOtro] = useState('')
  const [totalSellos, setTotalSellos] = useState<string>('10')
  const [totalSellosOtro, setTotalSellosOtro] = useState('')
  const [precargadas, setPrecargadas] = useState<string>('0')
  const [precargadasOtro, setPrecargadasOtro] = useState('')
  const [comportamiento, setComportamiento] = useState<'sin_limite' | 'limitado' | 'reiniciar'>('sin_limite')
  const [guardandoPrograma, setGuardandoPrograma] = useState(false)

  // Recompensas Intermedias
  const [recompensas, setRecompensas] = useState<Recompensa[]>([])
  const [premioRapido, setPremioRapido] = useState<string | null>(null)
  const [premioNombreCustom, setPremioNombreCustom] = useState('')
  const [premioSellos, setPremioSellos] = useState<string>('3')
  const [premioSellosOtro, setPremioSellosOtro] = useState('')
  const [programaIdActivo, setProgramaIdActivo] = useState<string>('')

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  // ── useEffect ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const handlePrompt = (e: any) => { e.preventDefault(); setDeferredPrompt(e) }
    window.addEventListener('beforeinstallprompt', handlePrompt)
    const handleOutsideClick = (e: MouseEvent) => {
      if (quickToolsRef.current && !quickToolsRef.current.contains(e.target as Node)) setQuickToolsOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    // slug disponible tras hidratación → cargar datos del tenant correcto
    if (slug) cargarDatos()
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cargar Datos ─────────────────────────────────────────────────────────────
  const cargarDatos = async () => {
    // Guardia: esperar a que el slug esté disponible (hidratación del cliente)
    if (!slug) return
    setCargando(true)

    // ── Negocio: cargado por slug del subdominio (inyectado por el middleware) ──
    let bizData: Business | null = null
    const { data: biz } = await supabase
      .from('businesses')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
    if (biz) bizData = biz as Business

    if (bizData) {
      setBusiness(bizData)
      setNombreNegocio(bizData.nombre || '')
      setNombreContacto(bizData.nombre_contacto || '')
      setApellidoContacto(bizData.apellido_contacto || '')
      setTelefonoEmpresa(bizData.telefono_empresa || '')
      setMaxStamps(String(bizData.max_sellos || 10))
      setWhatsappNegocio(bizData.telefono_whatsapp || '')
      setLinkFacebook((bizData as any).link_facebook || '')
      setLinkInstagram((bizData as any).link_instagram || '')
      setLinkTiktok((bizData as any).link_tiktok || '')
      setLinkYoutube((bizData as any).link_youtube || '')

      const bId = bizData.id
      // Cargar Menús Digitales
      const { data: menus } = await supabase.from('menus_digitales').select('*').eq('business_id', bId)
      if (menus) {
        const local = menus.find((m: any) => m.tipo === 'local')
        const domicilio = menus.find((m: any) => m.tipo === 'domicilio')
        if (local) setMenuLocal(local)
        if (domicilio) setMenuDomicilio(domicilio)
      }

      // Cargar Programas de Lealtad
      const { data: progsData } = await supabase.from('programas_fidelidad').select('*').eq('business_id', bId)
      if (progsData) setProgramas(progsData)

      // Cargar Horarios Semanales, Geopush, Premios de Ruleta y Canjes
      await cargarHorariosSemanales(bId)
      await cargarGeoPush(bId)
      await cargarPremiosRuleta(bId)
      await cargarPremiosCanjes()
    }

    // Clientes
    const bizIdFinal = bizData?.id || ''
    let qCli = supabase.from('clientes').select('*').order('created_at', { ascending: false })
    if (bizIdFinal) qCli = qCli.eq('business_id', bizIdFinal)
    const { data: dataClientes } = await qCli
    if (dataClientes) {
      setClientes(dataClientes)
    }

    // Historial
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
          if (tiempos[i + 2] - tiempos[i] <= 5 * 60 * 1000) { sospechosos[cId] = true; break }
        }
      })
      setSociosSospechosos(sospechosos)
    }

    // Sellos pendientes
    if (bizIdFinal) {
      const { count } = await supabase.from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', bizIdFinal)
        .eq('sello_otorgado', true)
        .eq('sello_aprobado', false)
        .eq('sello_rechazado', false)
      setSellosPendientesCount(count || 0)
    }

    await cargarEmpleados(bizIdFinal)
    setCargando(false)
  }

  // ── cargarHorariosSemanales ──────────────────────────────────────────────────
  const cargarHorariosSemanales = async (bId: string) => {
    const { data } = await supabase
      .from('horarios_semanales')
      .select('*')
      .eq('sucursal_id', bId)
      .order('created_at', { ascending: true })
    
    if (data && data.length > 0) {
      const orden = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
      const cargados = orden.map(dia => {
        const match = data.find((h: any) => h.dia_text.toLowerCase() === dia.toLowerCase())
        return match ? {
          dia_text: dia,
          abierto: match.abierto,
          apertura: match.apertura.substring(0, 5),
          cierre: match.cierre.substring(0, 5)
        } : {
          dia_text: dia,
          abierto: true,
          apertura: '14:00',
          cierre: '22:00'
        }
      })
      setHorariosSemanales(cargados)
    }
  }

  // ── guardarHorariosSemanales ─────────────────────────────────────────────────
  const guardarHorariosSemanales = async () => {
    const businessId = getCookieVal('session_business_id') || business?.id
    if (!businessId) return
    setGuardandoHorarios(true)
    try {
      // Eliminar previos
      await supabase.from('horarios_semanales').delete().eq('sucursal_id', businessId)
      // Insertar nuevos
      const { error } = await supabase.from('horarios_semanales').insert(
        horariosSemanales.map(h => ({
          sucursal_id: businessId,
          dia_text: h.dia_text,
          abierto: h.abierto,
          apertura: h.apertura,
          cierre: h.cierre
        }))
      )
      if (error) throw error
      alert('✅ Horarios de servicio guardados exitosamente')
      cargarDatos()
    } catch (e: any) {
      alert('Error al guardar horarios: ' + e.message)
    } finally {
      setGuardandoHorarios(false)
    }
  }

  // ── cargarGeoPush ────────────────────────────────────────────────────────────
  const cargarGeoPush = async (bId: string) => {
    const { data } = await supabase
      .from('configuracion_geopush')
      .select('*')
      .eq('business_id', bId)
      .maybeSingle()
    
    if (data) {
      setGeoPushId(data.id)
      setGeoPushLat(Number(data.latitud))
      setGeoPushLng(Number(data.longitud))
      setGeoPushRadius(data.radio_metros)
      setGeoPushMsg(data.mensaje_push)
    }
  }

  // ── guardarGeoPush ───────────────────────────────────────────────────────────
  const guardarGeoPush = async () => {
    const businessId = getCookieVal('session_business_id') || business?.id
    if (!businessId) return
    setGuardandoGeoPush(true)
    try {
      const payload = {
        business_id: businessId,
        latitud: geoPushLat,
        longitud: geoPushLng,
        radio_metros: geoPushRadius,
        mensaje_push: geoPushMsg
      }
      let error
      if (geoPushId) {
        const { error: err } = await supabase
          .from('configuracion_geopush')
          .update(payload)
          .eq('id', geoPushId)
        error = err
      } else {
        const { data, error: err } = await supabase
          .from('configuracion_geopush')
          .insert(payload)
          .select()
          .single()
        error = err
        if (data) setGeoPushId(data.id)
      }
      if (error) throw error
      alert('✅ Configuración Geopush guardada con éxito')
      cargarDatos()
    } catch (e: any) {
      alert('Error al guardar Geopush: ' + e.message)
    } finally {
      setGuardandoGeoPush(false)
    }
  }

  // ── cargarPremiosRuleta ───────────────────────────────────────────────────────
  const cargarPremiosRuleta = async (bId: string) => {
    // 1. Cargar datos básicos de ruleta (que existen en todas las versiones)
    const { data } = await supabase
      .from('businesses')
      .select('premios_ruleta, reiniciar_sellos_ruleta')
      .eq('id', bId)
      .maybeSingle()
    
    if (data) {
      if (data.premios_ruleta && Array.isArray(data.premios_ruleta) && data.premios_ruleta.length >= 4) {
        setPremio1(data.premios_ruleta[0])
        setPremio2(data.premios_ruleta[1])
        setPremio3(data.premios_ruleta[2])
        setPremio4(data.premios_ruleta[3])
      }
      if (data.reiniciar_sellos_ruleta !== undefined && data.reiniciar_sellos_ruleta !== null) {
        setReiniciarSellosAuto(data.reiniciar_sellos_ruleta)
      }
    }

    // 2. Cargar de forma defensiva ruleta_config por si la columna no existe aún
    try {
      const { data: configData, error } = await supabase
        .from('businesses')
        .select('ruleta_config')
        .eq('id', bId)
        .maybeSingle()
      
      if (!error && configData && configData.ruleta_config) {
        setRuletaConfig(configData.ruleta_config)
      }
    } catch (err) {
      console.warn("La columna ruleta_config no está disponible en la base de datos.", err)
    }

    // 3. Cargar de forma defensiva monto_minimo_ruleta por si la columna no existe aún
    try {
      const { data: minData, error } = await supabase
        .from('businesses')
        .select('monto_minimo_ruleta')
        .eq('id', bId)
        .maybeSingle()
      
      if (!error && minData && minData.monto_minimo_ruleta !== undefined && minData.monto_minimo_ruleta !== null) {
        setMontoMinimoRuleta(String(minData.monto_minimo_ruleta))
      }
    } catch (err) {
      console.warn("La columna monto_minimo_ruleta no está disponible en la base de datos.", err)
    }
  }

  // ── guardarPremiosRuleta ──────────────────────────────────────────────────────
  const guardarPremiosRuleta = async () => {
    const businessId = getCookieVal('session_business_id') || business?.id
    if (!businessId) return
    setGuardandoPromociones(true)
    try {
      const arrPremios = [premio1.trim(), premio2.trim(), premio3.trim(), premio4.trim()]
      
      // Intentar actualizar todo incluyendo ruleta_config y monto_minimo_ruleta
      const { error } = await supabase
        .from('businesses')
        .update({
          premios_ruleta: arrPremios,
          reiniciar_sellos_ruleta: reiniciarSellosAuto,
          ruleta_config: ruletaConfig,
          monto_minimo_ruleta: parseFloat(montoMinimoRuleta) || 0
        } as any)
        .eq('id', businessId)
      
      if (error) throw error
      alert('✅ Configuración de Ruleta guardada con éxito')
      cargarDatos()
    } catch (e: any) {
      console.error(e)
      // Si la columna ruleta_config o monto_minimo_ruleta no existe en DB, guardar al menos la configuración básica
      if (e.message?.includes('ruleta_config') || e.message?.includes('monto_minimo_ruleta') || e.message?.includes('column "')) {
        try {
          const { error: errRetry } = await supabase
            .from('businesses')
            .update({
              premios_ruleta: [premio1.trim(), premio2.trim(), premio3.trim(), premio4.trim()],
              reiniciar_sellos_ruleta: reiniciarSellosAuto
            })
            .eq('id', businessId)
          if (errRetry) throw errRetry
          alert('✅ Configuración básica de Ruleta guardada con éxito.\n\n⚠️ NOTA: Los rangos intermedios y el monto mínimo no se guardaron porque las columnas no existen en la base de datos de Supabase. Por favor ejecuta la migración SQL.')
          cargarDatos()
        } catch (retryErr: any) {
          alert('Error al reintentar guardar configuración básica: ' + retryErr.message)
        }
      } else if (e.message?.includes('schema cache') || e.message?.includes('premios_ruleta')) {
        alert('⚠️ Error de Caché de Supabase:\n\nLas nuevas columnas o tablas aún no se han registrado correctamente en la caché de tu base de datos.\n\nPor favor, asegúrate de ejecutar la migración SQL y recargar la caché.')
      } else {
        alert('Error al guardar ruleta: ' + e.message)
      }
    } finally {
      setGuardandoPromociones(false)
    }
  }

  // ── Acciones de Ruleta Intermedia ──────────────────────────────────────────
  const agregarOActualizarRuletaIntermedia = () => {
    if (!nuevoP1.trim() || !nuevoP2.trim() || !nuevoP3.trim() || !nuevoP4.trim()) {
      alert('Por favor ingresa los 4 premios para esta ruleta intermedia.')
      return
    }
    const sellos = String(nuevoSelloAct)
    const premios = [nuevoP1.trim(), nuevoP2.trim(), nuevoP3.trim(), nuevoP4.trim()]
    
    setRuletaConfig((prev: any) => ({
      ...prev,
      [sellos]: {
        activo: true,
        premios
      }
    }))

    // Limpiar campos
    setNuevoP1('')
    setNuevoP2('')
    setNuevoP3('')
    setNuevoP4('')
    alert(`✅ Ruleta configurada temporalmente para ${sellos} sellos.\n\n⚠️ IMPORTANTE: Recuerda presionar el botón "Guardar Configuración de Ruleta" al final de la pestaña para salvar permanentemente los cambios en la base de datos.`)
  }

  const eliminarRuletaIntermedia = (sello: string) => {
    setRuletaConfig((prev: any) => {
      const copy = { ...prev }
      delete copy[sello]
      return copy
    })
    alert(`❌ Ruleta intermedia para ${sello} sellos eliminada temporalmente. Recuerda guardar cambios al final de la pestaña para confirmar.`)
  }

  // ── cargarPremiosCanjes ───────────────────────────────────────────────────────
  const cargarPremiosCanjes = async () => {
    setCargandoCanjes(true)
    const { data } = await supabase
      .from('premios_canjes')
      .select('*, clientes(nombre, telefono)')
      .order('creado_en', { ascending: false })
    
    if (data) setPremiosCanjesList(data)
    setCargandoCanjes(false)
  }

  // ── marcarEntregado ──────────────────────────────────────────────────────────
  const marcarEntregado = async (canjeId: string, nuevoEstado: string) => {
    try {
      const { error } = await supabase
        .from('premios_canjes')
        .update({ estado: nuevoEstado })
        .eq('id', canjeId)
      
      if (error) throw error
      alert(`✅ Premio marcado como: ${nuevoEstado}`)
      cargarPremiosCanjes()
    } catch (e: any) {
      alert('Error al actualizar estado: ' + e.message)
    }
  }

  // ── CRUD Empleados ────────────────────────────────────────────────────────────
  const cargarEmpleados = async (activeBizId?: string) => {
    const businessId = activeBizId || getCookieVal('session_business_id') || business?.id
    if (!businessId) return
    setCargandoEmpleados(true)
    const { data } = await supabase.from('business_users').select('*').eq('business_id', businessId).order('created_at', { ascending: false })
    if (data) setEmpleados(data)
    setCargandoEmpleados(false)
  }

  const agregarEmpleado = async (e: React.FormEvent) => {
    e.preventDefault()
    const businessId = getCookieVal('session_business_id') || business?.id
    if (!businessId || !nuevoEmpNombre.trim() || !nuevoEmpPin.trim()) return
    if (!/^\d{4}$/.test(nuevoEmpPin)) return alert('El PIN debe ser de exactamente 4 dígitos numéricos')
    const { error } = await supabase.from('business_users').insert({ business_id: businessId, nombre: nuevoEmpNombre.trim(), email: nuevoEmpEmail.trim().toLowerCase() || null, pin: nuevoEmpPin.trim(), rol: nuevoEmpRol, activo: true })
    if (error) alert('Error al agregar: ' + error.message)
    else { setNuevoEmpNombre(''); setNuevoEmpEmail(''); setNuevoEmpPin(''); alert('✅ Miembro del staff agregado'); cargarEmpleados() }
  }

  const eliminarEmpleado = async (id: string) => {
    if (!confirm('¿Eliminar a este miembro del staff permanentemente?')) return
    const { error } = await supabase.from('business_users').delete().eq('id', id)
    if (error) alert('Error: ' + error.message)
    else cargarEmpleados()
  }

  const abrirEditarEmpleado = (emp: any) => {
    setEmpleadoAEditar(emp)
    setEditEmpNombre(emp.nombre || '')
    setEditEmpEmail(emp.email || '')
    setEditEmpPin('')
    setEditEmpRol(emp.rol || 'empleado')
  }

  const guardarEdicionEmpleado = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empleadoAEditar || !editEmpNombre.trim()) return
    if (editEmpPin && !/^\d{4}$/.test(editEmpPin)) return alert('El PIN debe tener exactamente 4 dígitos')
    
    setGuardandoEdicionEmp(true)
    try {
      const payload: any = {
        nombre: editEmpNombre.trim(),
        email: editEmpEmail.trim().toLowerCase() || null,
        rol: editEmpRol
      }
      if (editEmpPin) payload.pin = editEmpPin.trim()
      
      const { error } = await supabase
        .from('business_users')
        .update(payload)
        .eq('id', empleadoAEditar.id)
      
      if (error) throw error
      alert('✅ Empleado modificado con éxito')
      setEmpleadoAEditar(null)
      cargarEmpleados()
    } catch (err: any) {
      alert('Error al editar: ' + err.message)
    } finally {
      setGuardandoEdicionEmp(false)
    }
  }

  // ── Guardar Config Empresa ────────────────────────────────────────────────────
  const guardarConfigEmpresa = async () => {
    const businessId = getCookieVal('session_business_id') || business?.id
    if (!businessId) return
    setGuardandoConfig(true)
    try {
      const { error } = await supabase.from('businesses').update({
        nombre: nombreNegocio.trim(),
        nombre_contacto: nombreContacto.trim(),
        apellido_contacto: apellidoContacto.trim(),
        telefono_empresa: telefonoEmpresa.trim(),
      } as any).eq('id', businessId)
      if (error) throw error
      alert('✅ Datos de empresa guardados')
      cargarDatos()
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setGuardandoConfig(false)
    }
  }

  // ── Guardar Redes Sociales ────────────────────────────────────────────────────
  const guardarRedes = async () => {
    const businessId = getCookieVal('session_business_id') || business?.id
    if (!businessId) return
    setGuardandoRedes(true)
    try {
      const { error } = await supabase.from('businesses').update({
        link_facebook: linkFacebook.trim(),
        link_instagram: linkInstagram.trim(),
        link_tiktok: linkTiktok.trim(),
        link_youtube: linkYoutube.trim(),
      } as any).eq('id', businessId)
      if (error) throw error
      alert('✅ Redes sociales guardadas')
      cargarDatos()
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setGuardandoRedes(false)
    }
  }

  const guardarWhatsapp = async () => {
    const businessId = getCookieVal('session_business_id') || business?.id
    if (!businessId) return
    setGuardandoWhatsapp(true)
    const cleanTel = whatsappNegocio.replace(/\D/g, '')
    const { error } = await supabase.from('businesses').update({ telefono_whatsapp: cleanTel }).eq('id', businessId)
    if (error) alert('Error: ' + error.message)
    else { alert('✅ WhatsApp guardado'); cargarDatos() }
    setWhatsappNegocio(cleanTel)
    setGuardandoWhatsapp(false)
  }

  const probarWhatsApp = () => {
    if (!whatsappNegocio) return alert('Ingresa primero el número de WhatsApp')
    const cleanTel = whatsappNegocio.replace(/\D/g, '')
    const msg = `*LoyaltyApp* 📲\n¡Tu conexión está activa! Sistema de notificaciones listo.`
    window.open(`https://wa.me/${cleanTel}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  // ── Menú Digital: Subir/Guardar ───────────────────────────────────────────────
  const guardarMenuDigital = async (tipo: 'local' | 'domicilio', file?: File | null, urlManual?: string) => {
    const businessId = getCookieVal('session_business_id') || business?.id
    if (!businessId) return
    tipo === 'local' ? setSubiendoMenuLocal(true) : setSubiendoMenuDomicilio(true)

    try {
      let archivoUrl = urlManual || ''

      if (file) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${businessId}/menu-${tipo}-${Date.now()}.${fileExt}`
        const { error: uploadErr } = await supabase.storage.from('menu-images').upload(fileName, file, { cacheControl: '3600', upsert: true, contentType: file.type || 'application/octet-stream' })
        if (uploadErr) throw uploadErr
        const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(fileName)
        archivoUrl = urlData.publicUrl
      }

      const menuExistente = tipo === 'local' ? menuLocal : menuDomicilio
      if (menuExistente) {
        await supabase.from('menus_digitales').update({
          archivo_url: archivoUrl || menuExistente.archivo_url,
          url_consumo_local: tipo === 'local' ? archivoUrl : menuExistente.url_consumo_local,
          url_domicilio: tipo === 'domicilio' ? archivoUrl : menuExistente.url_domicilio,
          updated_at: new Date().toISOString(),
        } as any).eq('id', menuExistente.id)
      } else {
        await supabase.from('menus_digitales').insert({
          business_id: businessId,
          tipo,
          nombre: tipo === 'local' ? 'Menú Consumo Aquí' : 'Menú Para Domicilio',
          archivo_url: archivoUrl,
          url_consumo_local: tipo === 'local' ? archivoUrl : null,
          url_domicilio: tipo === 'domicilio' ? archivoUrl : null,
          activo: true,
        } as any)
      }
      alert(`✅ Menú de ${tipo === 'local' ? 'Consumo Aquí' : 'Domicilio'} guardado`)
      cargarDatos()
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      tipo === 'local' ? setSubiendoMenuLocal(false) : setSubiendoMenuDomicilio(false)
    }
  }

  // ── Helpers para Edición de Programas ──────────────────────────────────────────
  const abrirEditarPrograma = (prog: any) => {
    setProgramaAEditar(prog)
    setNombreClub(prog.nombre_club || '')
    setTipoSeleccionado(prog.tipo_programa || 'estampillas')
    setTotalSellos(String(prog.total_estampillas || 10))
    setMaxDia(String(prog.estampillas_max_dia || 1))
    setComportamiento(prog.comportamiento_completado || 'sin_limite')
    setProgLogoUrl(prog.logo_url || '')
    setProgPortadaUrl(prog.portada_url || '')
    setProgLogoFile(null)
    setProgPortadaFile(null)
    
    setMostrarCrearPrograma(true)
    setPasoLealtad('config') // Ir directo a la configuración de campos
  }

  const abrirCrearPrograma = () => {
    setProgramaAEditar(null)
    setNombreClub('')
    setTipoSeleccionado('estampillas')
    setTotalSellos('10')
    setMaxDia('1')
    setComportamiento('sin_limite')
    setProgLogoUrl('')
    setProgPortadaUrl('')
    setProgLogoFile(null)
    setProgPortadaFile(null)
    
    setMostrarCrearPrograma(true)
    setPasoLealtad('selector')
  }

  // ── Guardar o Actualizar Programa de Estampillas ────────────────────────────────
  const guardarProgramaEstampillas = async () => {
    const businessId = getCookieVal('session_business_id') || business?.id
    if (!businessId || !nombreClub.trim()) return alert('Ingresa el nombre del club')
    setGuardandoPrograma(true)

    const maxDiaFinal = maxDia === 'otro' ? Number(maxDiaOtro || 1) : Number(maxDia)
    const totalFinal = totalSellos === 'otro' ? Number(totalSellosOtro || 10) : Number(totalSellos)
    const precargadasFinal = precargadas === 'otro' ? Number(precargadasOtro || 0) : Number(precargadas)

    try {
      let finalLogoUrl = progLogoUrl
      let finalPortadaUrl = progPortadaUrl

      // 1. Subir Logo si se ha seleccionado uno nuevo
      if (progLogoFile) {
        setSubiendoLogoProg(true)
        const fileExt = progLogoFile.name.split('.').pop()
        const fileName = `${businessId}/prog-logo-${Date.now()}.${fileExt}`
        const { error: uploadErr } = await supabase.storage.from('menu-images').upload(fileName, progLogoFile, { cacheControl: '3600', upsert: true })
        if (uploadErr) throw uploadErr
        const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(fileName)
        finalLogoUrl = urlData.publicUrl
        setProgLogoUrl(finalLogoUrl)
        setSubiendoLogoProg(false)
      }

      // 2. Subir Portada si se ha seleccionado una nueva
      if (progPortadaFile) {
        setSubiendoPortadaProg(true)
        const fileExt = progPortadaFile.name.split('.').pop()
        const fileName = `${businessId}/prog-portada-${Date.now()}.${fileExt}`
        const { error: uploadErr } = await supabase.storage.from('menu-images').upload(fileName, progPortadaFile, { cacheControl: '3600', upsert: true })
        if (uploadErr) throw uploadErr
        const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(fileName)
        finalPortadaUrl = urlData.publicUrl
        setProgPortadaUrl(finalPortadaUrl)
        setSubiendoPortadaProg(false)
      }

      // Payload estructurado
      const payload: any = {
        tipo_programa: tipoSeleccionado || 'estampillas',
        nombre_club: nombreClub.trim(),
        estampillas_max_dia: maxDiaFinal,
        total_estampillas: totalFinal,
        precargadas: precargadasFinal,
        comportamiento_completado: comportamiento,
        logo_url: finalLogoUrl || null,
        portada_url: finalPortadaUrl || null
      }

      if (programaAEditar) {
        // MODO EDICIÓN
        const { error } = await supabase
          .from('programas_fidelidad')
          .update(payload)
          .eq('id', programaAEditar.id)
        
        if (error) throw error
        alert('✅ Programa de fidelidad actualizado de forma exitosa')
        setMostrarCrearPrograma(false)
        setProgramaAEditar(null)
        cargarDatos()
      } else {
        // MODO CREACIÓN
        const { data: prog, error } = await supabase.from('programas_fidelidad').insert({
          business_id: businessId,
          ...payload
        }).select().single()

        if (error) throw error
        setProgramaIdActivo(prog.id)
        setPasoLealtad('recompensas')
      }
    } catch (e: any) {
      console.error(e)
      // Fallback defensivo si las columnas logo_url o portada_url no existen aún en base de datos
      if (e.message?.includes('logo_url') || e.message?.includes('portada_url') || e.message?.includes('column "logo_url" does not exist')) {
        try {
          const basicPayload = {
            tipo_programa: tipoSeleccionado || 'estampillas',
            nombre_club: nombreClub.trim(),
            estampillas_max_dia: maxDiaFinal,
            total_estampillas: totalFinal,
            precargadas: precargadasFinal,
            comportamiento_completado: comportamiento
          }
          if (programaAEditar) {
            const { error: errRetry } = await supabase
              .from('programas_fidelidad')
              .update(basicPayload)
              .eq('id', programaAEditar.id)
            if (errRetry) throw errRetry
            alert('✅ Programa básico actualizado de forma exitosa.\n\n⚠️ NOTA: El logo y la portada no se guardaron porque la columna "logo_url" o "portada_url" no existe en la base de datos de Supabase. Por favor ejecuta la migración SQL.')
            setMostrarCrearPrograma(false)
            setProgramaAEditar(null)
            cargarDatos()
          } else {
            const { data: prog, error: errRetry } = await supabase.from('programas_fidelidad').insert({
              business_id: businessId,
              ...basicPayload
            }).select().single()
            if (errRetry) throw errRetry
            setProgramaIdActivo(prog.id)
            setPasoLealtad('recompensas')
          }
        } catch (retryErr: any) {
          alert('Error al reintentar guardar programa básico: ' + retryErr.message)
        }
      } else if (e.message?.includes('schema cache') || e.message?.includes('activo')) {
        alert('⚠️ Error de Caché de Supabase:\n\nLas nuevas columnas o tablas aún no se han registrado correctamente en la caché de tu base de datos.')
      } else {
        alert('Error al guardar programa: ' + e.message)
      }
    } finally {
      setGuardandoPrograma(false)
      setSubiendoLogoProg(false)
      setSubiendoPortadaProg(false)
    }
  }

  const agregarRecompensa = async () => {
    const nombre = premioRapido === 'otro' ? premioNombreCustom.trim() : premioRapido
    if (!nombre) return alert('Selecciona o ingresa un nombre de recompensa')
    const sellosVal = premioSellos === 'otro' ? Number(premioSellosOtro || 3) : Number(premioSellos)
    const nuevaR: Recompensa = { nombre, estampillas_requeridas: sellosVal, estado: true }

    if (programaIdActivo) {
      const businessId = getCookieVal('session_business_id') || business?.id
      await supabase.from('recompensas').insert({ ...nuevaR, programa_id: programaIdActivo, business_id: businessId })
    }

    setRecompensas(prev => [...prev, nuevaR])
    setPremioRapido(null)
    setPremioNombreCustom('')
    setPremioSellos('3')
    setPremioSellosOtro('')
  }

  const eliminarRecompensa = (idx: number) => {
    setRecompensas(prev => prev.filter((_, i) => i !== idx))
  }

  const finalizarPrograma = () => {
    setMostrarCrearPrograma(false)
    setPasoLealtad('selector')
    setTipoSeleccionado(null)
    setNombreClub('')
    setRecompensas([])
    cargarDatos()
    alert('✅ Programa de lealtad creado exitosamente')
  }

  // ── Ajuste de Puntos ─────────────────────────────────────────────────────────
  const abrirModalAjuste = (clienteId: string, nombre: string, puntos: number, dir: 'suma' | 'resta') => {
    setModalAjusteSocio({ id: clienteId, nombre, puntos, direccion: dir })
    setMotivoAjuste('')
  }

  const ejecutarAjustePuntos = async () => {
    if (!modalAjusteSocio || !motivoAjuste.trim()) return alert('El motivo de auditoría es obligatorio')
    setGuardandoAjuste(true)
    const { id, puntos, direccion } = modalAjusteSocio
    const cantidad = direccion === 'suma' ? 1 : -1
    const nuevosPuntos = Math.max(0, Math.min(Number(maxStamps), puntos + cantidad))
    const adminUser = getCookieVal('session_user') || 'Administrador'
    const descripcion = `Ajuste manual: ${motivoAjuste.trim()} (Firma: ${adminUser})`
    await supabase.from('clientes').update({ puntos: nuevosPuntos }).eq('id', id)
    await supabase.from('historial_puntos').insert([{ cliente_id: id, tipo_movimiento: direccion, cantidad: 1, descripcion }])
    
    setMotivoAjuste('')
    setModalAjusteSocio(null)
    alert('✅ Sellos ajustados y auditoría registrada')
    cargarDatos()
    setGuardandoAjuste(false)
  }

  const eliminarCliente = async (id: string) => {
    if (!confirm('¿Eliminar este socio VIP definitivamente?')) return
    await supabase.from('clientes').delete().eq('id', id)
    cargarDatos()
  }

  const abrirEditarCliente = (c: Cliente) => {
    setClienteAEditar(c)
    setEditCliNombre(c.nombre || '')
    setEditCliTelefono(c.telefono || '')
    setEditCliEmail(c.email || '')
    setEditCliFechaNacimiento(c.fecha_nacimiento || '')
  }

  const guardarEdicionCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clienteAEditar) return
    if (!editCliNombre.trim() || !editCliTelefono.trim()) {
      alert('Nombre y teléfono son obligatorios')
      return
    }

    const telLimpio = editCliTelefono.replace(/\D/g, '')
    if (telLimpio.length !== 10) {
      alert('El teléfono debe tener exactamente 10 dígitos.')
      return
    }

    setGuardandoEdicionCli(true)
    try {
      const { error } = await supabase
        .from('clientes')
        .update({
          nombre: editCliNombre.trim(),
          telefono: telLimpio,
          email: editCliEmail.trim() || null,
          fecha_nacimiento: editCliFechaNacimiento || null
        })
        .eq('id', clienteAEditar.id)

      if (error) throw error

      alert('✅ Datos del socio actualizados exitosamente')
      setClienteAEditar(null)
      cargarDatos()
    } catch (err: any) {
      console.error('Error al editar cliente:', err)
      alert('Error al guardar cambios: ' + err.message)
    } finally {
      setGuardandoEdicionCli(false)
    }
  }

  const exportarCSV = () => {
    if (historial.length === 0) return alert('No hay transacciones para exportar')
    let csv = 'data:text/csv;charset=utf-8,ID,Socio,Tipo,Cantidad,Descripción,Fecha\n'
    historial.forEach(h => {
      csv += `"${h.id}","${h.clientes?.nombre || 'Socio'}","${h.tipo_movimiento}","${h.cantidad}","${h.descripcion}","${new Date(h.created_at).toLocaleString('es-MX')}"\n`
    })
    const link = document.createElement('a')
    link.setAttribute('href', encodeURI(csv))
    link.setAttribute('download', `LoyaltyApp-${business?.slug || 'comercio'}.csv`)
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
  }

  const cerrarSesion = () => {
    localStorage.clear()
    sessionStorage.clear()
    const sessionCookies = [
      'session_rol', 'session_user', 'session_business_id',
      'session_business_slug', 'session_branch_id', 'session_user_id'
    ]
    const base = '; path=/; SameSite=Strict'
    sessionCookies.forEach(name => { document.cookie = `${name}=; Max-Age=0${base}` })

    const isProduction = typeof window !== 'undefined' && window.location.hostname.includes('loyaltyclub.mx')
    const domainAttr = isProduction ? '; Domain=.loyaltyclub.mx' : ''
    const domainBase = `; path=/; SameSite=Lax${domainAttr}`
    sessionCookies.forEach(name => { document.cookie = `${name}=; Max-Age=0${domainBase}` })

    window.location.href = '/login'
  }

  const obtenerDatosVentas = () => {
    const dias: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      dias[d.toLocaleDateString('es-MX', { weekday: 'short' })] = 0
    }
    historial.forEach(h => {
      const k = new Date(h.created_at).toLocaleDateString('es-MX', { weekday: 'short' })
      if (dias[k] !== undefined && h.tipo_movimiento === 'suma') dias[k] += h.cantidad
    })
    return Object.entries(dias).map(([name, sellos]) => ({ name, Sellos: sellos, Estimado: sellos * 120 }))
  }

  const clientesAlLimite = clientes.filter(c => c.puntos >= Number(maxStamps) - 2)

  // 9 Standalone Navigation Tabs (Exactly matching request)
  const TABS_MAIN = [
    { id: 'metricas', label: 'Métricas', icon: LayoutDashboard },
    { id: 'configuracion', label: 'Configuración', icon: Settings },
    { id: 'redes', label: 'Redes y WhatsApp', icon: Smartphone },
    { id: 'menus', label: 'Gestión de Menús y QR', icon: QrCode },
    { id: 'geopush', label: 'Geopush', icon: Map },
    { id: 'lealtad', label: 'Tarjetas de Lealtad', icon: CreditCard },
    { id: 'promociones', label: 'Promociones (Ruleta)', icon: Gift },
    { id: 'premios', label: 'Premios (Canjes)', icon: Star },
    { id: 'empleados', label: 'Empleados', icon: Users },
  ]

  // Clientes VIP reales de la base de datos
  const clientesVIP = clientes

  // CSS utilities
  const IC = 'input-clean text-sm w-full bg-white border border-[#e4e4e7] rounded-xl px-4 py-2.5 text-[#09090b] focus:border-[#dc2626] focus:ring-1 focus:ring-[#dc2626] transition-all'
  const LBL = 'block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide mb-1.5'

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#09090b] flex font-sans">

      {/* ── Modal Ajuste ── */}
      <ModalAjuste
        modal={modalAjusteSocio}
        motivo={motivoAjuste}
        setMotivo={setMotivoAjuste}
        guardando={guardandoAjuste}
        onConfirmar={ejecutarAjustePuntos}
        onCerrar={() => setModalAjusteSocio(null)}
      />

      {/* ── SIDEBAR ── */}
      <aside className={`hidden md:flex flex-col bg-white border-r border-[#e4e4e7] transition-all duration-300 justify-between z-30 shrink-0 sticky top-0 h-screen shadow-[1px_0_0_#e4e4e7] ${sidebarExpanded ? 'w-64' : 'w-[72px]'}`}>
        <div className="flex flex-col">
          {/* Logo */}
          <div className="h-16 border-b border-[#e4e4e7] flex items-center justify-between px-4">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 bg-[#dc2626] rounded-lg flex items-center justify-center shadow-sm shrink-0">
                <Star className="w-4 h-4 text-white fill-white" />
              </div>
              {sidebarExpanded && (
                <span className="font-bold text-[#09090b] text-sm tracking-tight truncate">LoyaltyApp</span>
              )}
            </div>
            <button onClick={() => setSidebarExpanded(!sidebarExpanded)} className="text-[#a1a1aa] hover:text-[#52525b] transition-colors shrink-0">
              {sidebarExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Standalone Nav Link Group */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
            {TABS_MAIN.map(tab => {
              const TabIcon = tab.icon
              const isSelected = pestaña === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setPestaña(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium transition-all duration-150 ${
                    isSelected
                      ? 'bg-[#fef2f2] text-[#dc2626]'
                      : 'text-[#71717a] hover:bg-[#fafafa] hover:text-[#09090b]'
                  }`}
                >
                  <TabIcon className={`w-5 h-5 shrink-0 ${isSelected ? 'text-[#dc2626]' : 'text-[#a1a1aa]'}`} />
                  {sidebarExpanded && <span className="truncate">{tab.label}</span>}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Footer Sidebar */}
        <div className="p-3 border-t border-[#e4e4e7]">
          {deferredPrompt && (
            <button
              onClick={async () => { deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; if (outcome === 'accepted') setDeferredPrompt(null) }}
              className={`w-full btn-primary py-2.5 text-xs mb-2 flex items-center gap-1.5 justify-center`}
            >
              <Download className="w-4 h-4" />
              {sidebarExpanded && 'Instalar App'}
            </button>
          )}
          {sidebarExpanded && (
            <p className="text-center text-[#a1a1aa] text-[10px] mt-2">LoyaltyApp Enterprise v14</p>
          )}
        </div>
      </aside>

      {/* ── ÁREA PRINCIPAL ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── HEADER ── */}
        <header className="h-16 border-b border-[#e4e4e7] bg-white sticky top-0 z-20 px-6 flex items-center justify-between shadow-[0_1px_0_#e4e4e7]">
          <div className="min-w-0">
            <h1 className="text-base font-bold text-[#09090b] truncate">
              {business?.nombre || 'LoyaltyApp'}
              <span className="ml-2 text-xs font-normal text-[#a1a1aa]">Panel de Control</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/escaner">
              <button className="border border-[#e4e4e7] text-[#52525b] hover:text-[#09090b] font-medium py-2 px-3 rounded-xl text-xs hover:bg-[#fafafa] transition-all flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-[#dc2626]" />
                <span className="hidden md:inline whitespace-nowrap">Lector QR</span>
              </button>
            </Link>
            <Link href="/registro">
              <button className="btn-primary py-2 px-3 text-xs flex items-center gap-1.5">
                <UserPlus className="w-4 h-4" />
                <span className="hidden md:inline whitespace-nowrap">Registrar Socio</span>
              </button>
            </Link>
            {getCookieVal('session_rol') === 'superadmin' && (
              <Link href="/superadmin">
                <button className="border border-purple-200 text-purple-600 font-medium py-2 px-3 rounded-xl text-xs hover:bg-purple-50 transition-all">
                  👑 Superadmin
                </button>
              </Link>
            )}
            <div className="relative">
              <button onClick={() => setQuickToolsOpen(!quickToolsOpen)} className="w-9 h-9 rounded-xl border border-[#e4e4e7] hover:bg-[#fafafa] transition-colors flex items-center justify-center text-[#71717a] hover:text-[#09090b]">
                <MoreVertical className="w-4 h-4" />
              </button>
              {quickToolsOpen && (
                <div className="absolute right-0 mt-2 z-50 bg-white border border-[#e4e4e7] rounded-2xl shadow-xl overflow-hidden min-w-[200px] py-1">
                  <button onClick={() => { cerrarSesion(); setQuickToolsOpen(false) }} className="w-full px-4 py-3 text-left text-sm font-medium text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2">
                    <LogOut className="w-4 h-4" /> Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── CONTENIDO MAIN ── */}
        <main className="flex-1 p-6 space-y-6 overflow-y-auto pb-24 md:pb-6">
          {business && <CountdownBanner business={business} />}

          {/* ══════════════════════════════════════════
              PESTAÑA 1: MÉTRICAS
          ══════════════════════════════════════════ */}
          {pestaña === 'metricas' && (
            <div className="space-y-6 animate-fadeIn">
              {/* KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Sellos Hoy', valor: sellosHoy, icon: '⭐', color: 'text-amber-600' },
                  { label: 'Premios Canjeados', valor: premiosCanjeados, icon: '🎁', color: 'text-green-600' },
                  { label: 'Socios VIP', valor: clientesVIP.length, icon: '💳', color: 'text-[#dc2626]' },
                ].map((kpi, i) => (
                  <div key={i} className="bg-white border border-[#e4e4e7] rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-[#71717a] uppercase tracking-wide">{kpi.label}</p>
                      <span className="text-xl">{kpi.icon}</span>
                    </div>
                    <p className={`text-3xl font-bold font-mono ${kpi.color}`}>{kpi.valor}</p>
                  </div>
                ))}
              </div>

              {/* Pendientes */}
              {sellosPendientesCount > 0 && (
                <Link href="/dashboard/sellos-pendientes">
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition-all cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-amber-600" />
                      <div>
                        <p className="text-sm font-bold text-amber-700">{sellosPendientesCount} sello{sellosPendientesCount !== 1 ? 's' : ''} pendiente{sellosPendientesCount !== 1 ? 's' : ''} de validación</p>
                        <p className="text-xs text-amber-600 mt-0.5">Haz clic para validar pedidos</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-amber-500" />
                  </div>
                </Link>
              )}

              {/* Gráfica */}
              <div className="bg-white border border-[#e4e4e7] rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h3 className="text-sm font-bold text-[#09090b]">Rendimiento Semanal</h3>
                    <p className="text-xs text-[#71717a] mt-0.5">Sellos acumulados y estimado de ventas</p>
                  </div>
                  <button onClick={exportarCSV} className="border border-[#e4e4e7] text-[#52525b] hover:text-[#09090b] font-medium py-2 px-3 rounded-xl text-xs flex items-center gap-1.5 hover:bg-[#fafafa] transition-all">
                    <FileSpreadsheet className="w-4 h-4 text-green-500" /> Exportar CSV
                  </button>
                </div>
                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={obtenerDatosVentas()}>
                      <XAxis dataKey="name" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e4e4e7', borderRadius: '12px', color: '#09090b', fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Sellos" fill="#dc2626" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ── IMPORTADOR MASIVO CSV ── */}
              <div className="bg-white border border-[#e4e4e7] rounded-2xl overflow-hidden shadow-sm mb-4">
                <div
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-[#fafafa] transition-colors"
                  onClick={() => { setMostrarImportador(v => !v); setImportFinalizado(false) }}
                >
                  <div>
                    <h3 className="text-sm font-bold text-[#09090b] flex items-center gap-2">
                      <Download className="w-4 h-4 text-[#dc2626]" />
                      Importación Masiva de Clientes CSV
                    </h3>
                    <p className="text-xs text-[#71717a] mt-0.5">Sube uno o varios archivos .csv para registrar miles de socios de golpe</p>
                  </div>
                  <span className="text-lg">{mostrarImportador ? '▲' : '▼'}</span>
                </div>

                {mostrarImportador && (
                  <div className="border-t border-[#e4e4e7] p-6 space-y-5">

                    {/* Zona de carga */}
                    {!importando && !importFinalizado && (
                      <div>
                        <input
                          ref={importFileRef}
                          type="file"
                          accept=".csv"
                          multiple
                          hidden
                          onChange={e => { if (e.target.files?.length) importarClientesCSV(e.target.files) }}
                        />
                        <button
                          onClick={() => importFileRef.current?.click()}
                          className="w-full border-2 border-dashed border-[#e4e4e7] hover:border-[#dc2626] rounded-2xl p-10 flex flex-col items-center gap-3 transition-colors group"
                        >
                          <span className="text-4xl group-hover:scale-110 transition-transform">📂</span>
                          <span className="text-sm font-bold text-[#09090b]">Selecciona tus archivos CSV</span>
                          <span className="text-xs text-[#71717a]">Puedes seleccionar varios a la vez (Ctrl+clic)</span>
                          <span className="mt-2 px-5 py-2.5 bg-[#dc2626] text-white text-xs font-bold rounded-xl uppercase tracking-wider">Elegir Archivos</span>
                        </button>
                        <div className="mt-4 bg-[#fafafa] rounded-xl p-4 space-y-1.5">
                          <p className="text-xs font-bold text-[#52525b]">ℹ️ ¿Cómo funciona?</p>
                          <p className="text-xs text-[#71717a]">• Detecta automáticamente la columna de <strong>teléfono</strong> (10 dígitos) y de <strong>nombre</strong></p>
                          <p className="text-xs text-[#71717a]">• Omite teléfonos que ya estén registrados (sin duplicados)</p>
                          <p className="text-xs text-[#71717a]">• Inserta en lotes de 200 con barra de progreso en tiempo real</p>
                          <p className="text-xs text-[#71717a]">• Funciona con todos tus archivos <strong>"XXXX clientes la burreria.csv"</strong></p>
                        </div>
                      </div>
                    )}

                    {/* Progreso */}
                    {importando && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-[#09090b]">⏳ Importando clientes...</p>
                          <p className="text-xs font-mono text-[#dc2626] font-bold">{Math.min(importProgress, importTotal)} / {importTotal}</p>
                        </div>
                        <div className="w-full bg-[#f4f4f5] rounded-full h-3 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-[#dc2626] to-[#b91c1c] h-3 rounded-full transition-all duration-300"
                            style={{ width: importTotal > 0 ? `${Math.min(100, (importProgress / importTotal) * 100)}%` : '0%' }}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                            <p className="text-xl font-black text-green-600">{importInsertados}</p>
                            <p className="text-[10px] text-green-700 font-bold uppercase">Insertados</p>
                          </div>
                          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                            <p className="text-xl font-black text-amber-600">{importDuplicados}</p>
                            <p className="text-[10px] text-amber-700 font-bold uppercase">Duplicados</p>
                          </div>
                          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                            <p className="text-xl font-black text-red-600">{importErrores}</p>
                            <p className="text-[10px] text-red-700 font-bold uppercase">Errores</p>
                          </div>
                        </div>
                        <p className="text-xs text-[#71717a] text-center animate-pulse">No cierres esta página mientras se importa...</p>
                      </div>
                    )}

                    {/* Resultado final */}
                    {importFinalizado && (
                      <div className="space-y-4">
                        <div className="text-center py-4">
                          <div className="text-5xl mb-3">🎉</div>
                          <h4 className="text-lg font-black text-[#09090b]">¡Importación Completada!</h4>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                            <p className="text-2xl font-black text-green-600">{importInsertados}</p>
                            <p className="text-[10px] text-green-700 font-bold uppercase">Nuevos socios</p>
                          </div>
                          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                            <p className="text-2xl font-black text-amber-600">{importDuplicados}</p>
                            <p className="text-[10px] text-amber-700 font-bold uppercase">Ya existían</p>
                          </div>
                          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                            <p className="text-2xl font-black text-red-600">{importErrores}</p>
                            <p className="text-[10px] text-red-700 font-bold uppercase">Errores</p>
                          </div>
                        </div>
                        <button
                          onClick={() => { setImportFinalizado(false); setImportProgress(0) }}
                          className="w-full border border-[#e4e4e7] py-3 rounded-xl text-xs font-bold text-[#52525b] hover:bg-[#fafafa] transition-colors"
                        >
                          Importar más archivos
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* VIP Clients Table */}
              <div className="bg-white border border-[#e4e4e7] rounded-2xl overflow-hidden shadow-sm">
                <div className="p-5 border-b border-[#e4e4e7]">
                  <h3 className="text-sm font-bold text-[#09090b]">Tabla de Clientes VIP</h3>
                  <p className="text-xs text-[#71717a] mt-0.5">Haz clic sobre un cliente para ver su perfil y enviarle alertas directas</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#fafafa] border-b border-[#e4e4e7]">
                      <tr>
                        {['Socio VIP', 'Estado', 'Progreso de Sellos', 'Acciones'].map(h => (
                          <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-[#71717a] uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f4f4f5]">
                      {clientesVIP.map(c => {
                        const sospechoso = sociosSospechosos[c.id]
                        return (
                          <tr key={c.id} className="hover:bg-[#fafafa] transition-colors group cursor-pointer" onClick={() => setClienteSeleccionadoModal(c)}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-semibold text-[#09090b] group-hover:text-[#dc2626] transition-colors">{c.nombre}</div>
                              <div className="text-xs text-[#a1a1aa] font-mono mt-0.5">{c.telefono || 'Sin tel.'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {sospechoso ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 border border-red-200 text-red-600">
                                  <AlertTriangle className="w-3 h-3" /> Sospechoso
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-100 border border-green-200 text-green-700">
                                  <Check className="w-3 h-3" /> Verificado
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="w-24 h-1.5 bg-[#f4f4f5] rounded-full overflow-hidden">
                                  <div className="h-full bg-[#dc2626] rounded-full" style={{ width: `${Math.min((c.puntos / Number(maxStamps)) * 100, 100)}%` }} />
                                </div>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.puntos >= Number(maxStamps) ? 'bg-amber-100 text-amber-700' : 'bg-[#f4f4f5] text-[#71717a]'}`}>
                                  {c.puntos}/{maxStamps} ★
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-2">
                                <button onClick={() => abrirModalAjuste(c.id, c.nombre, c.puntos, 'resta')} className="w-8 h-8 rounded-lg border border-[#e4e4e7] hover:bg-[#fafafa] text-[#52525b] transition-colors flex items-center justify-center font-bold">−</button>
                                <button onClick={() => abrirModalAjuste(c.id, c.nombre, c.puntos, 'suma')} className="w-8 h-8 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] hover:bg-red-50 transition-colors flex items-center justify-center font-bold">+</button>
                                <button onClick={() => abrirEditarCliente(c)} className="w-8 h-8 rounded-lg border border-[#e4e4e7] hover:bg-[#fafafa] text-[#52525b] hover:text-[#dc2626] transition-colors flex items-center justify-center">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => eliminarCliente(c.id)} className="w-8 h-8 rounded-lg border border-[#e4e4e7] hover:bg-red-50 hover:border-red-200 text-[#a1a1aa] hover:text-red-500 transition-colors flex items-center justify-center">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Auditoría */}
              <div className="bg-white border border-[#e4e4e7] rounded-2xl overflow-hidden shadow-sm">
                <div className="p-5 border-b border-[#e4e4e7]">
                  <h3 className="text-sm font-bold text-[#09090b]">Auditoría de Movimientos</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#fafafa] border-b border-[#e4e4e7]">
                      <tr>
                        {['Socio', 'Tipo', 'Cantidad', 'Descripción', 'Fecha'].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[#71717a] uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f4f4f5]">
                      {historial.slice(0, 15).map(h => (
                        <tr key={h.id} className="hover:bg-[#fafafa] transition-colors">
                          <td className="px-5 py-3 font-medium text-[#09090b] whitespace-nowrap">{h.clientes?.nombre || 'Socio'}</td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${h.tipo_movimiento === 'suma' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                              {h.tipo_movimiento}
                            </span>
                          </td>
                          <td className="px-5 py-3 font-mono font-bold text-amber-600 whitespace-nowrap">{h.cantidad} ★</td>
                          <td className="px-5 py-3 text-[#71717a] max-w-xs truncate">{h.descripcion}</td>
                          <td className="px-5 py-3 text-[#a1a1aa] font-mono text-xs whitespace-nowrap">{new Date(h.created_at).toLocaleString('es-MX')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              PESTAÑA 2: CONFIGURACIÓN (Rappi Style)
          ══════════════════════════════════════════ */}
          {pestaña === 'configuracion' && (
            <div className="space-y-6 animate-fadeIn max-w-3xl">
              <div className="bg-white border border-[#e4e4e7] p-6 rounded-2xl shadow-sm space-y-6">
                <div>
                  <h3 className="font-bold text-[#09090b] mb-1">Información de la Empresa</h3>
                  <p className="text-xs text-[#71717a]">Configuración de identidad y contacto comercial</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={LBL}>Nombre comercial</label>
                    <input type="text" value={nombreNegocio} onChange={e => setNombreNegocio(e.target.value)} className={IC} placeholder="Ej: La Burrería" />
                  </div>
                  <div>
                    <label className={LBL}>Teléfono corporativo</label>
                    <input type="tel" value={telefonoEmpresa} onChange={e => setTelefonoEmpresa(e.target.value)} className={IC} placeholder="Ej: 3221234567" />
                  </div>
                  <div>
                    <label className={LBL}>Nombre del propietario</label>
                    <input type="text" value={nombreContacto} onChange={e => setNombreContacto(e.target.value)} className={IC} placeholder="Ej: Samuel" />
                  </div>
                  <div>
                    <label className={LBL}>Apellido del propietario</label>
                    <input type="text" value={apellidoContacto} onChange={e => setApellidoContacto(e.target.value)} className={IC} placeholder="Ej: Méndez" />
                  </div>
                </div>

                <button onClick={guardarConfigEmpresa} disabled={guardandoConfig} className="btn-primary py-3 px-6 text-sm">
                  {guardandoConfig ? 'Guardando...' : 'Guardar Información de Empresa'}
                </button>
              </div>

              {/* Horarios de Servicio Estilo Rappi */}
              <div className="bg-white border border-[#e4e4e7] p-6 rounded-2xl shadow-sm space-y-6">
                <div>
                  <h3 className="font-bold text-[#09090b] mb-1">Horarios de Servicio Estilo Rappi</h3>
                  <p className="text-xs text-[#71717a]">Configura de forma individual e independiente el horario de apertura y cierre para cada día de la semana.</p>
                </div>

                <div className="divide-y divide-[#f4f4f5] space-y-4">
                  {horariosSemanales.map((h, i) => (
                    <div key={h.dia_text} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 first:pt-0">
                      <div className="flex items-center gap-3">
                        {/* Checkbox / Switch */}
                        <input
                          type="checkbox"
                          checked={h.abierto}
                          onChange={e => {
                            const copy = [...horariosSemanales]
                            copy[i].abierto = e.target.checked
                            setHorariosSemanales(copy)
                          }}
                          className="w-5 h-5 accent-[#dc2626] rounded cursor-pointer"
                        />
                        <span className="font-bold text-sm text-[#09090b] w-24 block">{h.dia_text}</span>
                      </div>

                      {h.abierto ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={h.apertura}
                            onChange={e => {
                              const copy = [...horariosSemanales]
                              copy[i].apertura = e.target.value
                              setHorariosSemanales(copy)
                            }}
                            className="bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                            style={{ colorScheme: 'light' }}
                          />
                          <span className="text-[#a1a1aa] text-xs">a</span>
                          <input
                            type="time"
                            value={h.cierre}
                            onChange={e => {
                              const copy = [...horariosSemanales]
                              copy[i].cierre = e.target.value
                              setHorariosSemanales(copy)
                            }}
                            className="bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                            style={{ colorScheme: 'light' }}
                          />
                        </div>
                      ) : (
                        <span className="text-red-500 font-semibold text-xs py-2 bg-red-50 px-3 rounded-lg">Cerrado / No Disponible</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-[#f4f4f5]">
                  <button onClick={guardarHorariosSemanales} disabled={guardandoHorarios} className="btn-primary py-3 px-6 text-sm">
                    {guardandoHorarios ? 'Guardando horarios...' : 'Guardar Horarios Semanales'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              PESTAÑA 3: REDES SOCIALES & WHATSAPP
          ══════════════════════════════════════════ */}
          {pestaña === 'redes' && (
            <div className="space-y-6 animate-fadeIn max-w-3xl">
              <div className="bg-white border border-[#e4e4e7] p-6 rounded-2xl shadow-sm space-y-6">
                <div>
                  <h3 className="font-bold text-[#09090b] mb-1">Redes Sociales</h3>
                  <p className="text-xs text-[#71717a]">Configura los enlaces que los clientes verán en el portal móvil.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={LBL}>📘 Facebook URL</label>
                    <input type="url" value={linkFacebook} onChange={e => setLinkFacebook(e.target.value)} className={IC} placeholder="https://facebook.com/tu-negocio" />
                  </div>
                  <div>
                    <label className={LBL}>📷 Instagram URL</label>
                    <input type="url" value={linkInstagram} onChange={e => setLinkInstagram(e.target.value)} className={IC} placeholder="https://instagram.com/tu-negocio" />
                  </div>
                  <div>
                    <label className={LBL}>🎵 TikTok URL</label>
                    <input type="url" value={linkTiktok} onChange={e => setLinkTiktok(e.target.value)} className={IC} placeholder="https://tiktok.com/@tu-negocio" />
                  </div>
                  <div>
                    <label className={LBL}>▶️ YouTube URL</label>
                    <input type="url" value={linkYoutube} onChange={e => setLinkYoutube(e.target.value)} className={IC} placeholder="https://youtube.com/@tu-negocio" />
                  </div>
                </div>

                <button onClick={guardarRedes} disabled={guardandoRedes} className="btn-primary py-3 px-6 text-sm">
                  {guardandoRedes ? 'Guardando...' : 'Guardar Enlaces de Redes'}
                </button>
              </div>

              {/* WhatsApp Corporativo con validación y prueba aislada */}
              <div className="bg-white border border-[#e4e4e7] p-6 rounded-2xl shadow-sm space-y-6">
                <div>
                  <h3 className="font-bold text-[#09090b] mb-1">WhatsApp de Contacto y Alertas</h3>
                  <p className="text-xs text-[#71717a]">Número de WhatsApp que interactuará con el cliente (con código de país ej: 521...).</p>
                </div>

                <div className="flex gap-3">
                  <input
                    type="text"
                    value={whatsappNegocio}
                    onChange={e => setWhatsappNegocio(e.target.value.replace(/\D/g, ''))}
                    className={IC + ' flex-1'}
                    placeholder="5213221234567"
                  />
                  <button onClick={guardarWhatsapp} disabled={guardandoWhatsapp} className="btn-primary py-3 px-6 text-sm whitespace-nowrap">
                    {guardandoWhatsapp ? 'Guardando...' : 'Guardar WhatsApp'}
                  </button>
                  <button
                    onClick={probarWhatsApp}
                    className="border border-green-200 bg-green-50 hover:bg-green-100 text-green-700 font-semibold py-3 px-5 rounded-xl text-sm flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <PhoneCall className="w-4 h-4" /> Probar
                  </button>
                </div>

                {whatsappNegocio && (
                  <div className="flex items-center gap-2.5 p-3 bg-green-50 border border-green-200 rounded-xl">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <p className="text-xs text-green-700 leading-normal">
                      Enlace de prueba configurado hacia: <a href={`https://wa.me/${whatsappNegocio}`} target="_blank" rel="noreferrer" className="underline font-bold">wa.me/{whatsappNegocio}</a>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              PESTAÑA 4: GESTIÓN DE MENÚS Y QR
          ══════════════════════════════════════════ */}
          {pestaña === 'menus' && (
            <div className="space-y-6 animate-fadeIn max-w-3xl">
              <div className="bg-white border border-[#e4e4e7] p-6 rounded-2xl shadow-sm space-y-6">
                <div>
                  <h3 className="font-bold text-[#09090b] mb-1">Cargar Menús y Enlaces Públicos</h3>
                  <p className="text-xs text-[#71717a]">Configura dos menús independientes (Mesa local vs Domicilio) y visualiza el link público autogenerado.</p>
                </div>

                {/* Tabs menú */}
                <div className="flex gap-2 border-b border-[#f4f4f5] pb-4">
                  {[
                    { id: 'local', label: '🍽️ Consumo en Mesa / Local' },
                    { id: 'domicilio', label: '🛵 Para Domicilio' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setTipoQR(tab.id as any)}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition-all border ${
                        tipoQR === tab.id ? 'bg-[#fef2f2] border-[#dc2626] text-[#dc2626]' : 'bg-white border-[#e4e4e7] text-[#71717a] hover:bg-[#fafafa]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Menú local */}
                {tipoQR === 'local' && (
                  <div className="space-y-4">
                    <div>
                      <label className={LBL}>Cargar Menú Local (PDF/Imagen)</label>
                      <div
                        onClick={() => document.getElementById('menu-local-file')?.click()}
                        className="border-2 border-dashed border-[#e4e4e7] hover:border-[#dc2626] rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors hover:bg-[#fafafa]"
                      >
                        {subiendoMenuLocal ? (
                          <div className="w-6 h-6 border-2 border-[#e4e4e7] border-t-[#dc2626] rounded-full animate-spin" />
                        ) : (
                          <div className="text-center space-y-1">
                            <span className="text-3xl block">📁</span>
                            <span className="text-sm font-semibold text-[#52525b]">Subir Menú de Mesa</span>
                            <p className="text-xs text-[#a1a1aa]">PDF, JPG o PNG hasta 10MB</p>
                          </div>
                        )}
                      </div>
                      <input id="menu-local-file" type="file" accept="image/*,application/pdf" hidden onChange={e => { if (e.target.files?.[0]) guardarMenuDigital('local', e.target.files[0]) }} />
                    </div>

                    {/* O ingresar URL manual */}
                    <div className="bg-[#fafafa] border border-[#e4e4e7] p-5 rounded-2xl space-y-3">
                      <label className={LBL}>O ingresa el enlace web de tu menú local manualmente (ej: de Canva o Google Drive)</label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={menuLocal?.archivo_url || ''}
                          onChange={e => {
                            const val = e.target.value
                            setMenuLocal((prev: any) => prev ? { ...prev, archivo_url: val } : { archivo_url: val, tipo: 'local' })
                          }}
                          className={IC + ' flex-1 bg-white'}
                          placeholder="https://canva.com/design/... o https://drive.google.com/..."
                        />
                        <button
                          onClick={() => guardarMenuDigital('local', null, menuLocal?.archivo_url)}
                          className="btn-primary px-4 py-2 text-xs font-bold whitespace-nowrap"
                        >
                          Guardar Enlace
                        </button>
                      </div>
                    </div>

                    {menuLocal?.archivo_url && (
                      <div className="bg-[#fafafa] border border-[#e4e4e7] p-5 rounded-2xl space-y-4">
                        <div>
                          <label className={LBL}>Link URL Público Generado</label>
                          <div className="flex gap-2">
                            <input type="text" readOnly value={menuLocal.archivo_url} className="input-clean text-xs flex-1 bg-white border border-[#e4e4e7] rounded-xl px-3 py-2 text-[#71717a] select-all" />
                            <button onClick={() => { navigator.clipboard.writeText(menuLocal.archivo_url); alert('✅ URL de Menú Local copiado al portapapeles!') }} className="border border-[#e4e4e7] px-4 rounded-xl text-xs font-bold text-[#52525b] hover:bg-white transition-colors">Copiar Enlace</button>
                          </div>
                        </div>

                        {/* Generar QR preview */}
                        <div className="flex flex-col items-center gap-3 pt-3">
                          <p className="text-xs font-bold text-[#52525b] uppercase tracking-wide">Código QR - Consumo en Mesa</p>
                          <div className="bg-white p-3 rounded-2xl border border-[#e4e4e7]">
                            <QRCodeSVG value={menuLocal.archivo_url} size={150} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Menú domicilio */}
                {tipoQR === 'domicilio' && (
                  <div className="space-y-4">
                    <div>
                      <label className={LBL}>Cargar Menú Domicilio (PDF/Imagen)</label>
                      <div
                        onClick={() => document.getElementById('menu-domicilio-file')?.click()}
                        className="border-2 border-dashed border-[#e4e4e7] hover:border-[#dc2626] rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors hover:bg-[#fafafa]"
                      >
                        {subiendoMenuDomicilio ? (
                          <div className="w-6 h-6 border-2 border-[#e4e4e7] border-t-[#dc2626] rounded-full animate-spin" />
                        ) : (
                          <div className="text-center space-y-1">
                            <span className="text-3xl block">📁</span>
                            <span className="text-sm font-semibold text-[#52525b]">Subir Menú de Domicilio</span>
                            <p className="text-xs text-[#a1a1aa]">PDF, JPG o PNG hasta 10MB</p>
                          </div>
                        )}
                      </div>
                      <input id="menu-domicilio-file" type="file" accept="image/*,application/pdf" hidden onChange={e => { if (e.target.files?.[0]) guardarMenuDigital('domicilio', e.target.files[0]) }} />
                    </div>

                    {/* O ingresar URL manual */}
                    <div className="bg-[#fafafa] border border-[#e4e4e7] p-5 rounded-2xl space-y-3">
                      <label className={LBL}>O ingresa el enlace web de tu menú de domicilio manualmente (ej: de Canva o Google Drive)</label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={menuDomicilio?.archivo_url || ''}
                          onChange={e => {
                            const val = e.target.value
                            setMenuDomicilio((prev: any) => prev ? { ...prev, archivo_url: val } : { archivo_url: val, tipo: 'domicilio' })
                          }}
                          className={IC + ' flex-1 bg-white'}
                          placeholder="https://canva.com/design/... o https://drive.google.com/..."
                        />
                        <button
                          onClick={() => guardarMenuDigital('domicilio', null, menuDomicilio?.archivo_url)}
                          className="btn-primary px-4 py-2 text-xs font-bold whitespace-nowrap"
                        >
                          Guardar Enlace
                        </button>
                      </div>
                    </div>

                    {menuDomicilio?.archivo_url && (
                      <div className="bg-[#fafafa] border border-[#e4e4e7] p-5 rounded-2xl space-y-4">
                        <div>
                          <label className={LBL}>Link URL Público Generado</label>
                          <div className="flex gap-2">
                            <input type="text" readOnly value={menuDomicilio.archivo_url} className="input-clean text-xs flex-1 bg-white border border-[#e4e4e7] rounded-xl px-3 py-2 text-[#71717a] select-all" />
                            <button onClick={() => { navigator.clipboard.writeText(menuDomicilio.archivo_url); alert('✅ URL de Menú Domicilio copiado!') }} className="border border-[#e4e4e7] px-4 rounded-xl text-xs font-bold text-[#52525b] hover:bg-white transition-colors">Copiar Enlace</button>
                          </div>
                        </div>

                        <div className="flex flex-col items-center gap-3 pt-3">
                          <p className="text-xs font-bold text-[#52525b] uppercase tracking-wide">Código QR - Domicilio</p>
                          <div className="bg-white p-3 rounded-2xl border border-[#e4e4e7]">
                            <QRCodeSVG value={menuDomicilio.archivo_url} size={150} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              PESTAÑA 5: GEOPUSH (MÓDULO RESTAURADO)
          ══════════════════════════════════════════ */}
          {pestaña === 'geopush' && (
            <div className="space-y-6 animate-fadeIn max-w-3xl">
              <div className="bg-white border border-[#e4e4e7] p-6 rounded-2xl shadow-sm space-y-6">
                <div>
                  <h3 className="font-bold text-[#09090b] mb-1">Módulo Geopush Restaurado</h3>
                  <p className="text-xs text-[#71717a]">Geocerca virtual perimetral y notificaciones a corta distancia</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={LBL}>Latitud de Sucursal</label>
                    <input type="number" step="any" value={geoPushLat} onChange={e => setGeoPushLat(Number(e.target.value))} className={IC} />
                  </div>
                  <div>
                    <label className={LBL}>Longitud de Sucursal</label>
                    <input type="number" step="any" value={geoPushLng} onChange={e => setGeoPushLng(Number(e.target.value))} className={IC} />
                  </div>
                </div>

                {/* Google Maps Iframe interactivo sin errores */}
                <div className="space-y-2">
                  <label className={LBL}>Mapa Interactivo de Google Maps (Preview)</label>
                  <iframe
                    width="100%"
                    height="280"
                    src={`https://maps.google.com/maps?q=${geoPushLat},${geoPushLng}&z=15&output=embed`}
                    className="rounded-2xl border border-[#e4e4e7] shadow-sm bg-[#fafafa]"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                  ></iframe>
                </div>

                {/* Slider para metros del radio perimetral */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className={LBL}>Radio Perimetral del Geofence</label>
                    <span className="text-xs font-bold text-[#dc2626] font-mono">{geoPushRadius} metros</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="3000"
                    step="50"
                    value={geoPushRadius}
                    onChange={e => setGeoPushRadius(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#f4f4f5] rounded-lg appearance-none cursor-pointer accent-[#dc2626]"
                  />
                  <div className="flex justify-between text-[10px] text-[#a1a1aa] font-bold">
                    <span>50m</span>
                    <span>1500m</span>
                    <span>3000m</span>
                  </div>
                </div>

                {/* Lockscreen text */}
                <div>
                  <label className={LBL}>Mensaje de Alerta Push Lockscreen</label>
                  <textarea
                    rows={3}
                    value={geoPushMsg}
                    onChange={e => setGeoPushMsg(e.target.value)}
                    className="input-clean text-sm w-full bg-white border border-[#e4e4e7] rounded-xl px-4 py-2.5 text-[#09090b] focus:border-[#dc2626] transition-all resize-none"
                    placeholder="Escribe el mensaje corto que aparecerá en el celular del cliente cuando camine cerca..."
                  />
                </div>

                <div className="pt-2">
                  <button onClick={guardarGeoPush} disabled={guardandoGeoPush} className="btn-primary py-3 px-6 text-sm">
                    {guardandoGeoPush ? 'Guardando Geopush...' : 'Guardar Configuración Geopush'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              PESTAÑA 6: TARJETAS DE LEALTAD
          ══════════════════════════════════════════ */}
          {pestaña === 'lealtad' && (
            <div className="space-y-6 animate-fadeIn max-w-3xl">
              <div className="bg-white border border-[#e4e4e7] p-6 rounded-2xl shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-[#09090b]">Diseño de Programas y Estampillas</h3>
                    <p className="text-xs text-[#71717a]">Administración de fidelidad con Schema Cache activo mapeado</p>
                  </div>
                  {!mostrarCrearPrograma && (
                    <button onClick={abrirCrearPrograma} className="btn-primary py-2.5 px-4 text-xs flex items-center gap-1.5">
                      <Plus className="w-4 h-4" /> Crear Programa
                    </button>
                  )}
                </div>

                {programas.length > 0 && !mostrarCrearPrograma && (
                  <div className="space-y-3">
                    {programas.map((prog: any) => (
                      <div key={prog.id} className="bg-[#fafafa] border border-[#e4e4e7] p-4 rounded-xl flex items-center justify-between hover:border-amber-200 transition-colors">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                              prog.tipo_programa === 'gift_card' ? 'bg-purple-100 text-purple-700' :
                              prog.tipo_programa === 'niveles' ? 'bg-blue-100 text-blue-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {prog.tipo_programa === 'gift_card' ? '🎁 Tarjeta de Regalo' :
                               prog.tipo_programa === 'niveles' ? '🏆 Visitas / Niveles' :
                               '⭐ Estampillas'}
                            </span>
                            {prog.activo && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full">Activo</span>}
                          </div>
                          <p className="font-semibold text-sm text-[#09090b]">{prog.nombre_club}</p>
                          <p className="text-xs text-[#71717a] mt-0.5">
                            {prog.tipo_programa === 'gift_card' ? 'Saldo digital recargable' :
                             prog.tipo_programa === 'niveles' ? `${prog.total_estampillas} visitas meta · Máx ${prog.estampillas_max_dia} al día` :
                             `${prog.total_estampillas} sellos requeridos · Máx ${prog.estampillas_max_dia} al día`}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => abrirEditarPrograma(prog)} className="w-8 h-8 rounded-lg border border-[#e4e4e7] hover:bg-[#fafafa] text-[#52525b] hover:text-[#dc2626] transition-colors flex items-center justify-center" title="Editar Programa">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Flujo interno para crear programa */}
                {mostrarCrearPrograma && (
                  <div className="border border-[#e4e4e7] rounded-xl p-5 space-y-5 animate-slideUp">
                    <div className="flex justify-between items-center border-b border-[#f4f4f5] pb-3">
                      <h4 className="font-bold text-sm text-[#09090b]">
                        {tipoSeleccionado === 'gift_card' ? 'Nueva Tarjeta de Regalo / Monedero' :
                         tipoSeleccionado === 'niveles' ? 'Nuevo Programa de Visitas / Niveles' :
                         'Nuevo Programa de Estampillas'}
                      </h4>
                      <button onClick={() => setMostrarCrearPrograma(false)} className="text-[#a1a1aa] hover:text-[#71717a]"><X className="w-4 h-4" /></button>
                    </div>

                    {pasoLealtad === 'selector' && (
                      <div className="space-y-4">
                        <p className="text-xs text-[#71717a]">Selecciona el tipo de tarjeta/programa de lealtad que deseas configurar:</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div
                            onClick={() => { setTipoSeleccionado('estampillas'); setPasoLealtad('config') }}
                            className="border border-[#e4e4e7] hover:border-[#dc2626] hover:bg-[#fef2f2] p-4 rounded-xl cursor-pointer hover:shadow-sm transition-all text-center flex flex-col items-center justify-center space-y-2 group"
                          >
                            <span className="w-10 h-10 rounded-full bg-[#fef2f2] group-hover:bg-[#fde2e2] flex items-center justify-center text-xl">⭐</span>
                            <p className="font-bold text-xs text-[#09090b] group-hover:text-[#dc2626]">Tarjeta de Estampillas</p>
                            <p className="text-[10px] text-[#71717a]">Acumula sellos en consumos para obtener un premio mayor o intermedios.</p>
                          </div>

                          <div
                            onClick={() => { setTipoSeleccionado('niveles'); setPasoLealtad('config') }}
                            className="border border-[#e4e4e7] hover:border-blue-600 hover:bg-blue-50 p-4 rounded-xl cursor-pointer hover:shadow-sm transition-all text-center flex flex-col items-center justify-center space-y-2 group"
                          >
                            <span className="w-10 h-10 rounded-full bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center text-xl">🏆</span>
                            <p className="font-bold text-xs text-[#09090b] group-hover:text-blue-600">Visitas / Niveles VIP</p>
                            <p className="text-[10px] text-[#71717a]">Premia a tus socios según la frecuencia de visitas o niveles VIP alcanzados.</p>
                          </div>

                          <div
                            onClick={() => { setTipoSeleccionado('gift_card'); setPasoLealtad('config') }}
                            className="border border-[#e4e4e7] hover:border-purple-600 hover:bg-purple-50 p-4 rounded-xl cursor-pointer hover:shadow-sm transition-all text-center flex flex-col items-center justify-center space-y-2 group"
                          >
                            <span className="w-10 h-10 rounded-full bg-purple-50 group-hover:bg-purple-100 flex items-center justify-center text-xl">🎁</span>
                            <p className="font-bold text-xs text-[#09090b] group-hover:text-purple-650">Gift Card / Regalo</p>
                            <p className="text-[10px] text-[#71717a]">Permite a los socios acumular o recargar saldo prepagado digital para canjes.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {pasoLealtad === 'config' && (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Columna Izquierda: Formulario (7/12) */}
                        <div className="lg:col-span-7 space-y-4">
                          <div>
                            <label className={LBL}>Nombre del Club</label>
                            <input type="text" value={nombreClub} onChange={e => setNombreClub(e.target.value)} className={IC} placeholder="Ej: Club La Burrería VIP" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className={LBL}>Sellos Totales</label>
                              <select value={totalSellos} onChange={e => setTotalSellos(e.target.value)} className={IC}>
                                <option value="6">6 sellos</option>
                                <option value="8">8 sellos</option>
                                <option value="10">10 sellos</option>
                                <option value="12">12 sellos</option>
                              </select>
                            </div>
                            <div>
                              <label className={LBL}>Sellos Max Diarios</label>
                              <select value={maxDia} onChange={e => setMaxDia(e.target.value)} className={IC}>
                                <option value="1">1 al día</option>
                                <option value="2">2 al día</option>
                                <option value="3">3 al día</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className={LBL}>Comportamiento de la Tarjeta al Llenar</label>
                            <select value={comportamiento} onChange={e => setComportamiento(e.target.value as any)} className={IC}>
                              <option value="reiniciar">Reiniciar automáticamente a 0 sellos</option>
                              <option value="sin_limite">Sin límites - Sigue sumando de forma indefinida</option>
                            </select>
                          </div>

                          {/* Exploradores de Archivos: Logo y Portada */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[#f4f4f5]">
                            {/* Logo (Top Left) */}
                            <div className="space-y-1.5">
                              <label className={LBL}>Logo del Programa (Esquina Sup. Izquierda)</label>
                              <div className="flex flex-col gap-2">
                                {progLogoUrl && !progLogoFile && (
                                  <div className="w-12 h-12 rounded-xl border border-[#e4e4e7] overflow-hidden bg-white relative group">
                                    <img src={progLogoUrl} alt="Logo" className="w-full h-full object-cover" />
                                    <button type="button" onClick={() => setProgLogoUrl('')} className="absolute inset-0 bg-black/40 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">Quitar</button>
                                  </div>
                                )}
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={e => { if (e.target.files?.[0]) setProgLogoFile(e.target.files[0]) }} 
                                  className="hidden" 
                                  id="prog-logo-file" 
                                />
                                <label 
                                  htmlFor="prog-logo-file" 
                                  className="border border-dashed border-[#e4e4e7] hover:border-[#dc2626] rounded-xl p-3 text-center cursor-pointer transition-colors hover:bg-[#fafafa] flex flex-col items-center justify-center gap-1"
                                >
                                  <span className="text-lg">🖼️</span>
                                  <span className="text-[10px] font-semibold text-[#52525b] truncate w-full max-w-[180px]">
                                    {progLogoFile ? progLogoFile.name : 'Seleccionar Logo'}
                                  </span>
                                </label>
                              </div>
                            </div>

                            {/* Portada / Banner (Top Part) */}
                            <div className="space-y-1.5">
                              <label className={LBL}>Imagen de Portada / Banner Superior</label>
                              <div className="flex flex-col gap-2">
                                {progPortadaUrl && !progPortadaFile && (
                                  <div className="h-12 w-full rounded-xl border border-[#e4e4e7] overflow-hidden bg-white relative group">
                                    <img src={progPortadaUrl} alt="Portada" className="w-full h-full object-cover" />
                                    <button type="button" onClick={() => setProgPortadaUrl('')} className="absolute inset-0 bg-black/40 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">Quitar</button>
                                  </div>
                                )}
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={e => { if (e.target.files?.[0]) setProgPortadaFile(e.target.files[0]) }} 
                                  className="hidden" 
                                  id="prog-portada-file" 
                                />
                                <label 
                                  htmlFor="prog-portada-file" 
                                  className="border border-dashed border-[#e4e4e7] hover:border-[#dc2626] rounded-xl p-3 text-center cursor-pointer transition-colors hover:bg-[#fafafa] flex flex-col items-center justify-center gap-1"
                                >
                                  <span className="text-lg">🍕</span>
                                  <span className="text-[10px] font-semibold text-[#52525b] truncate w-full max-w-[180px]">
                                    {progPortadaFile ? progPortadaFile.name : 'Seleccionar Portada'}
                                  </span>
                                </label>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <button type="button" onClick={() => setPasoLealtad('selector')} className="border border-[#e4e4e7] px-4 py-2 rounded-xl text-xs font-bold text-[#52525b] hover:bg-[#fafafa]">Atrás</button>
                            <button type="button" onClick={guardarProgramaEstampillas} disabled={guardandoPrograma || subiendoLogoProg || subiendoPortadaProg} className="btn-primary py-2.5 px-6 text-xs flex-1 flex items-center justify-center gap-1.5">
                              {(guardandoPrograma || subiendoLogoProg || subiendoPortadaProg) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                              {guardandoPrograma || subiendoLogoProg || subiendoPortadaProg ? 'Procesando e Imágenes...' : (programaAEditar ? '💾 Guardar Cambios' : 'Guardar y Continuar')}
                            </button>
                          </div>
                        </div>

                        {/* Columna Derecha: Previsualizador del Celular (5/12) */}
                        <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 bg-[#fafafa] border border-[#e4e4e7] rounded-3xl space-y-4">
                          <p className="text-[10px] font-bold text-[#71717a] uppercase tracking-widest">Vista Previa en Vivo (Cliente)</p>
                          
                          {/* Contenedor tipo pantalla móvil */}
                          <div className="w-full max-w-[270px] bg-white rounded-[40px] shadow-lg border-[6px] border-[#09090b] overflow-hidden relative font-sans aspect-[9/16] shrink-0">
                            {/* Notch simulada */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-4 bg-[#09090b] rounded-b-xl z-20" />
                            
                            {/* Contenido de la tarjeta */}
                            <div className="p-3 pt-6 space-y-3 h-full overflow-y-auto">
                              {/* Header del negocio */}
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl overflow-hidden border border-[#e4e4e7] shadow-sm bg-white shrink-0">
                                  <img
                                    src={progLogoFile ? URL.createObjectURL(progLogoFile) : (progLogoUrl || business?.logo_url || '/logo.png')}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[9px] text-[#71717a] font-medium leading-none">Club de Fidelización</p>
                                  <h1 className="text-[11px] font-bold text-[#09090b] tracking-tight truncate leading-tight mt-0.5">{business?.nombre || 'La Burrería'}</h1>
                                </div>
                              </div>

                              {/* Tarjeta Principal */}
                              <div className="bg-white rounded-2xl shadow-md border border-[#f0f0f0] overflow-hidden">
                                {/* Portada / Banner superior */}
                                {progPortadaFile || progPortadaUrl ? (
                                  <div className="h-16 w-full overflow-hidden relative">
                                    <img 
                                      src={progPortadaFile ? URL.createObjectURL(progPortadaFile) : progPortadaUrl} 
                                      alt="" 
                                      className="w-full h-full object-cover" 
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                                  </div>
                                ) : (
                                  <div className="h-1 bg-gradient-to-r from-[#dc2626] via-[#ef4444] to-[#dc2626]" />
                                )}

                                {/* Nombre del cliente */}
                                <div className="px-4 pt-3 pb-2">
                                  <p className="text-[8px] font-semibold text-[#a1a1aa] uppercase tracking-widest">Socio VIP</p>
                                  <h2 className="text-xs font-bold text-[#09090b] tracking-tight mt-0.5 truncate">{nombreClub || 'Club VIP La Burrería'}</h2>
                                  <p className="text-[9px] text-[#a1a1aa] font-mono leading-none">ID: SOCIO123</p>
                                </div>

                                {/* Grid de Sellos */}
                                <div className="px-3 py-2.5 bg-[#fafafa] border-y border-[#f0f0f0]">
                                  <div className="grid grid-cols-5 gap-1.5 place-items-center">
                                    {[...Array(totalSellos === 'otro' ? Number(totalSellosOtro || 10) : Number(totalSellos || 10))].map((_, i) => {
                                      const marcado = i < 3 // Simular 3 sellos marcados
                                      return (
                                        <div key={i} className="flex justify-center items-center w-full">
                                          {marcado ? (
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FFD700] via-[#FDB931] to-[#D4A017] flex items-center justify-center shadow-sm">
                                              <span className="text-[#452000] text-xs font-black">★</span>
                                            </div>
                                          ) : (
                                            <div className="w-7 h-7 rounded-full border border-dashed border-[#d4d4d8] flex items-center justify-center">
                                              <span className="text-[#d4d4d8] text-[10px]">★</span>
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>

                                {/* Progreso */}
                                <div className="px-4 py-2 text-center text-[9px] font-semibold text-[#71717a]">
                                  🏆 Simulación: 3/{totalSellos === 'otro' ? Number(totalSellosOtro || 10) : Number(totalSellos || 10)} sellos
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {pasoLealtad === 'recompensas' && (
                      <div className="space-y-4">
                        <div>
                          <h5 className="font-bold text-xs text-[#09090b] uppercase tracking-wider mb-2">Paso Final: Recompensas del Programa</h5>
                          <p className="text-xs text-[#71717a] mb-4">Define los beneficios que los clientes podrán canjear en caja.</p>
                        </div>

                        <div className="flex gap-2">
                          <input type="text" value={premioNombreCustom} onChange={e => setPremioNombreCustom(e.target.value)} className={IC + ' flex-1'} placeholder="Ej: Hamburguesa de Cortesía" />
                          <button onClick={() => { if (premioNombreCustom.trim()) { setRecompensas([...recompensas, { nombre: premioNombreCustom.trim(), estampillas_requeridas: 10, estado: true }]); setPremioNombreCustom('') } }} className="btn-primary px-4 text-xs whitespace-nowrap"><Plus className="w-4 h-4 inline" /> Agregar</button>
                        </div>

                        {recompensas.map((r, i) => (
                          <div key={i} className="flex justify-between items-center p-3 bg-[#fafafa] border border-[#e4e4e7] rounded-xl text-xs">
                            <span className="font-bold">{r.nombre}</span>
                            <button onClick={() => setRecompensas(recompensas.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700 font-bold">Quitar</button>
                          </div>
                        ))}

                        <button onClick={finalizarPrograma} className="btn-primary w-full py-3 text-xs">
                          ✅ Finalizar Creación del Programa
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              PESTAÑA 7: PROMOCIONES (CONFIGURACIÓN DE RULETA)
          ══════════════════════════════════════════ */}
          {pestaña === 'promociones' && (
            <div className="space-y-6 animate-fadeIn max-w-3xl">
              <div className="bg-white border border-[#e4e4e7] p-6 rounded-2xl shadow-sm space-y-6">
                <div>
                  <h3 className="font-bold text-[#09090b] mb-1">Configuración de Ruleta (Gamificación)</h3>
                  <p className="text-xs text-[#71717a]">Establece los 4 premios aleatorios visibles para los clientes VIP</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={LBL}>Premios de Ruleta - Sector 1</label>
                    <input type="text" value={premio1} onChange={e => setPremio1(e.target.value)} className={IC} required />
                  </div>
                  <div>
                    <label className={LBL}>Premios de Ruleta - Sector 2</label>
                    <input type="text" value={premio2} onChange={e => setPremio2(e.target.value)} className={IC} required />
                  </div>
                  <div>
                    <label className={LBL}>Premios de Ruleta - Sector 3</label>
                    <input type="text" value={premio3} onChange={e => setPremio3(e.target.value)} className={IC} required />
                  </div>
                  <div>
                    <label className={LBL}>Premios de Ruleta - Sector 4</label>
                    <input type="text" value={premio4} onChange={e => setPremio4(e.target.value)} className={IC} required />
                  </div>
                </div>

                <div className="border-t border-[#f4f4f5] pt-4">
                  <label className={LBL}>Monto Mínimo de Pedido para Activar Ruleta ($)</label>
                  <input
                    type="number"
                    value={montoMinimoRuleta}
                    onChange={e => setMontoMinimoRuleta(e.target.value)}
                    className={IC}
                    placeholder="Ej: 200 (Pon 0 para desactivar la restricción)"
                    min="0"
                    step="0.01"
                  />
                  <p className="text-[11px] text-[#71717a] mt-1">
                    La ruleta (tanto intermedia como final) solo se activará si el cliente realiza un pedido de comida cuyo costo sea igual o mayor a esta cantidad. Si es menor, se mostrará un candado dorado explicativo.
                  </p>
                </div>

                {/* Reset rule switch */}
                <div className="flex items-start gap-3 p-4 bg-[#fafafa] border border-[#e4e4e7] rounded-2xl">
                  <input
                    type="checkbox"
                    checked={reiniciarSellosAuto}
                    onChange={e => setReiniciarSellosAuto(e.target.checked)}
                    className="w-5 h-5 accent-[#dc2626] rounded cursor-pointer mt-0.5 shrink-0"
                    id="auto-reset-checkbox"
                  />
                  <div className="space-y-0.5">
                    <label htmlFor="auto-reset-checkbox" className="font-bold text-sm text-[#09090b] cursor-pointer">Reiniciar sellos del cliente automáticamente a 0</label>
                    <p className="text-xs text-[#71717a]">Al activar esta casilla, en cuanto el socio VIP termine el giro y reclame su premio en WhatsApp, sus sellos acumulados regresarán a 0 de forma instantánea.</p>
                  </div>
                </div>

                <button onClick={guardarPremiosRuleta} disabled={guardandoPromociones} className="btn-primary py-3 px-6 text-sm">
                  {guardandoPromociones ? 'Guardando Ruleta...' : 'Guardar Configuración de Ruleta'}
                </button>
              </div>

              {/* ── Ruletas Intermedias (Premios por Rango de Sellos) ── */}
              <div className="bg-white border border-[#e4e4e7] p-6 rounded-2xl shadow-sm space-y-6">
                <div>
                  <h3 className="font-bold text-sm text-[#09090b] mb-1">Ruletas Intermedias (Gamificación por Rango de Sellos)</h3>
                  <p className="text-xs text-[#71717a]">Configura ruletas adicionales que se activen cuando el cliente tenga un número específico de sellos acumulados (ej. a los 3 o 7 sellos) antes de completar la tarjeta entera.</p>
                </div>

                <div className="bg-[#fafafa] border border-[#e4e4e7] p-5 rounded-2xl space-y-4">
                  <h4 className="font-bold text-[10px] text-[#52525b] uppercase tracking-wider">Nueva Ruleta Intermedia</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
                    <div className="sm:col-span-2 md:col-span-1">
                      <label className={LBL}>Sello de Activación</label>
                      <select value={nuevoSelloAct} onChange={e => setNuevoSelloAct(e.target.value)} className={IC}>
                        {[...Array(Number(maxStamps) || 10)].map((_, i) => (
                          <option key={i+1} value={i+1}>{i+1} ★</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={LBL}>Sector 1</label>
                      <input type="text" value={nuevoP1} onChange={e => setNuevoP1(e.target.value)} className={IC} placeholder="Ej. Galleta" />
                    </div>
                    <div>
                      <label className={LBL}>Sector 2</label>
                      <input type="text" value={nuevoP2} onChange={e => setNuevoP2(e.target.value)} className={IC} placeholder="Ej. Refresco" />
                    </div>
                    <div>
                      <label className={LBL}>Sector 3</label>
                      <input type="text" value={nuevoP3} onChange={e => setNuevoP3(e.target.value)} className={IC} placeholder="Ej. Papas" />
                    </div>
                    <div>
                      <label className={LBL}>Sector 4</label>
                      <input type="text" value={nuevoP4} onChange={e => setNuevoP4(e.target.value)} className={IC} placeholder="Ej. Descuento" />
                    </div>
                  </div>

                  <button onClick={agregarOActualizarRuletaIntermedia} className="btn-primary py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-1.5 self-start">
                    <Plus className="w-3.5 h-3.5" /> Configurar Esta Ruleta
                  </button>
                </div>

                {/* Listado de ruletas configuradas */}
                <div className="space-y-3">
                  <h4 className="font-bold text-[10px] text-[#09090b] uppercase tracking-wider">Ruletas Activas por Rango</h4>
                  
                  {Object.keys(ruletaConfig || {}).length === 0 ? (
                    <div className="text-center py-6 bg-[#fafafa] border border-dashed border-[#e4e4e7] rounded-2xl text-[#71717a] text-xs">
                      No hay ruletas intermedias configuradas. La ruleta solo se activará al llenar completamente la tarjeta.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {Object.entries(ruletaConfig || {}).map(([sello, data]: any) => (
                        <div key={sello} className="border border-[#e4e4e7] rounded-2xl p-4 bg-white shadow-sm flex flex-col justify-between gap-3 relative overflow-hidden group">
                          {/* Badge de Sello */}
                          <div className="absolute top-3 right-3 bg-amber-100 border border-amber-200 text-amber-700 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                            {sello} ★
                          </div>
                          
                          <div className="space-y-2">
                            <h5 className="font-bold text-xs text-[#09090b]">Al alcanzar {sello} {Number(sello) === 1 ? 'sello' : 'sellos'}</h5>
                            <ul className="text-xs text-[#52525b] space-y-1 bg-[#fafafa] p-2.5 rounded-xl border border-[#f4f4f5]">
                              {data.premios.map((p: string, idx: number) => (
                                <li key={idx} className="flex items-center gap-1.5 truncate">
                                  <span className="text-red-500 font-extrabold">Sector {idx+1}:</span> {p}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <button onClick={() => eliminarRuletaIntermedia(sello)} className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1 mt-1 transition-colors self-start">
                            <Trash2 className="w-3.5 h-3.5" /> Eliminar Ruleta
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-[#f4f4f5] flex justify-end">
                  <button onClick={guardarPremiosRuleta} disabled={guardandoPromociones} className="btn-primary py-3 px-6 text-sm">
                    {guardandoPromociones ? 'Guardando...' : '💾 Guardar Todo y Aplicar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              PESTAÑA 8: PREMIOS (CONTROL DE CANJES)
          ══════════════════════════════════════════ */}
          {pestaña === 'premios' && (
            <div className="space-y-6 animate-fadeIn max-w-4xl">
              <div className="bg-white border border-[#e4e4e7] p-6 rounded-2xl shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-[#f4f4f5] pb-3">
                  <div>
                    <h3 className="font-bold text-[#09090b]">Premios Ganados y Control de Canjes</h3>
                    <p className="text-xs text-[#71717a]">Historial cronológico de premios que tu negocio tiene pendiente por entregar en mostrador</p>
                  </div>
                  <button onClick={cargarPremiosCanjes} className="border border-[#e4e4e7] text-[#52525b] hover:text-[#09090b] font-medium py-2 px-3 rounded-xl text-xs hover:bg-[#fafafa] flex items-center gap-1.5 transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" /> Recargar
                  </button>
                </div>

                {cargandoCanjes ? (
                  <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#e4e4e7] border-t-[#dc2626] rounded-full animate-spin" /></div>
                ) : premiosCanjesList.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-[#e4e4e7] rounded-2xl">
                    <span className="text-4xl block mb-2">🎁</span>
                    <p className="font-semibold text-sm text-[#09090b]">Ningún premio en cola</p>
                    <p className="text-xs text-[#a1a1aa] mt-0.5">Los canjes solicitados por los clientes VIP aparecerán aquí automáticamente.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#fafafa] border-b border-[#e4e4e7]">
                        <tr>
                          {['Socio VIP', 'Teléfono', 'Premio Ganado', 'Fecha de Registro', 'Estado', 'Acción'].map(h => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[#71717a] uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f4f4f5]">
                        {premiosCanjesList.map((c: any) => (
                          <tr key={c.id} className="hover:bg-[#fafafa] transition-colors">
                            <td className="px-5 py-3 font-semibold text-[#09090b] whitespace-nowrap">{c.clientes?.nombre || 'Socio VIP'}</td>
                            <td className="px-5 py-3 font-mono text-[#52525b] whitespace-nowrap">{c.clientes?.telefono || 'Sin registrar'}</td>
                            <td className="px-5 py-3 font-bold text-[#dc2626] whitespace-nowrap">{c.premio_nombre}</td>
                            <td className="px-5 py-3 text-[#a1a1aa] font-mono text-xs whitespace-nowrap">{new Date(c.creado_en).toLocaleString('es-MX')}</td>
                            <td className="px-5 py-3 whitespace-nowrap">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${c.estado === 'Entregado' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {c.estado}
                              </span>
                            </td>
                            <td className="px-5 py-3 whitespace-nowrap">
                              {c.estado === 'Pendiente' ? (
                                <button
                                  onClick={() => marcarEntregado(c.id, 'Entregado')}
                                  className="bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                                >
                                  Entregar Premio
                                </button>
                              ) : (
                                <button
                                  onClick={() => marcarEntregado(c.id, 'Pendiente')}
                                  className="border border-[#e4e4e7] hover:bg-[#fafafa] text-[#71717a] text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  Revertir a Pendiente
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              PESTAÑA 9: EMPLEADOS (CON LÁPIZ EDICIÓN)
          ══════════════════════════════════════════ */}
          {pestaña === 'empleados' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
              {/* Formulario */}
              <div className="bg-white border border-[#e4e4e7] rounded-2xl p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="font-bold text-[#09090b]">Añadir Miembro del Staff</h3>
                  <p className="text-xs text-[#71717a] mt-0.5">Asigna PIN y nivel de acceso</p>
                </div>
                <form onSubmit={agregarEmpleado} className="space-y-4">
                  <div>
                    <label className={LBL}>Nombre Completo</label>
                    <input type="text" value={nuevoEmpNombre} onChange={e => setNuevoEmpNombre(e.target.value)} className={IC} placeholder="Marcos Solís" required />
                  </div>
                  <div>
                    <label className={LBL}>Email (Opcional)</label>
                    <input type="email" value={nuevoEmpEmail} onChange={e => setNuevoEmpEmail(e.target.value)} className={IC} placeholder="marcos@negocio.com" />
                  </div>
                  <div>
                    <label className={LBL}>PIN de Acceso (4 dígitos)</label>
                    <input type="password" maxLength={4} inputMode="numeric" value={nuevoEmpPin} onChange={e => setNuevoEmpPin(e.target.value.replace(/\D/g, ''))} className={IC + ' text-center tracking-[0.5em] font-mono'} placeholder="••••" required />
                  </div>
                  <div>
                    <label className={LBL}>Nivel de Acceso</label>
                    <select value={nuevoEmpRol} onChange={e => setNuevoEmpRol(e.target.value)} className={IC}>
                      <option value="empleado">Cajero (Lector QR)</option>
                      <option value="admin_comercio">Administrador (Acceso Total)</option>
                    </select>
                  </div>
                  <button type="submit" className="btn-primary w-full py-3 text-sm font-bold shadow-sm">Agregar Empleado</button>
                </form>
              </div>

              {/* Lista */}
              <div className="lg:col-span-2 bg-white border border-[#e4e4e7] rounded-2xl p-6 shadow-sm">
                <div className="mb-5">
                  <h3 className="font-bold text-[#09090b]">Staff Activo</h3>
                  <p className="text-xs text-[#71717a] mt-0.5">Autorizados para validar sellos y premios en mostrador</p>
                </div>
                {cargandoEmpleados ? (
                  <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#e4e4e7] border-t-[#dc2626] rounded-full animate-spin" /></div>
                ) : empleados.length === 0 ? (
                  <div className="text-center py-12"><p className="text-3xl mb-2">🛡️</p><p className="font-medium text-[#52525b]">No hay trabajadores agregados</p></div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {empleados.map(emp => (
                      <div key={emp.id} className="bg-[#fafafa] border border-[#e4e4e7] rounded-xl p-4 flex justify-between items-center">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-[#09090b] truncate">{emp.nombre}</p>
                          <p className="text-xs text-[#a1a1aa] font-mono mt-0.5 truncate">{emp.email || 'PIN: Activo'}</p>
                          <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${emp.rol === 'admin_comercio' ? 'bg-purple-100 text-purple-700' : 'bg-[#f4f4f5] text-[#71717a]'}`}>
                            {emp.rol === 'admin_comercio' ? 'Admin' : 'Cajero'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Lápiz para Editar */}
                          <button
                            onClick={() => abrirEditarEmpleado(emp)}
                            className="w-8 h-8 rounded-lg border border-[#e4e4e7] hover:bg-zinc-100 hover:text-zinc-950 text-[#71717a] flex items-center justify-center transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => eliminarEmpleado(emp.id)} className="w-8 h-8 rounded-lg border border-[#e4e4e7] hover:bg-red-50 hover:border-red-200 text-[#a1a1aa] hover:text-red-500 flex items-center justify-center transition-colors shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── MODAL: DETALLE CLIENTE / VIP PERFIL DRAWER ── */}
      {clienteSeleccionadoModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 border border-[#e4e4e7] animate-slideUp">
            <div className="flex justify-between items-center mb-4 border-b border-[#f4f4f5] pb-3">
              <h3 className="font-bold text-base text-[#09090b]">Perfil de Socio VIP</h3>
              <button onClick={() => setClienteSeleccionadoModal(null)} className="w-7 h-7 rounded-full bg-[#fafafa] flex items-center justify-center hover:bg-[#f4f4f5]">
                <X className="w-4 h-4 text-[#71717a]" />
              </button>
            </div>

            <div className="space-y-4 text-center">
              <div className="w-16 h-16 bg-[#fef2f2] text-[#dc2626] font-bold rounded-full flex items-center justify-center text-xl mx-auto border border-red-100 shadow-sm">
                {clienteSeleccionadoModal.nombre.charAt(0).toUpperCase()}
              </div>

              <div>
                <h4 className="font-bold text-lg text-[#09090b] tracking-tight">{clienteSeleccionadoModal.nombre}</h4>
                <p className="text-xs text-[#a1a1aa] mt-0.5">{clienteSeleccionadoModal.email || 'Sin correo electrónico'}</p>
                <p className="text-xs font-mono text-[#71717a]">{clienteSeleccionadoModal.telefono}</p>
              </div>

              <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-2xl p-4">
                <p className="text-xs text-[#71717a] font-semibold uppercase tracking-wider mb-2">Acumulación de Sellos</p>
                <div className="flex justify-center items-center gap-1 mb-2">
                  {[...Array(Number(maxStamps))].map((_, i) => (
                    <span key={i} className={`text-xl ${i < clienteSeleccionadoModal.puntos ? 'text-amber-500' : 'text-zinc-200'}`}>★</span>
                  ))}
                </div>
                <p className="text-sm font-bold text-[#09090b]">{clienteSeleccionadoModal.puntos} de {maxStamps} sellos acumulados</p>
              </div>

              {/* Link de tarjeta personal del cliente */}
              <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-2xl p-3 text-left">
                <p className="text-[10px] text-[#71717a] font-bold uppercase tracking-wider mb-2">🔗 Link Personal de Tarjeta</p>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-mono text-[#52525b] truncate flex-1 bg-white border border-[#e4e4e7] rounded-lg px-2 py-1.5">
                    {`${typeof window !== 'undefined' ? window.location.origin : ''}/tenant/${slug}/cliente/${clienteSeleccionadoModal.id}`}
                  </p>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/tenant/${slug}/cliente/${clienteSeleccionadoModal.id}`
                      navigator.clipboard.writeText(url)
                    }}
                    title="Copiar link"
                    className="w-8 h-8 flex-shrink-0 bg-white border border-[#e4e4e7] rounded-lg flex items-center justify-center hover:bg-[#fef2f2] hover:border-red-200 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#71717a]" />
                  </button>
                  <a
                    href={`/tenant/${slug}/cliente/${clienteSeleccionadoModal.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir tarjeta"
                    className="w-8 h-8 flex-shrink-0 bg-[#dc2626] rounded-lg flex items-center justify-center hover:bg-[#b91c1c] transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-white" />
                  </a>
                </div>
              </div>

              {/* Botón WhatsApp Tarjeta Llena */}
              <button
                onClick={() => {
                  const tel = clienteSeleccionadoModal.telefono.replace(/\D/g, '')
                  const url = `${window.location.origin}/tenant/${slug}/cliente/${clienteSeleccionadoModal.id}`
                  const msg = `¡Hola ${clienteSeleccionadoModal.nombre}! 🎉 Aquí está tu tarjeta de lealtad digital de ${business?.nombre || 'La Burrería'}. Guárdala para acumular tus sellos: ${url}`
                  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank')
                }}
                className="w-full bg-[#25D366] hover:bg-[#20b858] text-white py-3.5 px-4 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" /> Enviar Tarjeta por WhatsApp 📲
              </button>

              {/* Botón WhatsApp Tarjeta Llena */}
              <button
                onClick={() => {
                  const tel = clienteSeleccionadoModal.telefono.replace(/\D/g, '')
                  const msg = `¡Hola ${clienteSeleccionadoModal.nombre}! Tu tarjeta de lealtad en ${business?.nombre || 'La Burrería'} ya está llena. Pasa a reclamar tu premio. 🎁`
                  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank')
                }}
                className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white py-3.5 px-4 rounded-2xl text-xs font-bold transition-all shadow-[0_2px_10px_rgba(220,38,38,0.2)] flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" /> Enviar Alerta "Tarjeta Llena" 📲
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EDITAR SOCIO VIP ── */}
      {clienteAEditar && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 border border-[#e4e4e7] animate-slideUp">
            <div className="flex justify-between items-center mb-4 border-b border-[#f4f4f5] pb-3">
              <h3 className="font-bold text-sm text-[#09090b]">Editar Socio VIP</h3>
              <button onClick={() => setClienteAEditar(null)} className="w-7 h-7 bg-[#fafafa] rounded-full flex items-center justify-center hover:bg-[#f4f4f5]">
                <X className="w-4 h-4 text-[#71717a]" />
              </button>
            </div>

            <form onSubmit={guardarEdicionCliente} className="space-y-4">
              <div>
                <label className={LBL}>Nombre Completo *</label>
                <input 
                  type="text" 
                  value={editCliNombre} 
                  onChange={e => setEditCliNombre(e.target.value)} 
                  className={IC} 
                  placeholder="Ej. Yareli Lozano"
                  required 
                />
              </div>
              <div>
                <label className={LBL}>Teléfono (10 dígitos) *</label>
                <input 
                  type="tel" 
                  maxLength={10}
                  value={editCliTelefono} 
                  onChange={e => setEditCliTelefono(e.target.value.replace(/\D/g, ''))} 
                  className={IC} 
                  placeholder="Ej. 3221234567"
                  required 
                />
              </div>
              <div>
                <label className={LBL}>Email (Opcional)</label>
                <input 
                  type="email" 
                  value={editCliEmail} 
                  onChange={e => setEditCliEmail(e.target.value)} 
                  className={IC} 
                  placeholder="Ej. yareli@gmail.com"
                />
              </div>
              <div>
                <label className={LBL}>Fecha de Nacimiento (Opcional)</label>
                <input 
                  type="date" 
                  value={editCliFechaNacimiento} 
                  onChange={e => setEditCliFechaNacimiento(e.target.value)} 
                  className={IC} 
                  style={{ colorScheme: 'light' }}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setClienteAEditar(null)} className="flex-1 border border-[#e4e4e7] py-2.5 rounded-xl text-xs font-semibold text-[#52525b] hover:bg-[#fafafa]">Cancelar</button>
                <button type="submit" disabled={guardandoEdicionCli} className="flex-1 btn-primary py-2.5 text-xs font-bold flex items-center justify-center gap-1.5">
                  {guardandoEdicionCli && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {guardandoEdicionCli ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EDITAR EMPLEADO ── */}
      {empleadoAEditar && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 border border-[#e4e4e7] animate-slideUp">
            <div className="flex justify-between items-center mb-4 border-b border-[#f4f4f5] pb-3">
              <h3 className="font-bold text-sm text-[#09090b]">Modificar Staff</h3>
              <button onClick={() => setEmpleadoAEditar(null)} className="w-7 h-7 bg-[#fafafa] rounded-full flex items-center justify-center hover:bg-[#f4f4f5]">
                <X className="w-4 h-4 text-[#71717a]" />
              </button>
            </div>

            <form onSubmit={guardarEdicionEmpleado} className="space-y-4">
              <div>
                <label className={LBL}>Nombre Completo</label>
                <input type="text" value={editEmpNombre} onChange={e => setEditEmpNombre(e.target.value)} className={IC} required />
              </div>
              <div>
                <label className={LBL}>Email (Opcional)</label>
                <input type="email" value={editEmpEmail} onChange={e => setEditEmpEmail(e.target.value)} className={IC} />
              </div>
              <div>
                <label className={LBL}>PIN de 4 dígitos (Vacío para mantener actual)</label>
                <input type="password" maxLength={4} inputMode="numeric" value={editEmpPin} onChange={e => setEditEmpPin(e.target.value.replace(/\D/g, ''))} className={IC + ' text-center tracking-[0.5em] font-mono'} placeholder="••••" />
              </div>
              <div>
                <label className={LBL}>Nivel de Acceso</label>
                <select value={editEmpRol} onChange={e => setEditEmpRol(e.target.value)} className={IC}>
                  <option value="empleado">Cajero (Lector QR)</option>
                  <option value="admin_comercio">Administrador (Acceso Total)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEmpleadoAEditar(null)} className="flex-1 border border-[#e4e4e7] py-2.5 rounded-xl text-xs font-semibold text-[#52525b] hover:bg-[#fafafa]">Cancelar</button>
                <button type="submit" disabled={guardandoEdicionEmp} className="flex-1 btn-primary py-2.5 text-xs font-bold">
                  {guardandoEdicionEmp ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── BOTTOM APP BAR (Solo móvil < 768px) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#e4e4e7] shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
        <div className="flex items-stretch justify-around h-16 safe-area-inset-bottom">
          {[
            { id: 'metricas',       label: 'Inicio',    icon: LayoutDashboard },
            { id: 'lealtad',        label: 'Lealtad',   icon: CreditCard },
            { id: 'empleados',      label: 'Personal',  icon: Users },
            { id: 'configuracion',  label: 'Config',    icon: Settings },
            { id: 'menus',          label: 'Menús',     icon: QrCode },
          ].map(tab => {
            const TabIcon = tab.icon
            const isActive = pestaña === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setPestaña(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all duration-150 ${
                  isActive ? 'text-[#dc2626]' : 'text-[#a1a1aa]'
                }`}
              >
                <TabIcon className={`w-5 h-5 transition-transform duration-150 ${ isActive ? 'scale-110' : 'scale-100'}`} />
                <span className={`text-[10px] font-semibold tracking-tight leading-none ${ isActive ? 'text-[#dc2626]' : 'text-[#a1a1aa]'}`}>
                  {tab.label}
                </span>
                {isActive && <span className="absolute bottom-0 w-8 h-0.5 bg-[#dc2626] rounded-full" />}
              </button>
            )
          })}
        </div>
      </nav>

    </div>
  )
}