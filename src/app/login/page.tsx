'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// ¡ESTA ES LA LÍNEA MÁGICA QUE LE FALTABA A VERCEL!
export default function LoginPage() {
  const [pin, setPin] = useState('')
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState('Ingresa tu PIN de acceso')
  const [error, setError] = useState(false)

  // Tu función exacta y perfecta:
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
        
        // --- GUARDAMOS LA LLAVE SECRETA (SESSION COOKIE) ---
        // Al quitar max-age, la cookie muere cuando se cierra el navegador.
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

  // Controlador para el teclado
  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '') // Solo permite números
    setPin(value)
    if (error) setError(false)
    
    // Si el PIN es de 4 dígitos, valida automáticamente
    if (value.length === 4) {
      validarAcceso(value)
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#18181b]/90 backdrop-blur-md rounded-[25px] border border-[#27272a] shadow-[0_20px_40px_rgba(0,0,0,0.8)] p-8 text-center relative overflow-hidden">
        
        {