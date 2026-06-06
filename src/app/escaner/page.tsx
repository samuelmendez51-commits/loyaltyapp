'use client'
import { useEffect, useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { supabase } from '@/lib/supabase'

// --- ESTRELLAS PREMIUM ---
const StarActive = () => (
  <svg viewBox="0 0 24 24" className="w-10 h-10 sm:w-11 sm:h-11 text-[var(--brand-gold)] drop-shadow-[0_0_15px_rgba(212,175,55,0.8)] fill-current transition-all duration-300">
    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
  </svg>
)
const StarInactive = () => (
  <svg viewBox="0 0 24 24" className="w-10 h-10 sm:w-11 sm:h-11 text-black fill-current transition-all duration-300">
    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" stroke="var(--border-subtle)" strokeWidth="1" strokeLinejoin="round" />
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

  const getCookieVal = (name: string) => {
    if (typeof document === 'undefined') return ''
    return document.cookie.match(new RegExp(`${name}=([^;]+)`))?.[1] || ''
  }

  const sellosTotales = programaActivo?.total_estampillas || business?.max_sellos || 10

  useEffect(() => {
    const bizId = getCookieVal('session_business_id')
    if (bizId) {
      setBusinessId(bizId)
      supabase.from('businesses').select('*').eq('id', bizId).maybeSingle().then(async ({ data }) => {
        if (data) {
          setBusiness(data)
          try {
            const { data: prog } = await supabase
              .from('programas_fidelidad')
              .select('*')
              .eq('business_id', bizId)
              .eq('activo', true)
              .maybeSingle()
            if (prog) setProgramaActivo(prog)
          } catch (e) {
            console.warn('Error loading active program:', e)
          }
        }
      })
    }

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

    scanner.render(onScanSuccess, (error) => { })

    return () => {
      scanner.clear().catch(err => console.error("Error al limpiar recursos:", err))
    }
  }, [])

  const buscarCliente = async (criterio: string) => {
    if (!criterio) return
    setCargando(true)
    setCoupon(null)

    let criterioLimpio = criterio
    try {
      const decoded = atob(criterio.trim())
      const parsed = JSON.parse(decoded)
      if ((parsed.seguro === 'LOYALTYAPP-VIP-CANJE' || parsed.seguro === 'LOYALTYCLUB-VIP-CANJE') && parsed.cliente_id) {
        criterioLimpio = parsed.cliente_id
        alert(`🏆 ¡Pase QR Cifrado VIP Validado!\nSocio: ${parsed.nombre}\nFidelidad: ${parsed.puntos}/${sellosTotales} sellos.\nListo para canjear premio mayor.`);
      }
    } catch (e) {
      // Continuar con el criterio original si no es base64
    }

    try {
      const esCupon = criterioLimpio.toUpperCase().startsWith('REWARD-');
      const activeBizId = businessId || getCookieVal('session_business_id')

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
        query = query.eq('telefono', criterioLimpio);
      }

      if (activeBizId) {
        query = query.eq('business_id', activeBizId)
      }
      
      const { data, error } = await query.maybeSingle();

      if (error || !data) {
        setMensaje({ tipo: 'error', texto: 'CLIENTE NO ENCONTRADO EN TU NEGOCIO' })
      } else {
        setCliente(data)
        setMensaje({ tipo: '', texto: '' })
        setInputManual('')
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

  const manejarAccionVIP = async () => {
    if (!cliente) return
    setCargando(true)

    const activeBizId = businessId || getCookieVal('session_business_id')

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

    const activeBizId = businessId || getCookieVal('session_business_id')
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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10 font-sans">
      
      <header className="flex flex-col items-center justify-center mb-10 w-full text-center">
        <h1 className="text-4xl font-black uppercase tracking-widest text-white shadow-black drop-shadow-md">
          Staff <span className="text-[var(--brand-red)] font-serif italic">Escáner</span>
        </h1>
        <p className="text-[var(--brand-gold)] text-[10px] uppercase font-bold tracking-[0.4em] mt-2">
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
            <div className="relative w-full aspect-square bg-black rounded-2xl overflow-hidden mb-8 border border-[var(--border-subtle)] shadow-inner">
              <div id="reader" className="w-full h-full object-cover"></div>
              
              {/* Esquinas de enfoque estilo Sci-Fi/Lujo */}
              <div className="absolute top-6 left-6 w-8 h-8 border-t-[4px] border-l-[4px] border-[var(--brand-red)] rounded-tl-xl z-10 pointer-events-none"></div>
              <div className="absolute top-6 right-6 w-8 h-8 border-t-[4px] border-r-[4px] border-[var(--brand-red)] rounded-tr-xl z-10 pointer-events-none"></div>
              <div className="absolute bottom-6 left-6 w-8 h-8 border-b-[4px] border-l-[4px] border-[var(--brand-red)] rounded-bl-xl z-10 pointer-events-none"></div>
              <div className="absolute bottom-6 right-6 w-8 h-8 border-b-[4px] border-r-[4px] border-[var(--brand-red)] rounded-br-xl z-10 pointer-events-none"></div>
            </div>
            
            <div className="flex flex-col gap-4 w-full">
              <label className="text-[#a1a1aa] text-[10px] uppercase font-bold tracking-[0.2em] text-center">
                Búsqueda Manual
              </label>
              <input 
                type="text" 
                value={inputManual}
                onChange={(e) => setInputManual(e.target.value)}
                onKeyDown={handleKeyDownBusqueda}
                placeholder="Teléfono o ID..."
                className="w-full bg-black/50 border border-[var(--border-subtle)] rounded-xl px-4 py-4 focus:outline-none focus:border-[var(--brand-red)] transition-colors text-lg placeholder:text-zinc-700 text-center font-mono text-white"
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
          <div className="card-glass p-10 text-center flex flex-col items-center min-h-[400px] justify-center">
            <div className="text-7xl mb-6 drop-shadow-lg">⚠️</div>
            <p className="text-xl font-black uppercase text-white mb-10 tracking-widest leading-relaxed">{mensaje.texto}</p>
            <button onClick={() => window.location.reload()} className="px-8 py-4 bg-transparent border-2 border-[var(--brand-red)] text-white rounded-2xl font-bold text-xs uppercase hover:bg-[var(--brand-red)]/10 transition-all tracking-widest">
              Reintentar
            </button>
          </div>
        )}

        {/* ESTADO 3: TARJETA VIP (LA QUE VE EL STAFF) */}
        {cliente && (
          <div className={`card-glass p-8 relative overflow-hidden transition-all duration-500 ${cliente.puntos >= sellosTotales ? 'border-[var(--brand-gold)] shadow-[0_0_50px_rgba(212,175,55,0.15)]' : ''}`}>
            
            {mensaje.texto && mensaje.tipo === 'exito' && (
              <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-50">
                <div className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(22,163,74,0.5)]">
                    <span className="text-5xl text-white">✓</span>
                </div>
                <p className="text-2xl font-black text-white tracking-widest uppercase text-center px-6 leading-relaxed">{mensaje.texto}</p>
              </div>
            )}

            {/* Cabecera de la tarjeta del cliente */}
            <div className="w-full bg-black/60 border border-[var(--border-subtle)] rounded-2xl py-8 px-6 flex flex-col items-center text-center mb-8 shadow-inner relative">
              <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${cliente.puntos >= sellosTotales ? 'via-[var(--brand-gold)]' : 'via-[var(--brand-red)]'} to-transparent opacity-70`}></div>
              <h2 className="text-white text-3xl font-serif font-black italic tracking-wide mb-3 drop-shadow-sm w-full truncate">
                {cliente.nombre}
              </h2>
              <p className="text-[var(--brand-gold)] text-sm tracking-[0.3em] font-mono">
                {cliente.telefono || 'ID-VIP'}
              </p>
            </div>
            
            <div className="flex flex-col items-center w-full mb-10">
              <div className="flex items-baseline gap-3 mb-5">
                <span className={`text-6xl font-black leading-none ${cliente.puntos >= sellosTotales ? 'text-green-500 drop-shadow-[0_0_20px_rgba(34,197,94,0.5)]' : 'text-[var(--brand-gold)] drop-shadow-[0_0_20px_rgba(212,175,55,0.4)]'}`}>
                  {cliente.puntos}
                </span>
                <span className="text-3xl font-bold text-[#3f3f46]">/ {sellosTotales}</span>
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