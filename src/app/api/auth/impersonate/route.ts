import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET || 'fallback-secret-loyaltyclub')
    const { payload } = await jwtVerify(token, secret)

    const { userId, userNombre, businessId, slug } = payload as any

    const host = request.headers.get('host') || 'localhost:3000'
    const isProduction = host.includes('loyaltyclub.mx')
    const sameSite = 'lax'
    const protocol = isProduction ? 'https' : 'http'

    // Redirigir al dashboard dentro del mismo subdominio de forma explicita
    const redirectUrl = `${protocol}://${host}/dashboard`
    const response = NextResponse.redirect(new URL(redirectUrl))

    // Configurar cookies con el rol impersonado
    response.cookies.set('session_rol', 'admin_comercio', { path: '/', sameSite })
    response.cookies.set('session_user', userNombre, { path: '/', sameSite })
    response.cookies.set('session_business_id', businessId, { path: '/', sameSite })
    response.cookies.set('session_business_slug', slug, { path: '/', sameSite })
    response.cookies.set('session_user_id', userId, { path: '/', sameSite })

    return response
  } catch (e) {
    console.error('Verificación de token de impersonación falló:', e)
    const host = request.headers.get('host') || 'localhost:3000'
    const isProduction = host.includes('loyaltyclub.mx')
    const protocol = isProduction ? 'https' : 'http'
    return NextResponse.redirect(new URL(`${protocol}://${host}/login`))
  }
}
