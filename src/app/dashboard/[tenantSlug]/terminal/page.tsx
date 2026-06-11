'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Menu as MenuIcon,
  Store,
  Wifi,
  Bell,
  Settings,
  User,
  History,
  DollarSign,
  Clock,
  HelpCircle,
  LogOut,
  Check,
  Printer,
  Bluetooth,
  RefreshCw,
  AlertCircle,
  MapPin,
  ChevronRight,
  TrendingUp,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  Flame,
  Truck,
  Coffee,
  CheckCircle2,
  X
} from 'lucide-react'

// ── Interfaces ────────────────────────────────────────────────────────────────
interface Order {
  id: string
  business_id: string
  nombre_cliente: string
  telefono_cliente: string
  calle: string
  numero: string
  colonia: string
  tipo: string // 'delivery' | 'mostrador' | 'mesa'
  items: any[]
  total: number
  sello_otorgado: boolean
  sello_aprobado: boolean
  sello_rechazado: boolean
  estado: string // 'pendiente' | 'aprobado' | 'entregado' | 'cancelado'
  created_at: string
  delivery_status?: string // 'PENDING' | 'SHIPPED_SCHEDULED' | 'SHIPPED_IMMEDIATE' | 'DELIVERED'
  scheduled_pickup_time?: string
  delivery_token?: string
  notas?: string
}

interface Tenant {
  id: string
  tenant_name: string
  logo_url: string
  primary_color: string
  secondary_color: string
  demand_status: 'NORMAL' | 'MODERADO' | 'SATURADO'
  estado: string // 'activo' | 'desactivado'
}

export default function TenantTerminalPage() {
  const params = useParams()
  const tenantSlug = (params.tenantSlug as string) || ''

  // ── States ──────────────────────────────────────────────────────────────────
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [isCargando, setIsCargando] = useState(true)
  const [isConnected, setIsConnected] = useState(true)

  // Onboarding & session states
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loginPin, setLoginPin] = useState('')
  const [selectedOrientation, setSelectedOrientation] = useState('')
  const [loginError, setLoginError] = useState('')
  const [simulatedTicket, setSimulatedTicket] = useState<Order | null>(null)
  
  // Drawer & Navigation
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'ordenes' | 'menu' | 'historial' | 'ventas' | 'horarios' | 'cuenta' | 'configuracion' | 'soporte'>('ordenes')
  
  // Config States
  const [autoAccept, setAutoAccept] = useState(false)
  const [autoPrintChecklist, setAutoPrintChecklist] = useState(true)
  const [autoPrintOnAccept, setAutoPrintOnAccept] = useState(false)
  const [enableBluetooth, setEnableBluetooth] = useState(false)
  const [deviceOrientation, setDeviceOrientation] = useState<'landscape' | 'portrait'>('landscape')
  const [printers, setPrinters] = useState<{ id: string; name: string; active: boolean }[]>([
    { id: '1', name: 'Impresora Térmica Cocina (80mm - USB)', active: true },
    { id: '2', name: 'Impresora Mostrador Caja (58mm - BT)', active: false }
  ])
  
  // Sound Alerts
  const [soundEnabled, setSoundEnabled] = useState(true)
  
  // Menu/Carta toggles
  const [menuItems, setMenuItems] = useState([
    { id: '1', name: 'Plato Fuerte Especial', category: 'Platillos', available: true },
    { id: '2', name: 'Entrada de la Casa', category: 'Platillos', available: true },
    { id: '3', name: 'Postre de Temporada', category: 'Postres', available: true },
    { id: '4', name: 'Bebida Refrescante Litro', category: 'Bebidas', available: true },
    { id: '5', name: 'Salsa Extra Especial', category: 'Ingredientes', available: true },
    { id: '6', name: 'Ingrediente Premium Agotado', category: 'Ingredientes', available: false }
  ])
  
  // Simulated stats for shift sales
  const salesSummary = {
    total: 4890,
    count: 31,
    average: 157.74,
    cash: 2650,
    card: 2240
  }
  
  // Time state for countdowns
  const [currentTime, setCurrentTime] = useState(Date.now())

  // Sound ref
  const audioContextRef = useRef<AudioContext | null>(null)

  const printThermalTicket = (order: Order, size: '80mm' | '58mm') => {
    let iframe = document.getElementById('thermal-print-iframe') as HTMLIFrameElement
    if (!iframe) {
      iframe = document.createElement('iframe')
      iframe.id = 'thermal-print-iframe'
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = 'none'
      document.body.appendChild(iframe)
    }

    const tenantName = tenant?.tenant_name || 'LoyaltyClub'
    const widthStyle = size === '80mm' ? '72mm' : '48mm'
    const fontSize = size === '80mm' ? '12px' : '10px'
    const borderChar = size === '80mm' ? '='.repeat(42) : '='.repeat(32)
    const dashedChar = size === '80mm' ? '-'.repeat(42) : '-'.repeat(32)

    const formattedItems = order.items.map((item: any) => {
      const qtyStr = `${item.qty}x`
      const priceStr = `$${item.price}`
      return `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <div style="flex: 1; padding-right: 8px; font-weight: bold; overflow-wrap: break-word;">${item.name}</div>
        <div style="width: 30px; text-align: right; flex-shrink: 0;">${qtyStr}</div>
        <div style="width: 60px; text-align: right; flex-shrink: 0;">${priceStr}</div>
      </div>`
    }).join('')

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Ticket #${order.id.slice(-4).toUpperCase()}</title>
        <style>
          @page {
            margin: 0;
          }
          body {
            margin: 0;
            padding: 8px;
            font-family: 'Courier New', Courier, monospace;
            font-size: ${fontSize};
            width: ${widthStyle};
            color: #000;
            background: #fff;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { margin: 8px 0; font-family: monospace; white-space: pre; }
          .header-title { font-size: 14px; font-weight: bold; margin-bottom: 2px; }
          .item-list { margin: 8px 0; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="header-title">${tenantName.toUpperCase()}</div>
          <div class="bold">TICKET DE ORDEN DE COCINA</div>
          <div>${new Date(order.created_at).toLocaleString('es-MX')}</div>
        </div>
        
        <div class="divider">${borderChar}</div>
        
        <div>
          <span class="bold">ORDEN ID:</span> #${order.id.slice(-4).toUpperCase()}<br/>
          <span class="bold">TIPO:</span> ${order.tipo.toUpperCase()}<br/>
          <span class="bold">ESTADO:</span> ${order.estado.toUpperCase()}<br/>
          ${order.scheduled_pickup_time ? `<span class="bold">ENTREGA:</span> ${new Date(order.scheduled_pickup_time).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}<br/>` : ''}
          ${order.delivery_token ? `<span class="bold">TOKEN:</span> ${order.delivery_token}<br/>` : ''}
        </div>
        
        <div class="divider">${borderChar}</div>
        
        <div class="bold" style="display: flex; justify-content: space-between;">
          <span style="flex: 1;">PRODUCTO</span>
          <span style="width: 30px; text-align: right;">CANT</span>
          <span style="width: 60px; text-align: right;">PRECIO</span>
        </div>
        
        <div class="divider">${dashedChar}</div>
        
        <div class="item-list">
          ${formattedItems}
        </div>
        
        <div class="divider">${dashedChar}</div>
        
        <div class="bold" style="display: flex; justify-content: space-between; font-size: 1.1em;">
          <span>TOTAL:</span>
          <span>$${order.total}</span>
        </div>
        
        <div class="divider">${borderChar}</div>
        
        <div>
          <span class="bold">CLIENTE:</span> ${order.nombre_cliente || 'Sin nombre'}<br/>
          <span class="bold">TEL:</span> ${order.telefono_cliente || 'Sin tel'}<br/>
          ${order.tipo === 'delivery' ? `
            <span class="bold">DIRECCIÓN:</span><br/>
            ${order.calle} #${order.numero}<br/>
            Col. ${order.colonia}<br/>
          ` : ''}
          ${order.notas ? `<br/><span class="bold">NOTAS:</span><br/>${order.notas}<br/>` : ''}
        </div>
        
        <div class="divider">${borderChar}</div>
        
        <div class="text-center" style="margin-top: 15px; font-size: 9px; color: #555;">
          LoyaltyClub POS System
        </div>
        
        <script>
          window.onload = function() {
            window.focus();
            window.print();
          }
        </script>
      </body>
      </html>
    `

    const doc = iframe.contentWindow?.document || iframe.contentDocument
    if (doc) {
      doc.open()
      doc.write(htmlContent)
      doc.close()
    }
  }

  // ── Load Cookies / Local Storage configs ────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAutoAccept = localStorage.getItem('term_auto_accept') === 'true'
      const savedAutoPrintChecklist = localStorage.getItem('term_auto_print_checklist') !== 'false'
      const savedAutoPrintOnAccept = localStorage.getItem('term_auto_print_accept') === 'true'
      const savedBluetooth = localStorage.getItem('term_bluetooth') === 'true'
      const savedSound = localStorage.getItem('term_sound') !== 'false'
      const savedOrientation = localStorage.getItem('term_orientation') as 'landscape' | 'portrait' | null
      const savedIsLogged = localStorage.getItem('term_is_logged') === 'true'
      
      setAutoAccept(savedAutoAccept)
      setAutoPrintChecklist(savedAutoPrintChecklist)
      setAutoPrintOnAccept(savedAutoPrintOnAccept)
      setEnableBluetooth(savedBluetooth)
      setSoundEnabled(savedSound)
      if (savedOrientation) {
        setDeviceOrientation(savedOrientation)
        setSelectedOrientation(savedOrientation)
      }
      if (savedIsLogged) {
        setIsLoggedIn(true)
      }
    }
  }, [])

  // ── Countdown tick ──────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // ── Play Sound Alert ────────────────────────────────────────────────────────
  const playAlertSound = () => {
    if (!soundEnabled) return
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      if (ctx.state === 'suspended') {
        ctx.resume()
      }
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime) // A5 note
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15)
      
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      
      osc.connect(gain)
      gain.connect(ctx.destination)
      
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    } catch (e) {
      console.warn('Could not play sound:', e)
    }
  }

  // ── Fetch business & orders from Supabase (Strict Tenant Isolation) ──────────
  const cargarDatos = async () => {
    setIsCargando(true)
    try {
      let tenantData: Tenant | null = null

      try {
        const { data: ten, error: tenErr } = await supabase
          .from('tenants')
          .select('*')
          .eq('slug', tenantSlug.toLowerCase().trim())
          .maybeSingle()

        if (ten && !tenErr) {
          tenantData = {
            id: ten.id,
            tenant_name: ten.tenant_name || ten.nombre,
            logo_url: ten.logo_url || '',
            primary_color: ten.primary_color || ten.color_primario || '#ef4444',
            secondary_color: ten.secondary_color || ten.color_secundario || '#fbbf24',
            demand_status: ten.demand_status || 'NORMAL',
            estado: ten.estado || 'activo'
          }
        }
      } catch (err) {
        // Ignore error
      }

      if (!tenantData) {
        const { data: biz, error: bizErr } = await supabase
          .from('businesses')
          .select('*')
          .eq('slug', tenantSlug.toLowerCase().trim())
          .maybeSingle()

        if (biz) {
          tenantData = {
            id: biz.id,
            tenant_name: biz.nombre,
            logo_url: biz.logo_url || '',
            primary_color: biz.color_primario || '#ef4444',
            secondary_color: biz.color_secundario || '#fbbf24',
            demand_status: biz.demand_status || 'NORMAL',
            estado: biz.estado || 'activo'
          }
        }
      }

      if (tenantData) {
        setTenant(tenantData)

        const { data: ords } = await supabase
          .from('orders')
          .select('*')
          .eq('business_id', tenantData.id)
          .order('created_at', { ascending: false })
          .limit(40)

        if (ords && ords.length > 0) {
          const parsedOrders: Order[] = ords.map((o: any) => ({
            ...o,
            items: Array.isArray(o.items) ? o.items : JSON.parse(o.items || '[]')
          }))
          setOrders(parsedOrders)
        } else {
          generarMocks(tenantData.id)
        }
      } else {
        const demoTenant: Tenant = {
          id: 'demo-tenant-id',
          tenant_name: tenantSlug ? tenantSlug.toUpperCase() : 'DEMO COMMERCE',
          logo_url: '',
          primary_color: '#facc15',
          secondary_color: '#fbbf24',
          demand_status: 'NORMAL',
          estado: 'activo'
        }
        setTenant(demoTenant)
        generarMocks(demoTenant.id)
      }
    } catch (err) {
      console.error('Error fetching terminal data:', err)
    } finally {
      setIsCargando(false)
    }
  }

  const generarMocks = (businessId: string) => {
    const mockOrders: Order[] = [
      {
        id: 'ord-t201',
        business_id: businessId,
        nombre_cliente: 'Alejandro Rivera',
        telefono_cliente: '5512345678',
        calle: 'Av. Paseo de la Reforma',
        numero: '505',
        colonia: 'Juárez',
        tipo: 'delivery',
        items: [
          { name: 'Plato Fuerte Especial', qty: 2, price: 150 },
          { name: 'Bebida Refrescante Litro', qty: 1, price: 50 }
        ],
        total: 350,
        sello_otorgado: true,
        sello_aprobado: false,
        sello_rechazado: false,
        estado: 'pendiente',
        created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        delivery_status: 'PENDING'
      },
      {
        id: 'ord-t202',
        business_id: businessId,
        nombre_cliente: 'Lucía Fernández',
        telefono_cliente: '5598765432',
        calle: 'Calle Colima',
        numero: '124',
        colonia: 'Roma Norte',
        tipo: 'delivery',
        items: [
          { name: 'Entrada de la Casa', qty: 1, price: 90 },
          { name: 'Postre de Temporada', qty: 1, price: 75 }
        ],
        total: 165,
        sello_otorgado: true,
        sello_aprobado: true,
        sello_rechazado: false,
        estado: 'aprobado',
        created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        delivery_status: 'SHIPPED_SCHEDULED',
        scheduled_pickup_time: new Date(Date.now() + 18 * 60 * 1000).toISOString(),
        delivery_token: 'MOCK_TRV_RomaBiker',
        notas: 'Entregar en la recepción.'
      },
      {
        id: 'ord-t203',
        business_id: businessId,
        nombre_cliente: 'Carlos Ramos',
        telefono_cliente: '5543210987',
        calle: 'Calle Coyoacán',
        numero: '45',
        colonia: 'Del Valle',
        tipo: 'mostrador',
        items: [
          { name: 'Plato Fuerte Especial', qty: 1, price: 150 }
        ],
        total: 150,
        sello_otorgado: true,
        sello_aprobado: true,
        sello_rechazado: false,
        estado: 'aprobado',
        created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        delivery_status: 'SHIPPED_IMMEDIATE',
        scheduled_pickup_time: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        delivery_token: 'MOCK_TRV_BikerTrust',
        notas: 'Cliente espera afuera.'
      }
    ]
    setOrders(mockOrders)
  }

  useEffect(() => {
    if (!tenantSlug) return
    cargarDatos()
  }, [tenantSlug])

  useEffect(() => {
    if (!tenant) return

    const channel = supabase
      .channel(`tenant-orders-${tenant.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders',
        filter: `business_id=eq.${tenant.id}` 
      }, (payload) => {
        setIsConnected(true)
        if (payload.eventType === 'INSERT') {
          const newOrder = payload.new as Order
          newOrder.items = Array.isArray(newOrder.items) ? newOrder.items : JSON.parse((newOrder as any).items || '[]')
          
          setOrders(prev => {
            if (prev.some(o => o.id === newOrder.id)) return prev
            const updated = [newOrder, ...prev]
            if (autoAccept) {
              setTimeout(() => {
                handleAceptar(newOrder.id)
              }, 1000)
            } else {
              playAlertSound()
            }
            return updated
          })
        } else if (payload.eventType === 'UPDATE') {
          const updatedOrder = payload.new as Order
          updatedOrder.items = Array.isArray(updatedOrder.items) ? updatedOrder.items : JSON.parse((updatedOrder as any).items || '[]')
          setOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o))
        } else if (payload.eventType === 'DELETE') {
          const deleted = payload.old as { id: string }
          setOrders(prev => prev.filter(o => o.id !== deleted.id))
        }
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenant, autoAccept])

  const handleToggleStore = async () => {
    if (!tenant) return
    const newEstado = tenant.estado === 'activo' ? 'desactivado' : 'activo'
    setTenant(prev => prev ? { ...prev, estado: newEstado } : null)
    try {
      await supabase.from('businesses').update({ estado: newEstado }).eq('id', tenant.id)
    } catch (e) {
      try {
        await supabase.from('tenants').update({ estado: newEstado }).eq('id', tenant.id)
      } catch (err) {
        console.error('Error toggling store status:', err)
      }
    }
  }

  const handleLogin = async () => {
    if (!tenant) return
    if (!loginPin || !selectedOrientation) {
      setLoginError('Por favor ingresa tu PIN y selecciona la orientación.')
      return
    }
    setIsCargando(true)
    setLoginError('')
    try {
      if (tenant.id === 'demo-tenant-id') {
        localStorage.setItem('term_is_logged', 'true')
        localStorage.setItem('term_orientation', selectedOrientation)
        setDeviceOrientation(selectedOrientation as any)
        setIsLoggedIn(true)
        setIsCargando(false)
        return
      }

      const { data: user, error: userErr } = await supabase
        .from('business_users')
        .select('*')
        .eq('business_id', tenant.id)
        .eq('pin', loginPin)
        .eq('activo', true)
        .maybeSingle()

      if (user) {
        localStorage.setItem('term_is_logged', 'true')
        localStorage.setItem('term_orientation', selectedOrientation)
        setDeviceOrientation(selectedOrientation as any)
        setIsLoggedIn(true)
      } else {
        setLoginError('PIN incorrecto para este comercio.')
      }
    } catch (e) {
      setLoginError('Error de conexión al validar PIN.')
    } finally {
      setIsCargando(false)
    }
  }

  const handleUpdateDemand = async (status: 'NORMAL' | 'MODERADO' | 'SATURADO') => {
    if (!tenant) return
    setTenant(prev => prev ? { ...prev, demand_status: status } : null)
    try {
      await supabase.from('businesses').update({ demand_status: status }).eq('id', tenant.id)
    } catch (e) {
      try {
        await supabase.from('tenants').update({ demand_status: status }).eq('id', tenant.id)
      } catch (err) {
        console.error('Error updating demand status:', err)
      }
    }
  }

  const handleAceptar = async (orderId: string) => {
    if (!tenant) return
    
    let bufferMinutes = 30
    if (tenant.demand_status === 'MODERADO') bufferMinutes = 45
    if (tenant.demand_status === 'SATURADO') bufferMinutes = 60
    
    const scheduledPickupTime = new Date(Date.now() + bufferMinutes * 60 * 1000).toISOString()
    const mockToken = `MOCK_TRV_${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    const acceptedOrder = orders.find(o => o.id === orderId)
    const orderWithUpdatedState = acceptedOrder ? {
      ...acceptedOrder,
      estado: 'aprobado',
      delivery_status: 'SHIPPED_SCHEDULED',
      scheduled_pickup_time: scheduledPickupTime,
      delivery_token: mockToken
    } : null

    if (orderWithUpdatedState) {
      if (autoPrintOnAccept) {
        const activeSize = printers.find(p => p.active)?.name.includes('80mm') ? '80mm' : '58mm'
        printThermalTicket(orderWithUpdatedState, activeSize)
      } else {
        setSimulatedTicket(orderWithUpdatedState)
      }
    }

    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          estado: 'aprobado',
          delivery_status: 'SHIPPED_SCHEDULED',
          scheduled_pickup_time: scheduledPickupTime,
          delivery_token: mockToken
        }
      }
      return o
    }))

    try {
      await supabase.from('orders').update({
        estado: 'aprobado',
        delivery_status: 'SHIPPED_SCHEDULED',
        scheduled_pickup_time: scheduledPickupTime,
        delivery_token: mockToken
      }).eq('id', orderId)
    } catch (e) {
      console.error('Error accepting order:', e)
    }
  }

  const handlePedidoListo = async (orderId: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, delivery_status: 'SHIPPED_IMMEDIATE' } : o))
    try {
      const baseUrl = window.location.origin
      await fetch(`${baseUrl}/api/orders/ready-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId })
      })
    } catch (e) {
      console.error('Error marking order as ready:', e)
    }
  }

  const handleEntregado = async (orderId: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, estado: 'entregado', delivery_status: 'DELIVERED' } : o))
    try {
      await supabase.from('orders').update({
        estado: 'entregado',
        delivery_status: 'DELIVERED'
      }).eq('id', orderId)
    } catch (e) {
      console.error('Error completing order:', e)
    }
  }

  const toggleConfig = (key: string, currentVal: boolean, setVal: (v: boolean) => void) => {
    const newVal = !currentVal
    setVal(newVal)
    localStorage.setItem(key, String(newVal))
  }

  const getColAceptar = () => orders.filter(o => o.estado === 'pendiente')
  const getColPreparar = () => orders.filter(o => o.estado === 'aprobado' && o.delivery_status === 'SHIPPED_SCHEDULED')
  const getColEntregar = () => orders.filter(o => o.estado === 'aprobado' && (o.delivery_status === 'SHIPPED_IMMEDIATE' || o.delivery_status === 'DELIVERED'))

  const formatTimeLeft = (scheduledStr?: string) => {
    if (!scheduledStr) return '00:00'
    const diff = new Date(scheduledStr).getTime() - currentTime
    if (diff <= 0) return '⚡ ¡Retrasado!'
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  if (isCargando || !tenant) {
    return (
      <div className="bg-slate-50 min-h-screen flex flex-col items-center justify-center text-zinc-550">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-600 mb-4" />
        <p className="text-sm font-semibold tracking-wide">Cargando Terminal Multi-Tenant...</p>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="bg-slate-50 min-h-screen flex flex-col items-center justify-center p-4 font-sans text-zinc-900 selection:bg-amber-100">
        <div className="bg-white rounded-3xl border border-zinc-200 p-8 shadow-xl w-full max-w-sm space-y-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full border border-zinc-200 overflow-hidden bg-white flex items-center justify-center shrink-0">
              {tenant.logo_url ? (
                <img src={tenant.logo_url} alt={tenant.tenant_name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-black">{tenant.tenant_name.charAt(0)}</span>
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900">{tenant.tenant_name}</h1>
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mt-0.5">Acceso de Terminal</p>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">PIN de Operador</label>
              <input
                type="password"
                value={loginPin}
                onChange={(e) => setLoginPin(e.target.value)}
                placeholder="Ingresa tu PIN de 4 a 6 dígitos..."
                className="w-full bg-slate-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:bg-white text-base text-center font-mono placeholder:text-zinc-400 shadow-inner"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Orientación de Pantalla (Obligatorio)</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'landscape', label: 'Horizontal (Tablet)' },
                  { id: 'portrait', label: 'Vertical (Celular)' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedOrientation(opt.id)}
                    className={`py-3 px-2 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer text-center ${
                      selectedOrientation === opt.id
                        ? 'bg-amber-500/15 border-amber-500 text-amber-900 font-extrabold shadow-sm'
                        : 'bg-slate-50 border-zinc-200 text-zinc-650 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {loginError && (
              <p className="text-xs text-rose-600 font-semibold text-center mt-1 animate-pulse">
                ⚠️ {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={isCargando}
              className="w-full bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-md transition-colors active:scale-95 mt-4 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isCargando ? <RefreshCw className="w-4.5 h-4.5 animate-spin" /> : '🔑 Iniciar Sesión'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="bg-slate-50 min-h-screen text-zinc-900 flex flex-col font-sans select-none overflow-hidden selection:bg-amber-100"
      style={{
        ['--primary-accent' as any]: tenant.primary_color || '#ef4444'
      }}
    >
      {/* ── 1. MAIN HEADER (Light Mode) ────────────────────────────────────────── */}
      <header className="h-16 border-b border-zinc-200 bg-white flex items-center justify-between px-4 z-40 shadow-sm">
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className="w-12 h-12 bg-slate-50 active:bg-slate-100 hover:bg-slate-100/80 rounded-xl flex items-center justify-center transition-colors border border-zinc-200 shadow-sm"
          >
            <MenuIcon className="w-6 h-6 text-zinc-700" />
          </button>
          
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full border border-zinc-200 overflow-hidden bg-white flex items-center justify-center shrink-0">
              {tenant.logo_url ? (
                <img src={tenant.logo_url} alt={tenant.tenant_name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-black">{tenant.tenant_name.charAt(0)}</span>
              )}
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight tracking-tight text-zinc-900 flex items-center gap-1.5">
                {tenant.tenant_name}
                <span className="text-[10px] bg-slate-100 text-zinc-655 font-mono py-0.5 px-1.5 rounded border border-zinc-200">
                  Terminal
                </span>
              </h1>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'} inline-block`} />
                <span className="text-[10px] text-zinc-550 font-mono">
                  {isConnected ? 'Realtime Conectado' : 'Desconectado'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors border ${
              soundEnabled ? 'bg-white border-zinc-200 text-amber-600' : 'bg-slate-50 border-zinc-150 text-zinc-400'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2 bg-white border border-zinc-200 py-1.5 px-3 rounded-xl shadow-sm">
            <span className={`text-[10px] font-bold tracking-wider uppercase font-mono ${
              tenant.estado === 'activo' ? 'text-emerald-600' : 'text-zinc-400'
            }`}>
              {tenant.estado === 'activo' ? 'Tienda Activa' : 'Tienda Cerrada'}
            </span>
            <button
              onClick={handleToggleStore}
              className={`w-12 h-6 rounded-full relative transition-colors duration-300 border ${
                tenant.estado === 'activo' ? 'bg-emerald-100 border-emerald-300' : 'bg-zinc-200 border-zinc-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full absolute top-0.5 transition-all duration-300 ${
                  tenant.estado === 'activo' ? 'bg-emerald-600 left-6.5' : 'bg-zinc-400 left-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center gap-1 bg-white border border-zinc-200 p-1 rounded-xl shadow-sm">
            {[
              { id: 'NORMAL', label: '🟢 Normal 30m', activeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
              { id: 'MODERADO', label: '🟡 Mod. 45m', activeClass: 'bg-amber-50 text-amber-800 border-amber-300' },
              { id: 'SATURADO', label: '🔴 Sat. 60m', activeClass: 'bg-rose-50 text-rose-800 border-rose-300' }
            ].map(sem => (
              <button
                key={sem.id}
                onClick={() => handleUpdateDemand(sem.id as any)}
                className={`text-[10px] font-bold py-1.5 px-2.5 rounded-lg border transition-all ${
                  tenant.demand_status === sem.id ? sem.activeClass : 'border-transparent text-zinc-550 hover:text-zinc-800'
                }`}
              >
                {sem.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex relative">

        {/* ── 2. NAVIGATION DRAWER DINÁMICO ────────────────────────────────── */}
        {isDrawerOpen && (
          <div className="fixed inset-0 bg-zinc-900/30 backdrop-blur-sm z-45" onClick={() => setIsDrawerOpen(false)} />
        )}
        
        <aside
          className={`fixed top-16 left-0 h-[calc(100vh-4rem)] w-72 bg-white border-r border-zinc-200 z-50 transform transition-transform duration-300 ease-out flex flex-col justify-between shadow-lg ${
            isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <nav className="flex-1 py-4 overflow-y-auto px-3 space-y-1.5">
            {[
              { id: 'ordenes', label: '1. Órdenes', icon: Clock },
              { id: 'menu', label: '2. Menú / Carta', icon: Coffee },
              { id: 'historial', label: '3. Historial de Órdenes', icon: History },
              { id: 'ventas', label: '4. Resumen de Ventas', icon: DollarSign },
              { id: 'horarios', label: '5. Horarios', icon: Clock },
              { id: 'cuenta', label: '6. Notificaciones / Mi Cuenta', icon: User },
              { id: 'configuracion', label: '7. Configuración', icon: Settings },
              { id: 'soporte', label: '8. Centro de Ayuda / Soporte', icon: HelpCircle }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as any)
                  setIsDrawerOpen(false)
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border ${
                  activeTab === item.id 
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-800' 
                    : 'border-transparent text-zinc-650 hover:text-zinc-900 hover:bg-slate-100/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-amber-600' : 'text-zinc-405'}`} />
                  <span className="text-sm font-semibold">{item.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50" />
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-zinc-205 bg-slate-50">
            <button
              onClick={() => {
                if (confirm('¿Desea cerrar sesión en la terminal?')) {
                  localStorage.removeItem('term_is_logged')
                  localStorage.removeItem('term_orientation')
                  setIsLoggedIn(false)
                  setLoginPin('')
                  setLoginError('')
                }
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all font-semibold text-sm"
            >
              <LogOut className="w-5 h-5 text-rose-500" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </aside>

        {/* ── 3. OPERATIONAL KANBAN BOARD ──────────────────────────────────── */}
        <main className="flex-1 p-4 overflow-hidden flex flex-col h-[calc(100vh-4rem)]">
          
          {activeTab === 'ordenes' && (
            <div className={`flex-1 h-full overflow-hidden ${deviceOrientation === 'portrait' ? 'flex flex-col gap-4 overflow-y-auto' : 'grid grid-cols-3 gap-4'}`}>
              
              {/* COLUMNA 1: ACEPTAR */}
              <div className="bg-slate-100/60 border border-zinc-200 rounded-2xl flex flex-col h-full overflow-hidden">
                <div className="p-4 bg-white border-b border-zinc-200 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <h2 className="font-bold text-sm uppercase tracking-wider text-amber-800">Aceptar ({getColAceptar().length})</h2>
                  </div>
                  <span className="text-xs bg-slate-100 text-zinc-650 font-mono py-1 px-2.5 rounded-lg border border-zinc-200 font-bold">Nuevas</span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {getColAceptar().length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center text-zinc-400">
                      <span className="text-4xl mb-2 opacity-50">🔔</span>
                      <p className="text-zinc-650 text-xs font-semibold">Esperando nuevas órdenes...</p>
                    </div>
                  ) : (
                    getColAceptar().map(order => (
                      <div key={order.id} className="bg-white border border-zinc-200/80 rounded-xl p-3.5 space-y-3 shadow-md">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-black text-zinc-900 text-base">#{order.id.slice(-4).toUpperCase()}</p>
                            <p className="text-xs text-zinc-600 font-medium mt-0.5">{order.nombre_cliente}</p>
                          </div>
                          <span className="text-xs font-mono font-black text-amber-800 bg-amber-100 border border-amber-200 py-1 px-2.5 rounded-lg">
                            ${order.total}
                          </span>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-2.5 border border-zinc-200/80 space-y-1.5 text-zinc-800">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-xs font-semibold">
                              <span>
                                <span className="text-amber-600 font-black font-mono">{item.qty}x</span> {item.name}
                              </span>
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={() => handleAceptar(order.id)}
                          className="w-full text-zinc-950 font-black uppercase text-xs tracking-wider py-3.5 px-4 rounded-xl shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer h-12"
                          style={{ backgroundColor: 'var(--primary-accent)' }}
                        >
                          <Check className="w-4.5 h-4.5 stroke-[3]" /> ACEPTAR ORDEN
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* COLUMNA 2: PREPARAR */}
              <div className="bg-slate-100/60 border border-zinc-200 rounded-2xl flex flex-col h-full overflow-hidden">
                <div className="p-4 bg-white border-b border-zinc-200 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
                    <h2 className="font-bold text-sm uppercase tracking-wider text-blue-800">Preparar ({getColPreparar().length})</h2>
                  </div>
                  <span className="text-xs bg-slate-100 text-zinc-650 font-mono py-1 px-2.5 rounded-lg border border-zinc-200 font-bold">En Cocina</span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {getColPreparar().length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center text-zinc-400">
                      <span className="text-4xl mb-2 opacity-50">🍳</span>
                      <p className="text-zinc-650 text-xs font-semibold">Sin pedidos en preparación</p>
                    </div>
                  ) : (
                    getColPreparar().map(order => (
                      <div key={order.id} className="bg-white border border-zinc-200/80 rounded-xl p-3.5 space-y-3 shadow-md">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-black text-zinc-900 text-base">#{order.id.slice(-4).toUpperCase()}</p>
                              <button
                                onClick={() => {
                                  const activeSize = printers.find(p => p.active)?.name.includes('80mm') ? '80mm' : '58mm'
                                  printThermalTicket(order, activeSize)
                                }}
                                className="p-1 rounded bg-slate-105 hover:bg-slate-200 text-zinc-600 transition-colors border border-zinc-200 cursor-pointer"
                                title="Imprimir ticket"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <p className="text-xs text-zinc-650 font-medium mt-0.5">{order.nombre_cliente}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-mono font-black text-blue-800 bg-blue-50 border border-blue-200 py-1 px-2.5 rounded-lg animate-pulse flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-blue-600" />
                              {formatTimeLeft(order.scheduled_pickup_time)}
                            </span>
                          </div>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-2.5 border border-zinc-200/80 space-y-1.5 text-zinc-800">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-xs font-semibold">
                              <span>
                                <span className="text-blue-650 font-black font-mono">{item.qty}x</span> {item.name}
                              </span>
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={() => handlePedidoListo(order.id)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs tracking-wider py-3.5 px-4 rounded-xl shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer h-12"
                        >
                          🏁 PEDIDO LISTO
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* COLUMNA 3: ENTREGAR */}
              <div className="bg-slate-100/60 border border-zinc-200 rounded-2xl flex flex-col h-full overflow-hidden">
                <div className="p-4 bg-white border-b border-zinc-200 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <h2 className="font-bold text-sm uppercase tracking-wider text-emerald-800">Entregar ({getColEntregar().length})</h2>
                  </div>
                  <span className="text-xs bg-slate-100 text-zinc-650 font-mono py-1 px-2.5 rounded-lg border border-zinc-200 font-bold">Despacho</span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {getColEntregar().length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center text-zinc-400">
                      <span className="text-4xl mb-2 opacity-50">🛵</span>
                      <p className="text-zinc-650 text-xs font-semibold">Sin pedidos listos para despacho</p>
                    </div>
                  ) : (
                    getColEntregar().map(order => (
                      <div key={order.id} className="bg-white border border-zinc-200/80 rounded-xl p-3.5 space-y-3 shadow-md">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-black text-zinc-900 text-base">#{order.id.slice(-4).toUpperCase()}</p>
                              <button
                                onClick={() => {
                                  const activeSize = printers.find(p => p.active)?.name.includes('80mm') ? '80mm' : '58mm'
                                  printThermalTicket(order, activeSize)
                                }}
                                className="p-1 rounded bg-slate-105 hover:bg-slate-200 text-zinc-600 transition-colors border border-zinc-200 cursor-pointer"
                                title="Imprimir ticket"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <p className="text-xs text-zinc-605 font-medium mt-0.5">{order.nombre_cliente}</p>
                          </div>
                          <span className="text-[10px] font-bold uppercase py-1 px-2 bg-indigo-50 text-indigo-850 border border-indigo-200 rounded-lg">
                            Despacho
                          </span>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-3 border border-zinc-200 space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-550 font-medium">Repartidor Asignado:</span>
                            <span className="text-zinc-900 font-bold">Samuel Méndez</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-550 font-medium">Empresa de Reparto:</span>
                            <span className="text-amber-700 font-bold">Bikers Upn</span>
                          </div>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-2.5 border border-zinc-150 text-xs text-zinc-600">
                          <p className="font-bold flex items-center gap-1 text-zinc-700">
                            <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                            {order.calle} #{order.numero}, Col. {order.colonia}
                          </p>
                        </div>

                        {order.delivery_status !== 'DELIVERED' ? (
                          <button
                            onClick={() => handleEntregado(order.id)}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs tracking-wider py-3.5 px-4 rounded-xl shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer h-12 animate-fadeIn"
                          >
                            <CheckCircle2 className="w-4.5 h-4.5" /> FINALIZAR ENTREGA
                          </button>
                        ) : (
                          <div className="w-full bg-slate-100 text-zinc-400 font-bold uppercase text-xs py-3.5 px-4 rounded-xl border border-zinc-200 text-center flex items-center justify-center gap-1.5 h-12">
                            <Check className="w-4.5 h-4.5" /> DESPACHADO
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

          {/* Tab: Menú / Carta */}
          {activeTab === 'menu' && (
            <div className="flex-1 bg-white border border-zinc-200 rounded-2xl p-6 overflow-hidden flex flex-col shadow-sm">
              <h2 className="text-xl font-bold text-zinc-900 mb-2">Carta de Alimentos (Tenant)</h2>
              <p className="text-xs text-zinc-500 mb-6">Administración de disponibilidad inmediata.</p>
              
              <div className="flex-1 overflow-y-auto space-y-4">
                {menuItems.map(item => (
                  <div key={item.id} className="bg-slate-50 border border-zinc-200 rounded-xl p-4 flex justify-between items-center max-w-xl shadow-sm">
                    <span className="font-bold text-zinc-800 text-sm">{item.name}</span>
                    <button
                      onClick={() => setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, available: !m.available } : m))}
                      className={`w-12 h-6 rounded-full relative transition-colors duration-300 border ${
                        item.available ? 'bg-amber-100 border-amber-300' : 'bg-zinc-250 border-zinc-305'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full absolute top-0.5 transition-all duration-300 ${item.available ? 'bg-amber-600 left-6.5' : 'bg-zinc-400 left-1'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab: Historial */}
          {activeTab === 'historial' && (
            <div className="flex-1 bg-white border border-zinc-200 rounded-2xl p-6 overflow-hidden flex flex-col shadow-sm">
              <h2 className="text-xl font-bold text-zinc-900 mb-2">Historial de Órdenes</h2>
              <p className="text-xs text-zinc-500 mb-6">Órdenes archivadas en el turno.</p>
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase">
                    <tr>
                      <th className="p-3">ID</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3">Total</th>
                      <th className="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {orders.map(o => (
                      <tr key={o.id}>
                        <td className="p-3 font-bold text-zinc-900">#{o.id.slice(-4).toUpperCase()}</td>
                        <td className="p-3 text-zinc-800">{o.nombre_cliente}</td>
                        <td className="p-3 font-mono font-bold text-zinc-700">${o.total}</td>
                        <td className="p-3 text-zinc-600">{o.estado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab: Ventas */}
          {activeTab === 'ventas' && (
            <div className="flex-1 bg-white border border-zinc-200 rounded-2xl p-6 overflow-hidden flex flex-col shadow-sm">
              <h2 className="text-xl font-bold text-zinc-900 mb-4">Resumen de Caja</h2>
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-slate-50 border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <p className="text-xs text-zinc-500 font-bold uppercase">Total Cobrado</p>
                  <p className="text-3xl font-black text-emerald-600 mt-2">${salesSummary.total} MXN</p>
                </div>
                <div className="bg-slate-50 border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <p className="text-xs text-zinc-500 font-bold uppercase">Transacciones</p>
                  <p className="text-3xl font-black text-zinc-800 mt-2">{salesSummary.count} órdenes</p>
                </div>
                <div className="bg-slate-50 border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <p className="text-xs text-zinc-500 font-bold uppercase">Ticket Promedio</p>
                  <p className="text-3xl font-black text-amber-700 mt-2">${salesSummary.average} MXN</p>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Horarios */}
          {activeTab === 'horarios' && (
            <div className="flex-1 bg-white border border-zinc-200 rounded-2xl p-6 overflow-hidden flex flex-col shadow-sm">
              <h2 className="text-xl font-bold text-zinc-900 mb-2">Horarios</h2>
              <p className="text-xs text-zinc-500 mb-6">Horas de apertura del portal de pedidos.</p>
              <div className="bg-slate-50 border border-zinc-200 rounded-xl p-4 max-w-sm flex justify-between items-center shadow-sm">
                <span className="font-bold text-zinc-700">Lunes a Domingo</span>
                <span className="bg-white px-3 py-1.5 rounded border border-zinc-200 font-mono text-xs text-zinc-650">14:00 - 22:00</span>
              </div>
            </div>
          )}

          {/* Tab: Cuenta */}
          {activeTab === 'cuenta' && (
            <div className="flex-1 bg-white border border-zinc-200 rounded-2xl p-6 overflow-hidden flex flex-col shadow-sm">
              <h2 className="text-xl font-bold text-zinc-900 mb-2">Notificaciones / Mi Cuenta</h2>
              <p className="text-xs text-zinc-500 mb-6">Detalles del perfil de empleado.</p>
              <div className="bg-slate-50 border border-zinc-200 rounded-xl p-6 space-y-4 max-w-md shadow-sm">
                <div className="flex justify-between border-b border-zinc-200 pb-2">
                  <span className="text-zinc-500">Nombre:</span>
                  <span className="text-zinc-800 font-bold">Cajero Principal</span>
                </div>
                <div className="flex justify-between border-b border-zinc-200 pb-2">
                  <span className="text-zinc-500">Tenant ID:</span>
                  <span className="text-zinc-800 font-mono text-xs">{tenant.id}</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Configuración */}
          {activeTab === 'configuracion' && (
            <div className="flex-1 bg-white border border-zinc-200 rounded-2xl p-6 overflow-hidden flex flex-col shadow-sm">
              <h2 className="text-xl font-bold text-zinc-900 mb-2">Configuración de la Terminal</h2>
              <p className="text-xs text-zinc-500 mb-6">Periféricos e impresión.</p>
              
              <div className="space-y-6 max-w-xl overflow-y-auto pr-2">
                <div className="bg-slate-50 border border-zinc-200 rounded-xl p-4 flex justify-between items-center shadow-sm">
                  <div>
                    <p className="font-bold text-sm text-zinc-900">Orientación de Pantalla</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Horizontal (Tablet) / Vertical.</p>
                  </div>
                  <select
                    value={deviceOrientation}
                    onChange={(e) => setDeviceOrientation(e.target.value as any)}
                    className="bg-white border border-zinc-200 rounded-lg text-xs p-2 text-zinc-700 focus:outline-none"
                  >
                    <option value="landscape">Horizontal (Tablet)</option>
                    <option value="portrait">Vertical (Celular)</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-3 bg-slate-50 border border-zinc-200 p-3.5 rounded-xl cursor-pointer shadow-sm">
                    <input 
                      type="checkbox"
                      checked={autoAccept}
                      onChange={() => toggleConfig('term_auto_accept', autoAccept, setAutoAccept)}
                      className="w-4 h-4 accent-amber-600 rounded border-zinc-300 bg-white"
                    />
                    <div>
                      <p className="text-sm font-bold text-zinc-700">Aceptación automática de órdenes</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 bg-slate-50 border border-zinc-200 p-3.5 rounded-xl cursor-pointer shadow-sm">
                    <input 
                      type="checkbox"
                      checked={autoPrintChecklist}
                      onChange={() => toggleConfig('term_auto_print_checklist', autoPrintChecklist, setAutoPrintChecklist)}
                      className="w-4 h-4 accent-amber-600 rounded border-zinc-300 bg-white"
                    />
                    <div>
                      <p className="text-sm font-bold text-zinc-700">Impresión automática de comandas y checklist</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 bg-slate-50 border border-zinc-200 p-3.5 rounded-xl cursor-pointer shadow-sm">
                    <input 
                      type="checkbox"
                      checked={autoPrintOnAccept}
                      onChange={() => toggleConfig('term_auto_print_accept', autoPrintOnAccept, setAutoPrintOnAccept)}
                      className="w-4 h-4 accent-amber-600 rounded border-zinc-300 bg-white"
                    />
                    <div>
                      <p className="text-sm font-bold text-zinc-700">Impresión de comanda al aceptar</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 bg-slate-50 border border-zinc-200 p-3.5 rounded-xl cursor-pointer shadow-sm">
                    <input 
                      type="checkbox"
                      checked={enableBluetooth}
                      onChange={() => toggleConfig('term_bluetooth', enableBluetooth, setEnableBluetooth)}
                      className="w-4 h-4 accent-amber-600 rounded border-zinc-300 bg-white"
                    />
                    <div>
                      <p className="text-sm font-bold text-zinc-700">Habilitar Bluetooth</p>
                    </div>
                  </label>
                </div>

                <div className="bg-slate-50 border border-zinc-200 rounded-xl p-5 space-y-3 shadow-sm">
                  <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">Dispositivos Asociados (Impresoras)</span>
                  {printers.map(p => (
                    <div key={p.id} className="flex justify-between items-center py-2 border-b border-zinc-200 last:border-0">
                      <span className="text-xs text-zinc-700 font-medium">{p.name}</span>
                      <button
                        onClick={() => setPrinters(prev => prev.map(item => item.id === p.id ? { ...item, active: !item.active } : item))}
                        className={`text-xs font-bold py-1 px-3 rounded border ${p.active ? 'bg-emerald-50 text-emerald-800 border-emerald-250' : 'bg-white text-zinc-550 border-zinc-200'}`}
                      >
                        {p.active ? 'Asociado' : 'Asociar'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Soporte */}
          {activeTab === 'soporte' && (
            <div className="flex-1 bg-white border border-zinc-200 rounded-2xl p-6 overflow-hidden flex flex-col shadow-sm">
              <h2 className="text-xl font-bold text-zinc-900 mb-2">Ayuda / Soporte técnico</h2>
              <p className="text-xs text-zinc-500 mb-6">Manual de terminal multi-tenant.</p>
              <div className="bg-slate-50 border border-zinc-200 rounded-xl p-5 max-w-sm shadow-sm">
                <p className="text-xs text-zinc-650">Para reportes urgentes o fallas de impresión:</p>
                <a href="https://wa.me/524431234567" target="_blank" rel="noreferrer" className="inline-flex bg-emerald-600 text-white text-xs uppercase font-bold py-2.5 px-4 rounded-lg mt-3 shadow-md">
                  💬 Contactar Soporte Técnico
                </a>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── ESC/POS SIMULATED PRINTER POPUP ──────────────────────────────── */}
      {simulatedTicket && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 text-zinc-100 rounded-2xl border border-zinc-800 p-6 shadow-2xl w-full max-w-md space-y-4 animate-slideUp font-mono text-xs">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="flex items-center gap-2 text-amber-500 font-bold">
                <Printer className="w-4 h-4" /> 🖨️ Impresora Térmica (ESC/POS)
              </span>
              <button 
                onClick={() => setSimulatedTicket(null)} 
                className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-750 text-zinc-400 hover:text-zinc-150 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-zinc-400 text-[10px]">
              Simulando envío a impresora de {printers.find(p => p.active)?.name.includes('80mm') ? '80mm' : '58mm'}...
            </p>

            <pre className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 text-[11px] leading-relaxed overflow-x-auto text-amber-300/90 whitespace-pre shadow-inner max-h-72 overflow-y-auto">
              {(() => {
                return `[ESC @ (Initialize)]
[GS v 0 (Print Logo)]
[ESC a 1 (Align Center)]
------------------------------------------
         ${tenant.tenant_name.toUpperCase()}
       TICKET DE ORDEN DE COCINA
------------------------------------------
ORDEN ID : #${simulatedTicket.id.slice(-4).toUpperCase()}
FECHA    : ${new Date(simulatedTicket.created_at).toLocaleString()}
TIPO     : ${simulatedTicket.tipo.toUpperCase()}
------------------------------------------
PRODUCTO                  CANT.    PRECIO
------------------------------------------
${simulatedTicket.items.map(item => `${item.name.padEnd(25)} ${String(item.qty).padStart(2)}x   $${item.price}`).join('\n')}
------------------------------------------
TOTAL                             $${simulatedTicket.total}
------------------------------------------
[ESC a 0 (Align Left)]
DIRECCIÓN:
${simulatedTicket.calle} #${simulatedTicket.numero}
Col. ${simulatedTicket.colonia}
${simulatedTicket.notas ? `NOTAS: ${simulatedTicket.notas}\n` : ''}------------------------------------------
[GS V 66 0 (Feed and Cut Paper)]`
              })()}
            </pre>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const activeSize = printers.find(p => p.active)?.name.includes('80mm') ? '80mm' : '58mm'
                  printThermalTicket(simulatedTicket, activeSize)
                }}
                className="w-full bg-amber-500 hover:bg-amber-600 text-zinc-950 py-3 rounded-xl font-black text-center shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Imprimir Ticket Físico
              </button>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const receipt = `[ESC @ (Initialize)]\n[GS v 0 (Print Logo)]\n[ESC a 1 (Align Center)]\n------------------------------------------\n         ${tenant.tenant_name.toUpperCase()}\n       TICKET DE ORDEN DE COCINA\n------------------------------------------\nORDEN ID : #${simulatedTicket.id.slice(-4).toUpperCase()}\nFECHA    : ${new Date(simulatedTicket.created_at).toLocaleString()}\nTIPO     : ${simulatedTicket.tipo.toUpperCase()}\n------------------------------------------\nPRODUCTO                  CANT.    PRECIO\n------------------------------------------\n${simulatedTicket.items.map(item => `${item.name.padEnd(25)} ${String(item.qty).padStart(2)}x   $${item.price}`).join('\n')}\n------------------------------------------\nTOTAL                             $${simulatedTicket.total}\n------------------------------------------\n[ESC a 0 (Align Left)]\nDIRECCIÓN:\n${simulatedTicket.calle} #${simulatedTicket.numero}\nCol. ${simulatedTicket.colonia}\n${simulatedTicket.notas ? `NOTAS: ${simulatedTicket.notas}\n` : ''}------------------------------------------\n[GS V 66 0 (Feed and Cut Paper)]`;
                    console.log(receipt);
                    alert('📋 ¡Comandos ESC/POS copiados en la consola del navegador!');
                  }}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-2.5 rounded-xl font-bold text-center border border-zinc-700 cursor-pointer text-xs"
                >
                  Copiar ESC/POS
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatedTicket(null)}
                  className="flex-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-400 py-2.5 rounded-xl font-bold text-center border border-zinc-750 cursor-pointer text-xs"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
