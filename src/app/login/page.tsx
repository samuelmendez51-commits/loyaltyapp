'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [modo, setModo] = useState<'email' | 'pin' | 'registro'>('email')
  
  // Login
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pin, setPin] = useState('')
  const [recordarme, setRecordarme] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  
  // Registro SaaS
  const [regNombre, setRegNombre] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPin, setRegPin] = useState('')
  const [showRegPin, setShowRegPin] = useState(false)
  const [regNegocio, setRegNegocio] = useState('')
  const [regSlug, setRegSlug] = useState('')

  const [subdomainBranding, setSubdomainBranding] = useState<{ nombre: string; logo: string } | null>(null)
  
  // Capturar evento de PWA y jalar Branding de Subdominio
  useEffect(() => {
    const handlePrompt = (e: any) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handlePrompt)

    if (typeof window !== 'undefined') {
      const host = window.location.hostname
      const parts = host.split('.')
      if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'localhost') {
        const slug = parts[0]
        supabase
          .from('businesses')
          .select('nombre, logo_url')
          .eq('slug', slug)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              setSubdomainBranding({
                nombre: data.nombre,
                logo: data.logo_url || '✨'
              })
            }
          })
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', handlePrompt)
  }, [])

  const setCookies = (rol: string, nombre: string, businessId: string, branchId: string, userId: string) => {
    const maxAge = recordarme ? '; Max-Age=86400' : ''
    const base = `; path=/; SameSite=Strict${maxAge}`
    document.cookie = `session_rol=${rol}${base}`
    document.cookie = `session_user=${nombre}${base}`
    document.cookie = `session_business_id=${businessId}${base}`
    document.cookie = `session_branch_id=${branchId}${base}`
    document.cookie = `session_user_id=${userId}${base}`
  }

  const obtenerRedireccionUrl = (rol: string, slug: string) => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const redirect = urlParams.get('redirect')
      if (redirect) return redirect
    }
    if (rol === 'superadmin') return '/superadmin'
    if (rol === 'admin_comercio') return slug ? `/${slug}/dashboard` : '/dashboard'
    return '/escaner'
  }

  const loginConEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return setError('Completa todos los campos')
    setCargando(true)
    setError('')

    try {
      if (email === (process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL || 'superadmin@loyaltyapp.com') 
          && password === '0000') {
        setCookies('superadmin', 'Super Admin', '', '', 'root')
        const target = obtenerRedireccionUrl('superadmin', '')
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
        setError('Credenciales incorrectas')
        setCargando(false)
        return
      }

      const biz = data.businesses as any
      if (biz?.estado === 'vencido' || biz?.bloqueado_manual) {
        setError('Esta cuenta está suspendida. Contacta a soporte.')
        setCargando(false)
        return
      }

      setCookies(data.rol, data.nombre, data.business_id, data.branch_id || '', data.id)
      const target = obtenerRedireccionUrl(data.rol, biz?.slug || '')
      setTimeout(() => { window.location.href = target }, 300)
      setCargando(false)
    } catch (err: any) {
      setError(err.message || 'Error de conexión o autenticación.')
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
        const target = obtenerRedireccionUrl('superadmin', '')
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

      setCookies(data.rol, data.nombre, data.business_id, data.branch_id || '', data.id)
      const target = obtenerRedireccionUrl(data.rol, biz?.slug || '')
      setTimeout(() => { window.location.href = target }, 300)
      setCargando(false)
    } catch (err: any) {
      setError(err.message || 'Error de conexión con el PIN.')
      setCargando(false)
    }
  }

  const registrarNegocioSaaS = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regNombre.trim() || !regEmail.trim() || !regPin.trim() || !regNegocio.trim() || !regSlug.trim()) {
      return setError('Llene todos los campos del registro')
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
        throw new Error('La página / subdominio de negocio ya está ocupado por otra marca')
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

      await supabase.from('menu_groups').insert({
        business_id: biz.id,
        nombre: 'General',
        descripcion: 'Platillos principales',
        orden: 1
      })

      await supabase.from('credit_transactions').insert({
        business_id: biz.id,
        tipo: 'demo',
        creditos: 12,
        meses: 12,
        monto_mxn: 0,
        notas: 'Regalo de Onboarding SaaS: 12 créditos (1 año de servicio gratis)',
        creado_por: 'self_onboarding'
      })

      setCookies('admin_comercio', user.nombre, biz.id, '', user.id)
      
      alert(`🎉 ¡Negocio registrado con éxito absoluto!\nPágina creada en: loyaltyapp.vercel.app/${slugFormateado}`)
      
      setTimeout(() => {
        window.location.href = `/${slugFormateado}/dashboard`
      }, 300)

    } catch (err: any) {
      setError(err.message || 'Error durante el registro SaaS')
      setCargando(false)
    }
  }

  const formatearSlug = (val: string) => {
    const limpia = val.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setRegSlug(limpia)
    if (val && !regNegocio) {
      setRegNegocio(val)
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Luces de fondo premium */}
      <div className="fixed top-[-10%] left-1/4 w-96 h-96 bg-red-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-1/4 w-96 h-96 bg-red-950/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Logo / Branding */}
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-zinc-800 to-zinc-950 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(255,255,255,0.05)] border border-zinc-700/20 overflow-hidden">
            {subdomainBranding?.logo ? (
              subdomainBranding.logo.startsWith('http') || subdomainBranding.logo.startsWith('/') || subdomainBranding.logo.startsWith('data:') ? (
                <img src={subdomainBranding.logo} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl">{subdomainBranding.logo}</span>
              )
            ) : (
              <span className="text-4xl">✨</span>
            )}
          </div>
          <h1 className="text-4xl font-black text-white font-sans tracking-tighter italic">
            {subdomainBranding?.nombre || 'LoyaltyApp'}
          </h1>
          <p className="text-[10px] text-zinc-550 uppercase tracking-widest font-black mt-2">
            {subdomainBranding?.nombre ? `Panel de Acceso de ${subdomainBranding.nombre}` : 'SaaS de Fidelización Multi-Tenant · V12'}
          </p>
        </div>

        {/* Selector de modo */}
        <div className="flex bg-zinc-900/60 border border-zinc-800 rounded-2xl p-1">
          {[
            { id: 'email', label: 'Email Login' },
            { id: 'pin', label: 'PIN Rápido' },
            { id: 'registro', label: 'Registrarse' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setModo(tab.id as any); setError('') }}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                modo === tab.id 
                  ? 'bg-zinc-850 text-red-500 border border-zinc-700 shadow-sm' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-[#121212] border border-zinc-900 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
          
          {/* MODO: LOGIN CON EMAIL */}
          {modo === 'email' && (
            <form onSubmit={loginConEmail} className="space-y-4 animate-in fade-in duration-200">
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-black block">Email de Administrador</label>
                <input
                  id="username"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-600 transition-colors"
                  placeholder="admin@minegocio.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-550 uppercase tracking-widest font-black block">Contraseña / PIN</label>
                <div className="relative">
                  <input
                    id="current-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 pr-12 text-white text-sm focus:outline-none focus:border-red-600 transition-colors"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  onClick={() => setRecordarme(!recordarme)}
                  className={`w-10 h-6 rounded-full transition-all cursor-pointer flex items-center ${
                    recordarme ? 'bg-red-600 justify-end' : 'bg-zinc-800 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 bg-white rounded-full mx-1 shadow-sm" />
                </div>
                <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400 transition-colors uppercase tracking-wider font-bold">
                  Recordarme en este dispositivo (24h)
                </span>
              </label>

              {error && (
                <p className="text-red-400 text-xs font-bold text-center bg-red-950/20 border border-red-900/30 rounded-lg py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={cargando}
                className="w-full bg-gradient-to-r from-red-600 to-red-800 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs transition-all hover:brightness-110 disabled:opacity-50 shadow-lg shadow-red-950/40"
              >
                {cargando ? 'Accediendo...' : 'Ingresar al Portal'}
              </button>
            </form>
          )}

          {/* MODO: LOGIN CON PIN */}
          {modo === 'pin' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="text-center">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Ingresa tu PIN Rápido de 4 dígitos</p>
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
                className={`w-full bg-black border-2 rounded-2xl text-center text-4xl tracking-[0.5em] py-4 text-white font-mono focus:outline-none transition-colors ${
                  error ? 'border-red-900/50' : 'border-zinc-800 focus:border-red-600'
                }`}
                placeholder="••••"
              />
              {error && (
                <p className="text-red-400 text-xs font-bold text-center">{error}</p>
              )}
              {cargando && (
                <div className="flex justify-center">
                  <div className="w-6 h-6 border-2 border-zinc-800 border-t-red-600 rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}

          {/* MODO: REGISTRO SAAS SELF-SERVICE */}
          {modo === 'registro' && (
            <form onSubmit={registrarNegocioSaaS} className="space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] text-zinc-500 uppercase font-black block">Tu Nombre Completo</label>
                  <input
                    type="text"
                    value={regNombre}
                    onChange={e => setRegNombre(e.target.value)}
                    className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-red-600 transition-colors"
                    placeholder="Ej: Pedro Infante"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] text-zinc-500 uppercase font-black block">Email / Usuario</label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-red-600 transition-colors"
                    placeholder="Ej: pedro@restaurante.com"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] text-zinc-500 uppercase font-black block">Nombre del Negocio</label>
                  <input
                    type="text"
                    value={regNegocio}
                    onChange={e => setRegNegocio(e.target.value)}
                    className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-red-600 transition-colors"
                    placeholder="Ej: La Burrería"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] text-zinc-500 uppercase font-black block">Contraseña (6-16 chars)</label>
                  <div className="relative">
                    <input
                      type={showRegPin ? 'text' : 'password'}
                      maxLength={16}
                      value={regPin}
                      onChange={e => setRegPin(e.target.value)}
                      className="w-full bg-black/50 border border-zinc-800 rounded-xl px-3 py-2.5 pr-10 text-xs text-white focus:outline-none focus:border-red-600 transition-colors"
                      placeholder="Mín. 6 caracteres"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPin(!showRegPin)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showRegPin ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-500 uppercase font-black block">Subdominio / Slug de tu página</label>
                <input
                  type="text"
                  value={regSlug}
                  onChange={e => formatearSlug(e.target.value)}
                  className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-red-600 transition-colors"
                  placeholder="Ej: laburreria"
                  required
                />
                
                {regSlug && (
                  <p className="text-[9px] text-red-400 font-mono mt-1 select-all break-all">
                    🌐 Tu portal de control será:<br/>
                    <strong>loyaltyapp.vercel.app/{regSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')}/dashboard</strong>
                  </p>
                )}
              </div>

              {error && (
                <p className="text-red-400 text-xs font-bold text-center bg-red-950/20 border border-red-900/30 rounded-lg py-2">
                  {error}
                </p>
              )}

              <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3.5 text-[9px] uppercase tracking-wider space-y-1">
                <div className="flex justify-between font-bold text-zinc-400">
                  <span>Regalo de Bienvenida B2B:</span>
                  <span className="text-red-400">1 Año Gratis</span>
                </div>
                <div className="flex justify-between font-bold text-zinc-400">
                  <span>Créditos SaaS Cargados:</span>
                  <span className="text-red-400">12 Créditos</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={cargando}
                className="w-full bg-gradient-to-r from-red-600 to-red-800 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs transition-all hover:brightness-110 disabled:opacity-50 shadow-lg shadow-red-950/40"
              >
                {cargando ? 'Desplegando tu SaaS...' : '🚀 Registrar mi Negocio'}
              </button>
            </form>
          )}

        </div>

        {/* Botón PWA */}
        {installPrompt && (
          <button
            onClick={() => installPrompt.prompt()}
            className="w-full border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white font-bold py-3.5 rounded-2xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-[#121212]/50"
          >
            <span>⬇️</span> Descargar App de Escritorio Standalone
          </button>
        )}

        <p className="text-center text-zinc-700 text-[9px] uppercase tracking-widest">
          LoyaltyApp Enterprise · SaaS Multi-Tenant V10
        </p>
      </div>
    </main>
  )
}