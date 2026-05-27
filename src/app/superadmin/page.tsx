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
  Download
} from 'lucide-react'

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

// ── Componente: Contador regresivo ─────────────────────────────────────────
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
    <span className={`font-mono text-xs font-black ${critico ? 'text-red-400 animate-pulse' : 'text-zinc-400'}`}>
      {tiempo}
    </span>
  )
}

// ── Componente: LED de estado ──────────────────────────────────────────────
function StatusLED({ estado, bloqueado }: { estado: string; bloqueado: boolean }) {
  if (bloqueado) return <span className="w-2.5 h-2.5 rounded-full bg-zinc-650 inline-block shadow-sm" title="Bloqueado" />
  const colores: Record<string, string> = {
    activo: 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]',
    demo: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]',
    vencido: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]',
    bloqueado: 'bg-zinc-650',
  }
  return <span className={`w-2.5 h-2.5 rounded-full inline-block ${colores[estado] || 'bg-zinc-600'}`} />
}

// ── Componente: Menú de acción flotante ────────────────────────────────────
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
        className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors flex items-center justify-center text-zinc-400 hover:text-white text-xs font-bold"
      >
        ⋮
      </button>
      {open && (
        <div className="absolute left-8 top-0 z-50 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden min-w-[180px] animate-in fade-in zoom-in-95 duration-100">
          <button
            onClick={() => { onImpersonar(); setOpen(false) }}
            className="w-full px-4 py-2.5 text-left text-xs font-bold text-purple-450 hover:bg-zinc-900 hover:text-purple-300 transition-colors flex items-center gap-2 border-b border-zinc-900"
          >
            🎭 Impersonar
          </button>
          <button
            onClick={() => { onHistorial(); setOpen(false) }}
            className="w-full px-4 py-2.5 text-left text-xs font-bold text-zinc-350 hover:bg-zinc-900 hover:text-white transition-colors flex items-center gap-2 border-b border-zinc-900"
          >
            📋 Ver Historial
          </button>
          <button
            onClick={() => { onRenovar(); setOpen(false) }}
            className="w-full px-4 py-2.5 text-left text-xs font-bold text-green-450 hover:bg-zinc-900 hover:text-green-300 transition-colors flex items-center gap-2 border-b border-zinc-900"
          >
            🔄 Renovar Susc.
          </button>
          <button
            onClick={() => { onEditar(); setOpen(false) }}
            className="w-full px-4 py-2.5 text-left text-xs font-bold text-blue-450 hover:bg-zinc-900 hover:text-blue-300 transition-colors flex items-center gap-2 border-b border-zinc-900"
          >
            ✏️ Editar / Ajustar
          </button>
          <button
            onClick={() => { onToggleBloqueo(); setOpen(false) }}
            className={`w-full px-4 py-2.5 text-left text-xs font-bold transition-colors flex items-center gap-2 ${
              business.bloqueado_manual
                ? 'text-green-400 hover:bg-zinc-900'
                : 'text-red-400 hover:bg-zinc-900'
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
      // 1. Cargar negocios
      const { data: bizData } = await supabase
        .from('businesses')
        .select('*')
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

      // 2. Crear administrador de comercio
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

      // 3. Registrar transacción
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
    const { data: user } = await supabase
      .from('business_users')
      .select('*')
      .eq('business_id', b.id)
      .eq('rol', 'admin_comercio')
      .maybeSingle()

    const userId = user?.id || 'root'
    const userNombre = user?.nombre || b.owner_name || 'Administrador'

    const base = `; path=/; SameSite=Strict`
    document.cookie = `session_rol=admin_comercio${base}`
    document.cookie = `session_user=${userNombre}${base}`
    document.cookie = `session_business_id=${b.id}${base}`
    document.cookie = `session_user_id=${userId}${base}`

    alert(`🎭 Impersonación Exitosa (Soporte Técnico)\nCargando entorno de mostrador de: ${b.nombre}`)
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

  // KPIs dinámicos calculados a través del Ledger SQL de transacciones
  const activos = businesses.filter(b => b.estado === 'activo' && !b.bloqueado_manual).length
  const demos = businesses.filter(b => b.estado === 'demo').length
  const proximosVencer = businesses.filter(b => {
    const diff = new Date(b.fecha_vencimiento).getTime() - Date.now()
    return diff > 0 && diff < 7 * 86400000
  }).length

  // Métricas financieras a partir del Ledger real
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
    <div className="min-h-screen bg-[#0a0a0a] text-white flex font-sans">
      
      {/* ── SIDEBAR DE NAVEGACIÓN LATERAL (ESTILO TRIAL MERCHANT DASHBOARD) ── */}
      <aside className={`bg-[#0c0c0c] border-r border-zinc-900 transition-all duration-300 flex flex-col justify-between z-30 shrink-0 sticky top-0 h-screen ${
        sidebarExpanded ? 'w-64' : 'w-20'
      }`}>
        <div className="flex flex-col">
          {/* Logo Superior */}
          <div className="h-20 border-b border-zinc-900 flex items-center justify-between px-5">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 bg-gradient-to-br from-purple-700 to-purple-900 rounded-xl flex items-center justify-center shadow-lg shadow-purple-950/20 shrink-0">
                <span className="text-lg">👑</span>
              </div>
              {sidebarExpanded && (
                <span className="font-serif font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-300">
                  LoyaltyApp
                </span>
              )}
            </div>
            <button 
              onClick={() => setSidebarExpanded(!sidebarExpanded)} 
              className="text-zinc-500 hover:text-white transition-colors"
            >
              {sidebarExpanded ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
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
                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-inner' 
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  <TabIcon className={`w-5 h-5 shrink-0 ${isSelected ? 'text-purple-400' : 'text-zinc-500'}`} />
                  {sidebarExpanded && <span>{tab.label.split(' ').slice(1).join(' ') || tab.label}</span>}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Footer Sidebar */}
        <div className="p-4 border-t border-zinc-900">
          {sidebarExpanded && (
            <p className="text-center text-zinc-700 text-[9px] uppercase tracking-widest mt-1 font-mono">
              LoyaltyApp v12 · SaaS Master
            </p>
          )}
        </div>
      </aside>

      {/* ── AREA PRINCIPAL DE CONTENIDO ── */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Cabecera Superior Fija */}
        <header className="h-20 border-b border-zinc-900 bg-[#0c0c0c]/85 backdrop-blur-md sticky top-0 z-20 px-6 sm:px-8 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-serif font-black truncate">
              {pestaña === 'metricas' ? 'Métricas & KPIs' : pestaña === 'negocios' ? 'Gestión de Tenants' : 'Ajustes Centrales'}
              <span className="ml-2.5 text-xs font-sans font-bold uppercase tracking-widest text-purple-450">
                SaaS Control Center
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {pestaña === 'negocios' && (
              <button
                onClick={() => setModalRegistrar(true)}
                className="bg-gradient-to-r from-purple-700 to-purple-900 text-white font-black px-5 py-3 rounded-xl text-xs uppercase tracking-widest hover:brightness-110 transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)]"
              >
                ➕ Registrar Negocio
              </button>
            )}
            <button
              onClick={cerrarSesion}
              className="bg-red-955/20 hover:bg-red-955/40 border border-red-900/30 rounded-xl px-4 py-2.5 text-xs font-bold text-red-400 hover:text-red-300 transition-all flex items-center gap-2"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Cerrar Sesión
            </button>
          </div>
        </header>

        {/* Cuerpo del Contenido */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-10 relative">
          {/* Luz Púrpura de fondo */}
          <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-900/5 rounded-full blur-[200px] pointer-events-none z-0" />

          <div className="max-w-[1200px] mx-auto space-y-8 relative z-10">
            
            {/* ────────────────── TAB: MÈTRICAS ────────────────── */}
            {pestaña === 'metricas' && (
              <div className="space-y-8 animate-in fade-in duration-200">
                {/* Grid de Tarjetas KPI */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Suscripciones Activas', valor: activos, sub: 'SaaS Activos en vivo', icono: ShieldCheck, color: 'text-green-400', bg: 'from-green-950/20 to-green-900/10', border: 'border-green-900/30' },
                    { label: 'Créditos Totales Vendidos', valor: `${totalCreditosCargados} meses`, sub: 'Ledger de meses cargados', icono: TrendingUp, color: 'text-purple-400', bg: 'from-purple-950/20 to-purple-900/10', border: 'border-purple-900/30' },
                    { label: 'Ingresos Históricos', valor: `$${totalIngresosHistorial.toLocaleString()} MXN`, sub: 'Recaudación real acumulada', icono: DollarSign, color: 'text-amber-450', bg: 'from-amber-950/20 to-amber-900/10', border: 'border-amber-900/30' },
                    { label: 'Ingresos (Últimos 30 días)', valor: `$${ingresos30Dias.toLocaleString()} MXN`, sub: 'Facturación del mes corriente', icono: DollarSign, color: 'text-fuchsia-400', bg: 'from-fuchsia-950/20 to-fuchsia-900/10', border: 'border-fuchsia-900/30' },
                  ].map((kpi, idx) => {
                    const Icon = kpi.icono
                    return (
                      <div key={idx} className={`bg-gradient-to-br ${kpi.bg} border ${kpi.border} rounded-2xl p-5 relative overflow-hidden group`}>
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">{kpi.label}</p>
                            <p className={`text-2xl font-black ${kpi.color}`}>{kpi.valor}</p>
                            <p className="text-[10px] text-zinc-400">{kpi.sub}</p>
                          </div>
                          <Icon className={`w-8 h-8 ${kpi.color} opacity-40 shrink-0`} />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Métricas y Datos rápidos */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-6 space-y-4">
                    <h3 className="text-sm font-black uppercase text-zinc-355 tracking-wider">📊 Estadísticas de Tenants</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500">Total Negocios Registrados:</span>
                        <span className="text-white font-bold">{businesses.length}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500">En periodo Demo (Gratis):</span>
                        <span className="text-blue-400 font-bold">{demos}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500">Vencen en ≤7 días:</span>
                        <span className="text-red-400 font-bold">{proximosVencer} negocios</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-6 space-y-4">
                    <h3 className="text-sm font-black uppercase text-zinc-355 tracking-wider">🔒 Parámetros Globales</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500">Costo configurado por crédito:</span>
                        <span className="text-amber-500 font-bold font-mono">${precioCredito} MXN / mes</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500">Servicio de Notificaciones:</span>
                        <span className="text-green-400 font-bold">Activo (WhatsApp Gateway)</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500">Cargas demo totales en ledger:</span>
                        <span className="text-blue-400 font-mono font-bold">
                          {transactions.filter(tx => tx.tipo === 'demo').length} cargas
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ledger de Transacciones Recientes */}
                <div className="bg-[#0c0c0c] border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl mt-8">
                  <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
                    <h3 className="text-xs font-black text-zinc-300 uppercase tracking-widest">
                      📊 Historial de Transacciones SaaS (Ledger)
                    </h3>
                    <span className="text-[10px] text-purple-400 font-mono bg-purple-955/30 border border-purple-900/40 px-2.5 py-1 rounded-full uppercase font-black">
                      En vivo
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-black/40 border-b border-zinc-900">
                        <tr>
                          {['Fecha', 'Negocio', 'Concepto', 'Créditos', 'Monto (MXN)', 'Cargado Por'].map(h => (
                            <th key={h} className="px-4 py-4 text-left text-zinc-500 font-black uppercase tracking-widest whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900">
                        {transactions.slice(0, 10).map(tx => (
                          <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-4 py-4 font-mono text-zinc-400">
                              {new Date(tx.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="px-4 py-4 font-bold text-white">
                              {tx.businesses?.nombre || 'Negocio Registrado'}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                  tx.tipo === 'demo' ? 'bg-blue-955 text-blue-400 border border-blue-900/30' :
                                  tx.tipo === 'renovacion' ? 'bg-green-955 text-green-400 border border-green-900/30' :
                                  tx.tipo === 'compra' ? 'bg-purple-955 text-purple-450 border border-purple-900/30' :
                                  'bg-zinc-850 text-zinc-400 border border-zinc-800'
                                }`}>
                                  {tx.tipo}
                                </span>
                                <span className="text-zinc-500 text-[10px] font-medium">({tx.notas || 'Sin notas'})</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 font-bold text-zinc-300">
                              +{tx.creditos} mes{tx.creditos !== 1 ? 'es' : ''}
                            </td>
                            <td className="px-4 py-4 font-black font-mono text-amber-450">
                              {tx.monto_mxn > 0 ? `$${Number(tx.monto_mxn).toLocaleString()} MXN` : 'Gratis (Demo)'}
                            </td>
                            <td className="px-4 py-4 text-zinc-500 uppercase tracking-widest text-[9px] font-bold">
                              {tx.creado_por || 'system'}
                            </td>
                          </tr>
                        ))}
                        {transactions.length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center py-12 text-zinc-600 uppercase font-black tracking-widest">
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
              <div className="bg-[#0c0c0c] border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 border-b border-zinc-900">
                  <h3 className="text-xs font-black text-zinc-300 uppercase tracking-widest">
                    Lista de Negocios Registrados ({businesses.length})
                  </h3>
                  <div className="relative w-full sm:w-64">
                    <input
                      type="text"
                      value={busqueda}
                      onChange={e => setBusqueda(e.target.value)}
                      placeholder="Buscar por negocio o dueño..."
                      className="w-full bg-black/50 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-600 font-medium"
                    />
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
                  </div>
                </div>

                {cargando ? (
                  <div className="flex justify-center py-16">
                    <div className="w-8 h-8 border-2 border-zinc-850 border-t-purple-600 rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-black/40 border-b border-zinc-900">
                        <tr>
                          {['Acc.', 'LED', 'Nombre / subdominio', 'Propietario', 'Plan', 'Vence en', 'Prohibir', 'Créditos'].map(h => (
                            <th key={h} className="px-4 py-4 text-left text-zinc-500 font-black uppercase tracking-widest whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900">
                        {filtrados.map(b => (
                          <tr key={b.id} className="hover:bg-white/5 transition-colors group">
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
                              <p className="font-bold text-white text-sm group-hover:text-purple-400 transition-colors">{b.nombre}</p>
                              <p className="text-zinc-500 font-mono">{b.slug}.loyaltyapp.com</p>
                            </td>
                            {/* Propietario */}
                            <td className="px-4 py-4">
                              <p className="text-zinc-300 font-bold">{b.owner_name || '—'}</p>
                              <p className="text-zinc-500">{b.owner_email || '—'}</p>
                            </td>
                            {/* Plan */}
                            <td className="px-4 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase whitespace-nowrap ${
                                b.es_demo ? 'bg-blue-955 text-blue-400 border border-blue-900/50' :
                                b.plan === 'anual' ? 'bg-amber-955 text-amber-400 border border-amber-900/50' :
                                'bg-zinc-900 text-zinc-400 border border-zinc-800'
                              }`}>
                                {b.es_demo ? '🎁 Demo 30 Días' : b.plan === 'anual' ? '⭐ Premium Anual' : `📦 ${b.plan}`}
                              </span>
                            </td>
                            {/* Vigencia */}
                            <td className="px-4 py-4">
                              <p className="text-zinc-400 font-mono mb-0.5">
                                {new Date(b.fecha_vencimiento).toLocaleDateString('es-MX')}
                              </p>
                              <Countdown fechaVencimiento={b.fecha_vencimiento} />
                            </td>
                            {/* Prohibir / Bloquear */}
                            <td className="px-4 py-4">
                              <button
                                onClick={() => toggleBloqueo(b)}
                                className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border transition-all ${
                                  b.bloqueado_manual
                                    ? 'bg-red-955 text-red-400 border-red-900/50 hover:bg-red-900/50'
                                    : 'bg-green-955 text-green-400 border-green-900/50 hover:bg-green-900/50'
                                }`}
                              >
                                {b.bloqueado_manual ? 'SÍ' : 'NO'}
                              </button>
                            </td>
                            {/* Créditos */}
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-zinc-900 rounded-full overflow-hidden w-16 border border-zinc-800">
                                  <div
                                    className="h-full bg-gradient-to-r from-purple-650 to-purple-400 rounded-full transition-all"
                                    style={{ width: `${b.creditos_totales > 0 ? (b.creditos_usados / b.creditos_totales) * 100 : 0}%` }}
                                  />
                                </div>
                                <span className="text-zinc-400 font-mono font-bold">
                                  {b.creditos_usados}/{b.creditos_totales}
                                </span>
                              </div>
                              <button
                                onClick={() => generarDemo(b)}
                                className="mt-1 text-[8px] text-blue-500 hover:text-blue-400 font-bold uppercase tracking-wider block"
                              >
                                + Demo 30d
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {filtrados.length === 0 && !cargando && (
                      <div className="text-center py-16 text-zinc-600">
                        <p className="text-4xl mb-4">🏢</p>
                        <p className="font-bold uppercase tracking-widest text-xs">No se encontraron resultados</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ────────────────── TAB: AJUSTES CENTRALES ────────────────── */}
            {pestaña === 'ajustes' && (
              <div className="bg-[#0c0c0c] border border-zinc-900 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl animate-in fade-in duration-200">
                <div>
                  <h3 className="font-serif font-black text-lg text-white mb-1">⚙️ Ajustes Globales de Facturación SaaS</h3>
                  <p className="text-zinc-500 text-xs">Configura los parámetros financieros del core LoyaltyApp.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-zinc-900 pt-6">
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-400 uppercase font-black block">Costo unitario por crédito/mes (MXN)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={precioCredito}
                        onChange={e => setPrecioCredito(Number(e.target.value))}
                        className="w-full bg-black/50 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-sm font-mono text-amber-500 font-bold focus:outline-none focus:border-purple-600"
                      />
                      <DollarSign className="w-4 h-4 text-zinc-500 absolute left-3 top-3.5" />
                    </div>
                    <p className="text-[9px] text-zinc-500">Este valor se usará para calcular ingresos del dashboard e importes en modales de renovación.</p>
                  </div>

                  <div className="space-y-2 bg-zinc-950/40 border border-zinc-900 rounded-xl p-4 flex flex-col justify-center">
                    <p className="text-xs font-bold text-purple-400">¿Cómo funciona?</p>
                    <p className="text-[10px] text-zinc-400 leading-relaxed mt-1">
                      Cada crédito equivale a **1 mes de suscripción activa** para cualquier negocio registrado. Al ajustar el costo, los cálculos de renovación y creación facturarán automáticamente a este nuevo valor configurado en el sistema.
                    </p>
                  </div>
                </div>

                <div className="border-t border-zinc-900 pt-6 flex justify-end">
                  <button
                    onClick={guardarPrecioCredito}
                    className="bg-gradient-to-r from-purple-700 to-purple-900 text-white font-black px-6 py-3 rounded-xl text-xs uppercase tracking-widest hover:brightness-110 transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                  >
                    💾 Guardar Ajustes Centrales
                  </button>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ── MODAL: REGISTRAR TENANT SAAS ── */}
      {modalRegistrar && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-black text-white">Registrar Nuevo Negocio</h2>
                <p className="text-zinc-500 text-xs">Crea un Tenant SaaS y su cuenta de mostrador</p>
              </div>
              <button onClick={() => setModalRegistrar(false)} className="text-zinc-550 hover:text-white text-xl">✕</button>
            </div>

            <form onSubmit={registrarNegocio} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Nombre del Negocio</label>
                  <input
                    type="text"
                    value={nuevoBiz.nombre}
                    onChange={e => setNuevoBiz(prev => ({ ...prev, nombre: e.target.value }))}
                    placeholder="Ej: Tacos El Padrino"
                    className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-purple-650"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Subdominio / Slug</label>
                  <input
                    type="text"
                    value={nuevoBiz.slug}
                    onChange={e => setNuevoBiz(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="Ej: elpadrino"
                    className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-purple-655"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Dueño (Nombre)</label>
                  <input
                    type="text"
                    value={nuevoBiz.ownerName}
                    onChange={e => setNuevoBiz(prev => ({ ...prev, ownerName: e.target.value }))}
                    placeholder="Ej: Pedro Infante"
                    className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-purple-650"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Dueño (Email / Usuario)</label>
                  <input
                    type="email"
                    value={nuevoBiz.ownerEmail}
                    onChange={e => setNuevoBiz(prev => ({ ...prev, ownerEmail: e.target.value }))}
                    placeholder="Ej: pedro@mail.com"
                    className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-purple-650"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] text-zinc-400 uppercase font-black">Contraseña / PIN</label>
                    <button
                      type="button"
                      onClick={generarPasswordRegistro}
                      className="text-[9px] text-purple-400 hover:text-purple-300 font-bold uppercase tracking-wider"
                    >
                      ⚡ Generar
                    </button>
                  </div>
                  <input
                    type="text"
                    value={nuevoBiz.pin}
                    onChange={e => setNuevoBiz(prev => ({ ...prev, pin: e.target.value }))}
                    placeholder="Ej: 9999"
                    className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs font-mono text-center focus:outline-none focus:border-purple-650"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Plan Contratado</label>
                  <select
                    value={nuevoBiz.plan}
                    onChange={e => setNuevoBiz(prev => ({ ...prev, plan: e.target.value }))}
                    className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-purple-650"
                  >
                    <option value="mensual">Mensual (1 Crédito)</option>
                    <option value="semestral">Semestral (6 Créditos)</option>
                    <option value="anual">Anual (12 Créditos)</option>
                    <option value="demo">Demo Gratis (30 días)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Créditos a Cargar</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={nuevoBiz.creditos}
                  onChange={e => setNuevoBiz(prev => ({ ...prev, creditos: Number(e.target.value) }))}
                  className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-purple-650"
                  required
                />
              </div>

              <div className="bg-zinc-950/40 rounded-xl p-4 border border-zinc-800 text-xs">
                <div className="flex justify-between mb-1">
                  <span className="text-zinc-500">Transacción:</span>
                  <span className="text-purple-400 font-bold">Carga de Tenant</span>
                </div>
                <div className="flex justify-between border-t border-zinc-800 pt-1.5 mt-1.5">
                  <span className="text-zinc-500">Costo Final MXN:</span>
                  <span className="text-amber-400 font-black">
                    ${nuevoBiz.plan === 'demo' ? 0 : (Number(nuevoBiz.creditos) * precioCredito).toLocaleString()} MXN
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalRegistrar(false)}
                  className="flex-1 border border-zinc-800 text-zinc-400 font-bold py-2.5 rounded-xl text-xs hover:border-zinc-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creando}
                  className="flex-1 bg-gradient-to-r from-purple-700 to-purple-900 text-white font-black py-2.5 rounded-xl text-xs hover:brightness-110 transition-all disabled:opacity-50"
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <h2 className="text-xl font-black text-white mb-1">Ajustar / Renovar Suscripción</h2>
        <p className="text-zinc-400 text-sm mb-6">{business.nombre}</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 uppercase tracking-widest font-bold block mb-2">
              Meses / Ajuste de Créditos (Suma o Resta)
            </label>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setMeses(Math.max(-12, meses - 1))}
                className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 text-white font-bold hover:bg-zinc-700 transition-colors"
              >
                −
              </button>
              <span className="text-4xl font-black text-white w-16 text-center">{meses > 0 ? `+${meses}` : meses}</span>
              <button 
                onClick={() => setMeses(Math.min(24, meses + 1))}
                className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 text-white font-bold hover:bg-zinc-700 transition-colors"
              >
                +
              </button>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer bg-blue-955/30 border border-blue-900/40 rounded-xl p-4">
            <input 
              type="checkbox" 
              checked={esDemo} 
              onChange={e => setEsDemo(e.target.checked)}
              className="w-4 h-4 accent-blue-500" 
            />
            <div>
              <p className="text-sm font-bold text-blue-400">Modo Demo (Gratis)</p>
              <p className="text-xs text-zinc-500">No consume créditos de facturación</p>
            </div>
          </label>

          <div className="bg-zinc-950/40 rounded-xl p-4 border border-zinc-800">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-450">Duración:</span>
              <span className="text-white font-bold">
                {meses < 0 
                  ? `Reducción: ${Math.abs(meses)} mes(es) (-${Math.abs(meses) * 30} días)` 
                  : `Aumento: ${meses} mes(es) (+${meses * 30} días)`}
              </span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-455">Tipo:</span>
              <span className={esDemo ? 'text-blue-400 font-bold' : (meses < 0 ? 'text-red-400 font-bold' : 'text-green-400 font-bold')}>
                {esDemo ? 'DEMO (Regalo)' : (meses < 0 ? 'DEDUCCIÓN' : 'COMPRADO')}
              </span>
            </div>
            {!esDemo && (
              <div className="flex justify-between text-sm border-t border-zinc-800 pt-2 mt-2">
                <span className="text-zinc-455">Ajuste MXN:</span>
                <span className={`font-black text-lg ${meses < 0 ? 'text-red-400' : 'text-amber-450'}`}>
                  {meses < 0 ? `-$${Math.abs(meses * precioMes).toLocaleString()}` : `$${(meses * precioMes).toLocaleString()}`}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button 
            onClick={onClose}
            className="flex-1 border border-zinc-750 text-zinc-400 font-bold py-3 rounded-xl text-sm hover:border-zinc-500 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={renovar} 
            disabled={cargando}
            className="flex-1 bg-gradient-to-r from-green-700 to-green-900 text-white font-black py-3 rounded-xl text-sm hover:brightness-110 transition-all disabled:opacity-50"
          >
            {cargando ? 'Procesando...' : `✅ Confirmar Renovación`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal de Historial ─────────────────────────────────────────────────────
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-850 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-black text-white">Historial de Conexiones</h2>
            <p className="text-zinc-400 text-sm">{business.nombre}</p>
          </div>
          <button onClick={onClose} className="text-zinc-550 hover:text-white text-xl">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 space-y-2 pr-1">
          {historial.length === 0 ? (
            <p className="text-zinc-550 text-sm text-center py-8">Sin historial registrado</p>
          ) : (
            historial.map(tx => (
              <div key={tx.id} className="bg-zinc-950/40 rounded-xl p-4 border border-zinc-800">
                <div className="flex justify-between items-start">
                  <div>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                      tx.tipo === 'demo' ? 'bg-blue-955 text-blue-450' :
                      tx.tipo === 'renovacion' ? 'bg-green-955 text-green-450' :
                      'bg-zinc-800 text-zinc-400'
                    }`}>{tx.tipo}</span>
                    <p className="text-white font-bold text-sm mt-1">{tx.notas || '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-450 font-black">{tx.creditos} crédito{tx.creditos !== 1 ? 's' : ''}</p>
                    {tx.monto_mxn > 0 && <p className="text-zinc-500 text-xs">${tx.monto_mxn.toLocaleString()} MXN</p>}
                  </div>
                </div>
                <p className="text-zinc-550 text-[10px] mt-2 font-mono">
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

// Modal de Edición de Negocio (SuperAdmin)
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
  
  // Cambiar PIN/Contraseña directamente desde SuperAdmin
  const [nuevoPin, setNuevoPin] = useState('')
  const [cargando, setCargando] = useState(false)

  // Generador de contraseñas nativo y reactivo
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

      // 2. Si se ingresó una nueva contraseña/PIN, actualizarla en business_users del dueño
      if (nuevoPin.trim()) {
        const { error: pinError } = await supabase
          .from('business_users')
          .update({ pin: nuevoPin.trim() })
          .eq('business_id', business.id)
          .eq('rol', 'admin_comercio')
        
        if (pinError) throw pinError
      }

      alert('✅ Negocio actualizado con éxito absoluto')
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-black text-white">Editar Negocio / Suscripción</h2>
            <p className="text-zinc-500 text-xs">Gestión y auditoría del Tenant: {business.nombre}</p>
          </div>
          <button onClick={onClose} className="text-zinc-550 hover:text-white text-xl">✕</button>
        </div>

        <form onSubmit={guardar} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Nombre del Negocio</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-purple-650"
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Subdominio / Slug</label>
              <input
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Dueño (Nombre)</label>
              <input
                type="text"
                value={ownerName}
                onChange={e => setOwnerName(e.target.value)}
                className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-purple-650"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Dueño (Email)</label>
              <input
                type="email"
                value={ownerEmail}
                onChange={e => setOwnerEmail(e.target.value)}
                className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-purple-650"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Plan</label>
              <select
                value={plan}
                onChange={e => setPlan(e.target.value)}
                className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-purple-650"
              >
                <option value="gratis">Gratis</option>
                <option value="mensual">Mensual</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual</option>
                <option value="demo">Demo</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Estado</label>
              <select
                value={estado}
                onChange={e => setEstado(e.target.value as any)}
                className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-purple-650"
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
                  className="w-4 h-4 accent-purple-600"
                />
                <span className="text-[10px] text-zinc-350 uppercase font-black">Es Demo</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Créditos Usados</label>
              <input
                type="number"
                value={creditosUsados}
                onChange={e => setCreditosUsados(Number(e.target.value))}
                className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-purple-650"
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Créditos Totales</label>
              <input
                type="number"
                value={creditosTotales}
                onChange={e => setCreditosTotales(Number(e.target.value))}
                className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-purple-650"
                required
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] text-zinc-400 uppercase font-black">Cambiar PIN</label>
                <button
                  type="button"
                  onClick={generarPassword}
                  className="text-[8px] text-purple-400 hover:text-purple-300 font-bold uppercase tracking-wider"
                >
                  ⚡ Generar
                </button>
              </div>
              <input
                type="text"
                value={nuevoPin}
                onChange={e => setNuevoPin(e.target.value)}
                placeholder="Pin de rescate"
                className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs font-mono text-center focus:outline-none focus:border-purple-650"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Fecha de Vencimiento</label>
            <input
              type="datetime-local"
              value={fechaVencimiento}
              onChange={e => setFechaVencimiento(e.target.value)}
              className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-purple-650"
              required
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={eliminarNegocio}
              disabled={cargando}
              className="bg-red-955/40 hover:bg-red-900/40 border border-red-900/60 text-red-400 hover:text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-widest transition-all px-4"
            >
              🗑️ Eliminar Negocio
            </button>
            <div className="flex gap-2 flex-1 sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="border border-zinc-800 text-zinc-400 font-bold py-2.5 rounded-xl text-xs hover:border-zinc-500 transition-colors px-4"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={cargando}
                className="bg-gradient-to-r from-purple-700 to-purple-900 text-white font-black py-2.5 rounded-xl text-xs hover:brightness-110 transition-all px-6"
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
