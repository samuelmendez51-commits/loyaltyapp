'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const [clienteId, setClienteId] = useState('')
  const [cliente, setCliente] = useState<any>(null)
  const [historial, setHistorial] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  // Estados de edición
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [totalGastado, setTotalGastado] = useState(0)
  const [bloqueado, setBloqueado] = useState(false)
  const [banderaRoja, setBanderaRoja] = useState(false)

  // Motivo de auditoría para cambio de puntos
  const [motivoAuditoria, setMotivoAuditoria] = useState('')
  const [mostrarAjustePuntos, setMostrarAjustePuntos] = useState(false)

  useEffect(() => { params.then(p => setClienteId(p.id)) }, [params])

  useEffect(() => {
    if (!clienteId) return
    cargarTodo()
  }, [clienteId])

  const cargarTodo = async () => {
    setCargando(true)
    const [cliRes, histRes, ordRes] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', clienteId).single(),
      supabase.from('historial_puntos').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(30),
      supabase.from('orders').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(30),
    ])
    if (cliRes.data) {
      const cli = cliRes.data
      setCliente(cli)
      setNombre(cli.nombre)
      setTelefono(cli.telefono)
      setEmail(cli.email || '')
      setFechaNacimiento(cli.fecha_nacimiento || '')
      setTotalGastado(Number(cli.total_gastado || 0))
      setBloqueado(cli.bloqueado || false)
      setBanderaRoja(cli.bandera_roja || false)
    }
    if (histRes.data) setHistorial(histRes.data)
    if (ordRes.data) setOrders(ordRes.data)
    setCargando(false)
  }

  const guardarCambios = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    const { error } = await supabase
      .from('clientes')
      .update({
        nombre,
        telefono,
        email: email || null,
        fecha_nacimiento: fechaNacimiento || null,
        total_gastado: Number(totalGastado),
        bloqueado,
        bandera_roja: banderaRoja
      })
      .eq('id', clienteId)

    if (error) {
      alert('Error al guardar los cambios: ' + error.message)
    } else {
      alert('✅ Cambios guardados con éxito')
      setEditando(false)
      cargarTodo()
    }
    setGuardando(false)
  }

  const ajustarPuntos = async (tipo: 'suma' | 'resta') => {
    if (!motivoAuditoria.trim()) {
      return alert('Por favor, ingresa el motivo del ajuste para el registro de auditoría.')
    }
    setGuardando(true)
    const delta = tipo === 'suma' ? 1 : -1
    const nuevosPuntos = Math.max(0, (cliente.puntos || 0) + delta)

    const staffUserId = document.cookie.match(/session_user_id=([^;]+)/)?.[1]
    const businessId = document.cookie.match(/session_business_id=([^;]+)/)?.[1] || cliente.business_id

    // 1. Actualizar puntos del cliente
    const { error: errCli } = await supabase
      .from('clientes')
      .update({ puntos: nuevosPuntos })
      .eq('id', clienteId)

    if (errCli) {
      alert('Error al actualizar puntos: ' + errCli.message)
      setGuardando(false)
      return
    }

    // 2. Registrar en historial de puntos para auditoría
    await supabase.from('historial_puntos').insert({
      cliente_id: clienteId,
      business_id: businessId,
      tipo_movimiento: tipo === 'suma' ? 'suma' : 'resta',
      cantidad: 1,
      descripcion: `Ajuste manual: ${tipo === 'suma' ? 'Suma' : 'Resta'} de 1 sello`,
      motivo_auditoria: motivoAuditoria.trim(),
      aprobado_por: staffUserId || null
    })

    // 3. Registrar evento de tracking
    await supabase.from('tracking_events').insert({
      business_id: businessId,
      cliente_id: clienteId,
      event_type: 'puntos_ajustados',
      metadata: { delta, nuevosPuntos, motivo: motivoAuditoria.trim(), ajustado_por: staffUserId }
    })

    alert(`✅ Puntos actualizados con éxito. Nuevos sellos: ${nuevosPuntos}`)
    setMotivoAuditoria('')
    setMostrarAjustePuntos(false)
    cargarTodo()
    setGuardando(false)
  }

  const eliminarCliente = async () => {
    if (!confirm(`¿ESTÁS ABSOLUTAMENTE SEGURO de eliminar al cliente VIP "${cliente.nombre}"?\nEsta acción es irreversible y borrará sus registros de puntos e historial.`)) return
    
    setGuardando(true)
    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', clienteId)

    if (error) {
      alert('Error al eliminar cliente: ' + error.message)
    } else {
      alert('🗑️ Cliente eliminado con éxito de la plataforma')
      window.location.href = '/dashboard'
    }
    setGuardando(false)
  }

  // Métricas calculadas
  const totalPedidos = orders.length
  const ticketPromedio = totalPedidos > 0
    ? orders.reduce((s, o) => s + (o.total || 0), 0) / totalPedidos
    : 0
  const pedidosFalsos = orders.filter(o => o.sello_rechazado).length
  const tasaCancelacion = totalPedidos > 0 ? ((pedidosFalsos / totalPedidos) * 100).toFixed(1) : '0.0'

  // Frecuencia: días promedio entre pedidos aprobados
  const pedidosAprobados = orders.filter(o => o.sello_aprobado).sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  let frecuenciaPromedio = 0
  if (pedidosAprobados.length > 1) {
    const diffs = pedidosAprobados.slice(1).map((o, i) => {
      const prev = new Date(pedidosAprobados[i].created_at).getTime()
      const curr = new Date(o.created_at).getTime()
      return (curr - prev) / 86400000
    })
    frecuenciaPromedio = diffs.reduce((s, d) => s + d, 0) / diffs.length
  }

  if (cargando) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-zinc-800 border-t-red-600 rounded-full animate-spin" />
    </div>
  )

  if (!cliente) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white">
      <div className="text-center">
        <p className="text-4xl mb-4">👤</p>
        <h1 className="text-xl font-black">Cliente no encontrado</h1>
        <Link href="/dashboard" className="text-red-400 text-sm mt-4 block">← Volver</Link>
      </div>
    </div>
  )

  return (
    <main className="min-h-screen bg-[#050505] text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Link href="/dashboard" className="text-xs text-zinc-500 hover:text-zinc-300 mb-2 block">← Volver al Dashboard</Link>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-red-800 to-red-950 rounded-2xl flex items-center justify-center">
                <span className="text-3xl">👤</span>
              </div>
              <div>
                <h1 className="text-2xl font-black flex items-center gap-2">
                  {cliente.nombre}
                  {cliente.bandera_roja && <span className="text-xs bg-red-950 text-red-500 border border-red-900 px-2 py-0.5 rounded-full">🚩 Bandera Roja</span>}
                  {cliente.bloqueado && <span className="text-xs bg-zinc-800 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded-full">🚫 Bloqueado</span>}
                </h1>
                <p className="text-zinc-400 font-mono">{cliente.telefono}</p>
                <p className="text-zinc-600 text-xs">Miembro desde {new Date(cliente.created_at).toLocaleDateString('es-MX')}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditando(!editando)}
              className="bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-white font-bold py-2.5 px-5 rounded-xl text-xs uppercase tracking-wider transition-all"
            >
              {editando ? 'Ver Detalles' : '✏️ Editar VIP'}
            </button>
            <button
              onClick={eliminarCliente}
              disabled={guardando}
              className="bg-red-950/40 hover:bg-red-900/40 border border-red-900/60 text-red-400 font-bold py-2.5 px-5 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50"
            >
              🗑️ Eliminar VIP
            </button>
          </div>
        </div>

        {/* MODO EDICIÓN */}
        {editando ? (
          <form onSubmit={guardarCambios} className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-black text-zinc-300 uppercase tracking-widest mb-4">Editar Perfil del Cliente</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  className="w-full bg-black/50 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-600"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Teléfono</label>
                <input
                  type="text"
                  value={telefono}
                  onChange={e => setTelefono(e.target.value)}
                  className="w-full bg-black/50 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-600"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="opcional@correo.com"
                  className="w-full bg-black/50 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-600"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Fecha de Nacimiento</label>
                <input
                  type="date"
                  value={fechaNacimiento}
                  onChange={e => setFechaNacimiento(e.target.value)}
                  className="w-full bg-black/50 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-600"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Total Gastado (MXN)</label>
              <input
                type="number"
                value={totalGastado}
                onChange={e => setTotalGastado(Number(e.target.value))}
                className="w-full bg-black/50 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-600"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <label className="flex items-center gap-3 cursor-pointer bg-black/30 border border-zinc-800 rounded-xl p-3">
                <input
                  type="checkbox"
                  checked={banderaRoja}
                  onChange={e => setBanderaRoja(e.target.checked)}
                  className="w-4 h-4 accent-red-600"
                />
                <div>
                  <p className="text-xs font-bold text-red-400 uppercase">Marcar Bandera Roja</p>
                  <p className="text-[10px] text-zinc-500">Sospecha de fraudes en sellos</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer bg-black/30 border border-zinc-800 rounded-xl p-3">
                <input
                  type="checkbox"
                  checked={bloqueado}
                  onChange={e => setBloqueado(e.target.checked)}
                  className="w-4 h-4 accent-red-600"
                />
                <div>
                  <p className="text-xs font-bold text-zinc-300 uppercase">Bloquear Cliente</p>
                  <p className="text-[10px] text-zinc-500">Evita acumulación y canje de premios</p>
                </div>
              </label>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <button
                type="button"
                onClick={() => setEditando(false)}
                className="border border-zinc-700 text-zinc-400 font-bold py-2 px-5 rounded-xl text-xs hover:border-zinc-500 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="bg-red-600 hover:bg-red-700 text-white font-black py-2 px-6 rounded-xl text-xs uppercase tracking-widest transition-all disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : '💾 Guardar Cambios'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Sellos actuales y control de auditoría */}
            <div className="bg-zinc-900/80 border border-zinc-700 rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Progreso de Lealtad</p>
                <button
                  onClick={() => setMostrarAjustePuntos(!mostrarAjustePuntos)}
                  className="text-xs text-amber-500 hover:text-amber-400 font-bold uppercase tracking-wider"
                >
                  ⚡ Ajustar Sellos Manualmente
                </button>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-5xl font-black text-amber-400">{cliente.puntos}</span>
                <div className="flex-1">
                  <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all"
                      style={{ width: `${Math.min((cliente.puntos / 10) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{cliente.puntos}/10 sellos</p>
                </div>
              </div>

              {/* Panel de Ajuste de Puntos con Auditoría */}
              {mostrarAjustePuntos && (
                <div className="bg-black/50 border border-zinc-800 rounded-xl p-4 space-y-3 mt-4">
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">Ajuste de Crédito/Sellos (Auditoría VIP)</p>
                  <div>
                    <label className="text-[10px] text-zinc-400 uppercase font-black block mb-1">Motivo de Auditoría (Obligatorio)</label>
                    <input
                      type="text"
                      value={motivoAuditoria}
                      onChange={e => setMotivoAuditoria(e.target.value)}
                      placeholder="Ej: Compensación por error de sistema / Consumo verificado físico"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => ajustarPuntos('suma')}
                      disabled={guardando}
                      className="flex-1 bg-green-950/80 hover:bg-green-900/80 border border-green-800 text-green-400 font-black py-2 rounded-xl text-xs uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                      ➕ Sumar 1 Sello
                    </button>
                    <button
                      onClick={() => ajustarPuntos('resta')}
                      disabled={guardando || cliente.puntos === 0}
                      className="flex-1 bg-red-950/80 hover:bg-red-900/80 border border-red-800 text-red-400 font-black py-2 rounded-xl text-xs uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                      ➖ Restar 1 Sello
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* KPIs calculados */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Pedidos', valor: totalPedidos, color: 'text-white' },
                { label: 'Total Gastado', valor: `$${Number(cliente.total_gastado || 0).toLocaleString()} MXN`, color: 'text-green-400' },
                { label: 'Frec. (días)', valor: frecuenciaPromedio > 0 ? frecuenciaPromedio.toFixed(1) : '—', color: 'text-blue-400' },
                { label: 'Tasa Cancelación', valor: `${tasaCancelacion}%`, color: pedidosFalsos > 0 ? 'text-red-400' : 'text-green-400' },
              ].map((kpi, i) => (
                <div key={i} className="bg-zinc-900/80 border border-zinc-700 rounded-2xl p-4">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">{kpi.label}</p>
                  <p className={`text-2xl font-black ${kpi.color}`}>{kpi.valor}</p>
                </div>
              ))}
            </div>

            {/* Historial de Puntos / Auditoría */}
            <div className="bg-zinc-900/80 border border-zinc-700 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800">
                <h2 className="text-sm font-black text-zinc-300 uppercase tracking-widest">Auditoría de Puntos / Sellos</h2>
              </div>
              <div className="divide-y divide-zinc-800 text-xs">
                {historial.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-8">Sin movimientos registrados</p>
                ) : historial.map(hist => (
                  <div key={hist.id} className="p-4 flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          hist.tipo_movimiento === 'suma' ? 'bg-green-950 text-green-400 border border-green-900/30' :
                          hist.tipo_movimiento === 'resta' ? 'bg-red-950 text-red-400 border border-red-900/30' :
                          'bg-zinc-850 text-zinc-400 border border-zinc-800'
                        }`}>
                          {hist.tipo_movimiento}
                        </span>
                        <span className="text-zinc-500 font-mono">
                          {new Date(hist.created_at).toLocaleString('es-MX')}
                        </span>
                      </div>
                      <p className="text-zinc-300 font-bold">{hist.descripcion}</p>
                      {hist.motivo_auditoria && <p className="text-zinc-500 mt-1 italic">Motivo: {hist.motivo_auditoria}</p>}
                    </div>
                    <span className={`font-black text-sm ${hist.tipo_movimiento === 'suma' ? 'text-green-400' : 'text-red-400'}`}>
                      {hist.tipo_movimiento === 'suma' ? '+' : '-'}{hist.cantidad}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Historial de pedidos */}
            <div className="bg-zinc-900/80 border border-zinc-700 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800">
                <h2 className="text-sm font-black text-zinc-300 uppercase tracking-widest">Historial de Pedidos</h2>
              </div>
              <div className="divide-y divide-zinc-800">
                {orders.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-8">Sin pedidos registrados</p>
                ) : orders.map(order => (
                  <div key={order.id} className="p-4 flex justify-between items-center text-xs">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${
                          order.sello_aprobado ? 'bg-green-500' :
                          order.sello_rechazado ? 'bg-red-500' : 'bg-amber-500'
                        }`} />
                        <span className="text-zinc-500 font-mono">
                          {new Date(order.created_at).toLocaleDateString('es-MX')}
                        </span>
                        <span className="text-zinc-600 uppercase">{order.tipo}</span>
                      </div>
                      <p className="text-sm font-bold text-white">
                        {(order.items as any[]).map((i: any) => i.nombre).join(', ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-amber-400 font-black">${(order.total || 0).toLocaleString()}</p>
                      <p className={`text-[10px] font-bold uppercase ${
                        order.sello_aprobado ? 'text-green-400' :
                        order.sello_rechazado ? 'text-red-400' : 'text-zinc-500'
                      }`}>
                        {order.sello_aprobado ? '✅ Sello' : order.sello_rechazado ? '❌ Rechazado' : '⏳ Pendiente'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
