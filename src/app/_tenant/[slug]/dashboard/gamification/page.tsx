'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { Plus, Trash2, ChevronRight, Save, RotateCcw, ArrowLeft } from 'lucide-react'

interface Milestone {
  id: string
  business_id: string
  sello_objetivo: number
  nombre: string
  activo: boolean
  milestone_prizes?: Prize[]
}
interface Prize {
  id: string
  milestone_id: string
  tier: string
  nombre: string
  descripcion: string
  probabilidad: number
}

const TIER_COLORS: Record<string, string> = {
  base: 'border-zinc-600 bg-zinc-900',
  medio: 'border-amber-700 bg-amber-950/30',
  grande: 'border-red-700 bg-red-950/30',
}
const TIER_LABELS: Record<string, string> = {
  base: '🥉 Base',
  medio: '🥈 Medio',
  grande: '🥇 Grande',
}

export default function GamificationPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [businessId, setBusinessId] = useState('')
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [selected, setSelected] = useState<Milestone | null>(null)
  const [prizes, setPrizes] = useState<Prize[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')

  // Nuevo hito
  const [nuevoSello, setNuevoSello] = useState('5')
  const [nuevoNombre, setNuevoNombre] = useState('')

  // Nuevo premio
  const [nuevoPrize, setNuevoPrize] = useState({ tier: 'base', nombre: '', descripcion: '', probabilidad: '33' })

  const getCookie = (n: string) => typeof document !== 'undefined' ? (document.cookie.match(new RegExp(`${n}=([^;]+)`))?.[1] || '') : ''

  useEffect(() => {
    const init = async () => {
      const bId = getCookie('session_business_id')
      if (!bId) {
        // fallback: resolve by slug
        const { data } = await supabase.from('businesses').select('id').eq('slug', slug).single()
        if (data) setBusinessId(data.id)
      } else {
        setBusinessId(bId)
      }
    }
    init()
  }, [slug])

  useEffect(() => {
    if (!businessId) return
    cargarMilestones()
  }, [businessId])

  const cargarMilestones = async () => {
    setCargando(true)
    const { data } = await supabase
      .from('reward_milestones')
      .select('*, milestone_prizes(*)')
      .eq('business_id', businessId)
      .order('sello_objetivo')
    if (data) setMilestones(data as Milestone[])
    setCargando(false)
  }

  const seleccionarMilestone = (m: Milestone) => {
    setSelected(m)
    setPrizes(m.milestone_prizes || [])
  }

  const crearMilestone = async () => {
    if (!businessId || !nuevoSello) return
    setGuardando(true)
    const { data, error } = await supabase.from('reward_milestones').insert({
      business_id: businessId,
      sello_objetivo: parseInt(nuevoSello),
      nombre: nuevoNombre || `Premio Sello ${nuevoSello}`,
      activo: true,
    }).select().single()
    if (!error && data) {
      setMsg('✅ Hito creado')
      setNuevoSello(''); setNuevoNombre('')
      await cargarMilestones()
    } else {
      setMsg('❌ ' + (error?.message || 'Error'))
    }
    setGuardando(false)
    setTimeout(() => setMsg(''), 3000)
  }

  const eliminarMilestone = async (id: string) => {
    if (!confirm('¿Eliminar este hito y todos sus premios?')) return
    await supabase.from('reward_milestones').delete().eq('id', id)
    if (selected?.id === id) { setSelected(null); setPrizes([]) }
    cargarMilestones()
  }

  const toggleMilestone = async (m: Milestone) => {
    await supabase.from('reward_milestones').update({ activo: !m.activo }).eq('id', m.id)
    cargarMilestones()
  }

  const calcProbTotal = () => prizes.reduce((s, p) => s + (p.probabilidad || 0), 0)

  const agregarPrize = async () => {
    if (!selected || !nuevoPrize.nombre) return
    const total = calcProbTotal() + parseInt(nuevoPrize.probabilidad || '0')
    if (total > 100) {
      setMsg(`❌ Las probabilidades suman ${total}% (máx 100%)`)
      setTimeout(() => setMsg(''), 3000)
      return
    }
    setGuardando(true)
    const { data, error } = await supabase.from('milestone_prizes').insert({
      milestone_id: selected.id,
      tier: nuevoPrize.tier,
      nombre: nuevoPrize.nombre,
      descripcion: nuevoPrize.descripcion,
      probabilidad: parseInt(nuevoPrize.probabilidad),
    }).select().single()
    if (!error && data) {
      setPrizes(prev => [...prev, data as Prize])
      setNuevoPrize({ tier: 'base', nombre: '', descripcion: '', probabilidad: '33' })
      setMsg('✅ Premio agregado')
    } else {
      setMsg('❌ ' + error?.message)
    }
    setGuardando(false)
    setTimeout(() => setMsg(''), 3000)
    cargarMilestones()
  }

  const eliminarPrize = async (id: string) => {
    await supabase.from('milestone_prizes').delete().eq('id', id)
    setPrizes(prev => prev.filter(p => p.id !== id))
    cargarMilestones()
  }

  const updateProbabilidad = async (prizeId: string, val: number) => {
    setPrizes(prev => prev.map(p => p.id === prizeId ? { ...p, probabilidad: val } : p))
    await supabase.from('milestone_prizes').update({ probabilidad: val }).eq('id', prizeId)
  }

  const probTotal = calcProbTotal()

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white font-sans p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-zinc-500 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black">🎰 Gestor de Ruleta VIP</h1>
            <p className="text-zinc-500 text-xs uppercase tracking-widest mt-1">
              Hitos de Sellos · Pool de Premios Configurable
            </p>
          </div>
          {msg && (
            <div className="ml-auto px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-bold">
              {msg}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Panel izquierdo: Lista de Hitos */}
          <div className="space-y-4">
            <div className="bg-[#141414] border border-zinc-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">Hitos de Sellos</h2>

              {cargando ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-zinc-800 border-t-red-600 rounded-full animate-spin" />
                </div>
              ) : milestones.length === 0 ? (
                <div className="text-center py-8 text-zinc-600">
                  <p className="text-3xl mb-2">🎯</p>
                  <p className="text-xs">Sin hitos. Crea el primero.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {milestones.map(m => (
                    <div
                      key={m.id}
                      onClick={() => seleccionarMilestone(m)}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        selected?.id === m.id
                          ? 'border-red-700 bg-red-950/20'
                          : 'border-zinc-800 hover:border-zinc-600 bg-zinc-900/40'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center font-black text-sm">
                        {m.sello_objetivo}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{m.nombre}</p>
                        <p className="text-zinc-500 text-[10px]">
                          {m.milestone_prizes?.length || 0} premios · {m.activo ? '✅ Activo' : '⏸ Inactivo'}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={e => { e.stopPropagation(); toggleMilestone(m) }}
                          className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                          title={m.activo ? 'Desactivar' : 'Activar'}
                        >
                          <RotateCcw size={12} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); eliminarMilestone(m.id) }}
                          className="p-1.5 rounded-lg hover:bg-red-900/40 text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                        <ChevronRight size={14} className="text-zinc-600 self-center" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Crear nuevo hito */}
              <div className="border-t border-zinc-800 pt-4 space-y-3">
                <p className="text-[10px] text-zinc-500 uppercase font-black">Nuevo Hito</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-zinc-600 uppercase block mb-1">Sello N°</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={nuevoSello}
                      onChange={e => setNuevoSello(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm text-center font-black focus:outline-none focus:border-red-700"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-600 uppercase block mb-1">Nombre (opcional)</label>
                    <input
                      type="text"
                      value={nuevoNombre}
                      onChange={e => setNuevoNombre(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-700"
                      placeholder="Premio Sello 5"
                    />
                  </div>
                </div>
                <button
                  onClick={crearMilestone}
                  disabled={guardando || !nuevoSello}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-700 to-red-900 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all"
                >
                  <Plus size={14} />
                  Crear Hito
                </button>
              </div>
            </div>
          </div>

          {/* Panel derecho: Premios del hito seleccionado */}
          <div className="space-y-4">
            {!selected ? (
              <div className="bg-[#141414] border border-zinc-800 rounded-2xl p-8 flex items-center justify-center h-full">
                <div className="text-center text-zinc-600">
                  <p className="text-4xl mb-3">👈</p>
                  <p className="text-sm font-bold">Selecciona un hito</p>
                  <p className="text-xs mt-1">para configurar su pool de premios</p>
                </div>
              </div>
            ) : (
              <div className="bg-[#141414] border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-black">Premios — Sello {selected.sello_objetivo}</h2>
                    <p className="text-zinc-500 text-[10px] mt-0.5">{selected.nombre}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-black border ${
                    probTotal === 100
                      ? 'border-green-700 bg-green-950/30 text-green-400'
                      : probTotal > 100
                        ? 'border-red-700 bg-red-950/30 text-red-400'
                        : 'border-amber-700 bg-amber-950/30 text-amber-400'
                  }`}>
                    {probTotal}% / 100%
                  </div>
                </div>

                {/* Lista de premios */}
                <div className="space-y-2">
                  {prizes.length === 0 && (
                    <p className="text-zinc-600 text-xs text-center py-4">Sin premios — agrega al menos 1</p>
                  )}
                  {prizes.map(p => (
                    <div key={p.id} className={`p-3 rounded-xl border ${TIER_COLORS[p.tier] || 'border-zinc-700'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-zinc-400">{TIER_LABELS[p.tier]}</span>
                          <span className="font-bold text-sm">{p.nombre}</span>
                        </div>
                        <button
                          onClick={() => eliminarPrize(p.id)}
                          className="p-1 rounded-lg hover:bg-red-900/40 text-zinc-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <label className="text-[9px] text-zinc-600 uppercase">Prob %</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={p.probabilidad}
                          onChange={e => updateProbabilidad(p.id, parseInt(e.target.value) || 0)}
                          className="w-16 bg-black border border-zinc-700 rounded-lg px-2 py-1 text-white text-xs text-center font-black focus:outline-none"
                        />
                        <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all"
                            style={{ width: `${Math.min(p.probabilidad, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Preview ruleta */}
                {prizes.length > 0 && (
                  <div className="border-t border-zinc-800 pt-4">
                    <p className="text-[10px] text-zinc-500 uppercase font-black mb-3">Preview Ruleta</p>
                    <div className="relative w-36 h-36 mx-auto">
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        {(() => {
                          const colors = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899']
                          let start = 0
                          return prizes.map((p, i) => {
                            const pct = p.probabilidad / 100
                            const startAngle = start * 2 * Math.PI
                            const endAngle = (start + pct) * 2 * Math.PI
                            const x1 = 50 + 45 * Math.cos(startAngle - Math.PI / 2)
                            const y1 = 50 + 45 * Math.sin(startAngle - Math.PI / 2)
                            const x2 = 50 + 45 * Math.cos(endAngle - Math.PI / 2)
                            const y2 = 50 + 45 * Math.sin(endAngle - Math.PI / 2)
                            const large = pct > 0.5 ? 1 : 0
                            start += pct
                            return (
                              <path
                                key={p.id}
                                d={`M 50 50 L ${x1.toFixed(2)} ${y1.toFixed(2)} A 45 45 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`}
                                fill={colors[i % colors.length]}
                                stroke="#0a0a0a"
                                strokeWidth="1"
                              />
                            )
                          })
                        })()}
                        <circle cx="50" cy="50" r="12" fill="#0a0a0a" stroke="#3f3f46" strokeWidth="1" />
                        <text x="50" y="54" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">VIP</text>
                      </svg>
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 text-red-500 text-xl">▼</div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-3 justify-center">
                      {prizes.map((p, i) => (
                        <span key={p.id} className="text-[9px] px-2 py-0.5 rounded-full font-black text-white"
                          style={{ backgroundColor: ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6'][i % 5] }}>
                          {p.nombre} ({p.probabilidad}%)
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Agregar premio */}
                <div className="border-t border-zinc-800 pt-4 space-y-3">
                  <p className="text-[10px] text-zinc-500 uppercase font-black">Agregar Premio</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[9px] text-zinc-600 uppercase block mb-1">Tier</label>
                      <select
                        value={nuevoPrize.tier}
                        onChange={e => setNuevoPrize(p => ({ ...p, tier: e.target.value }))}
                        className="w-full bg-black border border-zinc-800 rounded-lg px-2 py-2 text-white text-xs focus:outline-none"
                      >
                        <option value="base">🥉 Base</option>
                        <option value="medio">🥈 Medio</option>
                        <option value="grande">🥇 Grande</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-600 uppercase block mb-1">Premio</label>
                      <input
                        type="text"
                        value={nuevoPrize.nombre}
                        onChange={e => setNuevoPrize(p => ({ ...p, nombre: e.target.value }))}
                        className="w-full bg-black border border-zinc-800 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-red-700"
                        placeholder="Refresco"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-600 uppercase block mb-1">Prob %</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={nuevoPrize.probabilidad}
                        onChange={e => setNuevoPrize(p => ({ ...p, probabilidad: e.target.value }))}
                        className="w-full bg-black border border-zinc-800 rounded-lg px-2 py-2 text-white text-xs text-center font-black focus:outline-none"
                      />
                    </div>
                  </div>
                  <button
                    onClick={agregarPrize}
                    disabled={guardando || !nuevoPrize.nombre || probTotal >= 100}
                    className="w-full flex items-center justify-center gap-2 bg-amber-800 hover:bg-amber-700 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-widest disabled:opacity-40 transition-all"
                  >
                    <Plus size={14} />
                    Agregar Premio ({100 - probTotal}% disponible)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
