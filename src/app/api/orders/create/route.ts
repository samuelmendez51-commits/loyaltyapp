import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      business_id, branch_id, cliente_id,
      nombre_cliente, telefono_cliente, calle, numero, colonia,
      tipo, items, total, lat_entrega, lng_entrega, metodo_pago, pago_verificado
    } = body

    if (!business_id || !nombre_cliente || !telefono_cliente || !items || !total) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // 1. Verificar negocio y obtener su demand_status
    const { data: biz } = await supabase
      .from('businesses')
      .select('estado, monto_minimo_sello, max_sellos, demand_status')
      .eq('id', business_id)
      .single()

    if (!biz || biz.estado === 'vencido') {
      return NextResponse.json({ error: 'Negocio suspendido' }, { status: 403 })
    }

    const superaMinimo = total >= (biz.monto_minimo_sello || 0)
    const selloOtorgado = superaMinimo && !!cliente_id

    // 2. Calcular buffer de cocina
    let bufferMinutes = 30
    const demand = biz.demand_status || 'NORMAL'
    if (demand === 'MODERADO') {
      bufferMinutes = 45
    } else if (demand === 'SATURADO') {
      bufferMinutes = 60
    }

    const now = new Date()
    const scheduledPickupTime = new Date(now.getTime() + bufferMinutes * 60 * 1000)

    let deliveryStatus = 'PENDING'
    let deliveryToken = null
    let scheduledPickupTimeStr = null

    // 3. Pre-despachar moto si es un pedido de tipo delivery
    if (tipo === 'delivery') {
      scheduledPickupTimeStr = scheduledPickupTime.toISOString()
      deliveryStatus = 'SHIPPED_SCHEDULED'

      try {
        const url = new URL(req.url)
        const baseUrl = `${url.protocol}//${url.host}`
        const fleetRes = await fetch(`${baseUrl}/api/mock-fleet/v1/deliveries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            direccion: `${calle || ''} ${numero || ''}, ${colonia || ''}`,
            datos: `Pedido de ${nombre_cliente} (#${total} MXN)`,
            scheduled_pickup_time: scheduledPickupTimeStr
          })
        })

        if (fleetRes.ok) {
          const fleetData = await fleetRes.json()
          deliveryToken = fleetData.delivery_token
        } else {
          console.error('[Create Order API] Failed to trigger mock fleet pre-dispatch:', await fleetRes.text())
          deliveryToken = `MOCK_TRV_FALLBACK_${Date.now()}`
        }
      } catch (err) {
        console.error('[Create Order API] Error calling mock fleet API:', err)
        deliveryToken = `MOCK_TRV_FALLBACK_${Date.now()}`
      }
    }

    // 4. Insertar la orden en Supabase
    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        business_id,
        branch_id: branch_id || null,
        cliente_id: cliente_id || null,
        nombre_cliente,
        telefono_cliente,
        calle: calle || '',
        numero: numero || '',
        colonia: colonia || '',
        tipo: tipo || 'delivery',
        items,
        total,
        sello_otorgado: selloOtorgado,
        sello_aprobado: false,
        sello_rechazado: false,
        estado: 'pendiente',
        lat_entrega: lat_entrega || null,
        lng_entrega: lng_entrega || null,
        metodo_pago: metodo_pago || 'efectivo',
        pago_verificado: pago_verificado ?? (metodo_pago === 'efectivo'),
        delivery_status: deliveryStatus,
        scheduled_pickup_time: scheduledPickupTimeStr,
        delivery_token: deliveryToken
      })
      .select()
      .single()

    if (error) throw error

    // 5. Registrar evento de tracking si hay sello
    if (selloOtorgado && cliente_id) {
      await supabase.from('tracking_events').insert({
        business_id,
        cliente_id,
        order_id: order.id,
        event_type: 'created_pending',
        metadata: { total, tipo, monto_minimo: biz.monto_minimo_sello },
      })

      // Incrementar puntos del cliente optimistamente
      const { data: cliente } = await supabase
        .from('clientes').select('puntos').eq('id', cliente_id).single()
      if (cliente) {
        await supabase.from('clientes')
          .update({ puntos: Math.min(cliente.puntos + 1, biz.max_sellos || 10) })
          .eq('id', cliente_id)
      }
    }

    return NextResponse.json({
      order,
      sello_otorgado: selloOtorgado,
      supera_minimo: superaMinimo,
    })

  } catch (error: any) {
    console.error('Error creando pedido con logística:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
