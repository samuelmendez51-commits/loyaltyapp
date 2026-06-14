'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function LoginPage() {
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
  
  // Nuevos Estados para Onboarding Multi-Paso B2B
  const [regPasoOnboarding, setRegPasoOnboarding] = useState<1 | 2 | 3>(1)
  const [regTelefono, setRegTelefono] = useState('')
  const [regWhatsapp, setRegWhatsapp] = useState('')
  const [regLogoUrl, setRegLogoUrl] = useState('')
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const [deployProgress, setDeployProgress] = useState(0)
  const [deployMessage, setDeployMessage] = useState('Inicializando tu entorno...')

  const [subdomainBranding, setSubdomainBranding] = useState<{ nombre: string; logo: string } | null>(null)

  useEffect(() => {
    const handlePrompt = (e: any) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handlePrompt)

    if (typeof window !== 'undefined') {
      const host = window.location.hostname
      const parts = host.split('.')
      let slug = ''
      if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'localhost') {
        slug = parts[0]
      } else if (parts.length > 1 && parts[1] === 'localhost') {
        slug = parts[0]
      }
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
    }

    return () => window.removeEventListener('beforeinstallprompt', handlePrompt)
  }, [])

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

  const obtenerRedireccionUrl = (rol: string, slug: string) => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const redirect = urlParams.get('redirect')
      if (redirect) return redirect

      const host = window.location.hostname
      const parts = host.split('.')
      const runsOnSubdomain = (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'localhost') || (parts.length > 1 && parts[1] === 'localhost')

      if (rol === 'superadmin') return '/superadmin'
      
      if (rol === 'admin_comercio') {
        if (runsOnSubdomain) {
          return '/dashboard'
        } else {
          if (slug) {
            const isProd = host.includes('loyaltyclub.mx')
            const domain = isProd ? 'loyaltyclub.mx' : 'localhost:3000'
            const protocol = isProd ? 'https' : 'http'
            return `${protocol}://${slug}.partners.${domain}/dashboard`
          }
          return '/dashboard'
        }
      }

      // Empleado / Cajero
      if (runsOnSubdomain) {
        return '/escaner'
      } else {
        if (slug) {
          const isProd = host.includes('loyaltyclub.mx')
          const domain = isProd ? 'loyaltyclub.mx' : 'localhost:3000'
          const protocol = isProd ? 'https' : 'http'
          return `${protocol}://${slug}.partners.${domain}/escaner`
        }
        return '/escaner'
      }
    }
    return '/login'
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

      let currentSlug = ''
      if (typeof window !== 'undefined') {
        const host = window.location.hostname
        const parts = host.split('.')
        if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'localhost') {
          currentSlug = parts[0]
        } else if (parts.length > 1 && parts[1] === 'localhost') {
          currentSlug = parts[0]
        }
      }

      if (currentSlug && biz?.slug !== currentSlug) {
        setError(`Este usuario pertenece al comercio "${biz?.nombre || 'otro comercio'}" y no está autorizado para acceder desde este subdominio.`)
        setCargando(false)
        return
      }

      setCookies(data.rol, data.nombre, data.business_id, data.branch_id || '', data.id, biz?.slug || '')
      const target = obtenerRedireccionUrl(data.rol, biz?.slug || '')
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

      let currentSlug = ''
      if (typeof window !== 'undefined') {
        const host = window.location.hostname
        const parts = host.split('.')
        if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'localhost') {
          currentSlug = parts[0]
        } else if (parts.length > 1 && parts[1] === 'localhost') {
          currentSlug = parts[0]
        }
      }

      if (currentSlug && biz?.slug !== currentSlug) {
        setError(`Este PIN pertenece a otro comercio y no está autorizado para acceder desde este subdominio.`)
        setCargando(false)
        return
      }

      setCookies(data.rol, data.nombre, data.business_id, data.branch_id || '', data.id, biz?.slug || '')
      const target = obtenerRedireccionUrl(data.rol, biz?.slug || '')
      setTimeout(() => { window.location.href = target }, 300)
      setCargando(false)
    } catch (err: any) {
      setError(err.message || 'Error de conexión.')
      setCargando(false)
    }
  }

  const subirLogoRegistro = async (file: File) => {
    setSubiendoLogo(true)
    setError('')
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `temp-onboarding/logo-${Date.now()}.${fileExt}`
      const { error: uploadErr } = await supabase.storage
        .from('menu-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: true, contentType: file.type || 'application/octet-stream' })
      if (uploadErr) throw uploadErr
      
      const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(fileName)
      if (urlData?.publicUrl) {
        setRegLogoUrl(urlData.publicUrl)
      }
    } catch (err: any) {
      setError('Error al subir logotipo: ' + err.message)
    } finally {
      setSubiendoLogo(false)
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
    setRegPasoOnboarding(3)
    setDeployProgress(10)
    setDeployMessage('Inicializando servidor SaaS...')

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

      setDeployProgress(30)
      setDeployMessage('Creando entorno y base de datos de lealtad...')

      const savedDemoDays = typeof window !== 'undefined' ? localStorage.getItem('superadmin_dias_demo') : null
      const diasPrueba = savedDemoDays ? Number(savedDemoDays) : 30

      const fin = new Date()
      fin.setDate(fin.getDate() + diasPrueba)

      const { data: biz, error: errBiz } = await supabase
        .from('businesses')
        .insert({
          nombre: regNegocio.trim(),
          slug: slugFormateado,
          owner_name: regNombre.trim(),
          owner_email: regEmail.trim().toLowerCase(),
          plan: 'demo',
          estado: 'demo',
          creditos_totales: 1,
          creditos_usados: 1,
          fecha_vencimiento: fin.toISOString(),
          es_demo: true,
          logo_url: regLogoUrl || '🍔',
          telefono_whatsapp: regWhatsapp.trim().replace(/\D/g, '') || regTelefono.trim().replace(/\D/g, ''),
          direccion: 'Calle Principal 123',
          latitude: 19.421583,
          longitude: -102.067222,
          mensaje_push: '¡Estás cerca de tu premio! Pasa por tus sellos VIP.'
        })
        .select()
        .single()

      if (errBiz || !biz) throw errBiz || new Error('No se pudo registrar el comercio')

      setDeployProgress(60)
      setDeployMessage('Vinculando cuenta de administrador...')

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

      setDeployProgress(80)
      setDeployMessage('Inicializando cascarón de premios y ruleta...')

      await supabase.from('loyalty_rewards').insert([
        { business_id: biz.id, sello_requerido: 3, nombre: 'Premio Rápido', descripcion: 'Sello 3 alcanzado', tipo: 'intermedio', activo: true },
        { business_id: biz.id, sello_requerido: 10, nombre: 'Recompensa Final', descripcion: '¡Sello 10 completo! Premio Mayor', tipo: 'final', activo: true }
      ])

      await supabase.from('credit_transactions').insert({
        business_id: biz.id,
        tipo: 'demo',
        creditos: 1,
        meses: 1,
        monto_mxn: 0,
        notas: `Regalo de Onboarding: Período Demo gratuito de ${diasPrueba} días`,
        creado_por: 'self_onboarding'
      })

      setDeployProgress(100)
      setDeployMessage(`¡Listo! Desplegando en https://${slugFormateado}.loyaltyclub.mx...`)

      await new Promise(r => setTimeout(r, 1200))

      const domain = typeof window !== 'undefined' && window.location.hostname.includes('loyaltyclub.mx') ? 'loyaltyclub.mx' : 'localhost:3000'
      setCookies('admin_comercio', user.nombre, biz.id, '', user.id, biz.slug || '')
      window.location.href = `https://${slugFormateado}.${domain}/dashboard`
    } catch (err: any) {
      setError(err.message || 'Error durante el registro')
      setRegPasoOnboarding(2)
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
          <div className="w-[72px] h-[72px] mx-auto rounded-2xl overflow-hidden shadow-md border border-[#e4e4e7] bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center">
            {subdomainBranding?.logo ? (
              subdomainBranding.logo.startsWith('http') || subdomainBranding.logo.startsWith('/') ? (
                <img src={subdomainBranding.logo} alt="" className="w-full h-full object-cover bg-white" />
              ) : (
                <span className="text-3xl">{subdomainBranding.logo}</span>
              )
            ) : (
              <span className="text-white text-3xl font-black select-none">👑</span>
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
            <div className="animate-fadeIn">
              {regPasoOnboarding === 1 && (
                <div className="space-y-4">
                  <div className="text-center mb-2">
                    <p className="text-xs text-[#dc2626] uppercase font-bold tracking-wider font-mono">Paso 1 de 2: Cuenta</p>
                    <h3 className="text-sm font-bold text-[#09090b]">Crea tu cuenta de Administrador</h3>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">Tu Nombre Completo *</label>
                    <input
                      type="text"
                      value={regNombre}
                      onChange={e => setRegNombre(e.target.value)}
                      className="input-clean"
                      placeholder="Pedro Infante"
                      required
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">Tu Email *</label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      className="input-clean"
                      placeholder="pedro@negocio.com"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">Contraseña (Mín. 6 caracteres) *</label>
                    <div className="relative">
                      <input
                        type={showRegPin ? 'text' : 'password'}
                        maxLength={16}
                        value={regPin}
                        onChange={e => setRegPin(e.target.value)}
                        className="input-clean pr-9"
                        placeholder="Crea una contraseña segura"
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

                  {error && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-650 text-center font-bold">
                      {error}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (!regNombre.trim() || !regEmail.trim() || !regPin.trim()) {
                        return setError('Por favor llena todos los campos obligatorios')
                      }
                      if (regPin.trim().length < 6 || regPin.trim().length > 16) {
                        return setError('La contraseña debe tener entre 6 y 16 caracteres')
                      }
                      setError('')
                      setRegPasoOnboarding(2)
                    }}
                    className="btn-primary w-full py-3.5 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                  >
                    Siguiente Paso ➡️
                  </button>
                </div>
              )}

              {regPasoOnboarding === 2 && (
                <form onSubmit={registrarNegocioSaaS} className="space-y-4">
                  <div className="text-center mb-2">
                    <p className="text-xs text-[#dc2626] uppercase font-bold tracking-wider font-mono">Paso 2 de 2: Negocio</p>
                    <h3 className="text-sm font-bold text-[#09090b]">Configura los detalles de tu marca</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">Nombre del Negocio *</label>
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
                      <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">Subdominio / URL *</label>
                      <input
                        type="text"
                        value={regSlug}
                        onChange={e => formatearSlug(e.target.value)}
                        className="input-clean text-sm font-mono"
                        placeholder="laburreria"
                        required
                      />
                    </div>
                  </div>

                  {regSlug && (
                    <p className="text-[10px] text-[#71717a] font-mono -mt-1 block">
                      🌐 Tu portal: <strong className="text-[#09090b]">{regSlug}.loyaltyclub.mx</strong>
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">Teléfono Fijo</label>
                      <input
                        type="tel"
                        value={regTelefono}
                        onChange={e => setRegTelefono(e.target.value)}
                        className="input-clean text-sm"
                        placeholder="4521234567"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">WhatsApp</label>
                      <input
                        type="tel"
                        value={regWhatsapp}
                        onChange={e => setRegWhatsapp(e.target.value)}
                        className="input-clean text-sm"
                        placeholder="4527654321"
                      />
                    </div>
                  </div>

                  {/* Logo Upload */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">Logotipo (Opcional)</label>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl border border-[#e4e4e7] bg-[#fafafa] flex items-center justify-center text-xl shrink-0 overflow-hidden">
                        {subiendoLogo ? (
                          <Loader2 className="w-5 h-5 text-[#dc2626] animate-spin" />
                        ) : regLogoUrl ? (
                          regLogoUrl.startsWith('http') ? (
                            <img src={regLogoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span>{regLogoUrl}</span>
                          )
                        ) : (
                          <span>📸</span>
                        )}
                      </div>
                      <div className="flex-1 relative">
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer w-full"
                          onChange={e => { if (e.target.files?.[0]) subirLogoRegistro(e.target.files[0]) }}
                        />
                        <button
                          type="button"
                          className="w-full border border-[#e4e4e7] hover:border-[#d4d4d8] text-[#52525b] hover:text-[#09090b] font-bold text-xs py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                        >
                          {regLogoUrl ? '✓ Cambiar Imagen' : 'Subir Logotipo'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-xl p-3 text-xs space-y-1">
                    <div className="flex justify-between text-[#52525b] font-semibold">
                      <span>Período de Prueba:</span>
                      <span className="text-green-650 font-bold">Demo Gratis</span>
                    </div>
                    <div className="flex justify-between text-[#52525b] font-medium">
                      <span>Costo Mensual Posterior:</span>
                      <span className="text-[#a1a1aa] line-through">$499 MXN</span>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-650 text-center font-bold">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setRegPasoOnboarding(1)}
                      className="border border-[#e4e4e7] hover:bg-[#fafafa] text-[#71717a] font-bold text-sm px-4 py-3 rounded-xl transition-colors"
                    >
                      ⬅️ Atrás
                    </button>
                    <button
                      type="submit"
                      disabled={cargando || subiendoLogo}
                      className="btn-primary flex-1 py-3.5 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                    >
                      🚀 Desplegar mi Negocio
                    </button>
                  </div>
                </form>
              )}

              {/* Step 3: Fullscreen Deploying Overlay */}
              {regPasoOnboarding === 3 && (
                <div className="fixed inset-0 bg-white/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
                  <div className="max-w-md space-y-6 flex flex-col items-center">
                    {/* Spinning loading indicator */}
                    <div className="relative flex items-center justify-center">
                      <div className="w-24 h-24 rounded-full border-4 border-zinc-100 border-t-[#dc2626] animate-spin" />
                      <span className="absolute text-4xl">🚀</span>
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-extrabold text-[#09090b] tracking-tight">Desplegando tu Club VIP</h2>
                      <p className="text-sm font-semibold text-[#dc2626] animate-pulse">{deployMessage}</p>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-64 h-2 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                      <div 
                        className="h-full bg-gradient-to-r from-[#dc2626] to-red-500 transition-all duration-500 rounded-full"
                        style={{ width: `${deployProgress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-[#a1a1aa] uppercase font-mono tracking-widest font-bold">
                      Paso 3 de 3 · Configuración del Servidor
                    </p>
                  </div>
                </div>
              )}
            </div>
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