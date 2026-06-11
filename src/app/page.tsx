'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  QrCode,
  Bell,
  Smartphone,
  Sparkles,
  TrendingUp,
  UserCheck,
  Zap,
  ChevronRight,
  ExternalLink,
  Laptop,
  CheckCircle2,
  Award,
  Flame,
  Truck,
  Coffee,
  Printer,
  HelpCircle,
  Database,
  ArrowRight,
  ShieldCheck,
  MessageSquare,
  Clock,
  Check
} from 'lucide-react'

export default function LandingPage() {
  const router = useRouter()
  const [session, setSession] = useState<{ rol: string; slug: string } | null>(null)
  const [isProduction, setIsProduction] = useState(false)
  const [activePillar, setActivePillar] = useState<'cliente' | 'terminal' | 'logistica'>('cliente')
  
  // Demo Booking State
  const [bookingName, setBookingName] = useState('')
  const [bookingPhone, setBookingPhone] = useState('')
  const [bookingRest, setBookingRest] = useState('')
  const [bookingSent, setBookingSent] = useState(false)
  
  // Realtime Simulation for Demand traffic light
  const [simDemand, setSimDemand] = useState<'NORMAL' | 'MODERADO' | 'SATURADO'>('NORMAL')
  const [simTimeLeft, setSimTimeLeft] = useState(30)

  useEffect(() => {
    setIsProduction(window.location.hostname.includes('loyaltyclub.mx'))
    const rol = document.cookie.match(/session_rol=([^;]+)/)?.[1]
    const slug = document.cookie.match(/session_business_slug=([^;]+)/)?.[1]
    if (rol && slug) {
      setSession({ rol, slug })
    }
  }, [])

  // Timer loop for demand simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setSimTimeLeft(prev => {
        if (prev <= 1) {
          return simDemand === 'NORMAL' ? 45 : simDemand === 'MODERADO' ? 60 : 30
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [simDemand])

  useEffect(() => {
    if (simTimeLeft === 45) setSimDemand('MODERADO')
    else if (simTimeLeft === 60) setSimDemand('SATURADO')
    else if (simTimeLeft === 30) setSimDemand('NORMAL')
  }, [simTimeLeft])

  const getDashboardUrl = () => {
    if (!session) return '/login'
    const domain = isProduction ? 'loyaltyclub.mx' : 'localhost:3000'
    const protocol = isProduction ? 'https' : 'http'
    
    if (session.rol === 'superadmin') {
      return `${protocol}://admin.${domain}/superadmin`
    }
    if (session.rol === 'admin_comercio') {
      return `${protocol}://${session.slug}.partners.${domain}/dashboard`
    }
    return `${protocol}://${session.slug}.${domain}/cliente`
  }

  const getDemoUrl = () => {
    const domain = isProduction ? 'loyaltyclub.mx' : 'localhost:3000'
    const protocol = isProduction ? 'https' : 'http'
    return `${protocol}://laburreria.${domain}`
  }

  const getDemoPartnerUrl = () => {
    const domain = isProduction ? 'loyaltyclub.mx' : 'localhost:3000'
    const protocol = isProduction ? 'https' : 'http'
    return `${protocol}://laburreria.partners.${domain}/login`
  }

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (bookingName && bookingPhone && bookingRest) {
      setBookingSent(true)
      setTimeout(() => {
        setBookingSent(false)
        setBookingName('')
        setBookingPhone('')
        setBookingRest('')
      }, 5000)
    }
  }

  return (
    <div className="bg-white min-h-screen text-zinc-900 overflow-x-hidden selection:bg-amber-100 selection:text-amber-800">
      
      {/* Light soft background glow animations */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-amber-500/5 blur-[150px] rounded-full -z-10 animate-pulse [animation-duration:8s]" />
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-orange-500/5 blur-[130px] rounded-full -z-10 animate-pulse [animation-duration:12s]" />
      
      {/* ── BARRA DE NAVEGACIÓN ────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-zinc-200 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-md shadow-amber-500/10">
              <span className="text-white font-black text-xl">👑</span>
            </div>
            <div>
              <span className="font-black text-lg tracking-tight text-zinc-900 block">LoyaltyClub</span>
              <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest block -mt-1">Enterprise SaaS</span>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-zinc-650">
            <a href="#features" className="hover:text-zinc-900 transition-colors">Ecosistema</a>
            <a href="#terminal-info" className="hover:text-zinc-900 transition-colors">Tablet Terminal</a>
            <a href="#coexistence" className="hover:text-zinc-900 transition-colors">Integración POS</a>
            <a href="#pricing" className="hover:text-zinc-900 transition-colors">Planes</a>
          </nav>

          <div className="flex items-center gap-3">
            {session ? (
              <a 
                href={getDashboardUrl()}
                className="bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-black uppercase tracking-wider py-2.5 px-5 rounded-xl shadow-md shadow-amber-500/10 transition-all flex items-center gap-1.5"
              >
                Mi Panel <ChevronRight className="w-4 h-4" />
              </a>
            ) : (
              <>
                <a 
                  href="/login"
                  className="text-zinc-600 hover:text-zinc-900 text-xs font-black uppercase tracking-wider py-2.5 px-4 transition-colors"
                >
                  Acceso Negocios
                </a>
                <a 
                  href="#book-demo"
                  className="bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-bold uppercase tracking-wider py-2.5 px-5 rounded-xl transition-all shadow-md shadow-amber-500/15"
                >
                  Agendar Demo
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ────────────────────────────── */}
      <section className="relative pt-20 pb-28 px-6 bg-slate-50/50">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          
          <div className="lg:col-span-7 space-y-8">
            <div className="inline-flex items-center gap-2 bg-amber-100 border border-amber-200 rounded-full py-1.5 px-3.5 shadow-sm">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-widest font-mono">SaaS Enterprise de Pedidos y Lealtad</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-zinc-900 leading-[1.08] tracking-tight">
              Transforma tu WhatsApp en una <span className="bg-gradient-to-r from-amber-650 via-orange-600 to-yellow-600 text-transparent bg-clip-text">máquina automatizada</span> de pedidos.
            </h1>

            <p className="text-base sm:text-lg text-zinc-600 leading-relaxed max-w-xl">
              Sin comisiones por plataforma, sin intermediación de apps externas. Control absoluto desde la cocina con tu propia terminal de pedidos táctil y logística semiautomatizada.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              <a 
                href="#book-demo"
                className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black uppercase text-xs tracking-wider py-4 px-8 rounded-xl shadow-lg shadow-amber-500/20 hover:shadow-amber-500/35 transition-all text-center flex items-center justify-center gap-2"
              >
                Agendar Demostración En Vivo <ArrowRight className="w-4 h-4" />
              </a>
              <a 
                href={getDemoUrl()}
                target="_blank"
                rel="noreferrer"
                className="bg-slate-100 hover:bg-slate-200 text-zinc-800 font-bold uppercase text-xs tracking-wider py-4 px-8 rounded-xl border border-zinc-200 hover:border-zinc-300 transition-all text-center flex items-center justify-center gap-2"
              >
                Probar Demo Cliente (La Burrería) <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-zinc-200">
              <div>
                <p className="text-2xl font-black text-zinc-900">$0</p>
                <p className="text-xs text-zinc-550 font-medium">Comisión por pedidos</p>
              </div>
              <div>
                <p className="text-2xl font-black text-zinc-900">100%</p>
                <p className="text-xs text-zinc-550 font-medium">Marca Propia (White-label)</p>
              </div>
              <div>
                <p className="text-2xl font-black text-zinc-900">&lt; 3s</p>
                <p className="text-xs text-zinc-550 font-medium">Despacho de Motos local</p>
              </div>
            </div>
          </div>

          {/* Interactive Floating Badge Mockup Visualizer (Light Mode) */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md bg-white border border-zinc-200 rounded-3xl p-6 shadow-xl overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
              
              <div className="flex justify-between items-center border-b border-zinc-200 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-mono font-bold text-zinc-750">Terminal Activa</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold py-1 px-2.5 rounded-md border ${
                    simDemand === 'NORMAL' 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                      : simDemand === 'MODERADO'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}>
                    Semáforo: {simDemand}
                  </span>
                </div>
              </div>

              {/* Simulated incoming order card */}
              <div className="bg-slate-50 border border-zinc-200 rounded-2xl p-4 space-y-3 relative shadow-sm">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-amber-600 font-mono font-bold uppercase tracking-wider">Nuevo Pedido</span>
                    <h3 className="font-bold text-zinc-900 text-sm">#LaBurrería-8842</h3>
                  </div>
                  <span className="text-xs font-mono font-bold text-zinc-700">${340} MXN</span>
                </div>
                
                <div className="border-t border-zinc-200 pt-2 space-y-1 text-xs text-zinc-600">
                  <p>• 2x Burrito Ahogado Especial</p>
                  <p>• 1x Papas Fritas de la Casa</p>
                </div>

                <div className="flex justify-between items-center text-[10px] text-zinc-500 pt-1">
                  <span>🛵 Delivery</span>
                  <span>Prep: {simDemand === 'NORMAL' ? '30m' : simDemand === 'MODERADO' ? '45m' : '60m'}</span>
                </div>

                <button className="w-full bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black text-xs py-3 rounded-xl uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm">
                  <Check className="w-4 h-4 stroke-[3]" /> Aceptar en Cocina
                </button>
              </div>

              {/* Floating micro-badges */}
              <div className="absolute -bottom-4 -left-4 bg-white border border-zinc-200 rounded-2xl p-3 shadow-lg flex items-center gap-3 animate-bounce [animation-duration:5s] z-20">
                <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                  <Printer className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="text-[9px] text-zinc-400 font-bold uppercase">ESC/POS</p>
                  <p className="text-xs font-black text-zinc-800">Auto-impresión</p>
                </div>
              </div>

              <div className="absolute -top-4 -right-4 bg-white border border-zinc-200 rounded-2xl p-3 shadow-lg flex items-center gap-3 animate-bounce [animation-duration:6s] z-20">
                <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                  <Zap className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="text-[9px] text-zinc-400 font-bold uppercase">Fletera Local</p>
                  <p className="text-xs font-black text-zinc-800">Despacho Inmediato</p>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ── 3-PILLAR ECOSYSTEM SECTION ────────────────────────────── */}
      <section id="features" className="py-24 px-6 bg-slate-50 border-y border-zinc-200">
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-[11px] font-black text-amber-600 uppercase tracking-widest font-mono">Ecosistema Completo</span>
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight">El motor de 3 pilares que redefine tu canal digital</h2>
            <p className="text-zinc-600 text-sm leading-relaxed">
              No dependas de plataformas que devoran tus márgenes comerciales. Te entregamos un ecosistema digital de nivel corporativo.
            </p>
          </div>

          {/* Pillars Tabs Navigation */}
          <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto mb-12">
            {[
              { id: 'cliente', label: '1. Portal del Cliente', desc: 'Menú Inteligente y Tarjetas VIP' },
              { id: 'terminal', label: '2. Terminal de Cocina', desc: 'Gestión Profesional de Pedidos' },
              { id: 'logistica', label: '3. Logística Inteligente', desc: 'Despacho Express sin códigos' }
            ].map(pillar => (
              <button
                key={pillar.id}
                onClick={() => setActivePillar(pillar.id as any)}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  activePillar === pillar.id
                    ? 'bg-amber-500/10 border-amber-300 text-zinc-900 shadow-md'
                    : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'
                }`}
              >
                <p className="font-bold text-sm">{pillar.label}</p>
                <p className="text-[10px] text-zinc-550 mt-0.5">{pillar.desc}</p>
              </button>
            ))}
          </div>

          {/* Slideshow content in Light Mode */}
          <div className="bg-white border border-zinc-200 rounded-3xl p-8 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center min-h-[380px] shadow-sm">
            
            {activePillar === 'cliente' && (
              <>
                <div className="md:col-span-5 space-y-6">
                  <div className="w-12 h-12 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center text-amber-600 shadow-sm">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-black text-zinc-900">El Portal del Cliente VIP</h3>
                  <p className="text-zinc-650 text-xs leading-relaxed">
                    Un menú interactivo premium que corre en el navegador móvil de tus comensales sin descargas. Integra pases VIP nativos con soporte directo para <b>Apple Wallet</b> y <b>Google Wallet</b>.
                  </p>
                  <ul className="space-y-2 text-xs text-zinc-600">
                    <li className="flex items-center gap-2">🟢 Menú digital auto-sincronizado</li>
                    <li className="flex items-center gap-2">🟢 Pases VIP que no se extravían</li>
                    <li className="flex items-center gap-2">🟢 Notificaciones push de proximidad por GPS</li>
                  </ul>
                </div>
                <div className="md:col-span-7 flex justify-center">
                  <div className="w-64 h-[400px] border-4 border-zinc-200 rounded-3xl bg-slate-50 p-4 shadow-xl relative overflow-hidden flex flex-col justify-between">
                    <div className="w-20 h-4 bg-zinc-300 rounded-full mx-auto" />
                    
                    <div className="bg-amber-500 rounded-2xl p-4 text-zinc-950 space-y-4 my-auto shadow-md">
                      <div className="flex justify-between items-center">
                        <span className="font-black text-xs">LA BURRERÍA</span>
                        <span className="text-[9px] font-mono bg-zinc-950 text-amber-400 py-0.5 px-1.5 rounded-full font-bold">CLIENTE VIP</span>
                      </div>
                      
                      <div className="text-center py-2">
                        <p className="text-3xl font-black tracking-widest font-mono">★★★★☆</p>
                        <p className="text-[10px] font-semibold mt-1">4 de 5 sellos acumulados</p>
                      </div>

                      <div className="bg-white/20 p-2.5 rounded-xl text-center text-[10px] font-bold">
                        ¡Falta 1 sello para refresco gratis!
                      </div>
                    </div>

                    <div className="text-[10px] text-zinc-400 font-mono text-center">
                      laburreria.loyaltyclub.mx
                    </div>
                  </div>
                </div>
              </>
            )}

            {activePillar === 'terminal' && (
              <>
                <div className="md:col-span-5 space-y-6">
                  <div className="w-12 h-12 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center text-amber-600 shadow-sm">
                    <Laptop className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-black text-zinc-900">La Terminal de Cocina (Tablet)</h3>
                  <p className="text-zinc-655 text-xs leading-relaxed">
                    Terminal de cocina profesional optimizada para tablets de 10 pulgadas. Ofrece un flujo visual de 3 columnas (Aceptar, Preparar, Entregar) con integración para impresoras térmicas ESC/POS.
                  </p>
                  <ul className="space-y-2 text-xs text-zinc-600">
                    <li className="flex items-center gap-2">🟢 Interfaz clara de alta legibilidad para cocina</li>
                    <li className="flex items-center gap-2">🟢 Vinculación de impresoras térmica de tickets</li>
                    <li className="flex items-center gap-2">🟢 Configuración de auto-aceptación de comandas</li>
                  </ul>
                </div>
                <div className="md:col-span-7">
                  <div className="bg-slate-50 border border-zinc-200 rounded-2xl p-4 shadow-md space-y-3">
                    <div className="flex justify-between items-center text-[11px] text-zinc-550 font-mono">
                      <span>VISTA TERMINAL DE COCINA</span>
                      <span className="text-amber-600 font-bold">ESC/POS: Conectada</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 pt-2">
                      <div className="bg-white p-2 rounded-xl text-center border border-zinc-200 space-y-1.5 shadow-sm">
                        <span className="text-[9px] font-bold text-amber-800 font-mono block">Nuevas (1)</span>
                        <div className="bg-slate-50 p-2 rounded border border-zinc-200 text-[10px]">
                          <p className="font-bold text-zinc-900">#9812</p>
                          <span className="text-zinc-550 block mt-0.5">$180</span>
                        </div>
                      </div>
                      <div className="bg-white p-2 rounded-xl text-center border border-zinc-200 space-y-1.5 shadow-sm">
                        <span className="text-[9px] font-bold text-blue-800 font-mono block">Cocina (1)</span>
                        <div className="bg-slate-50 p-2 rounded border border-zinc-200 text-[10px]">
                          <p className="font-bold text-zinc-900">#8842</p>
                          <span className="text-blue-600 font-mono block mt-0.5">18:42</span>
                        </div>
                      </div>
                      <div className="bg-white p-2 rounded-xl text-center border border-zinc-200 space-y-1.5 shadow-sm">
                        <span className="text-[9px] font-bold text-emerald-800 font-mono block">Ruta (1)</span>
                        <div className="bg-slate-50 p-2 rounded border border-zinc-200 text-[10px]">
                          <p className="font-bold text-zinc-900">#7730</p>
                          <span className="text-emerald-600 block mt-0.5">Samuel M.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activePillar === 'logistica' && (
              <>
                <div className="md:col-span-5 space-y-6">
                  <div className="w-12 h-12 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center text-amber-600 shadow-sm">
                    <Truck className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-black text-zinc-900">Logística de Despacho Semiautomático</h3>
                  <p className="text-zinc-655 text-xs leading-relaxed">
                    Evita retrasos en horas pico. Ajusta la demanda con el Semáforo Global (30m, 45m, 60m) y despacha motocicletas locales al presionar el Botón Mágico de comanda terminada.
                  </p>
                  <ul className="space-y-2 text-xs text-zinc-600">
                    <li className="flex items-center gap-2">🟢 Integración con flotas locales de confianza</li>
                    <li className="flex items-center gap-2">🟢 Alertas en tiempo real para repartidores</li>
                    <li className="flex items-center gap-2">🟢 Cancelación y anulación instantánea</li>
                  </ul>
                </div>
                <div className="md:col-span-7 flex justify-center">
                  <div className="bg-slate-50 border border-zinc-200 rounded-2xl p-6 shadow-md space-y-4 max-w-sm">
                    <h4 className="text-xs font-bold text-zinc-550 font-mono">SIMULACIÓN DE DESPACHO</h4>
                    <div className="flex justify-between items-center border-b border-zinc-150 pb-2">
                      <div>
                        <p className="text-sm font-bold text-zinc-800">Bikers Upn</p>
                        <p className="text-[10px] text-zinc-500">Repartidor en ruta (12 min)</p>
                      </div>
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <div className="bg-white border border-zinc-200 rounded-xl p-3.5 text-center text-xs space-y-2 shadow-sm">
                      <p className="text-zinc-600">¿Pedido listo en cocina?</p>
                      <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-[10px] uppercase tracking-wider shadow-sm">
                        🏁 PEDIDO LISTO (DESPACHAR YA)
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

          </div>

        </div>
      </section>

      {/* ── COEXISTENCE WITH POS SECTION ────────────────────────────── */}
      <section id="coexistence" className="py-24 px-6 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            
            <div className="lg:col-span-6 space-y-6">
              <span className="text-[11px] font-black text-amber-600 uppercase tracking-widest font-mono">Convivencia en Paralelo</span>
              <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 leading-tight">
                No reemplazamos tu sistema actual. Lo complementamos.
              </h2>
              <p className="text-zinc-600 text-sm leading-relaxed">
                Entendemos que ya utilizas software local de punto de venta (como <b>Soft Restaurant</b>) para comandar mesas o llevar la contabilidad interna de tu negocio.
              </p>
              <p className="text-zinc-605 text-sm leading-relaxed">
                LoyaltyClub actúa exclusivamente como tu <b>canal digital de alta eficiencia</b>. Captura los pedidos de tus clientes VIP en WhatsApp o web, procesa el despacho de motocicletas de forma semiautomática y fideliza a los clientes en paralelo sin interferir con tus sistemas locales.
              </p>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="border border-zinc-200 p-4 rounded-2xl bg-slate-50 shadow-sm">
                  <h4 className="font-bold text-zinc-900 text-sm">Fácil Operación</h4>
                  <p className="text-zinc-550 text-xs mt-1">Tus meseros capturan el pedido en Soft Restaurant y la fidelización del cliente se valida en 2 segundos con su QR.</p>
                </div>
                <div className="border border-zinc-200 p-4 rounded-2xl bg-slate-50 shadow-sm">
                  <h4 className="font-bold text-zinc-900 text-sm">Cero Comisiones</h4>
                  <p className="text-zinc-550 text-xs mt-1">Conecta con tus repartidores locales de confianza con tarifas justas y transparentes.</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 bg-slate-50 border border-zinc-200 p-8 rounded-3xl relative overflow-hidden shadow-sm">
              <h3 className="font-bold text-zinc-850 mb-6 text-sm uppercase tracking-wider font-mono border-b border-zinc-200 pb-3">Flujo de Operación Paralela</h3>
              
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center font-bold text-xs text-amber-600 shadow-sm shrink-0">1</div>
                  <div>
                    <h4 className="font-bold text-zinc-900 text-xs">Pedido recibido en LoyaltyClub</h4>
                    <p className="text-zinc-550 text-[11px] mt-0.5">El cliente pide desde WhatsApp y se registra en la terminal de cocina con su puntaje VIP.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center font-bold text-xs text-amber-600 shadow-sm shrink-0">2</div>
                  <div>
                    <h4 className="font-bold text-zinc-900 text-xs">Se registra el cobro en tu POS local</h4>
                    <p className="text-zinc-550 text-[11px] mt-0.5">El cajero digita la venta en Soft Restaurant de forma ordinaria para control interno.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center font-bold text-xs text-amber-600 shadow-sm shrink-0">3</div>
                  <div>
                    <h4 className="font-bold text-zinc-900 text-xs">Despacho de motocicletas local</h4>
                    <p className="text-zinc-550 text-[11px] mt-0.5">Al presionar "Pedido Listo" en la tablet, se notifica automáticamente a la flota local para su entrega inmediata.</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── BOOK A DEMO CTA SECTION ────────────────────────────── */}
      <section id="book-demo" className="py-24 px-6 bg-slate-50 border-t border-zinc-205">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white border border-zinc-200 rounded-3xl p-8 md:p-12 relative overflow-hidden shadow-md">
            
            <div className="max-w-xl space-y-6">
              <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Agenda una demostración de la Terminal de Cocina</h2>
              <p className="text-zinc-650 text-sm leading-relaxed">
                Descubre cómo LoyaltyClub puede automatizar el despacho de tus pedidos, ahorrar miles en comisiones y fidelizar a tus comensales recurrentes.
              </p>

              {bookingSent ? (
                <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl space-y-2 text-center md:text-left shadow-sm">
                  <p className="font-bold text-emerald-800 flex items-center gap-2 justify-center md:justify-start">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" /> ¡Solicitud de demostración recibida!
                  </p>
                  <p className="text-zinc-600 text-xs leading-relaxed">Un especialista de LoyaltyClub te contactará por WhatsApp para coordinar la videollamada.</p>
                </div>
              ) : (
                <form onSubmit={handleBookingSubmit} className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      type="text"
                      required
                      placeholder="Tu nombre"
                      value={bookingName}
                      onChange={e => setBookingName(e.target.value)}
                      className="bg-slate-50 border border-zinc-200 rounded-xl p-3.5 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-amber-500 transition-colors shadow-sm"
                    />
                    <input
                      type="tel"
                      required
                      placeholder="Teléfono (10 dígitos)"
                      value={bookingPhone}
                      onChange={e => setBookingPhone(e.target.value)}
                      className="bg-slate-50 border border-zinc-200 rounded-xl p-3.5 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-amber-500 transition-colors shadow-sm"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Nombre de tu restaurante"
                      value={bookingRest}
                      onChange={e => setBookingRest(e.target.value)}
                      className="bg-slate-50 border border-zinc-200 rounded-xl p-3.5 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-amber-500 transition-colors shadow-sm"
                    />
                  </div>
                  
                  <button
                    type="submit"
                    className="w-full md:w-auto bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black uppercase text-xs tracking-wider py-4 px-8 rounded-xl transition-all shadow-md shadow-amber-500/10 cursor-pointer"
                  >
                    Confirmar Reserva de Demo
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── PLANES DE PRECIO ────────────────────────────── */}
      <section id="pricing" className="py-24 px-6 bg-white border-t border-zinc-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-xl mx-auto space-y-3 mb-16">
            <h2 className="text-[11px] font-black text-amber-600 uppercase tracking-widest font-mono">Precios Claros y Transparentes</h2>
            <h3 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight">Elige el plan ideal para tu restaurante</h3>
            <p className="text-zinc-650 text-sm leading-relaxed">
              Sin cargos ocultos, sin contratos a largo plazo. Cancela cuando quieras.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                name: "Emprendedor",
                price: "$499",
                period: "/ mes",
                desc: "Ideal para cafeterías o foodtrucks individuales que inician su digitalización.",
                features: [
                  "1 Sucursal",
                  "Hasta 250 Clientes VIP",
                  "Notificaciones push básicas",
                  "Soporte por correo electrónico",
                  "Subdominio corporativo"
                ],
                button: "Comenzar Gratis",
                popular: false
              },
              {
                name: "Crecimiento Pro",
                price: "$999",
                period: "/ mes",
                desc: "El plan recomendado para restaurantes establecidos con flujo de clientes constante.",
                features: [
                  "3 Sucursales",
                  "Clientes VIP ilimitados",
                  "Integración Apple & Google Wallet",
                  "Notificaciones GeoPush automáticas",
                  "Ruleta de premios configurable",
                  "Soporte priorizado por WhatsApp"
                ],
                button: "Iniciar Prueba Pro",
                popular: true
              },
              {
                name: "Multi-Sucursal",
                price: "$1,899",
                period: "/ mes",
                desc: "Pensado para franquicias o cadenas con múltiples puntos de venta físicos.",
                features: [
                  "Sucursales ilimitadas",
                  "Métricas consolidadas de marca",
                  "Usuarios de staff y cajeros ilimitados",
                  "Exportación de datos a XLS/CSV",
                  "Dominio web completamente propio",
                  "Gerente de cuenta exclusivo"
                ],
                button: "Contactar Ventas",
                popular: false
              }
            ].map((plan, i) => (
              <div 
                key={i} 
                className={`bg-white border rounded-3xl p-8 space-y-6 relative transition-all ${
                  plan.popular 
                    ? 'border-amber-500 shadow-lg scale-105 z-10' 
                    : 'border-zinc-200 shadow-md hover:shadow-lg'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-500 text-zinc-950 font-black uppercase text-[10px] tracking-widest py-1 px-3.5 rounded-full">
                    RECOMENDADO
                  </span>
                )}
                
                <div className="space-y-1">
                  <p className="text-zinc-500 font-bold uppercase text-xs tracking-wider">{plan.name}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black text-zinc-900">{plan.price}</span>
                    <span className="text-zinc-500 font-semibold text-sm">{plan.period}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed pt-2">{plan.desc}</p>
                </div>

                <ul className="space-y-3.5 border-t border-zinc-200 pt-6">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-zinc-650 font-medium">
                      <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="#book-demo"
                  className={`block w-full py-3.5 px-4 rounded-2xl font-black uppercase text-xs tracking-wider transition-all text-center ${
                    plan.popular
                      ? 'bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-md'
                      : 'bg-slate-100 hover:bg-slate-250 text-zinc-700'
                  }`}
                >
                  {plan.button}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER DE CONVERSIÓN ────────────────────────────── */}
      <footer className="bg-slate-50 text-zinc-900 py-16 px-6 border-t border-zinc-200 relative overflow-hidden">
        
        <div className="max-w-7xl mx-auto relative z-10 text-center space-y-6 max-w-3xl">
          <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto text-zinc-950 font-black text-2xl shadow-md shadow-amber-500/10">
            👑
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 leading-tight">
            Lleva tu restaurante al siguiente nivel con LoyaltyClub
          </h2>
          <p className="text-zinc-650 text-sm leading-relaxed max-w-xl mx-auto">
            Únete a cientos de restaurantes que ya están transformando sus visitas únicas en relaciones permanentes con clientes VIP.
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-4 max-w-md mx-auto pt-4">
            <a 
              href="#book-demo"
              className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black uppercase text-xs tracking-wider py-4 px-8 rounded-xl transition-all text-center shadow-md"
            >
              Agendar Demo Gratuita
            </a>
            <a 
              href="/login"
              className="bg-white hover:bg-slate-50 border border-zinc-200 text-zinc-800 font-bold uppercase text-xs tracking-wider py-4 px-8 rounded-xl transition-all text-center shadow-sm"
            >
              Iniciar Sesión Admin
            </a>
          </div>

          <div className="border-t border-zinc-200 pt-12 mt-12 text-zinc-500 text-xs flex flex-col sm:flex-row justify-between items-center gap-4">
            <p>© {new Date().getFullYear()} LoyaltyClub. Todos los derechos reservados. Diseñado para restaurantes premium.</p>
            <div className="flex gap-6 font-semibold">
              <a href="#features" className="hover:text-zinc-900 transition-colors">Términos</a>
              <a href="#pricing" className="hover:text-zinc-900 transition-colors">Privacidad</a>
              <a href="#features" className="hover:text-zinc-900 transition-colors">Soporte</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}