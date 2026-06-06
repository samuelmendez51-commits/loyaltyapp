'use client'

import { useState, useEffect, useRef } from 'react'
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

// ── interfaces ────────────────────────────────────────────────────────────────
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

interface Business {
  id: string
  nombre: string
  slug: string
  logo_url: string
  estado: string // 'activo' | 'desactivado'
  demand_status: 'NORMAL' | 'MODERADO' | 'SATURADO'
}

export default function TerminalPage() {
  // ── States ──────────────────────────────────────────────────────────────────
  const [business, setBusiness] = useState<Business>({
    id: 'laburreria-id',
    nombre: 'La Burrería',
    slug: 'laburreria',
    logo_url: '/logo.png',
    estado: 'activo',
    demand_status: 'NORMAL'
  })
  
  const [orders, setOrders] = useState<Order[]>([])
  const [isCargando, setIsCargando] = useState(true)
  const [isConnected, setIsConnected] = useState(true)
  
  // Drawer & Navigation
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'ordenes' | 'menu' | 'historial' | 'ventas' | 'horarios' | 'notificaciones' | 'cuenta' | 'configuracion' | 'soporte'>('ordenes')
  
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
    { id: '1', name: 'Burrito de Pastor Gigante', category: 'Burritos', available: true },
    { id: '2', name: 'Burrito Campesino de Res', category: 'Burritos', available: true },
    { id: '3', name: 'Burrito Ahogado Especial', category: 'Burritos', available: true },
    { id: '4', name: 'Quesadilla Especial de Asada', category: 'Especialidades', available: true },
    { id: '5', name: 'Salsa Hot Habanera', category: 'Ingredientes', available: true },
    { id: '6', name: 'Aguacate / Guacamole Extra', category: 'Ingredientes', available: false }
  ])
  
  // Simulated stats for shift sales
  const salesSummary = {
    total: 3450,
    count: 24,
    average: 143.75,
    cash: 1850,
    card: 1600
  }
  
  // Time state for countdowns
  const [currentTime, setCurrentTime] = useState(Date.now())

  // Sound ref
  const audioContextRef = useRef<AudioContext | null>(null)

  // ── Load Cookies / Local Storage configs ────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAutoAccept = localStorage.getItem('term_auto_accept') === 'true'
      const savedAutoPrintChecklist = localStorage.getItem('term_auto_print_checklist') !== 'false'
      const savedAutoPrintOnAccept = localStorage.getItem('term_auto_print_accept') === 'true'
      const savedBluetooth = localStorage.getItem('term_bluetooth') === 'true'
      const savedSound = localStorage.getItem('term_sound') !== 'false'
      
      setAutoAccept(savedAutoAccept)
      setAutoPrintChecklist(savedAutoPrintChecklist)
      setAutoPrintOnAccept(savedAutoPrintOnAccept)
      setEnableBluetooth(savedBluetooth)
      setSoundEnabled(savedSound)
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

  // ── Fetch business & orders from Supabase ───────────────────────────────────
  const cargarDatos = async () => {
    setIsCargando(true)
    try {
      let bizSlug = 'laburreria'
      if (typeof document !== 'undefined') {
        const cookieSlug = document.cookie.match(/session_business_slug=([^;]+)/)?.[1]
        if (cookieSlug) bizSlug = cookieSlug
      }

      const { data: biz, error: bizErr } = await supabase
        .from('businesses')
        .select('id, nombre, slug, logo_url, estado, demand_status')
        .eq('slug', bizSlug)
        .maybeSingle()

      if (biz) {
        setBusiness({
          id: biz.id,
          nombre: biz.nombre,
          slug: biz.slug,
          logo_url: biz.logo_url || '/logo.png',
          estado: biz.estado || 'activo',
          demand_status: biz.demand_status || 'NORMAL'
        })
      }

      const { data: ords, error: ordsErr } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(40)

      if (ords) {
        const parsedOrders: Order[] = ords.map((o: any) => ({
          ...o,
          items: Array.isArray(o.items) ? o.items : JSON.parse(o.items || '[]')
        }))
        setOrders(parsedOrders)
      } else {
        generarMocks()
      }
    } catch (err) {
      console.error('Error fetching terminal data:', err)
      generarMocks()
    } finally {
      setIsCargando(false)
    }
  }

  const generarMocks = () => {
    const mockOrders: Order[] = [
      {
        id: 'ord-101',
        business_id: 'laburreria-id',
        nombre_cliente: 'Rodrigo Méndez',
        telefono_cliente: '4431234567',
        calle: 'Av. Solidaridad',
        numero: '1240',
        colonia: 'Nueva Chapultepec',
        tipo: 'delivery',
        items: [
          { name: 'Burrito de Pastor Gigante', qty: 2, price: 120 },
          { name: 'Aguas Frescas Litro', qty: 1, price: 40 }
        ],
        total: 280,
        sello_otorgado: true,
        sello_aprobado: false,
        sello_rechazado: false,
        estado: 'pendiente',
        created_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        delivery_status: 'PENDING'
      },
      {
        id: 'ord-102',
        business_id: 'laburreria-id',
        nombre_cliente: 'Sofía Valenzuela',
        telefono_cliente: '4439876543',
        calle: 'Calle Morelia',
        numero: '45',
        colonia: 'Centro Histórico',
        tipo: 'delivery',
        items: [
          { name: 'Burrito Campesino de Res', qty: 1, price: 110 },
          { name: 'Quesadilla Especial de Asada', qty: 1, price: 95 }
        ],
        total: 205,
        sello_otorgado: true,
        sello_aprobado: true,
        sello_rechazado: false,
        estado: 'aprobado',
        created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        delivery_status: 'SHIPPED_SCHEDULED',
        scheduled_pickup_time: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        delivery_token: 'MOCK_TRV_77261A',
        notas: 'Tocar fuerte el timbre, portón negro.'
      },
      {
        id: 'ord-103',
        business_id: 'laburreria-id',
        nombre_cliente: 'Juan Carlos Pérez',
        telefono_cliente: '4521122334',
        calle: 'Av. Ventura Puente',
        numero: '888',
        colonia: 'Félix Ireta',
        tipo: 'delivery',
        items: [
          { name: 'Burrito Ahogado Especial', qty: 1, price: 130 }
        ],
        total: 130,
        sello_otorgado: true,
        sello_aprobado: true,
        sello_rechazado: false,
        estado: 'aprobado',
        created_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        delivery_status: 'SHIPPED_IMMEDIATE',
        scheduled_pickup_time: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        delivery_token: 'MOCK_TRV_BikerUpn',
        notas: 'Entregar a recepción del edificio.'
      }
    ]
    setOrders(mockOrders)
  }

  useEffect(() => {
    cargarDatos()
    const channel = supabase
      .channel('terminal-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
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
  }, [autoAccept])

  const handleToggleStore = async () => {
    const newEstado = business.estado === 'activo' ? 'desactivado' : 'activo'
    setBusiness(prev => ({ ...prev, estado: newEstado }))
    try {
      await supabase.from('businesses').update({ estado: newEstado }).eq('id', business.id)
    } catch (e) {
      console.error('Error toggling store status:', e)
    }
  }

  const handleUpdateDemand = async (status: 'NORMAL' | 'MODERADO' | 'SATURADO') => {
    setBusiness(prev => ({ ...prev, demand_status: status }))
    try {
      await supabase.from('businesses').update({ demand_status: status }).eq('id', business.id)
    } catch (e) {
      console.error('Error updating demand status:', e)
    }
  }

  const handleAceptar = async (orderId: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        let bufferMinutes = 30
        if (business.demand_status === 'MODERADO') bufferMinutes = 45
        if (business.demand_status === 'SATURADO') bufferMinutes = 60
        return {
          ...o,
          estado: 'aprobado',
          delivery_status: 'SHIPPED_SCHEDULED',
          scheduled_pickup_time: new Date(Date.now() + bufferMinutes * 60 * 1000).toISOString(),
          delivery_token: `MOCK_TRV_${Math.random().toString(36).substr(2, 6).toUpperCase()}`
        }
      }
      return o
    }))

    try {
      let bufferMinutes = 30
      if (business.demand_status === 'MODERADO') bufferMinutes = 45
      if (business.demand_status === 'SATURADO') bufferMinutes = 60
      const scheduledPickupTime = new Date(Date.now() + bufferMinutes * 60 * 1000).toISOString()
      const mockToken = `MOCK_TRV_${Math.random().toString(36).substr(2, 6).toUpperCase()}`

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

  return (
    <div className="bg-slate-50 min-h-screen text-zinc-900 flex flex-col font-sans select-none overflow-hidden selection:bg-amber-100">
      
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
            <div className="w-10 h-10 rounded-full border border-zinc-200 overflow-hidden bg-white flex items-center justify-center">
              <span className="text-xl">🍔</span>
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight tracking-tight text-zinc-900 flex items-center gap-1.5">
                {business.nombre}
                <span className="text-[10px] bg-zinc-100 text-zinc-650 font-mono py-0.5 px-1.5 rounded border border-zinc-200">
                  Suc. Centro
                </span>
              </h1>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'} inline-block`} />
                <span className="text-[10px] text-zinc-500 font-mono">
                  {isConnected ? 'Realtime Conectado' : 'Sin Conexión'}
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
              business.estado === 'activo' ? 'text-emerald-600' : 'text-zinc-400'
            }`}>
              {business.estado === 'activo' ? 'Tienda Activa' : 'Tienda Cerrada'}
            </span>
            <button
              onClick={handleToggleStore}
              className={`w-12 h-6 rounded-full relative transition-colors duration-300 border ${
                business.estado === 'activo' ? 'bg-emerald-100 border-emerald-300' : 'bg-zinc-200 border-zinc-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full absolute top-0.5 transition-all duration-300 ${
                  business.estado === 'activo' ? 'bg-emerald-600 left-6.5' : 'bg-zinc-400 left-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center gap-1 bg-white border border-zinc-200 p-1 rounded-xl shadow-sm">
            {[
              { id: 'NORMAL', label: '🟢 Normal', activeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
              { id: 'MODERADO', label: '🟡 Mod.', activeClass: 'bg-amber-50 text-amber-800 border-amber-300' },
              { id: 'SATURADO', label: '🔴 Sat.', activeClass: 'bg-rose-50 text-rose-800 border-rose-300' }
            ].map(sem => (
              <button
                key={sem.id}
                onClick={() => handleUpdateDemand(sem.id as any)}
                className={`text-[10px] font-bold py-1.5 px-2.5 rounded-lg border transition-all ${
                  business.demand_status === sem.id ? sem.activeClass : 'border-transparent text-zinc-550 hover:text-zinc-800'
                }`}
              >
                {sem.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex relative">

        {/* ── 2. NAVIGATION DRAWER (Light Mode) ──────────────────────────────── */}
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
              { id: 'ordenes', label: 'Órdenes Activas', icon: Clock },
              { id: 'menu', label: 'Menú / Carta', icon: Coffee },
              { id: 'historial', label: 'Historial de Órdenes', icon: History },
              { id: 'ventas', label: 'Resumen de Ventas', icon: DollarSign },
              { id: 'horarios', label: 'Horarios de Atención', icon: Clock },
              { id: 'notificaciones', label: 'Notificaciones', icon: Bell },
              { id: 'cuenta', label: 'Mi Cuenta', icon: User },
              { id: 'configuracion', label: 'Configuración', icon: Settings },
              { id: 'soporte', label: 'Centro de Soporte', icon: HelpCircle }
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
                  <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-amber-600' : 'text-zinc-400'}`} />
                  <span className="text-sm font-semibold">{item.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50" />
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-zinc-200 bg-slate-50">
            <button
              onClick={() => {
                if(confirm('¿Desea cerrar sesión en la terminal?')) {
                  window.location.href = '/login'
                }
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all font-semibold text-sm"
            >
              <LogOut className="w-5 h-5 text-rose-500" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </aside>

        {/* ── 3. MAIN TERMINAL DASHBOARD PANEL (Light Mode Kanban) ────────────── */}
        <main className="flex-1 p-4 overflow-hidden flex flex-col h-[calc(100vh-4rem)]">
          
          {activeTab === 'ordenes' && (
            <div className="flex-1 grid grid-cols-3 gap-4 h-full overflow-hidden">
              
              {/* COLUMNA 1: ACEPTAR (Nuevas Órdenes) */}
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
                      <p className="text-zinc-600 text-xs font-semibold">Esperando nuevas órdenes...</p>
                    </div>
                  ) : (
                    getColAceptar().map(order => (
                      <div key={order.id} className="bg-white border border-zinc-200/80 rounded-xl p-3.5 space-y-3 shadow-md hover:border-zinc-300 transition-colors text-zinc-900">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-black text-zinc-900 text-base">#{order.id.slice(-4).toUpperCase()}</p>
                            <p className="text-xs text-zinc-600 font-medium mt-0.5">{order.nombre_cliente}</p>
                          </div>
                          <span className="text-xs font-mono font-black text-amber-800 bg-amber-100 border border-amber-200 py-1 px-2.5 rounded-lg">
                            ${order.total} MXN
                          </span>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-2.5 border border-zinc-200/80 space-y-1.5">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-xs font-semibold text-zinc-800">
                              <span>
                                <span className="text-amber-600 font-black font-mono">{item.qty}x</span> {item.name}
                              </span>
                              <span className="text-zinc-500 font-mono">${item.price * item.qty}</span>
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={() => handleAceptar(order.id)}
                          className="w-full bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black uppercase text-xs tracking-wider py-3.5 px-4 rounded-xl shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer h-12"
                        >
                          <Check className="w-4.5 h-4.5 stroke-[3]" /> Aceptar Orden
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* COLUMNA 2: PREPARAR (En Cocina) */}
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
                      <p className="text-zinc-600 text-xs font-semibold">Sin pedidos en preparación</p>
                    </div>
                  ) : (
                    getColPreparar().map(order => (
                      <div key={order.id} className="bg-white border border-zinc-200/80 rounded-xl p-3.5 space-y-3 shadow-md hover:border-zinc-300 transition-colors">
                        
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-black text-zinc-900 text-base">#{order.id.slice(-4).toUpperCase()}</p>
                              <span className="text-[10px] text-zinc-550 font-mono">({order.tipo === 'delivery' ? 'Domicilio' : 'Llevar'})</span>
                            </div>
                            <p className="text-xs text-zinc-600 font-medium mt-0.5">{order.nombre_cliente}</p>
                          </div>
                          
                          <div className="text-right">
                            <span className="text-xs font-mono font-black text-blue-800 bg-blue-50 border border-blue-200 py-1 px-2.5 rounded-lg animate-pulse flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-blue-600" />
                              {formatTimeLeft(order.scheduled_pickup_time)}
                            </span>
                          </div>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-2.5 border border-zinc-200/80 space-y-1.5">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-xs font-semibold text-zinc-800">
                              <span>
                                <span className="text-blue-600 font-black font-mono">{item.qty}x</span> {item.name}
                              </span>
                              <span className="text-zinc-500 font-mono">${item.price * item.qty}</span>
                            </div>
                          ))}
                        </div>

                        {order.tipo === 'delivery' && (
                          <div className="bg-slate-50 rounded-lg p-2.5 border border-zinc-150 text-xs text-zinc-600 space-y-1">
                            <p className="font-bold flex items-center gap-1 text-[11px] text-zinc-700">
                              <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                              {order.calle} #{order.numero}, Col. {order.colonia}
                            </p>
                            {order.notas && (
                              <p className="italic text-[10px] text-zinc-500 bg-white p-1.5 rounded border border-zinc-200/50 mt-1">
                                Ref: "{order.notas}"
                              </p>
                            )}
                          </div>
                        )}

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

              {/* COLUMNA 3: ENTREGAR (Despacho de Bikers) */}
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
                      <p className="text-zinc-600 text-xs font-semibold">Sin pedidos listos para despacho</p>
                    </div>
                  ) : (
                    getColEntregar().map(order => (
                      <div key={order.id} className="bg-white border border-zinc-200/80 rounded-xl p-3.5 space-y-3 shadow-md hover:border-zinc-300 transition-colors">
                        
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-black text-zinc-900 text-base">#{order.id.slice(-4).toUpperCase()}</p>
                            <p className="text-xs text-zinc-600 font-medium mt-0.5">{order.nombre_cliente}</p>
                          </div>
                          
                          <span className={`text-[10px] font-bold uppercase py-1 px-2.5 rounded-lg border flex items-center gap-1 ${
                            order.delivery_status === 'DELIVERED' 
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                              : 'bg-indigo-50 text-indigo-800 border-indigo-200 animate-pulse'
                          }`}>
                            <Truck className="w-3.5 h-3.5" />
                            {order.delivery_status === 'DELIVERED' ? 'Completado' : 'Biker en Ruta'}
                          </span>
                        </div>

                        <div className="bg-slate-55/80 rounded-xl p-3 border border-zinc-200 space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-550 font-medium">Biker Asignado:</span>
                            <span className="text-zinc-900 font-black">Samuel Méndez</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-550 font-medium">Empresa:</span>
                            <span className="text-amber-700 font-bold">Bikers Upn</span>
                          </div>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-2.5 border border-zinc-150 text-xs text-zinc-600 space-y-1">
                          <p className="font-bold flex items-center gap-1 text-[11px] text-zinc-700">
                            <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                            {order.calle} #{order.numero}, Col. {order.colonia}
                          </p>
                          {order.notas && (
                            <p className="italic text-[10px] text-zinc-500 bg-white p-1.5 rounded border border-zinc-200/50 mt-1">
                              Ref: "{order.notas}"
                            </p>
                          )}
                        </div>

                        {order.delivery_status !== 'DELIVERED' ? (
                          <button
                            onClick={() => handleEntregado(order.id)}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs tracking-wider py-3.5 px-4 rounded-xl shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer h-12"
                          >
                            <CheckCircle2 className="w-4.5 h-4.5" /> Entregar Pedido
                          </button>
                        ) : (
                          <div className="w-full bg-slate-100 text-zinc-400 font-bold uppercase text-xs py-3.5 px-4 rounded-xl border border-zinc-200 text-center flex items-center justify-center gap-1.5 h-12">
                            <Check className="w-4.5 h-4.5" /> Despachado
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

          {/* Active Tab: MENÚ / CARTA */}
          {activeTab === 'menu' && (
            <div className="flex-1 bg-white border border-zinc-200 rounded-2xl p-6 overflow-hidden flex flex-col shadow-sm">
              <div className="flex justify-between items-center mb-6 shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900">Menú / Carta del Comercio</h2>
                  <p className="text-xs text-zinc-500 mt-1">Toggles rápidos para habilitar o deshabilitar productos e ingredientes.</p>
                </div>
                <button
                  onClick={cargarDatos}
                  className="bg-slate-50 hover:bg-slate-100 text-zinc-700 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 border border-zinc-200 shadow-sm"
                >
                  <RefreshCw className="w-4 h-4" /> Recargar Menú
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                {['Burritos', 'Especialidades', 'Ingredientes'].map(category => (
                  <div key={category} className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 border-b border-zinc-200 pb-2">{category}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {menuItems.filter(item => item.category === category).map(item => (
                        <div key={item.id} className="bg-white border border-zinc-200 rounded-xl p-4 flex justify-between items-center shadow-sm">
                          <div>
                            <p className="font-bold text-sm text-zinc-900">{item.name}</p>
                            <p className="text-[11px] text-zinc-500 mt-0.5">{item.category}</p>
                          </div>
                          
                          <button
                            onClick={() => setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, available: !m.available } : m))}
                            className={`w-12 h-6 rounded-full relative transition-colors duration-300 border ${
                              item.available ? 'bg-amber-100 border-amber-300' : 'bg-zinc-250 border-zinc-300'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full absolute top-0.5 transition-all duration-300 ${
                                item.available ? 'bg-amber-600 left-6.5' : 'bg-zinc-400 left-1'
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Tab: HISTORIAL DE ÓRDENES */}
          {activeTab === 'historial' && (
            <div className="flex-1 bg-white border border-zinc-200 rounded-2xl p-6 overflow-hidden flex flex-col shadow-sm">
              <div className="flex justify-between items-center mb-6 shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900">Historial de Órdenes</h2>
                  <p className="text-xs text-zinc-500 mt-1">Lista de pedidos despachados en el turno.</p>
                </div>
                <span className="text-xs bg-slate-100 text-zinc-650 py-1.5 px-3 rounded-lg border border-zinc-200 font-mono">
                  Hoy: {orders.filter(o => o.estado === 'entregado').length} entregas
                </span>
              </div>

              <div className="flex-1 overflow-y-auto pr-2">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-zinc-200 text-zinc-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="p-3">ID Pedido</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3">Items</th>
                      <th className="p-3 font-mono">Total</th>
                      <th className="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {orders.map(order => (
                      <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-black text-zinc-900">#{order.id.slice(-4).toUpperCase()}</td>
                        <td className="p-3">
                          <p className="font-bold text-zinc-800">{order.nombre_cliente}</p>
                          <p className="text-[10px] text-zinc-500 font-mono">{order.telefono_cliente}</p>
                        </td>
                        <td className="p-3 text-zinc-600">
                          {order.items.map(i => `${i.qty}x ${i.name}`).join(', ')}
                        </td>
                        <td className="p-3 font-mono text-zinc-800 font-bold">${order.total}</td>
                        <td className="p-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            order.estado === 'entregado'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {order.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Active Tab: RESUMEN DE VENTAS */}
          {activeTab === 'ventas' && (
            <div className="flex-1 bg-white border border-zinc-200 rounded-2xl p-6 overflow-hidden flex flex-col shadow-sm">
              <h2 className="text-xl font-bold text-zinc-900 mb-2 shrink-0">Resumen de Ventas</h2>
              <p className="text-xs text-zinc-500 mb-6 shrink-0">Monitoreo de ingresos rápidos y comportamiento de caja.</p>

              <div className="grid grid-cols-4 gap-6 mb-8 shrink-0">
                <div className="bg-slate-50 border border-zinc-200 rounded-xl p-5 space-y-2">
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Ventas Turno</p>
                  <p className="text-3xl font-black text-emerald-600">${salesSummary.total} MXN</p>
                </div>
                <div className="bg-slate-50 border border-zinc-200 rounded-xl p-5 space-y-2">
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Comandas Cobradas</p>
                  <p className="text-3xl font-black text-zinc-800">{salesSummary.count} órdenes</p>
                </div>
                <div className="bg-slate-50 border border-zinc-200 rounded-xl p-5 space-y-2">
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Ticket Promedio</p>
                  <p className="text-3xl font-black text-amber-700">${salesSummary.average} MXN</p>
                </div>
                <div className="bg-slate-50 border border-zinc-200 rounded-xl p-5 space-y-2">
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Métodos de Cobro</p>
                  <div className="flex justify-between items-center text-xs pt-1">
                    <span className="text-zinc-600">Efectivo: ${salesSummary.cash}</span>
                    <span className="text-zinc-600">Tarjeta: ${salesSummary.card}</span>
                  </div>
                </div>
              </div>

              {/* Bar chart mockup */}
              <div className="flex-1 bg-slate-50 rounded-xl border border-zinc-200 p-6 flex flex-col justify-between">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Flujo de Órdenes Hoy</span>
                </div>
                <div className="flex-1 flex items-end gap-6 justify-around pt-6">
                  {[40, 65, 30, 85, 95, 55].map((val, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-3">
                      <div className="w-full bg-zinc-200 rounded-lg h-36 relative overflow-hidden border border-zinc-300">
                        <div 
                          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-500 to-amber-400 rounded-t"
                          style={{ height: `${val}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">{2 + idx} PM</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Active Tab: HORARIOS */}
          {activeTab === 'horarios' && (
            <div className="flex-1 bg-white border border-zinc-200 rounded-2xl p-6 overflow-hidden flex flex-col shadow-sm">
              <h2 className="text-xl font-bold text-zinc-900 mb-2 shrink-0">Horarios del Portal de Clientes</h2>
              <p className="text-xs text-zinc-500 mb-6 shrink-0">Controla las horas de pedidos.</p>

              <div className="flex-1 overflow-y-auto space-y-4 max-w-xl">
                {[
                  { day: 'Lunes', open: '14:00', close: '22:00', active: true },
                  { day: 'Martes', open: '14:00', close: '22:00', active: true },
                  { day: 'Miércoles', open: '14:00', close: '22:00', active: true },
                  { day: 'Jueves', open: '14:00', close: '22:00', active: true },
                  { day: 'Viernes', open: '14:00', close: '23:00', active: true },
                  { day: 'Sábado', open: '14:00', close: '23:00', active: true },
                  { day: 'Domingo', open: '14:00', close: '22:00', active: true }
                ].map(d => (
                  <div key={d.day} className="bg-slate-50 border border-zinc-200 rounded-xl p-4 flex justify-between items-center shadow-sm">
                    <span className="font-bold text-sm text-zinc-700">{d.day}</span>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="bg-white px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-750">{d.open}</span>
                        <span className="text-zinc-400">—</span>
                        <span className="bg-white px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-750">{d.close}</span>
                      </div>
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Tab: CONFIGURACIÓN */}
          {activeTab === 'configuracion' && (
            <div className="flex-1 bg-white border border-zinc-200 rounded-2xl p-6 overflow-hidden flex flex-col shadow-sm">
              <h2 className="text-xl font-bold text-zinc-900 mb-2 shrink-0">Ajustes del Dispositivo</h2>
              <p className="text-xs text-zinc-500 mb-6 shrink-0">Vinculación de impresoras y periféricos.</p>

              <div className="flex-1 overflow-y-auto space-y-6 max-w-2xl pr-2">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 border-b border-zinc-200 pb-2">Preferencias Generales</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-zinc-200 rounded-xl p-4 flex justify-between items-center shadow-sm">
                      <div>
                        <p className="font-bold text-sm text-zinc-900">Orientación</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">Define la vista de pantalla.</p>
                      </div>
                      <select
                        value={deviceOrientation}
                        onChange={(e) => setDeviceOrientation(e.target.value as any)}
                        className="bg-white border border-zinc-200 rounded-lg text-xs font-bold p-2 text-zinc-700 focus:outline-none"
                      >
                        <option value="landscape">Horizontal (Tablet)</option>
                        <option value="portrait">Vertical (Celular)</option>
                      </select>
                    </div>

                    <div className="bg-slate-50 border border-zinc-200 rounded-xl p-4 flex justify-between items-center shadow-sm">
                      <div>
                        <p className="font-bold text-sm text-zinc-900">Auto Aceptar</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">Acepta pedidos en automático.</p>
                      </div>
                      <button
                        onClick={() => toggleConfig('term_auto_accept', autoAccept, setAutoAccept)}
                        className={`w-12 h-6 rounded-full relative transition-colors duration-300 border ${
                          autoAccept ? 'bg-amber-100 border-amber-300' : 'bg-zinc-200 border-zinc-300'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full absolute top-0.5 transition-all duration-300 ${
                            autoAccept ? 'bg-amber-600 left-6.5' : 'bg-zinc-400 left-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 border-b border-zinc-200 pb-2">Impresión ESC/POS</h3>

                  <div className="space-y-3">
                    <label className="flex items-center gap-3 bg-slate-50 border border-zinc-205 p-3.5 rounded-xl cursor-pointer shadow-sm">
                      <input 
                        type="checkbox"
                        checked={autoPrintChecklist}
                        onChange={() => toggleConfig('term_auto_print_checklist', autoPrintChecklist, setAutoPrintChecklist)}
                        className="w-4 h-4 accent-amber-600 rounded border-zinc-300 focus:ring-transparent"
                      />
                      <div>
                        <p className="text-sm font-bold text-zinc-700">Impresión automática de comandas y checklist</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 bg-slate-50 border border-zinc-205 p-3.5 rounded-xl cursor-pointer shadow-sm">
                      <input 
                        type="checkbox"
                        checked={autoPrintOnAccept}
                        onChange={() => toggleConfig('term_auto_print_accept', autoPrintOnAccept, setAutoPrintOnAccept)}
                        className="w-4 h-4 accent-amber-600 rounded border-zinc-300 focus:ring-transparent"
                      />
                      <div>
                        <p className="text-sm font-bold text-zinc-700">Impresión de comanda al aceptar</p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-zinc-200 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600">Bluetooth</h3>
                    <button
                      onClick={() => toggleConfig('term_bluetooth', enableBluetooth, setEnableBluetooth)}
                      className={`w-10 h-5 rounded-full relative transition-colors duration-300 border ${
                        enableBluetooth ? 'bg-amber-100 border-amber-300' : 'bg-zinc-200 border-zinc-300'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full absolute top-0.5 transition-all duration-300 ${enableBluetooth ? 'bg-amber-600 left-5.5' : 'bg-zinc-400 left-0.5'}`} />
                    </button>
                  </div>

                  <div className="bg-slate-50 border border-zinc-200 rounded-xl p-5 space-y-4 shadow-sm">
                    <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">Dispositivos Asociados</span>
                    <div className="divide-y divide-zinc-200">
                      {printers.map(p => (
                        <div key={p.id} className="py-3 flex justify-between items-center">
                          <span className="text-sm text-zinc-700">{p.name}</span>
                          <button
                            onClick={() => setPrinters(prev => prev.map(item => item.id === p.id ? { ...item, active: !item.active } : item))}
                            className={`text-xs font-bold py-1 px-3.5 rounded border ${
                              p.active ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-white text-zinc-550 border-zinc-200'
                            }`}
                          >
                            {p.active ? 'Asociado' : 'Asociar'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Active Tab: CENTRO DE SOPORTE */}
          {activeTab === 'soporte' && (
            <div className="flex-1 bg-white border border-zinc-200 rounded-2xl p-6 overflow-hidden flex flex-col shadow-sm">
              <h2 className="text-xl font-bold text-zinc-900 mb-2 shrink-0">Soporte y Centro de Ayuda</h2>
              <p className="text-xs text-zinc-500 mb-6 shrink-0">Manuales de terminal.</p>
              
              <div className="bg-slate-50 border border-zinc-200 rounded-xl p-5 max-w-sm shadow-sm">
                <p className="text-xs text-zinc-600">Contacto con el equipo de soporte técnico:</p>
                <a
                  href="https://wa.me/524431234567"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider py-2.5 px-4 rounded-xl mt-3 shadow-md"
                >
                  💬 Soporte por WhatsApp
                </a>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
