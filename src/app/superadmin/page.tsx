'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

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
  created_at: string
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
    <span className={`font-mono text-xs font-black ${critico ? 'text-red-400 animate-pulse' : 'text-zinc-300'}`}>
      {tiempo}
    </span>
  )
}

// ── Componente: LED de estado ──────────────────────────────────────────────
function StatusLED({ estado, bloqueado }: { estado: string; bloqueado: boolean }) {
  if (bloqueado) return <span className="w-3 h-3 rounded-full bg-zinc-600 inline-block shadow-sm" title="Bloqueado manualmente" />
  const colores: Record<string, string> = {
    activo: 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]',
    demo: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]',
    vencido: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]',
    bloqueado: 'bg-zinc-600',
  }
  return <span className={`w-3 h-3 rounded-full inline-block ${colores[estado] || 'bg-zinc-600'}`} />
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
        className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors flex items-center justify-center text-zinc-400 hover:text-white"
      >
        ⋮
      </button>
      {open && (
        <div className="absolute left-10 top-0 z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden min-w-[200px]">
          <button
            onClick={() => { onImpersonar(); setOpen(false) }}
            className="w-full px-4 py-3 text-left text-xs font-bold text-purple-400 hover:bg-zinc-800 hover:text-purple-300 transition-colors flex items-center gap-2 border-b border-zinc-800"
          >
            🎭 Impersonar (Soporte)
          </button>
          <button
            onClick={() => { onHistorial(); setOpen(false) }}
            className="w-full px-4 py-3 text-left text-xs font-bold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-2 border-b border-zinc-800"
          >
            📋 Ver Historial
          </button>
          <button
            onClick={() => { onRenovar(); setOpen(false) }}
            className="w-full px-4 py-3 text-left text-xs font-bold text-green-400 hover:bg-zinc-800 hover:text-green-300 transition-colors flex items-center gap-2 border-b border-zinc-800"
          >
            🔄 Renovar (Extender)
          </button>
          <button
            onClick={() => { onEditar(); setOpen(false) }}
            className="w-full px-4 py-3 text-left text-xs font-bold text-blue-400 hover:bg-zinc-800 hover:text-blue-300 transition-colors flex items-center gap-2 border-b border-zinc-800"
          >
            ✏️ Editar
          </button>
          <button
            onClick={() => { onToggleBloqueo(); setOpen(false) }}
            className={`w-full px-4 py-3 text-left text-xs font-bold transition-colors flex items-center gap-2 ${
              business.bloqueado_manual
                ? 'text-green-400 hover:bg-zinc-800'
                : 'text-red-400 hover:bg-zinc-800'
            }`}
          >
            {business.bloqueado_manual ? '✅ Desbloquear' : '🚫 Bloquear Acceso'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Modal de Renovación ────────────────────────────────────────────────────
function RenovarModal({
  business,
  onClose,
  onSuccess,
}: {
  business: Business
  onClose: () => void
  onSuccess: () => void
}) {
  const [meses, setMeses] = useState(1)
  const [esDemo, setEsDemo] = useState(false)
  const [cargando, setCargando] = useState(false)
  const PRECIO_MES = 499

  const renovar = async () => {
    setCargando(true)
    const fechaActual = new Date(business.fecha_vencimiento) < new Date()
      ? new Date()
      : new Date(business.fecha_vencimiento)
    const nuevaFecha = new Date(fechaActual)
    nuevaFecha.setDate(nuevaFecha.getDate() + (meses * 30))

    const nuevosCreditos = esDemo ? business.creditos_usados : business.creditos_usados + meses
    const nuevoTotal = esDemo ? business.creditos_totales : business.creditos_totales + meses

    await supabase.from('businesses').update({
      fecha_vencimiento: nuevaFecha.toISOString(),
      estado: 'activo',
      creditos_usados: nuevosCreditos,
      creditos_totales: nuevoTotal,
      es_demo: esDemo,
      bloqueado_manual: false,
    }).eq('id', business.id)

    await supabase.from('credit_transactions').insert({
      business_id: business.id,
      tipo: esDemo ? 'demo' : 'renovacion',
      creditos: meses,
      meses,
      monto_mxn: esDemo ? 0 : meses * PRECIO_MES,
      notas: esDemo ? `Demo de ${meses} mes(es) activado` : `Renovación de ${meses} mes(es)`,
      creado_por: 'superadmin',
    })

    setCargando(false)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <h2 className="text-xl font-black text-white mb-1">Renovar Suscripción</h2>
        <p className="text-zinc-400 text-sm mb-6">{business.nombre}</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 uppercase tracking-widest font-bold block mb-2">
              Meses a Añadir
            </label>
            <div className="flex items-center gap-4">
              <button onClick={() => setMeses(Math.max(1, meses - 1))}
                className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 text-white font-bold hover:bg-zinc-700 transition-colors">
                −
              </button>
              <span className="text-4xl font-black text-white w-12 text-center">{meses}</span>
              <button onClick={() => setMeses(Math.min(24, meses + 1))}
                className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 text-white font-bold hover:bg-zinc-700 transition-colors">
                +
              </button>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer bg-blue-950/30 border border-blue-900/40 rounded-xl p-4">
            <input type="checkbox" checked={esDemo} onChange={e => setEsDemo(e.target.checked)}
              className="w-4 h-4 accent-blue-500" />
            <div>
              <p className="text-sm font-bold text-blue-400">Modo Demo (Gratis)</p>
              <p className="text-xs text-zinc-500">No consume créditos comprados</p>
            </div>
          </label>

          <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-400">Duración:</span>
              <span className="text-white font-bold">{meses} mes{meses > 1 ? 'es' : ''} ({meses * 30} días)</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-400">Tipo:</span>
              <span className={esDemo ? 'text-blue-400 font-bold' : 'text-green-400 font-bold'}>
                {esDemo ? 'DEMO (Regalo)' : 'COMPRADO'}
              </span>
            </div>
            {!esDemo && (
              <div className="flex justify-between text-sm border-t border-zinc-700 pt-2 mt-2">
                <span className="text-zinc-400">Total MXN:</span>
                <span className="text-amber-400 font-black text-lg">${(meses * PRECIO_MES).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 border border-zinc-700 text-zinc-400 font-bold py-3 rounded-xl text-sm hover:border-zinc-500 transition-colors">
            Cancelar
          </button>
          <button onClick={renovar} disabled={cargando}
            className="flex-1 bg-gradient-to-r from-green-700 to-green-900 text-white font-black py-3 rounded-xl text-sm hover:brightness-110 transition-all disabled:opacity-50">
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
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-black text-white">Historial de Conexiones</h2>
            <p className="text-zinc-400 text-sm">{business.nombre}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 space-y-2">
          {historial.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-8">Sin historial registrado</p>
          ) : (
            historial.map(tx => (
              <div key={tx.id} className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
                <div className="flex justify-between items-start">
                  <div>
                    <span className={`text-xs font-black uppercase px-2 py-0.5 rounded-full ${
                      tx.tipo === 'demo' ? 'bg-blue-950 text-blue-400' :
                      tx.tipo === 'renovacion' ? 'bg-green-950 text-green-400' :
                      'bg-zinc-800 text-zinc-400'
                    }`}>{tx.tipo}</span>
                    <p className="text-white font-bold text-sm mt-1">{tx.notas || '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-400 font-black">{tx.creditos} crédito{tx.creditos !== 1 ? 's' : ''}</p>
                    {tx.monto_mxn > 0 && <p className="text-zinc-400 text-xs">${tx.monto_mxn.toLocaleString()} MXN</p>}
                  </div>
                </div>
                <p className="text-zinc-500 text-xs mt-2 font-mono">
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

// ── COMPONENTE PRINCIPAL: Panel SuperAdmin ─────────────────────────────────
export default function SuperAdminPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [cargando, setCargando] = useState(true)
  const [modalRenovar, setModalRenovar] = useState<Business | null>(null)
  const [modalHistorial, setModalHistorial] = useState<Business | null>(null)
  const [busqueda, setBusqueda] = useState('')

  // Estados para Registro de Negocio (Ledger)
  const [modalRegistrar, setModalRegistrar] = useState(false)
  const [nuevoBiz, setNuevoBiz] = useState({
    nombre: '', slug: '', ownerName: '', ownerEmail: '', pin: '9999', plan: 'mensual', creditos: 1
  })
  const [creando, setCreando] = useState(false)

  const registrarNegocio = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevoBiz.nombre.trim() || !nuevoBiz.slug.trim() || !nuevoBiz.ownerEmail.trim() || !nuevoBiz.pin.trim()) {
      return alert('Llene todos los campos obligatorios')
    }
    setCreando(true)
    
    try {
      const slugFormateado = nuevoBiz.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
      
      // 1. Insertar el negocio en businesses
      const duracionMeses = nuevoBiz.plan === 'anual' ? 12 : nuevoBiz.plan === 'demo' ? 1 : 1
      const fin = new Date()
      fin.setDate(fin.getDate() + (duracionMeses * 30))

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

      if (errBiz || !biz) throw errBiz || new Error('No se pudo crear el negocio')

      // 2. Insertar el usuario administrador en business_users
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

      // 3. Registrar la transacción en credit_transactions para auditoría
      await supabase.from('credit_transactions').insert({
        business_id: biz.id,
        tipo: nuevoBiz.plan === 'demo' ? 'demo' : 'renovacion',
        creditos: Number(nuevoBiz.creditos),
        meses: duracionMeses,
        monto_mxn: nuevoBiz.plan === 'demo' ? 0 : Number(nuevoBiz.creditos) * 499,
        notas: `Carga inicial de ${nuevoBiz.creditos} crédito(s) - Plan ${nuevoBiz.plan.toUpperCase()}`,
        creado_por: 'superadmin'
      })

      alert('✅ Negocio y Administrador registrados con éxito absoluto')
      setModalRegistrar(false)
      setNuevoBiz({
        nombre: '', slug: '', ownerName: '', ownerEmail: '', pin: '9999', plan: 'mensual', creditos: 1
      })
      cargar()
    } catch (err: any) {
      console.error(err)
      alert('Error en el registro del tenant: ' + err.message)
    } finally {
      setCreando(false)
    }
  }

  // KPIs
  const activos = businesses.filter(b => b.estado === 'activo' && !b.bloqueado_manual).length
  const demos = businesses.filter(b => b.estado === 'demo').length
  const creditosVendidos = businesses.reduce((s, b) => s + (b.creditos_totales - (b.es_demo ? b.creditos_totales : 0)), 0)
  const ingresosMXN = creditosVendidos * 499
  const proximosVencer = businesses.filter(b => {
    const diff = new Date(b.fecha_vencimiento).getTime() - Date.now()
    return diff > 0 && diff < 7 * 86400000
  }).length

  const cargar = async () => {
    setCargando(true)
    const { data } = await supabase
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setBusinesses(data as Business[])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

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
      notes: 'Demo 30 días activado desde SuperAdmin',
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

  const filtrados = businesses.filter(b =>
    b.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    b.slug.toLowerCase().includes(busqueda.toLowerCase()) ||
    (b.owner_name || '').toLowerCase().includes(busqueda.toLowerCase())
  )

  const cerrarSesion = async () => {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.warn("Signout failed or no active session:", e)
    }
    localStorage.clear()
    sessionStorage.clear()
    
    // Clear cookies
    const cookies = ['session_rol','session_user','session_business_id','session_branch_id','session_user_id']
    cookies.forEach(c => document.cookie = `${c}=; path=/; Max-Age=0`)
    
    window.location.href = '/login'
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white font-sans p-4 sm:p-8">
      {/* Luces de atmósfera */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[200px] pointer-events-none" />

      <div className="max-w-[1400px] mx-auto space-y-8">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg bg-purple-900/50 border border-purple-700/50 flex items-center justify-center">
                <span className="text-sm">👑</span>
              </div>
              <span className="text-xs text-purple-400 font-black uppercase tracking-widest">Super Admin Panel</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black">
              LoyaltyApp <span className="text-purple-400">Control Center</span>
            </h1>
            <p className="text-zinc-500 text-xs uppercase tracking-widest mt-1">Sistema de Gestión de Tenants — Vista Raíz</p>
          </div>
          <button
            onClick={cerrarSesion}
            className="text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest border border-zinc-800 px-4 py-2 rounded-xl hover:border-zinc-600 transition-all"
          >
            Cerrar Sesión
          </button>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Suscripciones Activas', valor: activos, icono: '✅', color: 'from-green-900/30 to-green-950/30', borde: 'border-green-900/40', texto: 'text-green-400' },
            { label: 'Créditos Vendidos', valor: `${creditosVendidos}`, sub: `$${ingresosMXN.toLocaleString()} MXN`, icono: '💳', color: 'from-amber-900/30 to-amber-950/30', borde: 'border-amber-900/40', texto: 'text-amber-400' },
            { label: 'Demos Activos', valor: demos, icono: '🎁', color: 'from-blue-900/30 to-blue-950/30', borde: 'border-blue-900/40', texto: 'text-blue-400' },
            { label: 'Renovaciones ≤7 días', valor: proximosVencer, icono: '⚠️', color: 'from-red-900/30 to-red-950/30', borde: 'border-red-900/40', texto: 'text-red-400' },
          ].map((kpi, i) => (
            <div key={i} className={`bg-gradient-to-br ${kpi.color} border ${kpi.borde} rounded-2xl p-5`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2">{kpi.label}</p>
                  <p className={`text-3xl font-black ${kpi.texto}`}>{kpi.valor}</p>
                  {kpi.sub && <p className="text-xs text-zinc-400 mt-1">{kpi.sub}</p>}
                </div>
                <span className="text-2xl opacity-60">{kpi.icono}</span>
              </div>
            </div>
          ))}
        </div>

        {/* TABLA DE TENANTS */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
          {/* Cabecera de la tabla */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 border-b border-zinc-800">
            <h2 className="text-sm font-black text-zinc-300 uppercase tracking-widest">
              Negocios Registrados ({businesses.length})
            </h2>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, slug o dueño..."
                className="bg-black/50 border border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-purple-700 w-full sm:w-64"
              />
              <button
                onClick={() => setModalRegistrar(true)}
                className="bg-gradient-to-r from-purple-700 to-purple-900 text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-widest hover:brightness-110 transition-all shadow-[0_0_15px_rgba(147,51,234,0.3)] shrink-0"
              >
                ➕ Registrar Negocio
              </button>
            </div>
          </div>

          {cargando ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-zinc-800 border-t-purple-600 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-black/50 border-b border-zinc-800">
                  <tr>
                    {['Acc.', 'Estado', 'Negocio / Slug', 'Dueño', 'Geo', 'Paquete', 'Vigencia', 'Prohibir', 'Créditos'].map(h => (
                      <th key={h} className="px-4 py-4 text-left text-zinc-500 font-black uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {filtrados.map(b => (
                    <tr key={b.id} className="hover:bg-white/5 transition-colors group">
                      {/* Acciones */}
                      <td className="px-4 py-4">
                        <ActionMenu
                          business={b}
                          onRenovar={() => setModalRenovar(b)}
                          onHistorial={() => setModalHistorial(b)}
                          onEditar={() => alert(`Editar ${b.nombre} — próximamente`)}
                          onToggleBloqueo={() => toggleBloqueo(b)}
                          onImpersonar={() => impersonar(b)}
                        />
                      </td>
                      {/* Estado LED */}
                      <td className="px-4 py-4">
                        <StatusLED estado={b.estado} bloqueado={b.bloqueado_manual} />
                      </td>
                      {/* Negocio */}
                      <td className="px-4 py-4">
                        <p className="font-bold text-white text-sm group-hover:text-purple-400 transition-colors">{b.nombre}</p>
                        <p className="text-zinc-600 font-mono">{b.slug}.loyaltyapp.com</p>
                      </td>
                      {/* Dueño */}
                      <td className="px-4 py-4">
                        <p className="text-zinc-300">{b.owner_name || '—'}</p>
                        <p className="text-zinc-600">{b.owner_email || '—'}</p>
                      </td>
                      {/* Geo */}
                      <td className="px-4 py-4">
                        <div className="group/geo relative">
                          <span className="text-lg cursor-help">📍</span>
                          <div className="absolute left-6 top-0 z-20 hidden group-hover/geo:block bg-zinc-800 border border-zinc-700 rounded-xl p-3 shadow-xl whitespace-nowrap">
                            <p className="text-zinc-400 text-[10px] font-mono">Lat: {b.latitude || 'N/A'}</p>
                            <p className="text-zinc-400 text-[10px] font-mono">Lng: {b.longitude || 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                      {/* Paquete */}
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase whitespace-nowrap ${
                          b.es_demo ? 'bg-blue-950 text-blue-400 border border-blue-900/50' :
                          b.plan === 'anual' ? 'bg-amber-950 text-amber-400 border border-amber-900/50' :
                          'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}>
                          {b.es_demo ? '🎁 Demo 30 Días' : b.plan === 'anual' ? '⭐ Premium Anual' : `📦 ${b.plan}`}
                        </span>
                      </td>
                      {/* Vigencia */}
                      <td className="px-4 py-4">
                        <p className="text-zinc-400 text-[10px] font-mono mb-0.5">
                          {new Date(b.fecha_vencimiento).toLocaleDateString('es-MX')}
                        </p>
                        <Countdown fechaVencimiento={b.fecha_vencimiento} />
                      </td>
                      {/* Bloquear switch */}
                      <td className="px-4 py-4">
                        <button
                          onClick={() => toggleBloqueo(b)}
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border transition-all ${
                            b.bloqueado_manual
                              ? 'bg-red-950 text-red-400 border-red-900/50 hover:bg-red-900/50'
                              : 'bg-green-950 text-green-400 border-green-900/50 hover:bg-green-900/50'
                          }`}
                        >
                          {b.bloqueado_manual ? 'SÍ' : 'NO'}
                        </button>
                      </td>
                      {/* Créditos */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden w-16">
                            <div
                              className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all"
                              style={{ width: `${b.creditos_totales > 0 ? (b.creditos_usados / b.creditos_totales) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-zinc-400 font-mono whitespace-nowrap">
                            {b.creditos_usados}/{b.creditos_totales}
                          </span>
                        </div>
                        <button
                          onClick={() => generarDemo(b)}
                          className="mt-1 text-[9px] text-blue-500 hover:text-blue-400 font-bold uppercase tracking-wider"
                        >
                          + Demo
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filtrados.length === 0 && !cargando && (
                <div className="text-center py-16 text-zinc-600">
                  <p className="text-4xl mb-4">🏢</p>
                  <p className="font-bold uppercase tracking-widest text-sm">
                    {busqueda ? 'No se encontraron resultados' : 'Sin negocios registrados'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modales */}
      {modalRenovar && (
        <RenovarModal
          business={modalRenovar}
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

      {modalRegistrar && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 sm:p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-black text-white">Registrar Nuevo Negocio</h2>
                <p className="text-zinc-500 text-xs">Crea un Tenant SaaS multi-tenant y su cuenta administradora</p>
              </div>
              <button onClick={() => setModalRegistrar(false)} className="text-zinc-500 hover:text-white text-xl">✕</button>
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
                    className="w-full bg-black/50 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-600"
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
                    className="w-full bg-black/50 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-600"
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
                    className="w-full bg-black/50 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Dueño (Email / Usuario)</label>
                  <input
                    type="email"
                    value={nuevoBiz.ownerEmail}
                    onChange={e => setNuevoBiz(prev => ({ ...prev, ownerEmail: e.target.value }))}
                    placeholder="Ej: pedro@mail.com"
                    className="w-full bg-black/50 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-600"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Contraseña / PIN de Acceso</label>
                  <input
                    type="text"
                    value={nuevoBiz.pin}
                    onChange={e => setNuevoBiz(prev => ({ ...prev, pin: e.target.value }))}
                    placeholder="Ej: 9999"
                    className="w-full bg-black/50 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs font-mono text-center focus:outline-none focus:border-purple-600"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Plan Contratado</label>
                  <select
                    value={nuevoBiz.plan}
                    onChange={e => setNuevoBiz(prev => ({ ...prev, plan: e.target.value }))}
                    className="w-full bg-black/50 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-600"
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
                  className="w-full bg-black/50 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-600"
                  required
                />
              </div>

              <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700 text-xs">
                <div className="flex justify-between mb-1">
                  <span className="text-zinc-500">Transacción:</span>
                  <span className="text-purple-400 font-bold">Registro de Negocio</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Costo Ledger SuperAdmin:</span>
                  <span className="text-amber-400 font-black">-{nuevoBiz.creditos} crédito(s)</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalRegistrar(false)}
                  className="flex-1 border border-zinc-700 text-zinc-400 font-bold py-2.5 rounded-xl text-xs hover:border-zinc-500 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creando}
                  className="flex-1 bg-gradient-to-r from-purple-700 to-purple-900 text-white font-black py-2.5 rounded-xl text-xs hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {creando ? 'Registrando...' : '🚀 Guardar y Descontar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
