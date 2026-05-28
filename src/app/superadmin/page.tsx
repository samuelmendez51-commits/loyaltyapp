'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  LayoutDashboard, 
  Building2, 
  Settings, 
  LogOut, 
  TrendingUp, 
  DollarSign, 
  AlertTriangle,
  Search,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  Key,
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  Play
} from 'lucide-react'

// ── Interfaces ─────────────────────────────────────────────────────────────
interface BusinessUser {
  id: string
  business_id: string
  nombre: string
  email: string
  pin: string
  rol: string
  activo: boolean
}

interface Business {
  id: string
  nombre: string
  slug: string
  estado: 'activo' | 'demo' | 'vencido' | 'bloqueado'
  plan: string
  fecha_vencimiento: string
  creditos_usados: number
  creditos_totales: number
  es_demo: boolean
  bloqueado_manual: boolean
  owner_name: string
  owner_email: string
  latitude: number
  longitude: number
  created_at: string
  business_users?: BusinessUser[]
}

interface CreditTransaction {
  id: string
  business_id: string
  tipo: string
  creditos: number
  meses: number
  monto_mxn: number
  notas: string
  creado_por: string
  created_at: string
  businesses?: {
    nombre: string
  }
}

// ── Componente: Contador regresivo premium ─────────────────────────────────
function Countdown({ fechaVencimiento }: { fechaVencimiento: string }) {
  const [tiempo, setTiempo] = useState('')
  const [critico, setCritico] = useState(false)

  useEffect(() => {
    const calcular = () => {
      const ahora = Date.now()
      const fin = new Date(fechaVencimiento).getTime()
      const diff = fin - ahora
      if (diff <= 0) { setTiempo('VENCIDO'); setCritico(true); return }
      const dias = Math.floor(diff / 86400000)
      const horas = Math.floor((diff % 86400000) / 3600000)
      const minutos = Math.floor((diff % 3600000) / 60000)
      setCritico(dias < 5)
      if (dias < 1) setTiempo(`${String(horas).padStart(2,'0')}h : ${String(minutos).padStart(2,'0')}m`)
      else setTiempo(`${dias}d : ${String(horas).padStart(2,'0')}h`)
    }
    calcular()
    const iv = setInterval(calcular, 30000)
    return () => clearInterval(iv)
  }, [fechaVencimiento])

  return (
    <span className={`font-mono text-xs font-bold ${critico ? 'text-red-650 animate-pulse' : 'text-[#71717a]'}`}>
      {tiempo}
    </span>
  )
}

// ── Componente: LED de estado limpio ──────────────────────────────────────────
function StatusLED({ estado, bloqueado }: { estado: string; bloqueado: boolean }) {
  if (bloqueado) return <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 inline-block shadow-sm" title="Bloqueado" />
  const colores: Record<string, string> = {
    activo: 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]',
    demo: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]',
    vencido: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]',
    bloqueado: 'bg-zinc-400',
  }
  return <span className={`w-2.5 h-2.5 rounded-full inline-block ${colores[estado] || 'bg-zinc-300'}`} />
}

// ── Componente: Fila de Credencial (Ver/Ocultar/Copiar PIN) ─────────────────
function CredentialRow({ email, pin }: { email: string; pin: string }) {
  const [reveal, setReveal] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(pin)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-1 text-xs">
      <div className="flex items-center gap-1.5 text-[#52525b]">
        <span className="font-semibold select-all">{email}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase font-bold tracking-wider text-[#a1a1aa] shrink-0 font-mono">PIN / Clave:</span>
        <span className="font-mono font-bold text-[#09090b] text-xs">
          {reveal ? pin : '••••••••'}
        </span>
        <button
          onClick={() => setReveal(!reveal)}
          className="text-[#a1a1aa] hover:text-[#52525b] transition-colors p-0.5"
          title={reveal ? "Ocultar clave" : "Mostrar clave"}
        >
          {reveal ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <button
          onClick={handleCopy}
          className="text-[#a1a1aa] hover:text-[#52525b] transition-colors p-0.5"
          title="Copiar contraseña"
        >
          {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
        </button>
      </div>
    </div>
  )
}

// ── Componente: Menú de acción flotante (Clean Canvas) ─────────────────────
function ActionMenu({
  business,
  onRenovar,
  onHistorial,
  onEditar,
  onToggleBloqueo,
  onImpersonar,
}: {
  business: Business
  onRenovar: () => void
  onHistorial: () => void
  onEditar: () => void
  onToggleBloqueo: () => void
  onImpersonar: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-lg bg-white border border-[#e4e4e7] hover:bg-[#fafafa] transition-colors flex items-center justify-center text-[#71717a] hover:text-[#09090b] text-sm font-black"
      >
        ⋮
      </button>
      {open && (
        <div className="absolute left-8 top-0 z-50 bg-white border border-[#e4e4e7] rounded-xl shadow-xl overflow-hidden min-w-[190px] py-1 animate-in fade-in zoom-in-95 duration-100">
          <button
            onClick={() => { onImpersonar(); setOpen(false) }}
            className="w-full px-4 py-2.5 text-left text-xs font-bold text-purple-650 hover:bg-purple-50 transition-colors flex items-center gap-2 border-b border-[#f4f4f5]"
          >
            <Play size={13} className="fill-purple-650" /> Impersonar
          </button>
          <button
            onClick={() => { onHistorial(); setOpen(false) }}
            className="w-full px-4 py-2.5 text-left text-xs font-bold text-[#52525b] hover:bg-[#fafafa] hover:text-[#09090b] transition-colors flex items-center gap-2 border-b border-[#f4f4f5]"
          >
            📋 Ver Historial
          </button>
          <button
            onClick={() => { onRenovar(); setOpen(false) }}
            className="w-full px-4 py-2.5 text-left text-xs font-bold text-green-650 hover:bg-green-50 transition-colors flex items-center gap-2 border-b border-[#f4f4f5]"
          >
            🔄 Renovar Susc.
          </button>
          <button
            onClick={() => { onEditar(); setOpen(false) }}
            className="w-full px-4 py-2.5 text-left text-xs font-bold text-blue-650 hover:bg-blue-50 transition-colors flex items-center gap-2 border-b border-[#f4f4f5]"
          >
            ✏️ Editar / Ajustar
          </button>
          <button
            onClick={() => { onToggleBloqueo(); setOpen(false) }}
            className={`w-full px-4 py-2.5 text-left text-xs font-bold transition-colors flex items-center gap-2 ${
              business.bloqueado_manual
                ? 'text-green-650 hover:bg-green-50'
                : 'text-red-650 hover:bg-red-50'
            }`}
          >
            {business.bloqueado_manual ? '🔓 Desbloquear' : '🚫 Bloquear Acceso'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── COMPONENTE PRINCIPAL: Panel SuperAdmin ─────────────────────────────────
export default function SuperAdminPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [cargando, setCargando] = useState(true)
  
  // Modales
  const [modalRenovar, setModalRenovar] = useState<Business | null>(null)
  const [modalHistorial, setModalHistorial] = useState<Business | null>(null)
  const [modalEditar, setModalEditar] = useState<Business | null>(null)
  const [modalRegistrar, setModalRegistrar] = useState(false)

  // Configuración de Precio de Crédito (Persistido en LocalStorage)
  const [precioCredito, setPrecioCredito] = useState<number>(499)
  
  // Pestañas (layout idéntico a mostrador de negocio)
  const [pestaña, setPestaña] = useState<'metricas' | 'negocios' | 'ajustes'>('metricas')
  const [busqueda, setBusqueda] = useState('')
  const [sidebarExpanded, setSidebarExpanded] = useState(true)

  // Estados de Registro
  const [nuevoBiz, setNuevoBiz] = useState({
    nombre: '', slug: '', ownerName: '', ownerEmail: '', pin: '9999', plan: 'mensual', creditos: 1
  })
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPrice = localStorage.getItem('superadmin_precio_credito')
      if (savedPrice) setPrecioCredito(Number(savedPrice))
    }
    cargar()
  }, [])

  const cargar = async () => {
    setCargando(true)
    try {
      // 1. Cargar negocios y sus usuarios asociados (para jalar PIN/Contraseña)
      const { data: bizData } = await supabase
        .from('businesses')
        .select('*, business_users(*)')
        .order('created_at', { ascending: false })
      if (bizData) setBusinesses(bizData as Business[])

      // 2. Cargar transacciones
      const { data: txData } = await supabase
        .from('credit_transactions')
        .select('*, businesses(nombre)')
        .order('created_at', { ascending: false })
      if (txData) setTransactions(txData as any[])
    } catch (error) {
      console.error('Error al cargar datos:', error)
    }
    setCargando(false)
  }

  // Generador de PIN automático reactivo para formulario de registro
  const generarPasswordRegistro = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghkmnpqrstuvwxyz23456789!@#$'
    let pass = 'VIP!'
    for (let i = 0; i < 4; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setNuevoBiz(prev => ({ ...prev, pin: pass }))
  }

  const guardarPrecioCredito = () => {
    localStorage.setItem('superadmin_precio_credito', String(precioCredito))
    alert(`⚙️ Ajustes Globales Guardados:\nPrecio por crédito establecido en $${precioCredito} MXN`)
  }

  const registrarNegocio = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevoBiz.nombre.trim() || !nuevoBiz.slug.trim() || !nuevoBiz.ownerEmail.trim() || !nuevoBiz.pin.trim()) {
      return alert('Llene todos los campos obligatorios')
    }
    setCreando(true)
    
    try {
      const slugFormateado = nuevoBiz.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
      const duracionMeses = nuevoBiz.plan === 'anual' ? 12 : nuevoBiz.plan === 'semestral' ? 6 : 1
      const fin = new Date()
      fin.setDate(fin.getDate() + (duracionMeses * 30))

      // 1. Crear business
      const { data: biz, error: errBiz } = await supabase
        .from('businesses')
        .insert({
          nombre: nuevoBiz.nombre.trim(),
          slug: slugFormateado,
          owner_name: nuevoBiz.ownerName.trim(),
          owner_email: nuevoBiz.ownerEmail.trim().toLowerCase(),
          plan: nuevoBiz.plan,
          estado: nuevoBiz.plan === 'demo' ? 'demo' : 'activo',
          creditos_totales: Number(nuevoBiz.creditos),
          creditos_usados: Number(nuevoBiz.creditos),
          fecha_vencimiento: fin.toISOString(),
          es_demo: nuevoBiz.plan === 'demo'
        })
        .select()
        .single()

      if (errBiz || !biz) throw errBiz || new Error('Error al registrar el negocio')

      // 2. Crear administrador de comercio en business_users
      const { error: errUser } = await supabase
        .from('business_users')
        .insert({
          business_id: biz.id,
          nombre: nuevoBiz.ownerName.trim() || 'Admin ' + nuevoBiz.nombre,
          email: nuevoBiz.ownerEmail.trim().toLowerCase(),
          pin: nuevoBiz.pin.trim(),
          rol: 'admin_comercio',
          activo: true
        })

      if (errUser) throw errUser

      // 3. Registrar transacción en ledger
      await supabase.from('credit_transactions').insert({
        business_id: biz.id,
        tipo: nuevoBiz.plan === 'demo' ? 'demo' : 'renovacion',
        creditos: Number(nuevoBiz.creditos),
        meses: duracionMeses,
        monto_mxn: nuevoBiz.plan === 'demo' ? 0 : Number(nuevoBiz.creditos) * precioCredito,
        notas: `Carga inicial de ${nuevoBiz.creditos} crédito(s) - Plan ${nuevoBiz.plan.toUpperCase()}`,
        creado_por: 'superadmin'
      })

      alert('✅ Negocio y Administrador SaaS registrados con éxito')
      setModalRegistrar(false)
      setNuevoBiz({
        nombre: '', slug: '', ownerName: '', ownerEmail: '', pin: '9999', plan: 'mensual', creditos: 1
      })
      cargar()
    } catch (err: any) {
      console.error(err)
      alert('Error de registro: ' + err.message)
    } finally {
      setCreando(false)
    }
  }

  const toggleBloqueo = async (b: Business) => {
    const nuevoEstado = !b.bloqueado_manual
    await supabase.from('businesses')
      .update({ bloqueado_manual: nuevoEstado, estado: nuevoEstado ? 'bloqueado' : 'activo' })
      .eq('id', b.id)
    cargar()
  }

  const generarDemo = async (b: Business) => {
    const fin = new Date()
    fin.setDate(fin.getDate() + 30)
    await supabase.from('businesses').update({
      estado: 'demo',
      es_demo: true,
      fecha_vencimiento: fin.toISOString(),
      bloqueado_manual: false,
    }).eq('id', b.id)
    
    await supabase.from('credit_transactions').insert({
      business_id: b.id,
      tipo: 'demo',
      creditos: 1,
      meses: 1,
      monto_mxn: 0,
      notas: 'Demo 30 días activado desde SuperAdmin',
      creado_por: 'superadmin'
    })
    cargar()
  }

  const impersonar = async (b: Business) => {
    // Buscar la cuenta admin vinculada
    const adminUser = b.business_users?.find(u => u.rol === 'admin_comercio')
    const userId = adminUser?.id || 'root'
    const userNombre = adminUser?.nombre || b.owner_name || 'Administrador'

    const base = `; path=/; SameSite=Strict`
    document.cookie = `session_rol=admin_comercio${base}`
    document.cookie = `session_user=${userNombre}${base}`
    document.cookie = `session_business_id=${b.id}${base}`
    document.cookie = `session_user_id=${userId}${base}`

    alert(`🎭 Soporte Técnico - Impersonación Exitosa\nAccediendo al entorno de mostrador de: ${b.nombre}`)
    window.location.href = '/dashboard'
  }

  const cerrarSesion = async () => {
    try { await supabase.auth.signOut() } catch (e) { console.warn(e) }
    localStorage.clear()
    sessionStorage.clear()
    const cookies = ['session_rol','session_user','session_business_id','session_branch_id','session_user_id']
    cookies.forEach(c => document.cookie = `${c}=; path=/; Max-Age=0`)
    window.location.href = '/login'
  }

  const filtrados = businesses.filter(b =>
    b.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    b.slug.toLowerCase().includes(busqueda.toLowerCase()) ||
    (b.owner_name || '').toLowerCase().includes(busqueda.toLowerCase())
  )

  // KPIs calculados
  const activos = businesses.filter(b => b.estado === 'activo' && !b.bloqueado_manual).length
  const demos = businesses.filter(b => b.estado === 'demo').length
  const proximosVencer = businesses.filter(b => {
    const diff = new Date(b.fecha_vencimiento).getTime() - Date.now()
    return diff > 0 && diff < 7 * 86400000
  }).length

  // Métricas financieras
  const totalIngresosHistorial = transactions.reduce((acc, tx) => acc + Number(tx.monto_mxn || 0), 0)
  
  const limite30Dias = new Date()
  limite30Dias.setDate(limite30Dias.getDate() - 30)
  const ingresos30Dias = transactions
    .filter(tx => new Date(tx.created_at) >= limite30Dias)
    .reduce((acc, tx) => acc + Number(tx.monto_mxn || 0), 0)

  const totalCreditosCargados = transactions
    .filter(tx => tx.tipo === 'renovacion' || tx.tipo === 'compra')
    .reduce((acc, tx) => acc + Number(tx.creditos || 0), 0)

  const TABS = [
    { id: 'metricas', label: '📊 Métricas & KPIs', icon: LayoutDashboard },
    { id: 'negocios', label: '🏢 Tenants SaaS', icon: Building2 },
    { id: 'ajustes', label: '⚙️ Ajustes Centrales', icon: Settings },
  ] as const

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#09090b] flex font-sans">
      
      {/* ── BARRA LATERAL (SIDEBAR DE NAVEGACIÓN ESTILO MERCHANT DASHBOARD) ── */}
      <aside className={`bg-white border-r border-[#e4e4e7] transition-all duration-300 flex flex-col justify-between z-30 shrink-0 sticky top-0 h-screen shadow-[1px_0_0_#e4e4e7] ${
        sidebarExpanded ? 'w-64' : 'w-20'
      }`}>
        <div className="flex flex-col">
          {/* Logo Superior */}
          <div className="h-20 border-b border-[#e4e4e7] flex items-center justify-between px-5">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 bg-[#dc2626] rounded-xl flex items-center justify-center shadow-md shadow-red-900/10 shrink-0">
                <span className="text-lg">👑</span>
              </div>
              {sidebarExpanded && (
                <span className="font-bold text-[#09090b] text-sm tracking-tight truncate">
                  LoyaltyApp
                </span>
              )}
            </div>
            <button 
              onClick={() => setSidebarExpanded(!sidebarExpanded)} 
              className="text-[#a1a1aa] hover:text-[#52525b] transition-colors"
            >
              {sidebarExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Menú de Pestañas */}
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
                      ? 'bg-[#fef2f2] text-[#dc2626] border border-red-100 shadow-inner' 
                      : 'text-[#71717a] hover:bg-[#fafafa] hover:text-[#09090b] border border-transparent'
                  }`}
                >
                  <TabIcon className={`w-5 h-5 shrink-0 ${isSelected ? 'text-[#dc2626]' : 'text-[#a1a1aa]'}`} />
                  {sidebarExpanded && <span>{tab.label.split(' ').slice(1).join(' ') || tab.label}</span>}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Footer Sidebar */}
        <div className="p-4 border-t border-[#e4e4e7]">
          {sidebarExpanded && (
            <p className="text-center text-[#a1a1aa] text-[9px] uppercase tracking-widest mt-1 font-mono">
              LoyaltyApp v14 · SaaS Master
            </p>
          )}
        </div>
      </aside>

      {/* ── AREA PRINCIPAL DE CONTENIDO ── */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Cabecera Superior Fija */}
        <header className="h-20 border-b border-[#e4e4e7] bg-white sticky top-0 z-20 px-6 sm:px-8 flex items-center justify-between shadow-[0_1px_0_#e4e4e7]">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[#09090b] flex items-center gap-2">
              {pestaña === 'metricas' ? 'Métricas & KPIs' : pestaña === 'negocios' ? 'Gestión de Tenants' : 'Ajustes Centrales'}
              <span className="text-xs font-semibold uppercase tracking-widest text-[#dc2626] bg-[#fef2f2] border border-red-100 px-2 py-0.5 rounded-full">
                SaaS Center
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {pestaña === 'negocios' && (
              <button
                onClick={() => setModalRegistrar(true)}
                className="btn-primary py-2.5 px-4 text-xs font-bold uppercase tracking-wider shadow-sm"
              >
                ➕ Registrar Negocio
              </button>
            )}
            <button
              onClick={cerrarSesion}
              className="border border-[#e4e4e7] text-[#52525b] hover:text-red-650 hover:bg-red-50 hover:border-red-200 transition-all rounded-xl px-4 py-2.5 text-xs font-bold flex items-center gap-2"
            >
              <LogOut className="w-4 h-4 shrink-0 text-red-600" />
              Cerrar Sesión
            </button>
          </div>
        </header>

        {/* Cuerpo del Contenido */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8 bg-[#fafafa]">
          <div className="max-w-[1200px] mx-auto space-y-6">
            
            {/* ────────────────── TAB: MÈTRICAS ────────────────── */}
            {pestaña === 'metricas' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Grid de Tarjetas KPI */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Suscripciones Activas', valor: activos, sub: 'SaaS Activos en vivo', icono: ShieldCheck, color: 'text-green-600', border: 'border-green-100', bg: 'bg-white' },
                    { label: 'Créditos Vendidos', valor: `${totalCreditosCargados} meses`, sub: 'Ledger de meses cargados', icono: TrendingUp, color: 'text-[#dc2626]', border: 'border-red-100', bg: 'bg-white' },
                    { label: 'Ingresos Históricos', valor: `$${totalIngresosHistorial.toLocaleString()} MXN`, sub: 'Recaudación real acumulada', icono: DollarSign, color: 'text-amber-600', border: 'border-amber-100', bg: 'bg-white' },
                    { label: 'Ingresos (Últimos 30 días)', valor: `$${ingresos30Dias.toLocaleString()} MXN`, sub: 'Facturación del mes corriente', icono: DollarSign, color: 'text-[#dc2626]', border: 'border-red-100', bg: 'bg-white' },
                  ].map((kpi, idx) => {
                    const Icon = kpi.icono
                    return (
                      <div key={idx} className={`bg-white border border-[#e4e4e7] rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group`}>
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <p className="text-[10px] text-[#71717a] uppercase tracking-wider font-semibold">{kpi.label}</p>
                            <p className={`text-2xl font-bold font-mono ${kpi.color}`}>{kpi.valor}</p>
                            <p className="text-[11px] text-[#71717a]">{kpi.sub}</p>
                          </div>
                          <div className="w-10 h-10 rounded-xl bg-[#fafafa] flex items-center justify-center border border-[#e4e4e7]">
                            <Icon className={`w-5 h-5 ${kpi.color} shrink-0`} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Estadísticas de soporte y ledger rápido */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white border border-[#e4e4e7] rounded-2xl p-6 shadow-sm space-y-4">
                    <h3 className="text-xs font-bold uppercase text-[#09090b] tracking-wider flex items-center gap-1.5 border-b border-[#f4f4f5] pb-2.5">
                      🏢 Estadísticas de Tenants
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#71717a]">Total Negocios Registrados:</span>
                        <span className="text-[#09090b] font-bold font-mono">{businesses.length}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#71717a]">En periodo Demo (Gratis):</span>
                        <span className="text-blue-600 font-bold font-mono">{demos}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#71717a]">Vencen en ≤7 días:</span>
                        <span className="text-red-650 font-bold font-mono">{proximosVencer} negocios</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white border border-[#e4e4e7] rounded-2xl p-6 shadow-sm space-y-4">
                    <h3 className="text-xs font-bold uppercase text-[#09090b] tracking-wider flex items-center gap-1.5 border-b border-[#f4f4f5] pb-2.5">
                      ⚙️ Parámetros Globales
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#71717a]">Costo configurado por crédito:</span>
                        <span className="text-amber-600 font-bold font-mono">${precioCredito} MXN / mes</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#71717a]">Servicio de Notificaciones:</span>
                        <span className="text-green-600 font-bold">Activo (WhatsApp Gateway)</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#71717a]">Cargas demo totales en ledger:</span>
                        <span className="text-blue-600 font-mono font-bold">
                          {transactions.filter(tx => tx.tipo === 'demo').length} cargas
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ledger de Transacciones Recientes */}
                <div className="bg-white border border-[#e4e4e7] rounded-2xl overflow-hidden shadow-sm mt-6">
                  <div className="p-6 border-b border-[#e4e4e7] flex justify-between items-center bg-white">
                    <h3 className="text-xs font-bold text-[#09090b] uppercase tracking-wider">
                      📊 Historial de Transacciones SaaS (Ledger)
                    </h3>
                    <span className="text-[10px] text-red-600 font-mono bg-red-50 border border-red-200 px-2.5 py-1 rounded-full uppercase font-bold">
                      En vivo
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-[#fafafa] border-b border-[#e4e4e7]">
                        <tr>
                          {['Fecha', 'Negocio', 'Concepto', 'Créditos', 'Monto (MXN)', 'Cargado Por'].map(h => (
                            <th key={h} className="px-4 py-4 text-left text-[#71717a] font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e4e4e7]">
                        {transactions.slice(0, 10).map(tx => (
                          <tr key={tx.id} className="hover:bg-[#fafafa] transition-colors">
                            <td className="px-4 py-4 font-mono text-[#71717a]">
                              {new Date(tx.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="px-4 py-4 font-bold text-[#09090b]">
                              {tx.businesses?.nombre || 'Negocio Registrado'}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                  tx.tipo === 'demo' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                                  tx.tipo === 'renovacion' ? 'bg-green-50 text-green-600 border border-green-200' :
                                  tx.tipo === 'compra' ? 'bg-purple-50 text-purple-600 border border-purple-200' :
                                  'bg-zinc-50 text-zinc-600 border border-zinc-200'
                                }`}>
                                  {tx.tipo}
                                </span>
                                <span className="text-[#71717a] text-[10px] font-medium">({tx.notas || 'Sin notas'})</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 font-bold text-[#52525b]">
                              +{tx.creditos} mes{tx.creditos !== 1 ? 'es' : ''}
                            </td>
                            <td className="px-4 py-4 font-bold font-mono text-amber-600">
                              {tx.monto_mxn > 0 ? `$${Number(tx.monto_mxn).toLocaleString()} MXN` : 'Gratis (Demo)'}
                            </td>
                            <td className="px-4 py-4 text-[#71717a] uppercase tracking-wider text-[9px] font-semibold">
                              {tx.creado_por || 'system'}
                            </td>
                          </tr>
                        ))}
                        {transactions.length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center py-12 text-[#71717a] uppercase font-bold tracking-wider">
                              No hay transacciones registradas en el ledger
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ────────────────── TAB: TENANTS SAAS ────────────────── */}
            {pestaña === 'negocios' && (
              <div className="bg-white border border-[#e4e4e7] rounded-2xl overflow-hidden shadow-sm animate-fadeIn">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 border-b border-[#e4e4e7]">
                  <h3 className="text-xs font-bold text-[#09090b] uppercase tracking-wider">
                    Lista de Negocios Registrados ({businesses.length})
                  </h3>
                  <div className="relative w-full sm:w-64">
                    <input
                      type="text"
                      value={busqueda}
                      onChange={e => setBusqueda(e.target.value)}
                      placeholder="Buscar negocio, dueño o email..."
                      className="input-clean text-xs pl-9 py-2.5 focus:border-[#dc2626]"
                    />
                    <Search className="w-4 h-4 text-[#a1a1aa] absolute left-3 top-3" />
                  </div>
                </div>

                {cargando ? (
                  <div className="flex justify-center py-16">
                    <div className="w-8 h-8 border-2 border-zinc-200 border-t-[#dc2626] rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-[#fafafa] border-b border-[#e4e4e7]">
                        <tr>
                          {['Acc.', 'LED', 'Nombre / subdominio', 'Credenciales de Acceso', 'Plan', 'Vence en', 'Bloqueado', 'Créditos'].map(h => (
                            <th key={h} className="px-4 py-4 text-left text-[#71717a] font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e4e4e7]">
                        {filtrados.map(b => {
                          const adminUser = b.business_users?.find(u => u.rol === 'admin_comercio')
                          const adminEmail = adminUser?.email || b.owner_email || '—'
                          const adminPin = adminUser?.pin || '—'
                          
                          return (
                            <tr key={b.id} className="hover:bg-[#fafafa] transition-colors group">
                              {/* Acciones */}
                              <td className="px-4 py-4">
                                <ActionMenu
                                  business={b}
                                  onRenovar={() => setModalRenovar(b)}
                                  onHistorial={() => setModalHistorial(b)}
                                  onEditar={() => setModalEditar(b)}
                                  onToggleBloqueo={() => toggleBloqueo(b)}
                                  onImpersonar={() => impersonar(b)}
                                />
                              </td>
                              {/* LED */}
                              <td className="px-4 py-4">
                                <StatusLED estado={b.estado} bloqueado={b.bloqueado_manual} />
                              </td>
                              {/* Nombre */}
                              <td className="px-4 py-4">
                                <p className="font-bold text-[#09090b] text-sm group-hover:text-[#dc2626] transition-colors">{b.nombre}</p>
                                <p className="text-[#71717a] font-mono text-xs">loyaltyapp.vercel.app/{b.slug}</p>
                              </td>
                              {/* Credenciales de Acceso (REQUERIDO) */}
                              <td className="px-4 py-4 min-w-[200px]">
                                <CredentialRow email={adminEmail} pin={adminPin} />
                              </td>
                              {/* Plan */}
                              <td className="px-4 py-4">
                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase whitespace-nowrap ${
                                  b.es_demo ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                  b.plan === 'anual' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                  'bg-zinc-50 text-zinc-600 border border-zinc-200'
                                }`}>
                                  {b.es_demo ? '🎁 Demo 30 Días' : b.plan === 'anual' ? '⭐ Premium Anual' : `📦 ${b.plan}`}
                                </span>
                              </td>
                              {/* Vigencia */}
                              <td className="px-4 py-4">
                                <p className="text-[#52525b] font-mono mb-0.5">
                                  {new Date(b.fecha_vencimiento).toLocaleDateString('es-MX')}
                                </p>
                                <Countdown fechaVencimiento={b.fecha_vencimiento} />
                              </td>
                              {/* Prohibir / Bloquear */}
                              <td className="px-4 py-4">
                                <button
                                  onClick={() => toggleBloqueo(b)}
                                  className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase border transition-all ${
                                    b.bloqueado_manual
                                      ? 'bg-red-50 text-red-650 border-red-200 hover:bg-red-100'
                                      : 'bg-green-50 text-green-650 border-green-200 hover:bg-green-100'
                                  }`}
                                >
                                  {b.bloqueado_manual ? 'SÍ' : 'NO'}
                                </button>
                              </td>
                              {/* Créditos */}
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-[#f4f4f5] rounded-full overflow-hidden w-16 border border-[#e4e4e7]">
                                    <div
                                      className="h-full bg-gradient-to-r from-[#dc2626] to-[#ef4444] rounded-full transition-all"
                                      style={{ width: `${b.creditos_totales > 0 ? (b.creditos_usados / b.creditos_totales) * 100 : 0}%` }}
                                    />
                                  </div>
                                  <span className="text-[#52525b] font-mono font-bold">
                                    {b.creditos_usados}/{b.creditos_totales}
                                  </span>
                                </div>
                                <button
                                  onClick={() => generarDemo(b)}
                                  className="mt-1 text-[9px] text-[#dc2626] hover:text-red-750 font-bold uppercase tracking-wider block"
                                >
                                  + Demo 30d
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    {filtrados.length === 0 && !cargando && (
                      <div className="text-center py-16 text-[#71717a]">
                        <p className="text-4xl mb-3">🏢</p>
                        <p className="font-bold uppercase tracking-wider text-xs">No se encontraron resultados</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ────────────────── TAB: AJUSTES CENTRALES ────────────────── */}
            {pestaña === 'ajustes' && (
              <div className="bg-white border border-[#e4e4e7] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm animate-fadeIn">
                <div>
                  <h3 className="font-bold text-base text-[#09090b] mb-1">⚙️ Ajustes Globales de Facturación SaaS</h3>
                  <p className="text-[#71717a] text-xs">Configura los parámetros financieros del núcleo LoyaltyApp.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-[#f4f4f5] pt-6">
                  <div className="space-y-2">
                    <label className="text-[10px] text-[#52525b] uppercase font-bold block">Costo unitario por crédito/mes (MXN)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={precioCredito}
                        onChange={e => setPrecioCredito(Number(e.target.value))}
                        className="input-clean pl-9 text-sm font-mono text-[#09090b] font-bold focus:border-[#dc2626]"
                      />
                      <DollarSign className="w-4 h-4 text-[#71717a] absolute left-3 top-3.5" />
                    </div>
                    <p className="text-[10px] text-[#71717a]">Este valor se utilizará para calcular los ingresos del panel y los importes en modales de renovación.</p>
                  </div>

                  <div className="space-y-2 bg-[#fafafa] border border-[#e4e4e7] rounded-xl p-4 flex flex-col justify-center">
                    <p className="text-xs font-bold text-[#dc2626]">¿Cómo funciona?</p>
                    <p className="text-[11px] text-[#52525b] leading-relaxed mt-1">
                      Cada crédito equivale a **1 mes de suscripción activa** para cualquier negocio registrado. Al ajustar el costo, los cálculos de renovación y creación facturarán automáticamente a este nuevo valor configurado en el sistema.
                    </p>
                  </div>
                </div>

                <div className="border-t border-[#f4f4f5] pt-6 flex justify-end">
                  <button
                    onClick={guardarPrecioCredito}
                    className="btn-primary px-6 py-3 text-xs uppercase tracking-wider"
                  >
                    💾 Guardar Ajustes Centrales
                  </button>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ── MODAL: REGISTRAR TENANT SAAS (Clean Canvas) ── */}
      {modalRegistrar && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e4e4e7] rounded-2xl p-6 sm:p-8 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold text-[#09090b]">Registrar Nuevo Negocio</h2>
                <p className="text-[#71717a] text-xs">Crea un Tenant SaaS y su cuenta de mostrador</p>
              </div>
              <button onClick={() => setModalRegistrar(false)} className="text-[#a1a1aa] hover:text-[#52525b] text-lg font-bold">✕</button>
            </div>

            <form onSubmit={registrarNegocio} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-[#52525b] uppercase font-bold block mb-1">Nombre del Negocio *</label>
                  <input
                    type="text"
                    value={nuevoBiz.nombre}
                    onChange={e => setNuevoBiz(prev => ({ ...prev, nombre: e.target.value }))}
                    placeholder="Ej: Tacos El Padrino"
                    className="input-clean text-xs focus:border-[#dc2626]"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#52525b] uppercase font-bold block mb-1">Subdominio / Slug *</label>
                  <input
                    type="text"
                    value={nuevoBiz.slug}
                    onChange={e => setNuevoBiz(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="Ej: elpadrino"
                    className="input-clean text-xs focus:border-[#dc2626]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-[#52525b] uppercase font-bold block mb-1">Dueño (Nombre)</label>
                  <input
                    type="text"
                    value={nuevoBiz.ownerName}
                    onChange={e => setNuevoBiz(prev => ({ ...prev, ownerName: e.target.value }))}
                    placeholder="Ej: Pedro Infante"
                    className="input-clean text-xs focus:border-[#dc2626]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#52525b] uppercase font-bold block mb-1">Dueño (Email / Usuario) *</label>
                  <input
                    type="email"
                    value={nuevoBiz.ownerEmail}
                    onChange={e => setNuevoBiz(prev => ({ ...prev, ownerEmail: e.target.value }))}
                    placeholder="Ej: pedro@mail.com"
                    className="input-clean text-xs focus:border-[#dc2626]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] text-[#52525b] uppercase font-bold">Contraseña / PIN *</label>
                    <button
                      type="button"
                      onClick={generarPasswordRegistro}
                      className="text-[9px] text-[#dc2626] hover:text-red-750 font-bold uppercase tracking-wider"
                    >
                      ⚡ Generar
                    </button>
                  </div>
                  <input
                    type="text"
                    value={nuevoBiz.pin}
                    onChange={e => setNuevoBiz(prev => ({ ...prev, pin: e.target.value }))}
                    placeholder="Ej: 9999"
                    className="input-clean text-xs font-mono text-center focus:border-[#dc2626]"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#52525b] uppercase font-bold block mb-1">Plan Contratado *</label>
                  <select
                    value={nuevoBiz.plan}
                    onChange={e => setNuevoBiz(prev => ({ ...prev, plan: e.target.value }))}
                    className="input-clean text-xs bg-[#fafafa] border-[#e4e4e7] text-[#09090b] focus:border-[#dc2626] font-sans"
                  >
                    <option value="mensual">Mensual (1 Crédito)</option>
                    <option value="semestral">Semestral (6 Créditos)</option>
                    <option value="anual">Anual (12 Créditos)</option>
                    <option value="demo">Demo Gratis (30 días)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#52525b] uppercase font-bold block mb-1">Créditos a Cargar *</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={nuevoBiz.creditos}
                  onChange={e => setNuevoBiz(prev => ({ ...prev, creditos: Number(e.target.value) }))}
                  className="input-clean text-xs focus:border-[#dc2626]"
                  required
                />
              </div>

              <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-xl p-4 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#71717a]">Transacción:</span>
                  <span className="text-[#dc2626] font-bold">Carga de Tenant</span>
                </div>
                <div className="flex justify-between border-t border-[#e4e4e7] pt-2 mt-2">
                  <span className="text-[#09090b] font-bold">Costo Final MXN:</span>
                  <span className="text-amber-600 font-bold">
                    ${nuevoBiz.plan === 'demo' ? 0 : (Number(nuevoBiz.creditos) * precioCredito).toLocaleString()} MXN
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalRegistrar(false)}
                  className="flex-1 border border-[#e4e4e7] text-[#52525b] font-bold py-2.5 rounded-xl text-xs hover:bg-[#fafafa] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creando}
                  className="flex-1 btn-primary py-2.5 text-xs disabled:opacity-50"
                >
                  {creando ? 'Registrando...' : '🚀 Guardar y Cargar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modales Adicionales */}
      {modalRenovar && (
        <RenovarModal
          business={modalRenovar}
          precioMes={precioCredito}
          onClose={() => setModalRenovar(null)}
          onSuccess={() => { setModalRenovar(null); cargar() }}
        />
      )}
      {modalHistorial && (
        <HistorialModal
          business={modalHistorial}
          onClose={() => setModalHistorial(null)}
        />
      )}
      {modalEditar && (
        <EditarBusinessModal
          business={modalEditar}
          onClose={() => setModalEditar(null)}
          onSuccess={() => { setModalEditar(null); cargar() }}
        />
      )}

    </div>
  )
}

// ── MODAL: AJUSTAR Y RENOVAR SUSCRIPCIÓN (Clean Canvas) ──
function RenovarModal({
  business,
  precioMes,
  onClose,
  onSuccess,
}: {
  business: Business
  precioMes: number
  onClose: () => void
  onSuccess: () => void
}) {
  const [meses, setMeses] = useState(1)
  const [esDemo, setEsDemo] = useState(false)
  const [cargando, setCargando] = useState(false)

  const renovar = async () => {
    setCargando(true)
    const fechaActual = new Date(business.fecha_vencimiento)
    const nuevaFecha = new Date(fechaActual)
    nuevaFecha.setDate(nuevaFecha.getDate() + (meses * 30))

    const nuevosCreditos = esDemo ? business.creditos_usados : Math.max(0, business.creditos_usados + meses)
    const nuevoTotal = esDemo ? business.creditos_totales : Math.max(0, business.creditos_totales + meses)

    await supabase.from('businesses').update({
      fecha_vencimiento: nuevaFecha.toISOString(),
      estado: esDemo ? 'demo' : (nuevaFecha < new Date() ? 'vencido' : 'activo'),
      creditos_usados: nuevosCreditos,
      creditos_totales: nuevoTotal,
      es_demo: esDemo,
      bloqueado_manual: false,
    }).eq('id', business.id)

    await supabase.from('credit_transactions').insert({
      business_id: business.id,
      tipo: esDemo ? 'demo' : (meses < 0 ? 'ajuste_manual' : 'renovacion'),
      creditos: meses,
      meses,
      monto_mxn: esDemo ? 0 : meses * precioMes,
      notas: esDemo 
        ? `Demo de ${meses} mes(es) ajustado` 
        : meses < 0 
          ? `Debitar/Deducción manual de ${Math.abs(meses)} crédito(s)` 
          : `Renovación de ${meses} mes(es)`,
      creado_por: 'superadmin',
    })

    setCargando(false)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#e4e4e7] rounded-2xl p-6 sm:p-8 w-full max-w-md shadow-xl animate-fadeIn">
        <h2 className="text-lg font-bold text-[#09090b] mb-1">Ajustar / Renovar Suscripción</h2>
        <p className="text-[#71717a] text-xs mb-6">{business.nombre}</p>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] text-[#52525b] uppercase font-bold block mb-2">
              Meses / Ajuste de Créditos (Suma o Resta)
            </label>
            <div className="flex items-center justify-center gap-4">
              <button 
                onClick={() => setMeses(Math.max(-12, meses - 1))}
                className="w-10 h-10 rounded-lg bg-[#fafafa] border border-[#e4e4e7] text-[#09090b] font-bold hover:bg-[#f4f4f5] transition-colors"
              >
                −
              </button>
              <span className="text-3xl font-bold text-[#09090b] w-16 text-center">{meses > 0 ? `+${meses}` : meses}</span>
              <button 
                onClick={() => setMeses(Math.min(24, meses + 1))}
                className="w-10 h-10 rounded-lg bg-[#fafafa] border border-[#e4e4e7] text-[#09090b] font-bold hover:bg-[#f4f4f5] transition-colors"
              >
                +
              </button>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer bg-blue-50 border border-blue-100 rounded-xl p-4">
            <input 
              type="checkbox" 
              checked={esDemo} 
              onChange={e => setEsDemo(e.target.checked)}
              className="w-4 h-4 accent-blue-650" 
            />
            <div>
              <p className="text-sm font-bold text-blue-600">Modo Demo (Gratis)</p>
              <p className="text-[11px] text-[#52525b]">No consume créditos de facturación</p>
            </div>
          </label>

          <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-xl p-4 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-[#71717a]">Duración:</span>
              <span className="text-[#09090b] font-bold">
                {meses < 0 
                  ? `Reducción: ${Math.abs(meses)} mes(es) (-${Math.abs(meses) * 30} días)` 
                  : `Aumento: ${meses} mes(es) (+${meses * 30} días)`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#71717a]">Tipo:</span>
              <span className={`font-bold uppercase ${esDemo ? 'text-blue-600' : (meses < 0 ? 'text-red-650' : 'text-green-600')}`}>
                {esDemo ? 'DEMO (Regalo)' : (meses < 0 ? 'DEDUCCIÓN' : 'COMPRADO')}
              </span>
            </div>
            {!esDemo && (
              <div className="flex justify-between border-t border-[#e4e4e7] pt-2 mt-2">
                <span className="text-[#09090b] font-bold">Ajuste MXN:</span>
                <span className={`font-bold text-base ${meses < 0 ? 'text-red-650' : 'text-amber-600'}`}>
                  {meses < 0 ? `-$${Math.abs(meses * precioMes).toLocaleString()}` : `$${(meses * precioMes).toLocaleString()}`}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button 
            onClick={onClose}
            className="flex-1 border border-[#e4e4e7] text-[#52525b] font-bold py-2.5 rounded-xl text-xs hover:bg-[#fafafa] transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={renovar} 
            disabled={cargando}
            className="flex-1 btn-primary py-2.5 text-xs disabled:opacity-50"
          >
            {cargando ? 'Procesando...' : `Confirmar`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL: HISTORIAL DE TRANSACCIONES SAAS (Clean Canvas) ──
function HistorialModal({ business, onClose }: { business: Business; onClose: () => void }) {
  const [historial, setHistorial] = useState<CreditTransaction[]>([])

  useEffect(() => {
    supabase.from('credit_transactions')
      .select('*')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setHistorial(data) })
  }, [business.id])

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#e4e4e7] rounded-2xl p-6 sm:p-8 w-full max-w-lg shadow-xl max-h-[80vh] overflow-hidden flex flex-col animate-fadeIn">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#09090b]">Historial del Comercio</h2>
            <p className="text-[#71717a] text-xs">{business.nombre}</p>
          </div>
          <button onClick={onClose} className="text-[#a1a1aa] hover:text-[#52525b] text-lg font-bold">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 space-y-3 pr-1">
          {historial.length === 0 ? (
            <p className="text-[#a1a1aa] text-xs text-center py-8">Sin historial de transacciones en el ledger</p>
          ) : (
            historial.map(tx => (
              <div key={tx.id} className="bg-[#fafafa] border border-[#e4e4e7] rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      tx.tipo === 'demo' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                      tx.tipo === 'renovacion' ? 'bg-green-50 text-green-600 border border-green-100' :
                      'bg-zinc-50 text-zinc-600 border border-zinc-200'
                    }`}>{tx.tipo}</span>
                     <p className="text-[#09090b] font-bold text-xs mt-1.5">{tx.notas || '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-600 font-bold">+{tx.creditos} mes{tx.creditos !== 1 ? 'es' : ''}</p>
                    {tx.monto_mxn > 0 && <p className="text-[#71717a] text-[10px] font-mono">${tx.monto_mxn.toLocaleString()} MXN</p>}
                  </div>
                </div>
                <p className="text-[#a1a1aa] text-[9px] mt-2 font-mono">
                  {new Date(tx.created_at).toLocaleString('es-MX')}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── MODAL: EDITAR NEGOCIO / SUSCRIPCIÓN (Clean Canvas) ──
function EditarBusinessModal({
  business,
  onClose,
  onSuccess,
}: {
  business: Business
  onClose: () => void
  onSuccess: () => void
}) {
  const [nombre, setNombre] = useState(business.nombre)
  const [slug, setSlug] = useState(business.slug)
  const [ownerName, setOwnerName] = useState(business.owner_name || '')
  const [ownerEmail, setOwnerEmail] = useState(business.owner_email || '')
  const [plan, setPlan] = useState(business.plan)
  const [estado, setEstado] = useState(business.estado)
  const [esDemo, setEsDemo] = useState(business.es_demo)
  const [fechaVencimiento, setFechaVencimiento] = useState(business.fecha_vencimiento ? business.fecha_vencimiento.substring(0, 16) : '')
  const [creditosTotales, setCreditosTotales] = useState(business.creditos_totales)
  const [creditosUsados, setCreditosUsados] = useState(business.creditos_usados)
  
  // Buscar PIN/Contraseña actual de la base de datos
  const adminUser = business.business_users?.find(u => u.rol === 'admin_comercio')
  const [nuevoPin, setNuevoPin] = useState(adminUser?.pin || '')
  const [cargando, setCargando] = useState(false)

  // Generador de PIN/Contraseñas reactivo
  const generarPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghkmnpqrstuvwxyz23456789!@#$'
    let pass = 'VIP!'
    for (let i = 0; i < 4; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setNuevoPin(pass)
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setCargando(true)
    
    try {
      // 1. Actualizar negocio
      const { error } = await supabase
        .from('businesses')
        .update({
          nombre,
          slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''),
          owner_name: ownerName,
          owner_email: ownerEmail.trim().toLowerCase(),
          plan,
          estado,
          es_demo: esDemo,
          fecha_vencimiento: new Date(fechaVencimiento).toISOString(),
          creditos_totales: Number(creditosTotales),
          creditos_usados: Number(creditosUsados)
        })
        .eq('id', business.id)

      if (error) throw error

      // 2. Si se ingresó/modificó el PIN/Contraseña, actualizarla en business_users del dueño
      if (nuevoPin.trim()) {
        const { error: pinError } = await supabase
          .from('business_users')
          .update({ 
            pin: nuevoPin.trim(),
            email: ownerEmail.trim().toLowerCase(),
            nombre: ownerName.trim()
          })
          .eq('business_id', business.id)
          .eq('rol', 'admin_comercio')
        
        if (pinError) throw pinError
      }

      alert('✅ Negocio y Credenciales actualizados con éxito absoluto')
      onSuccess()
    } catch (err: any) {
      alert('Error al actualizar el negocio: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  const eliminarNegocio = async () => {
    if (!confirm(`¿ESTÁS ABSOLUTAMENTE SEGURO de eliminar el negocio "${business.nombre}"?\nEsta acción es irreversible y borrará sucursales, cajeros, clientes, menús y TODO el historial.`)) return
    if (prompt(`Escribe el nombre del negocio "${business.nombre}" para confirmar la eliminación:`) !== business.nombre) {
      return alert('Confirmación incorrecta. Eliminación cancelada.')
    }
    setCargando(true)
    const { error } = await supabase.from('businesses').delete().eq('id', business.id)
    if (error) {
      alert('Error al eliminar el negocio: ' + error.message)
    } else {
      alert('🗑️ Negocio eliminado con éxito')
      onSuccess()
    }
    setCargando(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#e4e4e7] rounded-2xl p-6 sm:p-8 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto animate-fadeIn">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#09090b]">Editar Negocio / Suscripción</h2>
            <p className="text-[#71717a] text-xs">Gestión y auditoría de accesos del comercio</p>
          </div>
          <button onClick={onClose} className="text-[#a1a1aa] hover:text-[#52525b] text-lg font-bold">✕</button>
        </div>

        <form onSubmit={guardar} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-[#52525b] uppercase font-bold block mb-1">Nombre del Negocio *</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                className="input-clean text-xs focus:border-[#dc2626]"
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-[#52525b] uppercase font-bold block mb-1">Subdominio / Slug *</label>
              <input
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                className="input-clean text-xs font-mono focus:border-[#dc2626]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-[#52525b] uppercase font-bold block mb-1">Dueño (Nombre)</label>
              <input
                type="text"
                value={ownerName}
                onChange={e => setOwnerName(e.target.value)}
                className="input-clean text-xs focus:border-[#dc2626]"
              />
            </div>
            <div>
              <label className="text-[10px] text-[#52525b] uppercase font-bold block mb-1">Dueño (Email / Usuario) *</label>
              <input
                type="email"
                value={ownerEmail}
                onChange={e => setOwnerEmail(e.target.value)}
                className="input-clean text-xs focus:border-[#dc2626]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] text-[#52525b] uppercase font-bold block mb-1">Plan</label>
              <select
                value={plan}
                onChange={e => setPlan(e.target.value)}
                className="input-clean text-xs bg-[#fafafa] border-[#e4e4e7] text-[#09090b] focus:border-[#dc2626] font-sans"
              >
                <option value="gratis">Gratis</option>
                <option value="mensual">Mensual</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual</option>
                <option value="demo">Demo</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#52525b] uppercase font-bold block mb-1">Estado</label>
              <select
                value={estado}
                onChange={e => setEstado(e.target.value as any)}
                className="input-clean text-xs bg-[#fafafa] border-[#e4e4e7] text-[#09090b] focus:border-[#dc2626] font-sans"
              >
                <option value="activo">Activo</option>
                <option value="demo">Demo</option>
                <option value="vencido">Vencido</option>
                <option value="bloqueado">Bloqueado</option>
              </select>
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={esDemo}
                  onChange={e => setEsDemo(e.target.checked)}
                  className="w-4 h-4 accent-[#dc2626]"
                />
                <span className="text-[10px] text-[#3f3f46] uppercase font-bold select-none">Es Demo</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] text-[#52525b] uppercase font-bold block mb-1">Créditos Usados *</label>
              <input
                type="number"
                value={creditosUsados}
                onChange={e => setCreditosUsados(Number(e.target.value))}
                className="input-clean text-xs focus:border-[#dc2626]"
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-[#52525b] uppercase font-bold block mb-1">Créditos Totales *</label>
              <input
                type="number"
                value={creditosTotales}
                onChange={e => setCreditosTotales(Number(e.target.value))}
                className="input-clean text-xs focus:border-[#dc2626]"
                required
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] text-[#52525b] uppercase font-bold">Cambiar PIN *</label>
                <button
                  type="button"
                  onClick={generarPassword}
                  className="text-[9px] text-[#dc2626] hover:text-red-750 font-bold uppercase tracking-wider"
                >
                  ⚡ Generar
                </button>
              </div>
              <input
                type="text"
                value={nuevoPin}
                onChange={e => setNuevoPin(e.target.value)}
                placeholder="Pin / Clave"
                className="input-clean text-xs font-mono text-center focus:border-[#dc2626]"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[#52525b] uppercase font-bold block mb-1">Fecha de Vencimiento *</label>
            <input
              type="datetime-local"
              value={fechaVencimiento}
              onChange={e => setFechaVencimiento(e.target.value)}
              className="input-clean text-xs focus:border-[#dc2626]"
              required
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#f4f4f5] justify-between items-center">
            <button
              type="button"
              onClick={eliminarNegocio}
              disabled={cargando}
              className="w-full sm:w-auto bg-red-50 border border-red-200 text-red-650 hover:bg-red-100 hover:text-red-750 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all px-4"
            >
              🗑️ Eliminar Negocio
            </button>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-[#e4e4e7] text-[#52525b] font-bold py-2.5 rounded-xl text-xs hover:bg-[#fafafa] transition-colors px-4"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={cargando}
                className="flex-1 btn-primary py-2.5 text-xs px-6 disabled:opacity-50"
              >
                {cargando ? 'Guardando...' : '💾 Guardar Cambios'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
