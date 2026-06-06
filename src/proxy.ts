// src/proxy.ts — Middleware Multi-Tenancy LoyaltyClub
// Arquitectura de 3 Niveles de Acceso por Subdominio
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

interface ParsedDomain {
  slug: string | null
  isPartner: boolean
  isAdmin: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDAD: Clasificador de subdominio
// ─────────────────────────────────────────────────────────────────────────────
function parseHostname(hostname: string): ParsedDomain {
  const host = hostname.split(':')[0]

  // NIVEL 1: admin.loyaltyclub.mx | admin.localhost
  if (host === 'admin.loyaltyclub.mx' || host === 'admin.localhost') {
    return { slug: null, isPartner: false, isAdmin: true }
  }

  // Producción: *.loyaltyclub.mx
  if (host.endsWith('.loyaltyclub.mx')) {
    const sub = host.slice(0, -'.loyaltyclub.mx'.length)
    if (sub && sub !== 'www') {
      // NIVEL 2: partners.[slug].loyaltyclub.mx
      if (sub.startsWith('partners.')) {
        return { slug: sub.slice('partners.'.length), isPartner: true, isAdmin: false }
      }
      // NIVEL 3: [slug].loyaltyclub.mx
      return { slug: sub, isPartner: false, isAdmin: false }
    }
  }

  // Desarrollo local: *.localhost
  if (host.endsWith('.localhost')) {
    const sub = host.slice(0, -'.localhost'.length)
    if (sub && sub !== 'www') {
      // NIVEL 2: partners.[slug].localhost
      if (sub.startsWith('partners.')) {
        return { slug: sub.slice('partners.'.length), isPartner: true, isAdmin: false }
      }
      // NIVEL 3: [slug].localhost
      return { slug: sub, isPartner: false, isAdmin: false }
    }
  }

  return { slug: null, isPartner: false, isAdmin: false }
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDAD: Rewrite interno (URL visible no cambia para el usuario)
// ─────────────────────────────────────────────────────────────────────────────
function rewriteTo(request: NextRequest, internalPath: string): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = internalPath
  return NextResponse.rewrite(url)
}

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const hostname = request.headers.get('host') || ''

  // Early Return manual: si la URL contiene un punto "." o empieza con "/_next" o "/api/"
  if (path.includes('.') || path.startsWith('/_next') || path.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Detección de subdominios de Bikers
  const hostLower = hostname.toLowerCase()
  const isPartnersBikers = hostLower.startsWith('partners.bikers.')
  const isBikersClean = hostLower.startsWith('bikers.') && !hostLower.includes('partners')
  const isBikerSubdomain = isPartnersBikers || isBikersClean

  // Interceptar assets de bikers para servir los correctos (bikers.png y manifest-bikers.json)
  if (isBikerSubdomain) {
    if (path === '/manifest.json') {
      return NextResponse.rewrite(new URL('/manifest-bikers.json', request.url))
    }
    if (path === '/logo.png') {
      return NextResponse.rewrite(new URL('/bikers.png', request.url))
    }
  }

  // 1. BYPASS ABSOLUTO PARA ARCHIVOS ESTÁTICOS, APIS E IMÁGENES (Evita errores de bikers.png y logo.png)
  if (
    path.startsWith('/_next') ||
    path.startsWith('/api') ||
    path.includes('.') ||
    path === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // 2. EL FRENO DE MANO DEFINITIVO: Si la ruta interna ya fue reescrita y empieza con /tenant, NO HACER NADA
  if (path.startsWith('/tenant')) {
    return NextResponse.next()
  }

  // 3. DETECCIÓN ESTRICTA DE SUBDOMINIOS

  // 4. ENRUTAMIENTO Y REWRITES SEGUROS (Sin trailing slashes en raíz para evitar bucles de redirección de Next.js)
  if (isPartnersBikers) {
    // Mapea el panel administrativo del modulador de la flota
    const cleanPath = path === '/' || path === '/login' ? '' : path
    return NextResponse.rewrite(new URL(`/tenant/bikers/modulador${cleanPath}`, request.url))
  }

  if (isBikersClean) {
    // Si intentan registrarse, los mandamos al formulario público
    if (path === '/registro' || path.startsWith('/registro/')) {
      return NextResponse.rewrite(new URL(`/tenant/bikers/registro`, request.url))
    }
    // Mapea al portal móvil del repartidor (que contiene su login PIN)
    return NextResponse.rewrite(new URL(`/tenant/bikers/biker`, request.url))
  }

  const { slug, isPartner, isAdmin } = parseHostname(hostname)

  const rol = request.cookies.get('session_rol')?.value
  const bizSlug = request.cookies.get('session_business_slug')?.value
  const isProduction = hostname.includes('loyaltyclub.mx')

  // ── Bypass global: nunca interceptar rutas internas ya rewriteadas ────────
  if (
    path.startsWith('/api') ||
    path.startsWith('/_next') ||
    path.startsWith('/tenant') ||       // evitar bucle de rewrite
    path === '/favicon.ico' ||
    path === '/manifest.json' ||
    path === '/service-worker.js' ||
    /\.(png|jpg|jpeg|svg|webp|ico|woff|woff2|ttf|otf|gif|mp4|json)$/.test(path)
  ) {
    return NextResponse.next()
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BLOQUE SEGURIDAD GLOBAL: /superadmin solo desde admin.*
  // ══════════════════════════════════════════════════════════════════════════
  if (path.startsWith('/superadmin') && !isAdmin) {
    const url = request.nextUrl.clone()
    url.hostname = isProduction ? 'admin.loyaltyclub.mx' : 'admin.localhost'
    url.pathname = '/superadmin/login'
    return NextResponse.redirect(url)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NIVEL 1 — SUPERADMIN (admin.loyaltyclub.mx / admin.localhost)
  // ══════════════════════════════════════════════════════════════════════════
  if (isAdmin) {
    // Ruta de login: siempre libre
    if (path === '/superadmin/login') {
      return NextResponse.next()
    }

    // Raíz o /login: redirigir según sesión
    if (path === '/' || path === '/login' || path.startsWith('/login')) {
      if (rol === 'superadmin') {
        const url = request.nextUrl.clone()
        url.pathname = '/superadmin'
        return NextResponse.redirect(url)
      }
      const url = request.nextUrl.clone()
      url.pathname = '/superadmin/login'
      return NextResponse.redirect(url)
    }

    // Rutas /superadmin/* protegidas
    if (path.startsWith('/superadmin')) {
      if (rol !== 'superadmin') {
        const url = request.nextUrl.clone()
        url.pathname = '/superadmin/login'
        return NextResponse.redirect(url)
      }
      return NextResponse.next()
    }

    // Cualquier otra ruta en admin.* → login
    const url = request.nextUrl.clone()
    url.pathname = '/superadmin/login'
    return NextResponse.redirect(url)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NIVEL 2 — PARTNERS (partners.[slug].loyaltyclub.mx)
  // ══════════════════════════════════════════════════════════════════════════
  if (isPartner && slug) {

    // Seguridad: sesión de otro comercio → limpiar y redirigir
    if (rol && rol !== 'superadmin' && bizSlug && bizSlug !== slug) {
      const cookieDomain = isProduction ? '.loyaltyclub.mx' : undefined
      const cookieOpts = { path: '/', maxAge: 0, ...(cookieDomain ? { domain: cookieDomain } : {}) }
      const sessionCookies = [
        'session_rol', 'session_user', 'session_business_id',
        'session_business_slug', 'session_branch_id', 'session_user_id',
      ]
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'unauthorized')
      const response = NextResponse.redirect(url)
      sessionCookies.forEach(name => response.cookies.set(name, '', cookieOpts))
      return response
    }

    // Raíz o /login → servir login del partner o redirigir al dashboard si ya hay sesión
    if (path === '/' || path === '/login' || path.startsWith('/login')) {
      if (rol === 'admin_comercio') {
        return rewriteTo(request, `/tenant/${slug}/dashboard`)
      }
      if (rol === 'empleado' || rol === 'cajero') {
        return rewriteTo(request, `/tenant/${slug}/escaner`)
      }
      return rewriteTo(request, `/tenant/${slug}/login`)
    }

    // /dashboard/* → solo admin_comercio; empleado/cajero → escaner
    if (path === '/dashboard' || path.startsWith('/dashboard/')) {
      if (!rol) return NextResponse.redirect(new URL('/login', request.url))
      if (rol === 'empleado' || rol === 'cajero') {
        return rewriteTo(request, `/tenant/${slug}/escaner`)
      }
      const subPath = path.slice('/dashboard'.length)
      return rewriteTo(request, `/tenant/${slug}/dashboard${subPath}`)
    }

    // /escaner → /tenant/[slug]/escaner
    if (path === '/escaner' || path.startsWith('/escaner/')) {
      if (!rol) return NextResponse.redirect(new URL('/login', request.url))
      return rewriteTo(request, `/tenant/${slug}/escaner`)
    }

    // /biker → /tenant/[slug]/biker (portal GPS del repartidor)
    if (path === '/biker' || path.startsWith('/biker/')) {
      if (!rol) return NextResponse.redirect(new URL('/login', request.url))
      return rewriteTo(request, `/tenant/${slug}/biker`)
    }

    // /ajustes/* → solo admin_comercio; empleado/cajero → escaner
    if (path === '/ajustes' || path.startsWith('/ajustes/')) {
      if (!rol) return NextResponse.redirect(new URL('/login', request.url))
      if (rol === 'empleado' || rol === 'cajero') {
        return rewriteTo(request, `/tenant/${slug}/escaner`)
      }
      const subPath = path.slice('/ajustes'.length)
      return rewriteTo(request, `/tenant/${slug}/ajustes${subPath}`)
    }

    // Intentos de acceder a rutas de cliente desde partners.* → redirigir al subdominio cliente
    if (path.startsWith('/cliente') || path.startsWith('/registro')) {
      const url = request.nextUrl.clone()
      url.hostname = isProduction ? `${slug}.loyaltyclub.mx` : `${slug}.localhost`
      url.pathname = '/'
      return NextResponse.redirect(url)
    }

    return NextResponse.next()
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NIVEL 3 — CLIENTES FINALES ([slug].loyaltyclub.mx)
  // ══════════════════════════════════════════════════════════════════════════
  if (slug && !isPartner && !isAdmin) {

    // Bloquear intentos de acceso a rutas administrativas → redirigir a partners.*
    if (
      path === '/login' || path.startsWith('/login/') ||
      path === '/dashboard' || path.startsWith('/dashboard/') ||
      path === '/escaner' || path.startsWith('/escaner/') ||
      path === '/biker' || path.startsWith('/biker/') ||
      path.startsWith('/ajustes')
    ) {
      const url = request.nextUrl.clone()
      url.hostname = isProduction ? `partners.${slug}.loyaltyclub.mx` : `partners.${slug}.localhost`
      return NextResponse.redirect(url)
    }

    // /menu y cualquier subpath → /tenant/[slug]/menu
    if (path === '/menu' || path.startsWith('/menu/')) {
      return rewriteTo(request, `/tenant/${slug}${path}`)
    }

    // Raíz → Landing/Login del tenant (registro / "ya soy socio")
    if (path === '/') {
      return rewriteTo(request, `/tenant/${slug}`)
    }

    // /registro/* → /tenant/[slug]/registro/*
    if (path === '/registro' || path.startsWith('/registro/')) {
      return rewriteTo(request, `/tenant/${slug}/registro`)
    }

    // /cliente/[id] o /card/[id] → /tenant/[slug]/cliente/[id]  (tarjeta VIP)
    if (path.startsWith('/cliente/') || path.startsWith('/card/')) {
      const mappedPath = path.startsWith('/card/')
        ? `/cliente/${path.substring(6)}`
        : path
      return rewriteTo(request, `/tenant/${slug}${mappedPath}`)
    }

    // /suspended
    if (path === '/suspended' || path.startsWith('/suspended/')) {
      return rewriteTo(request, `/tenant/${slug}/suspended`)
    }

    return NextResponse.next()
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BLOQUE D — DOMINIO BASE (loyaltyclub.mx / localhost sin subdominio)
  // ══════════════════════════════════════════════════════════════════════════

  // Rutas administrativas en dominio base con sesión activa → redirigir al subdominio partners
  if (
    path.startsWith('/dashboard') ||
    path.startsWith('/ajustes') ||
    path === '/escaner' || path.startsWith('/escaner/') ||
    path === '/biker' || path.startsWith('/biker/')
  ) {
    if (rol && rol !== 'superadmin' && bizSlug) {
      const domain = isProduction ? 'loyaltyclub.mx' : 'localhost'
      const redirectUrl = isProduction
        ? `https://partners.${bizSlug}.${domain}${path}`
        : `http://partners.${bizSlug}.${domain}:3000${path}`
      return NextResponse.redirect(redirectUrl)
    }
    if (!rol) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  // Landing base
  if (path === '/') {
    return NextResponse.next()
  }

  // Login en dominio base (onboarding / partners central)
  if (path === '/login' || path.startsWith('/login/')) {
    if (rol === 'superadmin') {
      const url = request.nextUrl.clone()
      url.hostname = isProduction ? 'admin.loyaltyclub.mx' : 'admin.localhost'
      url.pathname = '/superadmin'
      return NextResponse.redirect(url)
    }
    if (rol && bizSlug) {
      const domain = isProduction ? 'loyaltyclub.mx' : 'localhost'
      const targetPath = rol === 'admin_comercio' ? '/dashboard' : '/escaner'
      const redirectUrl = isProduction
        ? `https://partners.${bizSlug}.${domain}${targetPath}`
        : `http://partners.${bizSlug}.${domain}:3000${targetPath}`
      return NextResponse.redirect(redirectUrl)
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}