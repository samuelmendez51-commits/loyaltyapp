'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Loader2, UserPlus, CheckCircle2 } from 'lucide-react'

// UUID fijo para la sucursal de registro por defecto
const SUCURSAL_REGISTRO_ID = '00000000-0000-0000-0000-000000000001'

export default function RegistroCliente() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [calle, setCalle] = useState('')
  const [numero, setNumero] = useState('')
  const [colonia, setColonia] = useState('')
  const [referencia, setReferencia] = useState('')

  // Selector de fecha de nacimiento (3 selectores)
  const [dia, setDia] = useState('')
  const [mes, setMes] = useState('')
  const [anio, setAnio] = useState('')

  const [registrando, setRegistrando] = useState(false)
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' })
  const [business, setBusiness] = useState<any>(null)

  useEffect(() => {
    const cargarNegocio = async () => {
      const getCookieVal = (name: string) => document.cookie.match(new RegExp(`${name}=([^;]+)`))?.[1] || ''
      const bizId = getCookieVal('session_business_id')
      if (bizId) {
        const { data } = await supabase.from('businesses').select('*').eq('id', bizId).maybeSingle()
        if (data) setBusiness(data)
      }
    }
    cargarNegocio()
  }, [])

  const registrarCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) return

    // Validación de teléfono (10 dígitos)
    const telefonoLimpio = telefono.replace(/\D/g, '')
    if (telefonoLimpio.length !== 10) {
      setMensaje({ texto: 'El teléfono debe tener exactamente 10 dígitos.', tipo: 'error' })
      return
    }

    setRegistrando(true)
    setMensaje({ texto: '', tipo: '' })

    // Ensamblaje de fecha de nacimiento (YYYY-MM-DD)
    let fechaEnsamblada: string | null = null
    if (dia && mes && anio) {
      const diaFormateado = dia.padStart(2, '0')
      const mesFormateado = mes.padStart(2, '0')
      fechaEnsamblada = `${anio}-${mesFormateado}-${diaFormateado}`
    }

    const getCookieVal = (name: string) => document.cookie.match(new RegExp(`${name}=([^;]+)`))?.[1] || ''
    const businessId = getCookieVal('session_business_id') || null
    const branchId = getCookieVal('session_branch_id') || null

    try {
      const { data, error } = await supabase
        .from('clientes')
        .upsert([{
          nombre: nombre.trim(),
          telefono: telefonoLimpio,
          email: email.trim() || null,
          fecha_nacimiento: fechaEnsamblada,
          calle: calle.trim() || null,
          numero: numero.trim() || null,
          colonia: colonia.trim() || null,
          referencia: referencia.trim() || null,
          puntos: 0,
          business_id: businessId,
          branch_id: branchId,
          sucursal_registro_id: SUCURSAL_REGISTRO_ID,
        }], { onConflict: 'telefono', ignoreDuplicates: false })
        .select()

      if (error) {
        console.error('[Registro] Error al registrar:', error)
        if (error.code === '23505') {
          // Duplicado: teléfono o email ya registrado
          setMensaje({
            texto: 'Este número de teléfono o correo ya está registrado en el club. ¿Ya eres socio?',
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
    } catch (err: any) {
      console.error('[Registro] Error inesperado:', err)
      if (err?.code === '23505') {
        setMensaje({
          texto: 'Este número de teléfono o correo ya está registrado en el club.',
          tipo: 'error'
        })
      } else {
        setMensaje({ texto: 'Error de conexión. Intenta de nuevo.', tipo: 'error' })
      }
    } finally {
      setRegistrando(false)
    }
  }

  const dias = Array.from({ length: 31 }, (_, i) => i + 1)
  const meses = [
    { num: '1', nombre: 'Enero' }, { num: '2', nombre: 'Febrero' }, { num: '3', nombre: 'Marzo' },
    { num: '4', nombre: 'Abril' }, { num: '5', nombre: 'Mayo' }, { num: '6', nombre: 'Junio' },
    { num: '7', nombre: 'Julio' }, { num: '8', nombre: 'Agosto' }, { num: '9', nombre: 'Septiembre' },
    { num: '10', nombre: 'Octubre' }, { num: '11', nombre: 'Noviembre' }, { num: '12', nombre: 'Diciembre' }
  ]
  const anioActual = new Date().getFullYear()
  const anios = Array.from({ length: 80 }, (_, i) => anioActual - i)

  const selectClass = "w-full bg-[#fafafa] border-[1.5px] border-[#e4e4e7] rounded-xl px-3 py-3 text-sm text-[#09090b] focus:outline-none focus:border-[#dc2626] focus:ring-2 focus:ring-red-100 transition-all appearance-none cursor-pointer font-medium"

  return (
    <main className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md animate-slideUp">

        {/* ── Header ── */}
        <div className="text-center mb-8">
          {business?.logo_url ? (
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl overflow-hidden border border-[#e4e4e7] shadow-sm bg-white">
              <img src={business.logo_url} alt={business.nombre} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#dc2626] flex items-center justify-center shadow-md">
              <UserPlus className="w-8 h-8 text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-[#09090b] tracking-tight">
            Únete al Club VIP
          </h1>
          <p className="text-sm text-[#71717a] mt-1.5">
            {business?.nombre ? `Club de ${business.nombre}` : 'Programa de Lealtad'} — Registro de Miembro
          </p>
        </div>

        {/* ── Formulario ── */}
        <div className="bg-white rounded-2xl shadow-[0_2px_20px_rgba(0,0,0,0.06)] border border-[#f0f0f0] p-8">
          <form onSubmit={registrarCliente} className="space-y-5">

            {/* Nombre */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">
                Nombre Completo *
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                className="input-clean"
                placeholder="Ej. Juan Pérez García"
              />
            </div>

            {/* Teléfono */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">
                Teléfono (10 dígitos) *
              </label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                required
                maxLength={10}
                className="input-clean"
                placeholder="Ej. 4521234567"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">
                Email <span className="text-[#a1a1aa] normal-case font-normal">(Opcional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-clean"
                placeholder="correo@ejemplo.com"
              />
            </div>

            {/* Dirección */}
            <div className="space-y-3 pt-3 border-t border-[#f4f4f5] animate-fade-in">
              <p className="text-xs font-black text-[#09090b] uppercase tracking-wider">Dirección de Entrega / Domicilio</p>
              
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">
                  Calle *
                </label>
                <input
                  type="text"
                  value={calle}
                  onChange={(e) => setCalle(e.target.value)}
                  required
                  className="input-clean"
                  placeholder="Ej. Avenida Juárez"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">
                    Número *
                  </label>
                  <input
                    type="text"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    required
                    className="input-clean"
                    placeholder="Ej. 123 o S/N"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">
                    Colonia *
                  </label>
                  <input
                    type="text"
                    value={colonia}
                    onChange={(e) => setColonia(e.target.value)}
                    required
                    className="input-clean"
                    placeholder="Ej. Centro"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">
                  Referencia <span className="text-[#a1a1aa] normal-case font-normal">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  className="input-clean"
                  placeholder="Ej. Portón negro frente a la escuela"
                />
              </div>
            </div>

            {/* Fecha de nacimiento */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#3f3f46] uppercase tracking-wide">
                Fecha de Nacimiento <span className="text-[#a1a1aa] normal-case font-normal">(Opcional)</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div className="relative">
                  <select
                    value={dia}
                    onChange={(e) => setDia(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Día</option>
                    {dias.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="relative">
                  <select
                    value={mes}
                    onChange={(e) => setMes(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Mes</option>
                    {meses.map(m => <option key={m.num} value={m.num}>{m.nombre}</option>)}
                  </select>
                </div>
                <div className="relative">
                  <select
                    value={anio}
                    onChange={(e) => setAnio(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Año</option>
                    {anios.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Mensaje de estado */}
            {mensaje.texto && (
              <div className={`p-3.5 rounded-xl text-sm font-medium text-center border flex items-center gap-2 justify-center ${
                mensaje.tipo === 'exito'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-red-50 text-red-600 border-red-200'
              }`}>
                {mensaje.tipo === 'exito' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                {mensaje.texto}
              </div>
            )}

            {/* Botón submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={registrando}
                className="btn-primary w-full py-4 text-sm"
              >
                {registrando ? (
                  <><Loader2 size={16} className="animate-spin" /> Creando tarjeta...</>
                ) : (
                  <><UserPlus size={16} /> Crear mi Tarjeta VIP</>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#a1a1aa] mt-6">
          Tus datos son confidenciales y se usan solo para el programa de fidelización.
        </p>
      </div>
    </main>
  )
}