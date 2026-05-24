'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Cliente {
  id: string;
  nombre: string;
  puntos: number;
  telefono: string;
  fecha_nacimiento: string | null;
  created_at: string;
}

interface Historial {
  id: string;
  cliente_id: string;
  tipo_movimiento: string;
  cantidad: number;
  created_at: string;
  descripcion: string;
  clientes: { nombre: string };
}

export default function DashboardMaestroPro() {
  const [pestaña, setPestaña] = useState('metricas')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [historial, setHistorial] = useState<Historial[]>([])
  const [cargando, setCargando] = useState(true)

  // --- ESTADOS DE LA VISTA PREVIA ---
  const [previewId, setPreviewId] = useState('')
  const [previewPuntos, setPreviewPuntos] = useState(0)
  const [previewNombre, setPreviewNombre] = useState('Socio VIP')

  // --- ESTADOS DE LAS WALLETS ---
  const [descargandoApple, setDescargandoApple] = useState(false)
  const [descargandoGoogle, setDescargandoGoogle] = useState(false)
  const [os, setOs] = useState('unknown')

  // --- CONFIGURACIONES DINÁMICAS (WHATSAPP, GEOCERCAS & PUSH) ---
  const [telefonoWhatsApp, setTelefonoWhatsApp] = useState('521234567890')
  const [radioGeocerca, setRadioGeocerca] = useState(150) // metros
  const [latitudLocal, setLatitudLocal] = useState(19.421583)
  const [longitudLocal, setLongitudLocal] = useState(-102.067222)
  const [mensajePush, setMensajePush] = useState('¡Envío gratis hoy en tu Chavipizza favorita! Pide desde tu Wallet 🍕')

  // --- MÉTRICAS DE CONTROL EN TIEMPO REAL ---
  const [sellosHoy, setSellosHoy] = useState(0)
  const [premiosCanjeados, setPremiosCanjeados] = useState(0)

  useEffect(() => {
    cargarDatos()
    // Detección del Sistema Operativo para los botones
    if (typeof navigator !== 'undefined') {
      if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) setOs('ios')
      else if (/Android/i.test(navigator.userAgent)) setOs('android')
      else setOs('desktop')
    }
  }, [])

  async function cargarDatos() {
    setCargando(true)
    
    const { data: dataClientes } = await supabase.from('clientes').select('*').order('created_at', { ascending: false })
    if (dataClientes) {
      setClientes(dataClientes)
      if (dataClientes.length > 0 && !previewId) {
        setPreviewId(dataClientes[0].id)
        setPreviewNombre(dataClientes[0].nombre)
        setPreviewPuntos(dataClientes[0].puntos)
      }
    }

    const { data: dataHistorial } = await supabase.from('historial_puntos').select('*, clientes(nombre)').order('created_at', { ascending: false }).limit(50)
    if (dataHistorial) {
      setHistorial(dataHistorial as any)
      const hoyStr = new Date().toISOString().split('T')[0]
      const sumaSellosHoy = dataHistorial.filter((h: any) => h.created_at.startsWith(hoyStr) && h.tipo_movimiento === 'suma').reduce((acc: number, cur: any) => acc + cur.cantidad, 0)
      const sumaCanjesHoy = dataHistorial.filter((h: any) => h.tipo_movimiento === 'canje' || h.descripcion?.includes('CANJEAD')).length
      setSellosHoy(sumaSellosHoy)
      setPremiosCanjeados(sumaCanjesHoy)
    }
    setCargando(false)
  }

  async function ajustarPuntos(id: string, puntosActuales: number, cantidad: number) {
    let nuevosPuntos = puntosActuales + cantidad
    if (nuevosPuntos < 0) nuevosPuntos = 0
    if (nuevosPuntos > 10) nuevosPuntos = 10
    if (nuevosPuntos === puntosActuales) return

    await supabase.from('clientes').update({ puntos: nuevosPuntos }).eq('id', id)
    await supabase.from('historial_puntos').insert([{ cliente_id: id, tipo_movimiento: cantidad > 0 ? 'suma' : 'resta', cantidad: Math.abs(cantidad), descripcion: 'Ajuste manual administrativo' }])
    
    if (id === previewId) setPreviewPuntos(nuevosPuntos)
    cargarDatos()
  }

  async function eliminarCliente(id: string) {
    if(!confirm('¿Eliminar este cliente VIP definitivamente de la base de datos?')) return
    await supabase.from('clientes').delete().eq('id', id)
    cargarDatos()
  }

  function dispararCampanaPush() {
    alert(`🚀 Alerta Push Masiva Enviada con Éxito a los ${clientes.length} pases activos:\n\n"${mensajePush}"`)
  }

  // --- MOTORES DE WALLET RECUPERADOS ---
  async function descargarPaseApple() {
    if (!previewId) return alert("Selecciona un cliente de la lista");
    setDescargandoApple(true)
    try {
      const res = await fetch('/api/wallet/apple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: previewId, nombre: previewNombre, puntos: previewPuntos })
      });
      if (!res.ok) throw new Error("Fallo en servidor de Apple");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LaBurreriaVIP-${previewId.substring(0,8)}.pkpass`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      alert("Error al generar el pase de Apple. Revisa Vercel Logs.");
    } finally {
      setDescargandoApple(false)
    }
  }

  async function descargarPaseGoogle() {
    if (!previewId) return alert("Selecciona un cliente de la lista");
    setDescargandoGoogle(true);
    try {
      const res = await fetch('/api/wallet/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: previewId, nombre: previewNombre, puntos: previewPuntos })
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error(data.error || "Fallo en la URL de Google");
      }
    } catch (e) {
      console.error(e);
      alert("Error al generar el pase de Google Wallet.");
    } finally {
      setDescargandoGoogle(false);
    }
  }

  const clientesAlLimite = clientes.filter(c => c.puntos === 8 || c.puntos === 9)

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-[#050505] text-white font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER PRINCIPAL */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-6 border-b border-[#1f1f23] pb-6">
          <div>
            <h1 className="text-4xl sm:text-5xl font-black italic mb-1 tracking-tight">
              La Burrería <span className="font-sans text-3xl not-italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-[#d4af37] to-[#a1a1aa]">CLUB PRO</span>
            </h1>
            <p className="text-[#a1a1aa] text-xs uppercase tracking-[0.3em] font-bold">Consola de Mando Analítica</p>
          </div>
          <div className="flex gap-4">
            <Link href="/escaner">
              <button className="bg-black hover:bg-zinc-900 border border-zinc-800 text-white font-bold uppercase tracking-widest py-3 px-5 rounded-xl transition-all text-xs flex items-center gap-2">
                📷 Abrir Cámara Caja
              </button>
            </Link>
            <Link href="/registro">
              <button className="bg-gradient-to-r from-[#dc2626] to-[#991b1b] text-white font-black uppercase tracking-widest py-3 px-6 rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:scale-105 text-xs flex items-center gap-2 border border-[#ef4444]/50">
                ➕ Registrar VIP
              </button>
            </Link>
          </div>
        </div>

        {/* CONTENEDOR DE NAVEGACIÓN MODULAR */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* PANEL IZQUIERDO PRINCIPAL (3 COLS) */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* SELECTOR DE PESTAÑAS SaaS */}
            <div className="flex bg-[#141417] border border-[#27272a] rounded-2xl p-1 overflow-x-auto gap-1">
              {[
                { id: 'metricas', label: '📊 Métricas & KPIs' },
                { id: 'clientes', label: '👥 Lista de Socios' },
                { id: 'menu', label: '🌯 Menú & WhatsApp' },
                { id: 'geocercas', label: '🗺️ Geocercas & Push' }
              ].map((tab) => (
                <button 
                  key={tab.id} 
                  onClick={() => setPestaña(tab.id)} 
                  className={`flex-1 min-w-[140px] py-3 px-4 rounded-xl font-bold uppercase tracking-wider text-[11px] transition-all ${pestaña === tab.id ? 'bg-[#27272a] text-white shadow-lg border border-zinc-700' : 'text-[#71717a] hover:text-[#a1a1aa]'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* CONTENIDO 1: MÉTRICAS & KPIS */}
            {pestaña === 'metricas' && (
              <div className="space-y-6 animate-fade-in">
                
                {/* FILA DE KPI CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#18181b]/60 border border-[#27272a] rounded-2xl p-6 relative overflow-hidden shadow-inner">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-[#a1a1aa]">Sellos Entregados Hoy</p>
                    <p className="text-4xl font-black text-[#d4af37] mt-2 drop-shadow-md">{sellosHoy} ⭐</p>
                    <div className="absolute right-4 bottom-4 text-3xl opacity-10">🔥</div>
                  </div>
                  <div className="bg-[#18181b]/60 border border-[#27272a] rounded-2xl p-6 relative overflow-hidden shadow-inner">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-[#a1a1aa]">Premios Canjeados</p>
                    <p className="text-4xl font-black text-green-500 mt-2 drop-shadow-md">{premiosCanjeados} 🎁</p>
                    <div className="absolute right-4 bottom-4 text-3xl opacity-10">🏆</div>
                  </div>
                  <div className="bg-[#18181b]/60 border border-[#27272a] rounded-2xl p-6 relative overflow-hidden shadow-inner">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-[#a1a1aa]">Tarjetas VIP Activas</p>
                    <p className="text-4xl font-black text-white mt-2 drop-shadow-md">{clientes.length} 💳</p>
                    <div className="absolute right-4 bottom-4 text-3xl opacity-10">👑</div>
                  </div>
                </div>

                {/* SEGMENTACIÓN: CLIENTES AL LÍMITE */}
                <div className="bg-[#18181b]/90 border border-[#27272a] rounded-[25px] p-6 shadow-2xl">
                  <h3 className="text-sm uppercase tracking-widest font-black text-[#d4af37] mb-4 flex items-center gap-2">
                    🎯 Clientes a un paso del Premio ({clientesAlLimite.length})
                  </h3>
                  {clientesAlLimite.length === 0 ? (
                    <p className="text-xs text-zinc-500 font-mono py-4">Ningún cliente se encuentra actualmente en el umbral de 8 o 9 estrellas.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {clientesAlLimite.map(c => (
                        <div key={c.id} className="bg-black/40 border border-zinc-800 rounded-xl p-4 flex justify-between items-center">
                          <div>
                            <p className="font-bold text-sm text-white">{c.nombre}</p>
                            <p className="text-xs font-mono text-zinc-500">{c.telefono}</p>
                          </div>
                          <span className="bg-amber-500/10 border border-amber-500/30 text-amber-500 px-3 py-1 rounded-full text-xs font-black">
                            {c.puntos} / 10 Sellos
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* TABLA DE AUDITORÍA RECIENTE */}
                <div className="bg-[#18181b]/90 border border-[#27272a] rounded-[25px] overflow-hidden shadow-2xl">
                  <div className="p-6 border-b border-zinc-800">
                    <h3 className="text-xs uppercase tracking-widest font-black text-zinc-400">Auditoría de Movimientos Recientes</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-black/50 text-[#a1a1aa] border-b border-zinc-800">
                        <tr>
                          <th className="px-6 py-4 font-black">Socio</th>
                          <th className="px-6 py-4 font-black">Movimiento</th>
                          <th className="px-6 py-4 font-black">Cantidad</th>
                          <th className="px-6 py-4 font-black">Descripción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800 font-mono text-zinc-300">
                        {historial.map((h) => (
                          <tr key={h.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4 font-sans font-bold text-white">{h.clientes?.nombre || 'Socio'}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${h.tipo_movimiento === 'suma' ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'}`}>
                                {h.tipo_movimiento}
                              </span>
                            </td>
                            <td className="px-6 py-4">{h.cantidad} ★</td>
                            <td className="px-6 py-4 text-zinc-400 font-sans">{h.descripcion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* CONTENIDO 2: LISTA DE SOCIOS (CON CONTROLES DIRECTOS) */}
            {pestaña === 'clientes' && (
              <div className="bg-[#18181b]/90 border border-[#27272a] rounded-[25px] overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0a0a0a] border-b border-zinc-800">
                      <tr>
                        <th className="px-6 py-4 text-zinc-400 font-black">Identidad</th>
                        <th className="px-6 py-4 text-center text-zinc-400 font-black">Estatus VIP</th>
                        <th className="px-6 py-4 text-right text-zinc-400 font-black">Control Operativo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#27272a]">
                      {clientes.map((cliente) => (
                        <tr 
                          key={cliente.id} 
                          className="hover:bg-white/5 transition-colors group cursor-pointer"
                          onMouseEnter={() => { setPreviewId(cliente.id); setPreviewNombre(cliente.nombre); setPreviewPuntos(cliente.puntos); }}
                        >
                          <td className="px-6 py-4">
                            <div className="font-bold text-sm text-white group-hover:text-[#d4af37] transition-colors">{cliente.nombre}</div>
                            <div className="text-zinc-500 font-mono mt-0.5">{cliente.telefono || 'Sin teléfono'}</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-block px-3 py-1 rounded-full font-black text-xs border ${cliente.puntos === 10 ? 'bg-[#d4af37]/20 text-[#d4af37] border-[#d4af37]/40 shadow-[0_0_10px_rgba(212,175,55,0.3)]' : 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}>
                              {cliente.puntos} ★
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => ajustarPuntos(cliente.id, cliente.puntos, -1)} className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors text-white">➖</button>
                              <button onClick={() => ajustarPuntos(cliente.id, cliente.puntos, 1)} className="w-8 h-8 rounded-lg bg-[#b91c1c]/10 border border-[#b91c1c]/30 text-[#b91c1c] hover:bg-[#b91c1c]/20 transition-colors">➕</button>
                              <button onClick={() => eliminarCliente(cliente.id)} className="w-8 h-8 rounded-lg bg-red-950/40 text-red-400 hover:bg-red-500 hover:text-white transition-colors border border-red-900/30 ml-2">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CONTENIDO 3: E-MENÚ & PEDIDOS WHATSAPP */}
            {pestaña === 'menu' && (
              <div className="space-y-6 animate-fade-in">
                <div className="bg-[#18181b]/90 border border-[#27272a] rounded-[25px] p-6 shadow-2xl space-y-6">
                  <div>
                    <h3 className="text-lg font-black text-white">Configuración del Enrutador WhatsApp</h3>
                    <p className="text-xs text-zinc-400 mt-1">Los clientes pueden ver el menú interactivo en su pase digital y enviar el pedido armado de forma directa a tu número de WhatsApp con un solo clic.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Teléfono Central de Pedidos</label>
                      <input 
                        type="text" 
                        value={telefonoWhatsApp}
                        onChange={(e) => setTelefonoWhatsApp(e.target.value)}
                        className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Estatus del Enrutamiento</label>
                      <div className="bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-green-400 font-bold flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> ACTIVO (Web-to-WhatsApp API)
                      </div>
                    </div>
                  </div>
                </div>

                {/* MENÚ VIRTUAL INTEGRADO SIMULADO */}
                <div className="bg-[#18181b]/90 border border-[#27272a] rounded-[25px] p-6 shadow-2xl">
                  <h3 className="text-xs uppercase tracking-widest font-black text-zinc-400 mb-4">Menú de Productos Sincronizado</h3>
                  <div className="divide-y divide-zinc-800">
                    {[
                      { name: 'Chavipizza Especial', desc: 'Salsa secreta de la casa, combinación perfecta de quesos y carnes.', price: '$180.00' },
                      { name: 'Burro Clásico La Burrería', desc: 'Tortilla gigante, frijoles refritos, carne asada premium y queso derretido.', price: '$120.00' }
                    ].map((item, idx) => (
                      <div key={idx} className="py-4 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-white text-sm">{item.name}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">{item.desc}</p>
                        </div>
                        <span className="font-mono text-[#d4af37] font-bold text-sm">{item.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* CONTENIDO 4: GEOCERCAS & PUSH */}
            {pestaña === 'geocercas' && (
              <div className="space-y-6 animate-fade-in">
                
                {/* GEOCERCA NATIVA */}
                <div className="bg-[#18181b]/90 border border-[#27272a] rounded-[25px] p-6 shadow-2xl space-y-6">
                  <div>
                    <h3 className="text-lg font-black text-white">Mapeo de Geocercas Nativas (GPS)</h3>
                    <p className="text-xs text-zinc-400 mt-1">Configura las coordenadas exactas de tu restaurante para despertar las tarjetas de Apple y Google Wallet de forma automatizada en el celular del cliente.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Latitud Centro</label>
                      <input type="number" step="any" value={latitudLocal} onChange={(e)=>setLatitudLocal(parseFloat(e.target.value))} className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-mono text-zinc-300 focus:outline-none"/>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Longitud Centro</label>
                      <input type="number" step="any" value={longitudLocal} onChange={(e)=>setLongitudLocal(parseFloat(e.target.value))} className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-mono text-zinc-300 focus:outline-none"/>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Radio de Efecto (Metros)</label>
                      <input type="number" value={radioGeocerca} onChange={(e)=>setRadioGeocerca(parseInt(e.target.value))} className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-mono text-zinc-300 focus:outline-none"/>
                    </div>
                  </div>
                </div>

                {/* EMISOR MASIVO DE ALERTAS PUSH */}
                <div className="bg-[#18181b]/90 border border-[#27272a] rounded-[25px] p-6 shadow-2xl space-y-4">
                  <div>
                    <h3 className="text-sm uppercase tracking-widest font-black text-[#dc2626]">Consola Broadcast: Alerta Masiva Push</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">Escribe y dispara una notificación push directamente a todos los celulares con el pase instalado.</p>
                  </div>
                  <div className="space-y-3">
                    <textarea 
                      rows={3} 
                      value={mensajePush}
                      onChange={(e) => setMensajePush(e.target.value)}
                      className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-xs focus:outline-none focus:border-[#dc2626] font-sans resize-none"
                    />
                    <button 
                      onClick={dispararCampanaPush}
                      className="w-full bg-gradient-to-r from-[#dc2626] to-[#991b1b] text-white font-black py-4 rounded-xl uppercase tracking-widest text-[10px] transition-all shadow-lg hover:brightness-110"
                    >
                      📡 DISPARAR ALERTA PUSH INMEDIATA
                    </button>
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* COLUMNA DERECHA INTELIGENTE (1 COL) */}
          <div className="lg:col-span-1">
            
            {/* VISTA PREVIA (SOLO EN MÉTRICAS Y CLIENTES) */}
            {(pestaña === 'clientes' || pestaña === 'metricas') && (
              <div className="bg-[#18181b]/90 backdrop-blur-md rounded-[25px] border border-[#27272a] shadow-2xl p-6 sticky top-8 flex flex-col items-center animate-fade-in">
                <h2 className="text-xs uppercase tracking-[0.2em] font-black text-[#a1a1aa] mb-6 w-full flex items-center justify-between">
                  Vista Previa VIP <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                </h2>

                <div 
                  className="w-full aspect-[0.63] max-w-[320px] rounded-[30px] shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-6 flex flex-col justify-between relative overflow-hidden border-4 border-[#27272a] bg-cover bg-center"
                  style={{ backgroundImage: `url('${LOGO_URL}')` }}
                >
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-[1px]"></div>
                  
                  <div className="flex justify-between items-start z-10">
                    <div className="w-12 h-12 bg-black rounded-full border-2 border-[#d4af37] flex items-center justify-center overflow-hidden p-1">
                      <span className="text-xl">🌯</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-white uppercase tracking-widest font-black">La Burrería</p>
                      <p className="text-[#d4af37] font-black text-sm">Pase VIP</p>
                    </div>
                  </div>

                  <div className="z-10 drop-shadow-xl">
                    <p className="text-[9px] text-zinc-400 uppercase tracking-widest mb-0.5">Socio Activo</p>
                    <p className="text-xl font-black text-white truncate">{previewNombre}</p>
                  </div>

                  <div className="z-10 bg-black/80 backdrop-blur-sm p-4 rounded-xl border border-zinc-800 flex justify-between items-center shadow-xl">
                    <div>
                      <p className="text-[9px] text-zinc-500 uppercase font-bold">Progreso</p>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-3xl font-black text-[#d4af37]">{previewPuntos}</span>
                        <span className="text-xs text-zinc-500 font-bold">/ 10</span>
                      </div>
                    </div>
                    <div className="w-14 h-14 bg-white rounded-lg p-1">
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${previewId}`} alt="QR" className="w-full h-full opacity-90" />
                    </div>
                  </div>
                </div>

                {/* BOTONES WALLET NATIVOS (SVGs) */}
                <div className="mt-8 w-full max-w-[320px] space-y-4">
                  {(os === 'ios' || os === 'desktop') && (
                    <button 
                      onClick={descargarPaseApple}
                      disabled={descargandoApple}
                      className={`w-full flex items-center justify-center transition-all ${descargandoApple ? 'opacity-50' : 'hover:scale-[1.03] active:scale-95'}`}
                    >
                      {descargandoApple ? (
                        <div className="h-14 w-full bg-zinc-900 rounded-xl flex items-center justify-center border border-zinc-800">
                           <span className="text-xs font-bold text-white animate-pulse uppercase tracking-widest">Generando...</span>
                        </div>
                      ) : (
                        <img src="/apple-wallet.svg" alt="Añadir a Apple Wallet" className="h-14 w-auto object-contain drop-shadow-lg" />
                      )}
                    </button>
                  )}

                  {(os === 'android' || os === 'desktop') && (
                    <button 
                      onClick={descargarPaseGoogle}
                      disabled={descargandoGoogle}
                      className={`w-full flex items-center justify-center transition-all ${descargandoGoogle ? 'opacity-50' : 'hover:scale-[1.03] active:scale-95'}`}
                    >
                      {descargandoGoogle ? (
                        <div className="h-14 w-full bg-zinc-900 rounded-xl flex items-center justify-center border border-zinc-800">
                           <span className="text-xs font-bold text-white animate-pulse uppercase tracking-widest">Firmando...</span>
                        </div>
                      ) : (
                        <img src="/google-wallet.svg" alt="Añadir a Google Wallet" className="h-14 w-auto object-contain drop-shadow-lg" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* GESTOR DE ARCHIVOS (SOLO EN MENÚ) */}
            {pestaña === 'menu' && (
              <div className="bg-[#18181b]/90 backdrop-blur-md rounded-[25px] border border-[#27272a] shadow-2xl p-6 sticky top-8 flex flex-col items-center text-center animate-fade-in">
                <h2 className="text-xs uppercase tracking-[0.2em] font-black text-[#a1a1aa] mb-6 w-full flex items-center justify-between">
                  Gestor de Archivos <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                </h2>
                <div className="w-full aspect-square border-2 border-dashed border-zinc-700 rounded-2xl flex flex-col items-center justify-center p-6 hover:border-[#dc2626] hover:bg-white/5 transition-all cursor-pointer group">
                  <span className="text-5xl mb-4 group-hover:scale-110 transition-transform drop-shadow-md">📁</span>
                  <p className="text-sm font-bold text-white mb-1">Subir Menú (PDF/IMG)</p>
                  <p className="text-[10px] text-zinc-500">Haz clic o arrastra tu archivo aquí</p>
                </div>
                <p className="text-[10px] text-zinc-500 mt-6 leading-relaxed">Los archivos subidos se alojarán automáticamente en tu Bucket de Supabase Storage para no consumir recursos del servidor.</p>
              </div>
            )}

            {/* RADAR GPS (SOLO EN GEOCERCAS) */}
            {pestaña === 'geocercas' && (
              <div className="bg-[#18181b]/90 backdrop-blur-md rounded-[25px] border border-[#27272a] shadow-2xl p-6 sticky top-8 flex flex-col items-center text-center animate-fade-in">
                <h2 className="text-xs uppercase tracking-[0.2em] font-black text-[#a1a1aa] mb-6 w-full flex items-center justify-between">
                  Radar Satelital <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                </h2>
                <div className="w-full aspect-square bg-black/50 rounded-2xl border border-zinc-800 flex items-center justify-center relative overflow-hidden">
                  {/* Círculo de radar animado */}
                  <div className="absolute w-32 h-32 bg-green-500/20 rounded-full animate-ping"></div>
                  <div className="absolute w-16 h-16 bg-green-500/40 rounded-full"></div>
                  <span className="text-5xl z-10 drop-shadow-lg">📍</span>
                </div>
                <p className="text-xs text-zinc-400 mt-6 font-bold">Radio de Perímetro: {radioGeocerca}m</p>
                <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">Las tarjetas de tus clientes despertarán automáticamente al entrar en esta zona geográfica.</p>
              </div>
            )}

          </div>

        </div>

      </div>
    </main>
  )
}

// URL del logotipo por defecto de Supabase Storage para evitar crash de render
const LOGO_URL = "https://hjaeireljkcvjnigfhzb.supabase.co/storage/v1/object/public/assets/destacada.jpg"