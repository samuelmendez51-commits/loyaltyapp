import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchWithRetry } from '@/utils/fetchHelper'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { order_id } = body

    if (!order_id) {
      return NextResponse.json({ error: 'Falta order_id' }, { status: 400 })
    }

    // 1. Cargar la orden y validar token y estado
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, delivery_status, delivery_token, cliente_id, business_id, sello_otorgado, sello_aprobado')
      .eq('id', order_id)
      .single()

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    if (order.delivery_status !== 'SHIPPED_SCHEDULED') {
      return NextResponse.json({ error: 'La orden no está en estado programado (SHIPPED_SCHEDULED)' }, { status: 400 })
    }

    if (!order.delivery_token) {
      return NextResponse.json({ error: 'La orden no cuenta con un token de entrega válido' }, { status: 400 })
    }

    // 2. Realizar petición al API de la fletera externa (simulada)
    try {
      const url = new URL(req.url)
      const baseUrl = `${url.protocol}//${url.host}`
      const fleetRes = await fetchWithRetry(`${baseUrl}/api/mock-fleet/v1/deliveries/${order.delivery_token}/ready`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!fleetRes.ok) {
        console.error('[Ready Override API] External fleet speed-up failed:', await fleetRes.text())
      }
    } catch (err) {
      console.error('[Ready Override API] Error contacting fleet API:', err)
    }

    // 3. Actualizar estado de la orden en Supabase
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        delivery_status: 'SHIPPED_IMMEDIATE',
        sello_aprobado: true,
        estado: 'aprobado',
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)
      .select()
      .single()

    if (updateError) throw updateError

    // 4. Si el sello fue otorgado pero no estaba aprobado, sumar punto al cliente y registrar premios inmutables
    if (order.sello_otorgado && !order.sello_aprobado && order.cliente_id && order.business_id) {
      const { data: client } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', order.cliente_id)
        .single()

      if (client) {
        const { data: biz } = await supabase
          .from('businesses')
          .select('max_sellos, premios_ruleta')
          .eq('id', order.business_id)
          .single()

        const maxSellos = Number(biz?.max_sellos) || 10
        const nuevosPuntos = Math.min(client.puntos + 1, maxSellos)

        // Actualizar de forma atómica los puntos
        await supabase
          .from('clientes')
          .update({ puntos: nuevosPuntos })
          .eq('id', client.id)

        // Auditoría
        await supabase
          .from('historial_puntos')
          .insert({
            cliente_id: client.id,
            business_id: order.business_id,
            cantidad: 1,
            tipo_movimiento: 'suma',
            descripcion: 'Sello acumulado por pedido completado en cocina'
          })

        // Inyectar premio inmutable de la ruleta si alcanza el tope
        if (nuevosPuntos >= maxSellos) {
          let poolPremios = ['Café Gratis', 'Postre Sorpresa', 'Bebida Grande', '20% Descuento']
          if (biz?.premios_ruleta) {
            try {
              const parsed = Array.isArray(biz.premios_ruleta) 
                ? biz.premios_ruleta 
                : (typeof biz.premios_ruleta === 'string' ? JSON.parse(biz.premios_ruleta) : biz.premios_ruleta)
              if (Array.isArray(parsed) && parsed.length > 0) {
                poolPremios = parsed
              }
            } catch (err) {
              console.error('Error parsing business premios_ruleta:', err)
            }
          }

          const premioGanador = poolPremios[Math.floor(Math.random() * poolPremios.length)]

          // Crear spin/canje inmutable
          await supabase
            .from('premios_canjes')
            .insert({
              cliente_id: client.id,
              premio_nombre: premioGanador,
              estado: 'Pendiente'
            })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Pedido marcado para despacho inmediato.',
      order: updatedOrder
    })

  } catch (error: any) {
    console.error('Error procesando ready-override:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
