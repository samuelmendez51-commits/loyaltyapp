'use client'
import { useEffect, useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'

// --- ESTRELLAS PREMIUM ---
const StarActive = () => (
  <svg viewBox="0 0 24 24" className="w-10 h-10 sm:w-11 sm:h-11 text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.3)] fill-current transition-all duration-300">
    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
  </svg>
)
const StarInactive = () => (
  <svg viewBox="0 0 24 24" className="w-10 h-10 sm:w-11 sm:h-11 text-[#f4f4f5] fill-current transition-all duration-300">
    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" stroke="#d4d4d8" strokeWidth="1" strokeLinejoin="round" />
  </svg>
)

export default function EscanerTrabajadores() {
  const [cliente, setCliente] = useState<any>(null)
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' })
  const [cargando, setCargando] = useState(false)
  const [inputManual, setInputManual] = useState('')
  const [business, setBusiness] = useState<any>(null)
  const [businessId, setBusinessId] = useState<string>('')
  const [coupon, setCoupon] = useState<any>(null)
  const [programaActivo, setProgramaActivo] = useState<any>(null)
  const [searchedPhone, setSearchedPhone] = useState('')
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState('')
  const [registradoExito, setRegistradoExito] = useState<any>(null)
  const [enviandoWhatsapp, setEnviandoWhatsapp] = useState(false)
  const [envioExitoMsg, setEnvioExitoMsg] = useState('')
  const [hasCamera, setHasCamera] = useState<boolean | null>(null)

  // ── Tenant: slug extraído del subdominio vía rewrite del middleware ──────────
  const slug = (useParams().slug as string) || ''

  const sellosTotales = programaActivo?.total_estampillas || business?.max_sellos || 10

  // Efecto: verificar si el dispositivo tiene cámara
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const videoDevices = devices.filter(device => device.kind === 'videoinput')
          if (videoDevices.length === 0) {
            setHasCamera(false)
          } else {
            setHasCamera(true)
          }
        })
        .catch(err => {
          console.warn('Error al enumerar dispositivos de video, usando fallback de cámara activa:', err)
          setHasCamera(true)
        })
    } else {
      setHasCamera(false)
    }
  }, [])

  // Efecto 1: cargar negocio por slug del subdominio (inyectado por el middleware)
  useEffect(() => {
    if (!slug) return
    supabase.from('businesses').select('*').eq('slug', slug).maybeSingle().then(async ({ data }) => {
      if (data) {
        setBusinessId(data.id)
        setBusiness(data)
        try {
          const { data: prog } = await supabase
            .from('programas_fidelidad')
            .select('*')
            .eq('business_id', data.id)
            .eq('activo', true)
            .maybeSingle()
          if (prog) setProgramaActivo(prog)
        } catch (e) {
          console.warn('Error loading active program:', e)
        }
      }
    })
  }, [slug])

  // Efecto 2: inicializar escáner QR (solo al montar el componente y si hay cámara)
  useEffect(() => {
    if (hasCamera === false) return

    const scanner = new Html5QrcodeScanner(
      "reader", 
      { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 }, 
      false
    )

    const onScanSuccess = async (decodedText: string) => {
      try {
        await scanner.clear()
        const idLimpio = decodedText.includes('/') ? decodedText.split('/').pop() : decodedText;
        if (idLimpio) buscarCliente(idLimpio.trim());
      } catch (err) {
        console.error("Error al detener cámara:", err)
      }
    }

    try {
      scanner.render(onScanSuccess, (error) => { })
    } catch (e) {
      console.error("Fallo al iniciar render del escáner:", e)
      setHasCamera(false)
    }

    return () => {
      scanner.clear().catch(err => console.error("Error al limpiar recursos:", err))
    }
  }, [hasCamera])

  const buscarCliente = async (criterio: string) => {
    if (!criterio) return
    setCargando(true)
    setCoupon(null)

    let criterioLimpio = criterio
    try {
      const decoded = atob(criterio.trim())
      const parsed = JSON.parse(decoded)
      if ((parsed.seguro === 'LOYALTYCLUB-VIP-CANJE' || parsed.seguro === 'LOYALTYCLUB-VIP-CANJE') && parsed.cliente_id) {
        criterioLimpio = parsed.cliente_id
        alert(`🏆 ¡Pase QR Cifrado VIP Validado!\nSocio: ${parsed.nombre}\nFidelidad: ${parsed.puntos}/${sellosTotales} sellos.\nListo para canjear premio mayor.`);
      }
    } catch (e) {
      // Continuar con el criterio original si no es base64
    }

    try {
      const esCupon = criterioLimpio.toUpperCase().startsWith('REWARD-');
      const activeBizId = businessId || business?.id || '' // resuelto por slug, sin cookie

      if (esCupon) {
        const { data: couponData, error: couponErr } = await supabase
          .from('tracking_events')
          .select('*, clientes(nombre, telefono, puntos)')
          .eq('codigo_cupon', criterioLimpio.toUpperCase())
          .eq('event_type', 'reward_generated')
          .maybeSingle()

        if (couponErr || !couponData) {
          setMensaje({ tipo: 'error', texto: 'CUPÓN DE REGALO NO VÁLIDO O INEXISTENTE' })
        } else if (couponData.cupon_canjeado) {
          setMensaje({ tipo: 'error', texto: 'CUPÓN YA CANJEADO ANTERIORMENTE' })
        } else if (activeBizId && couponData.business_id !== activeBizId) {
          setMensaje({ tipo: 'error', texto: 'ESTE CUPÓN PERTENECE A OTRO COMERCIO' })
        } else {
          setCoupon(couponData)
          const cli = couponData.clientes as any
          setCliente({
            id: couponData.cliente_id,
            nombre: cli?.nombre || 'Socio VIP',
            telefono: cli?.telefono || '',
            puntos: cli?.puntos || 0
          })
          setMensaje({ tipo: '', texto: '' })
          setInputManual('')
        }
        setCargando(false)
        return
      }

      const esUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(criterioLimpio);
      let query = supabase.from('clientes').select('*');
      
      if (esUUID) {
        query = query.eq('id', criterioLimpio);
      } else {
        const cleanDigits = criterioLimpio.replace(/\D/g, '')
        const last10 = cleanDigits.slice(-10)
        const telNormalizado = last10.length === 10 ? `+52${last10}` : criterioLimpio
        query = query.eq('telefono', telNormalizado);
      }

      if (activeBizId) {
        query = query.eq('business_id', activeBizId)
      }
      
      const { data, error } = await query.maybeSingle();

      if (error || !data) {
        setMensaje({ tipo: 'error', texto: 'CLIENTE NO ENCONTRADO EN TU NEGOCIO' })
        const isPhone = /^\d{10}$/.test(criterioLimpio)
        if (isPhone) {
          setSearchedPhone(criterioLimpio)
        } else {
          setSearchedPhone('')
        }
      } else {
        setCliente(data)
        setMensaje({ tipo: '', texto: '' })
        setInputManual('')
        setSearchedPhone('')
        setNuevoClienteNombre('')
        setRegistradoExito(null)
      }
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'ERROR DE CONEXIÓN' })
    } finally {
      setCargando(false)
    }
  }

  const handleKeyDownBusqueda = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      procesarBusquedaManual();
    }
  };

  const procesarBusquedaManual = () => {
    const valorSaneado = inputManual.trim();
    if (!valorSaneado) return;
    const criterioLimpio = valorSaneado.includes('/') ? valorSaneado.split('/').pop() : valorSaneado;
    if (criterioLimpio) buscarCliente(criterioLimpio.trim());
  };

  const handleRegistroExpress = async () => {
    if (!searchedPhone || !nuevoClienteNombre.trim()) return
    setCargando(true)
    try {
      const cleanDigits = searchedPhone.replace(/\D/g, '')
      const last10 = cleanDigits.slice(-10)
      const telNormalizado = last10.length === 10 ? `+52${last10}` : searchedPhone
      
      const activeBizId = businessId || business?.id || ''
      const { data, error } = await supabase
        .from('clientes')
        .insert({
          business_id: activeBizId,
          nombre: nuevoClienteNombre.trim() || null,
          telefono: telNormalizado,
          puntos: 0,
          visitas: 0,
          bloqueado: false
        })
        .select()
        .single()

      if (error) throw error
      
      setRegistradoExito(data)
    } catch (err: any) {
      alert('Error al registrar cliente: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  const manejarAccionVIP = async () => {
    if (!cliente) return
    setCargando(true)

    const activeBizId = businessId || business?.id || '' // resuelto por slug, sin cookie

    if (coupon) {
      try {
        const { error: errorCoupon } = await supabase
          .from('tracking_events')
          .update({ cupon_canjeado: true })
          .eq('id', coupon.id)

        if (errorCoupon) throw errorCoupon

        const { error: errorCliente } = await supabase
          .from('clientes')
          .update({ puntos: 0 })
          .eq('id', cliente.id)

        if (errorCliente) throw errorCliente

        await supabase
          .from('historial_puntos')
          .insert({
             cliente_id: cliente.id,
             cantidad: cliente.puntos, 
             motivo: 'resta'
          });

        if (activeBizId) {
          await supabase.from('tracking_events').insert({
            business_id: activeBizId,
            cliente_id: cliente.id,
            event_type: 'reward_redeemed',
            metadata: { canal: 'mostrador', codigo_cupon: coupon.codigo_cupon, puntos_canjeados: cliente.puntos }
          })
        }

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([200, 100, 200, 100, 400])
        }
        
        setMensaje({ 
          tipo: 'exito', 
          texto: '¡REGALO ENTREGADO Y CUPÓN CANJEADO CON ÉXITO!' 
        })
        
        setTimeout(() => {
          setCliente(null);
          setCoupon(null);
          setMensaje({ tipo: '', texto: '' });
          window.location.reload(); 
        }, 2500)

      } catch (err) {
        console.error(err);
        setMensaje({ tipo: 'error', texto: 'ERROR AL CANJEAR EL CUPÓN' })
      } finally {
        setCargando(false)
      }
      return
    }

    const maxStamps = sellosTotales
    const esCanjeDePremio = cliente.puntos >= maxStamps;

    try {
      const nuevosPuntos = esCanjeDePremio ? 0 : cliente.puntos + 1;

      const { error: errorCliente } = await supabase
        .from('clientes')
        .update({ puntos: nuevosPuntos })
        .eq('id', cliente.id)

      if (errorCliente) throw new Error('No se pudo actualizar el registro');

      await supabase
        .from('historial_puntos')
        .insert({
           cliente_id: cliente.id,
           cantidad: esCanjeDePremio ? maxStamps : 1, 
           motivo: esCanjeDePremio ? 'resta' : 'suma'
        });

      if (activeBizId) {
        await supabase.from('tracking_events').insert({
          business_id: activeBizId,
          cliente_id: cliente.id,
          event_type: esCanjeDePremio ? 'reward_redeemed' : 'approved_by_staff',
          metadata: { canal: 'mostrador', puntos_anteriores: cliente.puntos }
        })
      }

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(esCanjeDePremio ? [200, 100, 200, 100, 400] : [100, 50, 100])
      }
      
      setMensaje({ 
        tipo: 'exito', 
        texto: esCanjeDePremio ? '¡PREMIO ENTREGADO!' : '¡SELLO AGREGADO!' 
      })
      
      setTimeout(() => {
        setCliente(null);
        setMensaje({ tipo: '', texto: '' });
        window.location.reload(); 
      }, 2500)

    } catch (err) {
      console.error(err);
      setMensaje({ tipo: 'error', texto: 'ERROR AL PROCESAR' })
    } finally {
      setCargando(false)
    }
  }

  const manejarAjusteSello = async (delta: number) => {
    if (!cliente) return
    setCargando(true)

    const activeBizId = businessId || business?.id || '' // resuelto por slug, sin cookie
    const maxStamps = sellosTotales
    const nuevosPuntos = Math.max(0, Math.min(maxStamps, cliente.puntos + delta))

    try {
      const { error: errorCliente } = await supabase
        .from('clientes')
        .update({ puntos: nuevosPuntos })
        .eq('id', cliente.id)

      if (errorCliente) throw new Error('No se pudo actualizar el registro');

      await supabase
        .from('historial_puntos')
        .insert({
           cliente_id: cliente.id,
           cantidad: Math.abs(delta), 
           motivo: delta > 0 ? 'suma' : 'resta'
        });

      if (activeBizId) {
        await supabase.from('tracking_events').insert({
          business_id: activeBizId,
          cliente_id: cliente.id,
          event_type: 'puntos_ajustados',
          metadata: { canal: 'mostrador', delta, nuevosPuntos, puntos_anteriores: cliente.puntos }
        })
      }

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 50, 100])
      }
      
      setMensaje({ 
        tipo: 'exito', 
        texto: delta > 0 ? '¡SELLO AGREGADO CON ÉXITO!' : '¡SELLO RETIRADO CON ÉXITO!' 
      })
      
      setTimeout(() => {
        setCliente((prev: any) => ({ ...prev, puntos: nuevosPuntos }))
        setMensaje({ tipo: '', texto: '' });
      }, 1500)

    } catch (err) {
      console.error(err);
      setMensaje({ tipo: 'error', texto: 'ERROR AL PROCESAR EL AJUSTE' })
    } finally {
      setCargando(false)
    }
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

  return (
    <main className="min-h-screen w-full bg-[#fafafa] flex flex-col items-center justify-center p-4 relative z-10 font-sans text-[#09090b]">
      
      {/* Barra de Navegación Superior */}
      <div className="absolute top-4 left-0 right-0 px-6 flex justify-between items-center z-20">
        <span className="text-[10px] font-mono tracking-widest text-[#71717a] uppercase font-bold">
          {business?.nombre ? `Portal VIP · ${business.nombre}` : 'Portal VIP'}
        </span>
        <button 
          onClick={cerrarSesion} 
          className="text-[10px] font-bold text-[#52525b] hover:text-[#dc2626] uppercase tracking-wider transition-all py-2.5 px-4 border border-[#e4e4e7] rounded-xl hover:bg-red-50 hover:border-red-100 flex items-center gap-1.5 shadow-sm bg-white cursor-pointer"
        >
          🚪 Salir
        </button>
      </div>

      <header className="flex flex-col items-center justify-center mb-10 w-full text-center relative max-w-[420px] mx-auto mt-12">
        <h1 className="text-4xl font-black uppercase tracking-widest text-[#09090b]">
          Staff <span className="text-[var(--brand-red)] font-serif italic">Escáner</span>
        </h1>
        <p className="text-[#71717a] text-[10px] uppercase font-bold tracking-[0.4em] mt-2">
          {business?.nombre || "Punto de Venta VIP"}
        </p>
      </header>

      {cargando && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-50 rounded-2xl">
          <div className="w-16 h-16 border-4 border-zinc-800 border-t-[var(--brand-red)] rounded-full animate-spin shadow-[0_0_20px_rgba(185,28,28,0.5)]"></div>
        </div>
      )}

      <div className="w-full max-w-[420px] mx-auto flex flex-col relative z-10">
        
        {/* ESTADO 1: ESCÁNER */}
        {!cliente && !mensaje.texto && (
          <div className="card-glass p-8 relative">
            {hasCamera !== false ? (
              <div className="relative w-full aspect-square bg-black rounded-2xl overflow-hidden mb-8 border border-[var(--border-subtle)] shadow-inner">
                <div id="reader" className="w-full h-full object-cover"></div>
                
                {/* Esquinas de enfoque estilo Sci-Fi/Lujo */}
                <div className="absolute top-6 left-6 w-8 h-8 border-t-[4px] border-l-[4px] border-[var(--brand-red)] rounded-tl-xl z-10 pointer-events-none"></div>
                <div className="absolute top-6 right-6 w-8 h-8 border-t-[4px] border-r-[4px] border-[var(--brand-red)] rounded-tr-xl z-10 pointer-events-none"></div>
                <div className="absolute bottom-6 left-6 w-8 h-8 border-b-[4px] border-l-[4px] border-[var(--brand-red)] rounded-bl-xl z-10 pointer-events-none"></div>
                <div className="absolute bottom-6 right-6 w-8 h-8 border-b-[4px] border-r-[4px] border-[var(--brand-red)] rounded-br-xl z-10 pointer-events-none"></div>
              </div>
            ) : (
              <div className="w-full mb-8 py-8 px-6 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-center flex flex-col items-center justify-center gap-3 shadow-inner">
                <div className="text-4xl select-none">📷❌</div>
                <p className="text-sm font-bold">Cámara no detectada o sin permisos</p>
                <p className="text-xs text-amber-700">Por favor, usa el buscador manual de abajo para ingresar el teléfono o ID del socio.</p>
              </div>
            )}
            
            <div className="flex flex-col gap-4 w-full">
              <label className="text-[#71717a] text-[10px] uppercase font-bold tracking-[0.2em] text-center">
                Búsqueda Manual
              </label>
              <input 
                type="text" 
                value={inputManual}
                onChange={(e) => setInputManual(e.target.value)}
                onKeyDown={handleKeyDownBusqueda}
                placeholder="Teléfono o ID..."
                className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-4 focus:outline-none focus:border-[#dc2626] focus:bg-white transition-colors text-lg placeholder:text-[#a1a1aa] text-center font-mono text-[#09090b] shadow-inner"
              />
              <button 
                onClick={procesarBusquedaManual}
                className="btn-primary w-full mt-2"
              >
                Buscar Cliente
              </button>
            </div>
          </div>
        )}

        {/* ESTADO 2: MENSAJE DE ERROR */}
        {mensaje.texto && !cliente && (
          <div className="card-glass p-10 text-center flex flex-col items-center min-h-[400px] justify-center w-full max-w-[420px] mx-auto border border-zinc-200 shadow-xl bg-white">
            {!registradoExito ? (
              <>
                <div className="text-7xl mb-6 drop-shadow-[0_0_20px_rgba(239,68,68,0.15)] select-none">⚠️</div>
                <p className="text-[10px] text-[#71717a] font-bold uppercase tracking-[0.3em] mb-1.5 font-mono">
                  {business?.nombre || "Comercio VIP"}
                </p>
                <h4 className="text-xs font-black text-red-500 uppercase tracking-widest mb-4">
                  Error de Búsqueda
                </h4>
                <p className="text-lg font-black uppercase text-[#09090b] mb-4 tracking-wider leading-relaxed px-2">
                  {mensaje.texto}
                </p>
                
                {searchedPhone ? (
                  <div className="w-full space-y-4 border-t border-zinc-100 pt-4 mt-2">
                    <p className="text-sm font-bold text-zinc-700">
                      Número detectado: <span className="font-mono text-zinc-900 bg-zinc-100 px-2 py-1 rounded">{searchedPhone}</span>
                    </p>
                    <div className="space-y-2 text-left">
                      <label className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider block">Nombre del Cliente</label>
                      <input
                        type="text"
                        value={nuevoClienteNombre}
                        onChange={(e) => setNuevoClienteNombre(e.target.value)}
                        placeholder="Ej: Juan Pérez"
                        className="w-full bg-slate-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:bg-white text-sm text-[#09090b]"
                      />
                    </div>
                    <button
                      onClick={handleRegistroExpress}
                      disabled={!nuevoClienteNombre.trim()}
                      className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-zinc-950 font-black text-xs py-3.5 rounded-xl uppercase tracking-wider shadow-md cursor-pointer transition-all"
                    >
                      ➕ Registrar y Crear Tarjeta VIP
                    </button>
                  </div>
                ) : null}

                <button 
                  onClick={() => { setMensaje({ tipo: '', texto: '' }); setInputManual(''); setSearchedPhone(''); setNuevoClienteNombre('') }} 
                  className="px-8 py-3.5 mt-6 bg-transparent border-2 border-amber-500 hover:bg-amber-500/5 text-amber-600 rounded-2xl font-bold text-xs uppercase transition-all tracking-widest cursor-pointer shadow-sm active:scale-95 font-sans"
                >
                  Reintentar
                </button>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-md shadow-emerald-100">
                  <span className="text-4xl">✓</span>
                </div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.3em] mb-1 font-mono">
                  {business?.nombre || "Comercio VIP"}
                </p>
                <h4 className="text-sm font-black text-emerald-600 uppercase tracking-widest mb-4">
                  Registro Exitoso
                </h4>
                <p className="text-sm text-zinc-650 mb-6 leading-relaxed">
                  El socio <strong>{registradoExito.nombre}</strong> ha sido agregado con éxito.
                </p>
                
                {envioExitoMsg && (
                  <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold leading-relaxed text-center shadow-sm">
                    {envioExitoMsg}
                  </div>
                )}

                <button
                  disabled={enviandoWhatsapp}
                  onClick={async () => {
                    setEnviandoWhatsapp(true)
                    setEnvioExitoMsg('')
                    try {
                      const cleanTel = registradoExito.telefono
                      const phoneParam = cleanTel.startsWith('52') ? cleanTel : '52' + cleanTel
                      const domain = typeof window !== 'undefined' && window.location.hostname.includes('loyaltyclub.mx') 
                        ? `${slug}.loyaltyclub.mx` 
                        : `${slug}.localhost:3000`
                      const cardUrl = `http://${domain}/card/${registradoExito.id}`
                      
                      const textParam = `¡Hola! Te saluda el equipo de ${business?.nombre || 'Loyalty App'}. Te compartimos tu nueva Tarjeta Digital VIP de Cliente Frecuente. Acumula tus sellos y consulta nuestro menú aquí: ${cardUrl}`
                      
                      const response = await fetch('/api/whatsapp/send', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          clientPhone: phoneParam,
                          message: textParam,
                          tenantSlug: slug
                        })
                      })
                      
                      if (response.ok) {
                        setEnvioExitoMsg('✅ Tarjeta digital VIP enviada con éxito desde la línea oficial del negocio.')
                      } else {
                        const errData = await response.json().catch(() => ({}))
                        alert(`Error al enviar mensaje: ${errData.error || 'Error desconocido'}`)
                      }
                    } catch (error) {
                      console.error('Error al enviar WhatsApp:', error)
                      alert('Error de red al intentar enviar WhatsApp.')
                    } finally {
                      setEnviandoWhatsapp(false)
                    }
                  }}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-75 text-white font-black text-xs py-4 px-6 rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  {enviandoWhatsapp ? 'Enviando desde el número del negocio...' : '💬 Enviar Tarjeta por WhatsApp'}
                </button>

                <button 
                  onClick={() => { 
                    setMensaje({ tipo: '', texto: '' })
                    setInputManual('')
                    setSearchedPhone('')
                    setNuevoClienteNombre('')
                    setRegistradoExito(null)
                  }} 
                  className="mt-6 text-zinc-500 hover:text-zinc-800 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:underline"
                >
                  Ir al Escáner
                </button>
              </>
            )}
          </div>
        )}

        {/* ESTADO 3: TARJETA VIP (LA QUE VE EL STAFF) */}
        {cliente && (
          <div className={`card-glass p-8 relative overflow-hidden transition-all duration-500 bg-white ${cliente.puntos >= sellosTotales ? 'border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.1)]' : ''}`}>
            
            {mensaje.texto && mensaje.tipo === 'exito' && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center z-50">
                <div className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(22,163,74,0.3)]">
                    <span className="text-5xl text-white">✓</span>
                </div>
                <p className="text-2xl font-black text-[#09090b] tracking-widest uppercase text-center px-6 leading-relaxed">{mensaje.texto}</p>
              </div>
            )}

            {/* Cabecera de la tarjeta del cliente */}
            <div className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-2xl py-8 px-6 flex flex-col items-center text-center mb-8 shadow-inner relative">
              <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${cliente.puntos >= sellosTotales ? 'via-amber-500' : 'via-[var(--brand-red)]'} to-transparent opacity-70`}></div>
              <h2 className="text-[#09090b] text-3xl font-serif font-black italic tracking-wide mb-3 w-full truncate">
                {cliente.nombre}
              </h2>
              <p className="text-[#dc2626] text-sm tracking-[0.3em] font-mono font-bold">
                {cliente.telefono || 'ID-VIP'}
              </p>
            </div>
            
            <div className="flex flex-col items-center w-full mb-10">
              <div className="flex items-baseline gap-3 mb-5">
                <span className={`text-6xl font-black leading-none ${cliente.puntos >= sellosTotales ? 'text-green-600 drop-shadow-[0_0_20px_rgba(22,163,74,0.2)]' : 'text-amber-500 drop-shadow-[0_0_20px_rgba(245,158,11,0.2)]'}`}>
                  {cliente.puntos}
                </span>
                <span className="text-3xl font-bold text-[#a1a1aa]">/ {sellosTotales}</span>
              </div>
              <p className="text-[10px] text-[#a1a1aa] font-bold uppercase tracking-[0.4em] mb-8">
                {cliente.puntos >= sellosTotales ? '¡PREMIO DESBLOQUEADO!' : 'Sellos Acumulados'}
              </p>

              {/* Matriz de Estrellas */}
              <div className="grid grid-cols-5 gap-y-6 gap-x-4 place-items-center w-full px-2">
                {[...Array(sellosTotales)].map((_, i) => (
                  <div key={i} className="flex items-center justify-center">
                    {i < cliente.puntos ? <StarActive /> : <StarInactive />}
                  </div>
                ))}
              </div>
            </div>

            {/* Botones de Acción */}
            {coupon ? (
              <button 
                onClick={manejarAccionVIP}
                disabled={cargando}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white py-5 rounded-2xl font-black text-sm uppercase shadow-[0_8px_30px_rgba(245,158,11,0.4)] active:scale-95 transition-all tracking-[0.1em] flex items-center justify-center gap-2"
              >
                🎁 CANJEAR CUPÓN: {coupon.codigo_cupon}
              </button>
            ) : cliente.puntos >= sellosTotales ? (
              <div className="space-y-4 w-full">
                <button 
                  onClick={manejarAccionVIP}
                  disabled={cargando}
                  className="w-full bg-gradient-to-r from-green-600 to-green-800 text-white py-5 rounded-2xl font-black text-sm uppercase shadow-[0_8px_30px_rgba(34,197,94,0.4)] active:scale-95 transition-all tracking-[0.2em] flex items-center justify-center gap-2"
                >
                  🏆 CANJEAR PREMIO
                </button>
                <div className="flex gap-3">
                  <button 
                    onClick={() => manejarAjusteSello(-1)}
                    disabled={cargando || cliente.puntos === 0}
                    className="flex-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-red-400 font-bold py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-40"
                  >
                    ➖ Quitar Sello
                  </button>
                  <button 
                    onClick={() => manejarAjusteSello(1)}
                    disabled={cargando || cliente.puntos >= sellosTotales}
                    className="flex-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-green-400 font-bold py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-40"
                  >
                    ➕ Sumar Sello
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 w-full">
                <button 
                  onClick={() => manejarAjusteSello(1)}
                  disabled={cargando}
                  className="btn-primary w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_8px_30px_rgba(185,28,28,0.3)]"
                >
                  ➕ APLICAR SELLO
                </button>
                <div className="flex gap-3">
                  <button 
                    onClick={() => manejarAjusteSello(-1)}
                    disabled={cargando || cliente.puntos === 0}
                    className="flex-1 bg-[#121212] border border-zinc-850 hover:bg-zinc-800 text-red-400 hover:text-red-300 font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-40 flex items-center justify-center gap-1"
                  >
                    ➖ Quitar Sello
                  </button>
                  <button 
                    onClick={() => manejarAjusteSello(1)}
                    disabled={cargando}
                    className="flex-1 bg-[#121212] border border-zinc-850 hover:bg-zinc-800 text-green-400 hover:text-green-300 font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-40 flex items-center justify-center gap-1"
                  >
                    ➕ Sello Extra
                  </button>
                </div>
              </div>
            )}

            {/* Enviar Tarjeta por WhatsApp (Socio Encontrado) */}
            <div className="space-y-4 w-full mt-6 border-t border-zinc-100 pt-6">
              {envioExitoMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold leading-relaxed text-center shadow-sm">
                  {envioExitoMsg}
                </div>
              )}
              <button
                disabled={enviandoWhatsapp}
                onClick={async () => {
                  setEnviandoWhatsapp(true)
                  setEnvioExitoMsg('')
                  try {
                    const cleanTel = cliente.telefono
                    const phoneParam = cleanTel.startsWith('52') ? cleanTel : '52' + cleanTel
                    const domain = typeof window !== 'undefined' && window.location.hostname.includes('loyaltyclub.mx') 
                      ? `${slug}.loyaltyclub.mx` 
                      : `${slug}.localhost:3000`
                    const cardUrl = `http://${domain}/card/${cliente.id}`
                    
                    const textParam = `¡Hola! Te saluda el equipo de ${business?.nombre || 'Loyalty App'}. Te compartimos tu nueva Tarjeta Digital VIP de Cliente Frecuente. Acumula tus sellos y consulta nuestro menú aquí: ${cardUrl}`
                    
                    const response = await fetch('/api/whatsapp/send', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        clientPhone: phoneParam,
                        message: textParam,
                        tenantSlug: slug
                      })
                    })
                    
                    if (response.ok) {
                      setEnvioExitoMsg('✅ Tarjeta digital VIP enviada con éxito desde la línea oficial del negocio.')
                    } else {
                      const errData = await response.json().catch(() => ({}))
                      alert(`Error al enviar mensaje: ${errData.error || 'Error desconocido'}`)
                    }
                  } catch (error) {
                    console.error('Error al enviar WhatsApp:', error)
                    alert('Error de red al intentar enviar WhatsApp.')
                  } finally {
                    setEnviandoWhatsapp(false)
                  }
                }}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-75 text-white font-black text-xs py-4 px-6 rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
              >
                {enviandoWhatsapp ? 'Enviando...' : '💬 Enviar Tarjeta por WhatsApp'}
              </button>
            </div>
            
            <button 
              onClick={() => { setCliente(null); window.location.reload(); }} 
              className="w-full mt-6 text-[#71717a] hover:text-white text-[10px] font-bold tracking-[0.3em] uppercase transition-colors py-3"
            >
              CERRAR PERFIL
            </button>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        #reader a { display: none !important; }
        #reader__status_span { display: none !important; }
        #reader div[style*="padding: 10px;"] { display: none !important; }
        #reader { border: none !important; background: transparent !important; padding: 0 !important; width: 100% !important; }
        
        .card-glass {
          background: #ffffff !important;
          border: 1px solid #e4e4e7 !important;
          border-radius: var(--radius-2xl) !important;
          box-shadow: 0 10px 40px rgba(0,0,0,0.06) !important;
          color: #09090b !important;
        }

        #reader__video_flow_container {
            width: 100% !important;
            height: 100% !important;
            background: transparent !important;
            border-radius: 1rem !important;
            overflow: hidden !important;
        }
        #reader video {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
        }

        #reader button { 
          background: linear-gradient(to right, var(--brand-red), var(--brand-red-dark)) !important; 
          color: white !important; 
          border-radius: 1rem !important; 
          padding: 14px 24px !important; 
          font-family: var(--font-inter), sans-serif !important;
          font-weight: 900 !important; 
          font-size: 0.8rem !important;
          letter-spacing: 0.1em !important;
          text-transform: uppercase !important;
          border: none !important; 
          cursor: pointer !important;
          box-shadow: 0 8px 25px rgba(185, 28, 28, 0.3) !important;
          margin-top: 1.5rem !important;
          width: 90% !important;
          max-width: 300px !important;
        }
        
        #reader select { 
          background: #000000 !important; 
          color: white !important; 
          border: 1px solid var(--border-subtle) !important; 
          padding: 14px 16px !important; 
          border-radius: 1rem !important; 
          font-size: 0.9rem !important;
          font-family: monospace !important;
          outline: none !important;
          margin-top: 15px !important;
          margin-bottom: 10px !important;
          width: 90% !important;
          max-width: 300px !important;
        }
      `}} />
    </main>
  )
}