'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Send, TrendingUp, Users, Clock } from 'lucide-react'

interface ClienteRFM {
  cliente_id: string
  nombre: string
  telefono: string
  total_gastado: number
  total_visitas: number
  ultimo_pedido: string | null
  dias_inactivo: number
  puntos: number
  segmento: 'whale' | 'hot' | 'riesgo' | 'perdido'
}

function calcSegmento(diasInactivo: number, totalGastado: number): ClienteRFM['segmento'] {
  if (diasInactivo <= 7 && totalGastado > 500) return 'whale'
  if (diasInactivo <= 14) return 'hot'
  if (diasInactivo <= 30) return 'riesgo'
  return 'perdido'
}

const SEG_CONFIG = {
  whale:   { label: '🐳 Whale',    color: 'text-cyan-400',   bg: 'bg-cyan-950/30 border-cyan-800' },
  hot:     { label: '🔥 Hot',      color: 'text-orange-400', bg: 'bg-orange-950/30 border-orange-800' },
  riesgo:  { label: '😴 At-Risk',  color: 'text-amber-400',  bg: 'bg-amber-950/30 border-amber-800' },
  perdido: { label: '💀 Lost',     color: 'text-red-400',    bg: 'bg-red-950/30 border-red-800' },
}

export default function MetricsPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [businessId, setBusinessId] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [clientes, setClientes] = useState<ClienteRFM[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | ClienteRFM['segmento']>('todos')
  const [msgPromo, setMsgPromo] = useState('¡Hola {nombre}! 🎁 Tienes {puntos} sellos en {negocio}. ¡Te esperamos para que reclames tu premio!')

  const getCookie = (n: string) => typeof document !== 'undefined' ? (document.cookie.match(new RegExp(`${n}=([^;]+)`))?.[1] || '') : ''

  useEffect(() => {
    const init = async () => {
      let bId = getCookie('session_business_id')
      if (!bId) {
        const { data } = await supabase.from('businesses').select('id, nombre').eq('slug', slug).single()
        if (data) { bId = data.id; setBusinessName(data.nombre) }
      } else {
        const { data } = await supabase.from('businesses').select('nombre').eq('id', bId).single()
        if (data) setBusinessName(data.nombre)
      }
      setBusinessId(bId)
    }
    init()
  }, [slug])

  useEffect(() => {
    if (!businessId) return
    cargarRFM()
  }, [businessId])

  const cargarRFM = async () => {
    setCargando(true)

    // Fetch clientes con sus datos agregados
    const { data: clientesData } = await supabase
      .from('clientes')
      .select('id, nombre, telefono, puntos, total_gastado, visitas, ultima_visita')
      .eq('business_id', businessId)
      .order('total_gastado', { ascending: false })
      .limit(50)

    if (!clientesData) { setCargando(false); return }

    // Para cada cliente, buscar su último pedido aprobado
    const enriched: ClienteRFM[] = await Promise.all(
      clientesData.map(async (c) => {
        const { data: lastOrder } = await supabase
          .from('orders')
          .select('created_at, total')
          .eq('cliente_id', c.id)
          .eq('sello_aprobado', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const diasInactivo = lastOrder
          ? Math.floor((Date.now() - new Date(lastOrder.created_at).getTime()) / 86400000)
          : 999

        return {
          cliente_id: c.id,
          nombre: c.nombre,
          telefono: c.telefono,
          total_gastado: c.total_gastado || 0,
          total_visitas: c.visitas || 0,
          ultimo_pedido: lastOrder?.created_at || null,
          dias_inactivo: diasInactivo,
          puntos: c.puntos || 0,
          segmento: calcSegmento(diasInactivo, c.total_gastado || 0),
        }
      })
    )

    // Ordenar por total_gastado desc, limitar a 25
    setClientes(enriched.sort((a, b) => b.total_gastado - a.total_gastado).slice(0, 25))
    setCargando(false)
  }

  const enviarPromo = (c: ClienteRFM) => {
    const tel = '52' + c.telefono.replace(/\D/g, '').slice(-10)
    const msg = msgPromo
      .replace('{nombre}', c.nombre)
      .replace('{puntos}', String(c.puntos))
      .replace('{negocio}', businessName)
    const url = `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  const clientesFiltrados = filtro === 'todos'
    ? clientes
    : clientes.filter(c => c.segmento === filtro)

  // Métricas generales
  const totalGastado = clientes.reduce((s, c) => s + c.total_gastado, 0)
  const promedioGastado = clientes.length > 0 ? totalGastado / clientes.length : 0
  const whales = clientes.filter(c => c.segmento === 'whale').length
  const enRiesgo = clientes.filter(c => c.segmento === 'riesgo' || c.segmento === 'perdido').length

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white font-sans p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-zinc-500 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black">🐳 RFM — Whale Hunter</h1>
            <p className="text-zinc-500 text-xs uppercase tracking-widest mt-1">
              Segmentación de Clientes · Recency · Frequency · Monetary
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Clientes', valor: clientes.length, icon: <Users size={16} />, color: 'text-white' },
            { label: 'Whales', valor: whales, icon: '🐳', color: 'text-cyan-400' },
            { label: 'En Riesgo', valor: enRiesgo, icon: '⚠️', color: 'text-amber-400' },
            { label: 'Ticket Prom.', valor: `$${promedioGastado.toFixed(0)}`, icon: <TrendingUp size={16} />, color: 'text-green-400' },
          ].map((k, i) => (
            <div key={i} className="bg-[#141414] border border-zinc-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-zinc-500 mb-2">
                {typeof k.icon === 'string' ? <span>{k.icon}</span> : k.icon}
                <p className="text-[10px] uppercase font-black tracking-widest">{k.label}</p>
              </div>
              <p className={`text-2xl font-black ${k.color}`}>{k.valor}</p>
            </div>
          ))}
        </div>

        {/* Configurar Mensaje Promo */}
        <div className="bg-[#141414] border border-zinc-800 rounded-2xl p-4 space-y-2">
          <p className="text-[10px] text-zinc-500 uppercase font-black">Mensaje VIP Promo (WhatsApp)</p>
          <p className="text-[9px] text-zinc-600">Variables: {'{nombre}'}, {'{puntos}'}, {'{negocio}'}</p>
          <textarea
            value={msgPromo}
            onChange={e => setMsgPromo(e.target.value)}
            rows={2}
            className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none resize-none"
          />
        </div>

        {/* Filtros de Segmento */}
        <div className="flex flex-wrap gap-2">
          {(['todos', 'whale', 'hot', 'riesgo', 'perdido'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                filtro === f
                  ? 'border-red-700 bg-red-950/30 text-red-400'
                  : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'
              }`}
            >
              {f === 'todos' ? `Todos (${clientes.length})` : SEG_CONFIG[f].label + ` (${clientes.filter(c => c.segmento === f).length})`}
            </button>
          ))}
        </div>

        {/* Tabla */}
        {cargando ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-zinc-800 border-t-red-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-[#141414] border border-zinc-800 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  {['#', 'Cliente', 'Total $', 'Visitas', 'Última Vista', 'Segmento', 'Acción'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[9px] text-zinc-500 uppercase font-black tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {clientesFiltrados.map((c, i) => {
                  const seg = SEG_CONFIG[c.segmento]
                  return (
                    <tr key={c.cliente_id} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="px-4 py-3 text-zinc-600 text-sm font-bold">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-sm">{c.nombre}</p>
                        <p className="text-zinc-500 text-xs font-mono">{c.telefono}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-amber-400 font-black">${c.total_gastado.toLocaleString()}</p>
                      </td>
                      <td className="px-4 py-3 text-zinc-300 text-sm font-bold">{c.total_visitas}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Clock size={10} className="text-zinc-600" />
                          <p className="text-zinc-400 text-xs">
                            {c.ultimo_pedido
                              ? `${c.dias_inactivo}d atrás`
                              : 'Sin pedidos'}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${seg.bg} ${seg.color}`}>
                          {seg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => enviarPromo(c)}
                          className="flex items-center gap-1.5 bg-green-900/40 hover:bg-green-800/60 border border-green-800 text-green-400 hover:text-white font-black px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider transition-all"
                        >
                          <Send size={10} />
                          Promo VIP
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {clientesFiltrados.length === 0 && (
              <div className="text-center py-12 text-zinc-600">
                <p className="text-3xl mb-2">📊</p>
                <p className="text-sm">Sin clientes en este segmento</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
