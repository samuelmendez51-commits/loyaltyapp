import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { direccion, datos, scheduled_pickup_time } = body

    // Generate a random, unique delivery token
    const randomHex = crypto.randomBytes(8).toString('hex').toUpperCase()
    const delivery_token = `MOCK_TRV_${randomHex}`

    console.log(`[Mock Fleet API] Delivery registered. Token: ${delivery_token}, Scheduled: ${scheduled_pickup_time}, Address: ${direccion}`)

    return NextResponse.json({
      delivery_token,
      status: 'scheduled',
      scheduled_pickup_time
    })
  } catch (error: any) {
    console.error('[Mock Fleet API] Error registering delivery:', error)
    return NextResponse.json({ error: 'Failed to register mock delivery: ' + error.message }, { status: 500 })
  }
}
