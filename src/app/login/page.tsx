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
    <main className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
      
      {/* MARCA DE AGUA: Logo brillante en el fondo - Ahora más sutil para la elegancia */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none z-0">
          <img src="/logo.png" alt="La Burrería" className="w-[120vw] sm:w-[80vw] max-w-[800px] object-contain filter grayscale invert" />
      </div>

      {/* CONTENEDOR TIPO BÓVEDA (Usa la clase card-glass global) */}
      <div className="card-glass w-full max-w-[420px] p-8 sm:p-10 flex flex-col items-center relative z-10">
        
        {/* HEADER BRANDING */}
        <div className="mb-10 text-center flex flex-col items-center border-b border-[var(--border-subtle)] w-full pb-8">
          <h1 className="text-4xl font-black uppercase mb-1">
            La <span className="text-[var(--brand-red)] font-serif italic font-normal">Burrería</span>
          </h1>
          <h2 className="text-[var(--brand-gold)] font-sans text-xl tracking-[0.3em] font-black mb-2">CLUB</h2>
          <p className="text-[#a1a1aa] font-sans text-[10px] uppercase font-bold tracking-[0.4em]">Acceso Restringido</p>
        </div>

        {/* INDICADOR DE PUNTOS (PIN) Y MENSAJE */}
        <div className="mb-10 w-full flex flex-col items-center">
          <div className={`flex gap-6 mb-6 ${error ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
            {[0, 1, 2, 3].map((index) => (
              <div 
                key={index}
                className={`w-5 h-5 rounded-full transition-all duration-300 ${
                  pin.length > index 
                    ? 'bg-[var(--brand-red)] shadow-[0_0_20px_var(--brand-red)] scale-110' 
                    : error 
                      ? 'border-2 border-red-900 bg-red-950/30'
                      : 'border-2 border-[var(--border-subtle)] bg-black/50'
                }`}
              />
            ))}
          </div>
          <p className={`font-sans text-[11px] font-bold uppercase tracking-[0.2em] h-4 ${error ? 'text-red-500' : cargando ? 'text-[var(--brand-gold)] animate-pulse' : 'text-[#71717a]'}`}>
            {mensaje}
          </p>
        </div>

        {/* TECLADO NUMÉRICO ELEGANTE */}
        <div className="grid grid-cols-3 gap-4 w-full max-w-[300px] mx-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => manejarTecla(num.toString())}
              disabled={cargando}
              className="aspect-square bg-black/40 border border-[var(--border-subtle)] rounded-2xl flex items-center justify-center text-3xl font-sans font-black text-white hover:bg-[#18181b] hover:border-[var(--brand-red)] hover:text-[var(--brand-gold)] active:scale-95 transition-all duration-200"
            >
              {num}
            </button>
          ))}
          
          <div className="aspect-square"></div>
          
          <button
            onClick={() => manejarTecla('0')}
            disabled={cargando}
            className="aspect-square bg-black/40 border border-[var(--border-subtle)] rounded-2xl flex items-center justify-center text-3xl font-sans font-black text-white hover:bg-[#18181b] hover:border-[var(--brand-red)] hover:text-[var(--brand-gold)] active:scale-95 transition-all duration-200"
          >
            0
          </button>
          
          <button
            onClick={borrarUltimo}
            disabled={cargando}
            className="aspect-square bg-transparent rounded-2xl flex items-center justify-center text-[#71717a] hover:text-red-500 active:scale-95 transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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