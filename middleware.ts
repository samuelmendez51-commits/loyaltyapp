import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  
  // Obtenemos la credencial secreta (Cookie)
  const rol = request.cookies.get('session_rol')?.value

  // Dejamos pasar libremente las rutas públicas (imágenes, API de Next, el Login, etc.)
  if (
    path.startsWith('/login') || 
    path.startsWith('/api') || 
    path.startsWith('/_next') || 
    path === '/favicon.ico' || 
    path.endsWith('.png') || 
    path.endsWith('.jpg')
  ) {
    // Si ya estás logueado e intentas entrar al login, te manda a tu área de trabajo
    if (path === '/login' && rol) {
      return NextResponse.redirect(new URL(rol === 'admin' ? '/dashboard' : '/escaner', request.url))
    }
    return NextResponse.next()
  }

  // REGLA 1: Si no tienes credencial y quieres entrar a cualquier lado, ¡Expulsado al Login!
  if (!rol) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // REGLA 2: Si la raíz del sitio (/) es visitada, mandarlo a su área de trabajo
  if (path === '/') {
    return NextResponse.redirect(new URL(rol === 'admin' ? '/dashboard' : '/escaner', request.url))
  }

  // REGLA 3: Seguridad de Staff (Cajeros)
  if (rol === 'staff') {
    // Si un cajero intenta ser curioso y meterse al dashboard, lo regresamos al escáner
    if (path.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/escaner', request.url))
    }
  }

  // Si pasaste todas las pruebas, te deja cargar la página
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)',
  ],
}