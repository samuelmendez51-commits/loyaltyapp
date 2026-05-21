'use client'
import { useEffect, useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { supabase } from '@/lib/supabase'

// --- ESTRELLAS PREMIUM (Dorado Dashboard) ---
const StarActive = () => (
  <svg viewBox="0 0 24 24" className="w-10 h-10 sm:w-11 sm:h-11 text-[#e5c07b] drop-shadow-[0_0_12px_rgba(229,192,123,0.8)] fill-current transition-all duration-300 animate-in zoom-in">
    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" stroke="#e5c07b" strokeWidth="1" strokeLinejoin="round" />
  </svg>
)
const StarInactive = () => (
  <svg viewBox="0 0 24 24" className="w-10 h-10 sm:w-11 sm:h-11 text-[#18181b] fill-current transition-all duration-300">
    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" stroke="#27272a" strokeWidth="1" strokeLinejoin="round" />
  </svg>
)

export default function EscanerTrabajadores() {
  const [cliente, setCliente] = useState<any>(null)
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' })
  const [cargando, setCargando] = useState(false)
  const [inputManual, setInputManual] = useState('')

  useEffect(() => {
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
    try {
      const esUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(criterio);
      let query = supabase.from('clientes').select('*');
      
      if (esUUID) {
        query = query.eq('id', criterio);
      } else {
        query = query.eq('telefono', criterio);
      }
      
      const { data, error } = await query.maybeSingle();

      if (error || !data) {
        setMensaje({ tipo: 'error', texto: 'CLIENTE NO ENCONTRADO' })
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

  // --- LÓGICA INTELIGENTE: SELLO vs CANJE ---
  const manejarAccionVIP = async () => {
    if (!cliente) return
    setCargando(true)

    // Detectamos si el cliente ya llenó la tarjeta (10 o más puntos)
    const esCanjeDePremio = cliente.puntos >= 10;

    try {
      // Si es canje, los puntos regresan a 0. Si no, suma 1.
      const nuevosPuntos = esCanjeDePremio ? 0 : cliente.puntos + 1;

      const { error: errorCliente } = await supabase
        .from('clientes')
        .update({ puntos: nuevosPuntos })
        .eq('id', cliente.id)

      if (errorCliente) throw new Error('No se pudo actualizar el registro');

      // Guardamos la auditoría correcta en el historial
      await supabase
        .from('historial_puntos')
        .insert({
           cliente_id: cliente.id,
           puntos_afectados: esCanjeDePremio ? -10 : 1, 
           motivo: esCanjeDePremio ? 'PREMIO CANJEADO EN SUCURSAL' : 'Sello registrado en mostrador'
        });

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(esCanjeDePremio ? [200, 100, 200, 100, 400] : [100, 50, 100])
      }
      
      setMensaje({ 
        tipo: 'exito', 
        texto: esCanjeDePremio ? '¡PREMIO ENTREGADO CON ÉXITO!' : '¡SELLO AGREGADO EXITOSAMENTE!' 
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

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center pt-8 px-4 font-sans selection:bg-red-600/30 relative overflow-x-hidden antialiased">
      
      {/* MARCA DE AGUA */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none z-0">
          <img src="/logo.png" alt="La Burrería" className="w-[90vw] max-w-[800px] object-contain filter grayscale invert brightness-200" />
      </div>

      {/* CONTENEDOR MAESTRO */}
      <div className="w-full max-w-[420px] mx-auto flex flex-col relative z-10">
        
        <header className="flex flex-col items-center justify-center mb-8 px-2 w-full text-center">
          <h1 className="text-3xl font-black uppercase tracking-widest text-white shadow-black drop-shadow-md">
            Staff / <span className="text-red-600">Escáner</span>
          </h1>
          <p className="text-[#e5c07b] text-xs uppercase font-bold tracking-[0.3em] mt-2">La Burrería Club 🤠</p>
        </header>

        {cargando && (
          <div className="absolute inset-0 bg-[#0a0a0a]/80 backdrop-blur-md flex flex-col items-center justify-center z-50 rounded-2xl">
            <div className="w-12 h-12 border-4 border-zinc-800 border-t-red-600 rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(220,38,38,0.4)]"></div>
          </div>
        )}

        {/* ================= ESTADO 1: ESCÁNER ================= */}
        {!cliente && !mensaje.texto && (
          <div className="w-full bg-[#121212] rounded-[1.5rem] p-6 border border-zinc-800/80 shadow-[0_0_40px_rgba(220,38,38,0.03)] relative">
            
            <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden mb-7 shadow-inner block border border-zinc-900">
              <div id="reader" className="w-full h-full object-cover"></div>
              
              <div className="absolute top-4 left-4 w-6 h-6 border-t-[3px] border-l-[3px] border-red-600/80 rounded-tl-md z-10 pointer-events-none"></div>
              <div className="absolute top-4 right-4 w-6 h-6 border-t-[3px] border-r-[3px] border-red-600/80 rounded-tr-md z-10 pointer-events-none"></div>
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-[3px] border-l-[3px] border-red-600/80 rounded-bl-md z-10 pointer-events-none"></div>
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-[3px] border-r-[3px] border-red-600/80 rounded-br-md z-10 pointer-events-none"></div>
            </div>
            
            <div className="flex flex-col gap-2.5 w-full">
              <label className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest text-center">
                Búsqueda Manual (ID o Teléfono)
              </label>
              <input 
                type="text" 
                value={inputManual}
                onChange={(e) => setInputManual(e.target.value)}
                onKeyDown={handleKeyDownBusqueda}
                placeholder="Ingresa el número..."
                style={{ color: '#ffffff', backgroundColor: '#000000' }}
                className="w-full border border-zinc-800 rounded-xl px-4 py-4 focus:outline-none focus:border-red-600 transition-colors text-base placeholder:text-zinc-700 shadow-inner text-center font-mono"
              />
              <button 
                onClick={procesarBusquedaManual}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl font-black uppercase text-xs transition-all shadow-[0_4px_15px_rgba(220,38,38,0.3)] active:scale-95 tracking-[0.2em] mt-2 border-b-4 border-red-900 active:border-b-0 active:translate-y-1"
              >
                Buscar Cliente
              </button>
            </div>
          </div>
        )}

        {/* ================= ESTADO 2: MENSAJE DE ERROR ================= */}
        {mensaje.texto && !cliente && (
          <div className="w-full bg-[#121212] border border-red-900/50 rounded-[1.5rem] flex flex-col items-center justify-center p-8 text-center min-h-[400px] shadow-[0_0_50px_rgba(220,38,38,0.1)]">
            <div className="text-6xl mb-6 drop-shadow-lg">⚠️</div>
            <p className="text-xl font-black uppercase text-zinc-300 mb-8 tracking-widest">{mensaje.texto}</p>
            <button onClick={() => window.location.reload()} className="bg-transparent border-2 border-red-600 text-white px-8 py-3.5 rounded-xl font-bold text-xs uppercase shadow-lg active:scale-95 transition-all tracking-widest">Volver a intentar</button>
          </div>
        )}

        {/* ================= ESTADO 3: TARJETA VIP ================= */}
        {cliente && (
          <div className={`w-full rounded-[1.5rem] p-6 border shadow-[0_0_60px_rgba(220,38,38,0.1)] relative animate-in fade-in zoom-in-95 duration-300 ${cliente.puntos >= 10 ? 'bg-[#1a1608] border-[#e5c07b]/50' : 'bg-[#121212] border-zinc-800/80'}`}>
            
            {mensaje.texto && mensaje.tipo === 'exito' && (
              <div className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-[1.5rem]">
                <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(22,163,74,0.4)]">
                    <span className="text-4xl text-white">✓</span>
                </div>
                <p className="text-xl font-black text-white tracking-widest uppercase text-center px-4 leading-relaxed">{mensaje.texto}</p>
              </div>
            )}

            <div className="w-full bg-black/60 border border-zinc-800 rounded-xl py-6 px-4 flex flex-col items-center text-center mb-6 shadow-inner relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${cliente.puntos >= 10 ? 'via-[#e5c07b]' : 'via-red-600'} to-transparent opacity-50`}></div>
              <h2 className="text-white text-2xl sm:text-3xl font-serif font-black italic tracking-wide mb-2 drop-shadow-sm w-full truncate">
                {cliente.nombre}
              </h2>
              <p className="text-[#e5c07b] text-sm tracking-[0.2em] font-mono">
                {cliente.telefono}
              </p>
            </div>
            
            <div className="flex flex-col items-center w-full mb-8">
              
              <div className="flex items-baseline gap-2 mb-4">
                <span className={`text-[4rem] font-black leading-none ${cliente.puntos >= 10 ? 'text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'text-[#e5c07b] drop-shadow-[0_0_15px_rgba(229,192,123,0.3)]'}`}>
                  {cliente.puntos}
                </span>
                <span className="text-2xl font-bold text-zinc-600">/ 10</span>
              </div>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.3em] mb-6">
                {cliente.puntos >= 10 ? '¡META ALCANZADA!' : 'Sellos Acumulados'}
              </p>

              <div className="grid grid-cols-5 gap-y-4 gap-x-4 place-items-center w-full px-2">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex items-center justify-center">
                    {i < cliente.puntos ? <StarActive /> : <StarInactive />}
                  </div>
                ))}
              </div>
            </div>

            {/* BOTÓN INTELIGENTE: Cambia si llegó a 10 puntos */}
            {cliente.puntos >= 10 ? (
              <button 
                onClick={manejarAccionVIP}
                disabled={cargando}
                className="w-full bg-green-600 hover:bg-green-500 text-white py-4.5 rounded-xl font-black text-sm uppercase shadow-[0_0_25px_rgba(34,197,94,0.4)] active:scale-95 transition-all tracking-[0.2em] border-b-4 border-green-800 active:border-b-0 active:translate-y-1"
              >
                🏆 CANJEAR BURRITO GRATIS
              </button>
            ) : (
              <button 
                onClick={manejarAccionVIP}
                disabled={cargando}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-4.5 rounded-xl font-black text-sm uppercase shadow-[0_0_20px_rgba(220,38,38,0.3)] active:scale-95 transition-all tracking-[0.2em] border-b-4 border-red-900 active:border-b-0 active:translate-y-1"
              >
                + APLICAR SELLO
              </button>
            )}
            
            <button 
              onClick={() => { setCliente(null); window.location.reload(); }} 
              className="w-full mt-5 text-zinc-500 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors py-2 bg-transparent border-none"
            >
              CERRAR PERFIL
            </button>
          </div>
        )}
      </div>

      {/* CSS MAGICO */}
      <style dangerouslySetInnerHTML={{__html: `
        #reader a { display: none !important; }
        #reader__status_span { display: none !important; }
        #reader div[style*="padding: 10px;"] { display: none !important; }
        #reader { border: none !important; background: transparent !important; padding: 0 !important; width: 100% !important; }
        
        #reader__video_flow_container {
            width: 100% !important;
            height: 100% !important;
            background: transparent !important;
            border-radius: 0.75rem !important;
            overflow: hidden !important;
        }
        #reader video {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
        }

        #reader button { 
          background: #dc2626 !important; 
          color: white !important; 
          border-radius: 0.75rem !important; 
          padding: 12px 24px !important; 
          font-family: inherit;
          font-weight: 900; 
          font-size: 0.75rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          border: none !important; 
          cursor: pointer;
          box-shadow: 0 4px 14px 0 rgba(220, 38, 38, 0.4);
          margin-top: 1rem;
        }
        
        #reader select { 
          background: #000000; 
          color: white; 
          border: 1px solid #27272a; 
          padding: 12px 16px; 
          border-radius: 0.75rem; 
          font-size: 0.8rem;
          font-family: monospace;
          outline: none;
          margin-top: 15px;
          margin-bottom: 10px;
          width: 90%;
          max-width: 300px;
        }
      `}} />
    </main>
  )
}