'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function RegistroCliente() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  
  // Nuevos estados para el selector de fecha 3 Ruedas
  const [dia, setDia] = useState('')
  const [mes, setMes] = useState('')
  const [anio, setAnio] = useState('')
  
  const [registrando, setRegistrando] = useState(false)
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' })

  const registrarCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) return

    // Validación de teléfono (Exactamente 10 dígitos)
    const telefonoLimpio = telefono.replace(/\D/g, '')
    if (telefonoLimpio.length !== 10) {
      setMensaje({ texto: 'El teléfono debe tener 10 dígitos.', tipo: 'error' })
      return
    }

    setRegistrando(true)
    setMensaje({ texto: '', tipo: '' })

    // Ensamblaje de la fecha de nacimiento (YYYY-MM-DD)
    let fechaEnsamblada = null
    if (dia && mes && anio) {
      const diaFormateado = dia.padStart(2, '0')
      const mesFormateado = mes.padStart(2, '0')
      fechaEnsamblada = `${anio}-${mesFormateado}-${diaFormateado}`
    }

    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert([{ 
          nombre: nombre.trim(), 
          telefono: telefonoLimpio, 
          email: email.trim() || null, 
          fecha_nacimiento: fechaEnsamblada,
          puntos: 0,
          sucursal_origen_id: null // Se llenará dinámicamente cuando actives sucursales
        }])
        .select()

      if (error) {
        console.error("Error al registrar:", error)
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

  // Generadores para los Selects de Fecha
  const dias = Array.from({length: 31}, (_, i) => i + 1)
  const meses = [
    { num: '1', nombre: 'Ene' }, { num: '2', nombre: 'Feb' }, { num: '3', nombre: 'Mar' },
    { num: '4', nombre: 'Abr' }, { num: '5', nombre: 'May' }, { num: '6', nombre: 'Jun' },
    { num: '7', nombre: 'Jul' }, { num: '8', nombre: 'Ago' }, { num: '9', nombre: 'Sep' },
    { num: '10', nombre: 'Oct' }, { num: '11', nombre: 'Nov' }, { num: '12', nombre: 'Dic' }
  ]
  const anioActual = new Date().getFullYear()
  const anios = Array.from({length: 80}, (_, i) => anioActual - i)

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
                Teléfono (10 dígitos)
              </label>
              <input 
                type="tel" 
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                required
                maxLength={10}
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

            {/* NUEVO: SELECTOR DE FECHA 3 RUEDAS */}
            <div>
              <label className="block text-[10px] font-black text-[#a1a1aa] uppercase tracking-widest mb-2 ml-1">
                Fecha de Nacimiento (Opcional)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <select 
                  value={dia}
                  onChange={(e) => setDia(e.target.value)}
                  className="bg-[#000000] border border-[#3f3f46] rounded-xl px-2 py-3 text-[#ffffff] text-sm font-bold focus:outline-none focus:border-[#dc2626] focus:ring-1 focus:ring-[#dc2626]"
                >
                  <option value="">Día</option>
                  {dias.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                
                <select 
                  value={mes}
                  onChange={(e) => setMes(e.target.value)}
                  className="bg-[#000000] border border-[#3f3f46] rounded-xl px-2 py-3 text-[#ffffff] text-sm font-bold focus:outline-none focus:border-[#dc2626] focus:ring-1 focus:ring-[#dc2626]"
                >
                  <option value="">Mes</option>
                  {meses.map(m => <option key={m.num} value={m.num}>{m.nombre}</option>)}
                </select>

                <select 
                  value={anio}
                  onChange={(e) => setAnio(e.target.value)}
                  className="bg-[#000000] border border-[#3f3f46] rounded-xl px-2 py-3 text-[#ffffff] text-sm font-bold focus:outline-none focus:border-[#dc2626] focus:ring-1 focus:ring-[#dc2626]"
                >
                  <option value="">Año</option>
                  {anios.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
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