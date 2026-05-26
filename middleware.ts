import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const rol = request.cookies.get('session_rol')?.value

  const esPublica = (
    path.startsWith('/api') ||
    path.startsWith('/_next') ||
    path === '/favicon.ico' ||
    path.endsWith('.png') ||
    path.endsWith('.jpg') ||
    path.endsWith('.svg') ||
    path.endsWith('.webp') ||
    path === '/manifest.json' ||
    path === '/service-worker.js'
  )
  if (esPublica) return NextResponse.next()

  const esMenuPublico = /^\/[a-z0-9-]+\/menu/.test(path)
  if (esMenuPublico) return NextResponse.next()

  if (path.startsWith('/suspended')) return NextResponse.next()

  if (path.startsWith('/login')) {
    if (rol) {
      if (rol === 'superadmin') return NextResponse.redirect(new URL('/superadmin', request.url))
      if (rol === 'admin_comercio') return NextResponse.redirect(new URL('/dashboard', request.url))
      return NextResponse.redirect(new URL('/escaner', request.url))
    }
    return NextResponse.next()
  }

  if (!rol) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (path === '/') {
    if (rol === 'superadmin') return NextResponse.redirect(new URL('/superadmin', request.url))
    if (rol === 'admin_comercio') return NextResponse.redirect(new URL('/dashboard', request.url))
    return NextResponse.redirect(new URL('/escaner', request.url))
  }

  if (path.startsWith('/superadmin')) {
    if (rol !== 'superadmin') {
      return NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
    }
    return NextResponse.next()
  }

  if (path.startsWith('/dashboard')) {
    if (rol === 'empleado') {
      return NextResponse.redirect(new URL('/escaner', request.url))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.jpg$|.*\\.webp$).*)',
  ],
}