'use client'
import { useEffect, useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { supabase } from '@/lib/supabase'

export default function EscanerTrabajadores() {
  const [cliente, setCliente] = useState<any>(null)
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' })
  const [cargando, setCargando] = useState(false)
  const [inputManual, setInputManual] = useState('')

  useEffect(() => {
    // Inicialización de la librería de escaneo
    const scanner = new Html5QrcodeScanner(
      "reader", 
      { fps: 10, qrbox: { width: 250, height: 250 } }, 
      false
    )

    const onScanSuccess = async (decodedText: string) => {
      try {
        await scanner.clear()
        // Extrae el ID en caso de que el QR sea una URL completa
        const idLimpio = decodedText.includes('/') ? decodedText.split('/').pop() : decodedText;
        if (idLimpio) buscarCliente(idLimpio.trim());
      } catch (err) {
        console.error("Error al detener cámara:", err)
      }
    }

    scanner.render(onScanSuccess, (error) => { /* Silenciar errores de enfoque continuo */ })

    return () => {
      scanner.clear().catch(err => console.error("Error al limpiar recursos:", err))
    }
  }, [])

  const buscarCliente = async (criterio: string) => {
    if (!criterio) return
    setCargando(true)
    try {
      // Expresión regular básica para verificar si la entrada parece un UUID (ID nativo de base de datos)
      const esUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(criterio);

      let query = supabase.from('clientes').select('*');

      if (esUUID) {
        // Si tiene formato de ID, buscamos estrictamente por ID
        query = query.eq('id', criterio);
      } else {
        // Si no es UUID, asumimos que el operador ingresó el número de teléfono
        query = query.eq('telefono', criterio);
      }

      const { data, error } = await query.maybeSingle();

      if (error || !data) {
        setMensaje({ tipo: 'error', texto: '❌ Cliente no registrado' })
      } else {
        setCliente(data)
        setMensaje({ tipo: '', texto: '' }) // Limpiar mensajes previos si encuentra al cliente
      }
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'Error de conexión' })
    } finally {
      setCargando(false)
    }
  }

  const procesarBusquedaManual = () => {
    const valorSaneado = inputManual.trim();
    if (!valorSaneado) return;

    // Extraer el final de la cadena por si pegan un enlace completo en el buscador manual
    const criterioLimpio = valorSaneado.includes('/') ? valorSaneado.split('/').pop() : valorSaneado;
    
    if (criterioLimpio) {
      buscarCliente(criterioLimpio.trim());
    }
  };

  const procesarSello = async () => {
    if (!cliente) return
    setCargando(true)

    try {
      // 1. Sumar el punto en la tabla de clientes
      const { error: errorCliente } = await supabase
        .from('clientes')
        .update({ puntos: cliente.puntos + 1 })
        .eq('id', cliente.id)

      if (errorCliente) throw new Error('No se pudo guardar el sello');

      // 2. Inyectar la auditoría Pro en el historial
      await supabase
        .from('historial_puntos')
        .insert({
           cliente_id: cliente.id,
           puntos: 1, 
           descripcion: 'Sello registrado en caja'
        });

      // Intentar vibración háptica en dispositivos móviles compatibles
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 200])
      }
      
      setMensaje({ tipo: 'exito', texto: `✅ ¡Sello sumado a ${cliente.nombre}!` })
      setTimeout(() => window.location.reload(), 2000)

    } catch (err) {
      console.error(err);
      setMensaje({ tipo: 'error', texto: 'Error al procesar el sello' })
    } finally {
      setCargando(false)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6 flex flex-col items-center">
      {/* HEADER DE LA APLICACIÓN */}
      <header className="w-full max-w-md mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black uppercase italic tracking-tighter">Staff / Escáner</h1>
          <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">La Burrería Club 🤠</p>
        </div>
        <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center font-black border border-white/10 shadow-lg">B</div>
      </header>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="w-full max-w-md bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-zinc-800 shadow-2xl relative flex flex-col items-center justify-center mb-6">
        
        {!cliente && !mensaje.texto && (
          <div className="w-full">
            {/* Contenedor de la cámara */}
            <div id="reader" className="w-full bg-black min-h-[250px]"></div>
            
            {/* Buscador manual integrado dual */}
            <div className="p-6 border-t border-zinc-800 bg-zinc-900 w-full">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 text-center">
                ¿Falla la cámara? Ingresa ID o Teléfono
              </p>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={inputManual}
                  onChange={(e) => setInputManual(e.target.value)}
                  placeholder="Ej: 443XXXXXXX o ID..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
                />
                <button 
                  onClick={procesarBusquedaManual}
                  className="bg-zinc-800 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold uppercase text-xs transition-colors"
                >
                  Buscar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pantalla de carga (Validando) */}
        {cargando && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-20">
            <p className="font-black animate-pulse tracking-widest text-orange-500">VALIDANDO...</p>
          </div>
        )}

        {/* Pantallas de éxito o de error */}
        {mensaje.texto && !cliente && (
          <div className={`w-full flex flex-col items-center justify-center p-8 text-center min-h-[350px] ${mensaje.tipo === 'exito' ? 'bg-green-600' : 'bg-red-600'}`}>
            <p className="text-3xl font-black uppercase italic mb-6 leading-tight">{mensaje.texto}</p>
            <button onClick={() => window.location.reload()} className="bg-white text-black px-8 py-3 rounded-full font-black text-xs uppercase shadow-xl active:scale-95 transition-transform">Intentar de nuevo</button>
          </div>
        )}
      </div>

      {/* TARJETA BLANCA: ACCIÓN EXCLUSIVA AL ENCONTRAR CLIENTE */}
      {cliente && (
        <div className="w-full max-w-md bg-white text-zinc-900 p-8 rounded-[3rem] shadow-2xl animate-in fade-in slide-in-from-bottom-6 relative overflow-hidden">
          {/* Si hay un mensaje de éxito post-sello sobre la tarjeta blanca */}
          {mensaje.texto && mensaje.tipo === 'exito' ? (
            <div className="absolute inset-0 bg-green-600 text-white flex flex-col items-center justify-center p-6 text-center z-10">
              <p className="text-2xl font-black uppercase italic leading-tight mb-4">{mensaje.texto}</p>
              <p className="text-xs opacity-75 animate-bounce font-bold uppercase tracking-wider">Reiniciando escáner...</p>
            </div>
          ) : null}

          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Cliente Activo</p>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-1">{cliente.nombre}</h2>
          <p className="text-zinc-500 font-mono text-sm mb-8">{cliente.telefono}</p>
          
          <div className="bg-zinc-50 p-6 rounded-[2rem] border border-zinc-100 mb-8 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase">Sellos Actuales</p>
              <p className="text-5xl font-black text-red-600">{cliente.puntos}</p>
            </div>
            <div className="text-right">
              <div className="h-12 w-12 bg-zinc-200 rounded-full flex items-center justify-center text-2xl shadow-inner">🌯</div>
            </div>
          </div>

          <button 
            onClick={procesarSello}
            disabled={cargando}
            className="w-full bg-zinc-900 text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] hover:bg-orange-500 transition-all active:scale-95 shadow-xl text-sm"
          >
            + AGREGAR SELLO
          </button>
          
          <button onClick={() => window.location.reload()} className="w-full mt-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest hover:text-red-500 transition-colors">Cancelar</button>
        </div>
      )}

      {/* FOOTER */}
      <footer className="mt-auto py-4 text-center opacity-20 grayscale">
        <p className="text-[9px] font-black uppercase tracking-[0.3em]">Staff Only • La Burrería</p>
      </footer>
      
      {/* CIRUGÍA ESTÉTICA: Parche CSS oculto para limpiar los letreros grises invasivos */}
      <style dangerouslySetInnerHTML={{__html: `
        #reader a { display: none !important; }
        #reader__status_span { display: none !important; }
        #reader div[style*="padding: 10px;"] { display: none !important; }
        #reader div[style*="border:"] { border: none !important; }
        
        #reader button { 
          background: #f97316 !important; 
          color: white !important; 
          border-radius: 0.75rem !important; 
          padding: 10px 20px !important; 
          margin-top: 15px; 
          font-weight: 900; 
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.1em;
          border: none !important; 
          cursor: pointer;
          transition: background 0.2s;
        }
        #reader button:hover { background: #ea580c !important; }
        
        #reader select { 
          background: #18181b; 
          color: white; 
          border: 1px solid #27272a; 
          padding: 8px 12px; 
          border-radius: 0.75rem; 
          font-size: 0.875rem;
          outline: none;
        }
      `}} />
    </main>
  )
}