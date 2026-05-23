'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [pin, setPin] = useState('')
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState('Ingresa tu PIN de acceso')
  const [error, setError] = useState(false)

  const validarAcceso = async (pinIngresado: string) => {
    setCargando(true)
    setMensaje('Validando credenciales...')

    try {
      const { data, error: supabaseError } = await supabase
        .from('accesos_pin')
        .select('*')
        .eq('pin', pinIngresado)
        .maybeSingle()

      if (supabaseError || !data) {
        setError(true)
        setPin('')
        setMensaje('❌ PIN INCORRECTO')
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 100, 100])
        setTimeout(() => setMensaje('Ingresa tu PIN de acceso'), 2000)
      } else {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 100, 200])
        setMensaje(`✅ Bienvenido, ${data.propietario}`)
        
        document.cookie = `session_rol=${data.rol}; path=/; SameSite=Strict`;
        document.cookie = `session_user=${data.propietario}; path=/; SameSite=Strict`;
        
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

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '')
    setPin(value)
    if (error) setError(false)
    
    if (value.length === 4) {
      validarAcceso(value)
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#18181b]/90 backdrop-blur-md rounded-[25px] border border-[#27272a] shadow-[0_20px_40px_rgba(0,0,0,0.8)] p-8 text-center relative overflow-hidden">
        
        <h1 className="text-3xl font-black italic mb-2 text-white">
          La Burrería <span className="text-[#dc2626]">VIP</span>
        </h1>
        <p className={`text-xs font-bold uppercase tracking-widest mb-8 ${error ? 'text-[#dc2626]' : 'text-[#a1a1aa]'}`}>
          {mensaje}
        </p>

        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={handlePinChange}
          disabled={cargando}
          className={`w-full bg-black border-2 rounded-xl text-center text-4xl tracking-[0.5em] py-4 text-white font-mono focus:outline-none transition-colors ${
            error ? 'border-[#dc2626]' : 'border-[#3f3f46] focus:border-[#d4af37]'
          }`}
          placeholder="••••"
        />
        
        {cargando && (
          <div className="mt-6 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#3f3f46] border-t-[#dc2626] rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </main>
  )
}