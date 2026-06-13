'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { UtensilsCrossed, Bell, CreditCard, X, Gift, RotateCcw, Send, Lock, MapPin, Clock, Share2, Star, Truck, Check } from 'lucide-react'

// ── Interfaces ────────────────────────────────────────────────────────────────
interface Premio { id: string; nombre: string; estampillas_requeridas: number; imagen_url?: string }
interface MenuGroup { id: string; nombre: string; descripcion: string; tipo_menu: string; activo: boolean; orden: number }
interface MenuProduct {
  id: string; group_id: string; nombre: string; descripcion: string
  precio: number; imagen_url: string; disponible: boolean; es_upsell?: boolean
  product_modifiers?: ModifierGroup[]
  suspension_tipo?: string
  suspension_hasta?: string
}
interface ModifierGroup { id: string; nombre: string; requerido: boolean; incluidos?: number; maximo_permitido?: number | null; modifier_options: ModifierOption[] }
interface ModifierOption { id: string; nombre: string; precio_extra: number; disponible?: boolean }
interface CartItem { product: MenuProduct; cantidad: number; selecciones: Record<string, any>; subtotal: number }

// Helper para renderizar el icono de sello según la configuración
function RenderIconoSello({ icono, size = 'w-8 h-8' }: { icono: string, size?: string }) {
  if (icono === 'burrito') {
    const svgSize = size.includes('w-5.5') ? 'w-5.5 h-5.5' : 'w-8 h-8';
    return (
      <svg className={svgSize} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="14" y="10" width="36" height="44" rx="18" fill="#FDE047" stroke="#CA8A04" strokeWidth="2.5" />
        <path d="M15 24 C 20 28, 44 28, 49 24 C 47 18, 17 18, 15 24 Z" fill="#B45309" />
        <path d="M20 20 C 25 24, 39 24, 44 20 C 42 16, 22 16, 20 20 Z" fill="#22C55E" />
        <path d="M26 17 C 28 20, 36 20, 38 17 C 37 14, 27 14, 26 17 Z" fill="#EF4444" />
        <path d="M15 32 C 22 36, 42 34, 49 32" stroke="#CA8A04" strokeWidth="2" strokeLinecap="round" />
        <path d="M15 42 C 20 46, 44 44, 49 42" stroke="#CA8A04" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (icono === 'gift') {
    return <Gift className={`${size} text-rose-500 fill-rose-100 animate-pulse`} />
  }
  return <Star className={`${size} text-amber-500 fill-amber-300`} />
}

function DeliveryCountdown({ scheduledTime, onExpire }: { scheduledTime: string; onExpire?: () => void }) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const calculateTime = () => {
      const difference = new Date(scheduledTime).getTime() - Date.now()
      if (difference <= 0) {
        setTimeLeft('00:00')
        if (onExpire) onExpire()
        return
      }
      const totalSeconds = Math.floor(difference / 1000)
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = totalSeconds % 60
      const formattedMin = String(minutes).padStart(2, '0')
      const formattedSec = String(seconds).padStart(2, '0')
      setTimeLeft(`${formattedMin}:${formattedSec}`)
    }

    calculateTime()
    const timer = setInterval(calculateTime, 1000)
    return () => clearInterval(timer)
  }, [scheduledTime])

  return (
    <span className="font-mono font-extrabold text-sm text-[#09090b] tracking-wider bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded-lg shadow-sm">
      {timeLeft}
    </span>
  )
}

// ── Ruleta VIP ────────────────────────────────────────────────────────────────
function RuletaVIP({
  premios,
  business,
  cliente,
  onCerrar,
  onResetPuntos,
}: {
  premios: Premio[]
  business: any
  cliente: any
  onCerrar: () => void
  onResetPuntos: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [girando, setGirando] = useState(false)
  const [premioGanado, setPremioGanado] = useState<Premio | null>(null)
  const [anguloActual, setAnguloActual] = useState(0)
  const animRef = useRef<number | undefined>(undefined)
 
  const premiosList = (business?.premios_ruleta && Array.isArray(business.premios_ruleta) && business.premios_ruleta.length > 0)
    ? business.premios_ruleta.map((p: string, i: number) => ({ id: String(i), nombre: p, estampillas_requeridas: 10 }))
    : (premios.length > 0 ? premios : [
        { id: '1', nombre: 'Café Gratis', estampillas_requeridas: 10 },
        { id: '2', nombre: 'Postre Sorpresa', estampillas_requeridas: 10 },
        { id: '3', nombre: 'Bebida Grande', estampillas_requeridas: 10 },
        { id: '4', nombre: '20% Descuento', estampillas_requeridas: 10 },
      ])
 
  const COLORES = ['#dc2626', '#ef4444', '#b91c1c', '#991b1b', '#f87171', '#fca5a5']
 
  const dibujarRuleta = (angulo: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
 
    const cx = canvas.width / 2
    const cy = canvas.height / 2
    const radio = cx - 8
    const n = premiosList.length
    const arcAngle = (2 * Math.PI) / n
 
    ctx.clearRect(0, 0, canvas.width, canvas.height)
 
    // Sombra exterior
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, radio + 4, 0, 2 * Math.PI)
    ctx.shadowColor = 'rgba(0,0,0,0.15)'
    ctx.shadowBlur = 20
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.restore()
 
    premiosList.forEach((premio: any, i: number) => {
      const startAngle = angulo + i * arcAngle - Math.PI / 2
      const endAngle = startAngle + arcAngle
 
      // Sector
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, radio, startAngle, endAngle)
      ctx.closePath()
      ctx.fillStyle = COLORES[i % COLORES.length]
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.stroke()
 
      // Texto del premio
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(startAngle + arcAngle / 2)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${Math.min(13, 80 / n)}px Inter, sans-serif`
      ctx.shadowColor = 'rgba(0,0,0,0.3)'
      ctx.shadowBlur = 4
 
      const maxLen = 14
      const txt = premio.nombre.length > maxLen ? premio.nombre.substring(0, maxLen) + '…' : premio.nombre
      ctx.fillText(txt, radio - 14, 5)
      ctx.restore()
    })
 
    // Centro
    ctx.beginPath()
    ctx.arc(cx, cy, 28, 0, 2 * Math.PI)
    ctx.fillStyle = '#ffffff'
    ctx.shadowColor = 'rgba(0,0,0,0.2)'
    ctx.shadowBlur = 10
    ctx.fill()
    ctx.strokeStyle = '#f0f0f0'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#dc2626'
    ctx.font = 'bold 13px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('VIP', cx, cy)
 
    // Flecha indicadora (arriba)
    ctx.beginPath()
    ctx.moveTo(cx - 12, cy - radio - 4)
    ctx.lineTo(cx + 12, cy - radio - 4)
    ctx.lineTo(cx, cy - radio + 18)
    ctx.closePath()
    ctx.fillStyle = '#dc2626'
    ctx.fill()
  }
 
  useEffect(() => {
    dibujarRuleta(anguloActual)
  }, [anguloActual, premiosList.length])
 
  const girar = () => {
    if (girando || premioGanado) return
    setGirando(true)
 
    const n = premiosList.length
    const arcAngle = (2 * Math.PI) / n
    const idxGanador = Math.floor(Math.random() * n)
    const vueltasExtra = 5 + Math.floor(Math.random() * 3)
    const anguloObjetivo = vueltasExtra * 2 * Math.PI + (2 * Math.PI - idxGanador * arcAngle)
    const anguloInicial = anguloActual
    const duracion = 4500
    const inicio = performance.now()
 
    const animar = (ahora: number) => {
      const elapsed = ahora - inicio
      const t = Math.min(elapsed / duracion, 1)
      const eased = 1 - Math.pow(1 - t, 4)
      const angulo = anguloInicial + anguloObjetivo * eased
      setAnguloActual(angulo)
      dibujarRuleta(angulo)
 
      if (t < 1) {
        animRef.current = requestAnimationFrame(animar)
      } else {
        setGirando(false)
        setPremioGanado(premiosList[idxGanador])
      }
    }
 
    animRef.current = requestAnimationFrame(animar)
  }
 
  useEffect(() => {
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [])
 
  const enviarPorWhatsApp = async () => {
    if (!premioGanado) return
    
    // 1. Resetear sellos en Supabase si la regla está activa
    const resetActivo = business?.reiniciar_sellos_ruleta !== false
    if (resetActivo) {
      try {
        await supabase
          .from('clientes')
          .update({ puntos: 0 })
          .eq('id', cliente.id)
        
        onResetPuntos()
      } catch (e) {
        console.error('[Ruleta] Error al resetear puntos:', e)
      }
    }
 
    // 2. Registrar en premios_canjes
    try {
      await supabase
        .from('premios_canjes')
        .insert({
          cliente_id: cliente.id,
          premio_nombre: premioGanado.nombre,
          estado: 'Pendiente'
        })
    } catch (e) {
      console.error('[Ruleta] Error al guardar premios_canjes:', e)
    }
 
    // 3. Abrir WhatsApp con mensaje simplificado sin IDs extensos
    const tel = '52' + (business?.telefono_whatsapp || '').replace(/\D/g, '').slice(-10)
    const msg = `¡Hola! Quiero cobrar mi premio ganado en la Ruleta LoyaltyClub: ${premioGanado.nombre}`
    const url = `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
    onCerrar()
  }
 
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="relative p-6 pb-3 border-b border-[#f0f0f0]">
          <button onClick={onCerrar} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#fafafa] hover:bg-[#f4f4f5] flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-[#71717a]" />
          </button>
          <div className="text-center">
            <div className="text-3xl mb-1">🎰</div>
            <h2 className="text-lg font-bold text-[#09090b] tracking-tight">¡Ruleta de Premios VIP!</h2>
            <p className="text-xs text-[#71717a] mt-0.5">¡Has completado tu tarjeta! Gira para ganar</p>
          </div>
        </div>
 
        {/* Ruleta Canvas */}
        <div className="p-6 flex flex-col items-center gap-5">
          {!premioGanado ? (
            <>
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  width={280}
                  height={280}
                  className="rounded-full"
                  style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.12))' }}
                />
              </div>
              <button
                onClick={girar}
                disabled={girando}
                className={`btn-primary w-full py-4 text-sm flex items-center justify-center gap-2 ${girando ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <RotateCcw className={`w-5 h-5 ${girando ? 'animate-spin' : ''}`} />
                {girando ? 'Girando...' : '¡Girar Ruleta!'}
              </button>
            </>
          ) : (
            // Modal del premio ganado
            <div className="w-full text-center animate-slideUp">
              {/* Logo negocio */}
              {business?.logo_url && (
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl overflow-hidden border-2 border-[#dc2626] shadow-md">
                  <img src={business.logo_url} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="text-4xl mb-3">🏆</div>
              <p className="text-xs font-semibold text-[#dc2626] uppercase tracking-wider mb-1">¡Felicidades! Tu Premio Es:</p>
              <h3 className="text-2xl font-bold text-[#09090b] tracking-tight mb-2">{premioGanado.nombre}</h3>
              <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-2xl p-4 mb-5">
                <p className="text-xs text-[#71717a]">Premio ganado en la Ruleta VIP de</p>
                <p className="font-bold text-[#09090b]">{business?.nombre || 'LoyaltyClub'}</p>
                <p className="text-[10px] text-[#a1a1aa] font-mono mt-1">ID: {cliente.id.substring(0, 12)}</p>
              </div>
              <button
                onClick={enviarPorWhatsApp}
                className="btn-primary w-full py-4 text-sm flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Enviar para Cobrar Premio
              </button>
              <button onClick={onCerrar} className="mt-3 text-xs text-[#a1a1aa] hover:text-[#71717a] transition-colors">
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Componente Principal ───────────────────────────────────────────────────────
export default function TarjetaLealtadFinal() {
  const { id } = useParams()
  const router = useRouter()
  const [cliente, setCliente] = useState<any>(null)
  const [activeOrder, setActiveOrder] = useState<any>(null)
  const [business, setBusiness] = useState<any>(null)
  const [premios, setPremios] = useState<Premio[]>([])
  const [cargando, setCargando] = useState(true)
  const [activeCoupon, setActiveCoupon] = useState<any>(null)
  const [generandoPremio, setGenerandoPremio] = useState(false)

  const [generandoGoogle, setGenerandoGoogle] = useState(false)
  const [generandoApple, setGenerandoApple] = useState(false)

  const [vistaActiva, setVistaActiva] = useState<'tarjeta' | 'menu' | 'pedido' | 'ubicacion' | 'horarios' | 'redes'>('tarjeta')
  const [mostrarRuleta, setMostrarRuleta] = useState(false)
  const [menuDigital, setMenuDigital] = useState<any>(null)
  const [ultimoPedidoTotal, setUltimoPedidoTotal] = useState<number>(0)
  const [programaActivo, setProgramaActivo] = useState<any>(null)

  const [linkFacebook, setLinkFacebook] = useState('')
  const [linkInstagram, setLinkInstagram] = useState('')
  const [linkTiktok, setLinkTiktok] = useState('')
  const [linkYoutube, setLinkYoutube] = useState('')
  const [horarioSemanal, setHorarioSemanal] = useState<any>(null)

  // ── Estados del Menú Interactivo ──
  const [tipoMenu] = useState<'mesa' | 'delivery'>('delivery')
  const [grupos, setGrupos] = useState<MenuGroup[]>([])
  const [productos, setProductos] = useState<MenuProduct[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [grupoActivo, setGrupoActivo] = useState<string>('')
  const [pasoMenu, setPasoMenu] = useState<'menu' | 'upsell' | 'checkout' | 'confirmado'>('menu')
  const [enviando, setEnviando] = useState(false)
  const [categoriasColapsadas, setCategoriasColapsadas] = useState<Record<string, boolean>>({})
  const [fueraDeHorario, setFueraDeHorario] = useState(false)
  const [horaAperturaHoy, setHoraAperturaHoy] = useState('14:00')
  const [horaCierreHoy, setHoraCierreHoy] = useState('22:00')

  // Modificadores
  const [productoSeleccionadoMod, setProductoSeleccionadoMod] = useState<MenuProduct | null>(null)
  const [seleccionesMod, setSeleccionesMod] = useState<Record<string, any>>({})

  // Formulario Checkout
  const [form, setForm] = useState({ nombre: '', telefono: '', calle: '', numero: '', colonia: '', referencia: '' })
  const [mapaCargado, setMapaCargado] = useState(false)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [coordenadasPin, setCoordenadasPin] = useState<{ lat: number; lng: number } | null>(null)
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia'>('efectivo')
  const [telefonoAutocompletar, setTelefonoAutocompletar] = useState('')
  const [mostrandoAutocompletar, setMostrandoAutocompletar] = useState(false)
  const [buscandoAutocompletar, setBuscandoAutocompletar] = useState(false)
  
  const [clienteExistente, setClienteExistente] = useState<any>(null)
  const [orderId, setOrderId] = useState('')
  const [confeti, setConfeti] = useState(false)

  const getBaseUrl = () => {
    if (typeof window !== 'undefined') return window.location.origin
    if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
    return 'http://localhost:3000'
  }

  // Lógica matemática para verificar si está cerrado en base al horario semanal
  const verificarHorarioNegocio = (horario: any) => {
    if (!horario) return false
    const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
    const ahora = new Date()
    const diaActual = diasSemana[ahora.getDay()]
    
    const configDia = horario[diaActual]
    if (!configDia) return false
    if (configDia.cerrado) return true // Cerrado por descanso

    const apertura = configDia.apertura || '14:00'
    const cierre = configDia.cierre || '22:00'
    
    const horasActual = ahora.getHours()
    const minsActual = ahora.getMinutes()
    const tiempoActualMin = horasActual * 60 + minsActual
    
    const [hAp, mAp] = apertura.split(':').map(Number)
    const [hCi, mCi] = cierre.split(':').map(Number)
    const tiempoApMin = hAp * 60 + mAp
    const tiempoCiMin = hCi * 60 + mCi
    
    if (tiempoApMin <= tiempoCiMin) {
      return tiempoActualMin < tiempoApMin || tiempoActualMin > tiempoCiMin
    } else {
      // Cruce de medianoche
      return tiempoActualMin < tiempoApMin && tiempoActualMin > tiempoCiMin
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if ((window as any).L) {
      setMapaCargado(true)
      return
    }

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.async = true
    script.onload = () => {
      setMapaCargado(true)
    }
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!mapaCargado || typeof window === 'undefined') return
    const L = (window as any).L
    if (!L) return

    const stepCheckout = (pasoMenu === 'checkout')
    if (!stepCheckout || tipoMenu !== 'delivery') {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
      }
      return
    }

    const container = document.getElementById('mapa-cliente-checkout')
    if (!container) return

    if (mapRef.current) return

    const initialLat = business?.latitude || 19.421583
    const initialLng = business?.longitude || -102.067222

    const pinLat = coordenadasPin?.lat || initialLat
    const pinLng = coordenadasPin?.lng || initialLng

    if (!coordenadasPin) {
      setCoordenadasPin({ lat: initialLat, lng: initialLng })
    }

    const map = L.map('mapa-cliente-checkout').setView([pinLat, pinLng], 14)
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map)

    const marker = L.marker([pinLat, pinLng], { draggable: true }).addTo(map)
    markerRef.current = marker

    marker.on('dragend', (event: any) => {
      const position = event.target.getLatLng()
      setCoordenadasPin({ lat: position.lat, lng: position.lng })
    })

    setTimeout(() => {
      map.invalidateSize()
    }, 250)

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
      }
    }
  }, [mapaCargado, pasoMenu, tipoMenu, business])

  useEffect(() => {
    if (!cliente?.id) return

    const channel = supabase
      .channel(`active-order-updates-${cliente.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `cliente_id=eq.${cliente.id}`
        },
        (payload) => {
          const ord = payload.new as any
          if (ord && ord.tipo === 'delivery' && ['SHIPPED_SCHEDULED', 'SHIPPED_IMMEDIATE', 'DELIVERED', 'CANCELLED'].includes(ord.delivery_status)) {
            const dosHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000)
            if (new Date(ord.created_at) > dosHorasAtras) {
              setActiveOrder(ord)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [cliente?.id])

  useEffect(() => {
    const cargarDatos = async () => {
      if (!id) return
      const esUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)
      let query = supabase.from('clientes').select('*')
      if (esUUID) {
        query = query.eq('id', id)
      } else {
        query = query.or(`telefono.eq.${id},telefono.eq.52${id},telefono.eq.+52${id}`)
      }
      const { data: clienteData } = await query.maybeSingle()

      if (clienteData) {
        setCliente(clienteData)
        
        // Cargar pedido activo de delivery (creado en las últimas 2 horas con estado de pre-despacho)
        try {
          const dosHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
          const { data: ord } = await supabase
            .from('orders')
            .select('*')
            .eq('cliente_id', clienteData.id)
            .eq('tipo', 'delivery')
            .in('delivery_status', ['SHIPPED_SCHEDULED', 'SHIPPED_IMMEDIATE'])
            .gt('created_at', dosHorasAtras)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (ord) {
            setActiveOrder(ord)
          }
        } catch (err) {
          console.warn('Error al cargar pedido activo del cliente:', err)
        }
        setForm(prev => ({
          ...prev,
          nombre: clienteData.nombre || '',
          telefono: clienteData.telefono || ''
        }))
        setTelefonoAutocompletar(clienteData.telefono || '')
        if (clienteData.business_id) {
          const { data: bizData } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', clienteData.business_id)
            .maybeSingle()
          if (bizData) {
            setBusiness({ ...bizData, name: bizData.nombre })

            // Cargar redes sociales y horarios comerciales
            let linkFb = (bizData as any).link_facebook || ''
            let linkIg = (bizData as any).link_instagram || ''
            let linkTk = (bizData as any).link_tiktok || ''
            let linkYt = (bizData as any).link_youtube || ''
            let horarioSem = (bizData as any).horario_semanal || null

            if (bizData.direccion && bizData.direccion.includes('{')) {
              try {
                const jsonStart = bizData.direccion.indexOf('{')
                const jsonStr = bizData.direccion.substring(jsonStart)
                const parsed = JSON.parse(jsonStr)
                if (parsed.facebook) linkFb = parsed.facebook
                if (parsed.instagram) linkIg = parsed.instagram
                if (parsed.tiktok) linkTk = parsed.tiktok
                if (parsed.youtube) linkYt = parsed.youtube
                if (parsed.horario_semanal) horarioSem = parsed.horario_semanal
              } catch (err) {
                console.warn("Error parsing schedule fallback JSON in client portal:", err)
              }
            }

            setLinkFacebook(linkFb)
            setLinkInstagram(linkIg)
            setLinkTiktok(linkTk)
            setLinkYoutube(linkYt)

            const horarioDefault = {
              lunes: { cerrado: true, apertura: '14:00', cierre: '22:00' },
              martes: { cerrado: false, apertura: '14:00', cierre: '21:30' },
              miercoles: { cerrado: false, apertura: '14:00', cierre: '21:30' },
              jueves: { cerrado: false, apertura: '14:00', cierre: '21:30' },
              viernes: { cerrado: false, apertura: '14:00', cierre: '22:00' },
              sabado: { cerrado: false, apertura: '14:00', cierre: '22:00' },
              domingo: { cerrado: false, apertura: '14:00', cierre: '21:30' }
            }
            const horarioFinal = horarioSem || horarioDefault
            setHorarioSemanal(horarioFinal)

            // Validar si está cerrado por el horario comercial semanal
            const estaCerrado = verificarHorarioNegocio(horarioFinal)
            setFueraDeHorario(estaCerrado)

            const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
            const diaHoy = diasSemana[new Date().getDay()]
            const configHoy = horarioFinal[diaHoy]
            if (configHoy) {
              setHoraAperturaHoy(configHoy.apertura || '14:00')
              setHoraCierreHoy(configHoy.cierre || '22:00')
            }
          }

          // Cargar premios del negocio
          const { data: premiosData } = await (supabase as any)
            .from('loyalty_rewards')
            .select('*')
            .eq('business_id', clienteData.business_id)
            .eq('activo', true)
            .order('sello_requerido')
          if (premiosData) setPremios(premiosData as Premio[])


          // Cargar menú digital
          const { data: menuData } = await supabase
            .from('menus_digitales')
            .select('*')
            .eq('business_id', clienteData.business_id)
            .eq('activo', true)
            .maybeSingle()
          if (menuData) setMenuDigital(menuData)

          // Cargar grupos del menú
          try {
            const { data: gData } = await supabase
              .from('menu_groups')
              .select('*')
              .eq('business_id', clienteData.business_id)
              .eq('activo', true)
              .in('tipo_menu', [tipoMenu, 'ambos'])
              .order('orden')
            if (gData) {
              setGrupos(gData)
              if (gData.length > 0) setGrupoActivo(gData[0].id)
            }
          } catch (e) {
            console.warn('Error loading menu groups:', e)
          }

          // Cargar productos con modificadores y saneamiento
          try {
            const { data: pData } = await supabase
              .from('menu_products')
              .select('*, product_modifiers(*, modifier_options(*)), product_ingredients(ingredients(*))')
              .eq('business_id', clienteData.business_id)
            if (pData) {
              const ahora = new Date()
              let huboCambio = false

              const productosProcesados = await Promise.all(pData.map(async (prod: any) => {
                let processedProd = prod

                if (!prod.disponible && prod.suspension_hasta && new Date(prod.suspension_hasta) < ahora) {
                  await supabase
                    .from('menu_products')
                    .update({ disponible: true, suspension_tipo: 'indefinida', suspension_hasta: null })
                    .eq('id', prod.id)
                  huboCambio = true
                  processedProd = { ...prod, disponible: true, suspension_tipo: 'indefinida', suspension_hasta: null }
                }

                // Cascading availability check: if any associated ingredient is unavailable, force disable
                const tieneIngredienteAgotado = processedProd.product_ingredients?.some(
                  (pi: any) => pi.ingredients && pi.ingredients.is_available === false
                )
                if (tieneIngredienteAgotado) {
                  processedProd = { ...processedProd, disponible: false }
                }

                return processedProd
              }))

              const disponibles = productosProcesados.filter((p: any) => p.disponible)
              setProductos(disponibles as MenuProduct[])
            }
          } catch (e) {
            console.warn('Error loading menu products:', e)
          }

          // Cargar Programa de Fidelidad Activo
          try {
            const { data: progActivo } = await supabase
              .from('programas_fidelidad')
              .select('id, nombre_club, logo_url, portada_url, total_estampillas')
              .eq('business_id', clienteData.business_id)
              .eq('activo', true)
              .maybeSingle()
            if (progActivo) {
              setProgramaActivo(progActivo)
            }
          } catch (e) {
            console.warn('La tabla de programas_fidelidad o sus columnas logo_url/portada_url no están listas.', e)
          }
        }

        const { data: couponData } = await supabase
          .from('tracking_events')
          .select('*')
          .eq('cliente_id', clienteData.id)
          .eq('event_type', 'reward_generated')
          .eq('cupon_canjeado', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (couponData) setActiveCoupon(couponData)

        // Cargar el total del último pedido registrado del cliente
        try {
          const { data: lastOrder } = await supabase
            .from('orders')
            .select('total')
            .eq('cliente_id', clienteData.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          
          if (lastOrder) {
            setUltimoPedidoTotal(Number(lastOrder.total) || 0)
          }
        } catch (e) {
          console.warn('Error al cargar el último pedido del cliente:', e)
        }
      } else {
        // Fallback: tratar de recuperar el business_id de tablas vinculadas
        let foundBizId = null
        try {
          const { data: orderData } = await supabase
            .from('orders')
            .select('business_id')
            .eq('cliente_id', id)
            .limit(1)
            .maybeSingle()
          if (orderData?.business_id) {
            foundBizId = orderData.business_id
          }
        } catch {}

        if (!foundBizId) {
          try {
            const { data: eventData } = await supabase
              .from('tracking_events')
              .select('business_id')
              .eq('cliente_id', id)
              .limit(1)
              .maybeSingle()
            if (eventData?.business_id) {
              foundBizId = eventData.business_id
            }
          } catch {}
        }

        if (foundBizId) {
          const { data: bizData } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', foundBizId)
            .maybeSingle()
          if (bizData) setBusiness({ ...bizData, name: bizData.nombre })
        }
      }
      setCargando(false)
    }
    cargarDatos()
  }, [id])

  const generarPaseGoogle = async () => {
    setGenerandoGoogle(true)
    try {
      const res = await fetch(`${getBaseUrl()}/api/wallet/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: cliente.id,
          nombre: cliente.nombre,
          puntos: cliente.puntos,
          businessId: business?.id,
          business_name: business?.nombre || 'La Burrería'
        })
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert('No se pudo generar el pase. ' + (data.error || ''))
      }
    } catch (error) {
      console.error('[ClientePage] Error Google Wallet:', error)
      alert('Error de conexión. Intenta de nuevo.')
    } finally {
      setGenerandoGoogle(false)
    }
  }

  const generarPaseApple = async () => {
    // Redirección directa hacia el endpoint GET de Apple Wallet para descarga y registro nativo en Safari/Brave
    const targetUrl = `${getBaseUrl()}/api/wallet/apple?clienteId=${cliente.id}&businessId=${business?.id || ''}`
    window.location.href = targetUrl
  }

  const sellosTotales = business?.max_sellos || 10
  const sellosMarcados = cliente?.puntos || 0
  const tarjetaCompleta = sellosMarcados >= sellosTotales

  const activeRuletaRange = business?.ruleta_config?.[String(sellosMarcados)]
  const tieneEstructuraRuleta = tarjetaCompleta || (activeRuletaRange && activeRuletaRange.activo && Array.isArray(activeRuletaRange.premios) && activeRuletaRange.premios.length >= 4)

  // Validación de ticket mínimo
  const minRuletaTicket = Number(business?.monto_minimo_ruleta) || 0
  const cumpleMontoMinimoRuleta = minRuletaTicket === 0 || ultimoPedidoTotal >= minRuletaTicket

  // La ruleta solo se activa si tiene la estructura y cumple el monto mínimo de su última compra
  const tieneRuletaActiva = tieneEstructuraRuleta && cumpleMontoMinimoRuleta

  // ── Funciones del Carrito e Interacción del Menú ──
  const ejecutarAutocompletado = async () => {
    const telClean = telefonoAutocompletar.trim()
    if (!telClean) {
      alert('Por favor ingresa un número de teléfono.')
      return
    }
    setBuscandoAutocompletar(true)
    try {
      const { data: colCliente, error: cliErr } = await supabase
        .from('clientes')
        .select('*')
        .eq('telefono', telClean)
        .maybeSingle()

      if (cliErr) {
        console.error('Error al buscar cliente:', cliErr.message)
      }

      const { data: orders, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('telefono', telClean)
        .order('created_at', { ascending: false })
        .limit(1)

      if (orderErr) {
        console.log('Error al buscar pedidos:', orderErr.message)
      }

      const ultimaOrden = orders?.[0]

      if (colCliente || ultimaOrden) {
        setForm({
          nombre: colCliente?.nombre || ultimaOrden?.nombre || '',
          telefono: telClean,
          calle: ultimaOrden?.calle || '',
          numero: ultimaOrden?.numero || '',
          colonia: ultimaOrden?.colonia || '',
          referencia: ''
        })
        alert('✅ ¡Datos autocompletados con éxito! Por favor revisa y confirma si son correctos.')
        setMostrandoAutocompletar(false)
      } else {
        alert('🔍 No encontramos registros con ese número de teléfono. Puedes registrarte ingresando tus datos abajo.')
      }
    } catch (e: any) {
      alert('Error en autocompletado: ' + e.message)
    } finally {
      setBuscandoAutocompletar(false)
    }
  }

  const obtenerMaxSabores = (product: MenuProduct) => {
    const nombre = product.nombre.toLowerCase()
    if (!nombre.includes('alita') && !nombre.includes('wings')) return 1
    
    const matches = nombre.match(/\d+/g)
    let piezas = 8
    if (matches) {
      const numeros = matches.map(m => parseInt(m, 10))
      piezas = Math.max(...numeros)
    }
    
    return Math.max(1, Math.floor(piezas / 8))
  }

  const esGrupoSabores = (modName: string) => {
    const nombre = modName.toLowerCase()
    return nombre.includes('sabor') || nombre.includes('salsa') || nombre.includes('flavor')
  }

  const hacerScrollACategoria = (groupId: string) => {
    setGrupoActivo(groupId)
    setCategoriasColapsadas(prev => ({ ...prev, [groupId]: false }))
    const el = document.getElementById(`category-section-${groupId}`)
    if (el) {
      const yOffset = -130
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset
      window.scrollTo({ top: y, behavior: 'smooth' })
    }
  }

  const presionarAgregar = (product: MenuProduct) => {
    if (product.product_modifiers && product.product_modifiers.length > 0) {
      setProductoSeleccionadoMod(product)
      const iniciales: Record<string, any> = {}
      product.product_modifiers.forEach(mod => {
        if (mod.modifier_options && mod.modifier_options.length > 0) {
          const maxConfigurado = mod.maximo_permitido !== undefined && mod.maximo_permitido !== null ? mod.maximo_permitido : null
          const esMultiple = maxConfigurado !== null ? maxConfigurado > 1 : (esGrupoSabores(mod.nombre) && obtenerMaxSabores(product) > 1)
          if (esMultiple) {
            iniciales[mod.id] = [mod.modifier_options[0]] // Primer sabor seleccionado por defecto como array
          } else {
            iniciales[mod.id] = mod.modifier_options[0]
          }
        }
      })
      setSeleccionesMod(iniciales)
    } else {
      agregarAlCarritoDirecto(product, {})
    }
  }

  const seleccionarOpcion = (mod: ModifierGroup, opt: ModifierOption) => {
    const maxConfigurado = mod.maximo_permitido !== undefined && mod.maximo_permitido !== null ? mod.maximo_permitido : null
    const esMultiple = maxConfigurado !== null ? maxConfigurado > 1 : (esGrupoSabores(mod.nombre) && obtenerMaxSabores(productoSeleccionadoMod!) > 1)
    const limiteMax = maxConfigurado !== null ? maxConfigurado : (esGrupoSabores(mod.nombre) ? obtenerMaxSabores(productoSeleccionadoMod!) : 1)

    if (esMultiple) {
      const actuales: ModifierOption[] = Array.isArray(seleccionesMod[mod.id])
        ? seleccionesMod[mod.id]
        : (seleccionesMod[mod.id] ? [seleccionesMod[mod.id]] : [])

      const yaSeleccionado = actuales.some(item => item.id === opt.id)
      if (yaSeleccionado) {
        if (actuales.length > 1 || !mod.requerido) {
          const nuevos = actuales.filter(item => item.id !== opt.id)
          setSeleccionesMod(prev => ({ ...prev, [mod.id]: nuevos }))
        }
      } else {
        if (actuales.length < limiteMax) {
          const nuevos = [...actuales, opt]
          setSeleccionesMod(prev => ({ ...prev, [mod.id]: nuevos }))
        } else {
          alert(`Solo puedes seleccionar hasta ${limiteMax} opciones para "${mod.nombre}".`)
        }
      }
    } else {
      const seleccionadoActual = seleccionesMod[mod.id]?.id === opt.id
      if (seleccionadoActual && !mod.requerido) {
        setSeleccionesMod(prev => {
          const cop = { ...prev }
          delete cop[mod.id]
          return cop
        })
      } else {
        setSeleccionesMod(prev => ({ ...prev, [mod.id]: opt }))
      }
    }
  }

  const calcularPrecioUnitario = (product: MenuProduct, selecciones: Record<string, any>) => {
    const precioExtra = Object.entries(selecciones).reduce((sum, [modId, opt]) => {
      if (modId === 'salsa-aparte') return sum;
      
      const modGroup = product.product_modifiers?.find(m => m.id === modId)
      const incluidos = Number(modGroup?.incluidos) || 0
      
      if (Array.isArray(opt)) {
        if (incluidos > 0) {
          const sortedOpts = [...opt].sort((a, b) => (Number(a.precio_extra) || 0) - (Number(b.precio_extra) || 0))
          return sum + sortedOpts.reduce((s, o, index) => {
            if (index < incluidos) return s
            return s + (Number(o.precio_extra) || 0)
          }, 0)
        } else {
          return sum + opt.reduce((s, o) => s + (Number(o.precio_extra) || 0), 0)
        }
      } else {
        if (incluidos >= 1) return sum
        return sum + (Number(opt?.precio_extra) || 0)
      }
    }, 0)
    return Number(product.precio) + precioExtra
  }

  const agregarAlCarritoDirecto = (product: MenuProduct, selecciones: Record<string, any>) => {
    const precioUnitario = calcularPrecioUnitario(product, selecciones)
    
    setCart(prev => {
      const existente = prev.find(item => {
        if (item.product.id !== product.id) return false
        
        const keys1 = Object.keys(item.selecciones).filter(k => k !== 'salsa-aparte')
        const keys2 = Object.keys(selecciones).filter(k => k !== 'salsa-aparte')
        if (keys1.length !== keys2.length) return false
        
        const modMatch = keys1.every(k => {
          const opt1 = item.selecciones[k]
          const opt2 = selecciones[k]
          if (Array.isArray(opt1) && Array.isArray(opt2)) {
            if (opt1.length !== opt2.length) return false
            return opt1.every(o1 => opt2.some(o2 => o2.id === o1.id))
          }
          return opt1?.id === opt2?.id
        })
        if (!modMatch) return false
        if (item.selecciones['salsa-aparte'] !== selecciones['salsa-aparte']) return false
        return true
      })

      if (existente) {
        return prev.map(item => {
          const keys1 = Object.keys(item.selecciones).filter(k => k !== 'salsa-aparte')
          const keys2 = Object.keys(selecciones).filter(k => k !== 'salsa-aparte')
          const matched = item.product.id === product.id &&
            item.selecciones['salsa-aparte'] === selecciones['salsa-aparte'] &&
            keys1.length === keys2.length &&
            keys1.every(k => {
              const opt1 = item.selecciones[k]
              const opt2 = selecciones[k]
              if (Array.isArray(opt1) && Array.isArray(opt2)) {
                if (opt1.length !== opt2.length) return false
                return opt1.every(o1 => opt2.some(o2 => o2.id === o1.id))
              }
              return opt1?.id === opt2?.id
            })
          if (matched) {
            const nuevaCant = item.cantidad + 1
            return { ...item, cantidad: nuevaCant, subtotal: nuevaCant * precioUnitario }
          }
          return item
        })
      }
      
      return [...prev, { product, cantidad: 1, selecciones, subtotal: precioUnitario }]
    })
    
    setProductoSeleccionadoMod(null)
    setSeleccionesMod({})
  }

  const agregarAlCarrito = (product: MenuProduct) => {
    presionarAgregar(product)
  }

  const quitarDelCarrito = (productId: string) => {
    setCart(prev => {
      const index = prev.map(item => item.product.id).lastIndexOf(productId)
      if (index === -1) return prev
      const item = prev[index]
      if (item.cantidad <= 1) {
        return prev.filter((_, idx) => idx !== index)
      }
      const precioUnitario = calcularPrecioUnitario(item.product, item.selecciones)
      
      return prev.map((it, idx) => idx === index
        ? { ...it, cantidad: it.cantidad - 1, subtotal: (it.cantidad - 1) * precioUnitario }
        : it)
    })
  }

  const totalCarrito = cart.reduce((s, i) => s + i.subtotal, 0)
  const cantidadTotal = cart.reduce((s, i) => s + i.cantidad, 0)

  const generarTextoWhatsApp = () => {
    if (!business) return ''
    
    let itemsText = cart.map(i => {
      const modTextList = Object.entries(i.selecciones).map(([key, o]: [string, any]) => {
        if (key === 'salsa-aparte') return o ? ' (*Salsa Aparte*)' : ''
        if (Array.isArray(o)) {
          return o.map(subOpt => ` (+ ${subOpt.nombre})`).join('')
        }
        return o ? ` (+ ${o.nombre})` : ''
      })
      const modText = modTextList.join('')
      return `• ${i.cantidad}x ${i.product.nombre}${modText} - $${i.subtotal.toLocaleString()} MXN`
    }).join('\n')
    
    let tipoText = tipoMenu === 'delivery' ? '🛵 A Domicilio (Delivery)' : '🍽️ Comer en Restaurante (Mesa)'
    let pagoText = `\n*Método de Pago:* ${metodoPago === 'efectivo' ? '💵 Efectivo' : '🏦 Transferencia (Pendiente de verificación)'}`
    
    let direccionText = tipoMenu === 'delivery' 
      ? `\n*Dirección:* ${form.calle} #${form.numero}, ${form.colonia}` +
        (coordenadasPin ? `\n*Ubicación GPS:* https://www.google.com/maps?q=${coordenadasPin.lat},${coordenadasPin.lng}` : '')
      : ''

    const msg = `*NUEVO PEDIDO DE CLIENTE VIP - ${business.nombre.toUpperCase()}* 🛍️✨
-----------------------------------
*Socio VIP:* ${form.nombre} (ID: ${cliente?.id?.substring(0, 8) || ''})
*Teléfono:* ${form.telefono}
*Tipo:* ${tipoText}${pagoText}${direccionText}

*Resumen de Compra:*
${itemsText}

-----------------------------------
*TOTAL:* $${totalCarrito.toLocaleString()} MXN
-----------------------------------
_Pedido procesado a través de LoyaltyClub VIP_`

    return encodeURIComponent(msg)
  }

  const crearPedido = async () => {
    if (!business || !cliente) return
    setEnviando(true)

    const coloniaCombinada = form.referencia ? `${form.colonia} (Ref: ${form.referencia})` : form.colonia

    let order = null
    let logoSelloGranted = false
    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          business_id: business.id,
          cliente_id: cliente.id,
          nombre_cliente: form.nombre,
          telefono_cliente: form.telefono,
          calle: form.calle,
          numero: form.numero,
          colonia: coloniaCombinada,
          tipo: tipoMenu,
          items: cart.map(i => ({
            id: i.product.id,
            nombre: i.product.nombre,
            cantidad: i.cantidad,
            precio_unitario: i.product.precio,
            subtotal: i.subtotal,
          })),
          total: totalCarrito,
          lat_entrega: tipoMenu === 'delivery' ? coordenadasPin?.lat || null : null,
          lng_entrega: tipoMenu === 'delivery' ? coordenadasPin?.lng || null : null,
          metodo_pago: metodoPago,
          pago_verificado: metodoPago === 'efectivo'
        })
      })

      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      order = data.order
      logoSelloGranted = data.sello_otorgado
    } catch (err) {
      console.error('Error creating order via API:', err)
      setEnviando(false)
      alert('Error al procesar el pedido')
      return
    }

    if (!order) {
      setEnviando(false)
      alert('Error al procesar el pedido')
      return
    }

    setOrderId(order.id)

    if (logoSelloGranted) {
      const nuevosPuntos = (cliente.puntos || 0) + 1
      setCliente((prev: any) => prev ? { ...prev, puntos: nuevosPuntos } : null)
      if (nuevosPuntos >= sellosTotales) {
        setConfeti(true)
      }
    }

    setEnviando(false)
    setPasoMenu('confirmado')

    const tel = '52' + (business.telefono_whatsapp || '').replace(/\D/g, '').slice(-10)
    const textMsg = generarTextoWhatsApp()
    const waUrl = `https://wa.me/${tel}?text=${textMsg}`
    window.open(waUrl, '_blank')
  }

  if (cargando) return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-2 border-[#e4e4e7] border-t-[#dc2626] rounded-full animate-spin mx-auto" />
        <p className="text-sm text-[#71717a] font-medium">Cargando tu tarjeta...</p>
      </div>
    </div>
  )

  if (!cliente) return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-6 text-center font-sans">
      {/* Icono de Alerta Animado */}
      <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-6 animate-pulse border border-amber-200 shadow-sm">
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>

      {/* Mensaje Principal */}
      <h1 className="text-2xl font-black text-[#09090b] mb-2 tracking-tight">
        ¡Pase VIP no encontrado!
      </h1>
      <p className="text-sm text-[#71717a] font-medium max-w-sm mb-8 leading-relaxed">
        Esta tarjeta de cliente ya no está activa, fue eliminada o estás usando un enlace antiguo. ¡No te preocupes, puedes volver a ingresar en un segundo!
      </p>

      {/* Contenedor de Botones de Recuperación */}
      <div className="w-full max-w-xs space-y-3">
        {/* Botón Principal: Registrarse / Crear Nueva */}
        <a 
          href={business?.slug 
            ? (typeof window !== 'undefined' && window.location.hostname.includes('loyaltyclub.mx')
                ? `https://${business.slug}.loyaltyclub.mx/registro`
                : `http://${business.slug}.localhost:3000/registro`)
            : '/registro'}
          className="block w-full py-3.5 px-4 text-white font-extrabold rounded-2xl transition shadow-md text-xs uppercase tracking-wider text-center cursor-pointer"
          style={{ backgroundColor: business?.color_primario || '#dc2626' }}
        >
          Crear Nueva Tarjeta
        </a>

        {/* Botón Secundario: Iniciar Sesión (Si ya tiene cuenta de usuario) */}
        <a 
          href={business?.slug 
            ? (typeof window !== 'undefined' && window.location.hostname.includes('loyaltyclub.mx')
                ? `https://${business.slug}.loyaltyclub.mx/registro`
                : `http://${business.slug}.localhost:3000/registro`)
            : '/registro'}
          className="block w-full py-3.5 px-4 bg-white hover:bg-gray-50 text-[#52525b] hover:text-[#09090b] font-extrabold rounded-2xl border border-[#e4e4e7] transition text-xs uppercase tracking-wider text-center cursor-pointer"
        >
          Ya tengo cuenta (Ingresar)
        </a>
      </div>

      {/* Enlace sutil al menú por si solo quiere ver la carta */}
      <a 
        href={business?.slug 
          ? (typeof window !== 'undefined' && window.location.hostname.includes('loyaltyclub.mx')
              ? `https://${business.slug}.loyaltyclub.mx/menu`
              : `http://${business.slug}.localhost:3000/menu`)
          : '/menu'}
        className="mt-8 text-xs text-[#a1a1aa] hover:text-[#52525b] font-bold underline cursor-pointer"
      >
        Ver el menú de {business?.nombre || 'la marca'}
      </a>
    </div>
  )

  // Helper para dirección en texto limpia
  const obtenerDireccionLimpia = () => {
    if (!business || !business.direccion) return 'Ubicación'
    let dir = business.direccion
    if (dir.includes('|')) {
      dir = dir.split('|')[0].trim()
    }
    if (dir.includes('{')) {
      try {
        const jsonStart = dir.indexOf('{')
        if (jsonStart === 0) return 'Ubicación'
        dir = dir.substring(0, jsonStart).trim()
      } catch {}
    }
    return dir || 'Ubicación'
  }

  const diasSemanaOrdenados = [
    { key: 'lunes', label: 'Lunes' },
    { key: 'martes', label: 'Martes' },
    { key: 'miercoles', label: 'Miércoles' },
    { key: 'jueves', label: 'Jueves' },
    { key: 'viernes', label: 'Viernes' },
    { key: 'sabado', label: 'Sábado' },
    { key: 'domingo', label: 'Domingo' }
  ]
  const diasEsp = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  const hoyEsp = diasEsp[new Date().getDay()]

  const algunRedeConfigurada = !!(linkFacebook || linkInstagram || linkTiktok || linkYoutube)

  return (
    <main className="min-h-screen bg-[#fafafa] pb-24 font-sans">
      {/* ── Ruleta Modal ── */}
      {mostrarRuleta && (
        <RuletaVIP
          premios={premios}
          business={business}
          cliente={cliente}
          onCerrar={() => setMostrarRuleta(false)}
          onResetPuntos={() => setCliente((prev: any) => prev ? { ...prev, puntos: 0 } : null)}
        />
      )}

      {/* ── Vista: Tarjeta de Lealtad ── */}
      {vistaActiva === 'tarjeta' && (
        <div className="max-w-sm mx-auto pt-8 px-4 space-y-5 animate-fadeIn">
          {/* Header del negocio */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden border border-[#e4e4e7] shadow-sm bg-white shrink-0">
              <img
                src={business?.logo_url || '/logo.png'}
                alt={business?.nombre || 'LoyaltyClub'}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png' }}
              />
            </div>
            <div>
              <p className="text-xs text-[#71717a] font-medium">Club de Fidelización</p>
              <h1 className="text-base font-bold text-[#09090b] tracking-tight">{business?.nombre || 'LoyaltyClub'}</h1>
            </div>
          </div>

          {/* Mass Alert Banner if present */}
          {business?.alerta_masiva && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm animate-fadeIn space-y-2">
              <div className="flex items-start gap-2.5">
                <span className="text-xl shrink-0">📢</span>
                <div>
                  <h4 className="font-extrabold text-amber-900 text-xs uppercase tracking-wider">Aviso Importante</h4>
                  <p className="text-xs text-amber-800 font-semibold leading-relaxed mt-1 whitespace-pre-line">{business.alerta_masiva}</p>
                </div>
              </div>
            </div>
          )}

          {/* Tracking de Pedido Activo */}
          {activeOrder && (
            <div className="bg-white border border-[#e4e4e7] rounded-3xl p-5 shadow-lg animate-fadeIn space-y-3.5 text-[#09090b]">
              <div className="flex items-center justify-between border-b border-[#f4f4f5] pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🛵</span>
                  <h4 className="font-extrabold text-sm tracking-tight text-[#09090b]">Siga su Envío en Tiempo Real</h4>
                </div>
                {['DELIVERED', 'CANCELLED'].includes(activeOrder.delivery_status) && (
                  <button 
                    onClick={() => setActiveOrder(null)} 
                    className="text-[#a1a1aa] hover:text-[#52525b] text-xs font-bold"
                  >
                    Cerrar
                  </button>
                )}
              </div>

              {activeOrder.delivery_status === 'SHIPPED_SCHEDULED' ? (
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <p className="text-xs font-extrabold text-amber-950">Despacho Programado</p>
                      <p className="text-[11px] text-amber-700 font-medium leading-relaxed mt-0.5">
                        Tu pedido ha sido recibido. El repartidor está programado para salir en:
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-center py-1">
                    <DeliveryCountdown scheduledTime={activeOrder.scheduled_pickup_time} />
                  </div>
                </div>
              ) : activeOrder.delivery_status === 'SHIPPED_IMMEDIATE' ? (
                <div className="space-y-2.5">
                  <style>{`
                    @keyframes motorSlide {
                      0% { transform: translateX(-150%); }
                      100% { transform: translateX(350%); }
                    }
                    .animate-motor-slide {
                      animation: motorSlide 2.5s ease-in-out infinite;
                    }
                  `}</style>
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center border border-emerald-200 animate-bounce shrink-0">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-emerald-950">¡Rider en Camino!</p>
                      <p className="text-[11px] text-emerald-700 font-semibold leading-relaxed mt-0.5">
                        ¡Buenas noticias! Tu pedido va en camino antes de lo previsto. El repartidor ya va en ruta inmediata.
                      </p>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-emerald-100 rounded-full overflow-hidden relative border border-emerald-200">
                    <div className="absolute top-0 bottom-0 w-12 bg-emerald-500 rounded-full animate-motor-slide"></div>
                  </div>
                </div>
              ) : activeOrder.delivery_status === 'DELIVERED' ? (
                <div className="flex items-start gap-2.5">
                  <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 bg-emerald-50 border border-emerald-200 rounded-full p-0.5" />
                  <div>
                    <p className="text-xs font-extrabold text-emerald-950">¡Pedido Entregado!</p>
                    <p className="text-[11px] text-emerald-700 font-medium leading-relaxed mt-0.5">
                      Tu pedido ha llegado con éxito. ¡Que lo disfrutes!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5">
                  <X className="w-5 h-5 text-red-600 shrink-0 mt-0.5 bg-red-50 border border-red-200 rounded-full p-0.5" />
                  <div>
                    <p className="text-xs font-extrabold text-red-950">Pedido Cancelado</p>
                    <p className="text-[11px] text-red-700 font-medium leading-relaxed mt-0.5">
                      Tu pedido de entrega a domicilio fue cancelado.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tarjeta Principal */}
          <div className="rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.1)] border border-black/10 overflow-hidden p-6 space-y-6 text-[#09090b]" style={{ backgroundColor: business?.color_primario || '#dc2626' }}>
            {/* Encabezado */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {business?.logo_url ? (
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm bg-white flex items-center justify-center">
                    <img 
                      src={business.logo_url} 
                      alt={business.name} 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-white text-[#dc2626] flex items-center justify-center font-black text-xl border-2 border-white shadow-sm">
                    LB
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-black tracking-tight leading-none uppercase">{business?.name}</h2>
                  <p className="text-[10px] font-black text-black/60 uppercase tracking-widest mt-1">Socio VIP: {cliente.nombre}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-mono bg-black/10 px-2 py-0.5 rounded-md font-bold uppercase">ID: {cliente.id.substring(0, 8)}</span>
              </div>
            </div>

            {/* Subtítulo */}
            <div className="space-y-0.5">
              <p className="text-[11px] font-black tracking-wider uppercase text-black/70">DIGITAL LOYALTY CARD</p>
              <h3 className="text-base font-extrabold tracking-tight uppercase leading-snug">
                COLLECT {sellosTotales} STAMPS & GET A FREE {business?.nombre_premio || 'PREMIO'}!
              </h3>
            </div>

            {/* El Bloque Blanco de Sellos Dinámicos */}
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-5 text-[#09090b]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-wider text-[#71717a]">
                  {tarjetaCompleta
                    ? '🏆 ¡Tarjeta Completa!'
                    : `${sellosMarcados} / ${sellosTotales} STAMPS ACCUMULATED`}
                </p>
              </div>

              {/* Grid de Sellos */}
              <div className="grid grid-cols-5 gap-3.5 place-items-center">
                {[...Array(sellosTotales)].map((_, i) => {
                  const marcado = i < sellosMarcados
                  return (
                    <div key={i} className="flex flex-col items-center gap-1 w-full">
                      {marcado ? (
                        <div className="w-12 h-12 rounded-full bg-[#fef9c3] flex items-center justify-center border border-yellow-200">
                          <RenderIconoSello icono={business?.icono_sello || 'default'} />
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-full border-2 border-dashed border-[#e4e4e7] flex items-center justify-center bg-[#fafafa]">
                          <span className="text-[#a1a1aa] text-xs font-bold">{i + 1}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Barra de Porcentaje Dinámica */}
              <div className="space-y-1">
                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ 
                      width: `${Math.min((sellosMarcados / sellosTotales) * 100, 100)}%`,
                      backgroundColor: business?.color_primario || '#dc2626'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* QR / Acción principal */}
            <div className="px-6 pb-6 flex flex-col items-center gap-4">
              {tarjetaCompleta ? (
                <button
                  onClick={() => setMostrarRuleta(true)}
                  className="btn-primary w-full py-4 text-base animate-bounce flex items-center justify-center gap-2"
                >
                  <Gift className="w-5 h-5" />
                  ¡Girar Ruleta de Premios!
                </button>
              ) : activeCoupon ? (
                <div className="flex flex-col items-center gap-3 w-full">
                  <div className="p-3 bg-white border-2 border-[#dc2626] rounded-2xl shadow-sm">
                    <QRCodeSVG value={activeCoupon.codigo_cupon} size={140} level="H" fgColor="#09090b" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-[#dc2626] uppercase tracking-wider">Cupón Activo</p>
                    <p className="font-mono font-bold text-[#09090b] text-sm">{activeCoupon.codigo_cupon}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-white border border-[#e4e4e7] rounded-2xl shadow-sm">
                    <QRCodeSVG value={cliente.id} size={140} level="H" fgColor="#09090b" />
                  </div>
                  <p className="text-[10px] text-[#a1a1aa] font-mono">Escanear en caja para acumular sellos</p>
                </div>
              )}
            </div>
          </div>

          {/* Botones de Wallet — lado a lado */}
          <div className="grid grid-cols-2 gap-3">
            {/* Apple Wallet */}
            <button
              onClick={generarPaseApple}
              disabled={generandoApple}
              className={`h-14 bg-[#09090b] rounded-2xl flex items-center justify-center gap-2.5 transition-all border border-[#27272a] shadow-sm ${
                generandoApple ? 'opacity-60 cursor-not-allowed' : 'hover:bg-[#18181b] active:scale-95'
              }`}
            >
              {generandoApple ? (
                <span className="text-[10px] font-bold text-white animate-pulse">Procesando...</span>
              ) : (
                <>
                  <svg viewBox="0 0 384 512" className="h-5 text-white fill-current">
                    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                  </svg>
                  <div className="flex flex-col items-start leading-tight">
                    <span className="text-[9px] text-white/70 font-medium">Añadir a</span>
                    <span className="text-sm font-semibold text-white">Apple Wallet</span>
                  </div>
                </>
              )}
            </button>

            {/* Google Wallet */}
            <button
              onClick={generarPaseGoogle}
              disabled={generandoGoogle}
              className={`h-14 bg-white rounded-2xl flex items-center justify-center gap-2.5 transition-all border border-[#e4e4e7] shadow-sm ${
                generandoGoogle ? 'opacity-60 cursor-not-allowed' : 'hover:bg-[#fafafa] active:scale-95'
              }`}
            >
              {generandoGoogle ? (
                <span className="text-[10px] font-bold text-[#09090b] animate-pulse">Procesando...</span>
              ) : (
                <>
                  <svg viewBox="0 0 512 512" className="h-5">
                    <path fill="#4285F4" d="M386 400c45-42 74-103 74-171 0-16-1-32-5-47H261v89h112c-5 29-21 54-43 71l56 58z"/>
                    <path fill="#34A853" d="M261 460c70 0 129-23 172-63l-56-58c-24 16-53 25-86 25-66 0-122-45-142-106l-59 45c43 85 131 142 229 142z"/>
                    <path fill="#FBBC05" d="M119 258c-5-15-8-32-8-49s3-34 8-49l-59-45c-16 31-25 67-25 104s9 73 25 104l59-45z"/>
                    <path fill="#EA4335" d="M261 146c38 0 73 13 100 39l75-75C391 66 331 40 261 40 163 40 75 97 32 182l59 45c20-61 76-106 142-106z"/>
                  </svg>
                  <div className="flex flex-col items-start leading-tight">
                    <span className="text-[9px] text-[#71717a] font-medium">Añadir a</span>
                    <span className="text-sm font-semibold text-[#09090b]">Google Wallet</span>
                  </div>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Vista: Menú Digital Interactiva ── */}
      {vistaActiva === 'menu' && (
        <div className="max-w-sm mx-auto pt-8 px-4 space-y-5 animate-fadeIn text-[#09090b]">
          {/* Header del portal */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden border border-[#e4e4e7] shadow-sm bg-white shrink-0">
              <img
                src={business?.logo_url || '/logo.png'}
                alt={business?.nombre || 'LoyaltyClub'}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png' }}
              />
            </div>
            <div>
              <p className="text-xs text-[#71717a] font-medium">Carta & Club VIP</p>
              <h1 className="text-base font-bold text-[#09090b] tracking-tight">{business?.nombre || 'LoyaltyClub'}</h1>
            </div>
          </div>

          {pasoMenu === 'menu' && (
            <div className="space-y-5">
              {/* Sección de Pedido Rápido (Top) */}
              {business?.telefono_whatsapp && (
                <div className="bg-green-50/50 border border-green-200 rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-[11px] text-green-700 uppercase tracking-wider">⚡ Pedido por Chat Directo</p>
                    <p className="text-[11px] text-[#71717a] mt-0.5 leading-relaxed font-medium">¿Prefieres ordenar platicando directamente con nosotros por WhatsApp?</p>
                  </div>
                  <a
                    href={`https://wa.me/${'52' + (business.telefono_whatsapp || '').replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(`¡Hola! Soy cliente VIP (${cliente?.nombre}) y quiero hacer un pedido.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#25D366] hover:bg-[#20ba5a] text-white font-black text-[10px] uppercase tracking-widest px-4 py-3 rounded-xl transition-all shadow-[0_2px_8px_rgba(37,211,102,0.25)] flex items-center gap-1.5 shrink-0"
                  >
                    💬 Chat
                  </a>
                </div>
              )}

              {/* Cocina fuera de horario */}
              {fueraDeHorario && (
                <div className="bg-red-50/50 border border-red-200 rounded-3xl p-5 text-center space-y-2.5 animate-fadeIn">
                  <span className="text-2xl block">😴</span>
                  <h4 className="text-xs font-black text-[#dc2626] uppercase tracking-wider">Cocina Cerrada Temporalmente</h4>
                  <p className="text-[11px] text-red-700 leading-relaxed font-semibold">
                    Actualmente estamos fuera del horario de cocina comercial. Nuestro horario de hoy es de <strong>{horaAperturaHoy} a {horaCierreHoy}</strong>. Puedes ver nuestros productos, pero el envío de pedidos por WhatsApp está inhabilitado por ahora.
                  </p>
                </div>
              )}

              {/* Selector de Categorías en Pills */}
              {grupos.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
                  {grupos.map(g => (
                    <button
                      key={g.id}
                      onClick={() => hacerScrollACategoria(g.id)}
                      className={`snap-start px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 border ${
                        grupoActivo === g.id
                          ? 'bg-[#dc2626] border-[#dc2626] text-white shadow-[0_2px_8px_rgba(220,38,38,0.25)]'
                          : 'bg-white border-[#e4e4e7] text-[#52525b] hover:bg-[#fafafa]'
                      }`}
                    >
                      {g.nombre}
                    </button>
                  ))}
                </div>
              )}

              {/* Grid interactivo de productos por categoría */}
              <div className="space-y-6">
                {grupos.map(grupo => {
                  const prodGrupo = productos.filter(p => p.group_id === grupo.id)
                  if (prodGrupo.length === 0) return null
                  
                  const colapsado = !!categoriasColapsadas[grupo.id]
                  
                  return (
                    <div key={grupo.id} id={`category-section-${grupo.id}`} className="bg-white border border-[#f0f0f0] rounded-3xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] space-y-4 transition-all">
                      {/* Header de Categoría */}
                      <div className="flex justify-between items-center border-b border-[#f4f4f5] pb-2.5 cursor-pointer" onClick={() => setCategoriasColapsadas(prev => ({ ...prev, [grupo.id]: !colapsado }))}>
                        <div>
                          <h3 className="text-sm font-black text-[#09090b] uppercase tracking-wider">{grupo.nombre}</h3>
                          {grupo.descripcion && <p className="text-[10px] text-[#71717a] mt-0.5 font-medium">{grupo.descripcion}</p>}
                        </div>
                        <span className="text-[10px] text-[#a1a1aa] font-black uppercase tracking-wider px-2 py-0.5 bg-[#fafafa] border border-[#e4e4e7] rounded-lg">{colapsado ? 'Mostrar' : 'Ocultar'}</span>
                      </div>
                      
                      {/* Listado de Productos */}
                      {!colapsado && (
                        <div className="space-y-4 divide-y divide-[#f4f4f5]">
                          {prodGrupo.map((prod, pIdx) => {
                            const cantEnCarrito = cart.filter(item => item.product.id === prod.id).reduce((sum, item) => sum + item.cantidad, 0)
                            return (
                              <div key={prod.id} className={`flex gap-3.5 pt-4 first:pt-0 ${pIdx > 0 ? 'border-t border-[#f4f4f5]' : ''} animate-fadeIn`}>
                                {prod.imagen_url && (
                                  <div className="w-16 h-16 rounded-2xl overflow-hidden border border-[#e4e4e7] shadow-sm shrink-0 bg-[#fafafa]">
                                    <img src={prod.imagen_url} alt={prod.nombre} className="w-full h-full object-cover" />
                                  </div>
                                )}
                                
                                <div className="min-w-0 flex-1 flex flex-col justify-between">
                                  <div>
                                    <h4 className="text-xs font-black text-[#09090b] leading-tight">{prod.nombre}</h4>
                                    {prod.descripcion && <p className="text-[10px] text-[#71717a] mt-0.5 line-clamp-2 leading-relaxed font-medium">{prod.descripcion}</p>}
                                  </div>
                                  <p className="text-[#dc2626] font-mono font-bold text-xs mt-1.5">${prod.precio.toLocaleString()} MXN</p>
                                </div>
                                
                                {/* Controles de Carrito */}
                                <div className="flex flex-col justify-end shrink-0">
                                  {cantEnCarrito > 0 ? (
                                    <div className="flex items-center bg-[#fafafa] border border-[#e4e4e7] rounded-xl overflow-hidden shadow-sm">
                                      <button
                                        onClick={() => quitarDelCarrito(prod.id)}
                                        className="w-8 h-8 flex items-center justify-center font-bold text-[#52525b] hover:bg-zinc-100 transition-colors"
                                      >
                                        -
                                      </button>
                                      <span className="w-6 text-center text-xs font-black text-[#09090b]">{cantEnCarrito}</span>
                                      <button
                                        onClick={() => agregarAlCarrito(prod)}
                                        className="w-8 h-8 flex items-center justify-center font-bold text-[#52525b] hover:bg-zinc-100 transition-colors"
                                      >
                                        +
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => agregarAlCarrito(prod)}
                                      className="bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black text-[10px] uppercase tracking-wider px-3.5 py-2.5 rounded-xl transition-all shadow-md shadow-red-500/10 active:scale-95"
                                    >
                                      Añadir
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Floating Bottom Cart Bar */}
              {cantidadTotal > 0 && (
                <div className="fixed bottom-20 left-0 right-0 px-4 z-40 animate-slideUp">
                  <div className="max-w-sm mx-auto bg-[#09090b] text-white rounded-3xl p-4 shadow-[0_8px_30px_rgba(0,0,0,0.15)] border border-[#27272a] flex justify-between items-center gap-4">
                    <div className="min-w-0">
                      <p className="text-[9px] text-white/50 uppercase tracking-widest font-black">Mi Orden VIP</p>
                      <p className="font-extrabold text-sm">{cantidadTotal} {cantidadTotal === 1 ? 'producto' : 'productos'} · <span className="font-mono text-red-400">${totalCarrito.toLocaleString()} MXN</span></p>
                    </div>
                    <button
                      onClick={() => setPasoMenu('checkout')}
                      className="bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black text-xs uppercase tracking-widest py-3 px-5 rounded-2xl transition-all flex items-center gap-1.5 shrink-0 shadow-md active:scale-95"
                    >
                      <span>Ver Carrito 🛒</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CHECKOUT FLOW */}
          {pasoMenu === 'checkout' && (
            <div className="bg-white border border-[#f0f0f0] rounded-3xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.08)] space-y-6 animate-fadeIn">
              <div className="flex justify-between items-center">
                <button onClick={() => setPasoMenu('menu')} className="text-xs text-[#71717a] font-bold hover:text-[#09090b] transition-colors">← Volver al Menú</button>
                <span className="text-[9px] bg-red-50 border border-red-100 text-[#dc2626] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">Paso 2 de 2</span>
              </div>
              
              <div>
                <h3 className="text-lg font-bold text-[#09090b] tracking-tight">Confirmar Mi Pedido</h3>
                <p className="text-xs text-[#71717a] mt-0.5">Por favor revisa tu orden y proporciona tus datos de entrega.</p>
              </div>
              
              {/* Resumen Carrito */}
              <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-2xl p-4 space-y-3 shadow-xs">
                {cart.map((item, index) => (
                  <div key={`${item.product.id}-${index}`} className="flex justify-between items-start gap-4 border-b border-[#f4f4f5] pb-2.5 last:border-b-0 last:pb-0">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setCart(prev => prev.filter((_, idx) => idx !== index))}
                          className="text-red-500 hover:text-red-700 transition-colors w-4 h-4 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center font-bold text-[10px] shrink-0"
                        >
                          ×
                        </button>
                        <p className="font-bold text-xs text-[#09090b]">{item.cantidad}x {item.product.nombre}</p>
                      </div>
                      {Object.keys(item.selecciones).length > 0 && (
                        <p className="text-[9px] text-[#71717a] mt-0.5 pl-6 font-medium leading-relaxed">
                          {Object.entries(item.selecciones).map(([key, o]: [string, any]) => {
                            if (key === 'salsa-aparte') return o ? '🥣 Salsa Aparte' : ''
                            if (Array.isArray(o)) return o.map(subOpt => `• ${subOpt.nombre}`).join(', ')
                            return `• ${o?.nombre || ''}`
                          }).filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                    <p className="text-[#dc2626] font-mono font-bold text-xs shrink-0">${item.subtotal.toLocaleString()} MXN</p>
                  </div>
                ))}
                
                <div className="border-t border-[#e4e4e7] pt-3 flex justify-between font-black text-sm">
                  <span className="text-[#09090b]">Total</span>
                  <span className="text-[#dc2626] text-base">${totalCarrito.toLocaleString()} MXN</span>
                </div>
                
                {totalCarrito >= (business?.monto_minimo_sello || 0) ? (
                  <p className="text-green-700 text-[10px] font-bold text-center bg-green-50 border border-green-200 rounded-xl py-2">
                    ⭐ ¡Felicidades! Este pedido califica para recibir un sello VIP.
                  </p>
                ) : (
                  <p className="text-[#71717a] text-[9px] font-medium text-center bg-[#f4f4f5] rounded-xl py-2">
                    Agrega ${((business?.monto_minimo_sello || 0) - totalCarrito).toLocaleString()} MXN más para ganar un sello.
                  </p>
                )}
              </div>
              
              {/* Datos del Cliente */}
              <div className="space-y-4">
                {[
                  { key: 'nombre', label: 'Nombre completo', placeholder: 'Juan García', type: 'text' },
                  { key: 'telefono', label: 'Número de teléfono', placeholder: '3221234567', type: 'tel' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-[10px] text-[#52525b] uppercase tracking-widest font-bold block mb-1">{field.label}</label>
                    <input
                      type={field.type}
                      value={form[field.key as keyof typeof form]}
                      onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-3.5 py-2.5 text-[#09090b] text-xs focus:outline-none focus:border-[#dc2626] transition-colors font-medium"
                    />
                  </div>
                ))}

                {tipoMenu === 'delivery' && (
                  <div className="space-y-4 border-t border-[#e4e4e7] pt-4">
                    <h3 className="text-xs font-bold text-[#09090b] uppercase tracking-wider mb-2">📍 Dirección de Entrega</h3>
                    
                    {[
                      { key: 'calle', label: 'Calle', placeholder: 'Av. Principal', type: 'text' },
                      { key: 'numero', label: 'Número', placeholder: '123', type: 'text' },
                      { key: 'colonia', label: 'Colonia', placeholder: 'Centro', type: 'text' },
                      { key: 'referencia', label: 'Referencia / Entre calles (Opcional)', placeholder: 'Frente al parque, portón café', type: 'text' },
                    ].map(field => (
                      <div key={field.key}>
                        <label className="text-[10px] text-[#52525b] uppercase tracking-widest font-bold block mb-1">{field.label}</label>
                        <input
                          type={field.type}
                          value={form[field.key as keyof typeof form]}
                          onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={field.placeholder}
                          className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-3.5 py-2.5 text-[#09090b] text-xs focus:outline-none focus:border-[#dc2626] transition-colors font-medium"
                        />
                      </div>
                    ))}

                    {/* Leaflet Map Selector */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#52525b] uppercase tracking-widest font-bold block">Ubicación GPS (Arrastra el Pin)</label>
                      <p className="text-[10px] text-[#71717a] font-medium leading-normal">
                        Para asegurar que el repartidor llegue sin contratiempos, arrastra el marcador azul exactamente a donde está tu ubicación.
                      </p>
                      <div
                        id="mapa-cliente-checkout"
                        style={{ height: '240px' }}
                        className="w-full rounded-2xl border border-[#e4e4e7] overflow-hidden bg-zinc-50 relative shadow-inner mt-2 z-0"
                      />
                    </div>
                  </div>
                )}

                {/* Método de Pago */}
                <div className="border-t border-[#e4e4e7] pt-4 space-y-2">
                  <label className="text-[10px] text-[#52525b] uppercase tracking-widest font-bold block">Método de Pago</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setMetodoPago('efectivo')}
                      className={`py-3 px-4 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                        metodoPago === 'efectivo'
                          ? 'bg-[#dc2626] border-[#dc2626] text-white shadow-sm'
                          : 'bg-white border-[#e4e4e7] text-[#52525b] hover:bg-zinc-50'
                      }`}
                    >
                      💵 Efectivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetodoPago('transferencia')}
                      className={`py-3 px-4 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                        metodoPago === 'transferencia'
                          ? 'bg-[#dc2626] border-[#dc2626] text-white shadow-sm'
                          : 'bg-white border-[#e4e4e7] text-[#52525b] hover:bg-zinc-50'
                      }`}
                    >
                      🏦 Transferencia
                    </button>
                  </div>
                  {metodoPago === 'transferencia' && (
                    <p className="text-[9px] text-[#71717a] italic mt-1.5 font-medium leading-relaxed bg-[#f4f4f5] p-2.5 rounded-xl border border-[#e4e4e7]">
                      *Nota: Los pagos por transferencia deberán ser confirmados por el restaurante antes de proceder con el envío de tu pedido. Envía tu comprobante cuando seas redirigido a WhatsApp.
                    </p>
                  )}
                </div>
              </div>
              
              <button
                onClick={crearPedido}
                disabled={!form.nombre || !form.telefono || fueraDeHorario || enviando}
                className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shadow-red-500/10 active:scale-95"
              >
                {enviando ? 'Procesando...' : '📦 Confirmar y Enviar a WhatsApp'}
              </button>
            </div>
          )}

          {/* CONFIRMATION FLOW */}
          {pasoMenu === 'confirmado' && (
            <div className="bg-white border border-[#f0f0f0] rounded-3xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.08)] text-center space-y-5 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto text-green-600">
                <span className="text-3xl">🎉</span>
              </div>
              
              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-[#09090b] tracking-tight">¡Pedido Procesado!</h3>
                <p className="text-xs text-[#71717a] leading-relaxed font-medium">
                  Hemos guardado tu pedido en el sistema VIP y se ha abierto WhatsApp para que envíes el mensaje de confirmación al negocio.
                </p>
              </div>
              
              {totalCarrito >= (business?.monto_minimo_sello || 0) && (
                <div className="bg-gradient-to-br from-[#fffbeb] to-[#fffaf0] border border-[#fef3c7] rounded-2xl p-4 text-xs text-[#854d0e] leading-relaxed font-bold">
                  ⭐ ¡Sello VIP Sumado!
                  <p className="text-[10px] text-[#b45309] font-normal mt-1 leading-normal">
                    En cuanto el negocio reciba y apruebe tu pedido, el sello se consolidará permanentemente en tu tarjeta VIP.
                  </p>
                </div>
              )}
              
              <button
                onClick={() => {
                  setCart([])
                  setPasoMenu('menu')
                }}
                className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-widest shadow-md transition-all active:scale-95"
              >
                Aceptar y Volver al Menú
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Vista: Hacer Pedido ── */}
      {vistaActiva === 'pedido' && (
        <div className="max-w-sm mx-auto pt-8 px-4 animate-fadeIn">
          <h2 className="text-xl font-bold text-[#09090b] mb-6">Hacer un Pedido</h2>
          {business?.telefono_whatsapp ? (
            <div className="space-y-4">
              <div className="bg-white border border-[#e4e4e7] rounded-2xl p-5 shadow-sm">
                <p className="text-sm text-[#71717a] mb-4">Haz tu pedido directamente por WhatsApp con el negocio.</p>
                <a
                  href={`https://wa.me/${'52' + (business.telefono_whatsapp || '').replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(`Hola! Soy ${cliente.nombre} (Socio VIP ID: ${cliente.id.substring(0, 8)}) y quiero hacer un pedido.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full py-3.5 text-sm flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#25D366', boxShadow: '0 2px 12px rgba(37,211,102,0.3)' }}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Pedir por WhatsApp
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 text-center border border-[#e4e4e7] shadow-sm">
              <p className="text-4xl mb-3">📲</p>
              <p className="font-bold text-[#09090b]">Pedidos No Configurados</p>
              <p className="text-xs text-[#71717a] mt-1">El negocio aún no ha configurado el canal de pedidos.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Vista: Ubicación ── */}
      {vistaActiva === 'ubicacion' && (
        <div className="max-w-sm mx-auto pt-8 px-4 space-y-5 animate-fadeIn">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden border border-[#e4e4e7] shadow-sm bg-white shrink-0">
              <img
                src={business?.logo_url || '/logo.png'}
                alt={business?.nombre || 'LoyaltyClub'}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png' }}
              />
            </div>
            <div>
              <p className="text-xs text-[#71717a] font-medium">📍 Nuestra Ubicación</p>
              <h1 className="text-base font-bold text-[#09090b] tracking-tight">{business?.nombre || 'LoyaltyClub'}</h1>
            </div>
          </div>

          {/* Tarjeta Unificada */}
          <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[#f0f0f0] overflow-hidden p-6 space-y-5">
            <div>
              <p className="text-[10px] font-semibold text-[#dc2626] uppercase tracking-wider">Dirección Oficial</p>
              <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-2xl p-4 text-xs text-[#52525b] leading-relaxed font-semibold mt-1">
                {obtenerDireccionLimpia()}
              </div>
            </div>

            {/* Mapa iframe */}
            <div className="relative w-full rounded-2xl overflow-hidden border border-[#e4e4e7] shadow-sm bg-[#fafafa]" style={{ minHeight: '280px' }}>
              {business?.latitude && business?.longitude ? (
                <iframe
                  title="Ubicación Sucursal"
                  width="100%"
                  height="280"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(business.longitude) - 0.005}%2C${Number(business.latitude) - 0.004}%2C${Number(business.longitude) + 0.005}%2C${Number(business.latitude) + 0.004}&layer=mapnik&marker=${Number(business.latitude)}%2C${Number(business.longitude)}`}
                />
              ) : (
                <div className="absolute inset-0 bg-[#fafafa] flex flex-col items-center justify-center gap-3">
                  <p className="text-[10px] text-[#a1a1aa] uppercase tracking-widest font-black">Coordenadas no configuradas</p>
                </div>
              )}
            </div>

            {business?.latitude && business?.longitude && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${business.latitude},${business.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black py-3.5 px-6 rounded-2xl text-[10px] uppercase tracking-widest text-center shadow-md transition-all block"
              >
                📍 Cómo Llegar con Google Maps
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── Vista: Horarios ── */}
      {vistaActiva === 'horarios' && (
        <div className="max-w-sm mx-auto pt-8 px-4 space-y-5 animate-fadeIn">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden border border-[#e4e4e7] shadow-sm bg-white shrink-0">
              <img
                src={business?.logo_url || '/logo.png'}
                alt={business?.nombre || 'LoyaltyClub'}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png' }}
              />
            </div>
            <div>
              <p className="text-xs text-[#71717a] font-medium">⏰ Horarios & Contacto</p>
              <h1 className="text-base font-bold text-[#09090b] tracking-tight">{business?.nombre || 'LoyaltyClub'}</h1>
            </div>
          </div>

          {/* Tarjeta de horarios */}
          <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[#f0f0f0] overflow-hidden p-6 space-y-4">
            <div className="space-y-2">
              {diasSemanaOrdenados.map(dia => {
                const config = horarioSemanal?.[dia.key]
                const esHoy = dia.key === hoyEsp
                return (
                  <div
                    key={dia.key}
                    className={`flex justify-between items-center p-3 rounded-2xl border transition-all ${
                      esHoy
                        ? 'bg-red-50/50 border-[#dc2626]/40 shadow-sm'
                        : 'bg-[#fafafa] border-[#e4e4e7]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {esHoy && <span className="w-2 h-2 rounded-full bg-[#dc2626] animate-pulse" />}
                      <span className={`text-xs font-bold ${esHoy ? 'text-[#dc2626] font-black' : 'text-[#52525b]'}`}>
                        {dia.label}
                      </span>
                      {esHoy && <span className="text-[8px] bg-red-50 border border-red-100 text-[#dc2626] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">Hoy</span>}
                    </div>

                    {config?.cerrado ? (
                      <span className="text-[10px] bg-red-50 border border-red-100 text-[#dc2626] px-2 py-0.5 rounded-full font-bold uppercase">
                        Descanso
                      </span>
                    ) : (
                      <span className={`text-[11px] font-mono font-bold ${esHoy ? 'text-[#09090b]' : 'text-[#71717a]'}`}>
                        {config?.apertura || '14:00'} - {config?.cierre || '22:00'}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Llamada rápida */}
            {business?.telefono_whatsapp && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <a
                  href={`https://wa.me/${'52' + business.telefono_whatsapp.replace(/\D/g, '').slice(-10)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-50 border border-green-200 hover:bg-green-100 text-green-700 font-bold py-3 px-4 rounded-2xl text-[10px] uppercase tracking-widest text-center transition-all block"
                >
                  💬 WhatsApp
                </a>
                <a
                  href={`tel:${business.telefono_whatsapp}`}
                  className="bg-white border border-[#e4e4e7] hover:bg-[#fafafa] text-[#09090b] font-bold py-3 px-4 rounded-2xl text-[10px] uppercase tracking-widest text-center transition-all block"
                >
                  📞 Llamar
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Vista: Redes Sociales ── */}
      {vistaActiva === 'redes' && (
        <div className="max-w-sm mx-auto pt-8 px-4 space-y-5 animate-fadeIn">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden border border-[#e4e4e7] shadow-sm bg-white shrink-0">
              <img
                src={business?.logo_url || '/logo.png'}
                alt={business?.nombre || 'LoyaltyClub'}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png' }}
              />
            </div>
            <div>
              <p className="text-xs text-[#71717a] font-medium">🌐 Redes Sociales</p>
              <h1 className="text-base font-bold text-[#09090b] tracking-tight">{business?.nombre || 'LoyaltyClub'}</h1>
            </div>
          </div>

          {/* Redes */}
          <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[#f0f0f0] overflow-hidden p-6 space-y-4">
            {algunRedeConfigurada ? (
              <div className="grid grid-cols-1 gap-3">
                {linkFacebook && (
                  <a
                    href={linkFacebook.startsWith('http') ? linkFacebook : `https://facebook.com/${linkFacebook}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold py-3 px-5 rounded-2xl flex items-center justify-between shadow-sm transition-all active:scale-95"
                  >
                    <span className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
                      <span className="text-sm">📘</span> Facebook
                    </span>
                    <span className="text-[10px] text-white/70">Seguir →</span>
                  </a>
                )}
                {linkInstagram && (
                  <a
                    href={linkInstagram.startsWith('http') ? linkInstagram : `https://instagram.com/${linkInstagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 text-white font-bold py-3 px-5 rounded-2xl flex items-center justify-between shadow-sm transition-all active:scale-95"
                  >
                    <span className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
                      <span className="text-sm">📸</span> Instagram
                    </span>
                    <span className="text-[10px] text-white/70">Seguir →</span>
                  </a>
                )}
                {linkTiktok && (
                  <a
                    href={linkTiktok.startsWith('http') ? linkTiktok : `https://tiktok.com/@${linkTiktok}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#09090b] text-white font-bold py-3 px-5 rounded-2xl flex items-center justify-between shadow-sm border border-[#27272a] transition-all active:scale-95"
                  >
                    <span className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
                      <span className="text-sm">🎵</span> TikTok
                    </span>
                    <span className="text-[10px] text-white/70">Seguir →</span>
                  </a>
                )}
                {linkYoutube && (
                  <a
                    href={linkYoutube.startsWith('http') ? linkYoutube : `https://youtube.com/${linkYoutube}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#dc2626] text-white font-bold py-3 px-5 rounded-2xl flex items-center justify-between shadow-sm transition-all active:scale-95"
                  >
                    <span className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
                      <span className="text-sm">📺</span> YouTube
                    </span>
                    <span className="text-[10px] text-white/70">Seguir →</span>
                  </a>
                )}
              </div>
            ) : (
              <div className="bg-[#fafafa] rounded-2xl p-8 text-center border border-[#e4e4e7]">
                <p className="text-3xl mb-1.5">🌐</p>
                <p className="font-bold text-xs text-[#09090b]">Próximamente más redes</p>
                <p className="text-[10px] text-[#71717a] mt-0.5">El negocio no ha enlazado perfiles sociales aún.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom Navigation Bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e4e4e7] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] z-40">
        <div className="max-w-sm mx-auto flex justify-around px-1">
          {[
            {
              id: 'tarjeta',
              label: 'Tarjeta',
              icon: CreditCard,
            },
            {
              id: 'menu',
              label: 'Menú',
              icon: UtensilsCrossed,
            },
            {
              id: 'ubicacion',
              label: 'Mapa',
              icon: MapPin,
            },
            {
              id: 'horarios',
              label: 'Horas',
              icon: Clock,
            },
            {
              id: 'redes',
              label: 'Redes',
              icon: Share2,
            },
            {
              id: 'pedido',
              label: 'Pedir',
              icon: Bell,
            },
          ].map((tab) => {
            const Icon = tab.icon
            const activo = vistaActiva === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setVistaActiva(tab.id as any)}
                className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-all relative ${
                  activo ? 'text-[#dc2626]' : 'text-[#a1a1aa] hover:text-[#71717a]'
                }`}
              >
                <Icon className={`w-[18px] h-[18px] transition-transform ${activo ? 'scale-110' : ''}`} />
                <span className={`text-[8px] font-bold tracking-wide ${activo ? 'text-[#dc2626] font-black' : ''}`}>
                  {tab.label}
                </span>
                {activo && (
                  <div className="absolute bottom-0 w-6 h-0.5 bg-[#dc2626] rounded-full" />
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* MODAL DE MODIFICADORES */}
      {productoSeleccionadoMod && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e4e4e7] rounded-3xl p-6 w-full max-w-md shadow-2xl relative animate-fadeIn text-[#09090b]">
            <button 
              onClick={() => setProductoSeleccionadoMod(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#fafafa] hover:bg-[#f4f4f5] flex items-center justify-center transition-colors text-[#71717a] font-bold"
            >
              ✕
            </button>
            
            <div className="flex gap-4 mb-6">
              {productoSeleccionadoMod.imagen_url && (
                <img src={productoSeleccionadoMod.imagen_url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
              )}
              <div>
                <h3 className="text-sm font-black text-[#09090b] tracking-tight">{productoSeleccionadoMod.nombre}</h3>
                <p className="text-[#52525b] text-[10px] mt-1 leading-relaxed font-semibold">{productoSeleccionadoMod.descripcion}</p>
                <p className="text-[#dc2626] font-black text-sm mt-2">${productoSeleccionadoMod.precio.toLocaleString()} MXN</p>
              </div>
            </div>

            {/* Listar modificadores */}
            <div className="space-y-6 max-h-[45vh] overflow-y-auto mb-6 pr-2">
              {productoSeleccionadoMod.product_modifiers?.map(mod => {
                const maxSabores = obtenerMaxSabores(productoSeleccionadoMod)
                const esSabor = esGrupoSabores(mod.nombre)
                
                const maxConfigurado = mod.maximo_permitido !== undefined && mod.maximo_permitido !== null ? mod.maximo_permitido : null
                const esMultiple = maxConfigurado !== null ? maxConfigurado > 1 : (esSabor && maxSabores > 1)
                const limiteMax = maxConfigurado !== null ? maxConfigurado : (esSabor ? maxSabores : 1)

                // Inyectar la opción virtual "Naturales (Sin Salsa)" si es un modificador de sabores
                const modifierOptionsFinal = [...(mod.modifier_options || [])].filter(o => o.disponible !== false)
                if (esSabor && !modifierOptionsFinal.some(o => o.nombre.toLowerCase().includes('natural'))) {
                  modifierOptionsFinal.push({
                    id: 'natural-opt-virtual',
                    nombre: 'Naturales (Sin Salsa)',
                    precio_extra: 0
                  })
                }

                return (
                  <div key={mod.id} className="space-y-3">
                    <div className="flex justify-between items-center border-b border-[#f4f4f5] pb-2">
                      <div>
                        <p className="text-xs font-black text-[#09090b] uppercase tracking-wider">{mod.nombre}</p>
                        {esMultiple && (
                          <p className="text-[9px] text-[#dc2626] font-bold">Selecciona hasta {limiteMax} opciones</p>
                        )}
                      </div>
                      {mod.requerido && (
                        <span className="text-[9px] bg-red-50 border border-red-100 text-[#dc2626] px-2.5 py-0.5 rounded-full font-black uppercase">Requerido</span>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      {modifierOptionsFinal.map(opt => {
                        let seleccionado = false
                        if (esMultiple) {
                          const actuales = seleccionesMod[mod.id] || []
                          seleccionado = Array.isArray(actuales)
                            ? actuales.some((item: any) => item.id === opt.id)
                            : actuales.id === opt.id
                        } else {
                          seleccionado = seleccionesMod[mod.id]?.id === opt.id
                        }

                        return (
                          <label 
                            key={opt.id}
                            onClick={() => seleccionarOpcion(mod, opt)}
                            className={`flex justify-between items-center p-3 rounded-xl border cursor-pointer transition-all ${
                              seleccionado 
                                ? 'bg-red-50/50 border-[#dc2626] text-[#dc2626]' 
                                : 'bg-[#fafafa] border-[#e4e4e7] text-[#52525b] hover:border-[#d4d4d8]'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 border flex items-center justify-center ${
                                esMultiple ? 'rounded-lg' : 'rounded-full'
                              } ${
                                seleccionado ? 'border-[#dc2626] bg-[#dc2626]/10' : 'border-[#e4e4e7]'
                              }`}>
                                {seleccionado && (
                                  <div className={`bg-[#dc2626] ${
                                    esMultiple ? 'w-2.5 h-2.5 rounded-sm' : 'w-2.5 h-2.5 rounded-full'
                                  }`} />
                                )}
                              </div>
                              <span className="text-xs font-black">{opt.nombre}</span>
                            </div>
                            {opt.precio_extra > 0 && (
                              <span className="text-[#dc2626] text-xs font-mono font-bold">+${opt.precio_extra.toLocaleString()} MXN</span>
                            )}
                          </label>
                        )
                      })}

                      {/* Checkbox "Salsa Aparte" para grupos de salsa/sabores */}
                      {esSabor && (
                        <label 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSeleccionesMod(prev => ({ ...prev, 'salsa-aparte': !prev['salsa-aparte'] }))
                          }}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer mt-3 transition-all ${
                            seleccionesMod['salsa-aparte']
                              ? 'bg-red-50/50 border-[#dc2626] text-[#dc2626]' 
                              : 'bg-[#fafafa] border-[#e4e4e7] text-[#52525b] hover:border-[#d4d4d8]'
                          }`}
                        >
                          <div className={`w-5 h-5 border flex items-center justify-center rounded-lg ${
                            seleccionesMod['salsa-aparte'] ? 'border-[#dc2626] bg-[#dc2626]/10' : 'border-[#e4e4e7]'
                          }`}>
                            {seleccionesMod['salsa-aparte'] && (
                              <div className="bg-[#dc2626] w-2.5 h-2.5 rounded-sm" />
                            )}
                          </div>
                          <span className="text-xs font-bold flex items-center gap-1.5">
                            <span>Salsa Aparte 🥣</span>
                            <span className="text-[9px] text-[#71717a] font-normal font-sans">(Se enviará la salsa en un vasito por separado)</span>
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer modal */}
            <div className="border-t border-[#f4f4f5] pt-4 flex gap-3">
              <button 
                onClick={() => setProductoSeleccionadoMod(null)}
                className="flex-1 py-3 border border-[#e4e4e7] rounded-xl text-[#52525b] text-xs font-bold hover:bg-[#fafafa] transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  const faltanRequeridos = productoSeleccionadoMod.product_modifiers?.some(mod => {
                    if (!mod.requerido) return false
                    const sel = seleccionesMod[mod.id]
                    if (Array.isArray(sel)) return sel.length === 0
                    return !sel
                  })
                  if (faltanRequeridos) {
                    alert('Por favor selecciona las opciones obligatorias antes de continuar.')
                    return
                  }
                  agregarAlCarritoDirecto(productoSeleccionadoMod, seleccionesMod)
                }}
                className="flex-1 py-3 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-xl font-black uppercase tracking-wider text-xs shadow-md transition-all active:scale-95"
              >
                Añadir al Pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}