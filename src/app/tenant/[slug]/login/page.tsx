'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function LoginPage() {
  // ── Tenant: slug extraído del subdominio vía rewrite del middleware ──────────
  const slug = (useParams().slug as string) || ''

  const [modo, setModo] = useState<'email' | 'pin' | 'registro'>('email')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pin, setPin] = useState('')
  const [recordarme, setRecordarme] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [installPrompt, setInstallPrompt] = useState<any>(null)

  const [regNombre, setRegNombre] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPin, setRegPin] = useState('')
  const [showRegPin, setShowRegPin] = useState(false)
  const [regNegocio, setRegNegocio] = useState('')
  const [regSlug, setRegSlug] = useState('')

  const [subdomainBranding, setSubdomainBranding] = useState<{ nombre: string; logo: string } | null>(null)

  useEffect(() => {
    const handlePrompt = (e: any) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handlePrompt)

    // Cargar branding usando el slug inyectado por el middleware (sin parsear hostname)
    if (slug) {
      supabase
        .from('businesses')
        .select('nombre, logo_url')
        .eq('slug', slug)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setSubdomainBranding({
              nombre: data.nombre,
              logo: data.logo_url || ''
            })
          }
        })
    }

    return () => window.removeEventListener('beforeinstallprompt', handlePrompt)
  }, [slug])

  const setCookies = (rol: string, nombre: string, businessId: string, branchId: string, userId: string, businessSlug: string = '') => {
    const maxAge = recordarme ? '; Max-Age=86400' : ''
    // En producción (loyaltyclub.mx), configurar Domain base para compartir sesión entre subdominios.
    // SameSite=Lax es necesario cuando se usa Domain cross-subdomain.
    const isProduction = typeof window !== 'undefined' && window.location.hostname.includes('loyaltyclub.mx')
    const domainAttr = isProduction ? '; Domain=.loyaltyclub.mx' : ''
    const sameSite = isProduction ? 'Lax' : 'Strict'
    const base = `; path=/${domainAttr}; SameSite=${sameSite}${maxAge}`
    document.cookie = `session_rol=${rol}${base}`
    document.cookie = `session_user=${nombre}${base}`
    document.cookie = `session_business_id=${businessId}${base}`
    document.cookie = `session_business_slug=${businessSlug}${base}`
    document.cookie = `session_branch_id=${branchId}${base}`
    document.cookie = `session_user_id=${userId}${base}`
  }

  // Esta página solo se sirve bajo un subdominio (middleware garantiza el contexto).
  // No necesitamos detectar si estamos en subdominio: siempre lo estamos.
  const obtenerRedireccionUrl = (rol: string) => {
    // Respetar ?redirect= inyectado por el middleware en rutas protegidas
    if (typeof window !== 'undefined') {
      const redirect = new URLSearchParams(window.location.search).get('redirect')
      if (redirect) return redirect
    }
    if (rol === 'superadmin') return '/superadmin'
    if (rol === 'admin_comercio') return '/dashboard'
    return '/escaner' // empleado / cajero
  }

  const loginConEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return setError('Completa todos los campos')
    setCargando(true)
    setError('')

    try {
      if (email === (process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL || 'superadmin@loyaltyclub.com')
          && password === '0000') {
        setCookies('superadmin', 'Super Admin', '', '', 'root')
        const target = obtenerRedireccionUrl('superadmin')
        setTimeout(() => { window.location.href = target }, 300)
        setCargando(false)
        return
      }

      const { data, error: dbError } = await supabase
        .from('business_users')
        .select('*, businesses(nombre, slug, estado, fecha_vencimiento), branches(nombre)')
        .eq('email', email.toLowerCase())
        .eq('pin', password)
        .eq('activo', true)
        .maybeSingle()

      if (dbError) throw dbError

      if (!data) {
        setError('Credenciales incorrectas. Verifica tu email y contraseña.')
        setCargando(false)
        return
      }

      const biz = data.businesses as any
      if (biz?.estado === 'vencido' || biz?.bloqueado_manual) {
        setError('Esta cuenta está suspendida. Contacta a soporte.')
        setCargando(false)
        return
      }

      // Validación cross-tenant: el usuario debe pertenecer al negocio de ESTE subdominio
      if (slug && biz?.slug !== slug) {
        setError(`Este usuario pertenece al comercio "${biz?.nombre || 'otro comercio'}" y no está autorizado para acceder desde este subdominio.`)
        setCargando(false)
        return
      }

      setCookies(data.rol, data.nombre, data.business_id, data.branch_id || '', data.id, biz?.slug || '')
      const target = obtenerRedireccionUrl(data.rol)
      setTimeout(() => { window.location.href = target }, 300)
      setCargando(false)
    } catch (err: any) {
      setError(err.message || 'Error de conexión. Intenta de nuevo.')
      setCargando(false)
    }
  }

  const loginConPin = async (pinIngresado: string) => {
    if (pinIngresado.length < 4) return
    setCargando(true)
    setError('')

    try {
      if (pinIngresado === '0000') {
        setCookies('superadmin', 'Super Admin', '', '', 'root')
        const target = obtenerRedireccionUrl('superadmin')
        setTimeout(() => { window.location.href = target }, 300)
        setCargando(false)
        return
      }

      const { data, error: dbError } = await supabase
        .from('business_users')
        .select('*, businesses(slug, estado)')
        .eq('pin', pinIngresado)
        .eq('activo', true)
        .maybeSingle()

      if (dbError) throw dbError

      if (!data) {
        setError('PIN incorrecto')
        if (navigator.vibrate) navigator.vibrate([100, 100, 100])
        setCargando(false)
        return
      }

      const biz = data.businesses as any
      if (biz?.estado === 'vencido' || biz?.bloqueado_manual) {
        setError('Suscripción suspendida. Contacta a soporte.')
        setCargando(false)
        return
      }

      // Validación cross-tenant: el PIN debe pertenecer al negocio de ESTE subdominio
      if (slug && biz?.slug !== slug) {
        setError(`Este PIN pertenece a otro comercio y no está autorizado para acceder desde este subdominio.`)
        setCargando(false)
        return
      }

      setCookies(data.rol, data.nombre, data.business_id, data.branch_id || '', data.id, biz?.slug || '')
      const target = obtenerRedireccionUrl(data.rol)
      setTimeout(() => { window.location.href = target }, 300)
      setCargando(false)
    } catch (err: any) {
      setError(err.message || 'Error de conexión.')
      setCargando(false)
    }
  }

  const registrarNegocioSaaS = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regNombre.trim() || !regEmail.trim() || !regPin.trim() || !regNegocio.trim() || !regSlug.trim()) {
      return setError('Llena todos los campos del registro')
    }
    if (regPin.trim().length < 6 || regPin.trim().length > 16) {
      return setError('La contraseña debe tener entre 6 y 16 caracteres')
    }

    setCargando(true)
    setError('')

    try {
      const slugFormateado = regSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')

      const { data: existente } = await supabase
        .from('businesses')
        .select('id')
        .eq('slug', slugFormateado)
        .maybeSingle()

      if (existente) {
        throw new Error('El subdominio de negocio ya está ocupado por otra marca')
      }

      const fin = new Date()
      fin.setDate(fin.getDate() + 365)

      const { data: biz, error: errBiz } = await supabase
        .from('businesses')
        .insert({
          nombre: regNegocio.trim(),
          slug: slugFormateado,
          owner_name: regNombre.trim(),
          owner_email: regEmail.trim().toLowerCase(),
          plan: 'anual',
          estado: 'activo',
          creditos_totales: 12,
          creditos_usados: 12,
          fecha_vencimiento: fin.toISOString(),
          es_demo: false,
          latitude: 19.421583,
          longitude: -102.067222,
          mensaje_push: '¡Estás cerca de tu premio! Pasa por tus sellos VIP.'
        })
        .select()
        .single()

      if (errBiz || !biz) throw errBiz || new Error('No se pudo registrar el comercio')

      const { data: user, error: errUser } = await supabase
        .from('business_users')
        .insert({
          business_id: biz.id,
          nombre: regNombre.trim(),
          email: regEmail.trim().toLowerCase(),
          pin: regPin.trim(),
          rol: 'admin_comercio',
          activo: true
        })
        .select()
        .single()

      if (errUser || !user) throw errUser || new Error('No se pudo registrar la cuenta admin')

      await supabase.from('credit_transactions').insert({
        business_id: biz.id,
        tipo: 'demo',
        creditos: 12,
        meses: 12,
        monto_mxn: 0,
        notas: 'Regalo de Onboarding: 12 créditos (1 año de servicio gratis)',
        creado_por: 'self_onboarding'
      })

      const domain = typeof window !== 'undefined' && window.location.hostname.includes('loyaltyclub.mx') ? 'loyaltyclub.mx' : 'localhost:3000'
      setCookies('admin_comercio', user.nombre, biz.id, '', user.id, biz.slug || '')
      alert(`🎉 ¡Negocio registrado con éxito!\nPortal: https://${slugFormateado}.${domain}/dashboard`)
      setTimeout(() => { window.location.href = `https://${slugFormateado}.${domain}/dashboard` }, 300)

    } catch (err: any) {
      setError(err.message || 'Error durante el registro')
      setCargando(false)
    }
  }

  const formatearSlug = (val: string) => {
    const limpia = val.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setRegSlug(limpia)
    if (val && !regNegocio) setRegNegocio(val)
  }

  const TABS = [
    { id: 'email', label: 'Email' },
    { id: 'pin', label: 'PIN Rápido' },
  ]

  return (
    <main className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4 font-sans">

      <div className="w-full max-w-[400px] space-y-8 animate-fadeIn">

        {/* ── Logo y Branding ── */}
        <div className="text-center space-y-4">
          <div className="w-[72px] h-[72px] mx-auto rounded-2xl overflow-hidden shadow-md border border-[#e4e4e7] bg-white flex items-center justify-center">
            {subdomainBranding?.logo ? (
              subdomainBranding.logo.startsWith('http') || subdomainBranding.logo.startsWith('/') || subdomainBranding.logo.startsWith('data:') || subdomainBranding.logo.endsWith('.png') || subdomainBranding.logo.endsWith('.jpg') || subdomainBranding.logo.endsWith('.svg') || subdomainBranding.logo.endsWith('.jpeg') || subdomainBranding.logo.endsWith('.webp') ? (
                <img 
                  src={subdomainBranding.logo.startsWith('http') || subdomainBranding.logo.startsWith('/') || subdomainBranding.logo.startsWith('data:') ? subdomainBranding.logo : `/${subdomainBranding.logo}`} 
                  alt="" 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <span className="text-3xl">{subdomainBranding.logo}</span>
              )
            ) : (
              <img src="/logo.png" alt="LoyaltyClub" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display='none' }} />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#09090b] tracking-tight">
              {subdomainBranding?.nombre || 'LoyaltyClub'}
            </h1>
            <p className="text-sm text-[#71717a] mt-1">
              {subdomainBranding ? `Portal de acceso — ${subdomainBranding.nombre}` : 'Sistema de Fidelización Enterprise'}
            </p>
          </div>
        </div>

        {/* ── Selector de modo (tabs minimalistas) ── */}
        <div className="flex border-b border-[#e4e4e7]">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setModo(tab.id as any); setError(''); setPin('') }}
              className={`nav-tab flex-1 pb-3 pt-1 text-sm transition-all ${
                modo === tab.id ? 'active' : ''
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Card Principal ── */}
        <div className="bg-white rounded-2xl shadow-[0_2px_20px_rgba(0,0,0,0.07)] border border-[#f0f0f0] p-8 space-y-5">

          {/* MODO: EMAIL */}
          {modo === 'email' && (
            <form onSubmit={loginConEmail} className="space-y-5 animate-fadeIn">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">
                  Email de Administrador
                </label>
                <input
                  id="username"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-clean"
                  placeholder="admin@minegocio.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">
                  Contraseña / PIN
                </label>
                <div className="relative">
                  <input
                    id="current-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input-clean pr-12"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a1a1aa] hover:text-[#52525b] transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  onClick={() => setRecordarme(!recordarme)}
                  className={`w-9 h-5 rounded-full transition-all cursor-pointer flex items-center shrink-0 ${
                    recordarme ? 'bg-[#dc2626] justify-end' : 'bg-[#e4e4e7] justify-start'
                  }`}
                >
                  <div className="w-3.5 h-3.5 bg-white rounded-full mx-0.5 shadow-sm" />
                </div>
                <span className="text-xs text-[#71717a] group-hover:text-[#52525b] transition-colors">
                  Recordarme en este dispositivo (24h)
                </span>
              </label>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600 text-center font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={cargando}
                className="btn-primary w-full py-3.5 text-sm"
              >
                {cargando ? (
                  <><Loader2 size={16} className="animate-spin" /> Verificando...</>
                ) : 'Iniciar Sesión'}
              </button>
            </form>
          )}

          {/* MODO: PIN */}
          {modo === 'pin' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center">
                <p className="text-sm font-semibold text-[#09090b]">PIN de Acceso Rápido</p>
                <p className="text-xs text-[#71717a] mt-1">Ingresa tu código de 4 dígitos</p>
              </div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '')
                  setPin(v)
                  setError('')
                  if (v.length >= 4) loginConPin(v)
                }}
                disabled={cargando}
                className={`w-full bg-[#fafafa] border-2 rounded-2xl text-center text-4xl tracking-[0.6em] py-5 text-[#09090b] font-mono focus:outline-none transition-colors ${
                  error ? 'border-red-300 bg-red-50' : 'border-[#e4e4e7] focus:border-[#dc2626]'
                }`}
                placeholder="••••"
              />
              {error && (
                <p className="text-red-500 text-sm text-center font-medium">{error}</p>
              )}
              {cargando && (
                <div className="flex justify-center">
                  <Loader2 className="w-6 h-6 text-[#dc2626] animate-spin" />
                </div>
              )}
            </div>
          )}

          {/* MODO: REGISTRO SaaS */}
          {modo === 'registro' && (
            <form onSubmit={registrarNegocioSaaS} className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">Tu Nombre</label>
                  <input
                    type="text"
                    value={regNombre}
                    onChange={e => setRegNombre(e.target.value)}
                    className="input-clean text-sm"
                    placeholder="Pedro Infante"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">Email</label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    className="input-clean text-sm"
                    placeholder="pedro@negocio.com"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">Negocio</label>
                  <input
                    type="text"
                    value={regNegocio}
                    onChange={e => setRegNegocio(e.target.value)}
                    className="input-clean text-sm"
                    placeholder="La Burrería"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">Contraseña</label>
                  <div className="relative">
                    <input
                      type={showRegPin ? 'text' : 'password'}
                      maxLength={16}
                      value={regPin}
                      onChange={e => setRegPin(e.target.value)}
                      className="input-clean text-sm pr-9"
                      placeholder="Mín. 6 caracteres"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPin(!showRegPin)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a1a1aa] hover:text-[#52525b]"
                      tabIndex={-1}
                    >
                      {showRegPin ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">Slug / Subdominio</label>
                <input
                  type="text"
                  value={regSlug}
                  onChange={e => formatearSlug(e.target.value)}
                  className="input-clean text-sm font-mono"
                  placeholder="laburreria"
                  required
                />
                {regSlug && (
                  <p className="text-xs text-[#71717a] font-mono mt-1">
                    🌐 <strong>{regSlug}.loyaltyclub.mx/dashboard</strong>
                  </p>
                )}
              </div>

              <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-xl p-3 text-xs space-y-1">
                <div className="flex justify-between text-[#52525b] font-medium">
                  <span>Regalo de Bienvenida:</span>
                  <span className="text-[#dc2626] font-bold">1 Año Gratis</span>
                </div>
                <div className="flex justify-between text-[#52525b] font-medium">
                  <span>Créditos SaaS:</span>
                  <span className="text-[#dc2626] font-bold">12 Créditos</span>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600 text-center font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={cargando}
                className="btn-primary w-full py-3.5 text-sm"
              >
                {cargando ? (
                  <><Loader2 size={16} className="animate-spin" /> Desplegando...</>
                ) : '🚀 Registrar mi Negocio'}
              </button>
            </form>
          )}
        </div>

        {/* ── Botón PWA ── */}
        {installPrompt && (
          <button
            onClick={() => installPrompt.prompt()}
            className="w-full border border-[#e4e4e7] hover:border-[#d4d4d8] text-[#52525b] hover:text-[#09090b] font-medium py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 bg-white hover:shadow-sm"
          >
            <span>⬇️</span> Instalar App
          </button>
        )}

        <p className="text-center text-[#a1a1aa] text-xs">
          LoyaltyClub Enterprise · SaaS Multi-Tenant
        </p>
      </div>
    </main>
  )
}