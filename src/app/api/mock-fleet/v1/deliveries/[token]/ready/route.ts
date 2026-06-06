import { NextResponse } from 'next/server'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    console.log(`[Mock Fleet API] Received ready/speed-up trigger for token: ${token}`)

    return NextResponse.json({
      success: true,
      message: `Delivery for token ${token} accelerated to immediate.`
    })
  } catch (error: any) {
    console.error('[Mock Fleet API] Error handling ready/speed-up trigger:', error)
    return NextResponse.json({ error: 'Failed to process override request: ' + error.message }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  return PATCH(req, { params })
}
