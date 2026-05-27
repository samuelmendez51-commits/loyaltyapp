'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import {
  LayoutDashboard, Users, UtensilsCrossed, Map, Settings,
  UserCheck, TrendingUp, QrCode, UserPlus, MoreVertical,
  Menu as MenuIcon, ChevronLeft, ChevronRight, LogOut,
  RefreshCw, HelpCircle, Download, AlertTriangle, Clock,
  FileSpreadsheet, Check, Plus, Trash2, DollarSign,
  PieChart as PieIcon, BarChart3 as BarIcon, PhoneCall,
  Smartphone, Radio,
  Star, Gift, CreditCard, ChevronDown, X, Check as CheckIcon,
  AlertCircle, Coffee, Cake, IceCream2
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, PieChart, Pie, Cell, Legend
} from 'recharts'

// ── Interfaces ────────────────────────────────────────────────────────────────
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
  estado: string; fecha_vencimiento: string; latitude: number; longitude: number
  direccion?: string; hora_apertura?: string; hora_cierre?: string
  banner_url?: string; moneda?: string; color_primario?: string
  nombre_contacto?: string; apellido_contacto?: string; telefono_empresa?: string
}
interface ProgramaFidelidad {
  id?: string; tipo_programa: 'estampillas' | 'gift_card' | 'niveles'
  nombre_club: string; estampillas_max_dia: number; total_estampillas: number
  precargadas: number; comportamiento_completado: 'sin_limite' | 'limitado' | 'reiniciar'
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-slideUp border border-[#e4e4e7]">
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
            className="input-clean"
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

  // ── CONFIGURACIÓN ───────────────────────────────────────────────────────────
  const [nombreNegocio, setNombreNegocio] = useState('')
  const [nombreContacto, setNombreContacto] = useState('')
  const [apellidoContacto, setApellidoContacto] = useState('')
  const [telefonoEmpresa, setTelefonoEmpresa] = useState('')
  const [horaApertura, setHoraApertura] = useState('14:00')
  const [horaCierre, setHoraCierre] = useState('22:00')
  const [guardandoConfig, setGuardandoConfig] = useState(false)

  // ── REDES SOCIALES ──────────────────────────────────────────────────────────
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

  // ── MÉTRICAS ────────────────────────────────────────────────────────────────
  const [tipoGrafica, setTipoGrafica] = useState<'barras' | 'pastel'>('barras')

  // ── EMPLEADOS ───────────────────────────────────────────────────────────────
  const [empleados, setEmpleados] = useState<any[]>([])
  const [cargandoEmpleados, setCargandoEmpleados] = useState(false)
  const [nuevoEmpNombre, setNuevoEmpNombre] = useState('')
  const [nuevoEmpEmail, setNuevoEmpEmail] = useState('')
  const [nuevoEmpPin, setNuevoEmpPin] = useState('')
  const [nuevoEmpRol, setNuevoEmpRol] = useState('empleado')

  // ── PESTAÑAS DE CONFIGURACIÓN ───────────────────────────────────────────────
  const [subTabConfig, setSubTabConfig] = useState<'empresa' | 'redes' | 'menus' | 'lealtad'>('empresa')

  // ── LEALTAD: Crear Programa ─────────────────────────────────────────────────
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

  // Preview wallet
  const [previewId, setPreviewId] = useState('')
  const [previewPuntos, setPreviewPuntos] = useState(0)
  const [previewNombre, setPreviewNombre] = useState('Socio VIP')

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  // ── useEffect ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const handlePrompt = (e: any) => { e.preventDefault(); setDeferredPrompt(e) }
    window.addEventListener('beforeinstallprompt', handlePrompt)
    const handleOutsideClick = (e: MouseEvent) => {
      if (quickToolsRef.current && !quickToolsRef.current.contains(e.target as Node)) setQuickToolsOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    cargarDatos()
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  // ── Cargar Datos ─────────────────────────────────────────────────────────────
  const cargarDatos = async () => {
    setCargando(true)
    const businessId = getCookieVal('session_business_id')
    const activeBizId = businessId || ''

    // Negocio
    let bizData: Business | null = null
    if (activeBizId) {
      const { data: biz } = await supabase.from('businesses').select('*').eq('id', activeBizId).maybeSingle()
      if (biz) bizData = biz as Business
    } else {
      const { data: biz } = await supabase.from('businesses').select('*').eq('slug', 'laburreria').maybeSingle()
      if (biz) bizData = biz as Business
    }

    if (bizData) {
      setBusiness(bizData)
      setNombreNegocio(bizData.nombre || '')
      setNombreContacto((bizData as any).nombre_contacto || '')
      setApellidoContacto((bizData as any).apellido_contacto || '')
      setTelefonoEmpresa((bizData as any).telefono_empresa || '')
      setMaxStamps(String(bizData.max_sellos || 10))
      setWhatsappNegocio(bizData.telefono_whatsapp || '')
      setHoraApertura(bizData.hora_apertura || '14:00')
      setHoraCierre(bizData.hora_cierre || '22:00')
      setLinkFacebook((bizData as any).link_facebook || '')
      setLinkInstagram((bizData as any).link_instagram || '')
      setLinkTiktok((bizData as any).link_tiktok || '')
      setLinkYoutube((bizData as any).link_youtube || '')

      // Cargar Menús Digitales
      const bId = (bizData as any).id
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
    }

    // Clientes
    const bizIdFinal = activeBizId || bizData?.id || ''
    let qCli = supabase.from('clientes').select('*').order('created_at', { ascending: false })
    if (bizIdFinal) qCli = qCli.eq('business_id', bizIdFinal)
    const { data: dataClientes } = await qCli
    if (dataClientes) {
      setClientes(dataClientes)
      if (dataClientes.length > 0 && !previewId) {
        setPreviewId(dataClientes[0].id)
        setPreviewNombre(dataClientes[0].nombre)
        setPreviewPuntos(dataClientes[0].puntos)
      }
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
        hora_apertura: horaApertura,
        hora_cierre: horaCierre,
      } as any).eq('id', businessId)
      if (error) throw error
      alert('✅ Configuración de empresa guardada')
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
    const { error } = await supabase.from('businesses').update({ telefono_whatsapp: whatsappNegocio }).eq('id', businessId)
    if (error) alert('Error: ' + error.message)
    else { alert('✅ WhatsApp guardado'); cargarDatos() }
    setGuardandoWhatsapp(false)
  }

  const probarWhatsApp = () => {
    if (!whatsappNegocio) return alert('Ingresa primero el número de WhatsApp')
    const msg = `*LoyaltyApp* 📲\n¡Tu conexión está activa! Sistema de notificaciones listo.`
    window.open(`https://wa.me/${whatsappNegocio}?text=${encodeURIComponent(msg)}`, '_blank')
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
        const { error: uploadErr } = await supabase.storage.from('menu-images').upload(fileName, file, { cacheControl: '3600', upsert: true })
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

  // ── Guardar Programa de Estampillas ───────────────────────────────────────────
  const guardarProgramaEstampillas = async () => {
    const businessId = getCookieVal('session_business_id') || business?.id
    if (!businessId || !nombreClub.trim()) return alert('Ingresa el nombre del club')
    setGuardandoPrograma(true)

    const maxDiaFinal = maxDia === 'otro' ? Number(maxDiaOtro || 1) : Number(maxDia)
    const totalFinal = totalSellos === 'otro' ? Number(totalSellosOtro || 10) : Number(totalSellos)
    const precargadasFinal = precargadas === 'otro' ? Number(precargadasOtro || 0) : Number(precargadas)

    try {
      const { data: prog, error } = await supabase.from('programas_fidelidad').insert({
        business_id: businessId,
        tipo_programa: 'estampillas',
        nombre_club: nombreClub.trim(),
        estampillas_max_dia: maxDiaFinal,
        total_estampillas: totalFinal,
        precargadas: precargadasFinal,
        comportamiento_completado: comportamiento,
        activo: true,
      }).select().single()

      if (error) throw error
      setProgramaIdActivo(prog.id)
      setPasoLealtad('recompensas')
    } catch (e: any) {
      alert('Error al guardar programa: ' + e.message)
    } finally {
      setGuardandoPrograma(false)
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
    if (id === previewId) setPreviewPuntos(nuevosPuntos)
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
    localStorage.clear(); sessionStorage.clear()
    ;['session_rol', 'session_user', 'session_business_id', 'session_branch_id', 'session_user_id']
      .forEach(c => { document.cookie = `${c}=; path=/; Max-Age=0` })
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
  const menuPublicoUrl = business ? `${typeof window !== 'undefined' ? window.location.origin : ''}/${business.slug}/menu` : ''

  const TABS_MAIN = [
    { id: 'metricas', label: 'Métricas', icon: LayoutDashboard },
    { id: 'clientes', label: 'Socios VIP', icon: Users },
    { id: 'empleados', label: 'Empleados', icon: UserCheck },
    { id: 'configuracion', label: 'Configuración', icon: Settings },
  ]

  const TABS_CONFIG = [
    { id: 'empresa', label: 'Empresa' },
    { id: 'redes', label: 'Redes & WhatsApp' },
    { id: 'menus', label: 'Menús & QR' },
    { id: 'lealtad', label: 'Tarjetas de Lealtad' },
  ]

  // ── Clase helper para inputs ──────────────────────────────────────────────────
  const IC = 'input-clean text-sm'
  const LBL = 'block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide mb-1.5'

  // ── RENDER ────────────────────────────────────────────────────────────────────
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
      <aside className={`bg-white border-r border-[#e4e4e7] transition-all duration-300 flex flex-col justify-between z-30 shrink-0 sticky top-0 h-screen shadow-[1px_0_0_#e4e4e7] ${sidebarExpanded ? 'w-60' : 'w-[72px]'}`}>
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

          {/* Nav */}
          <nav className="p-3 space-y-1">
            {TABS_MAIN.map(tab => {
              const TabIcon = tab.icon
              const isSelected = pestaña === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setPestaña(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isSelected
                      ? 'bg-[#fef2f2] text-[#dc2626]'
                      : 'text-[#71717a] hover:bg-[#fafafa] hover:text-[#09090b]'
                  }`}
                >
                  <TabIcon className={`w-5 h-5 shrink-0 ${isSelected ? 'text-[#dc2626]' : 'text-[#a1a1aa]'}`} />
                  {sidebarExpanded && <span>{tab.label}</span>}
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
              className={`w-full btn-primary py-2.5 text-xs mb-2 flex items-center gap-1.5 ${sidebarExpanded ? 'justify-center' : 'justify-center'}`}
            >
              <Download className="w-4 h-4" />
              {sidebarExpanded && 'Instalar App'}
            </button>
          )}
          {sidebarExpanded && (
            <p className="text-center text-[#a1a1aa] text-[10px] mt-2">LoyaltyApp Enterprise v13</p>
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
            <div className="relative" ref={quickToolsRef}>
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
        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          {business && <CountdownBanner business={business} />}

          {/* ══════════════════════════════════════════
              PESTAÑA: MÉTRICAS
          ══════════════════════════════════════════ */}
          {pestaña === 'metricas' && (
            <div className="space-y-6 animate-fadeIn">
              {/* KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Sellos Hoy', valor: sellosHoy, icon: '⭐', color: 'text-amber-600' },
                  { label: 'Premios Canjeados', valor: premiosCanjeados, icon: '🎁', color: 'text-green-600' },
                  { label: 'Socios VIP', valor: clientes.length, icon: '💳', color: 'text-[#dc2626]' },
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
                  <div className="flex items-center gap-2">
                    <button onClick={exportarCSV} className="border border-[#e4e4e7] text-[#52525b] hover:text-[#09090b] font-medium py-2 px-3 rounded-xl text-xs flex items-center gap-1.5 hover:bg-[#fafafa] transition-all">
                      <FileSpreadsheet className="w-4 h-4 text-green-500" /> Exportar CSV
                    </button>
                  </div>
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

              {/* A punto del premio */}
              {clientesAlLimite.length > 0 && (
                <div className="bg-white border border-[#e4e4e7] rounded-2xl p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-[#09090b] mb-4 flex items-center gap-2">
                    <span className="text-amber-500">⭐</span> Cerca del Premio ({clientesAlLimite.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {clientesAlLimite.map(c => (
                      <div key={c.id} className="bg-[#fafafa] border border-[#e4e4e7] rounded-xl p-4 flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-sm text-[#09090b]">{c.nombre}</p>
                          <p className="text-xs text-[#71717a] font-mono mt-0.5">{c.telefono}</p>
                        </div>
                        <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold">
                          {c.puntos}/{maxStamps}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                      {historial.slice(0, 20).map(h => (
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
              PESTAÑA: SOCIOS VIP
          ══════════════════════════════════════════ */}
          {pestaña === 'clientes' && (
            <div className="animate-fadeIn bg-white border border-[#e4e4e7] rounded-2xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-[#e4e4e7]">
                <h2 className="text-sm font-bold text-[#09090b]">Socios Registrados ({clientes.length})</h2>
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
                    {clientes.map(c => {
                      const sospechoso = sociosSospechosos[c.id]
                      return (
                        <tr key={c.id} className="hover:bg-[#fafafa] transition-colors group cursor-pointer"
                          onMouseEnter={() => { setPreviewId(c.id); setPreviewNombre(c.nombre); setPreviewPuntos(c.puntos) }}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Link href={`/cliente/${c.id}`}>
                              <div className="font-semibold text-[#09090b] group-hover:text-[#dc2626] transition-colors">{c.nombre}</div>
                              <div className="text-xs text-[#a1a1aa] font-mono mt-0.5">{c.telefono || 'Sin tel.'}</div>
                            </Link>
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
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex gap-2">
                              <button onClick={() => abrirModalAjuste(c.id, c.nombre, c.puntos, 'resta')} className="w-8 h-8 rounded-lg border border-[#e4e4e7] hover:bg-[#fafafa] text-[#52525b] transition-colors flex items-center justify-center font-bold">−</button>
                              <button onClick={() => abrirModalAjuste(c.id, c.nombre, c.puntos, 'suma')} className="w-8 h-8 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] hover:bg-red-50 transition-colors flex items-center justify-center font-bold">+</button>
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
          )}

          {/* ══════════════════════════════════════════
              PESTAÑA: EMPLEADOS
          ══════════════════════════════════════════ */}
          {pestaña === 'empleados' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
              {/* Formulario */}
              <div className="bg-white border border-[#e4e4e7] rounded-2xl p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="font-bold text-[#09090b]">Añadir Staff</h3>
                  <p className="text-xs text-[#71717a] mt-0.5">Asigna PIN y nivel de acceso</p>
                </div>
                <form onSubmit={agregarEmpleado} className="space-y-4">
                  <div><label className={LBL}>Nombre</label><input type="text" value={nuevoEmpNombre} onChange={e => setNuevoEmpNombre(e.target.value)} className={IC} placeholder="Marcos Solís" required /></div>
                  <div><label className={LBL}>Email (Opcional)</label><input type="email" value={nuevoEmpEmail} onChange={e => setNuevoEmpEmail(e.target.value)} className={IC} placeholder="marcos@negocio.com" /></div>
                  <div><label className={LBL}>PIN (4 dígitos)</label><input type="password" maxLength={4} inputMode="numeric" value={nuevoEmpPin} onChange={e => setNuevoEmpPin(e.target.value.replace(/\D/g, ''))} className={IC + ' text-center tracking-[0.5em] font-mono'} placeholder="••••" required /></div>
                  <div>
                    <label className={LBL}>Nivel de Acceso</label>
                    <select value={nuevoEmpRol} onChange={e => setNuevoEmpRol(e.target.value)} className={IC}>
                      <option value="empleado">Cajero (Solo Lector QR)</option>
                      <option value="admin_comercio">Administrador (Control Total)</option>
                    </select>
                  </div>
                  <button type="submit" className="btn-primary w-full py-3 text-sm">Guardar Staff</button>
                </form>
              </div>

              {/* Lista */}
              <div className="lg:col-span-2 bg-white border border-[#e4e4e7] rounded-2xl p-6 shadow-sm">
                <div className="mb-5">
                  <h3 className="font-bold text-[#09090b]">Staff Activo</h3>
                  <p className="text-xs text-[#71717a] mt-0.5">Autorizados para validar puntos y cupones</p>
                </div>
                {cargandoEmpleados ? (
                  <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#e4e4e7] border-t-[#dc2626] rounded-full animate-spin" /></div>
                ) : empleados.length === 0 ? (
                  <div className="text-center py-12"><p className="text-3xl mb-2">🛡️</p><p className="font-medium text-[#52525b]">No hay cajeros agregados</p></div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {empleados.map(emp => (
                      <div key={emp.id} className="bg-[#fafafa] border border-[#e4e4e7] rounded-xl p-4 flex justify-between items-center">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-[#09090b] truncate">{emp.nombre}</p>
                          <p className="text-xs text-[#a1a1aa] font-mono mt-0.5 truncate">{emp.email || 'Acceso por PIN'}</p>
                          <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${emp.rol === 'admin_comercio' ? 'bg-purple-100 text-purple-700' : 'bg-[#f4f4f5] text-[#71717a]'}`}>
                            {emp.rol === 'admin_comercio' ? 'Admin' : 'Cajero'}
                          </span>
                        </div>
                        <button onClick={() => eliminarEmpleado(emp.id)} className="w-8 h-8 rounded-lg border border-[#e4e4e7] hover:bg-red-50 hover:border-red-200 text-[#a1a1aa] hover:text-red-500 flex items-center justify-center transition-colors shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              PESTAÑA: CONFIGURACIÓN
          ══════════════════════════════════════════ */}
          {pestaña === 'configuracion' && (
            <div className="animate-fadeIn space-y-6">
              {/* Sub-tabs de Configuración */}
              <div className="bg-white border border-[#e4e4e7] rounded-2xl shadow-sm overflow-hidden">
                <div className="border-b border-[#e4e4e7] px-6">
                  <div className="flex gap-6 overflow-x-auto">
                    {TABS_CONFIG.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setSubTabConfig(t.id as any)}
                        className={`nav-tab py-4 text-sm ${subTabConfig === t.id ? 'active' : ''}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-6">

                  {/* ─── Sub-Tab A: EMPRESA ─── */}
                  {subTabConfig === 'empresa' && (
                    <div className="space-y-5 animate-fadeIn">
                      <div>
                        <h3 className="font-bold text-[#09090b] mb-1">Información de la Empresa</h3>
                        <p className="text-xs text-[#71717a]">Datos corporativos que aparecen en tu portal público.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <label className={LBL}>Nombre de la Empresa</label>
                          <input type="text" value={nombreNegocio} onChange={e => setNombreNegocio(e.target.value)} className={IC} placeholder="Ej: La Burrería" />
                        </div>
                        <div>
                          <label className={LBL}>Nombre del Contacto</label>
                          <input type="text" value={nombreContacto} onChange={e => setNombreContacto(e.target.value)} className={IC} placeholder="Samuel" />
                        </div>
                        <div>
                          <label className={LBL}>Apellido del Contacto</label>
                          <input type="text" value={apellidoContacto} onChange={e => setApellidoContacto(e.target.value)} className={IC} placeholder="Méndez" />
                        </div>
                        <div>
                          <label className={LBL}>Teléfono Corporativo</label>
                          <input type="tel" value={telefonoEmpresa} onChange={e => setTelefonoEmpresa(e.target.value)} className={IC} placeholder="Ej: 4521234567" />
                        </div>
                      </div>

                      {/* Horario */}
                      <div className="border-t border-[#f4f4f5] pt-5 space-y-4">
                        <div>
                          <h4 className="font-semibold text-[#09090b] text-sm">Horario de Servicio</h4>
                          <p className="text-xs text-[#71717a] mt-0.5">Define las horas de apertura y cierre del negocio.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className={LBL}>Hora de Apertura</label>
                            <input
                              type="time"
                              value={horaApertura}
                              onChange={e => setHoraApertura(e.target.value)}
                              className={IC}
                              style={{ colorScheme: 'light' }}
                            />
                          </div>
                          <div>
                            <label className={LBL}>Hora de Cierre</label>
                            <input
                              type="time"
                              value={horaCierre}
                              onChange={e => setHoraCierre(e.target.value)}
                              className={IC}
                              style={{ colorScheme: 'light' }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-[#fafafa] border border-[#e4e4e7] rounded-xl">
                          <Clock className="w-4 h-4 text-[#71717a] shrink-0" />
                          <p className="text-sm text-[#52525b]">
                            Abierto de <strong>{horaApertura}</strong> a <strong>{horaCierre}</strong>
                          </p>
                        </div>
                      </div>

                      <button onClick={guardarConfigEmpresa} disabled={guardandoConfig} className="btn-primary py-3 px-6 text-sm">
                        {guardandoConfig ? 'Guardando...' : 'Guardar Configuración'}
                      </button>
                    </div>
                  )}

                  {/* ─── Sub-Tab B: REDES SOCIALES & WHATSAPP ─── */}
                  {subTabConfig === 'redes' && (
                    <div className="space-y-6 animate-fadeIn">

                      {/* Redes Sociales */}
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-bold text-[#09090b] mb-1">Redes Sociales</h3>
                          <p className="text-xs text-[#71717a]">Configura los enlaces de tus redes para mostrarlos en el portal público.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className={LBL + ' flex items-center gap-2'}>
                              <span className="text-sm">📘</span> Facebook
                            </label>
                            <input type="url" value={linkFacebook} onChange={e => setLinkFacebook(e.target.value)} className={IC} placeholder="https://facebook.com/tu-pagina" />
                          </div>
                          <div>
                            <label className={LBL + ' flex items-center gap-2'}>
                              <span className="text-sm">📷</span> Instagram
                            </label>
                            <input type="url" value={linkInstagram} onChange={e => setLinkInstagram(e.target.value)} className={IC} placeholder="https://instagram.com/tu-perfil" />
                          </div>
                          <div>
                            <label className={LBL + ' flex items-center gap-2'}>
                              <span className="text-sm">🎵</span> TikTok
                            </label>
                            <input type="url" value={linkTiktok} onChange={e => setLinkTiktok(e.target.value)} className={IC} placeholder="https://tiktok.com/@tu-usuario" />
                          </div>
                          <div>
                            <label className={LBL + ' flex items-center gap-2'}>
                              <span className="text-sm">▶️</span> YouTube
                            </label>
                            <input type="url" value={linkYoutube} onChange={e => setLinkYoutube(e.target.value)} className={IC} placeholder="https://youtube.com/@tu-canal" />
                          </div>
                        </div>
                        <button onClick={guardarRedes} disabled={guardandoRedes} className="btn-primary py-3 px-6 text-sm">
                          {guardandoRedes ? 'Guardando...' : 'Guardar Redes Sociales'}
                        </button>
                      </div>

                      {/* WhatsApp — Sección separada */}
                      <div className="border-t border-[#f4f4f5] pt-6 space-y-4">
                        <div>
                          <h3 className="font-bold text-[#09090b] mb-1">WhatsApp Corporativo</h3>
                          <p className="text-xs text-[#71717a]">Número donde recibirás notificaciones de premios y pedidos de tus clientes.</p>
                        </div>
                        <div className="flex gap-3">
                          <input
                            type="text"
                            value={whatsappNegocio}
                            onChange={e => setWhatsappNegocio(e.target.value)}
                            className={IC + ' flex-1'}
                            placeholder="521234567890 (con código de país)"
                          />
                          <button onClick={guardarWhatsapp} disabled={guardandoWhatsapp} className="btn-primary py-3 px-4 text-sm whitespace-nowrap">
                            {guardandoWhatsapp ? '...' : 'Guardar'}
                          </button>
                          <button
                            onClick={probarWhatsApp}
                            className="border border-green-200 bg-green-50 hover:bg-green-100 text-green-700 font-semibold py-3 px-4 rounded-xl text-sm flex items-center gap-1.5 transition-colors whitespace-nowrap"
                          >
                            <PhoneCall className="w-4 h-4" /> Probar
                          </button>
                        </div>
                        {whatsappNegocio && (
                          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                            <Check className="w-4 h-4 text-green-600 shrink-0" />
                            <p className="text-sm text-green-700">
                              Vinculado: <strong>wa.me/{whatsappNegocio}</strong>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ─── Sub-Tab C: MENÚS & QR ─── */}
                  {subTabConfig === 'menus' && (
                    <div className="space-y-8 animate-fadeIn">
                      <div>
                        <h3 className="font-bold text-[#09090b] mb-1">Gestión de Menús y Códigos QR</h3>
                        <p className="text-xs text-[#71717a]">Configura dos menús independientes: uno para consumo en mesa y otro para domicilio.</p>
                      </div>

                      {/* Selector de QR a mostrar */}
                      <div className="flex gap-3 border-b border-[#f4f4f5] pb-4">
                        {[
                          { id: 'local', label: '🍽️ Consumo Aquí' },
                          { id: 'domicilio', label: '🛵 Domicilio' },
                        ].map(t => (
                          <button
                            key={t.id}
                            onClick={() => setTipoQR(t.id as any)}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${tipoQR === t.id ? 'bg-[#fef2f2] border-[#dc2626] text-[#dc2626]' : 'border-[#e4e4e7] text-[#71717a] hover:bg-[#fafafa]'}`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {/* Menú 1: Consumo Aquí */}
                      {tipoQR === 'local' && (
                        <div className="space-y-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-[#09090b]">Menú — Consumo en Mesa</h4>
                              <p className="text-xs text-[#71717a] mt-0.5">QR para imprimir y pegar en las mesas del restaurante</p>
                            </div>
                          </div>

                          {/* Upload */}
                          <div>
                            <label className={LBL}>Cargar Menú (PDF o Imagen)</label>
                            <div
                              onClick={() => document.getElementById('menu-local-upload')?.click()}
                              className="border-2 border-dashed border-[#d4d4d8] hover:border-[#dc2626] rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-[#fef2f2] group"
                            >
                              {subiendoMenuLocal ? (
                                <div className="flex flex-col items-center gap-2">
                                  <div className="w-6 h-6 border-2 border-[#e4e4e7] border-t-[#dc2626] rounded-full animate-spin" />
                                  <span className="text-xs text-[#dc2626] font-medium">Subiendo...</span>
                                </div>
                              ) : (
                                <div className="text-center">
                                  <span className="text-3xl block mb-2 group-hover:scale-110 transition-transform">📁</span>
                                  <span className="text-sm font-medium text-[#52525b]">Seleccionar archivo</span>
                                  <p className="text-xs text-[#a1a1aa] mt-1">PDF, JPG, PNG hasta 10MB</p>
                                </div>
                              )}
                            </div>
                            <input id="menu-local-upload" type="file" accept="image/*,application/pdf" hidden
                              onChange={e => { if (e.target.files?.[0]) guardarMenuDigital('local', e.target.files[0]) }} />
                          </div>

                          {/* URL del menú */}
                          {menuLocal?.archivo_url && (
                            <div className="space-y-3">
                              <div>
                                <label className={LBL}>URL Pública del Menú</label>
                                <div className="flex gap-2">
                                  <input type="text" readOnly value={menuLocal.archivo_url} className={IC + ' flex-1 bg-[#fafafa] text-[#71717a] text-xs'} />
                                  <button onClick={() => { navigator.clipboard.writeText(menuLocal.archivo_url); alert('✅ URL copiada') }} className="border border-[#e4e4e7] px-3 py-2 rounded-xl text-xs font-medium text-[#52525b] hover:bg-[#fafafa] whitespace-nowrap">Copiar</button>
                                </div>
                              </div>

                              {/* QR para mesa */}
                              <div className="flex flex-col items-center gap-3 bg-[#fafafa] border border-[#e4e4e7] rounded-2xl p-6">
                                <p className="text-xs font-semibold text-[#52525b] uppercase tracking-wide">QR — Para Imprimir en Mesa</p>
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-[#e4e4e7]">
                                  <QRCodeSVG value={menuLocal.archivo_url} size={180} fgColor="#09090b" />
                                </div>
                                <button onClick={() => {
                                  const svg = document.querySelector('#qr-local svg') as SVGElement
                                  if (!svg) return
                                  const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' })
                                  const url = URL.createObjectURL(blob)
                                  const a = document.createElement('a'); a.href = url; a.download = `QR-Mesa-${business?.slug}.svg`
                                  document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); document.body.removeChild(a)
                                }} className="border border-[#e4e4e7] hover:border-[#dc2626] text-[#52525b] hover:text-[#dc2626] font-medium py-2.5 px-5 rounded-xl text-xs transition-all flex items-center gap-2">
                                  <Download className="w-4 h-4" /> Descargar QR Alta Resolución
                                </button>
                                <div id="qr-local" className="hidden">
                                  <QRCodeSVG value={menuLocal.archivo_url} size={400} fgColor="#09090b" />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Menú 2: Domicilio */}
                      {tipoQR === 'domicilio' && (
                        <div className="space-y-5">
                          <div>
                            <h4 className="font-semibold text-[#09090b]">Menú — Para Domicilio</h4>
                            <p className="text-xs text-[#71717a] mt-0.5">QR para pedidos a domicilio o para compartir digitalmente</p>
                          </div>

                          <div>
                            <label className={LBL}>Cargar Menú de Domicilio</label>
                            <div
                              onClick={() => document.getElementById('menu-domicilio-upload')?.click()}
                              className="border-2 border-dashed border-[#d4d4d8] hover:border-[#dc2626] rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-[#fef2f2] group"
                            >
                              {subiendoMenuDomicilio ? (
                                <div className="flex flex-col items-center gap-2">
                                  <div className="w-6 h-6 border-2 border-[#e4e4e7] border-t-[#dc2626] rounded-full animate-spin" />
                                  <span className="text-xs text-[#dc2626] font-medium">Subiendo...</span>
                                </div>
                              ) : (
                                <div className="text-center">
                                  <span className="text-3xl block mb-2 group-hover:scale-110 transition-transform">📁</span>
                                  <span className="text-sm font-medium text-[#52525b]">Seleccionar archivo</span>
                                  <p className="text-xs text-[#a1a1aa] mt-1">PDF, JPG, PNG hasta 10MB</p>
                                </div>
                              )}
                            </div>
                            <input id="menu-domicilio-upload" type="file" accept="image/*,application/pdf" hidden
                              onChange={e => { if (e.target.files?.[0]) guardarMenuDigital('domicilio', e.target.files[0]) }} />
                          </div>

                          {menuDomicilio?.archivo_url && (
                            <div className="space-y-3">
                              <div>
                                <label className={LBL}>URL Pública — Menú Domicilio</label>
                                <div className="flex gap-2">
                                  <input type="text" readOnly value={menuDomicilio.archivo_url} className={IC + ' flex-1 bg-[#fafafa] text-[#71717a] text-xs'} />
                                  <button onClick={() => { navigator.clipboard.writeText(menuDomicilio.archivo_url); alert('✅ URL copiada') }} className="border border-[#e4e4e7] px-3 py-2 rounded-xl text-xs font-medium text-[#52525b] hover:bg-[#fafafa] whitespace-nowrap">Copiar</button>
                                </div>
                              </div>
                              <div className="flex flex-col items-center gap-3 bg-[#fafafa] border border-[#e4e4e7] rounded-2xl p-6">
                                <p className="text-xs font-semibold text-[#52525b] uppercase tracking-wide">QR — Pedidos a Domicilio</p>
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-[#e4e4e7]">
                                  <QRCodeSVG value={menuDomicilio.archivo_url} size={180} fgColor="#09090b" />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ─── Sub-Tab D: LEALTAD (Tracking Table Style) ─── */}
                  {subTabConfig === 'lealtad' && (
                    <div className="space-y-6 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-[#09090b]">Tarjetas de Lealtad</h3>
                          <p className="text-xs text-[#71717a] mt-0.5">Diseña el programa de fidelización para tus clientes</p>
                        </div>
                        <button
                          onClick={() => { setMostrarCrearPrograma(true); setPasoLealtad('selector') }}
                          className="btn-primary py-2.5 px-5 text-sm flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" /> Crear Programa
                        </button>
                      </div>

                      {/* Programas existentes */}
                      {programas.length > 0 && (
                        <div className="space-y-3">
                          {programas.map((prog: any) => (
                            <div key={prog.id} className="bg-[#fafafa] border border-[#e4e4e7] rounded-2xl p-5 flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    prog.tipo_programa === 'estampillas' ? 'bg-amber-100 text-amber-700' :
                                    prog.tipo_programa === 'gift_card' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    {prog.tipo_programa === 'estampillas' ? '⭐ Estampillas' : prog.tipo_programa === 'gift_card' ? '💳 Gift Card' : '🏆 Niveles'}
                                  </span>
                                  {prog.activo && <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">Activo</span>}
                                </div>
                                <p className="font-semibold text-[#09090b]">{prog.nombre_club}</p>
                                <p className="text-xs text-[#71717a] mt-0.5">{prog.total_estampillas} sellos · {prog.estampillas_max_dia}/día</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {programas.length === 0 && !mostrarCrearPrograma && (
                        <div className="text-center py-12 border-2 border-dashed border-[#e4e4e7] rounded-2xl">
                          <p className="text-4xl mb-3">🎯</p>
                          <p className="font-semibold text-[#09090b]">Ningún programa activo</p>
                          <p className="text-xs text-[#71717a] mt-1">Crea tu primer programa para comenzar a fidelizar clientes</p>
                        </div>
                      )}

                      {/* ── Flujo Crear Programa ── */}
                      {mostrarCrearPrograma && (
                        <div className="border border-[#e4e4e7] rounded-2xl overflow-hidden animate-slideUp">
                          <div className="bg-[#fafafa] border-b border-[#e4e4e7] p-4 flex items-center justify-between">
                            <h4 className="font-semibold text-[#09090b]">
                              {pasoLealtad === 'selector' ? 'Elige el tipo de programa' :
                               pasoLealtad === 'config' ? `Configura: ${tipoSeleccionado}` :
                               'Define las Recompensas'}
                            </h4>
                            <button onClick={() => setMostrarCrearPrograma(false)} className="w-7 h-7 rounded-full bg-white border border-[#e4e4e7] flex items-center justify-center hover:bg-[#f4f4f5]">
                              <X className="w-3.5 h-3.5 text-[#71717a]" />
                            </button>
                          </div>

                          <div className="p-6">
                            {/* ── PASO 1: Selector de tipo ── */}
                            {pasoLealtad === 'selector' && (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {[
                                  {
                                    id: 'estampillas',
                                    titulo: 'Estampillas',
                                    desc: 'Tus clientes acumulan estampillas por cada visita y obtienen recompensas',
                                    emoji: '⭐',
                                    demo: (
                                      <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                                        {[...Array(10)].map((_, i) => (
                                          <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i < 6 ? 'bg-amber-400 text-white' : 'border-2 border-dashed border-[#d4d4d8] text-[#d4d4d8]'}`}>★</div>
                                        ))}
                                      </div>
                                    )
                                  },
                                  {
                                    id: 'gift_card',
                                    titulo: 'Gift Card',
                                    desc: 'Tus clientes pueden gastar en productos con un saldo prepagado',
                                    emoji: '💳',
                                    demo: (
                                      <div className="mt-3 bg-gradient-to-r from-[#09090b] to-[#27272a] rounded-xl p-3 text-white">
                                        <p className="text-[9px] uppercase tracking-widest text-white/50">Saldo disponible</p>
                                        <p className="text-xl font-bold font-mono">$250.00</p>
                                      </div>
                                    )
                                  },
                                  {
                                    id: 'niveles',
                                    titulo: 'Niveles',
                                    desc: 'Tus clientes suben de nivel según su consumo y obtienen mejores beneficios',
                                    emoji: '🏆',
                                    demo: (
                                      <div className="mt-3 flex gap-2 justify-center">
                                        {['Bronce', 'Plata', 'Oro'].map((n, i) => (
                                          <div key={n} className={`flex-1 text-center py-1.5 rounded-lg text-[9px] font-bold ${i === 2 ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-[#fafafa] text-[#71717a] border border-[#e4e4e7]'}`}>{n}</div>
                                        ))}
                                      </div>
                                    )
                                  }
                                ].map(tipo => (
                                  <div
                                    key={tipo.id}
                                    onClick={() => setTipoSeleccionado(tipo.id as any)}
                                    className={`relative border-2 rounded-2xl p-5 cursor-pointer transition-all hover:shadow-md ${
                                      tipoSeleccionado === tipo.id
                                        ? 'border-[#dc2626] bg-[#fef2f2]'
                                        : 'border-[#e4e4e7] bg-white hover:border-[#d4d4d8]'
                                    }`}
                                  >
                                    {/* Radio button */}
                                    <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center ${tipoSeleccionado === tipo.id ? 'border-[#dc2626] bg-[#dc2626]' : 'border-[#d4d4d8]'}`}>
                                      {tipoSeleccionado === tipo.id && <div className="w-2 h-2 bg-white rounded-full" />}
                                    </div>

                                    <span className="text-3xl block mb-2">{tipo.emoji}</span>
                                    <p className="font-bold text-[#09090b] text-sm">{tipo.titulo}</p>
                                    <p className="text-xs text-[#71717a] mt-1 leading-relaxed">{tipo.desc}</p>
                                    {tipo.demo}
                                  </div>
                                ))}
                              </div>
                            )}

                            {pasoLealtad === 'selector' && tipoSeleccionado && (
                              <div className="mt-5 flex justify-end">
                                <button
                                  onClick={() => {
                                    if (tipoSeleccionado === 'estampillas') setPasoLealtad('config')
                                    else alert('Gift Card y Niveles próximamente disponibles. Por ahora, selecciona Estampillas.')
                                  }}
                                  className="btn-primary py-3 px-8 text-sm"
                                >
                                  Continuar →
                                </button>
                              </div>
                            )}

                            {/* ── PASO 2: Config Estampillas ── */}
                            {pasoLealtad === 'config' && tipoSeleccionado === 'estampillas' && (
                              <div className="space-y-6">
                                {/* Nombre del club */}
                                <div>
                                  <label className={LBL}>Nombre de tu Club de Fidelización</label>
                                  <input type="text" value={nombreClub} onChange={e => setNombreClub(e.target.value)} className={IC} placeholder="Ej: Club Burrería VIP" />
                                </div>

                                {/* Sellos por día */}
                                <div>
                                  <label className={LBL}>¿Cuántas veces puede obtener una estampilla al día?</label>
                                  <div className="flex flex-wrap gap-2">
                                    {['1', '3', '5'].map(v => (
                                      <button key={v} onClick={() => setMaxDia(v)} className={`px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all ${maxDia === v && maxDia !== 'otro' ? 'bg-[#fef2f2] border-[#dc2626] text-[#dc2626]' : 'border-[#e4e4e7] text-[#52525b] hover:border-[#dc2626]'}`}>{v} al día</button>
                                    ))}
                                    <button onClick={() => setMaxDia('otro')} className={`px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all ${maxDia === 'otro' ? 'bg-[#fef2f2] border-[#dc2626] text-[#dc2626]' : 'border-[#e4e4e7] text-[#52525b]'}`}>Otro</button>
                                    {maxDia === 'otro' && <input type="number" value={maxDiaOtro} onChange={e => setMaxDiaOtro(e.target.value)} className={IC + ' w-24'} placeholder="Ej: 7" min="1" />}
                                  </div>
                                </div>

                                {/* Total de sellos */}
                                <div>
                                  <label className={LBL}>¿Cuántas estampillas tendrá la tarjeta en total?</label>
                                  <div className="flex flex-wrap gap-2">
                                    {['6', '8', '10', '12'].map(v => (
                                      <button key={v} onClick={() => setTotalSellos(v)} className={`px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all ${totalSellos === v && totalSellos !== 'otro' ? 'bg-[#fef2f2] border-[#dc2626] text-[#dc2626]' : 'border-[#e4e4e7] text-[#52525b] hover:border-[#dc2626]'}`}>{v}</button>
                                    ))}
                                    <button onClick={() => setTotalSellos('otro')} className={`px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all ${totalSellos === 'otro' ? 'bg-[#fef2f2] border-[#dc2626] text-[#dc2626]' : 'border-[#e4e4e7] text-[#52525b]'}`}>Otro</button>
                                    {totalSellos === 'otro' && <input type="number" value={totalSellosOtro} onChange={e => setTotalSellosOtro(e.target.value)} className={IC + ' w-24'} placeholder="Ej: 15" min="1" />}
                                  </div>
                                </div>

                                {/* Precargadas */}
                                <div>
                                  <label className={LBL}>¿Cuántas estampillas precargadas al registrarse?</label>
                                  <div className="flex flex-wrap gap-2">
                                    {['0', '3', '6'].map(v => (
                                      <button key={v} onClick={() => setPrecargadas(v)} className={`px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all ${precargadas === v && precargadas !== 'otro' ? 'bg-[#fef2f2] border-[#dc2626] text-[#dc2626]' : 'border-[#e4e4e7] text-[#52525b] hover:border-[#dc2626]'}`}>{v}</button>
                                    ))}
                                    <button onClick={() => setPrecargadas('otro')} className={`px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all ${precargadas === 'otro' ? 'bg-[#fef2f2] border-[#dc2626] text-[#dc2626]' : 'border-[#e4e4e7] text-[#52525b]'}`}>Otro</button>
                                    {precargadas === 'otro' && <input type="number" value={precargadasOtro} onChange={e => setPrecargadasOtro(e.target.value)} className={IC + ' w-24'} placeholder="Ej: 2" min="0" />}
                                  </div>
                                </div>

                                {/* Comportamiento al completar */}
                                <div>
                                  <label className={LBL}>Comportamiento al completar la tarjeta</label>
                                  <div className="space-y-2">
                                    {[
                                      { id: 'sin_limite', label: 'Sin límite — Puede seguir acumulando indefinidamente' },
                                      { id: 'limitado', label: 'Limitar hasta canjear — La tarjeta se congela hasta reclamar el premio' },
                                      { id: 'reiniciar', label: 'Reiniciar automáticamente — La tarjeta se reinicia al completarse' },
                                    ].map(op => (
                                      <label key={op.id} className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-[#e4e4e7] hover:border-[#dc2626] hover:bg-[#fef2f2] transition-all">
                                        <input type="radio" name="comportamiento" value={op.id} checked={comportamiento === op.id} onChange={() => setComportamiento(op.id as any)} className="mt-0.5 accent-[#dc2626] shrink-0" />
                                        <span className="text-sm text-[#52525b]">{op.label}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>

                                <div className="flex gap-3">
                                  <button onClick={() => setPasoLealtad('selector')} className="border border-[#e4e4e7] text-[#52525b] font-semibold py-3 px-6 rounded-xl text-sm hover:bg-[#fafafa] transition-colors">
                                    ← Atrás
                                  </button>
                                  <button onClick={guardarProgramaEstampillas} disabled={guardandoPrograma || !nombreClub.trim()} className="btn-primary flex-1 py-3 text-sm disabled:opacity-50">
                                    {guardandoPrograma ? 'Guardando...' : 'Continuar → Recompensas'}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* ── PASO 3: Recompensas ── */}
                            {pasoLealtad === 'recompensas' && (
                              <div className="space-y-6">
                                <div>
                                  <h4 className="font-bold text-[#09090b]">¿Qué recompensas quieres dar?</h4>
                                  <p className="text-xs text-[#71717a] mt-1">Selecciona y configura recompensas intermedias para motivar a tus clientes</p>
                                </div>

                                {/* Sugerencias rápidas */}
                                <div>
                                  <label className={LBL}>Selecciona una recompensa</label>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                      { id: 'Cappuccino', icon: <Coffee className="w-5 h-5" />, label: 'Cappuccino' },
                                      { id: 'Pastel', icon: <Cake className="w-5 h-5" />, label: 'Pastel' },
                                      { id: 'Helado', icon: <IceCream2 className="w-5 h-5" />, label: 'Helado' },
                                      { id: 'otro', icon: <Gift className="w-5 h-5" />, label: 'Otra' },
                                    ].map(op => (
                                      <button
                                        key={op.id}
                                        onClick={() => setPremioRapido(op.id)}
                                        className={`border-2 rounded-2xl p-4 flex flex-col items-center gap-2 transition-all text-sm font-semibold ${premioRapido === op.id ? 'border-[#dc2626] bg-[#fef2f2] text-[#dc2626]' : 'border-[#e4e4e7] text-[#52525b] hover:border-[#dc2626]'}`}
                                      >
                                        {op.icon}
                                        {op.label}
                                      </button>
                                    ))}
                                  </div>
                                  {premioRapido === 'otro' && (
                                    <input type="text" value={premioNombreCustom} onChange={e => setPremioNombreCustom(e.target.value)} className={IC + ' mt-3'} placeholder="Nombre de la recompensa..." />
                                  )}
                                </div>

                                {premioRapido && (
                                  <div>
                                    <label className={LBL}>Sellos requeridos para esta recompensa</label>
                                    <div className="flex flex-wrap gap-2">
                                      {['1', '3', '5'].map(v => (
                                        <button key={v} onClick={() => setPremioSellos(v)} className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${premioSellos === v ? 'bg-[#fef2f2] border-[#dc2626] text-[#dc2626]' : 'border-[#e4e4e7] text-[#52525b]'}`}>{v} sellos</button>
                                      ))}
                                      <button onClick={() => setPremioSellos('otro')} className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${premioSellos === 'otro' ? 'bg-[#fef2f2] border-[#dc2626] text-[#dc2626]' : 'border-[#e4e4e7] text-[#52525b]'}`}>Otro</button>
                                      {premioSellos === 'otro' && <input type="number" value={premioSellosOtro} onChange={e => setPremioSellosOtro(e.target.value)} className={IC + ' w-20'} min="1" />}
                                    </div>
                                    <button onClick={agregarRecompensa} className="btn-primary mt-3 py-2.5 px-6 text-sm flex items-center gap-2">
                                      <Plus className="w-4 h-4" /> Agregar Recompensa
                                    </button>
                                  </div>
                                )}

                                {/* Lista de recompensas guardadas */}
                                {recompensas.length > 0 && (
                                  <div className="space-y-2">
                                    <label className={LBL}>Recompensas configuradas</label>
                                    {recompensas.map((r, idx) => (
                                      <div key={idx} className="flex items-center justify-between bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-3">
                                        <div>
                                          <p className="font-semibold text-sm text-[#09090b]">{r.nombre}</p>
                                          <p className="text-xs text-[#71717a]">Al sello {r.estampillas_requeridas}</p>
                                        </div>
                                        <button onClick={() => eliminarRecompensa(idx)} className="w-7 h-7 rounded-lg hover:bg-red-50 hover:text-red-500 text-[#a1a1aa] flex items-center justify-center transition-colors">
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div className="flex gap-3 pt-2">
                                  <button onClick={() => setPasoLealtad('config')} className="border border-[#e4e4e7] text-[#52525b] font-semibold py-3 px-6 rounded-xl text-sm hover:bg-[#fafafa]">
                                    ← Atrás
                                  </button>
                                  <button onClick={finalizarPrograma} className="btn-primary flex-1 py-3 text-sm">
                                    ✅ Finalizar Programa
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}