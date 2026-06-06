import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
      .select('id, delivery_status, delivery_token')
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
      const fleetRes = await fetch(`${baseUrl}/api/mock-fleet/v1/deliveries/${order.delivery_token}/ready`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!fleetRes.ok) {
        console.error('[Ready Override API] External fleet speed-up failed:', await fleetRes.text())
        // Continue anyway to maintain robust operational flow
      }
    } catch (err) {
      console.error('[Ready Override API] Error contacting fleet API:', err)
      // Continue anyway to maintain robust operational flow
    }

    // 3. Actualizar estado de la orden en Supabase
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        delivery_status: 'SHIPPED_IMMEDIATE',
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)
      .select()
      .single()

    if (updateError) throw updateError

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
