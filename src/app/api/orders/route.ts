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
      tipo, items, total
    } = body

    if (!business_id || !nombre_cliente || !telefono_cliente || !items || !total) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Verificar que el negocio esté activo
    const { data: biz } = await supabase
      .from('businesses')
      .select('estado, monto_minimo_sello, max_sellos')
      .eq('id', business_id)
      .single()

    if (!biz || biz.estado === 'vencido') {
      return NextResponse.json({ error: 'Negocio suspendido' }, { status: 403 })
    }

    const superaMinimo = total >= (biz.monto_minimo_sello || 0)
    const selloOtorgado = superaMinimo && !!cliente_id

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        business_id, branch_id: branch_id || null,
        cliente_id: cliente_id || null,
        nombre_cliente, telefono_cliente,
        calle: calle || '', numero: numero || '', colonia: colonia || '',
        tipo: tipo || 'delivery',
        items, total,
        sello_otorgado: selloOtorgado,
        sello_aprobado: false,
        sello_rechazado: false,
        estado: 'pendiente',
      })
      .select()
      .single()

    if (error) throw error

    // Registrar evento de tracking si hay sello
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
    console.error('Error creando pedido:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('business_id')
  const branchId = searchParams.get('branch_id')
  const pendientesOnly = searchParams.get('pendientes') === 'true'

  if (!businessId) return NextResponse.json({ error: 'Falta business_id' }, { status: 400 })

  let query = supabase
    .from('orders')
    .select('*, clientes(nombre, puntos)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (branchId) query = query.eq('branch_id', branchId)
  if (pendientesOnly) {
    query = query
      .eq('sello_otorgado', true)
      .eq('sello_aprobado', false)
      .eq('sello_rechazado', false)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
