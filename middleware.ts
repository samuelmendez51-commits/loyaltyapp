import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const rol = request.cookies.get('session_rol')?.value
  const bizSlug = request.cookies.get('session_business_slug')?.value

  // 1. Identificar rutas estáticas o públicas del sistema (bypass de middleware)
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

  // 2. Extraer subdominio del hostname
  const hostname = request.headers.get('host') || ''
  let subdomain: string | null = null

  if (hostname.includes('loyaltyclub.mx')) {
    const parts = hostname.replace('.loyaltyclub.mx', '').split('.')
    if (parts.length > 0 && parts[0] !== 'www' && parts[0] !== '') {
      subdomain = parts[0]
    }
  } else if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    // Soporte para subdominios en desarrollo local (ej: laburreria.localhost:3000)
    const parts = hostname.split('.')
    if (parts.length > 1 && parts[0] !== 'www') {
      subdomain = parts[0]
    }
  }

  // 3. ENRUTAMIENTO BAJO SUBDOMINIO (Tenant Space: ej. laburreria.loyaltyclub.mx)
  if (subdomain) {
    // Validar si el rol iniciado pertenece a otro subdominio
    if (rol && rol !== 'superadmin' && bizSlug && bizSlug !== subdomain) {
      // Si el usuario pertenece a otro comercio, limpiar cookies y forzar login
      const response = NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
      const isProduction = hostname.includes('loyaltyclub.mx')
      const cookieDomain = isProduction ? '.loyaltyclub.mx' : undefined
      const cookieOpts = { path: '/', maxAge: 0, ...(cookieDomain ? { domain: cookieDomain } : {}) }
      const sessionCookies = ['session_rol', 'session_user', 'session_business_id', 'session_business_slug', 'session_branch_id', 'session_user_id']
      sessionCookies.forEach(name => response.cookies.set(name, '', cookieOpts))
      return response
    }

    // Ruta de portal suspendido es pública
    if (path.startsWith('/suspended')) {
      return NextResponse.next()
    }

    // Rutas protegidas del subdominio (Dashboard, Escáner, Ajustes)
    const esRutaProtegida = path.startsWith('/dashboard') || path === '/escaner' || path.startsWith('/ajustes')
    if (esRutaProtegida && !rol) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Si ya está logueado e ingresa al login
    if (path.startsWith('/login')) {
      if (rol) {
        if (rol === 'superadmin') {
          // Superadmin se gestiona en el dominio base
          const domain = hostname.includes('loyaltyclub.mx') ? 'loyaltyclub.mx' : 'localhost:3000'
          return NextResponse.redirect(new URL(`https://www.${domain}/superadmin`))
        }
        if (rol === 'admin_comercio') {
          return NextResponse.rewrite(new URL(`/_tenant/${subdomain}/dashboard`, request.url))
        }
        return NextResponse.redirect(new URL('/escaner', request.url))
      }
      return NextResponse.next()
    }

    // Redirección inteligente de raíz bajo subdominio
    if (path === '/') {
      if (rol) {
        if (rol === 'admin_comercio') {
          return NextResponse.rewrite(new URL(`/_tenant/${subdomain}/dashboard`, request.url))
        }
        if (rol === 'empleado') {
          return NextResponse.redirect(new URL('/escaner', request.url))
        }
      }
      // Reescribir raíz al "lienzo en blanco" del tenant
      return NextResponse.rewrite(new URL(`/_tenant/${subdomain}`, request.url))
    }

    // Reescrituras internas para subdominios (Clean URLs en el navegador)
    if (path === '/menu') {
      return NextResponse.rewrite(new URL(`/_tenant/${subdomain}/menu`, request.url))
    }
    if (path.startsWith('/dashboard')) {
      // Evitar bucle si ya fue reescrito
      if (path.startsWith(`/_tenant/${subdomain}/dashboard`)) {
        return NextResponse.next()
      }
      const subPath = path.replace('/dashboard', '')
      return NextResponse.rewrite(new URL(`/_tenant/${subdomain}/dashboard${subPath}`, request.url))
    }

    return NextResponse.next()
  }

  // 4. ENRUTAMIENTO GLOBAL (Main Base Domain: loyaltyclub.mx o www.loyaltyclub.mx)
  if (path.startsWith('/suspended')) return NextResponse.next()

  // Si está logueado e intenta acceder a login o raíz global, redirigir a su subdominio
  if (path.startsWith('/login') || path === '/') {
    if (rol) {
      if (rol === 'superadmin') {
        return NextResponse.redirect(new URL('/superadmin', request.url))
      }
      if (bizSlug) {
        const domain = hostname.includes('loyaltyclub.mx') ? 'loyaltyclub.mx' : 'localhost:3000'
        const targetPath = rol === 'admin_comercio' ? '/dashboard' : '/escaner'
        return NextResponse.redirect(new URL(`https://${bizSlug}.${domain}${targetPath}`))
      }
      // Fallback si no hay slug de comercio
      if (rol === 'admin_comercio') return NextResponse.redirect(new URL('/dashboard', request.url))
      return NextResponse.redirect(new URL('/escaner', request.url))
    }
    return NextResponse.next()
  }

  // Rutas protegidas globales
  if (!rol) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (path.startsWith('/superadmin')) {
    if (rol !== 'superadmin') {
      return NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
    }
    return NextResponse.next()
  }

  if (path.startsWith('/dashboard') || path.startsWith('/ajustes') || path === '/escaner') {
    // Si entra por la ruta global pero tiene rol y slug, redirigir a su subdominio respectivo
    if (rol !== 'superadmin' && bizSlug) {
      const domain = hostname.includes('loyaltyclub.mx') ? 'loyaltyclub.mx' : 'localhost:3000'
      return NextResponse.redirect(new URL(`https://${bizSlug}.${domain}${path}`))
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