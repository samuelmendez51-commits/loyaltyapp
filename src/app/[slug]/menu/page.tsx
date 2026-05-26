'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { QRCodeSVG } from 'qrcode.react'

// ──────────────────────────────────────────────────────────────────
// TIPOS
// ──────────────────────────────────────────────────────────────────
interface Business {
  id: string; nombre: string; slug: string; logo_url: string; banner_url: string
  telefono_whatsapp: string; max_sellos: number; monto_minimo_sello: number
  estado: string; fecha_vencimiento: string; moneda: string
}
interface MenuGroup { id: string; nombre: string; descripcion: string; tipo_menu: string; activo: boolean; orden: number }
interface MenuProduct {
  id: string; group_id: string; nombre: string; descripcion: string
  precio: number; imagen_url: string; disponible: boolean
  product_modifiers?: ModifierGroup[]
}
interface ModifierGroup { id: string; nombre: string; requerido: boolean; modifier_options: ModifierOption[] }
interface ModifierOption { id: string; nombre: string; precio_extra: number }
interface CartItem { product: MenuProduct; cantidad: number; selecciones: Record<string, ModifierOption>; subtotal: number }
interface LoyaltyReward { id: string; sello_requerido: number; nombre: string; descripcion: string; tipo: string }

// ──────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ──────────────────────────────────────────────────────────────────
export default function MenuPublico({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState('')
  const [tipoMenu, setTipoMenu] = useState<'mesa' | 'delivery'>('delivery')
  const [business, setBusiness] = useState<Business | null>(null)
  const [grupos, setGrupos] = useState<MenuGroup[]>([])
  const [productos, setProductos] = useState<MenuProduct[]>([])
  const [rewards, setRewards] = useState<LoyaltyReward[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [grupoActivo, setGrupoActivo] = useState<string>('')
  const [paso, setPaso] = useState<'menu' | 'checkout' | 'vip_invite' | 'confirmado'>('menu')
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)

  // Estados de Horario Comercial
  const [fueraDeHorario, setFueraDeHorario] = useState(false)
  const [horaApertura, setHoraApertura] = useState('14:00')
  const [horaCierre, setHoraCierre] = useState('22:00')

  // Datos del checkout
  const [form, setForm] = useState({ nombre: '', telefono: '', calle: '', numero: '', colonia: '' })
  const [clienteExistente, setClienteExistente] = useState<any>(null)
  const [aceptaVIP, setAceptaVIP] = useState(false)
  const [orderId, setOrderId] = useState('')
  const [confeti, setConfeti] = useState(false)

  // Detectar tipo de menú por URL param
  useEffect(() => {
    params.then(p => {
      setSlug(p.slug)
      const urlParams = new URLSearchParams(window.location.search)
      const t = urlParams.get('tipo') as 'mesa' | 'delivery'
      if (t) setTipoMenu(t)
    })
  }, [params])

  useEffect(() => {
    if (!slug) return
    cargarDatos()
  }, [slug, tipoMenu])

  const cargarDatos = async () => {
    setCargando(true)

    // Cargar negocio
    const { data: biz } = await supabase
      .from('businesses')
      .select('*')
      .eq('slug', slug)
      .eq('bloqueado_manual', false)
      .maybeSingle()

    if (!biz) { setCargando(false); return }
    if (biz.estado === 'vencido' || biz.bloqueado_manual) { window.location.href = '/suspended'; return }
    setBusiness(biz)

    // Lógica de validación de horarios comerciales
    let apertura = (biz as any).hora_apertura || '14:00'
    let cierre = (biz as any).hora_cierre || '22:00'
    
    if (biz.direccion && biz.direccion.includes('{')) {
      try {
        const jsonStart = biz.direccion.indexOf('{')
        const jsonStr = biz.direccion.substring(jsonStart)
        const parsed = JSON.parse(jsonStr)
        if (parsed.hora_apertura) apertura = parsed.hora_apertura
        if (parsed.hora_cierre) cierre = parsed.hora_cierre
      } catch (err) {
        console.warn("Error parsing schedule fallback JSON in menu:", err)
      }
    }
    
    // Validar si la hora actual está fuera del rango
    const ahora = new Date()
    const horasActual = ahora.getHours()
    const minsActual = ahora.getMinutes()
    const tiempoActualMin = horasActual * 60 + minsActual
    
    const [hAp, mAp] = apertura.split(':').map(Number)
    const [hCi, mCi] = cierre.split(':').map(Number)
    const tiempoApMin = hAp * 60 + mAp
    const tiempoCiMin = hCi * 60 + mCi
    
    let estaCerrado = false
    if (tiempoApMin <= tiempoCiMin) {
      estaCerrado = tiempoActualMin < tiempoApMin || tiempoActualMin > tiempoCiMin
    } else {
      estaCerrado = tiempoActualMin < tiempoApMin && tiempoActualMin > tiempoCiMin
    }
    
    setFueraDeHorario(estaCerrado)
    setHoraApertura(apertura)
    setHoraCierre(cierre)

    // Cargar grupos del menú
    const { data: gData } = await supabase
      .from('menu_groups')
      .select('*')
      .eq('business_id', biz.id)
      .eq('activo', true)
      .in('tipo_menu', [tipoMenu, 'ambos'])
      .order('orden')
    if (gData) {
      setGrupos(gData)
      if (gData.length > 0) setGrupoActivo(gData[0].id)
    }

    // Cargar productos con modificadores
    const { data: pData } = await supabase
      .from('menu_products')
      .select('*, product_modifiers(*, modifier_options(*))')
      .eq('business_id', biz.id)
      .eq('disponible', true)
    if (pData) setProductos(pData as MenuProduct[])

    // Cargar premios intermedios
    const { data: rData } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('business_id', biz.id)
      .eq('activo', true)
      .order('sello_requerido')
    if (rData) setRewards(rData)

    setCargando(false)
  }

  // ── Modificadores de menú y Carrito ────────────────────────────
  const [productoSeleccionadoMod, setProductoSeleccionadoMod] = useState<MenuProduct | null>(null)
  const [seleccionesMod, setSeleccionesMod] = useState<Record<string, ModifierOption>>({})

  const presionarAgregar = (product: MenuProduct) => {
    if (product.product_modifiers && product.product_modifiers.length > 0) {
      setProductoSeleccionadoMod(product)
      const iniciales: Record<string, ModifierOption> = {}
      product.product_modifiers.forEach(mod => {
        if (mod.modifier_options && mod.modifier_options.length > 0) {
          iniciales[mod.id] = mod.modifier_options[0]
        }
      })
      setSeleccionesMod(iniciales)
    } else {
      agregarAlCarritoDirecto(product, {})
    }
  }

  const agregarAlCarritoDirecto = (product: MenuProduct, selecciones: Record<string, ModifierOption>) => {
    const precioExtra = Object.values(selecciones).reduce((sum, opt) => sum + (Number(opt.precio_extra) || 0), 0)
    const precioUnitario = Number(product.precio) + precioExtra
    
    setCart(prev => {
      const existente = prev.find(item => {
        if (item.product.id !== product.id) return false
        const keys1 = Object.keys(item.selecciones)
        const keys2 = Object.keys(selecciones)
        if (keys1.length !== keys2.length) return false
        return keys1.every(k => item.selecciones[k]?.id === selecciones[k]?.id)
      })

      if (existente) {
        return prev.map(item => {
          if (item.product.id === product.id && Object.keys(item.selecciones).every(k => item.selecciones[k]?.id === selecciones[k]?.id)) {
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
      const precioExtra = Object.values(item.selecciones).reduce((sum, opt) => sum + (Number(opt.precio_extra) || 0), 0)
      const precioUnitario = Number(item.product.precio) + precioExtra
      
      return prev.map((it, idx) => idx === index
        ? { ...it, cantidad: it.cantidad - 1, subtotal: (it.cantidad - 1) * precioUnitario }
        : it)
    })
  }

  const totalCarrito = cart.reduce((s, i) => s + i.subtotal, 0)
  const cantidadTotal = cart.reduce((s, i) => s + i.cantidad, 0)

  // Helper para armar el mensaje de WhatsApp estructurado y premium
  const generarTextoWhatsApp = () => {
    if (!business) return ''
    
    let itemsText = cart.map(i => {
      const modText = Object.values(i.selecciones).map(o => ` (+ ${o.nombre})`).join('')
      return `• ${i.cantidad}x ${i.product.nombre}${modText} - $${i.subtotal.toLocaleString()} MXN`
    }).join('\n')
    
    let tipoText = tipoMenu === 'delivery' ? '🛵 A Domicilio (Delivery)' : '🍽️ Comer en Restaurante (Mesa)'
    
    let direccionText = tipoMenu === 'delivery' 
      ? `\n*Dirección:* ${form.calle} #${form.numero}, ${form.colonia}`
      : ''

    const msg = `*NUEVO PEDIDO - ${business.nombre.toUpperCase()}* 🌯🛍️
-----------------------------------
*Cliente:* ${form.nombre}
*Teléfono:* ${form.telefono}
*Tipo:* ${tipoText}${direccionText}

*Resumen de Compra:*
${itemsText}

-----------------------------------
*TOTAL:* $${totalCarrito.toLocaleString()} MXN
-----------------------------------
_Pedido procesado a través de LoyaltyApp VIP_`

    return encodeURIComponent(msg)
  }

  // ── Verificar teléfono ─────────────────────────────────────────
  const verificarTelefono = async () => {
    if (!business) return
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .eq('telefono', form.telefono)
      .eq('business_id', business.id)
      .maybeSingle()
    setClienteExistente(data)

    if (!data) {
      // Nuevo cliente — mostrar invitación VIP
      setPaso('vip_invite')
    } else {
      // Cliente existente — proceder directo
      await crearPedido(data.id, false)
    }
  }

  const crearPedido = async (clienteId: string | null, esNuevo: boolean) => {
    if (!business) return
    setEnviando(true)

    const superaMinimo = totalCarrito >= (business.monto_minimo_sello || 0)
    const otorgarSello = superaMinimo && (clienteId !== null)

    // Crear registro en orders
    const { data: order, error } = await supabase.from('orders').insert({
      business_id: business.id,
      cliente_id: clienteId,
      nombre_cliente: form.nombre,
      telefono_cliente: form.telefono,
      calle: form.calle,
      numero: form.numero,
      colonia: form.colonia,
      tipo: tipoMenu,
      items: cart.map(i => ({
        id: i.product.id,
        nombre: i.product.nombre,
        cantidad: i.cantidad,
        precio_unitario: i.product.precio,
        subtotal: i.subtotal,
      })),
      total: totalCarrito,
      sello_otorgado: otorgarSello,
      sello_aprobado: false,
      sello_rechazado: false,
      estado: 'pendiente',
    }).select().single()

    if (error || !order) { setEnviando(false); alert('Error al procesar el pedido'); return }

    setOrderId(order.id)

    // Registrar evento de tracking
    if (clienteId && otorgarSello) {
      await supabase.from('tracking_events').insert({
        business_id: business.id,
        cliente_id: clienteId,
        order_id: order.id,
        event_type: 'created_pending',
        metadata: { total: totalCarrito, tipo: tipoMenu, es_nuevo: esNuevo },
      })

      // Incrementar puntos inmediatamente (optimista)
      await supabase.from('clientes')
        .update({ puntos: (clienteExistente?.puntos || 0) + 1 })
        .eq('id', clienteId)
    }

    setEnviando(false)

    // Verificar si llegó al sello 10 → confeti
    const puntosNuevos = (clienteExistente?.puntos || 0) + (otorgarSello ? 1 : 0)
    if (puntosNuevos >= (business.max_sellos || 10)) setConfeti(true)

    setPaso('confirmado')
  }

  const registrarNuevoVIP = async () => {
    if (!business) return
    setEnviando(true)

    // Crear cliente VIP nuevo
    const { data: nuevoCliente } = await supabase.from('clientes').insert({
      nombre: form.nombre,
      telefono: form.telefono,
      puntos: 0,
      business_id: business.id,
    }).select().single()

    if (nuevoCliente) {
      await supabase.from('tracking_events').insert({
        business_id: business.id,
        cliente_id: nuevoCliente.id,
        event_type: 'vip_joined',
        metadata: { canal: tipoMenu },
      })
      setClienteExistente(nuevoCliente)
      await crearPedido(nuevoCliente.id, true)
    } else {
      await crearPedido(null, true)
    }
  }

  // ── Confeti ────────────────────────────────────────────────────
  const ConfetiFX = () => (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {[...Array(40)].map((_, i) => (
        <div
          key={i}
          className="absolute w-3 h-3 rounded-sm animate-bounce"
          style={{
            left: `${Math.random() * 100}%`,
            top: `-${Math.random() * 20}px`,
            backgroundColor: ['#f59e0b','#ef4444','#10b981','#3b82f6','#8b5cf6','#ec4899'][i % 6],
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${1 + Math.random() * 2}s`,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
    </div>
  )

  if (cargando) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-zinc-800 border-t-red-600 rounded-full animate-spin" />
    </div>
  )

  if (!business) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white text-center p-6">
      <div>
        <p className="text-5xl mb-4">🔍</p>
        <h1 className="text-2xl font-black mb-2">Negocio no encontrado</h1>
        <p className="text-zinc-400">El enlace que estás usando no es válido.</p>
      </div>
    </div>
  )

  // ── PANTALLA: CONFIRMADO ───────────────────────────────────────
  if (paso === 'confirmado') return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      {confeti && <ConfetiFX />}
      <div className="text-center max-w-sm w-full">
        <div className="w-24 h-24 bg-green-900/40 border border-green-700 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(34,197,94,0.3)]">
          <span className="text-5xl">{confeti ? '🏆' : '✅'}</span>
        </div>
        {confeti && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-2xl p-4 mb-6">
            <p className="text-amber-400 font-black text-lg">¡PREMIO DESBLOQUEADO!</p>
            <p className="text-zinc-300 text-sm mt-1">
              {rewards.find(r => r.tipo === 'final')?.nombre || '¡Felicidades! Recoge tu premio en caja.'}
            </p>
          </div>
        )}
        <h1 className="text-3xl font-black text-white mb-2">¡Pedido Recibido!</h1>
        <p className="text-zinc-400 mb-6 leading-relaxed">
          Tu pedido fue enviado a {business.nombre}. El staff lo revisará y confirmará tu sello pronto.
        </p>
        {business.telefono_whatsapp && (
          <a
            href={`https://wa.me/${business.telefono_whatsapp}?text=${generarTextoWhatsApp()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 text-white font-black py-4 px-8 rounded-2xl mb-4 transition-all"
          >
            📱 Confirmar por WhatsApp
          </a>
        )}
        <button
          onClick={() => { setCart([]); setPaso('menu'); setForm({ nombre: '', telefono: '', calle: '', numero: '', colonia: '' }) }}
          className="text-zinc-500 hover:text-zinc-300 text-sm font-bold"
        >
          Hacer otro pedido
        </button>
      </div>
    </div>
  )

  // ── PANTALLA: INVITACIÓN VIP ────────────────────────────────────
  if (paso === 'vip_invite') return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-700 to-amber-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(212,175,55,0.4)]">
            <span className="text-4xl">⭐</span>
          </div>
          <h2 className="text-2xl font-black text-white mb-2">
            ¿Quieres unirte al Club VIP de {business.nombre}?
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Gana tu <strong className="text-amber-400">primer sello GRATIS</strong> con este pedido y acumula recompensas exclusivas.
          </p>
        </div>

        {rewards.length > 0 && (
          <div className="bg-zinc-900/80 border border-zinc-700 rounded-2xl p-4 mb-6 space-y-2">
            <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">Recompensas que puedes ganar:</p>
            {rewards.map(r => (
              <div key={r.id} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-amber-900/40 border border-amber-700/50 flex items-center justify-center text-xs font-black text-amber-400">
                  {r.sello_requerido}
                </span>
                <div>
                  <p className="text-white text-sm font-bold">{r.nombre}</p>
                  <p className="text-zinc-500 text-xs">{r.descripcion}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={registrarNuevoVIP}
            disabled={enviando}
            className="w-full bg-gradient-to-r from-amber-600 to-amber-800 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-sm transition-all hover:brightness-110 disabled:opacity-50 shadow-[0_0_20px_rgba(212,175,55,0.3)]"
          >
            {enviando ? 'Registrando...' : '⭐ ¡Sí! Quiero unirme al Club VIP'}
          </button>
          <button
            onClick={() => crearPedido(null, false)}
            disabled={enviando}
            className="w-full border border-zinc-700 text-zinc-400 hover:text-white font-bold py-3 rounded-2xl text-sm uppercase tracking-wider transition-all"
          >
            {enviando ? '...' : 'Continuar sin sello'}
          </button>
        </div>
      </div>
    </div>
  )

  // ── PANTALLA: CHECKOUT ──────────────────────────────────────────
  if (paso === 'checkout') return (
    <div className="min-h-screen bg-[#050505] text-white p-4">
      <div className="max-w-lg mx-auto space-y-6 py-6">
        <div>
          <button onClick={() => setPaso('menu')} className="text-zinc-500 hover:text-white text-sm mb-4 block">← Volver</button>
          <h1 className="text-2xl font-black">Confirmar Pedido</h1>
          <p className="text-zinc-400 text-sm">{business.nombre}</p>
        </div>

        {/* Resumen del carrito */}
        <div className="bg-zinc-900/80 border border-zinc-700 rounded-2xl p-4 space-y-3">
          {cart.map(item => (
            <div key={item.product.id} className="flex justify-between items-center">
              <div>
                <p className="font-bold text-sm">{item.cantidad}x {item.product.nombre}</p>
              </div>
              <p className="text-amber-400 font-mono font-bold">${item.subtotal.toLocaleString()}</p>
            </div>
          ))}
          <div className="border-t border-zinc-700 pt-3 flex justify-between font-black">
            <span>Total</span>
            <span className="text-amber-400 text-lg">${totalCarrito.toLocaleString()} MXN</span>
          </div>
          {totalCarrito >= (business.monto_minimo_sello || 0) && (
            <p className="text-green-400 text-xs font-bold text-center bg-green-950/30 border border-green-900/30 rounded-lg py-2">
              ⭐ ¡Este pedido califica para un sello de lealtad!
            </p>
          )}
        </div>

        {/* Formulario de datos */}
        <div className="space-y-4">
          {[
            { key: 'nombre', label: 'Nombre completo', placeholder: 'Juan García', type: 'text' },
            { key: 'telefono', label: 'Número de teléfono', placeholder: '3221234567', type: 'tel' },
            { key: 'calle', label: 'Calle', placeholder: 'Av. Principal', type: 'text' },
            { key: 'numero', label: 'Número', placeholder: '123', type: 'text' },
            { key: 'colonia', label: 'Colonia', placeholder: 'Centro', type: 'text' },
          ].map(field => (
            <div key={field.key}>
              <label className="text-xs text-zinc-400 uppercase tracking-widest font-bold block mb-1">{field.label}</label>
              <input
                type={field.type}
                value={form[field.key as keyof typeof form]}
                onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-600 transition-colors"
              />
            </div>
          ))}
        </div>

        <button
          onClick={verificarTelefono}
          disabled={!form.nombre || !form.telefono || enviando}
          className="w-full bg-gradient-to-r from-red-700 to-red-900 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-sm transition-all hover:brightness-110 disabled:opacity-50 shadow-[0_0_20px_rgba(185,28,28,0.3)]"
        >
          {enviando ? 'Procesando...' : '📦 Confirmar Pedido'}
        </button>
      </div>
    </div>
  )

  // ── PANTALLA PRINCIPAL: MENÚ ────────────────────────────────────
  const productosFiltrados = productos.filter(p => p.group_id === grupoActivo)

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Banner del negocio */}
      <div className="relative h-48 bg-gradient-to-b from-red-950/40 to-[#050505]">
        {business.banner_url && (
          <img src={business.banner_url} alt={business.nombre} className="absolute inset-0 w-full h-full object-cover opacity-20" />
        )}
        <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end gap-4">
          <div className="w-16 h-16 bg-zinc-800 rounded-2xl border border-amber-500/20 flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(251,191,36,0.3)]">
            {business.logo_url
              ? <img src={business.logo_url} alt="" className="w-full h-full object-cover" />
              : <span className="text-3xl">🌯</span>
            }
          </div>
          <div>
            <h1 className="text-2xl font-black">{business.nombre}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${tipoMenu === 'delivery' ? 'bg-blue-500' : 'bg-amber-500'}`} />
              <span className="text-xs text-zinc-400 font-bold uppercase">{tipoMenu === 'delivery' ? '🛵 Delivery' : '🍽️ Comer aquí'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Horario Comercial / Fuera de Horario */}
      {fueraDeHorario && (
        <div className="mx-4 mt-4 bg-red-950/20 border border-red-900/50 rounded-2xl p-5 text-center flex flex-col items-center justify-center gap-3 animate-pulse">
          <div className="w-12 h-12 rounded-full bg-red-950/40 border border-red-800/40 flex items-center justify-center text-xl shadow-lg">
            🔒
          </div>
          <div>
            <h4 className="text-red-400 font-black text-xs uppercase tracking-widest">Cocina Cerrada Temporalmente</h4>
            <p className="text-zinc-300 text-xs mt-1 font-bold">
              Estamos recargando energía. Abrimos a las {horaApertura}.
            </p>
          </div>
        </div>
      )}

      {/* Monto mínimo para sello */}
      {business.monto_minimo_sello > 0 && (
        <div className="mx-4 mt-4 bg-amber-950/30 border border-amber-700/40 rounded-xl px-4 py-2 flex items-center gap-2">
          <span className="text-amber-400">⭐</span>
          <p className="text-xs text-amber-400 font-bold">
            Gana un sello con pedidos de ${business.monto_minimo_sello} MXN o más
          </p>
        </div>
      )}

      {/* Tabs de grupos */}
      <div className="sticky top-0 z-10 bg-[#050505]/95 backdrop-blur-sm border-b border-zinc-800 px-4 overflow-x-auto">
        <div className="flex gap-1 py-3">
          {grupos.map(g => (
            <button
              key={g.id}
              onClick={() => setGrupoActivo(g.id)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                grupoActivo === g.id ? 'bg-red-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {g.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de productos */}
      <div className="p-4 space-y-3 pb-32">
        {grupos.length === 0 && (
          <div className="text-center py-16 text-zinc-600">
            <p className="text-4xl mb-4">🍽️</p>
            <p className="font-bold">El menú aún no tiene productos configurados</p>
          </div>
        )}
        {productosFiltrados.map(product => {
          const enCarrito = cart.find(i => i.product.id === product.id)
          return (
            <div key={product.id} className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 flex gap-4">
              <div className="flex-1">
                <h3 className="font-bold text-white">{product.nombre}</h3>
                {product.descripcion && <p className="text-zinc-500 text-xs mt-1">{product.descripcion}</p>}
                <p className="text-amber-400 font-black mt-2">${product.precio.toLocaleString()}</p>
              </div>
              {product.imagen_url && (
                <img src={product.imagen_url} alt={product.nombre} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
              )}
              <div className="flex flex-col items-center justify-center gap-2">
                {fueraDeHorario ? (
                  <span className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-900 text-zinc-650 flex items-center justify-center cursor-not-allowed text-xs" title="Cocina cerrada por horario comercial">
                    🔒
                  </span>
                ) : enCarrito ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => quitarDelCarrito(product.id)}
                      className="w-7 h-7 rounded-lg bg-zinc-800 text-white font-bold text-lg flex items-center justify-center hover:bg-zinc-700">−</button>
                    <span className="text-white font-black w-4 text-center">{enCarrito.cantidad}</span>
                    <button onClick={() => agregarAlCarrito(product)}
                      className="w-7 h-7 rounded-lg bg-red-800 text-white font-bold text-lg flex items-center justify-center hover:bg-red-700">+</button>
                  </div>
                ) : (
                  <button
                    onClick={() => agregarAlCarrito(product)}
                    className="w-8 h-8 rounded-lg bg-red-800 text-white font-bold text-lg flex items-center justify-center hover:bg-red-700 transition-colors"
                  >+</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Carrito flotante */}
      {cantidadTotal > 0 && !fueraDeHorario && (
        <div className="fixed bottom-4 left-4 right-4 z-50">
          <button
            onClick={() => setPaso('checkout')}
            className="w-full bg-gradient-to-r from-red-700 to-red-900 text-white font-black py-4 rounded-2xl shadow-[0_0_30px_rgba(185,28,28,0.5)] flex items-center justify-between px-6 hover:brightness-110 transition-all"
          >
            <span className="bg-white/20 rounded-lg px-2 py-1 text-sm">{cantidadTotal}</span>
            <span className="uppercase tracking-widest text-sm">Ver Pedido</span>
            <span className="font-mono">${totalCarrito.toLocaleString()}</span>
          </button>
        </div>
      )}

      {/* MODAL DE MODIFICADORES */}
      {productoSeleccionadoMod && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button 
              onClick={() => setProductoSeleccionadoMod(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white text-xl"
            >
              ✕
            </button>
            
            <div className="flex gap-4 mb-6">
              {productoSeleccionadoMod.imagen_url && (
                <img src={productoSeleccionadoMod.imagen_url} alt="" className="w-16 h-16 rounded-xl object-cover" />
              )}
              <div>
                <h3 className="text-lg font-black text-white">{productoSeleccionadoMod.nombre}</h3>
                <p className="text-zinc-500 text-xs mt-1">{productoSeleccionadoMod.descripcion}</p>
                <p className="text-amber-400 font-black text-sm mt-2">${productoSeleccionadoMod.precio.toLocaleString()} MXN</p>
              </div>
            </div>

            {/* Listar modificadores */}
            <div className="space-y-6 max-h-[45vh] overflow-y-auto mb-6 pr-2">
              {productoSeleccionadoMod.product_modifiers?.map(mod => (
                <div key={mod.id} className="space-y-3">
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                    <p className="text-sm font-black text-white uppercase tracking-wider">{mod.nombre}</p>
                    {mod.requerido && (
                      <span className="text-[10px] bg-red-950/60 border border-red-900/60 text-red-400 px-2 py-0.5 rounded-full font-black uppercase">Requerido</span>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    {mod.modifier_options?.map(opt => {
                      const seleccionado = seleccionesMod[mod.id]?.id === opt.id
                      return (
                        <label 
                          key={opt.id}
                          onClick={() => setSeleccionesMod(prev => ({ ...prev, [mod.id]: opt }))}
                          className={`flex justify-between items-center p-3 rounded-xl border cursor-pointer transition-all ${
                            seleccionado 
                              ? 'bg-amber-950/30 border-amber-600 text-white' 
                              : 'bg-black/30 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                              seleccionado ? 'border-amber-500 bg-amber-500/20' : 'border-zinc-700'
                            }`}>
                              {seleccionado && <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />}
                            </div>
                            <span className="text-sm font-bold">{opt.nombre}</span>
                          </div>
                          {opt.precio_extra > 0 && (
                            <span className="text-amber-400 text-xs font-mono font-bold">+${opt.precio_extra.toLocaleString()} MXN</span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer modal */}
            <div className="border-t border-zinc-800 pt-4 flex gap-3">
              <button 
                onClick={() => setProductoSeleccionadoMod(null)}
                className="flex-1 py-3 border border-zinc-800 rounded-xl text-zinc-400 font-bold hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => agregarAlCarritoDirecto(productoSeleccionadoMod, seleccionesMod)}
                className="flex-1 py-3 bg-gradient-to-r from-red-700 to-red-900 text-white rounded-xl font-black uppercase tracking-wider text-xs shadow-lg hover:brightness-110 transition-all"
              >
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
