'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { QRCodeSVG } from 'qrcode.react'

// ──────────────────────────────────────────────────────────────────
// TIPOS
// ──────────────────────────────────────────────────────────────────
interface Business {
  id: string; nombre: string; slug: string; logo_url: string; banner_url: string
  telefono_whatsapp: string; max_sellos: number; monto_minimo_sello: number
  estado: string; fecha_vencimiento: string; moneda: string
  latitude?: number; longitude?: number; direccion?: string; color_primario?: string
}
interface MenuGroup { id: string; nombre: string; descripcion: string; tipo_menu: string; activo: boolean; orden: number }
interface MenuProduct {
  id: string; group_id: string; nombre: string; descripcion: string
  precio: number; imagen_url: string; disponible: boolean; es_upsell?: boolean
  product_modifiers?: ModifierGroup[]
  suspension_tipo?: string
  suspension_hasta?: string
}
interface ModifierGroup { id: string; nombre: string; requerido: boolean; modifier_options: ModifierOption[] }
interface ModifierOption { id: string; nombre: string; precio_extra: number }
interface CartItem { product: MenuProduct; cantidad: number; selecciones: Record<string, any>; subtotal: number }
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
  const [paso, setPaso] = useState<'menu' | 'upsell' | 'checkout' | 'vip_invite' | 'confirmado'>('menu')
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [backUrl, setBackUrl] = useState('')

  // Nuevos Estados para Pestañas del Portal del Cliente (B2C)
  const [pestañaActiva, setPestañaActiva] = useState<'menu' | 'ubicacion' | 'contacto' | 'redes'>('menu')
  const [linkFacebook, setLinkFacebook] = useState('')
  const [linkInstagram, setLinkInstagram] = useState('')
  const [linkTiktok, setLinkTiktok] = useState('')
  const [linkYoutube, setLinkYoutube] = useState('')
  const [horarioSemanal, setHorarioSemanal] = useState<any>(null)
  const [googleMapsCargado, setGoogleMapsCargado] = useState(false)
  const [categoriasColapsadas, setCategoriasColapsadas] = useState<Record<string, boolean>>({})

  // Estados de Ruleta de Hitos VIP
  const [mostrarRuleta, setMostrarRuleta] = useState(false)
  const [milestoneAlcanzado, setMilestoneAlcanzado] = useState<any | null>(null)
  const [ruletaGirando, setRuletaGirando] = useState(false)
  const [anguloGiro, setAnguloGiro] = useState(0)
  const [premioGanado, setPremioGanado] = useState<any | null>(null)
  const [codigoCuponRuleta, setCodigoCuponRuleta] = useState('')

  // Estados de Horario Comercial
  const [fueraDeHorario, setFueraDeHorario] = useState(false)
  const [horaAperturaHoy, setHoraAperturaHoy] = useState('14:00')
  const [horaCierreHoy, setHoraCierreHoy] = useState('22:00')

  // Datos del checkout
  const [form, setForm] = useState({ nombre: '', telefono: '', calle: '', numero: '', colonia: '', referencia: '' })
  const [mapaCargado, setMapaCargado] = useState(false)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [coordenadasPin, setCoordenadasPin] = useState<{ lat: number; lng: number } | null>(null)
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia'>('efectivo')
  const [telefonoAutocompletar, setTelefonoAutocompletar] = useState('')
  const [mostrandoAutocompletar, setMostrandoAutocompletar] = useState(false)
  const [buscandoAutocompletar, setBuscandoAutocompletar] = useState(false)

  const ejecutarAutocompletado = async () => {
    const telClean = telefonoAutocompletar.trim()
    if (!telClean) {
      alert('Por favor ingresa un número de teléfono.')
      return
    }
    setBuscandoAutocompletar(true)
    try {
      const { data: cliente, error: cliErr } = await supabase
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

      if (cliente || ultimaOrden) {
        setForm({
          nombre: cliente?.nombre || ultimaOrden?.nombre || '',
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

  const [clienteExistente, setClienteExistente] = useState<any>(null)
  const [aceptaVIP, setAceptaVIP] = useState(false)
  const [orderId, setOrderId] = useState('')
  const [confeti, setConfeti] = useState(false)

  // Detectar tipo de menú y backUrl por URL params
  useEffect(() => {
    params.then(p => {
      setSlug(p.slug)
      const urlParams = new URLSearchParams(window.location.search)
      const t = urlParams.get('tipo') as 'mesa' | 'delivery'
      if (t) setTipoMenu(t)
      const back = urlParams.get('back')
      if (back) setBackUrl(back)
    })
  }, [params])

  useEffect(() => {
    if (!slug) return
    cargarDatos()
  }, [slug, tipoMenu])

  // Intersection Observer para destacar la categoría activa al hacer scroll
  useEffect(() => {
    if (pestañaActiva !== 'menu' || grupos.length === 0) return
    
    const observerOptions = {
      root: null,
      rootMargin: '-140px 0px -60% 0px', // se activa cuando el elemento está en la parte superior
      threshold: 0
    }
    
    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id.replace('category-section-', '')
          setGrupoActivo(id)
        }
      })
    }
    
    const observer = new IntersectionObserver(observerCallback, observerOptions)
    
    grupos.forEach(g => {
      const el = document.getElementById(`category-section-${g.id}`)
      if (el) observer.observe(el)
    })
    
    return () => {
      observer.disconnect()
    }
  }, [pestañaActiva, grupos, productos])

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

    const stepCheckout = (paso === 'checkout')
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
  }, [mapaCargado, paso, tipoMenu, business])

  // Cargar Google Maps en B2C
  useEffect(() => {
    if (pestañaActiva !== 'ubicacion') return
    if (!business || !business.latitude || !business.longitude) return
    setGoogleMapsCargado(true)
  }, [pestañaActiva, business])

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

    // ── CONFIGURACIÓN DE REDES SOCIALES Y HORARIOS DIARIOS ──
    let linkFb = (biz as any).link_facebook || ''
    let linkIg = (biz as any).link_instagram || ''
    let linkTk = (biz as any).link_tiktok || ''
    let linkYt = (biz as any).link_youtube || ''
    let horarioSem = (biz as any).horario_semanal || null

    // Fallback JSON in direccion
    if (biz.direccion && biz.direccion.includes('{')) {
      try {
        const jsonStart = biz.direccion.indexOf('{')
        const jsonStr = biz.direccion.substring(jsonStart)
        const parsed = JSON.parse(jsonStr)
        if (parsed.facebook) linkFb = parsed.facebook
        if (parsed.instagram) linkIg = parsed.instagram
        if (parsed.tiktok) linkTk = parsed.tiktok
        if (parsed.youtube) linkYt = parsed.youtube
        if (parsed.horario_semanal) horarioSem = parsed.horario_semanal
      } catch (err) {
        console.warn("Error parsing schedule fallback JSON in menu:", err)
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

    // ── LAZY CHECKER B2C: SANEAMIENTO DE STOCK ──
    const { data: pData } = await supabase
      .from('menu_products')
      .select('*, product_modifiers(*, modifier_options(*))')
      .eq('business_id', biz.id)

    if (pData) {
      const ahora = new Date()
      let huboCambio = false

      const productosProcesados = await Promise.all(pData.map(async (prod: any) => {
        if (!prod.disponible && prod.suspension_hasta && new Date(prod.suspension_hasta) < ahora) {
          await supabase
            .from('menu_products')
            .update({ disponible: true, suspension_tipo: 'indefinida', suspension_hasta: null })
            .eq('id', prod.id)
          huboCambio = true
          return { ...prod, disponible: true, suspension_tipo: 'indefinida', suspension_hasta: null }
        }
        return prod
      }))

      // Filtrar los disponibles y agregarlos
      const disponibles = productosProcesados.filter((p: any) => p.disponible)
      setProductos(disponibles as MenuProduct[])

      if (huboCambio) {
        setTimeout(() => { cargarDatos() }, 200)
      }
    }

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
  const [seleccionesMod, setSeleccionesMod] = useState<Record<string, any>>({})

  // Helpers para Alitas de La Burreria
  const obtenerMaxSabores = (product: MenuProduct) => {
    const nombre = product.nombre.toLowerCase()
    const esAlitas = nombre.includes('alitas') || nombre.includes('wings') || nombre.includes('charola')
    if (!esAlitas) return 1
    
    // Encontrar todos los números en el nombre y seleccionar el más grande (típicamente las piezas)
    const matches = nombre.match(/\d+/g)
    let piezas = 8
    if (matches) {
      const numeros = matches.map(m => parseInt(m, 10))
      piezas = Math.max(...numeros)
    }
    
    // 1 sabor por cada 8 alitas
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
      const yOffset = -130 // compensa el header pegajoso doble
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
          const esSabor = esGrupoSabores(mod.nombre)
          const maxS = obtenerMaxSabores(product)
          if (esSabor && maxS > 1) {
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
    const maxSabores = obtenerMaxSabores(productoSeleccionadoMod!)
    const esSabor = esGrupoSabores(mod.nombre)

    if (esSabor && maxSabores > 1) {
      // Selección múltiple para sabores de alitas
      const actuales: ModifierOption[] = Array.isArray(seleccionesMod[mod.id])
        ? seleccionesMod[mod.id]
        : (seleccionesMod[mod.id] ? [seleccionesMod[mod.id]] : [])

      const yaSeleccionado = actuales.some(item => item.id === opt.id)
      if (yaSeleccionado) {
        // Permitir deseleccionar solo si no es la única opción requerida o tiene más seleccionados
        if (actuales.length > 1 || !mod.requerido) {
          const nuevos = actuales.filter(item => item.id !== opt.id)
          setSeleccionesMod(prev => ({ ...prev, [mod.id]: nuevos }))
        }
      } else {
        if (actuales.length < maxSabores) {
          const nuevos = [...actuales, opt]
          setSeleccionesMod(prev => ({ ...prev, [mod.id]: nuevos }))
        } else {
          alert(`Solo puedes seleccionar hasta ${maxSabores} sabores para esta orden de alitas.`)
        }
      }
    } else {
      // Selección normal (radio button)
      setSeleccionesMod(prev => ({ ...prev, [mod.id]: opt }))
    }
  }

  const agregarAlCarritoDirecto = (product: MenuProduct, selecciones: Record<string, any>) => {
    const precioExtra = Object.values(selecciones).reduce((sum, opt) => {
      if (Array.isArray(opt)) {
        return sum + opt.reduce((s, o) => s + (Number(o.precio_extra) || 0), 0)
      }
      return sum + (Number(opt?.precio_extra) || 0)
    }, 0)
    const precioUnitario = Number(product.precio) + precioExtra
    
    setCart(prev => {
      const existente = prev.find(item => {
        if (item.product.id !== product.id) return false
        const keys1 = Object.keys(item.selecciones)
        const keys2 = Object.keys(selecciones)
        if (keys1.length !== keys2.length) return false
        return keys1.every(k => {
          const opt1 = item.selecciones[k]
          const opt2 = selecciones[k]
          if (Array.isArray(opt1) && Array.isArray(opt2)) {
            if (opt1.length !== opt2.length) return false
            return opt1.every(o1 => opt2.some(o2 => o2.id === o1.id))
          }
          return opt1?.id === opt2?.id
        })
      })

      if (existente) {
        return prev.map(item => {
          const matched = item.product.id === product.id && Object.keys(item.selecciones).every(k => {
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
      const precioExtra = Object.values(item.selecciones).reduce((sum, opt) => {
        if (Array.isArray(opt)) {
          return sum + opt.reduce((s, o) => s + (Number(o.precio_extra) || 0), 0)
        }
        return sum + (Number(opt?.precio_extra) || 0)
      }, 0)
      const precioUnitario = Number(item.product.precio) + precioExtra
      
      return prev.map((it, idx) => idx === index
        ? { ...it, cantidad: it.cantidad - 1, subtotal: (it.cantidad - 1) * precioUnitario }
        : it)
    })
  }

  const totalCarrito = cart.reduce((s, i) => s + i.subtotal, 0)
  const cantidadTotal = cart.reduce((s, i) => s + i.cantidad, 0)

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

  // Helper para armar el mensaje de WhatsApp estructurado y premium
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
      ? `\n*Dirección:* ${form.calle} #${form.numero}, ${form.colonia}${form.referencia ? ` (Ref: ${form.referencia})` : ''}` +
        (coordenadasPin ? `\n*Ubicación GPS:* https://www.google.com/maps?q=${coordenadasPin.lat},${coordenadasPin.lng}` : '')
      : ''

    const msg = `*NUEVO PEDIDO - ${business.nombre.toUpperCase()}* 🛍️✨
-----------------------------------
*Cliente:* ${form.nombre}
*Teléfono:* ${form.telefono}
*Tipo:* ${tipoText}${pagoText}${direccionText}

*Resumen de Compra:*
${itemsText}

-----------------------------------
*TOTAL:* $${totalCarrito.toLocaleString()} MXN
-----------------------------------
_Pedido procesado a través de LoyaltyApp VIP_`

    return encodeURIComponent(msg)
  }

  const verificarTelefono = async () => {
    if (!business) return
    const cleanDigits = (form.telefono || '').replace(/\D/g, '')
    const last10 = cleanDigits.slice(-10)
    if (last10.length !== 10) {
      alert('Por favor ingresa un teléfono válido de 10 dígitos.')
      return
    }
    const telNormalizado = `+52${last10}`
    
    // Actualizar estado del form con el teléfono limpio
    setForm(prev => ({ ...prev, telefono: telNormalizado }))

    const { data } = await supabase
      .from('clientes')
      .select('*')
      .eq('telefono', telNormalizado)
      .eq('business_id', business.id)
      .maybeSingle()
    setClienteExistente(data)

    if (!data) {
      setPaso('vip_invite')
    } else {
      await crearPedido(data.id, false)
    }
  }

  const crearPedido = async (clienteId: string | null, esNuevo: boolean) => {
    if (!business) return
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
          cliente_id: clienteId,
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
    setEnviando(false)

    const puntosNuevos = (clienteExistente?.puntos || 0) + (logoSelloGranted ? 1 : 0)
    if (puntosNuevos >= (business.max_sellos || 10)) setConfeti(true)

    if (clienteId && logoSelloGranted) {
      try {
        const { data: milestonesData } = await supabase
          .from('reward_milestones')
          .select('*, milestone_prizes(*)')
          .eq('business_id', business.id)
          .eq('activo', true)

        const milestone = (milestonesData || []).find(m => m.sello_objetivo === puntosNuevos)

        if (milestone && milestone.milestone_prizes && milestone.milestone_prizes.length > 0) {
          setMilestoneAlcanzado(milestone)
          const pool = milestone.milestone_prizes
          
          let rand = Math.random() * 100
          let acumulado = 0
          let prizeElegido = pool[0]
          for (const p of pool) {
            acumulado += p.probabilidad || 0
            if (rand <= acumulado) {
              prizeElegido = p
              break
            }
          }
          setPremioGanado(prizeElegido)
          
          const { data: spinData } = await supabase
            .from('roulette_spins')
            .insert({
              business_id: business.id,
              cliente_id: clienteId,
              milestone_id: milestone.id,
              prize_id: prizeElegido.id,
              prize_nombre: prizeElegido.nombre,
              sello_numero: puntosNuevos,
            })
            .select()
            .single()
            
          if (spinData && spinData.codigo_cupon) {
            setCodigoCuponRuleta(spinData.codigo_cupon)
          } else {
            setCodigoCuponRuleta(Math.random().toString(36).substring(2, 10).toUpperCase())
          }
          setMostrarRuleta(true)
        }
      } catch (err) {
        console.error("Error setting up stamp milestone roulette:", err)
      }
    }

    setPaso('confirmado')
  }

  const registrarNuevoVIP = async () => {
    if (!business) return
    setEnviando(true)

    const cleanDigits = (form.telefono || '').replace(/\D/g, '')
    const last10 = cleanDigits.slice(-10)
    const telNormalizado = last10.length === 10 ? `+52${last10}` : form.telefono

    const { data: nuevoCliente } = await supabase.from('clientes').insert({
      nombre: form.nombre || null,
      telefono: telNormalizado,
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

  const irACheckout = () => {
    const upsellDisponibles = productos.filter(p => p.es_upsell && p.disponible)
    const yaTieneUpsell = cart.some(item => item.product.es_upsell)
    if (upsellDisponibles.length > 0 && !yaTieneUpsell) {
      setPaso('upsell')
    } else {
      setPaso('checkout')
    }
  }

  const girarRuleta = () => {
    if (ruletaGirando || !milestoneAlcanzado || !premioGanado) return
    setRuletaGirando(true)
    
    const pool = milestoneAlcanzado.milestone_prizes || []
    const idx = pool.findIndex((p: any) => p.id === premioGanado.id)
    const count = pool.length
    
    const rebanadaGrados = 360 / count
    const centroGrados = (idx * rebanadaGrados) + (rebanadaGrados / 2)
    const anguloParada = 360 - centroGrados
    
    const totalGiro = 1800 + anguloParada
    setAnguloGiro(totalGiro)
    
    setTimeout(() => {
      setRuletaGirando(false)
    }, 4000)
  }

  const ConfetiFX = () => (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {[...Array(40)].map((_, i) => (
        <div
          key={i}
          className="absolute w-3 h-3 rounded-sm animate-bounce"
          style={{
            left: `${Math.random() * 100}%`,
            top: `-${Math.random() * 20}px`,
            backgroundColor: ['#dc2626','#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899'][i % 6],
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${1 + Math.random() * 2}s`,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
    </div>
  )

  if (cargando) return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-[#e4e4e7] border-t-[#dc2626] rounded-full animate-spin" />
    </div>
  )

  if (!business) return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center text-[#09090b] text-center p-6 font-sans">
      <div className="bg-white border border-[#e4e4e7] rounded-3xl p-10 max-w-sm w-full shadow-lg">
        <p className="text-5xl mb-4">🔍</p>
        <h1 className="text-2xl font-black mb-2 text-[#09090b]">Negocio no encontrado</h1>
        <p className="text-[#52525b] text-sm">El enlace que estás usando no es válido.</p>
      </div>
    </div>
  )

  // PANTALLA: CONFIRMADO
  if (paso === 'confirmado') return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-6 font-sans">
      {confeti && <ConfetiFX />}
      <div className="text-center max-w-sm w-full bg-white border border-[#e4e4e7] p-8 rounded-3xl shadow-lg">
        <div className="w-24 h-24 bg-green-50 border border-green-200 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-5xl">{confeti ? '🏆' : '✅'}</span>
        </div>
        {confeti && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-6">
            <p className="text-[#dc2626] font-black text-lg">¡PREMIO DESBLOQUEADO!</p>
            <p className="text-[#52525b] text-sm mt-1">
              {rewards.find(r => r.tipo === 'final')?.nombre || '¡Felicidades! Recoge tu premio en caja.'}
            </p>
          </div>
        )}
        <h1 className="text-3xl font-black text-[#09090b] mb-2">¡Pedido Recibido!</h1>
        <p className="text-[#52525b] text-sm mb-6 leading-relaxed">
          Tu pedido fue enviado a {business.nombre}. El staff lo revisará y confirmará tu sello pronto.
        </p>
        {business.telefono_whatsapp && (
          <a
            href={`https://wa.me/${'52' + business.telefono_whatsapp.replace(/\D/g, '').slice(-10)}?text=${generarTextoWhatsApp()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-black py-4 px-8 rounded-2xl mb-4 transition-all"
          >
            📱 Confirmar por WhatsApp
          </a>
        )}
        <button
          onClick={() => { setCart([]); setPaso('menu'); setForm({ nombre: '', telefono: '', calle: '', numero: '', colonia: '', referencia: '' }) }}
          className="text-[#a1a1aa] hover:text-[#52525b] text-sm font-bold mt-2"
        >
          Hacer otro pedido
        </button>
      </div>
    </div>
  )

  // PANTALLA: INVITACIÓN VIP
  if (paso === 'vip_invite') return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-6 font-sans">
      <div className="max-w-sm w-full bg-white border border-[#e4e4e7] p-8 rounded-3xl shadow-lg">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">⭐</span>
          </div>
          <h2 className="text-2xl font-black text-[#09090b] mb-2 leading-tight">
            ¿Quieres unirte al Club VIP de {business.nombre}?
          </h2>
          <p className="text-[#52525b] text-sm leading-relaxed">
            Gana tu <strong className="text-[#dc2626]">primer sello GRATIS</strong> con este pedido y acumula recompensas exclusivas.
          </p>
        </div>

        {rewards.length > 0 && (
          <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-2xl p-4 mb-6 space-y-3">
            <p className="text-xs font-black text-[#a1a1aa] uppercase tracking-widest">Recompensas que puedes ganar:</p>
            {rewards.map(r => (
              <div key={r.id} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-xs font-black text-[#dc2626]">
                  {r.sello_requerido}
                </span>
                <div>
                  <p className="text-[#09090b] text-sm font-bold">{r.nombre}</p>
                  <p className="text-[#71717a] text-xs">{r.descripcion}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={registrarNuevoVIP}
            disabled={enviando}
            className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black py-4 rounded-2xl uppercase tracking-widest text-sm transition-all disabled:opacity-50"
          >
            {enviando ? 'Registrando...' : '⭐ ¡Sí! Quiero unirme al Club VIP'}
          </button>
          <button
            onClick={() => crearPedido(null, false)}
            disabled={enviando}
            className="w-full border border-[#e4e4e7] text-[#52525b] hover:bg-[#fafafa] font-bold py-3 rounded-2xl text-sm uppercase tracking-wider transition-all"
          >
            {enviando ? '...' : 'Continuar sin sello'}
          </button>
        </div>
      </div>
    </div>
  )

  // PANTALLA: UPSELL
  if (paso === 'upsell') {
    const upsellDisponibles = productos.filter(p => p.es_upsell && p.disponible)
    return (
      <div className="min-h-screen bg-[#fafafa] text-[#09090b] p-4 flex items-center justify-center font-sans">
        <div className="max-w-md w-full bg-white border border-[#e4e4e7] p-8 rounded-3xl shadow-lg space-y-6 text-center">
          <div className="space-y-2">
            <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center mx-auto mb-2">
              <span className="text-3xl">🍟</span>
            </div>
            <h1 className="text-2xl font-black text-[#09090b] tracking-tight">¿Te gustaría agregar un acompañamiento?</h1>
            <p className="text-[#a1a1aa] text-xs uppercase tracking-widest font-bold">Ofertas de Venta Cruzada VIP</p>
          </div>

          <div className="space-y-3 text-left">
            {upsellDisponibles.map(product => {
              const enCarrito = cart.find(i => i.product.id === product.id)
              return (
                <div key={product.id} className="bg-[#fafafa] border border-[#e4e4e7] rounded-2xl p-4 flex gap-4 items-center">
                  {product.imagen_url && (
                    <img src={product.imagen_url} alt={product.nombre} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[#09090b] text-sm truncate">{product.nombre}</h3>
                    {product.descripcion && <p className="text-[#52525b] text-[10px] truncate mt-0.5">{product.descripcion}</p>}
                    <p className="text-[#dc2626] font-black text-xs mt-1">${product.precio.toLocaleString()} MXN</p>
                  </div>
                  <div>
                    {enCarrito ? (
                      <span className="text-xs bg-green-50 border border-green-200 text-green-700 font-black uppercase px-2.5 py-1 rounded-xl">Añadido ✓</span>
                    ) : (
                      <button
                        onClick={() => agregarAlCarritoDirecto(product, {})}
                        className="bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-all"
                      >
                        ➕ Añadir
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="space-y-3 pt-4">
            <button
              onClick={() => setPaso('checkout')}
              className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all"
            >
              Continuar al Pago 📦
            </button>
            <button
              onClick={() => setPaso('menu')}
              className="w-full border border-[#e4e4e7] text-[#52525b] hover:bg-[#fafafa] font-bold py-3 rounded-2xl text-xs uppercase tracking-wider transition-all"
            >
              Volver al Menú
            </button>
          </div>
        </div>
      </div>
    )
  }

  // PANTALLA: CHECKOUT
  if (paso === 'checkout') return (
    <div className="min-h-screen bg-[#fafafa] text-[#09090b] p-4 font-sans">
      <div className="max-w-lg mx-auto bg-white border border-[#e4e4e7] rounded-3xl shadow-lg p-6 space-y-6 py-6">
        <div>
          <button onClick={() => setPaso('menu')} className="text-[#52525b] hover:text-[#09090b] text-sm mb-4 block font-semibold">← Volver</button>
          <h1 className="text-2xl font-black text-[#09090b] tracking-tight">Confirmar Pedido</h1>
          <p className="text-[#52525b] text-sm">{business.nombre}</p>
        </div>

        {/* Resumen del carrito */}
        <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-2xl p-4 space-y-3 shadow-sm">
          {cart.map((item, index) => (
            <div key={`${item.product.id}-${index}`} className="flex justify-between items-start gap-4 animate-fadeIn border-b border-[#f4f4f5] pb-2.5 last:border-b-0 last:pb-0">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setCart(prev => prev.filter((_, idx) => idx !== index))
                    }}
                    className="text-red-500 hover:text-red-700 transition-colors w-4 h-4 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center font-bold text-[10px] shrink-0"
                    title="Eliminar de carrito"
                  >
                    ×
                  </button>
                  <p className="font-bold text-sm text-[#09090b]">{item.cantidad}x {item.product.nombre}</p>
                </div>
                {Object.keys(item.selecciones).length > 0 && (
                  <p className="text-[11px] text-[#52525b] mt-0.5 leading-relaxed pl-6">
                    {Object.entries(item.selecciones).map(([key, o]: [string, any]) => {
                      if (key === 'salsa-aparte') return o ? '🥣 Salsa Aparte' : ''
                      if (Array.isArray(o)) {
                        return o.map(subOpt => `• ${subOpt.nombre}`).join(', ')
                      }
                      return `• ${o?.nombre || ''}`
                    }).filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
              <p className="text-[#dc2626] font-mono font-bold shrink-0">${item.subtotal.toLocaleString()} MXN</p>
            </div>
          ))}
          <div className="border-t border-[#e4e4e7] pt-3 flex justify-between font-black">
            <span className="text-[#09090b]">Total</span>
            <span className="text-[#dc2626] text-lg">${totalCarrito.toLocaleString()} MXN</span>
          </div>
          {totalCarrito >= (business.monto_minimo_sello || 0) && (
            <p className="text-green-700 text-xs font-bold text-center bg-green-50 border border-green-200 rounded-lg py-2">
              ⭐ ¡Este pedido califica para un sello de lealtad!
            </p>
          )}
        </div>

        {/* Módulo Premium Autocompletar */}
        <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-2xl p-4 space-y-3 shadow-xs">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-[#09090b]">🔑 ¿Ya tienes cuenta?</span>
            <button
              type="button"
              onClick={() => setMostrandoAutocompletar(!mostrandoAutocompletar)}
              className="text-[11px] bg-[#09090b] hover:bg-zinc-800 text-white font-extrabold px-3 py-1.5 rounded-xl transition-all"
            >
              {mostrandoAutocompletar ? 'Cancelar' : 'Autocompletar mis datos'}
            </button>
          </div>
          {mostrandoAutocompletar && (
            <div className="space-y-3 pt-1 border-t border-[#e4e4e7] animate-fadeIn">
              <p className="text-[11px] text-[#71717a] leading-normal font-semibold">Ingresa tu número de celular y recuperaremos tu nombre y dirección histórica para ahorrarte tiempo.</p>
              <div className="flex gap-2">
                <input
                  type="tel"
                  placeholder="Ej: 3221234567"
                  value={telefonoAutocompletar}
                  onChange={e => setTelefonoAutocompletar(e.target.value)}
                  className="bg-white border border-[#e4e4e7] rounded-xl px-4 py-2.5 text-xs text-[#09090b] flex-1 focus:outline-none focus:border-[#dc2626]"
                />
                <button
                  type="button"
                  onClick={ejecutarAutocompletado}
                  disabled={buscandoAutocompletar}
                  className="bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-black px-4 rounded-xl transition-all disabled:opacity-50"
                >
                  {buscandoAutocompletar ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Formulario de datos */}
        <div className="space-y-4">
          {[
            { key: 'nombre', label: 'Nombre completo', placeholder: 'Juan García', type: 'text' },
            { key: 'telefono', label: 'Número de teléfono', placeholder: '3221234567', type: 'tel' },
          ].map(field => (
            <div key={field.key}>
              <label className="text-xs text-[#52525b] uppercase tracking-widest font-semibold block mb-1.5">{field.label}</label>
              <input
                type={field.type}
                value={form[field.key as keyof typeof form]}
                onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-3 text-[#09090b] text-sm focus:outline-none focus:border-[#dc2626] transition-colors"
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
                  <label className="text-xs text-[#52525b] uppercase tracking-widest font-semibold block mb-1.5">{field.label}</label>
                  <input
                    type={field.type}
                    value={form[field.key as keyof typeof form]}
                    onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-4 py-3 text-[#09090b] text-sm focus:outline-none focus:border-[#dc2626] transition-colors"
                  />
                </div>
              ))}

              {/* Leaflet Map Selector */}
              <div className="space-y-1.5">
                <label className="text-xs text-[#52525b] uppercase tracking-widest font-semibold block">Ubicación GPS (Arrastra el Pin)</label>
                <p className="text-[11px] text-[#71717a] font-medium leading-normal">
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
            <label className="text-xs text-[#52525b] uppercase tracking-widest font-semibold block">Método de Pago</label>
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
              <p className="text-xs text-[#71717a] italic mt-1.5 font-medium leading-relaxed bg-[#f4f4f5] p-2.5 rounded-xl border border-[#e4e4e7]">
                *Nota: Los pagos por transferencia deberán ser confirmados por el restaurante antes de proceder con el envío de tu pedido. Envía tu comprobante cuando seas redirigido a WhatsApp.
              </p>
            )}
          </div>
        </div>

        <button
          onClick={verificarTelefono}
          disabled={!form.nombre || !form.telefono || enviando}
          className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black py-4 rounded-2xl uppercase tracking-widest text-sm transition-all disabled:opacity-50"
        >
          {enviando ? 'Procesando...' : '📦 Confirmar Pedido'}
        </button>
      </div>
    </div>
  )

  // ── PANTALLA PRINCIPAL: CARTA PREMIUM ──
  const productosFiltrados = productos.filter(p => p.group_id === grupoActivo)

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

  const algunRedeConfigurada = linkFacebook || linkInstagram || linkTiktok || linkYoutube

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#09090b] font-sans pb-32">
      {/* Sticky Header if backUrl is present */}
      {backUrl && (
        <div className="bg-white border-b border-[#e4e4e7] px-4 py-3.5 sticky top-0 z-30 flex items-center justify-between shadow-sm">
          <button
            onClick={() => window.location.href = backUrl}
            className="text-[#52525b] hover:text-[#09090b] text-sm font-semibold flex items-center gap-1.5 transition-colors"
          >
            ← Regresar al Portal
          </button>
          <span className="text-xs text-[#a1a1aa] font-mono">Socio VIP</span>
        </div>
      )}

      {/* Banner del negocio */}
      <div className="relative h-48 bg-gradient-to-b from-[#fafafa] to-white border-b border-[#e4e4e7]">
        {business.banner_url && (
          <img 
            src={business.banner_url.startsWith('http') || business.banner_url.startsWith('/') || business.banner_url.startsWith('data:') ? business.banner_url : `/${business.banner_url}`} 
            alt={business.nombre} 
            className="absolute inset-0 w-full h-full object-cover opacity-10" 
          />
        )}
        <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end gap-4">
          <div className="w-16 h-16 bg-white rounded-2xl border border-[#e4e4e7] flex items-center justify-center overflow-hidden shadow-md">
            {business.logo_url ? (
              business.logo_url.startsWith('http') || business.logo_url.startsWith('/') || business.logo_url.startsWith('data:') || business.logo_url.endsWith('.png') || business.logo_url.endsWith('.jpg') || business.logo_url.endsWith('.svg') || business.logo_url.endsWith('.jpeg') || business.logo_url.endsWith('.webp') ? (
                <img 
                  src={business.logo_url.startsWith('http') || business.logo_url.startsWith('/') || business.logo_url.startsWith('data:') ? business.logo_url : `/${business.logo_url}`} 
                  alt="" 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <span className="text-3xl font-bold">{business.logo_url}</span>
              )
            ) : (
              <span className="text-3xl">✨</span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#09090b] tracking-tight">{business.nombre}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${tipoMenu === 'delivery' ? 'bg-blue-500' : 'bg-amber-500'}`} />
              <span className="text-xs text-[#52525b] font-bold uppercase">{tipoMenu === 'delivery' ? '🛵 Delivery' : '🍽️ Comer aquí'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── BARRA DE PESTAÑAS (TAB BAR PREMIUM) ── */}
      <div className="border-b border-[#e4e4e7] bg-white sticky top-0 z-20 shadow-sm">
        <div className="flex justify-around items-center max-w-lg mx-auto">
          {[
            { id: 'menu', label: 'Menú', icon: '🍽️' },
            { id: 'ubicacion', label: 'Ubicación', icon: '📍' },
            { id: 'contacto', label: 'Horarios', icon: '📞' },
            { id: 'redes', label: 'Redes', icon: '🌐' }
          ].map(tab => {
            const activo = pestañaActiva === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setPestañaActiva(tab.id as any)}
                className={`flex-1 py-4 flex flex-col items-center gap-1 transition-all relative ${
                  activo ? 'text-[#dc2626] font-black scale-105' : 'text-[#a1a1aa] hover:text-[#52525b] font-bold'
                }`}
              >
                <span className="text-xl">{tab.icon}</span>
                <span className="text-[10px] uppercase tracking-wider">{tab.label}</span>
                {activo && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#dc2626]" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── PESTAÑA: MENÚ DE PRODUCTOS ── */}
      {pestañaActiva === 'menu' && (
        <div className="animate-fade-in">
          {/* Si está fuera de horario, mostrar la hermosa pantalla de descanso */}
          {fueraDeHorario ? (
            <div className="px-4 py-16 flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-6 font-sans">
              <div className="w-24 h-24 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-5xl animate-pulse">
                🔋💤
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-[#09090b]">¡Estamos en descanso!</h3>
                <p className="text-[#52525b] text-xs uppercase tracking-widest font-bold">Para llegar con toda la pila</p>
                <p className="text-[#71717a] text-sm leading-relaxed pt-2">
                  Nuestra cocina se encuentra cerrada en este momento. Te invitamos a consultar nuestros horarios o escribirnos directamente.
                </p>
              </div>

              <div className="bg-white border border-[#e4e4e7] rounded-2xl p-4 w-full text-left space-y-1.5 shadow-sm">
                <p className="text-[9px] text-[#a1a1aa] uppercase font-black tracking-widest">Horario de Hoy</p>
                <p className="text-[#09090b] text-sm font-bold">
                  Hoy abrimos de <span className="text-[#dc2626] font-mono">{horaAperturaHoy}</span> a <span className="text-[#dc2626] font-mono">{horaCierreHoy}</span>
                </p>
              </div>

              {business.telefono_whatsapp && (
                <a
                  href={`https://wa.me/${'52' + business.telefono_whatsapp.replace(/\D/g, '').slice(-10)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold py-3.5 px-6 rounded-2xl text-sm transition-all shadow-sm"
                >
                  💬 Escríbenos por WhatsApp
                </a>
              )}
            </div>
          ) : (
            <>
              {/* Monto mínimo para sello */}
              {business.monto_minimo_sello > 0 && (
                <div className="mx-4 mt-4 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <span className="text-[#dc2626]">⭐</span>
                  <p className="text-xs text-[#dc2626] font-bold">
                    Gana un sello con pedidos de ${business.monto_minimo_sello} MXN o más
                  </p>
                </div>
              )}



              {/* Lista de productos agrupada (Rappi-style) */}
              <div className="p-4 space-y-8 pb-32">
                {grupos.length === 0 && (
                  <div className="text-center py-16 text-[#a1a1aa]">
                    <p className="text-4xl mb-4">🍽️</p>
                    <p className="font-bold">El menú aún no tiene productos configurados</p>
                  </div>
                )}
                {grupos.map(g => {
                  const productosDelGrupo = productos.filter(p => p.group_id === g.id && p.disponible)
                  if (productosDelGrupo.length === 0) return null // no mostrar categorías vacías
                  
                  const colapsada = categoriasColapsadas[g.id] !== undefined ? categoriasColapsadas[g.id] : true
                  return (
                    <div key={g.id} id={`category-section-${g.id}`} className="space-y-3 scroll-mt-[135px]">
                      <button
                        onClick={() => setCategoriasColapsadas(prev => ({ ...prev, [g.id]: !colapsada }))}
                        className="w-full sticky top-[125px] bg-[#fafafa]/90 backdrop-blur-sm z-10 py-3 px-1 border-b border-[#f4f4f5] flex justify-between items-center text-left animate-fade-in"
                      >
                        <div>
                          <h2 className="font-black text-lg text-[#09090b] tracking-tight">{g.nombre}</h2>
                          {g.descripcion && <p className="text-xs text-[#71717a] mt-0.5 font-normal">{g.descripcion}</p>}
                        </div>
                        <span className={`text-[#dc2626] font-bold text-sm transform transition-transform duration-200 shrink-0 ${colapsada ? 'rotate-90' : '-rotate-90'} mr-2`}>
                          ❮
                        </span>
                      </button>
                      
                      {!colapsada && (
                        <div className="space-y-3 animate-fade-in">
                          {productosDelGrupo.map(product => {
                            const enCarrito = cart.find(i => i.product.id === product.id)
                            const tieneModificadores = product.product_modifiers && product.product_modifiers.length > 0
                            const totalAgregado = cart.filter(item => item.product.id === product.id).reduce((sum, item) => sum + item.cantidad, 0)
                            
                            return (
                              <div key={product.id} className="bg-white border border-[#e4e4e7] rounded-2xl p-4 flex gap-4 hover:border-[#d4d4d8] hover:shadow-md transition-all">
                                <div className="flex-1">
                                  <h3 className="font-bold text-[#09090b] text-sm sm:text-base flex flex-wrap items-center gap-1.5">
                                    {product.nombre}
                                    {tieneModificadores && totalAgregado > 0 && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#fef2f2] text-[#dc2626] border border-red-100 shrink-0 animate-fadeIn">
                                        {totalAgregado} agregado{totalAgregado !== 1 ? 's' : ''}
                                      </span>
                                    )}
                                  </h3>
                                  {product.descripcion && <p className="text-[#52525b] text-xs mt-1 line-clamp-2">{product.descripcion}</p>}
                                  <p className="text-[#dc2626] font-black text-sm mt-2">${product.precio.toLocaleString()} MXN</p>
                                </div>
                                {product.imagen_url && (
                                  <img src={product.imagen_url} alt={product.nombre} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                                )}
                                <div className="flex flex-col items-center justify-center gap-2">
                                  {tieneModificadores ? (
                                    <button
                                      onClick={() => agregarAlCarrito(product)}
                                      className="px-3.5 py-1.5 rounded-lg bg-[#dc2626] text-white font-extrabold text-xs flex items-center justify-center gap-1 hover:bg-[#b91c1c] transition-all active:scale-95 shadow-sm"
                                    >
                                      + Agregar
                                    </button>
                                  ) : enCarrito ? (
                                    <div className="flex items-center gap-2 bg-[#fafafa] p-1 rounded-lg border border-[#e4e4e7]">
                                      <button onClick={() => quitarDelCarrito(product.id)}
                                        className="w-7 h-7 rounded-lg bg-[#f4f4f5] text-[#52525b] font-bold text-lg flex items-center justify-center hover:bg-[#e4e4e7] transition-colors">−</button>
                                      <span className="text-[#09090b] font-black w-4 text-center text-sm">{enCarrito.cantidad}</span>
                                      <button onClick={() => agregarAlCarrito(product)}
                                        className="w-7 h-7 rounded-lg bg-[#dc2626] text-white font-bold text-lg flex items-center justify-center hover:bg-[#b91c1c] transition-colors">+</button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => agregarAlCarrito(product)}
                                      className="w-8 h-8 rounded-lg bg-[#dc2626] text-white font-bold text-lg flex items-center justify-center hover:bg-[#b91c1c] transition-all active:scale-95 shadow-md"
                                    >+</button>
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
            </>
          )}
        </div>
      )}

      {/* ── PESTAÑA: UBICACIÓN Y MAPA ── */}
      {pestañaActiva === 'ubicacion' && (
        <div className="p-4 space-y-6 max-w-lg mx-auto animate-fade-in pb-20">
          <div className="space-y-2 text-center sm:text-left">
            <h2 className="text-xl font-black text-[#09090b]">📍 Nuestra Ubicación</h2>
            <p className="text-[#a1a1aa] text-xs uppercase tracking-widest font-bold">Cómo encontrarnos</p>
            <div className="bg-white border border-[#e4e4e7] rounded-2xl p-4 text-sm text-[#52525b] leading-relaxed font-semibold shadow-sm">
              {obtenerDireccionLimpia()}
            </div>
          </div>

          <div className="relative w-full rounded-2xl overflow-hidden border border-[#e4e4e7] shadow-lg bg-[#fafafa]" style={{ minHeight: '320px' }}>
            {business.latitude && business.longitude ? (
              <iframe
                title="Ubicación Sucursal"
                width="100%"
                height="320"
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

          {business.latitude && business.longitude && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${business.latitude},${business.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black py-4 px-6 rounded-2xl text-xs uppercase tracking-widest text-center shadow-md transition-all block"
            >
              📍 Cómo Llegar con Google Maps
            </a>
          )}
        </div>
      )}

      {/* ── PESTAÑA: HORARIOS Y CONTACTOS ── */}
      {pestañaActiva === 'contacto' && (
        <div className="p-4 space-y-6 max-w-lg mx-auto animate-fade-in pb-20">
          <div className="space-y-2 text-center sm:text-left">
            <h2 className="text-xl font-black text-[#09090b]">📞 Horarios & Contacto</h2>
            <p className="text-[#a1a1aa] text-xs uppercase tracking-widest font-bold">Planifica tu visita</p>
          </div>

          {/* Lista de días */}
          <div className="bg-white border border-[#e4e4e7] rounded-3xl p-6 space-y-3 shadow-sm">
            {diasSemanaOrdenados.map(dia => {
              const config = horarioSemanal?.[dia.key]
              const esHoy = dia.key === hoyEsp
              return (
                <div
                  key={dia.key}
                  className={`flex justify-between items-center p-3.5 rounded-2xl border transition-all ${
                    esHoy
                      ? 'bg-red-50/50 border-[#dc2626]/40 shadow-[0_2px_10px_rgba(220,38,38,0.05)]'
                      : 'bg-[#fafafa] border-[#e4e4e7]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {esHoy && <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626] animate-pulse" />}
                    <span className={`text-sm font-bold ${esHoy ? 'text-[#dc2626] font-black' : 'text-[#52525b]'}`}>
                      {dia.label}
                    </span>
                    {esHoy && <span className="text-[8px] bg-red-50 border border-red-100 text-[#dc2626] px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Hoy</span>}
                  </div>

                  {config?.cerrado ? (
                    <span className="text-xs bg-red-50 border border-red-100 text-[#dc2626] px-3 py-1 rounded-full font-bold uppercase">
                      Descanso
                    </span>
                  ) : (
                    <span className={`text-xs font-mono font-bold ${esHoy ? 'text-[#09090b]' : 'text-[#71717a]'}`}>
                      {config?.apertura || '14:00'} - {config?.cierre || '22:00'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Botones de acción de llamada/mensaje */}
          <div className="grid grid-cols-2 gap-4">
            {business.telefono_whatsapp && (
              <a
                href={`https://wa.me/${'52' + business.telefono_whatsapp.replace(/\D/g, '').slice(-10)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-50 border border-green-200 hover:bg-green-100 text-green-700 font-bold py-3.5 px-6 rounded-2xl text-xs uppercase tracking-widest text-center transition-all block"
              >
                💬 WhatsApp
              </a>
            )}
            {business.telefono_whatsapp && (
              <a
                href={`tel:${business.telefono_whatsapp}`}
                className="bg-white border border-[#e4e4e7] hover:bg-[#fafafa] text-[#09090b] font-bold py-3.5 px-6 rounded-2xl text-xs uppercase tracking-widest text-center transition-all block"
              >
                📞 Llamar
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── PESTAÑA: REDES SOCIALES ── */}
      {pestañaActiva === 'redes' && (
        <div className="p-4 space-y-6 max-w-lg mx-auto animate-fade-in pb-20">
          <div className="space-y-2 text-center sm:text-left">
            <h2 className="text-xl font-black text-[#09090b]">🌐 Redes Sociales</h2>
            <p className="text-[#a1a1aa] text-xs uppercase tracking-widest font-bold">Conéctate con nosotros</p>
          </div>

          {algunRedeConfigurada ? (
            <div className="grid grid-cols-1 gap-3.5">
              {linkFacebook && (
                <a
                  href={linkFacebook.startsWith('http') ? linkFacebook : `https://facebook.com/${linkFacebook}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-between shadow-md transition-all hover:scale-[1.01]"
                >
                  <span className="font-black text-sm uppercase tracking-widest flex items-center gap-3">
                    <span className="text-lg">📘</span> Facebook
                  </span>
                  <span className="text-xs text-white/70">Seguir →</span>
                </a>
              )}
              {linkInstagram && (
                <a
                  href={linkInstagram.startsWith('http') ? linkInstagram : `https://instagram.com/${linkInstagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-between shadow-md transition-all hover:scale-[1.01]"
                >
                  <span className="font-black text-sm uppercase tracking-widest flex items-center gap-3">
                    <span className="text-lg">📸</span> Instagram
                  </span>
                  <span className="text-xs text-white/70">Seguir →</span>
                </a>
              )}
              {linkTiktok && (
                <a
                  href={linkTiktok.startsWith('http') ? linkTiktok : `https://tiktok.com/@${linkTiktok}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#09090b] text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-between shadow-md border border-[#27272a] transition-all hover:scale-[1.01]"
                >
                  <span className="font-black text-sm uppercase tracking-widest flex items-center gap-3">
                    <span className="text-lg">🎵</span> TikTok
                  </span>
                  <span className="text-xs text-white/70">Seguir →</span>
                </a>
              )}
              {linkYoutube && (
                <a
                  href={linkYoutube.startsWith('http') ? linkYoutube : `https://youtube.com/${linkYoutube}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#dc2626] text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-between shadow-md transition-all hover:scale-[1.01]"
                >
                  <span className="font-black text-sm uppercase tracking-widest flex items-center gap-3">
                    <span className="text-lg">📺</span> YouTube
                  </span>
                  <span className="text-xs text-white/70">Seguir →</span>
                </a>
              )}
            </div>
          ) : (
            <div className="bg-white border border-[#e4e4e7] rounded-3xl p-16 text-center shadow-sm">
              <p className="text-5xl mb-4">🌐</p>
              <p className="font-bold text-lg text-[#09090b]">Próximamente más redes sociales</p>
              <p className="text-[#a1a1aa] text-xs mt-2 leading-relaxed">
                El negocio aún no ha enlazado perfiles sociales, ¡pero mantente al pendiente de nuestras próximas actualizaciones!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Carrito flotante */}
      {cantidadTotal > 0 && !fueraDeHorario && pestañaActiva === 'menu' && (
        <div className="fixed bottom-4 left-4 right-4 z-50 max-w-lg mx-auto">
          <button
            onClick={irACheckout}
            className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black py-4 rounded-2xl shadow-lg flex items-center justify-between px-6 transition-all active:scale-[0.99]"
          >
            <span className="bg-white/20 rounded-lg px-2.5 py-1 text-sm">{cantidadTotal}</span>
            <span className="uppercase tracking-widest text-sm font-black">Ver Pedido</span>
            <span className="font-mono">${totalCarrito.toLocaleString()}</span>
          </button>
        </div>
      )}

      {/* MODAL DE MODIFICADORES */}
      {productoSeleccionadoMod && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e4e4e7] rounded-3xl p-6 w-full max-w-md shadow-2xl relative animate-fadeIn text-[#09090b]">
            <button 
              onClick={() => setProductoSeleccionadoMod(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#fafafa] hover:bg-[#f4f4f5] flex items-center justify-center transition-colors text-[#71717a]"
            >
              ✕
            </button>
            
            <div className="flex gap-4 mb-6">
              {productoSeleccionadoMod.imagen_url && (
                <img src={productoSeleccionadoMod.imagen_url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
              )}
              <div>
                <h3 className="text-lg font-black text-[#09090b] tracking-tight">{productoSeleccionadoMod.nombre}</h3>
                <p className="text-[#52525b] text-xs mt-1 leading-relaxed">{productoSeleccionadoMod.descripcion}</p>
                <p className="text-[#dc2626] font-black text-sm mt-2">${productoSeleccionadoMod.precio.toLocaleString()} MXN</p>
              </div>
            </div>

            {/* Listar modificadores */}
            <div className="space-y-6 max-h-[45vh] overflow-y-auto mb-6 pr-2">
              {productoSeleccionadoMod.product_modifiers?.map(mod => {
                const maxSabores = obtenerMaxSabores(productoSeleccionadoMod)
                const esSabor = esGrupoSabores(mod.nombre)
                
                // Inyectar la opción virtual "Naturales (Sin Salsa)" si es un modificador de sabores
                const modifierOptionsFinal = [...(mod.modifier_options || [])]
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
                        <p className="text-sm font-black text-[#09090b] uppercase tracking-wider">{mod.nombre}</p>
                        {esSabor && maxSabores > 1 && (
                          <p className="text-[10px] text-[#dc2626] font-semibold">Selecciona hasta {maxSabores} sabores</p>
                        )}
                      </div>
                      {mod.requerido && (
                        <span className="text-[10px] bg-red-50 border border-red-100 text-[#dc2626] px-2.5 py-0.5 rounded-full font-black uppercase">Requerido</span>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      {modifierOptionsFinal.map(opt => {
                        let seleccionado = false
                        if (esSabor && maxSabores > 1) {
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
                                esSabor && maxSabores > 1 ? 'rounded-lg' : 'rounded-full'
                              } ${
                                seleccionado ? 'border-[#dc2626] bg-[#dc2626]/10' : 'border-[#e4e4e7]'
                              }`}>
                                {seleccionado && (
                                  <div className={`bg-[#dc2626] ${
                                    esSabor && maxSabores > 1 ? 'w-2.5 h-2.5 rounded-sm' : 'w-2.5 h-2.5 rounded-full'
                                  }`} />
                                )}
                              </div>
                              <span className="text-sm font-bold">{opt.nombre}</span>
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
                          <span className="text-sm font-bold flex items-center gap-1.5">
                            <span>Salsa Aparte 🥣</span>
                            <span className="text-[10px] text-[#71717a] font-normal font-sans">(Se enviará la salsa en un vasito por separado)</span>
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
                className="flex-1 py-3 border border-[#e4e4e7] rounded-xl text-[#52525b] font-bold hover:bg-[#fafafa] transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  // Validar modificadores requeridos
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
                className="flex-1 py-3 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-xl font-black uppercase tracking-wider text-xs shadow-md transition-all"
              >
                Añadir al Pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RULETA VIP */}
      {mostrarRuleta && milestoneAlcanzado && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e4e4e7] rounded-3xl p-6 w-full max-w-sm shadow-2xl relative text-center space-y-6 animate-fadeIn font-sans text-[#09090b]">
            <div>
              <p className="text-[#dc2626] font-black text-xs uppercase tracking-widest animate-pulse">🎰 HITO VIP DESBLOQUEADO 🎰</p>
              <h2 className="text-xl font-black text-[#09090b] mt-1 tracking-tight">¡Gira la Ruleta de Premios!</h2>
              <p className="text-[#71717a] text-[10px] mt-0.5">Hito del Sello {milestoneAlcanzado.sello_objetivo} de {business?.nombre}</p>
            </div>

            <div className="relative w-48 h-48 mx-auto my-4">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 text-[#dc2626] text-3xl z-10 filter drop-shadow-[0_2px_4px_rgba(220,38,38,0.3)]">
                ▼
              </div>

              <div 
                style={{ 
                  transform: `rotate(${anguloGiro}deg)`, 
                  transition: anguloGiro > 0 ? 'transform 4s cubic-bezier(0.15, 0.85, 0.15, 1)' : 'none' 
                }}
                className="w-full h-full rounded-full border-4 border-[#e4e4e7] shadow-lg overflow-hidden"
              >
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  {(() => {
                    const pool = milestoneAlcanzado.milestone_prizes || []
                    const count = pool.length
                    const colors = ['#dc2626','#3b82f6','#10b981','#f59e0b','#a855f7','#ec4899']
                    return pool.map((p: any, i: number) => {
                      const pct = 1 / count
                      const startAngle = i * pct * 2 * Math.PI
                      const endAngle = (i + 1) * pct * 2 * Math.PI
                      
                      const x1 = 50 + 50 * Math.cos(startAngle - Math.PI / 2)
                      const y1 = 50 + 50 * Math.sin(startAngle - Math.PI / 2)
                      const x2 = 50 + 50 * Math.cos(endAngle - Math.PI / 2)
                      const y2 = 50 + 50 * Math.sin(endAngle - Math.PI / 2)
                      const large = pct > 0.5 ? 1 : 0
                      
                      const textAngle = startAngle + (endAngle - startAngle) / 2 - Math.PI / 2
                      const tx = 50 + 32 * Math.cos(textAngle)
                      const ty = 52 + 32 * Math.sin(textAngle)
                      const rotDeg = (textAngle * 180) / Math.PI + 90
                      
                      return (
                        <g key={p.id}>
                          <path
                            d={`M 50 50 L ${x1.toFixed(2)} ${y1.toFixed(2)} A 50 50 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`}
                            fill={colors[i % colors.length]}
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />
                          <text 
                            x={tx} 
                            y={ty} 
                            transform={`rotate(${rotDeg}, ${tx}, ${ty})`}
                            textAnchor="middle" 
                            fontSize="5.5" 
                            fill="white" 
                            fontWeight="900"
                            className="select-none font-sans"
                          >
                            {p.nombre.substring(0, 10)}
                          </text>
                        </g>
                      )
                    })
                  })()}
                  <circle cx="50" cy="50" r="10" fill="#ffffff" stroke="#e4e4e7" strokeWidth="1.5" />
                  <circle cx="50" cy="50" r="3" fill="#dc2626" />
                </svg>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              {anguloGiro === 0 ? (
                <button
                  onClick={girarRuleta}
                  className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black py-3.5 rounded-2xl uppercase tracking-widest text-xs transition-all shadow-md"
                >
                  🎰 ¡Girar la Rueda! 🎰
                </button>
              ) : ruletaGirando ? (
                <div className="flex flex-col items-center gap-2 py-2">
                  <div className="w-6 h-6 border-2 border-[#e4e4e7] border-t-[#dc2626] rounded-full animate-spin" />
                  <p className="text-[10px] text-[#a1a1aa] uppercase font-black tracking-widest animate-pulse">Girando la suerte...</p>
                </div>
              ) : (
                <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-2xl p-4 space-y-3 animate-fadeIn">
                  <p className="text-[9px] text-[#dc2626] uppercase font-black tracking-widest font-sans">🎉 Recompensa VIP Ganada 🎉</p>
                  <p className="text-lg font-black text-[#09090b] tracking-tight">{premioGanado?.nombre}</p>
                  
                  <div className="border-t border-[#e4e4e7] pt-3 space-y-1.5">
                    <p className="text-[9px] text-[#a1a1aa] uppercase font-bold">Cupón para Canjear en Mostrador</p>
                    <div className="bg-white border border-[#e4e4e7] rounded-xl py-2 px-4 font-mono font-black text-[#09090b] tracking-wider text-sm select-all">
                      {codigoCuponRuleta}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setMostrarRuleta(false)}
                    className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black py-2.5 rounded-xl uppercase tracking-wider text-[10px] transition-colors mt-2"
                  >
                    Entendido, continuar 📦
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
