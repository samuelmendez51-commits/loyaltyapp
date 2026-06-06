'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, UserPlus, CheckCircle2, LogIn, Phone, Key, ShieldAlert, Truck, Image, Clock } from 'lucide-react'

// Haversine formula to compute distance in meters between two coordinates
function calcularDistanciaMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

export default function RegistroCliente() {
  const router = useRouter()
  // ── Tenant: slug extraído del subdominio vía rewrite del middleware ──
  const slug = (useParams().slug as string) || ''

  if (slug === 'bikers') {
    return <RegistroBiker />
  }

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [calle, setCalle] = useState('')
  const [numero, setNumero] = useState('')
  const [colonia, setColonia] = useState('')
  const [referencia, setReferencia] = useState('')

  // Selector de fecha de nacimiento (3 selectores)
  const [dia, setDia] = useState('')
  const [mes, setMes] = useState('')
  const [anio, setAnio] = useState('')

  const [registrando, setRegistrando] = useState(false)
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' })
  const [business, setBusiness] = useState<any>(null)
  const [geoConfig, setGeoConfig] = useState<any>(null)
  const [modo, setModo] = useState<'registro' | 'login'>('registro')

  useEffect(() => {
    // Cargar branding del negocio por slug (inyectado por el middleware desde el subdominio)
    if (!slug) return
    const cargarNegocio = async () => {
      const { data } = await supabase
        .from('businesses')
        .select('id, nombre, logo_url, color_primario, latitude, longitude')
        .eq('slug', slug)
        .maybeSingle()
      if (data) {
        setBusiness(data)
        // Cargar también configuración de geopush si existe
        const { data: geo } = await supabase
          .from('configuracion_geopush')
          .select('*')
          .eq('business_id', data.id)
          .maybeSingle()
        if (geo) setGeoConfig(geo)
      }
    }
    cargarNegocio()
  }, [slug])

  const iniciarSesion = async (e: React.FormEvent) => {
    e.preventDefault()
    const telefonoLimpio = telefono.replace(/\D/g, '')
    if (telefonoLimpio.length !== 10) {
      setMensaje({ texto: 'El teléfono debe tener exactamente 10 dígitos.', tipo: 'error' })
      return
    }

    setRegistrando(true)
    setMensaje({ texto: '', tipo: '' })

    try {
      const tenantId = business?.id
      if (!tenantId) {
        setMensaje({ texto: 'Cargando información del negocio. Intenta de nuevo.', tipo: 'error' })
        return
      }

      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('telefono', telefonoLimpio)
        .eq('business_id', tenantId)
        .maybeSingle()

      if (error) {
        setMensaje({ texto: 'Error al buscar tu socio. Intenta de nuevo.', tipo: 'error' })
      } else if (data) {
        setMensaje({ texto: '¡Bienvenido de vuelta! Abriendo tu tarjeta...', tipo: 'exito' })
        if (typeof window !== 'undefined') {
          localStorage.setItem('vip_cliente_id', data.id)
        }
        setTimeout(() => {
          router.push(`/cliente/${data.id}`)
        }, 1500)
      } else {
        setMensaje({ texto: 'No encontramos ningún socio con este número de teléfono.', tipo: 'error' })
      }
    } catch (err) {
      setMensaje({ texto: 'Error de conexión. Intenta de nuevo.', tipo: 'error' })
    } finally {
      setRegistrando(false)
    }
  }

  const registrarCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) return

    // Validación de teléfono (10 dígitos)
    const telefonoLimpio = telefono.replace(/\D/g, '')
    if (telefonoLimpio.length !== 10) {
      setMensaje({ texto: 'El teléfono debe tener exactamente 10 dígitos.', tipo: 'error' })
      return
    }

    setRegistrando(true)
    setMensaje({ texto: '', tipo: '' })

    // Ensamblaje de fecha de nacimiento (YYYY-MM-DD)
    let fechaEnsamblada: string | null = null
    if (dia && mes && anio) {
      const diaFormateado = dia.padStart(2, '0')
      const mesFormateado = mes.padStart(2, '0')
      fechaEnsamblada = `${anio}-${mesFormateado}-${diaFormateado}`
    }

    // business_id resuelto desde el negocio cargado por slug — sin cookies, sin hardcodes
    const tenantId = business?.id ?? null

    let latReg: number | null = null
    let lngReg: number | null = null
    let esVecino = false

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<any>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) => resolve(position),
            () => resolve(null),
            { timeout: 3000 }
          )
        })
        if (pos) {
          latReg = pos.coords.latitude
          lngReg = pos.coords.longitude

          const targetLat = geoConfig?.latitud ?? business?.latitude
          const targetLng = geoConfig?.longitud ?? business?.longitude
          const targetRad = geoConfig?.radio_metros ?? 500

          if (targetLat && targetLng) {
            const distance = calcularDistanciaMetros(latReg!, lngReg!, Number(targetLat), Number(targetLng))
            if (distance <= targetRad) {
              esVecino = true
            }
          }
        }
      } catch (e) {
        console.warn('Error al verificar GPS de registro:', e)
      }
    }

    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert([{
          nombre: nombre.trim(),
          telefono: telefonoLimpio,
          email: email.trim() || null,
          fecha_nacimiento: fechaEnsamblada,
          calle: calle.trim() || null,
          numero: numero.trim() || null,
          colonia: colonia.trim() || null,
          referencia: referencia.trim() || null,
          puntos: 0,
          business_id: tenantId,          // ← ID del negocio resuelto por subdominio
          branch_id: null,                // ← sin sucursal específica en registro público
          sucursal_registro_id: null,     // ← origen en registro público: nulo para evitar error de FK en sucursales
          lat_registro: latReg,
          lng_registro: lngReg,
          es_vecino: esVecino
        }])
        .select()

      if (error) {
        console.error('[Registro] Error al registrar:', error)
        if (error.code === '23505') {
          // Duplicado: buscar cliente y auto-iniciar sesión
          try {
            const { data: cliente } = await supabase
              .from('clientes')
              .select('*')
              .eq('telefono', telefonoLimpio)
              .eq('business_id', tenantId)
              .maybeSingle()

            if (cliente) {
              setMensaje({ texto: '¡Socio encontrado! Iniciando sesión...', tipo: 'exito' })
              if (typeof window !== 'undefined') {
                localStorage.setItem('vip_cliente_id', cliente.id)
              }
              setTimeout(() => {
                router.push(`/cliente/${cliente.id}`)
              }, 1500)
              return
            }
          } catch (errSearch) {
            console.error('[Registro] Error al buscar cliente existente:', errSearch)
          }
          setMensaje({
            texto: 'Este número de teléfono o correo ya está registrado en el club.',
            tipo: 'error'
          })
        } else {
          setMensaje({
            texto: 'Hubo un error al crear la tarjeta. Intenta de nuevo.',
            tipo: 'error'
          })
        }
      } else if (data && data[0]) {
        setMensaje({ texto: '¡Bienvenido al Club! Generando tu tarjeta VIP...', tipo: 'exito' })
        if (typeof window !== 'undefined') {
          localStorage.setItem('vip_cliente_id', data[0].id)
        }
        setTimeout(() => {
          router.push(`/cliente/${data[0].id}`)
        }, 1500)
      }
    } catch (err: any) {
      console.error('[Registro] Error inesperado:', err)
      if (err?.code === '23505') {
        try {
          const { data: cliente } = await supabase
            .from('clientes')
            .select('*')
            .eq('telefono', telefonoLimpio)
            .eq('business_id', tenantId)
            .maybeSingle()

          if (cliente) {
            setMensaje({ texto: '¡Socio encontrado! Iniciando sesión...', tipo: 'exito' })
            if (typeof window !== 'undefined') {
              localStorage.setItem('vip_cliente_id', cliente.id)
            }
            setTimeout(() => {
              router.push(`/cliente/${cliente.id}`)
            }, 1500)
            return
          }
        } catch (errSearch) {
          console.error('[Registro] Error en catch al buscar cliente existente:', errSearch)
        }
        setMensaje({
          texto: 'Este número de teléfono o correo ya está registrado en el club.',
          tipo: 'error'
        })
      } else {
        setMensaje({ texto: 'Error de conexión. Intenta de nuevo.', tipo: 'error' })
      }
    } finally {
      setRegistrando(false)
    }
  }

  const dias = Array.from({ length: 31 }, (_, i) => i + 1)
  const meses = [
    { num: '1', nombre: 'Enero' }, { num: '2', nombre: 'Febrero' }, { num: '3', nombre: 'Marzo' },
    { num: '4', nombre: 'Abril' }, { num: '5', nombre: 'Mayo' }, { num: '6', nombre: 'Junio' },
    { num: '7', nombre: 'Julio' }, { num: '8', nombre: 'Agosto' }, { num: '9', nombre: 'Septiembre' },
    { num: '10', nombre: 'Octubre' }, { num: '11', nombre: 'Noviembre' }, { num: '12', nombre: 'Diciembre' }
  ]
  const anioActual = new Date().getFullYear()
  const anios = Array.from({ length: 80 }, (_, i) => anioActual - i)

  const selectClass = "w-full bg-[#fafafa] border-[1.5px] border-[#e4e4e7] rounded-xl px-3 py-3 text-sm text-[#09090b] focus:outline-none focus:border-[#dc2626] focus:ring-2 focus:ring-red-100 transition-all appearance-none cursor-pointer font-medium"

  return (
    <main className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md animate-slideUp">

        {/* ── Header ── */}
        <div className="text-center mb-8">
          {business?.logo_url ? (
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl overflow-hidden border border-[#e4e4e7] shadow-sm bg-white flex items-center justify-center">
              <img 
                src={business.logo_url.startsWith('http') || business.logo_url.startsWith('/') || business.logo_url.startsWith('data:') ? business.logo_url : `/${business.logo_url}`} 
                alt={business.nombre} 
                className="w-full h-full object-cover" 
              />
            </div>
          ) : (
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#dc2626] flex items-center justify-center shadow-md">
              {modo === 'login' ? (
                <LogIn className="w-8 h-8 text-white" />
              ) : (
                <UserPlus className="w-8 h-8 text-white" />
              )}
            </div>
          )}
          <h1 className="text-2xl font-bold text-[#09090b] tracking-tight">
            {modo === 'login' ? 'Ingresa a tu Tarjeta' : 'Únete al Club VIP'}
          </h1>
          <p className="text-sm text-[#71717a] mt-1.5">
            {business?.nombre ? `Club de ${business.nombre}` : 'Programa de Lealtad'}
          </p>
        </div>

        {/* ── Formulario ── */}
        <div className="bg-white rounded-2xl shadow-[0_2px_20px_rgba(0,0,0,0.06)] border border-[#f0f0f0] p-8">
          
          {/* Selector de modo */}
          <div className="flex gap-2 p-1 bg-[#fafafa] border border-[#e4e4e7] rounded-xl mb-6">
            <button
              onClick={() => { setModo('registro'); setMensaje({ texto: '', tipo: '' }) }}
              className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                modo === 'registro'
                  ? 'bg-[#dc2626] text-white shadow-sm'
                  : 'text-[#71717a] hover:text-[#09090b]'
              }`}
            >
              Nuevo Registro
            </button>
            <button
              onClick={() => { setModo('login'); setMensaje({ texto: '', tipo: '' }) }}
              className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                modo === 'login'
                  ? 'bg-[#dc2626] text-white shadow-sm'
                  : 'text-[#71717a] hover:text-[#09090b]'
              }`}
            >
              Ya soy Socio
            </button>
          </div>

          <form onSubmit={modo === 'login' ? iniciarSesion : registrarCliente} className="space-y-5">

            {modo === 'registro' && (
              /* Nombre */
              <div className="space-y-1.5 animate-fade-in">
                <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  className="input-clean"
                  placeholder="Ej. Juan Pérez García"
                />
              </div>
            )}

            {/* Teléfono */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">
                Teléfono (10 dígitos) *
              </label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                required
                maxLength={10}
                className="input-clean"
                placeholder="Ej. 4521234567"
              />
            </div>

            {modo === 'registro' && (
              <>
                {/* Email */}
                <div className="space-y-1.5 animate-fade-in">
                  <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">
                    Email <span className="text-[#a1a1aa] normal-case font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-clean"
                    placeholder="correo@ejemplo.com"
                  />
                </div>

                {/* Dirección */}
                <div className="space-y-3 pt-3 border-t border-[#f4f4f5] animate-fade-in">
                  <p className="text-xs font-black text-[#09090b] uppercase tracking-wider">Dirección de Entrega / Domicilio</p>
                  
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">
                      Calle *
                    </label>
                    <input
                      type="text"
                      value={calle}
                      onChange={(e) => setCalle(e.target.value)}
                      required
                      className="input-clean"
                      placeholder="Ej. Avenida Juárez"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">
                        Número *
                      </label>
                      <input
                        type="text"
                        value={numero}
                        onChange={(e) => setNumero(e.target.value)}
                        required
                        className="input-clean"
                        placeholder="Ej. 123 o S/N"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">
                        Colonia *
                      </label>
                      <input
                        type="text"
                        value={colonia}
                        onChange={(e) => setColonia(e.target.value)}
                        required
                        className="input-clean"
                        placeholder="Ej. Centro"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">
                      Referencia <span className="text-[#a1a1aa] normal-case font-normal">(Opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={referencia}
                      onChange={(e) => setReferencia(e.target.value)}
                      className="input-clean"
                      placeholder="Ej. Portón negro frente a la escuela"
                    />
                  </div>
                </div>

                {/* Fecha de nacimiento */}
                <div className="space-y-1.5 animate-fade-in">
                  <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">
                    Fecha de Nacimiento <span className="text-[#a1a1aa] normal-case font-normal">(Opcional)</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="relative">
                      <select
                        value={dia}
                        onChange={(e) => setDia(e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Día</option>
                        {dias.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="relative">
                      <select
                        value={mes}
                        onChange={(e) => setMes(e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Mes</option>
                        {meses.map(m => <option key={m.num} value={m.num}>{m.nombre}</option>)}
                      </select>
                    </div>
                    <div className="relative">
                      <select
                        value={anio}
                        onChange={(e) => setAnio(e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Año</option>
                        {anios.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Mensaje de estado */}
            {mensaje.texto && (
              <div className={`p-3.5 rounded-xl text-sm font-medium text-center border flex items-center gap-2 justify-center ${
                mensaje.tipo === 'exito'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-red-50 text-red-600 border-red-200'
              }`}>
                {mensaje.tipo === 'exito' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                {mensaje.texto}
              </div>
            )}

            {/* Botón submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={registrando}
                className="btn-primary w-full py-4 text-sm"
              >
                {registrando ? (
                  <><Loader2 size={16} className="animate-spin" /> {modo === 'login' ? 'Ingresando...' : 'Creando tarjeta...'}</>
                ) : modo === 'login' ? (
                  <><LogIn size={16} /> Entrar a mi Tarjeta VIP</>
                ) : (
                  <><UserPlus size={16} /> Crear mi Tarjeta VIP</>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#a1a1aa] mt-6">
          Tus datos son confidenciales y se usan solo para el programa de fidelización.
        </p>
      </div>
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRO DE REPARTIDORES (BIKERS)
// ─────────────────────────────────────────────────────────────────────────────
function RegistroBiker() {
  const [fleets, setFleets] = useState<any[]>([])
  const [cargandoFleets, setCargandoFleets] = useState(true)

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccionResidencial, setDireccionResidencial] = useState('')
  const [numeroBiker, setNumeroBiker] = useState('')
  const [motoMarca, setMotoMarca] = useState('')
  const [motoCilindrada, setMotoCilindrada] = useState('')
  const [motoColor, setMotoColor] = useState('')
  const [pin, setPin] = useState('')
  const [confirmarPin, setConfirmarPin] = useState('')
  const [fleetId, setFleetId] = useState('')

  const [registrando, setRegistrando] = useState(false)
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' })
  const [enviadoExito, setEnviadoExito] = useState(false)

  useEffect(() => {
    supabase
      .from('delivery_fleets')
      .select('id, nombre')
      .eq('activo', true)
      .then(({ data }) => {
        setFleets(data || [])
        if (data && data.length === 1) {
          setFleetId(data[0].id)
        }
        setCargandoFleets(false)
      })
  }, [])

  const registrarBiker = async (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !nombre.trim() ||
      !telefono.trim() ||
      !direccionResidencial.trim() ||
      !numeroBiker.trim() ||
      !motoMarca.trim() ||
      !motoCilindrada.trim() ||
      !motoColor.trim() ||
      !pin.trim() ||
      !confirmarPin.trim() ||
      !fleetId
    ) {
      setMensaje({ texto: 'Por favor completa todos los campos obligatorios.', tipo: 'error' })
      return
    }

    const telefonoLimpio = telefono.replace(/\D/g, '')
    if (telefonoLimpio.length !== 10) {
      setMensaje({ texto: 'El teléfono debe tener exactamente 10 dígitos.', tipo: 'error' })
      return
    }

    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setMensaje({ texto: 'El PIN de acceso debe ser de exactamente 6 dígitos numéricos.', tipo: 'error' })
      return
    }

    if (pin !== confirmarPin) {
      setMensaje({ texto: 'Los PINs ingresados no coinciden.', tipo: 'error' })
      return
    }

    setRegistrando(true)
    setMensaje({ texto: '', tipo: '' })

    try {
      const { error } = await supabase
        .from('bikers')
        .insert({
          fleet_id: fleetId,
          nombre: nombre.trim(),
          telefono: telefonoLimpio,
          direccion_residencial: direccionResidencial.trim(),
          numero_biker: numeroBiker.trim(),
          moto_marca: motoMarca.trim(),
          moto_cilindrada: motoCilindrada.trim(),
          moto_color: motoColor.trim(),
          pin: pin.trim(),
          rol: 'biker',
          estado_aprobacion: 'pendiente',
          activo: false,
          conectado: false
        })

      if (error) throw error

      setEnviadoExito(true)
    } catch (err: any) {
      console.error('Error al registrar biker:', err)
      setMensaje({ texto: 'Hubo un error al enviar tu solicitud. Intenta de nuevo.', tipo: 'error' })
    } finally {
      setRegistrando(false)
    }
  }

  if (enviadoExito) {
    return (
      <main className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white border border-[#e4e4e7] rounded-3xl p-8 text-center space-y-6 shadow-xl animate-fadeIn">
          <div className="w-16 h-16 bg-blue-50 text-[#2563eb] rounded-full flex items-center justify-center border border-blue-100 shadow-sm mx-auto animate-pulse">
            <Clock className="w-8 h-8" />
          </div>

          <div className="space-y-2.5">
            <h3 className="text-xl font-bold text-[#09090b]">¡Solicitud Recibida!</h3>
            <p className="text-sm text-[#52525b] leading-relaxed">
              Tu cuenta está en proceso de revisión por el modulador central. Te notificaremos vía telefónica una vez seas aprobado.
            </p>
          </div>

          <div className="border-t border-[#f4f4f5] pt-5">
            <Link
              href="/"
              className="inline-flex items-center justify-center w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-sm rounded-xl py-3.5 transition-all shadow-xs"
            >
              Volver al Inicio
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md animate-slideUp">
        
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src="/bikers.png"
            alt="Bikers Logo"
            className="w-16 h-16 mx-auto mb-4 object-contain rounded-2xl"
          />
          <h1 className="text-2xl font-bold text-[#09090b] tracking-tight">Únete a la Flota</h1>
          <p className="text-sm text-[#71717a] mt-1.5">Envía tus datos para registrarte como repartidor</p>
        </div>

        {/* Card Formulario */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#e4e4e7] p-8 space-y-5">
          <form onSubmit={registrarBiker} className="space-y-4">
            
            {/* Nombre Completo */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[#71717a] uppercase tracking-wider mb-1.5">
                Nombre Completo *
              </label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                required
                className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-2.5 text-[#09090b] text-sm focus:outline-none focus:border-[#2563eb] focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] transition-all"
                placeholder="Ej. Carlos Martínez"
              />
            </div>

            {/* Teléfono */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[#71717a] uppercase tracking-wider mb-1.5">
                Teléfono (10 dígitos) *
              </label>
              <div className="relative">
                <input
                  type="tel"
                  maxLength={10}
                  value={telefono}
                  onChange={e => setTelefono(e.target.value.replace(/\D/g, ''))}
                  required
                  className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl pl-10 pr-4 py-2.5 text-[#09090b] text-sm focus:outline-none focus:border-[#2563eb] focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] transition-all font-semibold"
                  placeholder="Ej. 4521234567"
                />
                <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
              </div>
            </div>

            {/* Dirección Residencial */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[#71717a] uppercase tracking-wider mb-1.5">
                Dirección Residencial *
              </label>
              <input
                type="text"
                value={direccionResidencial}
                onChange={e => setDireccionResidencial(e.target.value)}
                required
                className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-2.5 text-[#09090b] text-sm focus:outline-none focus:border-[#2563eb] focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] transition-all"
                placeholder="Ej. Calle Juárez #42, Col. Centro"
              />
            </div>

            {/* Número Biker */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[#71717a] uppercase tracking-wider mb-1.5">
                Número Biker (ID de control) *
              </label>
              <input
                type="text"
                value={numeroBiker}
                onChange={e => setNumeroBiker(e.target.value)}
                required
                className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-2.5 text-[#09090b] text-sm focus:outline-none focus:border-[#2563eb] focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] transition-all font-mono font-bold"
                placeholder="Ej. B-105"
              />
            </div>

            {/* Datos de la Moto */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-[#71717a] uppercase tracking-wider mb-1.5">
                  Marca de la Moto *
                </label>
                <input
                  type="text"
                  value={motoMarca}
                  onChange={e => setMotoMarca(e.target.value)}
                  required
                  className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-2.5 text-[#09090b] text-sm focus:outline-none focus:border-[#2563eb] focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] transition-all"
                  placeholder="Ej. Honda"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-[#71717a] uppercase tracking-wider mb-1.5">
                  Cilindrada / CC *
                </label>
                <input
                  type="text"
                  value={motoCilindrada}
                  onChange={e => setMotoCilindrada(e.target.value)}
                  required
                  className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-2.5 text-[#09090b] text-sm focus:outline-none focus:border-[#2563eb] focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] transition-all"
                  placeholder="Ej. 150cc"
                />
              </div>
            </div>

            {/* Color de la Moto */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[#71717a] uppercase tracking-wider mb-1.5">
                Color de la Moto *
              </label>
              <input
                type="text"
                value={motoColor}
                onChange={e => setMotoColor(e.target.value)}
                required
                className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-2.5 text-[#09090b] text-sm focus:outline-none focus:border-[#2563eb] focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] transition-all"
                placeholder="Ej. Negro"
              />
            </div>

            {/* PIN y Confirmar PIN */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-[#71717a] uppercase tracking-wider mb-1.5">
                  PIN (6 dígitos) *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                    required
                    className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl pl-9 pr-2 py-2.5 text-[#09090b] text-sm focus:outline-none focus:border-[#2563eb] focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] transition-all font-mono"
                    placeholder="••••••"
                  />
                  <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-[#71717a] uppercase tracking-wider mb-1.5">
                  Confirmar PIN *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={confirmarPin}
                    onChange={e => setConfirmarPin(e.target.value.replace(/\D/g, ''))}
                    required
                    className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl pl-9 pr-2 py-2.5 text-[#09090b] text-sm focus:outline-none focus:border-[#2563eb] focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] transition-all font-mono"
                    placeholder="••••••"
                  />
                  <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
                </div>
              </div>
            </div>

            {/* Selector de Flota */}
            {cargandoFleets ? (
              <div className="flex items-center gap-2 text-xs text-[#71717a]">
                <Loader2 className="w-4 h-4 animate-spin text-[#2563eb]" />
                Cargando flotas disponibles…
              </div>
            ) : fleets.length === 0 ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                <p className="text-xs font-semibold text-red-600">No hay ninguna flota de reparto activa disponible.</p>
              </div>
            ) : fleets.length > 1 ? (
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-[#71717a] uppercase tracking-wider mb-1.5">
                  Flota de Reparto *
                </label>
                <select
                  value={fleetId}
                  onChange={e => setFleetId(e.target.value)}
                  required
                  className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-2.5 text-sm text-[#09090b] focus:outline-none focus:border-[#2563eb] focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] transition-all"
                >
                  <option value="">Selecciona la empresa de reparto…</option>
                  {fleets.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.nombre === 'Flota Central' || f.nombre === 'flota central' ? 'Bikers Upn' : f.nombre}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-2.5 flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#2563eb]" />
                <div>
                  <p className="text-[10px] text-[#71717a] font-semibold">Postulación para:</p>
                  <p className="text-sm font-bold text-[#09090b]">
                    {fleets[0].nombre === 'Flota Central' || fleets[0].nombre === 'flota central' ? 'Bikers Upn' : fleets[0].nombre}
                  </p>
                </div>
              </div>
            )}

            {/* Mensajes de feedback */}
            {mensaje.texto && (
              <div className={`p-3.5 rounded-xl text-sm font-medium text-center border flex items-center gap-2 justify-center ${
                mensaje.tipo === 'exito'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-red-50 text-red-600 border-red-200'
              }`}>
                {mensaje.texto}
              </div>
            )}

            {/* Botón de Enviar */}
            <button
              type="submit"
              disabled={registrando || fleets.length === 0}
              className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-sm rounded-xl py-3.5 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
            >
              {registrando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enviando solicitud…</span>
                </>
              ) : (
                <span>Enviar Solicitud de Ingreso</span>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#a1a1aa] mt-6">
          Tu registro será evaluado por los administradores de la flota.
        </p>
      </div>
    </main>
  )
}