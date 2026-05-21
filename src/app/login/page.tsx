'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPantalla() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState('Ingresa tu PIN de acceso')

  useEffect(() => {
    if (pin.length === 4) {
      validarAcceso(pin)
    }
  }, [pin])

  const manejarTecla = (numero: string) => {
    if (pin.length < 4 && !cargando) {
      setPin(prev => prev + numero)
      setError(false)
      setMensaje('Ingresa tu PIN de acceso')
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50)
    }
  }

  const borrarUltimo = () => {
    if (!cargando) {
      setPin(prev => prev.slice(0, -1))
      setError(false)
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30)
    }
  }

  const validarAcceso = async (pinIngresado: string) => {
    setCargando(true)
    setMensaje('Validando credenciales...')

    try {
      const { data, error } = await supabase
        .from('accesos_pin')
        .select('*')
        .eq('pin', pinIngresado)
        .maybeSingle()

      if (error || !data) {
        setError(true)
        setPin('')
        setMensaje('❌ PIN INCORRECTO')
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 100, 100])
        setTimeout(() => setMensaje('Ingresa tu PIN de acceso'), 2000)
      } else {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 100, 200])
        setMensaje(`✅ Bienvenido, ${data.propietario}`)
        
        // --- GUARDAMOS LA LLAVE SECRETA (COOKIE) POR 12 HORAS ---
        document.cookie = `session_rol=${data.rol}; path=/; max-age=43200; SameSite=Strict`;
        document.cookie = `session_user=${data.propietario}; path=/; max-age=43200; SameSite=Strict`;
        
        setTimeout(() => {
          if (data.rol === 'admin') {
            window.location.href = '/dashboard'
          } else {
            window.location.href = '/escaner'
          }
        }, 1000)
      }
    } catch (err) {
      setError(true)
      setPin('')
      setMensaje('Error de red')
    } finally {
      setCargando(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4 selection:bg-red-600/30 relative overflow-hidden antialiased">
      
      {/* MARCA DE AGUA: Logo brillante en el fondo */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.015] pointer-events-none z-0">
          <img src="/logo.png" alt="La Burrería" className="w-[120vw] sm:w-[80vw] max-w-[800px] object-contain filter grayscale invert brightness-100" />
      </div>

      <div className="relative z-10 w-full max-w-[380px] flex flex-col items-center">
        
        {/* HEADER BRANDING: Limpio y centrado */}
        <div className="mb-10 text-center flex flex-col items-center border-b border-zinc-900 pb-6">
          <h1 className="text-3xl font-black uppercase tracking-widest text-white shadow-black drop-shadow-md mb-2">
            La <span className="text-red-600 font-serif italic">Burrería</span> Club 🤠
          </h1>
          <p className="text-[#e5c07b] text-[10px] uppercase font-bold tracking-[0.4em]">Control de Acceso VIP</p>
        </div>

        {/* INDICADOR DE PUNTOS (PIN) Y MENSAJE */}
        <div className="mb-10 w-full flex flex-col items-center">
          <div className={`flex gap-5 mb-5 ${error ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
            {[0, 1, 2, 3].map((index) => (
              <div 
                key={index}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                  pin.length > index 
                    ? 'bg-red-600 border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.8)] scale-125' 
                    : error 
                      ? 'border-red-900 bg-red-950/30'
                      : 'border-zinc-600 bg-zinc-900'
                }`}
              />
            ))}
          </div>
          <p className={`text-[11px] font-bold uppercase tracking-[0.2em] ${error ? 'text-red-500' : cargando ? 'text-[#e5c07b] animate-pulse' : 'text-zinc-500'}`}>
            {mensaje}
          </p>
        </div>

        {/* TECLADO NUMÉRICO PRO (LEGISLIBLE) */}
        <div className="grid grid-cols-3 gap-4 w-full max-w-[280px] mx-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => manejarTecla(num.toString())}
              disabled={cargando}
              className="aspect-square bg-[#18181b] border-2 border-zinc-800 rounded-2xl flex items-center justify-center text-3xl font-bold text-white hover:bg-zinc-800 hover:border-red-600/50 active:scale-95 transition-all shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
            >
              {num}
            </button>
          ))}
          
          <div className="aspect-square"></div>
          
          <button
            onClick={() => manejarTecla('0')}
            disabled={cargando}
            className="aspect-square bg-[#18181b] border-2 border-zinc-800 rounded-2xl flex items-center justify-center text-3xl font-bold text-white hover:bg-zinc-800 hover:border-red-600/50 active:scale-95 transition-all shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
          >
            0
          </button>
          
          <button
            onClick={borrarUltimo}
            disabled={cargando}
            className="aspect-square bg-transparent rounded-2xl flex items-center justify-center text-zinc-500 hover:text-red-500 active:scale-95 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
            </svg>
          </button>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-10px); }
          40%, 80% { transform: translateX(10px); }
        }
      `}} />
    </main>
  )
}