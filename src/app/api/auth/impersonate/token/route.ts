import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SignJWT } from 'jose'

export async function POST(request: NextRequest) {
  // 1. Validar que quien solicita sea superadmin
  const rol = request.cookies.get('session_rol')?.value
  if (rol !== 'superadmin') {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 401 })
  }

  try {
    const { userId, userNombre, businessId, slug } = await request.json()

    if (!userId || !userNombre || !businessId || !slug) {
      return NextResponse.json({ error: 'Campos faltantes' }, { status: 400 })
    }

    // 2. Firmar token JWT con validez corta (60 segundos)
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET || 'fallback-secret-loyaltyclub')
    const token = await new SignJWT({ userId, userNombre, businessId, slug })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('60s')
      .sign(secret)

    return NextResponse.json({ token })
  } catch (e: any) {
    console.error('Error al firmar token de impersonacion:', e)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
