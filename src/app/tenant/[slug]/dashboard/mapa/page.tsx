'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, RefreshCw, BarChart3 } from 'lucide-react'

interface OrderPoint {
  colonia: string
  calle: string
  total: number
  created_at: string
}

interface ColoniaStats {
  colonia: string
  pedidos: number
  total_mxn: number
  densidad: number  // 0-100
}

export default function MapaPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [businessId, setBusinessId] = useState('')
  const [centerLat, setCenterLat] = useState(19.421583)
  const [centerLng, setCenterLng] = useState(-102.067222)
  const [orders, setOrders] = useState<OrderPoint[]>([])
  const [colonias, setColonias] = useState<ColoniaStats[]>([])
  const [cargando, setCargando] = useState(true)
  const [periodo, setPeriodo] = useState<'7' | '30' | '90'>('30')
  const [totalPedidos, setTotalPedidos] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)

  const getCookie = (n: string) => typeof document !== 'undefined' ? (document.cookie.match(new RegExp(`${n}=([^;]+)`))?.[1] || '') : ''

  useEffect(() => {
    const init = async () => {
      let bId = getCookie('session_business_id')
      if (!bId) {
        const { data } = await supabase.from('businesses').select('id, latitude, longitude').eq('slug', slug).single()
        if (data) {
          bId = data.id
          if (data.latitude) setCenterLat(Number(data.latitude))
          if (data.longitude) setCenterLng(Number(data.longitude))
        }
      } else {
        const { data } = await supabase.from('businesses').select('latitude, longitude').eq('id', bId).single()
        if (data) {
          if (data.latitude) setCenterLat(Number(data.latitude))
          if (data.longitude) setCenterLng(Number(data.longitude))
        }
      }
      setBusinessId(bId)
    }
    init()
  }, [slug])

  useEffect(() => {
    if (!businessId) return
    cargarDatos()
  }, [businessId, periodo])

  const cargarDatos = async () => {
    setCargando(true)
    const desde = new Date()
    desde.setDate(desde.getDate() - parseInt(periodo))

    const { data } = await supabase
      .from('orders')
      .select('colonia, calle, total, created_at')
      .eq('business_id', businessId)
      .eq('tipo', 'delivery')
      .gte('created_at', desde.toISOString())
      .order('created_at', { ascending: false })
      .limit(500)

    if (data) {
      setOrders(data as OrderPoint[])
      setTotalPedidos(data.length)
      setTotalRevenue(data.reduce((s, o) => s + (o.total || 0), 0))

      // Agrupar por colonia
      const map = new Map<string, { pedidos: number; total: number }>()
      data.forEach(o => {
        const col = (o.colonia || 'Sin Colonia').trim()
        if (!map.has(col)) map.set(col, { pedidos: 0, total: 0 })
        const v = map.get(col)!
        v.pedidos++
        v.total += o.total || 0
      })

      const arr = Array.from(map.entries())
        .map(([colonia, stats]) => ({
          colonia,
          pedidos: stats.pedidos,
          total_mxn: stats.total,
          densidad: 0
        }))
        .sort((a, b) => b.pedidos - a.pedidos)

      const maxPedidos = Math.max(...arr.map(a => a.pedidos), 1)
      arr.forEach(a => { a.densidad = Math.round((a.pedidos / maxPedidos) * 100) })

      setColonias(arr)
    }
    setCargando(false)
  }

  // Dibujar heatmap sobre canvas
  useEffect(() => {
    if (!canvasRef.current || colonias.length === 0) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Simulamos puntos de calor en el canvas sobre el mapa iframe
    // Distribuimos los puntos en base a la densidad relativa de cada colonia
    // Los centros son generados pseudo-aleatoriamente pero deterministicamente por colonia
    const seed = (str: string) => {
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i)
        hash |= 0
      }
      return Math.abs(hash)
    }

    colonias.slice(0, 15).forEach(col => {
      const s = seed(col.colonia)
      const cx = ((s % 80) / 100 + 0.1) * canvas.width
      const cy = (((s * 7919) % 80) / 100 + 0.1) * canvas.height
      const radio = 20 + (col.densidad / 100) * 60

      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radio)
      const alpha = 0.15 + (col.densidad / 100) * 0.5

      if (col.densidad > 70) {
        gradient.addColorStop(0, `rgba(239, 68, 68, ${alpha})`)
        gradient.addColorStop(0.4, `rgba(251, 191, 36, ${alpha * 0.6})`)
        gradient.addColorStop(1, 'rgba(0,0,0,0)')
      } else if (col.densidad > 40) {
        gradient.addColorStop(0, `rgba(251, 191, 36, ${alpha})`)
        gradient.addColorStop(0.5, `rgba(251, 191, 36, ${alpha * 0.4})`)
        gradient.addColorStop(1, 'rgba(0,0,0,0)')
      } else {
        gradient.addColorStop(0, `rgba(59, 130, 246, ${alpha})`)
        gradient.addColorStop(0.6, `rgba(59, 130, 246, ${alpha * 0.3})`)
        gradient.addColorStop(1, 'rgba(0,0,0,0)')
      }

      ctx.beginPath()
      ctx.arc(cx, cy, radio, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()
    })
  }, [colonias])

  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${centerLng - 0.05}%2C${centerLat - 0.04}%2C${centerLng + 0.05}%2C${centerLat + 0.04}&layer=mapnik&marker=${centerLat}%2C${centerLng}`

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white font-sans p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-zinc-500 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black">🔥 Radar de Pedidos</h1>
            <p className="text-zinc-500 text-xs uppercase tracking-widest mt-1">Heatmap Geo-Intelligence · Últimos {periodo} días</p>
          </div>
          <button
            onClick={cargarDatos}
            className="ml-auto text-zinc-500 hover:text-white transition-colors"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Pedidos Delivery', valor: totalPedidos, color: 'text-white' },
            { label: 'Revenue Total', valor: `$${totalRevenue.toLocaleString()}`, color: 'text-amber-400' },
            { label: 'Zonas Activas', valor: colonias.length, color: 'text-red-400' },
          ].map((k, i) => (
            <div key={i} className="bg-[#141414] border border-zinc-800 rounded-2xl p-4">
              <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">{k.label}</p>
              <p className={`text-2xl font-black mt-1 ${k.color}`}>{k.valor}</p>
            </div>
          ))}
        </div>

        {/* Selector de periodo */}
        <div className="flex gap-2">
          <p className="text-zinc-500 text-xs self-center font-black uppercase tracking-widest mr-2">Período:</p>
          {(['7', '30', '90'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${
                periodo === p
                  ? 'border-red-700 bg-red-950/30 text-red-400'
                  : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'
              }`}
            >
              {p} días
            </button>
          ))}
        </div>

        {/* Mapa + Heatmap Canvas */}
        <div className="relative rounded-2xl overflow-hidden border border-zinc-800" style={{ height: '380px' }}>
          <iframe
            src={mapUrl}
            className="w-full h-full border-0"
            loading="lazy"
            title="Mapa de Pedidos"
          />
          {/* Canvas overlay para el heatmap */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ mixBlendMode: 'screen' }}
          />
          {/* Leyenda */}
          <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-sm border border-zinc-800 rounded-xl p-3 text-xs space-y-1">
            <p className="text-zinc-400 font-black uppercase text-[9px] mb-2">Densidad de Pedidos</p>
            {[
              { color: 'bg-red-500', label: 'Alta densidad' },
              { color: 'bg-amber-400', label: 'Media densidad' },
              { color: 'bg-blue-500', label: 'Baja densidad' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${l.color} opacity-70`} />
                <span className="text-zinc-400 text-[9px]">{l.label}</span>
              </div>
            ))}
          </div>
          {/* Badge pin central */}
          <div className="absolute top-3 right-3 bg-black/80 border border-zinc-700 rounded-xl px-3 py-2">
            <div className="flex items-center gap-2">
              <MapPin size={12} className="text-red-500" />
              <span className="text-xs font-bold text-white">Tu Negocio</span>
            </div>
          </div>
        </div>

        {/* Tabla Top Colonias */}
        <div className="bg-[#141414] border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
            <BarChart3 size={16} className="text-red-500" />
            <h2 className="text-sm font-black">Top Zonas por Pedidos</h2>
          </div>
          {cargando ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-zinc-800 border-t-red-600 rounded-full animate-spin" />
            </div>
          ) : colonias.length === 0 ? (
            <div className="text-center py-12 text-zinc-600">
              <p className="text-3xl mb-2">📍</p>
              <p className="text-sm">Sin pedidos delivery en este período</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-900">
              {colonias.slice(0, 10).map((col, i) => (
                <div key={col.colonia} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black" style={{
                    background: i === 0 ? '#7f1d1d' : i === 1 ? '#78350f' : i === 2 ? '#1e3a5f' : '#1a1a1a',
                    color: i < 3 ? 'white' : '#71717a'
                  }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{col.colonia}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${col.densidad}%`,
                            background: col.densidad > 70 ? '#ef4444' : col.densidad > 40 ? '#f59e0b' : '#3b82f6'
                          }}
                        />
                      </div>
                      <span className="text-zinc-600 text-[9px] font-bold w-8 text-right">{col.densidad}%</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-black text-sm">{col.pedidos} pedidos</p>
                    <p className="text-amber-400 text-xs font-bold">${col.total_mxn.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
