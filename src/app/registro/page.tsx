'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function RegistroCliente() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [registrando, setRegistrando] = useState(false)
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' })

  const registrarCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) return

    setRegistrando(true)
    setMensaje({ texto: '', tipo: '' })

    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert([{ 
          nombre: nombre.trim(), 
          telefono: telefono.trim() || null, 
          // Omitimos email si no lo tienes en tu tabla de Supabase actual, 
          // si lo tienes, descomenta la siguiente línea:
          // email: email.trim() || null, 
          fecha_nacimiento: fechaNacimiento || null,
          puntos: 0,
          // NOTA PRO: Usamos null temporalmente a menos que ya hayas creado 
          // la sucursal '00000000...' en tu tabla de 'sucursales'
          sucursal_origen_id: null 
        }])
        .select()

      if (error) {
        console.error("Error al registrar:", error)
        // Intercepción del error de duplicidad (Teléfono ya existe)
        if (error.code === '23505') {
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
        // Redirección exitosa a la vista dinámica del cliente
        setTimeout(() => {
          router.push(`/cliente/${data[0].id}`)
        }, 1500)
      }
    } catch (err) {
      console.error("Error inesperado:", err)
      setMensaje({ texto: 'Error de conexión.', tipo: 'error' })
    } finally {
      setRegistrando(false)
    }
  }

  return (
    <main 
      className="min-h-screen bg-[#09090b] text-[#ffffff] flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-x-hidden selection:bg-[#dc2626]"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      
      {/* EL LOGO COMO MARCA DE AGUA */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0 flex items-center justify-center">
        <div className="absolute w-[350px] h-[350px] bg-[#ffffff] opacity-[0.12] blur-[80px] rounded-full"></div>
        <img 
          src="/logo.png" 
          alt="Watermark Logo" 
          className="relative w-[500px] h-[500px] object-contain opacity-[0.4] z-10" 
        />
      </div>

      <div className="w-full max-w-md z-10 relative">
        
        {/* HEADER DE LA PÁGINA */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-[#18181b]/80 backdrop-blur-md rounded-full border border-[#27272a] flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.2)]">
            <span className="text-3xl">📝</span>
          </div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-[#ffffff]">
            Registro <span className="text-[#dc2626] underline decoration-4 underline-offset-4">VIP</span>
          </h1>
          <p className="text-[#f59e0b] text-[10px] font-black uppercase tracking-[0.3em] mt-3">
            Únete a nuestro club
          </p>
        </div>

        {/* CONTENEDOR DE FORMULARIO CON EFECTO CRISTAL */}
        <div className="bg-[#18181b]/90 backdrop-blur-md rounded-[25px] p-8 shadow-[0_20px_40px_rgba(0,0,0,0.8)] border border-[#27272a] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#dc2626] via-[#f59e0b] to-[#dc2626]"></div>

          <p className="text-[#a1a1aa] text-xs text-center mb-6 tracking-widest uppercase font-bold">
            Ingresa tus datos para generar tu tarjeta digital
          </p>

          <form onSubmit={registrarCliente} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-[#a1a1aa] uppercase tracking-widest mb-2 ml-1">
                Nombre Completo
              </label>
              <input 
                type="text" 
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                className="w-full bg-[#000000] border border-[#3f3f46] rounded-xl px-4 py-3 text-[#ffffff] placeholder-[#52525b] focus:outline-none focus:border-[#dc2626] focus:ring-1 focus:ring-[#dc2626] transition-all text-sm font-bold block caret-[#dc2626]"
                placeholder="Ej. Juan Pérez"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-[#a1a1aa] uppercase tracking-widest mb-2 ml-1">
                Teléfono
              </label>
              <input 
                type="tel" 
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                required
                className="w-full bg-[#000000] border border-[#3f3f46] rounded-xl px-4 py-3 text-[#ffffff] placeholder-[#52525b] focus:outline-none focus:border-[#dc2626] focus:ring-1 focus:ring-[#dc2626] transition-all text-sm font-bold block caret-[#dc2626]"
                placeholder="Ej. 4521234567"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-[#a1a1aa] uppercase tracking-widest mb-2 ml-1">
                Email (Opcional)
              </label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#000000] border border-[#3f3f46] rounded-xl px-4 py-3 text-[#ffffff] placeholder-[#52525b] focus:outline-none focus:border-[#dc2626] focus:ring-1 focus:ring-[#dc2626] transition-all text-sm font-bold block caret-[#dc2626]"
                placeholder="correo@ejemplo.com"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-[#a1a1aa] uppercase tracking-widest mb-2 ml-1">
                Fecha de Nacimiento (Opcional)
              </label>
              <input 
                type="date" 
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
                className="w-full bg-[#000000] border border-[#3f3f46] rounded-xl px-4 py-3 text-[#ffffff] placeholder-[#52525b] focus:outline-none focus:border-[#dc2626] focus:ring-1 focus:ring-[#dc2626] transition-all text-sm font-bold block caret-[#dc2626]"
                style={{ colorScheme: 'dark' }}
              />
            </div>

            {mensaje.texto && (
              <div className={`p-3 rounded-lg text-xs font-bold uppercase tracking-wider text-center border ${
                mensaje.tipo === 'exito' ? 'bg-green-900/30 text-green-400 border-green-800/50' : 'bg-red-900/30 text-red-400 border-red-800/50'
              }`}>
                {mensaje.texto}
              </div>
            )}

            <div className="pt-4 relative z-10">
              <button 
                type="submit" 
                disabled={registrando}
                className="w-full bg-gradient-to-r from-[#dc2626] to-[#991b1b] text-white font-black uppercase tracking-widest py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:from-[#ef4444] hover:to-[#dc2626] active:scale-95 disabled:opacity-50 text-xs flex justify-center items-center gap-2 cursor-pointer"
              >
                {registrando ? (
                  <span className="animate-pulse">Procesando...</span>
                ) : (
                  <>
                    <span>Crear Tarjeta VIP</span>
                    <span>💳</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}