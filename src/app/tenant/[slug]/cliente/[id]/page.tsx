'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { UtensilsCrossed, Bell, CreditCard, X, Gift, RotateCcw, Send, Lock, MapPin, Clock, Share2 } from 'lucide-react'

// ── Interfaces ────────────────────────────────────────────────────────────────
interface Premio { id: string; nombre: string; estampillas_requeridas: number; imagen_url?: string }

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
 
  const sellosActuales = cliente?.puntos || 0
  const configRango = business?.ruleta_config?.[String(sellosActuales)]
  
  const premiosList = (configRango && configRango.activo && Array.isArray(configRango.premios) && configRango.premios.length > 0)
    ? configRango.premios.map((p: string, i: number) => ({ id: String(i), nombre: p, estampillas_requeridas: sellosActuales }))
    : ((business?.premios_ruleta && Array.isArray(business.premios_ruleta) && business.premios_ruleta.length > 0)
        ? business.premios_ruleta.map((p: string, i: number) => ({ id: String(i), nombre: p, estampillas_requeridas: 10 }))
        : (premios.length > 0 ? premios : [
            { id: '1', nombre: 'Café Gratis', estampillas_requeridas: 10 },
            { id: '2', nombre: 'Postre Sorpresa', estampillas_requeridas: 10 },
            { id: '3', nombre: 'Bebida Grande', estampillas_requeridas: 10 },
            { id: '4', nombre: '20% Descuento', estampillas_requeridas: 10 },
          ])
      )
 
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
    const msg = `¡Hola! Quiero cobrar mi premio ganado en la Ruleta LoyaltyApp: ${premioGanado.nombre}`
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
                <p className="font-bold text-[#09090b]">{business?.nombre || 'LoyaltyApp'}</p>
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
  // slug: negocio del subdominio | id: ID de la tarjeta VIP del cliente
  const { id, slug } = useParams()
  const router = useRouter()
  const [cliente, setCliente] = useState<any>(null)
  const [business, setBusiness] = useState<any>(null)
  const [premios, setPremios] = useState<Premio[]>([])
  const [cargando, setCargando] = useState(true)
  const [activeCoupon, setActiveCoupon] = useState<any>(null)
  const [generandoPremio, setGenerandoPremio] = useState(false)
  const [programaActivo, setProgramaActivo] = useState<any>(null)

  const [generandoGoogle, setGenerandoGoogle] = useState(false)
  const [generandoApple, setGenerandoApple] = useState(false)

  const [vistaActiva, setVistaActiva] = useState<'tarjeta' | 'menu' | 'pedido' | 'ubicacion' | 'horarios' | 'redes'>('tarjeta')
  const [mostrarRuleta, setMostrarRuleta] = useState(false)
  const [menuDigital, setMenuDigital] = useState<any>(null)
  const [ultimoPedidoTotal, setUltimoPedidoTotal] = useState<number>(0)

  const [linkFacebook, setLinkFacebook] = useState('')
  const [linkInstagram, setLinkInstagram] = useState('')
  const [linkTiktok, setLinkTiktok] = useState('')
  const [linkYoutube, setLinkYoutube] = useState('')
  const [horarioSemanal, setHorarioSemanal] = useState<any>(null)

  const getBaseUrl = () => {
    if (typeof window !== 'undefined') return window.location.origin
    if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
    return 'http://localhost:3000'
  }

  useEffect(() => {
    const cargarDatos = async () => {
      if (!id) return
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (clienteData) {
        setCliente(clienteData)
        if (clienteData.business_id) {
          const { data: bizData } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', clienteData.business_id)
            .maybeSingle()
          if (bizData) {
            // ── Guardia cross-tenant ──
            // Impide que tenantB.loyaltyclub.mx/cliente/{idDeTenantA} muestre datos ajenos
            if (slug && bizData.slug !== slug) {
              setCargando(false)
              return // Tarjeta no pertenece a este negocio
            }
            setBusiness(bizData)

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
            setHorarioSemanal(horarioSem || horarioDefault)
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

          // Cargar Programa de Fidelidad Activo (Defensivo por si no se han corrido las migraciones aún)
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

  if (cargando) return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-2 border-[#e4e4e7] border-t-[#dc2626] rounded-full animate-spin mx-auto" />
        <p className="text-sm text-[#71717a] font-medium">Cargando tu tarjeta...</p>
      </div>
    </div>
  )

  if (!cliente) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fafafa] p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-10 text-center shadow-lg border border-[#f0f0f0]">
        <span className="text-5xl block mb-4">⚠️</span>
        <h1 className="text-xl font-bold text-[#09090b] mb-2">Tarjeta No Encontrada</h1>
        <p className="text-sm text-[#71717a]">Este pase VIP no existe o fue eliminado.</p>
      </div>
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
                src={programaActivo?.logo_url || business?.logo_url || '/logo.png'}
                alt={business?.nombre || 'LoyaltyApp'}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png' }}
              />
            </div>
            <div>
              <p className="text-xs text-[#71717a] font-medium">Club de Fidelización</p>
              <h1 className="text-base font-bold text-[#09090b] tracking-tight">{business?.nombre || 'LoyaltyApp'}</h1>
            </div>
          </div>

          {/* Tarjeta Principal */}
          <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[#f0f0f0] overflow-hidden">
            {/* Portada / Banner superior */}
            {programaActivo?.portada_url ? (
              <div className="h-32 w-full overflow-hidden relative">
                <img
                  src={programaActivo.portada_url}
                  alt="Portada Club"
                  className="w-full h-full object-cover animate-fade-in"
                  style={{
                    objectPosition: `center ${
                      programaActivo.portada_url.includes('#y=')
                        ? programaActivo.portada_url.split('#y=')[1]
                        : '50'
                    }%`
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
            ) : (
              /* Acento superior */
              <div className="h-1.5 bg-gradient-to-r from-[#dc2626] via-[#ef4444] to-[#dc2626]" />
            )}

            {/* Nombre del cliente */}
            <div className="px-6 pt-5 pb-3">
              <p className="text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-widest">Socio VIP</p>
              <h2 className="text-2xl font-bold text-[#09090b] tracking-tight mt-0.5">{cliente.nombre}</h2>
              <p className="text-xs text-[#a1a1aa] font-mono">ID: {cliente.id.substring(0, 8)}</p>
            </div>

            {/* Grid de Sellos */}
            <div className="px-6 py-4 bg-[#fafafa] border-y border-[#f0f0f0]">
              <div className="grid grid-cols-5 gap-2.5 place-items-center">
                {[...Array(sellosTotales)].map((_, i) => {
                  const marcado = i < sellosMarcados
                  return (
                    <div key={i} className="flex justify-center items-center w-full">
                      {marcado ? (
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#FFD700] via-[#FDB931] to-[#D4A017] flex items-center justify-center shadow-[0_2px_8px_rgba(255,193,7,0.4)] transition-transform hover:scale-105">
                          <span className="text-[#452000] text-lg font-black">★</span>
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full border-2 border-dashed border-[#d4d4d8] flex items-center justify-center">
                          <span className="text-[#d4d4d8] text-sm">★</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Progreso */}
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-[#71717a]">
                  {tieneRuletaActiva
                    ? '🏆 ¡Ruleta de Premios Activa!'
                    : `Faltan ${sellosTotales - sellosMarcados} sellos`}
                </p>
                <span className="text-sm font-bold text-[#09090b]">{sellosMarcados}/{sellosTotales}</span>
              </div>
              <div className="w-full h-2 bg-[#f4f4f5] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#dc2626] to-[#ef4444] rounded-full transition-all duration-700"
                  style={{ width: `${Math.min((sellosMarcados / sellosTotales) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* QR / Acción principal */}
            <div className="px-6 pb-6 flex flex-col items-center gap-4">
              {tieneRuletaActiva ? (
                <button
                  onClick={() => setMostrarRuleta(true)}
                  className="btn-primary w-full py-4 text-base animate-bounce flex items-center justify-center gap-2"
                >
                  <Gift className="w-5 h-5" />
                  ¡Girar Ruleta de Premios!
                </button>
              ) : tieneEstructuraRuleta && !cumpleMontoMinimoRuleta ? (
                <div className="w-full bg-[#fefcbf] border-2 border-[#ecc94b] rounded-2xl p-5 text-center space-y-3 shadow-sm animate-fadeIn">
                  <div className="w-12 h-12 rounded-full bg-[#fef08a] flex items-center justify-center mx-auto text-[#a16207]">
                    <Lock className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <p className="font-extrabold text-[#854d0e] text-sm flex items-center justify-center gap-1.5">
                      <span>🔒 Ruleta VIP Bloqueada</span>
                    </p>
                    <p className="text-[11px] text-[#a16207] mt-1.5 leading-relaxed">
                      ¡Felicidades! Alcanzaste el rango de sellos necesario. Sin embargo, esta ruleta requiere una compra mínima de <span className="font-extrabold text-red-600">${minRuletaTicket} MXN</span>.
                    </p>
                    <div className="mt-3 py-2 px-3 bg-white/70 border border-[#fef08a] rounded-xl text-[10px] inline-block">
                      <span className="text-[#854d0e]">Tu última compra registrada: </span>
                      <span className="font-bold text-red-600">${ultimoPedidoTotal} MXN</span>
                    </div>
                    <p className="text-[9px] text-[#b45309] mt-2 italic">
                      Realiza un pedido desde el menú o en caja que iguale o supere este monto para activarla.
                    </p>
                  </div>
                </div>
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

      {/* ── Vista: Menú Digital ── */}
      {vistaActiva === 'menu' && (
        <div className="max-w-sm mx-auto pt-8 px-4 space-y-5 animate-fadeIn">
          {/* Header del portal */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden border border-[#e4e4e7] shadow-sm bg-white shrink-0">
              <img
                src={business?.logo_url || '/logo.png'}
                alt={business?.nombre || 'LoyaltyApp'}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png' }}
              />
            </div>
            <div>
              <p className="text-xs text-[#71717a] font-medium">Carta & Club VIP</p>
              <h1 className="text-base font-bold text-[#09090b] tracking-tight">{business?.nombre || 'LoyaltyApp'}</h1>
            </div>
          </div>

          {/* Tarjeta Unificada / Sección Integrada */}
          <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[#f0f0f0] overflow-hidden p-6 space-y-5">
            <div>
              <p className="text-[10px] font-semibold text-[#dc2626] uppercase tracking-wider">Menú y Catálogos</p>
              <h3 className="text-lg font-bold text-[#09090b] tracking-tight mt-0.5">Nuestra Carta Digital</h3>
            </div>

            {/* Listado de Catálogos */}
            <div className="space-y-3">
              {menuDigital?.url_consumo_local && (
                <a
                  href={menuDigital.url_consumo_local}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-[#fafafa] border border-[#e4e4e7] rounded-2xl p-4 hover:bg-[#fef2f2] transition-colors"
                >
                  <div className="w-10 h-10 bg-white border border-[#e4e4e7] rounded-xl flex items-center justify-center shrink-0">
                    <span className="text-lg">📋</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-[#09090b] truncate">Catálogo PDF (Comer Aquí)</p>
                    <p className="text-[11px] text-[#71717a] truncate">Menú oficial para consumo en mesa</p>
                  </div>
                  <span className="text-xs font-bold text-[#dc2626] shrink-0">Ver →</span>
                </a>
              )}

              {menuDigital?.url_domicilio && (
                <a
                  href={menuDigital.url_domicilio}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-[#fafafa] border border-[#e4e4e7] rounded-2xl p-4 hover:bg-[#fef2f2] transition-colors"
                >
                  <div className="w-10 h-10 bg-white border border-[#e4e4e7] rounded-xl flex items-center justify-center shrink-0">
                    <span className="text-lg">🛵</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-[#09090b] truncate">Catálogo Web (Domicilio)</p>
                    <p className="text-[11px] text-[#71717a] truncate">Pide directamente a domicilio</p>
                  </div>
                  <span className="text-xs font-bold text-[#dc2626] shrink-0">Ver →</span>
                </a>
              )}

              {(!menuDigital?.url_consumo_local && !menuDigital?.url_domicilio) && (
                <div className="bg-[#fafafa] rounded-2xl p-6 text-center border border-[#e4e4e7]">
                  <p className="text-3xl mb-1.5">🍽️</p>
                  <p className="font-bold text-sm text-[#09090b]">Menú No Disponible</p>
                  <p className="text-xs text-[#71717a] mt-0.5">El negocio no ha configurado sus cartas digitales.</p>
                </div>
              )}
            </div>

            {/* Invitación al Club VIP */}
            <div className="border-t border-[#f0f0f0] pt-5">
              <div className="bg-gradient-to-br from-[#fef2f2] to-[#fffaf8] border border-[#fecaca] rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex gap-2.5 items-start">
                  <div className="w-9 h-9 rounded-xl bg-white border border-[#fca5a5] flex items-center justify-center shrink-0">
                    <span className="text-lg">🎟️</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#dc2626] uppercase tracking-wider">¡Club de Lealtad VIP!</h4>
                    <p className="text-xs text-[#52525b] mt-0.5 leading-relaxed">
                      Acumula sellos en cada compra para ganar postres, bebidas o comidas gratis en sucursal.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setVistaActiva('tarjeta')}
                  className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all shadow-[0_2px_8px_rgba(220,38,38,0.25)] flex items-center justify-center gap-1.5"
                >
                  Ver Mi Tarjeta VIP
                </button>
              </div>
            </div>
          </div>
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
                alt={business?.nombre || 'LoyaltyApp'}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png' }}
              />
            </div>
            <div>
              <p className="text-xs text-[#71717a] font-medium">📍 Nuestra Ubicación</p>
              <h1 className="text-base font-bold text-[#09090b] tracking-tight">{business?.nombre || 'LoyaltyApp'}</h1>
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
                alt={business?.nombre || 'LoyaltyApp'}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png' }}
              />
            </div>
            <div>
              <p className="text-xs text-[#71717a] font-medium">⏰ Horarios & Contacto</p>
              <h1 className="text-base font-bold text-[#09090b] tracking-tight">{business?.nombre || 'LoyaltyApp'}</h1>
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
                alt={business?.nombre || 'LoyaltyApp'}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png' }}
              />
            </div>
            <div>
              <p className="text-xs text-[#71717a] font-medium">🌐 Redes Sociales</p>
              <h1 className="text-base font-bold text-[#09090b] tracking-tight">{business?.nombre || 'LoyaltyApp'}</h1>
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
    </main>
  )
}