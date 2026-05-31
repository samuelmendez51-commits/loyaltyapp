'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Papa from 'papaparse'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import {
  LayoutDashboard, Users, UtensilsCrossed, Map as MapIcon, Settings,
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
function ModalAjuste({ modal, motivo, setMotivo, guardando, requiereMotivo, onConfirmar, onCerrar }: any) {
  if (!modal) return null
  const disabledButton = requiereMotivo ? (!motivo.trim() || guardando) : guardando
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 border border-[#e4e4e7] animate-fadeIn text-[#09090b]">
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
          <label className="text-xs font-semibold text-[#3f3f46] uppercase tracking-wide block">
            Motivo de Auditoría {requiereMotivo ? '*' : '(Opcional)'}
          </label>
          <input
            type="text"
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            className="input-clean text-sm w-full bg-white border border-[#e4e4e7] rounded-xl px-4 py-2.5 text-[#09090b] transition-all"
            placeholder={requiereMotivo ? "Ej: Error en conteo, sello de cortesía..." : "Opcional..."}
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onCerrar} className="flex-1 border border-[#e4e4e7] rounded-xl py-2.5 text-sm font-semibold text-[#52525b] hover:bg-[#fafafa] transition-colors">Cancelar</button>
          <button
            onClick={onConfirmar}
            disabled={disabledButton}
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
  const activeBizId = business?.id
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

  // Nuevos Estados de Branding, Ubicación y Auditoría (Motivo Sello)
  const [logoUrlNegocio, setLogoUrlNegocio] = useState('')
  const [bannerUrlNegocio, setBannerUrlNegocio] = useState('')
  const [direccionNegocio, setDireccionNegocio] = useState('')
  const [latitudeNegocio, setLatitudeNegocio] = useState('')
  const [longitudeNegocio, setLongitudeNegocio] = useState('')
  const [requiereMotivoSello, setRequiereMotivoSello] = useState(false)
  const [guardandoBranding, setGuardandoBranding] = useState(false)
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const [subiendoBanner, setSubiendoBanner] = useState(false)
  const [categoriasExpandidas, setCategoriasExpandidas] = useState<Record<string, boolean>>({})
  const [subPestañaCatalog, setSubPestañaCatalog] = useState<'categorias' | 'productos'>('productos')

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

  const descargarQR = () => {
    const svgElement = document.querySelector('.menus-qr-code svg') as SVGGraphicsElement | null
    if (!svgElement) return alert('No se pudo encontrar el código QR')

    try {
      const svgString = new XMLSerializer().serializeToString(svgElement)
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const URL = window.URL || window.webkitURL || window
      const blobURL = URL.createObjectURL(svgBlob)

      const image = new Image()
      image.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 600
        canvas.height = 600
        const context = canvas.getContext('2d')
        if (context) {
          context.fillStyle = '#ffffff'
          context.fillRect(0, 0, 600, 600)
          context.drawImage(image, 50, 50, 500, 500)

          const png = canvas.toDataURL('image/png')
          const downloadLink = document.createElement('a')
          downloadLink.href = png
          downloadLink.download = `QR-Menu-${tipoQR}-${business?.slug || 'comercio'}.png`
          document.body.appendChild(downloadLink)
          downloadLink.click()
          document.body.removeChild(downloadLink)
        }
        URL.revokeObjectURL(blobURL)
      }
      image.src = blobURL
    } catch (e) {
      console.error('Error al generar QR descargable:', e)
      alert('Error al generar la imagen descargable del código QR')
    }
  }


  // ── ESTADOS DEL MENÚ DINÁMICO ──
  const [subPestañaMenu, setSubPestañaMenu] = useState<'archivos' | 'categorias' | 'productos'>('archivos')
  const [menuGroups, setMenuGroups] = useState<any[]>([])
  const [menuProducts, setMenuProducts] = useState<any[]>([])
  
  // Categoría Form / Edición
  const [grupoAEditar, setGrupoAEditar] = useState<any>(null)
  const [nombreGrupo, setNombreGrupo] = useState('')
  const [descGrupo, setDescGrupo] = useState('')
  const [tipoMenuGrupo, setTipoMenuGrupo] = useState<'mesa' | 'delivery' | 'ambos'>('ambos')
  const [ordenGrupo, setOrdenGrupo] = useState(0)
  const [activoGrupo, setActivoGrupo] = useState(true)
  const [guardandoGrupo, setGuardandoGrupo] = useState(false)

  // Estados interactivos para Categorías estilo Rappi
  const [menuCategoriaAbierto, setMenuCategoriaAbierto] = useState<string | null>(null)
  const [categoriaAEditarModal, setCategoriaAEditarModal] = useState<any | null>(null)

  // Producto Form / Edición
  const [productoAEditar, setProductoAEditar] = useState<any>(null)
  const [nombreProd, setNombreProd] = useState('')
  const [descProd, setDescProd] = useState('')
  const [precioProd, setPrecioProd] = useState('')
  const [imagenProdUrl, setImagenProdUrl] = useState('')
  const [disponibleProd, setDisponibleProd] = useState(true)
  const [esUpsellProd, setEsUpsellProd] = useState(false)
  const [groupIdProd, setGroupIdProd] = useState('')
  const [subiendoImgProd, setSubiendoImgProd] = useState(false)
  const [guardandoProd, setGuardandoProd] = useState(false)

  // Modificadores Form / Edición
  const [modificadorAEditar, setModificadorAEditar] = useState<any>(null)
  const [nombreMod, setNombreMod] = useState('')
  const [requeridoMod, setRequeridoMod] = useState(false)
  const [opcionesMod, setOpcionesMod] = useState<{ id?: string; nombre: string; precio_extra: number }[]>([])
  const [nuevaOpNombre, setNuevaOpNombre] = useState('')
  const [nuevaOpPrecio, setNuevaOpPrecio] = useState('0')
  const [guardandoMod, setGuardandoMod] = useState(false)


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
        header: false, // Parseamos como matriz para control de índices absoluto
        skipEmptyLines: true,
        complete: (result) => {
          const rows = result.data as string[][]
          if (!rows || rows.length === 0) return resolve()

          // 1. Detectar índices de columnas semánticamente o por heurística
          const firstRow = rows[0]
          let telIdx = -1
          let nameIdx = -1

          // A) Intentar buscar cabeceras comunes
          firstRow.forEach((val, idx) => {
            const cleanVal = (val || '').toString().toLowerCase().trim()
            if (telIdx === -1 && /phone|tel|cel|numero|num|movil|móvil|whatsapp|number|contacto/i.test(cleanVal)) {
              telIdx = idx
            }
            if (nameIdx === -1 && /name|nombre|cliente|socio|given|first|completo|apellido/i.test(cleanVal)) {
              nameIdx = idx
            }
          })

          // B) Si no encontramos por cabecera, buscamos por contenido
          let startIdx = 1
          if (telIdx === -1) {
            startIdx = 0 // Asumimos que no tiene cabeceras y procesamos desde la fila 0
            
            // Analizar las primeras 5 filas para detectar columnas de números de teléfono
            const sampleRows = rows.slice(0, 5)
            for (let col = 0; col < (firstRow.length || 0); col++) {
              let isPhoneCol = false
              let isNameCol = false
              
              for (const row of sampleRows) {
                if (!row[col]) continue
                const val = row[col].toString().replace(/[^0-9]/g, '')
                if (val.length >= 10 && val.length <= 15) {
                  isPhoneCol = true
                }
                const alphaVal = row[col].toString().replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ\s]/g, '').trim()
                if (alphaVal.length > 2 && !/^\d+$/.test(alphaVal)) {
                  isNameCol = true
                }
              }
              
              if (isPhoneCol && telIdx === -1) {
                telIdx = col
              } else if (isNameCol && nameIdx === -1) {
                nameIdx = col
              }
            }
          }

          // C) Fallback final si no se detectó nada
          if (telIdx === -1) {
            telIdx = firstRow.length > 1 ? 1 : 0
          }
          if (nameIdx === -1) {
            nameIdx = telIdx === 0 ? (firstRow.length > 1 ? 1 : 0) : 0
          }

          // 2. Procesar filas
          rows.slice(startIdx).forEach(row => {
            if (telIdx >= row.length || !row[telIdx]) return
            const tel = row[telIdx].toString().replace(/[^0-9]/g, '').slice(-10)
            const nom = nameIdx !== -1 && nameIdx < row.length && row[nameIdx] 
              ? row[nameIdx].toString().trim() 
              : ''
            
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

    if (unicos.length === 0) {
      setImportando(false)
      setImportFinalizado(true)
      return
    }

    // Obtener teléfonos ya existentes en Supabase para este negocio
    const { data: existentes } = await supabase
      .from('clientes').select('telefono').eq('business_id', businessId)
    const telefonosExistentes = new Set((existentes || []).map((e: any) => e.telefono))

    const nuevos = unicos.filter(c => !telefonosExistentes.has(c.telefono))
    const duplicados = unicos.length - nuevos.length
    setImportDuplicados(duplicados)

    if (nuevos.length === 0) {
      setImportando(false)
      setImportFinalizado(true)
      cargarDatos()
      return
    }

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
    cargarDatos()
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

  // ── VARIABLES REACTIVAS DEL CHECKLIST DE LANZAMIENTO ──
  const hasBranding = !!(business?.logo_url && business?.banner_url)
  const hasCategory = !!(menuGroups && menuGroups.length > 0)
  const hasProduct = !!(menuProducts && menuProducts.length > 0)
  const hasProgram = !!(programas && programas.length > 0)

  const stepsList = [
    {
      id: 'branding',
      label: 'Subir logotipo y banner de portada',
      desc: 'Dale identidad a tu negocio subiendo tu logo oficial y una imagen de portada atractiva.',
      completed: hasBranding,
      action: () => setPestaña('configuracion')
    },
    {
      id: 'categoria',
      label: 'Crear tu primera categoría',
      desc: 'Agrupa tus productos en carpetas organizadas (ej: Bebidas, Platillos, Entradas).',
      completed: hasCategory,
      action: () => {
        setPestaña('productos')
        setSubPestañaMenu('categorias')
      }
    },
    {
      id: 'producto',
      label: 'Registrar tu primer producto',
      desc: 'Agrega fotos, precios y modificadores (ej: Coca-Cola, Hamburguesa con queso).',
      completed: hasProduct,
      action: () => {
        setPestaña('productos')
        setSubPestañaMenu('productos')
      }
    },
    {
      id: 'programa',
      label: 'Activar tu programa de lealtad',
      desc: 'Crea tu tarjeta VIP digital y define cuántos sellos se requieren para ganar premios.',
      completed: hasProgram,
      action: () => setPestaña('lealtad')
    }
  ]

  const completedStepsCount = stepsList.filter(s => s.completed).length
  const porcentajeCompleto = (completedStepsCount / 4) * 100
  const checklistCompletado = completedStepsCount === 4

  // ── useEffect ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const handlePrompt = (e: any) => { e.preventDefault(); setDeferredPrompt(e) }
    window.addEventListener('beforeinstallprompt', handlePrompt)
    const handleOutsideClick = (e: MouseEvent) => {
      if (quickToolsRef.current && !quickToolsRef.current.contains(e.target as Node)) setQuickToolsOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    
    // Cerrar menús de categorías al hacer click fuera
    const closeCategoryDropdowns = () => setMenuCategoriaAbierto(null)
    window.addEventListener('click', closeCategoryDropdowns)

    // slug disponible tras hidratación → cargar datos del tenant correcto
    if (slug) cargarDatos()
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      document.removeEventListener('mousedown', handleOutsideClick)
      window.removeEventListener('click', closeCategoryDropdowns)
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

      setLogoUrlNegocio(bizData.logo_url || '')
      setBannerUrlNegocio(bizData.banner_url || '')
      
      let cleanDir = bizData.direccion || ''
      if (cleanDir.includes('|')) {
        cleanDir = cleanDir.split('|')[0].trim()
      }
      if (cleanDir.includes('{')) {
        const jsonStart = cleanDir.indexOf('{')
        cleanDir = cleanDir.substring(0, jsonStart).trim()
      }
      setDireccionNegocio(cleanDir)

      setLatitudeNegocio(String(bizData.latitude || ''))
      setLongitudeNegocio(String(bizData.longitude || ''))
      setRequiereMotivoSello(!!(bizData as any).requiere_motivo_sello)

      const bId = bizData.id
      // Cargar Menús Digitales
      const { data: menus } = await supabase.from('menus_digitales').select('*').eq('business_id', bId)
      if (menus) {
        const local = menus.find((m: any) => m.tipo === 'local')
        const domicilio = menus.find((m: any) => m.tipo === 'domicilio')
        if (local) {
          setMenuLocal({
            ...local,
            url: local.archivo_url || '',
            manual_url: local.url_consumo_local || ''
          })
        }
        if (domicilio) {
          setMenuDomicilio({
            ...domicilio,
            url: domicilio.archivo_url || '',
            manual_url: domicilio.url_domicilio || ''
          })
        }
      }

      // Cargar Programas de Lealtad
      const { data: progsData } = await supabase.from('programas_fidelidad').select('*').eq('business_id', bId)
      if (progsData) setProgramas(progsData)

      // Cargar Horarios Semanales, Geopush, Premios de Ruleta y Canjes
      await cargarHorariosSemanales(bId)
      await cargarGeoPush(bId)
      await cargarPremiosRuleta(bId)
      await cargarPremiosCanjes()
      await cargarDatosMenu(bId)
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

  const guardarBrandingYFidelizacion = async () => {
    const businessId = business?.id
    if (!businessId) return
    setGuardandoBranding(true)
    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          logo_url: logoUrlNegocio.trim(),
          banner_url: bannerUrlNegocio.trim(),
          direccion: direccionNegocio.trim(),
          latitude: parseFloat(latitudeNegocio) || null,
          longitude: parseFloat(longitudeNegocio) || null,
          requiere_motivo_sello: requiereMotivoSello
        })
        .eq('id', businessId)

      if (error) throw error
      alert('✅ Cambios de Apariencia, Ubicación y Seguridad guardados con éxito')
      cargarDatos()
    } catch (e: any) {
      alert('Error al guardar configuración: ' + e.message)
    } finally {
      setGuardandoBranding(false)
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
    const cleanTel = '52' + whatsappNegocio.replace(/\D/g, '').slice(-10)
    const { error } = await supabase.from('businesses').update({ telefono_whatsapp: cleanTel }).eq('id', businessId)
    if (error) alert('Error: ' + error.message)
    else { alert('✅ WhatsApp guardado'); cargarDatos() }
    setWhatsappNegocio(cleanTel)
    setGuardandoWhatsapp(false)
  }

  const probarWhatsApp = () => {
    if (!whatsappNegocio) return alert('Ingresa primero el número de WhatsApp')
    const cleanTel = '52' + whatsappNegocio.replace(/\D/g, '').slice(-10)
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

  const subirArchivoMenu = async (file: File, tipo: 'local' | 'domicilio') => {
    await guardarMenuDigital(tipo, file, undefined)
  }

  const borrarMenuArchivo = async (tipo: 'local' | 'domicilio') => {
    const menuExistente = tipo === 'local' ? menuLocal : menuDomicilio
    if (!menuExistente) return
    if (!confirm('¿Estás seguro de eliminar el menú actual?')) return
    try {
      await supabase.from('menus_digitales').update({
        archivo_url: null,
        updated_at: new Date().toISOString()
      } as any).eq('id', menuExistente.id)
      alert('✅ Menú eliminado')
      await cargarDatos()
    } catch (e: any) {
      alert('Error al eliminar menú: ' + e.message)
    }
  }

  const guardarEnlaceManual = async (url: string, tipo: 'local' | 'domicilio') => {
    const businessId = getCookieVal('session_business_id') || business?.id
    if (!businessId) return
    try {
      const menuExistente = tipo === 'local' ? menuLocal : menuDomicilio
      const updateData = tipo === 'local' 
        ? { url_consumo_local: url, updated_at: new Date().toISOString() }
        : { url_domicilio: url, updated_at: new Date().toISOString() }

      if (menuExistente) {
        await supabase.from('menus_digitales').update(updateData as any).eq('id', menuExistente.id)
      } else {
        const insertData = tipo === 'local'
          ? { business_id: businessId, tipo, nombre: 'Menú Consumo Aquí', url_consumo_local: url, activo: true }
          : { business_id: businessId, tipo, nombre: 'Menú Para Domicilio', url_domicilio: url, activo: true }
        await supabase.from('menus_digitales').insert(insertData as any)
      }
      alert('✅ Enlace web guardado')
      await cargarDatos()
    } catch (e: any) {
      alert('Error al guardar enlace: ' + e.message)
    }
  }

  // ── GESTIÓN DE MENÚ DINÁMICO (Categorías, Productos, Modificadores) ───────────
  const cargarDatosMenu = async (bId: string) => {
    try {
      const { data: groups } = await supabase
        .from('menu_groups')
        .select('*')
        .eq('business_id', bId)
        .order('orden')
      if (groups) setMenuGroups(groups)

      const { data: products } = await supabase
        .from('menu_products')
        .select('*, product_modifiers(*, modifier_options(*))')
        .eq('business_id', bId)
        .order('nombre')
      if (products) setMenuProducts(products)
    } catch (e) {
      console.error('Error loading dynamic menu:', e)
    }
  }

  const guardarCategoria = async () => {
    const businessId = activeBizId || getCookieVal('session_business_id') || business?.id
    if (!businessId || !nombreGrupo.trim()) return alert('Nombre obligatorio')
    setGuardandoGrupo(true)

    const payload = {
      business_id: businessId,
      nombre: nombreGrupo.trim(),
      descripcion: descGrupo.trim(),
      tipo_menu: tipoMenuGrupo,
      orden: Number(ordenGrupo) || 0,
      activo: activoGrupo
    }

    let error = null
    if (grupoAEditar) {
      const { error: err } = await supabase
        .from('menu_groups')
        .update(payload)
        .eq('id', grupoAEditar.id)
      error = err
    } else {
      const { error: err } = await supabase
        .from('menu_groups')
        .insert(payload)
      error = err
    }

    setGuardandoGrupo(false)
    if (error) {
      alert('Error al guardar categoría: ' + error.message)
    } else {
      alert('✅ Categoría guardada exitosamente')
      setGrupoAEditar(null)
      setNombreGrupo('')
      setDescGrupo('')
      setTipoMenuGrupo('ambos')
      setOrdenGrupo(0)
      setActivoGrupo(true)
      cargarDatosMenu(businessId)
    }
  }

  const borrarCategoria = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta categoría? Se desvincularán sus productos.')) return
    const businessId = activeBizId || getCookieVal('session_business_id') || business?.id
    if (!businessId) return
    
    const { error } = await supabase
      .from('menu_groups')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Error al eliminar: ' + error.message)
    } else {
      alert('✅ Categoría eliminada')
      cargarDatosMenu(businessId)
    }
  }

  const guardarProducto = async () => {
    const businessId = activeBizId || getCookieVal('session_business_id') || business?.id
    if (!businessId || !nombreProd.trim() || !precioProd || !groupIdProd) {
      return alert('Completa los campos obligatorios: Nombre, Precio y Categoría')
    }
    setGuardandoProd(true)

    const payload = {
      business_id: businessId,
      group_id: groupIdProd,
      nombre: nombreProd.trim(),
      descripcion: descProd.trim(),
      precio: Number(precioProd) || 0,
      imagen_url: imagenProdUrl.trim() || null,
      disponible: disponibleProd,
      es_upsell: esUpsellProd
    }

    let error = null
    if (productoAEditar) {
      const { error: err } = await supabase
        .from('menu_products')
        .update(payload)
        .eq('id', productoAEditar.id)
      error = err
    } else {
      const { error: err } = await supabase
        .from('menu_products')
        .insert(payload)
      error = err
    }

    setGuardandoProd(false)
    if (error) {
      alert('Error al guardar producto: ' + error.message)
    } else {
      alert('✅ Producto guardado exitosamente')
      setProductoAEditar(null)
      setNombreProd('')
      setDescProd('')
      setPrecioProd('')
      setImagenProdUrl('')
      setDisponibleProd(true)
      setEsUpsellProd(false)
      setGroupIdProd('')
      cargarDatosMenu(businessId)
    }
  }

  const borrarProducto = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este producto y todos sus modificadores?')) return
    const businessId = activeBizId || getCookieVal('session_business_id') || business?.id
    if (!businessId) return

    const { error } = await supabase
      .from('menu_products')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Error al eliminar producto: ' + error.message)
    } else {
      alert('✅ Producto eliminado')
      cargarDatosMenu(businessId)
    }
  }

  const toggleProductoDisponible = async (pId: string, currentVal: boolean) => {
    const newVal = !currentVal
    // Instant local update
    setMenuProducts(prev => prev.map(item => item.id === pId ? { ...item, disponible: newVal } : item))
    const { error } = await supabase
      .from('menu_products')
      .update({ disponible: newVal })
      .eq('id', pId)
    if (error) {
      alert('Error al cambiar disponibilidad: ' + error.message)
      setMenuProducts(prev => prev.map(item => item.id === pId ? { ...item, disponible: currentVal } : item))
    }
  }

  const toggleCategoriaExpandida = (catId: string) => {
    setCategoriasExpandidas(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }))
  }

  const subirBrandingImagen = async (file: File, tipo: 'logo' | 'banner') => {
    const businessId = activeBizId || getCookieVal('session_business_id') || business?.id
    if (!businessId) return
    if (tipo === 'logo') setSubiendoLogo(true)
    else setSubiendoBanner(true)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = businessId + '/branding-' + tipo + '-' + Date.now() + '.' + fileExt
      const { error: uploadErr } = await supabase.storage
        .from('menu-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: true, contentType: file.type || 'application/octet-stream' })
      if (uploadErr) {
        alert('Error al subir imagen: ' + uploadErr.message)
        return
      }
      const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(fileName)
      if (urlData && urlData.publicUrl) {
        if (tipo === 'logo') {
          setLogoUrlNegocio(urlData.publicUrl)
        } else {
          setBannerUrlNegocio(urlData.publicUrl)
        }
        alert('✅ Imagen de sucursal subida exitosamente!')
      }
    } catch (e: any) {
      alert('Error en subida: ' + e.message)
    } finally {
      if (tipo === 'logo') setSubiendoLogo(false)
      else setSubiendoBanner(false)
    }
  }

  const obtenerUbicacionGPS = () => {
    if (!navigator.geolocation) {
      alert('La geolocalización no está soportada por tu navegador.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoPushLat(position.coords.latitude)
        setGeoPushLng(position.coords.longitude)
        setLatitudeNegocio(String(position.coords.latitude))
        setLongitudeNegocio(String(position.coords.longitude))
        alert('📍 Coordenadas de GPS cargadas con éxito en ambos apartados!')
      },
      (error) => {
        alert('Error al obtener ubicación GPS: ' + error.message)
      }
    )
  }

  const toggleAuditoriaMotivo = async (val: boolean) => {
    setRequiereMotivoSello(val)
    const businessId = business?.id
    if (!businessId) return
    const { error } = await supabase
      .from('businesses')
      .update({ requiere_motivo_sello: val })
      .eq('id', businessId)
    if (error) {
      alert('Error al actualizar auditoría: ' + error.message)
      setRequiereMotivoSello(!val)
    }
  }

  const subirImagenProd = async (file: File) => {
    const businessId = activeBizId || getCookieVal('session_business_id') || business?.id
    if (!businessId) return
    setSubiendoImgProd(true)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${businessId}/prod-${Date.now()}.${fileExt}`
      const { error: uploadErr } = await supabase.storage
        .from('menu-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: true, contentType: file.type || 'application/octet-stream' })
      if (uploadErr) {
        alert('Error al subir: ' + uploadErr.message)
        return
      }
      const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(fileName)
      if (urlData?.publicUrl) {
        setImagenProdUrl(urlData.publicUrl)
        alert('✅ Imagen subida y asociada!')
      }
    } catch (e: any) {
      alert('Error en subida: ' + e.message)
    } finally {
      setSubiendoImgProd(false)
    }
  }

  const abrirGestorModificadores = (product: any) => {
    setProductoAEditar(product)
    setModificadorAEditar({ product_id: product.id })
    setNombreMod('')
    setRequeridoMod(false)
    setOpcionesMod([])
    setNuevaOpNombre('')
    setNuevaOpPrecio('0')
  }

  const agregarOpcionMemoria = () => {
    if (!nuevaOpNombre.trim()) return alert('Nombre de opción requerido')
    setOpcionesMod(prev => [...prev, { nombre: nuevaOpNombre.trim(), precio_extra: Number(nuevaOpPrecio) || 0 }])
    setNuevaOpNombre('')
    setNuevaOpPrecio('0')
  }

  const quitarOpcionMemoria = (idx: number) => {
    setOpcionesMod(prev => prev.filter((_, i) => i !== idx))
  }

  const guardarModificadorCompleto = async () => {
    const businessId = activeBizId || getCookieVal('session_business_id') || business?.id
    if (!businessId || !productoAEditar || !nombreMod.trim()) return alert('Nombre del grupo obligatorio')
    setGuardandoMod(true)

    // 1. Insertar el Modifier Group
    const { data: modGroup, error: groupErr } = await supabase
      .from('product_modifiers')
      .insert({
        product_id: productoAEditar.id,
        nombre: nombreMod.trim(),
        requerido: requeridoMod
      })
      .select()
      .single()

    if (groupErr || !modGroup) {
      setGuardandoMod(false)
      return alert('Error al crear grupo modificador: ' + groupErr?.message)
    }

    // 2. Insertar las opciones asociadas
    if (opcionesMod.length > 0) {
      const optionsPayload = opcionesMod.map(op => ({
        modifier_id: modGroup.id,
        nombre: op.nombre,
        precio_extra: op.precio_extra
      }))
      const { error: optsErr } = await supabase
        .from('modifier_options')
        .insert(optionsPayload)
      if (optsErr) {
        alert('Error parcial al insertar opciones: ' + optsErr.message)
      }
    }

    setGuardandoMod(false)
    alert('✅ Grupo modificador guardado exitosamente')
    setModificadorAEditar(null)
    setNombreMod('')
    setRequeridoMod(false)
    setOpcionesMod([])
    cargarDatosMenu(businessId)
  }

  const borrarModificador = async (modId: string) => {
    if (!confirm('¿Estás seguro de eliminar este grupo de modificadores?')) return
    const businessId = activeBizId || getCookieVal('session_business_id') || business?.id
    if (!businessId) return

    const { error } = await supabase
      .from('product_modifiers')
      .delete()
      .eq('id', modId)

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('✅ Modificador eliminado')
      cargarDatosMenu(businessId)
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

  // 10 Standalone Navigation Tabs (Including first-class Catalogo de Productos)
  const TABS_MAIN = [
    { id: 'metricas', label: 'Métricas', icon: LayoutDashboard },
    { id: 'configuracion', label: 'Configuración', icon: Settings },
    { id: 'productos', label: '🍔 Catálogo de Productos', icon: UtensilsCrossed },
    { id: 'clientes', label: '👥 Clientes', icon: UserCheck },
    { id: 'redes', label: 'Redes y WhatsApp', icon: Smartphone },
    { id: 'menus', label: 'Gestión de Menús y QR', icon: QrCode },
    { id: 'geopush', label: 'Geopush', icon: MapIcon },
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
        requiereMotivo={requiereMotivoSello}
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
              {/* Checklist de Lanzamiento */}
              {!checklistCompletado ? (
                <div className="bg-white border border-[#e4e4e7] rounded-3xl p-6 shadow-sm space-y-5 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🚀</span>
                        <h3 className="text-base font-bold text-[#09090b] tracking-tight">Checklist de Lanzamiento</h3>
                      </div>
                      <p className="text-xs text-[#71717a]">Completa las 4 tareas clave para habilitar tu club de lealtad y recibir clientes.</p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
                      <div className="flex-1 sm:flex-none w-24 sm:w-32 bg-[#f4f4f5] h-2.5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full transition-all duration-500" 
                          style={{ width: `${porcentajeCompleto}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-[#09090b] font-mono shrink-0">
                        {completedStepsCount} de 4 ({porcentajeCompleto}%)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {stepsList.map(step => {
                      return (
                        <div 
                          key={step.id} 
                          className={`border rounded-2xl p-4 flex flex-col justify-between gap-4 transition-all ${
                            step.completed 
                              ? 'bg-emerald-50/20 border-emerald-100' 
                              : 'bg-[#fafafa] border-[#e4e4e7] hover:border-zinc-300'
                          }`}
                        >
                          <div className="flex gap-3">
                            <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${
                              step.completed 
                                ? 'bg-emerald-500 text-white shadow-sm' 
                                : 'border-2 border-dashed border-[#a1a1aa] text-[#71717a]'
                            }`}>
                              {step.completed ? '✓' : ''}
                            </div>
                            <div>
                              <p className={`text-xs font-bold ${step.completed ? 'text-emerald-800 line-through' : 'text-[#09090b]'}`}>{step.label}</p>
                              <p className="text-[10px] text-[#71717a] mt-1 leading-relaxed">{step.desc}</p>
                            </div>
                          </div>

                          {!step.completed && (
                            <button 
                              onClick={step.action}
                              className="w-full bg-[#09090b] hover:bg-zinc-800 text-white text-[10px] font-bold py-2 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1"
                            >
                              Configurar Ahora →
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-white border border-emerald-200 rounded-3xl p-6 shadow-md space-y-4 animate-fadeIn flex flex-col sm:flex-row items-center justify-between gap-5">
                  <div className="flex gap-4 items-start text-center sm:text-left flex-col sm:flex-row">
                    <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg mx-auto sm:mx-0 shrink-0">
                      <span className="text-2xl animate-bounce">🎉</span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-emerald-950 tracking-tight">¡Tu negocio está listo para triunfar!</h3>
                      <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                        ¡Felicidades! Has completado con éxito todos los pasos recomendados. Tu club de lealtad VIP y catálogo interactivo están 100% listos para recibir a tus clientes en sucursal.
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => window.open(window.location.origin + '/menu', '_blank')}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-5 py-3 rounded-xl transition-all shadow-md shrink-0 flex items-center justify-center gap-1.5"
                  >
                    🔗 Previsualizar Portal de Clientes
                  </button>
                </div>
              )}

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


            </div>
          )}

          {/* ══════════════════════════════════════════
              PESTAÑA NUEVA: CLIENTES & CRM
          ══════════════════════════════════════════ */}
          {pestaña === 'clientes' && (
            <div className="space-y-6 animate-fadeIn max-w-3xl">
              <div className="bg-white border border-[#e4e4e7] p-6 rounded-2xl shadow-sm space-y-2">
                <h3 className="font-bold text-[#09090b]">👥 Clientes & CRM</h3>
                <p className="text-xs text-[#71717a]">Visualiza e importa los socios de tu club de lealtad en un panel CRM unificado.</p>
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
            </div>
          )}

          {/* ══════════════════════════════════════════
              PESTAÑA 2: CONFIGURACIÓN            </div>
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

              {/* Apariencia, Ubicación y Seguridad */}
              <div className="bg-white border border-[#e4e4e7] p-6 rounded-2xl shadow-sm space-y-6">
                <div>
                  <h3 className="font-bold text-[#09090b] mb-1">Apariencia, Ubicación & Seguridad</h3>
                  <p className="text-xs text-[#71717a]">Configura el branding del negocio, coordenadas geográficas de la sucursal y políticas de auditoría para empleados.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={LBL}>Logo del negocio (Emoji o URL)</label>
                    <div className="flex gap-2">
                      <input type="text" value={logoUrlNegocio} onChange={e => setLogoUrlNegocio(e.target.value)} className={IC + ' flex-1'} placeholder="Ej: 🤠 o link de imagen" />
                      <label className="bg-[#09090b] hover:bg-zinc-800 text-white text-xs font-bold px-3.5 py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0">
                        {subiendoLogo ? 'Subiendo...' : '📸 Subir'}
                        <input type="file" accept="image/*" hidden onChange={e => { if (e.target.files?.[0]) subirBrandingImagen(e.target.files[0], 'logo') }} />
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className={LBL}>Banner de fondo (URL de imagen)</label>
                    <div className="flex gap-2">
                      <input type="text" value={bannerUrlNegocio} onChange={e => setBannerUrlNegocio(e.target.value)} className={IC + ' flex-1'} placeholder="Ej: https://..." />
                      <label className="bg-[#09090b] hover:bg-zinc-800 text-white text-xs font-bold px-3.5 py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0">
                        {subiendoBanner ? 'Subiendo...' : '📸 Subir'}
                        <input type="file" accept="image/*" hidden onChange={e => { if (e.target.files?.[0]) subirBrandingImagen(e.target.files[0], 'banner') }} />
                      </label>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={LBL}>Dirección Sucursal (Texto para clientes)</label>
                    <input type="text" value={direccionNegocio} onChange={e => setDireccionNegocio(e.target.value)} className={IC} placeholder="Ej: Calle Principal 123, Centro" />
                  </div>
                  <div>
                    <label className={LBL}>Latitud Sucursal</label>
                    <input type="number" step="any" value={latitudeNegocio} onChange={e => setLatitudeNegocio(e.target.value)} className={IC} placeholder="Ej: 19.421583" />
                  </div>
                  <div>
                    <label className={LBL}>Longitud Sucursal</label>
                    <input type="number" step="any" value={longitudeNegocio} onChange={e => setLongitudeNegocio(e.target.value)} className={IC} placeholder="Ej: -102.067222" />
                  </div>

                </div>

                <div className="pt-2">
                  <button onClick={guardarBrandingYFidelizacion} disabled={guardandoBranding} className="btn-primary py-3 px-6 text-sm">
                    {guardandoBranding ? 'Guardando configuración...' : 'Guardar Apariencia y Seguridad'}
                  </button>
                </div>
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
              PESTAÑA: MENÚS Y ENLACES PÚBLICOS
          ══════════════════════════════════════════ */}
          {pestaña === 'menus' && (
            <div className="space-y-6 animate-fadeIn max-w-3xl">
              {/* CONTENEDOR PRINCIPAL */}
              <div className="bg-white border border-[#e4e4e7] p-6 rounded-2xl shadow-sm space-y-6">
                <div>
                  <h3 className="font-bold text-[#09090b] mb-1">Cargar Menús y Enlaces Públicos</h3>
                  <p className="text-xs text-[#71717a]">Sube tus menús en formato PDF/Imagen o ingresa enlaces externos para tus clientes.</p>
                </div>

                {/* 1. CARGA DE ARCHIVOS / ESTATICO */}
                {subPestañaMenu === 'archivos' && (
                  <div className="space-y-6 animate-fadeIn">
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
                          <div className="border-2 border-dashed border-[#e4e4e7] hover:border-[#dc2626] rounded-2xl p-6 text-center cursor-pointer transition-all bg-[#fafafa] relative flex flex-col items-center justify-center min-h-[140px]">
                            {subiendoMenuLocal ? (
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-8 h-8 text-[#dc2626] animate-spin" />
                                <span className="text-xs text-[#52525b] font-bold">Subiendo archivo...</span>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <span className="text-4xl block">📁</span>
                                <span className="text-xs text-[#09090b] font-bold block">Subir Menú de Mesa</span>
                                <span className="text-[10px] text-[#71717a] block">PDF, JPG o PNG hasta 10MB</span>
                              </div>
                            )}
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="application/pdf,image/*" onChange={e => { if (e.target.files?.[0]) subirArchivoMenu(e.target.files[0], 'local') }} />
                          </div>
                        </div>

                        {menuLocal?.url && (
                          <div className="bg-[#fef2f2] border border-[#fecaca] p-4 rounded-xl flex items-center justify-between gap-4 animate-fadeIn">
                            <div className="truncate flex-1">
                              <p className="text-[10px] font-bold text-[#dc2626] uppercase">Menú cargado actualmente</p>
                              <a href={menuLocal.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#09090b] hover:text-[#dc2626] hover:underline font-bold truncate block">{menuLocal.url}</a>
                            </div>
                            <button onClick={() => borrarMenuArchivo('local')} className="text-xs text-[#dc2626] font-bold hover:underline">Eliminar</button>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <label className={LBL}>O ingresa el enlace web de tu menú local manualmente (ej: Canva o Google Drive)</label>
                          <div className="flex gap-2">
                            <input type="text" defaultValue={menuLocal?.manual_url || ''} placeholder="https://canva.com/design/... o https://drive.google.com/..." className={IC + ' bg-white flex-1'} onBlur={e => guardarEnlaceManual(e.target.value, 'local')} />
                            <button onClick={e => { const input = (e.currentTarget.previousSibling as HTMLInputElement); guardarEnlaceManual(input.value, 'local') }} className="bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-bold px-4 py-3 rounded-xl transition-all">
                              Guardar Enlace
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Menú domicilio */}
                    {tipoQR === 'domicilio' && (
                      <div className="space-y-4">
                        <div>
                          <label className={LBL}>Cargar Menú Para Domicilio (PDF/Imagen)</label>
                          <div className="border-2 border-dashed border-[#e4e4e7] hover:border-[#dc2626] rounded-2xl p-6 text-center cursor-pointer transition-all bg-[#fafafa] relative flex flex-col items-center justify-center min-h-[140px]">
                            {subiendoMenuDomicilio ? (
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-8 h-8 text-[#dc2626] animate-spin" />
                                <span className="text-xs text-[#52525b] font-bold">Subiendo archivo...</span>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <span className="text-4xl block">🏍️</span>
                                <span className="text-xs text-[#09090b] font-bold block">Subir Menú Domicilio</span>
                                <span className="text-[10px] text-[#71717a] block">PDF, JPG o PNG hasta 10MB</span>
                              </div>
                            )}
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="application/pdf,image/*" onChange={e => { if (e.target.files?.[0]) subirArchivoMenu(e.target.files[0], 'domicilio') }} />
                          </div>
                        </div>

                        {menuDomicilio?.url && (
                          <div className="bg-[#fef2f2] border border-[#fecaca] p-4 rounded-xl flex items-center justify-between gap-4 animate-fadeIn">
                            <div className="truncate flex-1">
                              <p className="text-[10px] font-bold text-[#dc2626] uppercase">Menú cargado actualmente</p>
                              <a href={menuDomicilio.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#09090b] hover:text-[#dc2626] hover:underline font-bold truncate block">{menuDomicilio.url}</a>
                            </div>
                            <button onClick={() => borrarMenuArchivo('domicilio')} className="text-xs text-[#dc2626] font-bold hover:underline">Eliminar</button>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <label className={LBL}>O ingresa el enlace web de tu menú a domicilio manualmente</label>
                          <div className="flex gap-2">
                            <input type="text" defaultValue={menuDomicilio?.manual_url || ''} placeholder="https://canva.com/design/... o https://drive.google.com/..." className={IC + ' bg-white flex-1'} onBlur={e => guardarEnlaceManual(e.target.value, 'domicilio')} />
                            <button onClick={e => { const input = (e.currentTarget.previousSibling as HTMLInputElement); guardarEnlaceManual(input.value, 'domicilio') }} className="bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-bold px-4 py-3 rounded-xl transition-all">
                              Guardar Enlace
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* QR Code Section */}
                    <div className="border-t border-[#f4f4f5] pt-6 flex flex-col sm:flex-row items-center gap-6 bg-[#fafafa] p-6 rounded-2xl border border-[#e4e4e7]">
                      <div className="menus-qr-code w-32 h-32 bg-white rounded-xl border border-[#e4e4e7] flex items-center justify-center shrink-0 p-2">
                        <QRCodeSVG
                          value={(() => {
                            const origin = typeof window !== 'undefined' ? window.location.origin : 'https://laburreria.loyaltyclub.mx'
                            return `${origin}/tenant/${slug}/menu?tipo=${tipoQR}`
                          })()}
                          size={120}
                          bgColor="#ffffff"
                          fgColor="#09090b"
                          level="H"
                        />
                      </div>
                      <div className="space-y-2 flex-1 text-center sm:text-left">
                        <h4 className="font-bold text-[#09090b]">Código QR Autogenerado</h4>
                        <p className="text-xs text-[#52525b]">
                          Este código QR dirige a tus clientes directamente al menú de <strong>{tipoQR === 'local' ? 'Consumo en Mesa / Local' : 'Servicio a Domicilio'}</strong>.
                        </p>
                        <div className="flex flex-wrap gap-2 pt-2 justify-center sm:justify-start">
                          <button
                            onClick={() => {
                              const origin = typeof window !== 'undefined' ? window.location.origin : 'https://laburreria.loyaltyclub.mx'
                              navigator.clipboard.writeText(`${origin}/tenant/${slug}/menu?tipo=${tipoQR}`)
                              alert('📋 Enlace de menú copiado al portapapeles!')
                            }}
                            className="bg-white border border-[#e4e4e7] hover:bg-[#fafafa] text-[#09090b] text-[10px] font-bold px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            <Copy className="w-3.5 h-3.5" /> Copiar Enlace
                          </button>
                          <a
                            href={`/tenant/${slug}/menu?tipo=${tipoQR}`}
                            target="_blank"
                            className="bg-white border border-[#e4e4e7] hover:bg-[#fafafa] text-[#09090b] text-[10px] font-bold px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Abrir menú público
                          </a>
                          <button
                            onClick={descargarQR}
                            className="bg-[#dc2626] hover:bg-[#b91c1c] text-white text-[10px] font-bold px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <Download className="w-3.5 h-3.5" /> Descargar Código QR
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              PESTAÑA DEDICADA: CATÁLOGO DE PRODUCTOS
          ══════════════════════════════════════════ */}
          {pestaña === 'productos' && (
            <div className="space-y-6 animate-fadeIn max-w-3xl">
              {/* MODAL GESTOR DE MODIFICADORES */}
              {modificadorAEditar && productoAEditar && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-white border border-[#e4e4e7] rounded-3xl p-6 w-full max-w-lg shadow-2xl relative max-h-[85vh] overflow-y-auto text-[#09090b]">
                    <button 
                      onClick={() => { setModificadorAEditar(null); setProductoAEditar(null); }}
                      className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#fafafa] hover:bg-[#f4f4f5] flex items-center justify-center text-[#71717a] transition-colors"
                    >
                      ✕
                    </button>
                    
                    <div className="mb-4">
                      <span className="text-[10px] bg-red-50 text-[#dc2626] font-black uppercase px-2.5 py-0.5 rounded-full">Modificadores</span>
                      <h3 className="text-lg font-bold text-[#09090b] tracking-tight mt-1">
                        Ajustes para: <span className="text-[#dc2626]">{productoAEditar.nombre}</span>
                      </h3>
                      <p className="text-xs text-[#71717a]">Crea grupos (ej: Salsas, Tamaño) y agrega opciones con precios adicionales.</p>
                    </div>

                    {/* Formulario nuevo modificador */}
                    <div className="bg-[#fafafa] border border-[#e4e4e7] p-5 rounded-2xl space-y-4 mb-6">
                      <h4 className="text-xs font-bold text-[#09090b] uppercase tracking-wider">➕ Crear Nuevo Grupo Modificador</h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={LBL}>Nombre del Grupo (ej: Elige tu Salsa)</label>
                          <input type="text" value={nombreMod} onChange={e => setNombreMod(e.target.value)} className={IC + ' bg-white'} placeholder="Sabor / Salsa / Tamaño" />
                        </div>
                        <div className="flex items-center pt-5">
                          <label className="flex items-center gap-2 text-xs font-semibold text-[#3f3f46] cursor-pointer">
                            <input type="checkbox" checked={requeridoMod} onChange={e => setRequeridoMod(e.target.checked)} className="rounded border-[#e4e4e7] text-[#dc2626] focus:ring-[#dc2626]" />
                            ¿Es obligatorio seleccionar?
                          </label>
                        </div>
                      </div>

                      {/* Agregar opciones en memoria */}
                      <div className="border-t border-[#e4e4e7] pt-4 space-y-3">
                        <p className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider">Opciones del Grupo</p>
                        
                        {/* Listita en memoria */}
                        {opcionesMod.length > 0 && (
                          <div className="flex flex-wrap gap-2 py-1">
                            {opcionesMod.map((op, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1.5 bg-white border border-[#e4e4e7] rounded-lg px-2.5 py-1 text-xs font-semibold text-[#09090b]">
                                {op.nombre} (+${op.precio_extra} MXN)
                                <button type="button" onClick={() => quitarOpcionMemoria(idx)} className="text-[#dc2626] hover:text-red-700 font-bold ml-1">✕</button>
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <label className="text-[10px] text-[#71717a] font-bold mb-1 block">Nombre Opción</label>
                            <input type="text" value={nuevaOpNombre} onChange={e => setNuevaOpNombre(e.target.value)} className={IC + ' bg-white text-xs'} placeholder="Fresa / Habanero / Grande" />
                          </div>
                          <div className="w-28">
                            <label className="text-[10px] text-[#71717a] font-bold mb-1 block">Precio Extra</label>
                            <input type="number" value={nuevaOpPrecio} onChange={e => setNuevaOpPrecio(e.target.value)} className={IC + ' bg-white text-xs'} placeholder="0" />
                          </div>
                          <button type="button" onClick={agregarOpcionMemoria} className="bg-[#09090b] hover:bg-zinc-800 text-white text-xs font-bold px-3 py-3.5 rounded-xl transition-all">
                            ➕ Opción
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={guardarModificadorCompleto}
                        disabled={guardandoMod || !nombreMod}
                        className="w-full btn-primary text-xs font-black py-3 rounded-xl uppercase tracking-widest transition-all"
                      >
                        {guardandoMod ? 'Guardando...' : '💾 Guardar Grupo Completo'}
                      </button>
                    </div>

                    {/* Grupos existentes */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-[#09090b] uppercase tracking-wider">⚙️ Grupos Modificadores Configurados</h4>
                      {(!productoAEditar.product_modifiers || productoAEditar.product_modifiers.length === 0) ? (
                        <p className="text-xs text-[#a1a1aa] italic">Este producto no cuenta con modificadores aún.</p>
                      ) : (
                        <div className="space-y-3.5">
                          {productoAEditar.product_modifiers.map((mod: any) => (
                            <div key={mod.id} className="border border-[#e4e4e7] bg-[#fafafa] rounded-2xl p-4 flex justify-between items-start gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-bold text-sm text-[#09090b]">{mod.nombre}</h5>
                                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${mod.requerido ? 'bg-red-50 text-[#dc2626]' : 'bg-[#e4e4e7] text-[#52525b]'}`}>
                                    {mod.requerido ? 'Requerido' : 'Opcional'}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {mod.modifier_options?.map((opt: any) => (
                                    <span key={opt.id} className="text-[10px] bg-white border border-[#e4e4e7] text-[#52525b] font-medium px-2 py-0.5 rounded-lg">
                                      {opt.nombre} (+${opt.precio_extra} MXN)
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <button
                                onClick={() => borrarModificador(mod.id)}
                                className="bg-red-50 border border-red-100 hover:bg-red-100 text-[#dc2626] font-bold p-2 rounded-xl transition-all shrink-0"
                              >
                                🗑️
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* CONTENEDOR PRINCIPAL */}
              <div className="bg-white border border-[#e4e4e7] p-6 rounded-2xl shadow-sm space-y-6">
                {/* Sub-pestañas de menú */}
                <div className="flex gap-2 border-b border-[#f4f4f5] pb-4">
                  {[
                    { id: 'archivos', label: '📁 Menús PDF / Enlaces' },
                    { id: 'categorias', label: '🗂️ Categorías Dinámicas' },
                    { id: 'productos', label: '🍔 Productos y Modificadores' }
                  ].map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => setSubPestañaMenu(sub.id as any)}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition-all border ${
                        subPestañaMenu === sub.id ? 'bg-[#dc2626] text-white border-[#dc2626]' : 'bg-white border-[#e4e4e7] text-[#52525b] hover:bg-[#fafafa]'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>

                {/* 1. CARGA DE ARCHIVOS / ESTATICO */}
                {subPestañaMenu === 'archivos' && (
                  <div className="space-y-6 animate-fadeIn">
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
                )}

                {/* 2. GESTIÓN DE CATEGORÍAS */}
                {subPestañaMenu === 'categorias' && (
                  <div className="space-y-6 animate-fadeIn text-[#09090b]">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#f4f4f5] pb-4">
                      <div>
                        <p className="text-xs text-[#71717a] font-medium leading-relaxed">
                          Los cambios en tus productos pueden tardar un par de minutos en verse reflejados en los filtros.
                        </p>
                      </div>
                      <button
                        onClick={() => setCategoriaAEditarModal({ nombre: '', tipo_menu: 'ambos' })}
                        className="bg-[#09090b] hover:bg-zinc-800 text-white font-black text-xs py-3 px-6 rounded-2xl transition-all shadow-md shrink-0 flex items-center gap-2"
                      >
                        <span>➕</span> Crear Categoría
                      </button>
                    </div>

                    {/* Lista estilo Rappi / Tarjetas */}
                    <div className="space-y-3.5">
                      {menuGroups.length === 0 ? (
                        <div className="border border-[#e4e4e7] rounded-3xl p-12 text-center bg-white shadow-sm">
                          <span className="text-4xl block mb-2">🗂️</span>
                          <p className="text-[#a1a1aa] text-sm font-bold">No hay categorías dinámicas creadas aún.</p>
                        </div>
                      ) : (
                                                menuGroups.map(g => {
                          const productosDeCat = menuProducts.filter(p => p.group_id === g.id)
                          const incompletos = productosDeCat.length === 0 || productosDeCat.some(p => !p.descripcion || !p.imagen_url)
                          const isExpandida = !!categoriasExpandidas[g.id]

                          return (
                            <div key={g.id} className="bg-white border border-[#e4e4e7] rounded-3xl shadow-sm overflow-hidden transition-all hover:border-[#d4d4d8]">
                              {/* Header de la Categoría */}
                              <div
                                onClick={() => toggleCategoriaExpandida(g.id)}
                                className="p-4.5 flex justify-between items-center cursor-pointer hover:bg-[#fafafa] transition-colors gap-4"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className={`text-[#dc2626] font-black text-xs shrink-0 transform transition-transform duration-200 ${isExpandida ? 'rotate-90' : ''}`}>
                                    ❯
                                  </span>
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
                                    <span className="font-black text-sm text-[#09090b] truncate">{g.nombre}</span>
                                    {incompletos && (
                                      <span className="text-[10px] bg-amber-50 border border-amber-100 text-amber-700 font-black px-2.5 py-0.5 rounded-full shrink-0 max-w-max">
                                        Con productos incompletos
                                      </span>
                                    )}
                                    {g.tipo_menu !== 'ambos' && (
                                      <span className="text-[9px] bg-gray-50 border border-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full shrink-0 uppercase max-w-max">
                                        {g.tipo_menu === 'mesa' ? '🍽️ Local' : '🛵 Delivery'}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0" onClick={e => e.stopPropagation()}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-[#71717a] font-bold">Activa</span>
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation()
                                        const nuevoEstado = !g.activo
                                        // Instant update for fluidity
                                        setMenuGroups(prev => prev.map(item => item.id === g.id ? { ...item, activo: nuevoEstado } : item))
                                        const { error } = await supabase
                                          .from('menu_groups')
                                          .update({ activo: nuevoEstado })
                                          .eq('id', g.id)
                                        if (error) {
                                          alert('Error al actualizar: ' + error.message)
                                          setMenuGroups(prev => prev.map(item => item.id === g.id ? { ...item, activo: !nuevoEstado } : item))
                                        }
                                      }}
                                      className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${g.activo ? 'bg-blue-600' : 'bg-gray-200'}`}
                                    >
                                      <div
                                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${g.activo ? 'translate-x-5' : 'translate-x-0'}`}
                                      />
                                    </button>
                                  </div>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      alert('📅 Agenda y Horarios especiales para ' + g.nombre + ' próximamente en LoyaltyClub Enterprise.')
                                    }}
                                    className="p-2.5 border border-[#e4e4e7] rounded-xl hover:bg-[#fafafa] text-[#71717a] transition-all"
                                    title="Calendario y Programación"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </button>

                                  <div className="relative inline-block text-left">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setMenuCategoriaAbierto(menuCategoriaAbierto === g.id ? null : g.id)
                                      }}
                                      className="p-2.5 border border-[#e4e4e7] rounded-xl hover:bg-[#fafafa] text-[#71717a] transition-all font-black text-xs tracking-widest"
                                    >
                                      •••
                                    </button>
                                    
                                    {menuCategoriaAbierto === g.id && (
                                      <div className="absolute right-0 mt-2 w-48 bg-white border border-[#e4e4e7] rounded-2xl shadow-xl z-30 animate-fadeIn overflow-hidden">
                                        <div className="py-1">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setMenuCategoriaAbierto(null)
                                              setCategoriaAEditarModal(g)
                                            }}
                                            className="w-full text-left px-4 py-2.5 text-xs font-bold text-[#09090b] hover:bg-[#fafafa] transition-colors"
                                          >
                                            Editar
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setMenuCategoriaAbierto(null)
                                              const nuevoOrden = prompt('Modificar orden visual para ' + g.nombre + ':', g.orden)
                                              if (nuevoOrden !== null) {
                                                const num = Number(nuevoOrden)
                                                if (!isNaN(num)) {
                                                  supabase.from('menu_groups').update({ orden: num }).eq('id', g.id).then(() => {
                                                    const businessId = activeBizId || getCookieVal('session_business_id') || business?.id
                                                    if (businessId) cargarDatosMenu(businessId)
                                                  })
                                                }
                                              }
                                            }}
                                            className="w-full text-left px-4 py-2.5 text-xs font-bold text-[#09090b] hover:bg-[#fafafa] transition-colors"
                                          >
                                            Reordenar
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setMenuCategoriaAbierto(null)
                                              setSubPestañaMenu('productos')
                                              setGroupIdProd(g.id)
                                            }}
                                            className="w-full text-left px-4 py-2.5 text-xs font-bold text-[#09090b] hover:bg-[#fafafa] transition-colors"
                                          >
                                            Ordenar productos
                                          </button>
                                          <button
                                            onClick={async (e) => {
                                              e.stopPropagation()
                                              setMenuCategoriaAbierto(null)
                                              if (confirm('¿Estás seguro de eliminar la categoría ' + g.nombre + '? Se desvincularán sus productos.')) {
                                                const businessId = activeBizId || getCookieVal('session_business_id') || business?.id
                                                if (!businessId) return
                                                const { error } = await supabase.from('menu_groups').delete().eq('id', g.id)
                                                if (error) {
                                                  alert('Error: ' + error.message)
                                                } else {
                                                  cargarDatosMenu(businessId)
                                                }
                                              }
                                            }}
                                            className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50/50 transition-colors border-t border-[#f4f4f5]"
                                          >
                                            Eliminar
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Panel del Acordeón Desplegado */}
                              {isExpandida && (
                                <div className="border-t border-[#f4f4f5] bg-[#fafafa] p-4.5 space-y-3 animate-fadeIn">
                                  <p className="text-[10px] font-extrabold text-[#71717a] uppercase tracking-widest mb-2">🍽️ Productos en esta categoría</p>
                                  {productosDeCat.length === 0 ? (
                                    <p className="text-xs text-[#a1a1aa] italic py-2 pl-2">No hay productos en esta categoría todavía. Ve a la pestaña "🍔 Productos" para registrar uno.</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {productosDeCat.map(p => (
                                        <div key={p.id} className="bg-white border border-[#e4e4e7] rounded-2xl p-3 flex justify-between items-center shadow-xs">
                                          <div className="flex items-center gap-3 min-w-0">
                                            {p.imagen_url ? (
                                              <img src={p.imagen_url} alt="" className="w-10 h-10 rounded-xl object-cover border border-[#e4e4e7] shrink-0" />
                                            ) : (
                                              <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-xs shrink-0 text-gray-400 font-bold">🍔</div>
                                            )}
                                            <div className="min-w-0">
                                              <p className="text-xs font-bold text-[#09090b] truncate">{p.nombre}</p>
                                              <p className="text-[10px] text-[#dc2626] font-mono font-bold mt-0.5">${p.precio} MXN</p>
                                            </div>
                                          </div>
                                          
                                          <div className="flex items-center gap-3 shrink-0">
                                            <span className={`text-[10px] font-bold ${p.disponible ? 'text-green-600' : 'text-gray-400'}`}>
                                              {p.disponible ? 'Disponible' : 'Agotado'}
                                            </span>
                                            <button
                                              onClick={() => toggleProductoDisponible(p.id, p.disponible)}
                                              className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-300 ${p.disponible ? 'bg-green-600' : 'bg-gray-200'}`}
                                            >
                                              <div
                                                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${p.disponible ? 'translate-x-4' : 'translate-x-0'}`}
                                              />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>

                    {/* MODAL UNIFICADO PARA CREAR Y EDITAR CATEGORÍAS */}
                    {categoriaAEditarModal && (
                      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white border border-[#e4e4e7] rounded-3xl p-6 w-full max-w-md shadow-2xl relative animate-fadeIn text-[#09090b]">
                          {/* Botón Cerrar */}
                          <button 
                            onClick={() => setCategoriaAEditarModal(null)}
                            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#fafafa] hover:bg-[#f4f4f5] flex items-center justify-center transition-colors text-[#71717a]"
                          >
                            <span className="text-base">✕</span>
                          </button>
                          
                          {/* Título */}
                          <h3 className="text-lg font-black text-[#09090b] tracking-tight mb-4">
                            {categoriaAEditarModal.id ? 'Editar categoría' : 'Crear categoría'}
                          </h3>
                          
                          {/* Contenido / Copy */}
                          <div className="space-y-4 mb-6">
                            <p className="text-sm text-[#52525b] leading-relaxed">
                              Una categoría es una agrupación de productos dentro de tu menú.
                            </p>
                            <p className="text-sm font-black text-[#09090b]">
                              Seleccione o crea el nombre:
                            </p>
                            
                            {/* Input Box Premium */}
                            <div className="bg-white border border-[#e4e4e7] rounded-2xl p-3 shadow-sm relative group focus-within:border-[#dc2626] transition-all">
                              <label className="text-[10px] text-[#71717a] font-bold uppercase tracking-widest block mb-0.5">
                                Nombre de la categoría
                              </label>
                              <input
                                type="text"
                                value={categoriaAEditarModal.nombre}
                                onChange={(e) => setCategoriaAEditarModal({ ...categoriaAEditarModal, nombre: e.target.value })}
                                className="w-full bg-transparent text-[#09090b] font-black text-base focus:outline-none placeholder-[#a1a1aa]"
                                placeholder="Escribe el nombre de la categoría..."
                                autoFocus
                              />
                            </div>

                            {/* Canal del menú (sólo creación) */}
                            {!categoriaAEditarModal.id && (
                              <div>
                                <label className="text-[10px] text-[#71717a] font-bold uppercase tracking-widest block mb-1">
                                  Canal del menú
                                </label>
                                <select
                                  value={categoriaAEditarModal.tipo_menu || 'ambos'}
                                  onChange={(e) => setCategoriaAEditarModal({ ...categoriaAEditarModal, tipo_menu: e.target.value })}
                                  className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-3 py-2 text-xs font-bold text-[#52525b] focus:outline-none"
                                >
                                  <option value="ambos">Ambos (Mesa y Domicilio)</option>
                                  <option value="mesa">Mesa (Sólo local)</option>
                                  <option value="delivery">Delivery (Sólo a domicilio)</option>
                                </select>
                              </div>
                            )}
                          </div>
                          
                          {/* Botones de acción */}
                          <div className="flex gap-3">
                            <button 
                              onClick={() => setCategoriaAEditarModal(null)}
                              className="flex-1 py-3 border border-[#e4e4e7] rounded-xl text-[#52525b] font-bold hover:bg-[#fafafa] transition-colors text-sm"
                            >
                              Cancelar
                            </button>
                            <button 
                              onClick={async () => {
                                if (!categoriaAEditarModal.nombre.trim()) {
                                  alert('El nombre es obligatorio')
                                  return
                                }
                                const businessId = activeBizId || getCookieVal('session_business_id') || business?.id
                                if (!businessId) return
                                
                                let error = null
                                if (categoriaAEditarModal.id) {
                                  const { error: err } = await supabase
                                    .from('menu_groups')
                                    .update({ nombre: categoriaAEditarModal.nombre.trim() })
                                    .eq('id', categoriaAEditarModal.id)
                                  error = err
                                } else {
                                  const { error: err } = await supabase
                                    .from('menu_groups')
                                    .insert({
                                      nombre: categoriaAEditarModal.nombre.trim(),
                                      business_id: businessId,
                                      descripcion: '',
                                      tipo_menu: categoriaAEditarModal.tipo_menu || 'ambos',
                                      orden: menuGroups.length + 1,
                                      activo: true
                                    })
                                  error = err
                                }
                                
                                if (error) {
                                  alert('Error al guardar: ' + error.message)
                                } else {
                                  setCategoriaAEditarModal(null)
                                  cargarDatosMenu(businessId)
                                }
                              }}
                              className="flex-1 py-3 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-xl font-black uppercase tracking-wider text-xs shadow-md transition-all"
                            >
                              {categoriaAEditarModal.id ? 'Guardar cambios' : 'Crear categoría'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. GESTIÓN DE PRODUCTOS */}
                {subPestañaMenu === 'productos' && (
                  <div className="space-y-6 animate-fadeIn">
                    {/* Formulario */}
                    <div className="bg-[#fafafa] border border-[#e4e4e7] p-5 rounded-2xl space-y-4">
                      <h4 className="text-xs font-bold text-[#09090b] uppercase tracking-wider">
                        {productoAEditar ? '✏️ Editar Producto' : '➕ Agregar Nuevo Producto'}
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className={LBL}>Nombre Producto *</label>
                          <input type="text" value={nombreProd} onChange={e => setNombreProd(e.target.value)} className={IC + ' bg-white'} placeholder="Alitas 16 piezas, Hamburguesa Especial" />
                        </div>
                        <div>
                          <label className={LBL}>Categoría vinculada *</label>
                          <select value={groupIdProd} onChange={e => setGroupIdProd(e.target.value)} className={IC + ' bg-white font-bold'}>
                            <option value="">-- Elige Categoría --</option>
                            {menuGroups.map(g => (
                              <option key={g.id} value={g.id}>{g.nombre} ({g.tipo_menu})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={LBL}>Precio unitario ($) *</label>
                          <input type="number" value={precioProd} onChange={e => setPrecioProd(e.target.value)} className={IC + ' bg-white'} placeholder="180" />
                        </div>
                        <div>
                          <label className={LBL}>Imagen del producto (URL o Subir archivo)</label>
                          <div className="flex gap-2">
                            <input type="text" value={imagenProdUrl} onChange={e => setImagenProdUrl(e.target.value)} className={IC + ' bg-white flex-1'} placeholder="https://..." />
                            <label className="bg-[#09090b] hover:bg-zinc-800 text-white text-xs font-bold px-3 py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0">
                              {subiendoImgProd ? 'Subiendo...' : '📸 Subir'}
                              <input type="file" accept="image/*" hidden onChange={e => { if (e.target.files?.[0]) subirImagenProd(e.target.files[0]) }} />
                            </label>
                          </div>
                        </div>
                        <div className="sm:col-span-2">
                          <label className={LBL}>Descripción del Producto / Ingredientes</label>
                          <textarea value={descProd} onChange={e => setDescProd(e.target.value)} className={IC + ' bg-white h-20 py-2'} placeholder="Ingredientes, porciones, detalles..." />
                        </div>
                        <div className="flex items-center gap-6">
                          <label className="flex items-center gap-2 text-xs font-semibold text-[#3f3f46] cursor-pointer">
                            <input type="checkbox" checked={disponibleProd} onChange={e => setDisponibleProd(e.target.checked)} className="rounded border-[#e4e4e7] text-[#dc2626] focus:ring-[#dc2626]" />
                            ¿Disponible hoy?
                          </label>
                          <label className="flex items-center gap-2 text-xs font-semibold text-[#3f3f46] cursor-pointer">
                            <input type="checkbox" checked={esUpsellProd} onChange={e => setEsUpsellProd(e.target.checked)} className="rounded border-[#e4e4e7] text-[#dc2626] focus:ring-[#dc2626]" />
                            ¿Ofrecer como Upsell al final?
                          </label>
                        </div>
                      </div>

                      <div className="flex gap-3 border-t border-[#e4e4e7] pt-4">
                        {productoAEditar && (
                          <button onClick={() => { setProductoAEditar(null); setNombreProd(''); setDescProd(''); setPrecioProd(''); setImagenProdUrl(''); setEsUpsellProd(false); setGroupIdProd(''); }} className="flex-1 border border-[#e4e4e7] text-[#52525b] hover:bg-white py-3 rounded-xl font-bold transition-all text-xs">Cancelar</button>
                        )}
                        <button onClick={guardarProducto} disabled={guardandoProd || !nombreProd || !precioProd || !groupIdProd} className="flex-1 btn-primary py-3 rounded-xl text-xs font-black uppercase tracking-widest">
                          {guardandoProd ? 'Guardando...' : '💾 Guardar Producto'}
                        </button>
                      </div>
                    </div>

                    {/* Tabla de productos */}
                    <div className="border border-[#e4e4e7] rounded-2xl overflow-hidden shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="table-header">
                            <th className="px-4 py-3 text-xs font-bold text-[#52525b]">Producto</th>
                            <th className="px-4 py-3 text-xs font-bold text-[#52525b]">Categoría</th>
                            <th className="px-4 py-3 text-xs font-bold text-[#52525b]">Precio</th>
                            <th className="px-4 py-3 text-xs font-bold text-[#52525b] text-right">Modificar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {menuProducts.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-xs text-[#a1a1aa] italic">No hay productos dinámicos creados aún.</td>
                            </tr>
                          ) : (
                            menuProducts.map(p => {
                              const cat = menuGroups.find(g => g.id === p.group_id)
                              return (
                                <tr key={p.id} className="table-row">
                                  <td className="px-4 py-3 text-xs font-bold text-[#09090b] flex items-center gap-3">
                                    {p.imagen_url && (
                                      <img src={p.imagen_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-[#e4e4e7] shrink-0" />
                                    )}
                                    <div>
                                      <span>{p.nombre}</span>
                                      {p.es_upsell && <span className="text-[9px] bg-red-50 text-[#dc2626] font-black uppercase px-2.5 py-0.5 rounded-full ml-1.5 inline-block">Upsell</span>}
                                      {p.product_modifiers && p.product_modifiers.length > 0 && (
                                        <p className="text-[9px] text-[#71717a] font-medium mt-0.5">Modificadores: {p.product_modifiers.map((m: any) => m.nombre).join(', ')}</p>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-xs font-semibold text-[#52525b]">{cat?.nombre || 'Desvinculada'}</td>
                                  <td className="px-4 py-3 text-xs font-mono font-bold text-[#dc2626]">${p.precio}</td>
                                  <td className="px-4 py-3 text-right space-x-2">
                                    <button onClick={() => abrirGestorModificadores(p)} className="text-xs border border-[#e4e4e7] hover:bg-[#fafafa] font-bold py-1.5 px-3 rounded-lg text-[#09090b] transition-all">⚙️ Modificadores</button>
                                    <button onClick={() => { setProductoAEditar(p); setNombreProd(p.nombre); setDescProd(p.descripcion || ''); setPrecioProd(String(p.precio)); setImagenProdUrl(p.imagen_url || ''); setDisponibleProd(p.disponible); setEsUpsellProd(!!p.es_upsell); setGroupIdProd(p.group_id); }} className="text-xs border border-[#e4e4e7] hover:bg-[#fafafa] font-bold py-1.5 px-3 rounded-lg text-[#52525b] transition-all">Editar</button>
                                    <button onClick={() => borrarProducto(p.id)} className="text-xs bg-red-50 border border-red-100 hover:bg-red-100 font-bold py-1.5 px-3 rounded-lg text-[#dc2626] transition-all">Eliminar</button>
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
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

                {/* OpenStreetMap Iframe interactivo sin errores */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <label className={LBL}>Mapa Interactivo de OpenStreetMap (Preview)</label>
                    <button
                      type="button"
                      onClick={obtenerUbicacionGPS}
                      className="text-xs bg-[#09090b] hover:bg-zinc-800 text-white font-extrabold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shrink-0"
                    >
                      📍 Obtener mi ubicación actual por GPS
                    </button>
                  </div>
                  <div className="relative w-full rounded-2xl overflow-hidden border border-[#e4e4e7] shadow-sm bg-[#fafafa]" style={{ height: '280px' }}>
                    <iframe
                      title="Ubicación Geopush"
                      width="100%"
                      height="280"
                      style={{ border: 0 }}
                      loading="lazy"
                      allowFullScreen
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(geoPushLng) - 0.005}%2C${Number(geoPushLat) - 0.004}%2C${Number(geoPushLng) + 0.005}%2C${Number(geoPushLat) + 0.004}&layer=mapnik&marker=${Number(geoPushLat)}%2C${Number(geoPushLng)}`}
                    />
                  </div>
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


              {/* Configuración de Auditoría */}
              <div className="bg-white border border-[#e4e4e7] rounded-2xl p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[#09090b]">Configuración de Auditoría</h3>
                  <p className="text-xs text-[#71717a] mt-0.5">Controla las políticas de validación para sellos otorgados de forma manual</p>
                </div>
                <label className="flex items-center gap-3 bg-[#fafafa] border border-[#e4e4e7] rounded-xl p-4 cursor-pointer hover:bg-[#f4f4f5] transition-all">
                  <input
                    type="checkbox"
                    checked={requiereMotivoSello}
                    onChange={e => toggleAuditoriaMotivo(e.target.checked)}
                    className="w-5 h-5 accent-[#dc2626] rounded cursor-pointer"
                  />
                  <div>
                    <p className="text-sm font-bold text-[#09090b]">Explicación obligatoria en sellos manuales (Auditoría)</p>
                    <p className="text-[11px] text-[#71717a] mt-0.5">Si se activa, los empleados deberán obligatoriamente escribir una razón en el motivo de auditoría al agregar o quitar sellos.</p>
                  </div>
                </label>
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
              PESTAÑA 7: PROMOCIONES          {/* ══════════════════════════════════════════
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
                  const tel = '52' + clienteSeleccionadoModal.telefono.replace(/\D/g, '').slice(-10)
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
                  const tel = '52' + clienteSeleccionadoModal.telefono.replace(/\D/g, '').slice(-10)
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