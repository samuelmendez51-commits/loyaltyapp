'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function Home() {
  const [clientes, setClientes] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  // Estados para el formulario de registro
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoTelefono, setNuevoTelefono] = useState('')
  const [registrando, setRegistrando] = useState(false)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase.from('clientes').select('*').order('id', { ascending: false })
      setClientes(data || [])
      setCargando(false)
    }
    fetch()
  }, [])

  const registrarCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevoNombre.trim()) return

    setRegistrando(true)

    const { data, error } = await supabase
      .from('clientes')
      .insert([{ 
        nombre: nuevoNombre, 
        telefono: nuevoTelefono, 
        puntos: 0 
      }])
      .select()

    if (data) {
      setClientes([data[0], ...clientes])
      setNuevoNombre('')
      setNuevoTelefono('')
    } else if (error) {
      console.error("Error al registrar:", error)
      alert("Hubo un error al registrar el cliente.")
    }

    setRegistrando(false)
  }

  const sellosTotales = 6 

  return (
    <main 
      className="min-h-screen bg-[#09090b] text-[#ffffff] flex flex-col items-center p-4 sm:p-8 selection:bg-[#dc2626] relative overflow-x-hidden"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      
      {/* OPCIÓN 1: EL LOGO COMO MARCA DE AGUA CON LUZ DE REFLECTOR */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0">
        {/* El reflector de luz suave blanca de fondo */}
        <div className="absolute w-[350px] h-[350px] bg-[#ffffff] opacity-[0.12] blur-[80px] rounded-full"></div>
        {/* Tu logo */}
        <img 
          src="/logo.png" 
          alt="Watermark Logo" 
          className="w-[500px] h-[500px] object-contain opacity-[0.4] relative z-10" 
        />
      </div>

      <div className="w-full max-w-md z-10">
        
        {/* HEADER PRINCIPAL */}
        <header className="flex flex-col items-center mt-6 mb-8 text-center">
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-[#ffffff]">
            La Burrería <span className="text-[#dc2626] underline decoration-4 underline-offset-8">Club</span>
          </h1>
          <p className="text-[#f59e0b] text-sm font-black uppercase tracking-[0.4em] mt-3">
            PANEL DE CLIENTES
          </p>
        </header>

        {/* FORMULARIO DE ALTA DE CLIENTES */}
        <form onSubmit={registrarCliente} className="bg-[#18181b]/90 backdrop-blur-md rounded-[25px] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.8)] border border-[#27272a] mb-10 transition-all hover:border-[#3f3f46]">
          <h3 className="text-[#a1a1aa] text-[10px] font-black uppercase tracking-[0.2em] mb-4 text-center">
            Dar de Alta Nuevo Cliente
          </h3>
          
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Nombre completo" 
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              required
              className="w-full bg-[#000000]/60 border border-[#3f3f46] rounded-xl px-4 py-3 text-white placeholder-[#71717a] focus:outline-none focus:border-[#dc2626] transition-colors text-sm"
            />
            
            <input 
              type="tel" 
              placeholder="Número de teléfono (Opcional)" 
              value={nuevoTelefono}
              onChange={(e) => setNuevoTelefono(e.target.value)}
              className="w-full bg-[#000000]/60 border border-[#3f3f46] rounded-xl px-4 py-3 text-white placeholder-[#71717a] focus:outline-none focus:border-[#dc2626] transition-colors text-sm"
            />

            <button 
              type="submit" 
              disabled={registrando}
              className="w-full bg-gradient-to-r from-[#dc2626] to-[#991b1b] hover:from-[#ef4444] hover:to-[#dc2626] text-white font-black uppercase tracking-widest py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(220,38,38,0.4)] active:scale-95 disabled:opacity-50 text-xs"
            >
              {registrando ? 'CREANDO TARJETA VIP...' : 'REGISTRAR CLIENTE VIP'}
            </button>
          </div>
        </form>

        {/* LISTA DE TARJETAS */}
        <div className="space-y-8 pb-10">
          {cargando ? (
            <div className="flex flex-col items-center justify-center py-10">
              <p className="text-[#f59e0b] font-bold animate-pulse tracking-widest">ACCEDIENDO AL CLUB...</p>
            </div>
          ) : clientes.length === 0 ? (
            <p className="text-center text-[#71717a] bg-[#18181b]/50 p-6 rounded-2xl border border-[#27272a]">
              Aún no hay clientes registrados. ¡Sé el primero!
            </p>
          ) : (
            clientes.map((cliente) => (
              <div 
                key={cliente.id} 
                className="bg-[#18181b]/90 backdrop-blur-md rounded-[25px] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.8)] border border-[#27272a] relative overflow-hidden group transition-all duration-300 hover:border-[#3f3f46]"
              >
                {/* Brillo superior */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#dc2626] via-[#f59e0b] to-[#dc2626]"></div>

                {/* ENCABEZADO CENTRADO CON BOTÓN ABAJO */}
                <div className="flex flex-col items-center mb-7 gap-3 w-full mt-2">
                  <div className="text-center w-full">
                    <p className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-widest mb-1">
                      MIEMBRO VIP
                    </p>
                    <h2 className="text-2xl font-black uppercase italic tracking-wide text-[#ffffff] truncate leading-none px-4">
                      {cliente.nombre}
                    </h2>
                    {cliente.telefono && (
                      <p className="text-[#71717a] text-xs mt-2 tracking-widest">{cliente.telefono}</p>
                    )}
                  </div>
                  
                  <Link href={`/cliente/${cliente.id}`}>
                    <button className="bg-[#27272a] hover:bg-[#ffffff] hover:text-[#000000] text-[#ffffff] border border-[#3f3f46] px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95">
                      Ver Tarjeta
                    </button>
                  </Link>
                </div>

                {/* LOS 6 SELLOS PEQUEÑOS */}
                <div className="flex justify-between items-center mb-6 bg-[#000000]/60 p-3 rounded-2xl border border-[#27272a]/50">
                  {[...Array(sellosTotales)].map((_, i) => {
                    const estaMarcado = i < (cliente.puntos || 0);
                    return (
                      <div key={i} className="relative">
                        {estaMarcado ? (
                          <div className="w-[38px] h-[38px] rounded-full bg-gradient-to-br from-[#FFD700] to-[#B8860B] border border-[#000000] flex items-center justify-center shadow-[0_0_15px_rgba(255,215,0,0.3)] scale-110 z-10 relative">
                            <span className="text-[#000000] text-sm font-black">★</span>
                          </div>
                        ) : (
                          <div className="w-[34px] h-[34px] rounded-full bg-[#cc0000] border border-[#000000] flex items-center justify-center opacity-80 z-10 relative">
                            <span className="text-[#ffffff] text-xs font-black">★</span>
                          </div>
                        )}
                        {!estaMarcado && (
                          <div className="absolute inset-0 rounded-full border border-dashed border-[#52525b] pointer-events-none scale-110" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* FOOTER CON ESTATUS */}
                <div className="text-center bg-[#000000]/50 py-3 rounded-xl border border-[#27272a]/50">
                  <p className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-widest">
                    {cliente.puntos >= sellosTotales ? (
                      <span className="text-[#f59e0b] font-black animate-pulse">¡PREMIO DISPONIBLE! 🎁</span>
                    ) : (
                      <>FALTAN <span className="text-[#dc2626] font-black text-base mx-1">{sellosTotales - cliente.puntos}</span> SELLOS</>
                    )}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}