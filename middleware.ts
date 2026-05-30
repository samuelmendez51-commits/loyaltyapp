import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDAD: Extraer el subdominio del tenant desde el Host header
// Retorna null si es el dominio raíz (loyaltyclub.mx, www.loyaltyclub.mx)
// ─────────────────────────────────────────────────────────────────────────────
function extractSubdomain(hostname: string): string | null {
  // Limpiar el puerto si existe (ej: localhost:3000)
  const host = hostname.split(':')[0]

  // Producción: *.loyaltyclub.mx
  if (host.endsWith('.loyaltyclub.mx')) {
    const sub = host.slice(0, host.length - '.loyaltyclub.mx'.length)
    // Descartar www y cadenas vacías
    if (sub && sub !== 'www') return sub
    return null
  }

  // Dominio raíz exacto en producción (sin subdominio)
  if (host === 'loyaltyclub.mx' || host === 'www.loyaltyclub.mx') {
    return null
  }

  // Desarrollo local: slug.localhost
  if (host !== 'localhost' && host.endsWith('.localhost')) {
    const sub = host.slice(0, host.length - '.localhost'.length)
    if (sub && sub !== 'www') return sub
    return null
  }

  // Localhost sin subdominio
  if (host === 'localhost') return null

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDAD: Reescritura interna segura
// Usa clone() para preservar el host interno de Next.js y evitar que Vercel
// devuelva 404 por host incorrecto. El slug SIEMPRE se inyecta como prefijo
// en la ruta interna para que params.slug esté disponible en los page.tsx.
// ─────────────────────────────────────────────────────────────────────────────
function rewriteTo(request: NextRequest, internalPath: string): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = internalPath
  return NextResponse.rewrite(url)
}

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const hostname = request.headers.get('host') || ''

  // ── Bypass: archivos estáticos, API y assets ──────────────────────────────
  if (
    path.startsWith('/api') ||
    path.startsWith('/_next') ||
    path.startsWith('/tenant') ||      // ← Evitar bucle de rewrite
    path === '/favicon.ico' ||
    path === '/manifest.json' ||
    path === '/service-worker.js' ||
    /\.(png|jpg|jpeg|svg|webp|ico|woff|woff2|ttf|otf|gif|mp4|json)$/.test(path)
  ) {
    return NextResponse.next()
  }

  const subdomain = extractSubdomain(hostname)
  const rol = request.cookies.get('session_rol')?.value
  const bizSlug = request.cookies.get('session_business_slug')?.value
  const isProduction = hostname.includes('loyaltyclub.mx')

  // ════════════════════════════════════════════════════════════════════════════
  // BLOQUE A: SUBDOMINIO DE TENANT (ej: laburreria.loyaltyclub.mx)
  // ════════════════════════════════════════════════════════════════════════════
  if (subdomain) {

    // A1. Seguridad: sesión de otro comercio → limpiar cookies y forzar login
    if (rol && rol !== 'superadmin' && bizSlug && bizSlug !== subdomain) {
      const cookieDomain = isProduction ? '.loyaltyclub.mx' : undefined
      const cookieOpts = { path: '/', maxAge: 0, ...(cookieDomain ? { domain: cookieDomain } : {}) }
      const sessionCookies = [
        'session_rol', 'session_user', 'session_business_id',
        'session_business_slug', 'session_branch_id', 'session_user_id'
      ]
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'unauthorized')
      const response = NextResponse.redirect(url)
      sessionCookies.forEach(name => response.cookies.set(name, '', cookieOpts))
      return response
    }

    // A2. Ruta raíz del subdominio → portal de bienvenida del tenant
    if (path === '/') {
      if (rol === 'admin_comercio') {
        return rewriteTo(request, `/tenant/${subdomain}/dashboard`)
      }
      if (rol === 'empleado' || rol === 'cajero') {
        const url = request.nextUrl.clone()
        url.pathname = '/escaner'
        return NextResponse.redirect(url)
      }
      // Sin sesión: portal público del tenant
      return rewriteTo(request, `/tenant/${subdomain}`)
    }

    // A3. /login → página de acceso con branding del tenant
    if (path === '/login' || path.startsWith('/login')) {
      // Si ya hay sesión activa, redirigir al destino correspondiente
      if (rol) {
        if (rol === 'superadmin') {
          const url = request.nextUrl.clone()
          url.hostname = isProduction ? 'www.loyaltyclub.mx' : 'localhost'
          url.pathname = '/superadmin'
          return NextResponse.redirect(url)
        }
        if (rol === 'admin_comercio') {
          return rewriteTo(request, `/tenant/${subdomain}/dashboard`)
        }
        const url = request.nextUrl.clone()
        url.pathname = '/escaner'
        return NextResponse.redirect(url)
      }
      // Sin sesión: servir login con branding dinámico del tenant
      return rewriteTo(request, `/tenant/${subdomain}/login`)
    }

    // A4. /suspended → página pública (accesible sin sesión)
    if (path === '/suspended' || path.startsWith('/suspended')) {
      return NextResponse.next()
    }

    // A5. /menu → menú digital del tenant
    if (path === '/menu' || path.startsWith('/menu')) {
      return rewriteTo(request, `/tenant/${subdomain}/menu`)
    }

    // A6. /registro → formulario de alta de clientes finales (público, sin auth)
    if (path === '/registro' || path.startsWith('/registro')) {
      return rewriteTo(request, `/tenant/${subdomain}/registro`)
    }

    // A7. /cliente/[id] → tarjeta VIP del cliente (pública)
    if (path.startsWith('/cliente')) {
      // Reescribir preservando el sub-path completo (ej: /cliente/abc123)
      return rewriteTo(request, `/tenant/${subdomain}${path}`)
    }

    // A8. /dashboard → panel de control del tenant (requiere sesión)
    if (path === '/dashboard' || path.startsWith('/dashboard')) {
      if (!rol) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('redirect', path)
        return NextResponse.redirect(url)
      }
      const subPath = path === '/dashboard' ? '' : path.slice('/dashboard'.length)
      return rewriteTo(request, `/tenant/${subdomain}/dashboard${subPath}`)
    }

    // A9. /escaner → terminal de escaneo QR (requiere sesión)
    if (path === '/escaner') {
      if (!rol) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
      }
      return rewriteTo(request, `/tenant/${subdomain}/escaner`)
    }

    // A10. /ajustes → configuración del negocio (requiere sesión de admin)
    if (path.startsWith('/ajustes')) {
      if (!rol) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('redirect', path)
        return NextResponse.redirect(url)
      }
      const subPath = path === '/ajustes' ? '' : path.slice('/ajustes'.length)
      return rewriteTo(request, `/tenant/${subdomain}/ajustes${subPath}`)
    }

    // A11. Resto de rutas bajo subdominio: pasar sin modificar
    return NextResponse.next()
  }

  // ════════════════════════════════════════════════════════════════════════════
  // BLOQUE B: DOMINIO BASE (loyaltyclub.mx / www.loyaltyclub.mx / localhost)
  // ════════════════════════════════════════════════════════════════════════════

  // B1. Rutas públicas globales
  if (path === '/suspended' || path.startsWith('/suspended')) {
    return NextResponse.next()
  }
  if (path === '/registro' || path.startsWith('/registro')) {
    return NextResponse.next()
  }

  // B2. Raíz o login global: si ya tiene sesión, redirigir a su espacio
  if (path === '/' || path === '/login' || path.startsWith('/login')) {
    if (rol) {
      if (rol === 'superadmin') {
        const url = request.nextUrl.clone()
        url.pathname = '/superadmin'
        return NextResponse.redirect(url)
      }
      if (bizSlug) {
        const domain = isProduction ? 'loyaltyclub.mx' : 'localhost'
        const targetPath = rol === 'admin_comercio' ? '/dashboard' : '/escaner'
        const redirectUrl = isProduction
          ? `https://${bizSlug}.${domain}${targetPath}`
          : `http://${bizSlug}.${domain}:3000${targetPath}`
        return NextResponse.redirect(redirectUrl)
      }
      // Sin slug de negocio en cookie: dejar pasar al dashboard global
      if (path !== '/login') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
    return NextResponse.next()
  }

  // B3. Rutas protegidas sin sesión → redirigir a login
  if (!rol) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', path)
    return NextResponse.redirect(url)
  }

  // B4. /superadmin: exclusivo del dueño del SaaS
  if (path.startsWith('/superadmin')) {
    if (rol !== 'superadmin') {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'unauthorized')
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // B5. /dashboard, /ajustes, /escaner en dominio base con bizSlug → redirigir al subdominio correcto
  if (
    path.startsWith('/dashboard') ||
    path.startsWith('/ajustes') ||
    path === '/escaner'
  ) {
    if (rol !== 'superadmin' && bizSlug) {
      const domain = isProduction ? 'loyaltyclub.mx' : 'localhost'
      const redirectUrl = isProduction
        ? `https://${bizSlug}.${domain}${path}`
        : `http://${bizSlug}.${domain}:3000${path}`
      return NextResponse.redirect(redirectUrl)
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Aplicar en todas las rutas EXCEPTO:
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico
     * - Archivos de imagen/font conocidos
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|otf|mp4)).*)',
  ],
}