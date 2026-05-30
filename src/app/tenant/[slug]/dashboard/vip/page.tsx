'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, Send, AlertTriangle, RefreshCw } from 'lucide-react'

interface ChurnCandidate {
  cliente_id: string
  nombre: string
  telefono: string
  puntos: number
  ultimo_evento: string | null
  dias_inactivo: number
}

export default function VIPChurnPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [businessId, setBusinessId] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [candidates, setCandidates] = useState<ChurnCandidate[]>([])
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')

  // Configuración
  const [diasThreshold, setDiasThreshold] = useState(21)
  const [mensajeRescate, setMensajeRescate] = useState(
    '¡Hola {nombre}! Te extrañamos en {negocio}. 🎁 Tienes {puntos} sellos esperándote. ¡Ven esta semana y te damos un beneficio especial!'
  )

  const getCookie = (n: string) => typeof document !== 'undefined' ? (document.cookie.match(new RegExp(`${n}=([^;]+)`))?.[1] || '') : ''

  useEffect(() => {
    const init = async () => {
      let bId = getCookie('session_business_id')
      if (!bId) {
        const { data } = await supabase.from('businesses').select('id, nombre, dias_inactividad_churn, mensaje_rescate_whatsapp').eq('slug', slug).single()
        if (data) {
          bId = data.id
          setBusinessName(data.nombre)
          if (data.dias_inactividad_churn) setDiasThreshold(data.dias_inactividad_churn)
          if (data.mensaje_rescate_whatsapp) setMensajeRescate(data.mensaje_rescate_whatsapp)
        }
      } else {
        const { data } = await supabase.from('businesses').select('nombre, dias_inactividad_churn, mensaje_rescate_whatsapp').eq('id', bId).single()
        if (data) {
          setBusinessName(data.nombre)
          if (data.dias_inactividad_churn) setDiasThreshold(data.dias_inactividad_churn)
          if (data.mensaje_rescate_whatsapp) setMensajeRescate(data.mensaje_rescate_whatsapp)
        }
      }
      setBusinessId(bId)
    }
    init()
  }, [slug])

  useEffect(() => {
    if (!businessId) return
    cargarCandidatos()
  }, [businessId])

  const cargarCandidatos = async () => {
    setCargando(true)
    try {
      // Usar la función SQL get_churn_candidates con threshold dinámico
      const { data, error } = await supabase.rpc('get_churn_candidates', {
        p_business_id: businessId
      })

      if (error) throw error

      // Filtrar por el threshold configurable del merchant
      const filtrados = (data || []).filter((c: any) => {
        const dias = c.dias_inactivo ?? 999
        return dias >= diasThreshold
      })

      // Enriquecer con puntos actuales
      const enriched = await Promise.all(
        filtrados.slice(0, 30).map(async (c: any) => {
          const { data: cli } = await supabase
            .from('clientes')
            .select('puntos')
            .eq('id', c.cliente_id)
            .single()
          return {
            ...c,
            puntos: cli?.puntos || 0,
          } as ChurnCandidate
        })
      )

      setCandidates(enriched)
    } catch (err) {
      // Fallback: query manual si la función RPC no existe aún
      const { data: clientesData } = await supabase
        .from('clientes')
        .select('id, nombre, telefono, puntos, ultima_visita')
        .eq('business_id', businessId)
        .gt('puntos', 0)

      if (clientesData) {
        const fallback: ChurnCandidate[] = clientesData
          .map(c => {
            const diasInactivo = c.ultima_visita
              ? Math.floor((Date.now() - new Date(c.ultima_visita).getTime()) / 86400000)
              : 999
            return {
              cliente_id: c.id,
              nombre: c.nombre,
              telefono: c.telefono,
              puntos: c.puntos,
              ultimo_evento: c.ultima_visita,
              dias_inactivo: diasInactivo,
            }
          })
          .filter(c => c.dias_inactivo >= diasThreshold)
          .sort((a, b) => b.dias_inactivo - a.dias_inactivo)
          .slice(0, 30)
        setCandidates(fallback)
      }
    }
    setCargando(false)
  }

  const guardarConfig = async () => {
    if (!businessId) return
    setGuardando(true)
    const { error } = await supabase.from('businesses').update({
      dias_inactividad_churn: diasThreshold,
      mensaje_rescate_whatsapp: mensajeRescate,
    }).eq('id', businessId)
    setMsg(error ? '❌ Error al guardar' : '✅ Configuración guardada')
    setGuardando(false)
    setTimeout(() => setMsg(''), 3000)
  }

  const rescatar = (c: ChurnCandidate) => {
    const tel = '52' + c.telefono.replace(/\D/g, '').slice(-10)
    const msg = mensajeRescate
      .replace(/{nombre}/g, c.nombre)
      .replace(/{negocio}/g, businessName)
      .replace(/{puntos}/g, String(c.puntos))
    const url = `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  const rescatarTodos = () => {
    if (!confirm(`¿Enviar mensaje de rescate a ${candidates.length} clientes?`)) return
    candidates.forEach(c => rescatar(c))
  }

  const urgencia = (dias: number) => {
    if (dias >= 60) return { label: '💀 Perdido', color: 'text-red-400', bg: 'bg-red-950/30 border-red-900' }
    if (dias >= 30) return { label: '⚠️ Crítico', color: 'text-orange-400', bg: 'bg-orange-950/30 border-orange-900' }
    return { label: '😴 Inactivo', color: 'text-amber-400', bg: 'bg-amber-950/30 border-amber-900' }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white font-sans p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-zinc-500 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black">🚨 Rescate Anti-Churn</h1>
            <p className="text-zinc-500 text-xs uppercase tracking-widest mt-1">Clientes en Riesgo · WhatsApp Automatizado</p>
          </div>
          {msg && <div className="ml-auto px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-bold">{msg}</div>}
        </div>

        {/* Panel de Configuración */}
        <div className="bg-[#141414] border border-zinc-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-black text-zinc-300 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" />
            Configuración de Riesgo
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] text-zinc-500 uppercase font-black block">
                Días de Inactividad = Cliente Perdido
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={diasThreshold}
                  onChange={e => setDiasThreshold(parseInt(e.target.value) || 21)}
                  className="w-24 bg-black border border-zinc-800 rounded-xl px-3 py-3 text-white text-2xl font-black text-center focus:outline-none focus:border-red-700"
                />
                <div>
                  <p className="text-zinc-300 font-bold">días</p>
                  <p className="text-zinc-600 text-xs">Sin visita registrada</p>
                </div>
              </div>
              <input
                type="range"
                min={7}
                max={90}
                value={diasThreshold}
                onChange={e => setDiasThreshold(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[9px] text-zinc-700">
                <span>7d (estricto)</span>
                <span>30d (recomendado)</span>
                <span>90d</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-zinc-500 uppercase font-black block">
                Mensaje de Rescate WhatsApp
              </label>
              <p className="text-[9px] text-zinc-600">Variables: {'{nombre}'}, {'{negocio}'}, {'{puntos}'}</p>
              <textarea
                value={mensajeRescate}
                onChange={e => setMensajeRescate(e.target.value)}
                rows={4}
                className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none resize-none"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={guardarConfig}
              disabled={guardando}
              className="flex items-center gap-2 bg-gradient-to-r from-red-700 to-red-900 text-white font-black px-5 py-2.5 rounded-xl text-xs uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all"
            >
              <Save size={14} />
              Guardar Configuración
            </button>
            <button
              onClick={() => cargarCandidatos()}
              className="flex items-center gap-2 border border-zinc-700 text-zinc-400 hover:text-white font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-widest hover:border-zinc-500 transition-all"
            >
              <RefreshCw size={14} />
              Actualizar Lista
            </button>
          </div>
        </div>

        {/* Lista de clientes en riesgo */}
        <div className="bg-[#141414] border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <div>
              <h2 className="text-sm font-black">Clientes en Riesgo</h2>
              <p className="text-zinc-500 text-xs mt-0.5">Sin actividad en +{diasThreshold} días · {candidates.length} encontrados</p>
            </div>
            {candidates.length > 1 && (
              <button
                onClick={rescatarTodos}
                className="flex items-center gap-2 bg-green-900/40 hover:bg-green-800/50 border border-green-800 text-green-400 font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-all"
              >
                <Send size={12} />
                Rescatar Todos ({candidates.length})
              </button>
            )}
          </div>

          {cargando ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-zinc-800 border-t-red-600 rounded-full animate-spin" />
            </div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">🎉</p>
              <p className="text-white font-bold">¡Sin clientes en riesgo!</p>
              <p className="text-zinc-500 text-sm mt-1">Todos tus socios han visitado en los últimos {diasThreshold} días</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-900">
              {candidates.map(c => {
                const u = urgencia(c.dias_inactivo)
                return (
                  <div key={c.cliente_id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-900/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`px-2 py-1 rounded-lg border text-[10px] font-black ${u.bg} ${u.color}`}>
                        {u.label}
                      </div>
                      <div>
                        <p className="font-bold">{c.nombre}</p>
                        <p className="text-zinc-500 text-xs font-mono">{c.telefono}</p>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="text-zinc-600 text-[9px] uppercase font-black">Sellos</p>
                        <p className="text-amber-400 font-black">{c.puntos}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-zinc-600 text-[9px] uppercase font-black">Inactivo</p>
                        <p className={`font-black ${u.color}`}>{c.dias_inactivo === 999 ? '∞' : `${c.dias_inactivo}d`}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => rescatar(c)}
                      className="flex items-center gap-2 bg-green-900/40 hover:bg-green-800/60 border border-green-800 text-green-400 hover:text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-all whitespace-nowrap"
                    >
                      <Send size={12} />
                      Rescatar 🚨
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
