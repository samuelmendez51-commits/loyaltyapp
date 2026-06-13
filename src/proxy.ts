// src/proxy.ts — LoyaltyClub Multi-Tenant Security Gateway (Next.js Proxy)
// ─────────────────────────────────────────────────────────────────────────────
// ARQUITECTURA DE SEGURIDAD EN 3 NIVELES:
//   NIVEL 1 — admin.*              → Superadmin panel (PIN raíz)
//   NIVEL 2 — [slug].partners.*   → Staff (admin_comercio / empleado)
//   NIVEL 3 — [slug].*            → Portal público del cliente VIP
//
// BLINDAJE CROSS-TENANT:
//   En rutas protegidas (/dashboard, /escaner, /ajustes), si el usuario
//   tiene rol 'admin_comercio' o 'empleado', se verifica ESTRICTAMENTE que
//   el slug del subdominio coincida con la cookie 'session_business_slug'.
//   Cualquier intento de saltar a otro tenant es rechazado y redirigido
//   al subdominio authorized de la cookie o al login para limpiar sesión.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
interface ParsedDomain {
  slug: string | null
  isPartner: boolean
  isAdmin: boolean
  isBiker: boolean
  isSocio: boolean
  isProduction: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────
const PROD_BASE = 'loyaltyclub.mx'
const DEV_BASE = 'localhost'

/** Rutas que nunca deben interceptarse (assets, API, internals) */
const BYPASS_PREFIXES = [
  '/_next',
  '/api',
  '/tenant',
  '/favicon.ico',
  '/manifest.json',
  '/manifest-bikers.json',
  '/service-worker.js',
]

const STATIC_EXT = /\.(png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|otf|mp4|json|txt|xml|map)$/i

/** Roles que pertenecen al staff del comercio (NO superadmin, NO cliente) */
const STAFF_ROLES = new Set(['admin_comercio', 'empleado', 'cajero'])

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDAD: parsear hostname y clasificar el subdominio
// ─────────────────────────────────────────────────────────────────────────────
function parseHostname(hostname: string): ParsedDomain {
  // Eliminar el puerto si viene incluido (p.ej. localhost:3000)
  const host = hostname.split(':')[0].toLowerCase()

  const isProduction = host.endsWith(`.${PROD_BASE}`) || host === PROD_BASE

  // ── Admin panel ──────────────────────────────────────────────────────────
  if (host === `admin.${PROD_BASE}` || host === `admin.${DEV_BASE}`) {
    return { slug: null, isPartner: false, isAdmin: true, isBiker: false, isSocio: false, isProduction }
  }

  // ── Bikers (portal de flota) — producción ───────────────────────────────
  if (host === `bikers.partners.${PROD_BASE}`) {
    return { slug: 'bikers', isPartner: true, isAdmin: false, isBiker: true, isSocio: false, isProduction: true }
  }

  // ── Bikers — desarrollo ──────────────────────────────────────────────────
  if (host === `bikers-partners.${DEV_BASE}` || host === `bikers.partners.${DEV_BASE}`) {
    return { slug: 'bikers', isPartner: true, isAdmin: false, isBiker: true, isSocio: false, isProduction: false }
  }
  if (host === `bikers.${DEV_BASE}`) {
    return { slug: 'bikers', isPartner: false, isAdmin: false, isBiker: true, isSocio: false, isProduction: false }
  }

  // ── Socio ─────────────────────────────────────────────────────────────
  if (host.includes('.socios.')) {
    const slug = host.split('.socios.')[0]
    if (slug && slug !== 'www') {
      return { slug, isPartner: false, isAdmin: false, isBiker: false, isSocio: true, isProduction }
    }
  }

  // ── Biker del negocio ──────────────────────────────────────────────────
  if (host.includes('.bikers.')) {
    const slug = host.split('.bikers.')[0]
    if (slug && slug !== 'www') {
      return { slug, isPartner: false, isAdmin: false, isBiker: true, isSocio: false, isProduction }
    }
  }

  // ── Partner (staff) ────────────────────────────────────────────────────
  if (host.includes('.partners.')) {
    const slug = host.split('.partners.')[0]
    if (slug && slug !== 'www') {
      return { slug, isPartner: true, isAdmin: false, isBiker: false, isSocio: false, isProduction }
    }
  }

  // ── Cliente público — producción: [slug].loyaltyclub.mx ─────────────────
  const prodSuffix = `.${PROD_BASE}`
  if (host.endsWith(prodSuffix)) {
    const slug = host.slice(0, -prodSuffix.length)
    if (slug && slug !== 'www' && slug !== 'admin' && slug !== 'bikers') {
      return { slug, isPartner: false, isAdmin: false, isBiker: false, isSocio: false, isProduction: true }
    }
  }

  // ── Cliente público — desarrollo: [slug].localhost ───────────────────────
  const devSuffix = `.${DEV_BASE}`
  if (host.endsWith(devSuffix)) {
    const slug = host.slice(0, -devSuffix.length)
    if (slug && slug !== 'www' && slug !== 'admin' && slug !== 'bikers') {
      return { slug, isPartner: false, isAdmin: false, isBiker: false, isSocio: false, isProduction: false }
    }
  }

  return { slug: null, isPartner: false, isAdmin: false, isBiker: false, isSocio: false, isProduction }
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDAD: rewrite interno (la URL visible del usuario no cambia)
// ─────────────────────────────────────────────────────────────────────────────
function rewriteTo(request: NextRequest, internalPath: string): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = internalPath
  return NextResponse.rewrite(url)
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDAD: limpiar todas las cookies de sesión y redirigir
// ─────────────────────────────────────────────────────────────────────────────
function clearSessionAndRedirect(
  request: NextRequest,
  redirectUrl: URL | string,
  isProduction: boolean,
): NextResponse {
  const SESSION_COOKIES = [
    'session_rol',
    'session_user',
    'session_business_id',
    'session_business_slug',
    'session_branch_id',
    'session_user_id',
  ]
  const cookieDomain = isProduction ? `.${PROD_BASE}` : undefined
  const cookieOpts = {
    path: '/',
    maxAge: 0,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  }
  const response = NextResponse.redirect(redirectUrl)
  SESSION_COOKIES.forEach((name) => response.cookies.set(name, '', cookieOpts))
  return response
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDAD: construir URL de redirect hacia subdominio partners autorizado
// ─────────────────────────────────────────────────────────────────────────────
function buildPartnerUrl(
  request: NextRequest,
  targetSlug: string,
  path: string,
  isProduction: boolean,
): URL {
  const url = request.nextUrl.clone()
  if (isProduction) {
    url.hostname = `${targetSlug}.partners.${PROD_BASE}`
    url.port = ''
  } else {
    url.hostname = `${targetSlug}.partners.${DEV_BASE}`
    url.port = '3000'
  }
  url.pathname = path
  return url
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDACIÓN CROSS-TENANT — CORAZÓN DEL BLINDAJE
//
// Verifica que el slug del subdominio coincida exactamente con la cookie
// 'session_business_slug'. Si no coincide, aborta y redirige.
//
// Retorna null si la validación pasa (el request puede continuar).
// Retorna un NextResponse de redirect/reject si hay violación.
// ─────────────────────────────────────────────────────────────────────────────
function enforceTenantIsolation(
  request: NextRequest,
  slugFromHost: string,
  rol: string | undefined,
  bizSlug: string | undefined,
  isProduction: boolean,
): NextResponse | null {

  // Solo aplica a roles de staff (no superadmin, no cliente anónimo)
  if (!rol || !STAFF_ROLES.has(rol)) {
    return null // Sin sesión de staff: dejar pasar (el bloque de auth lo manejará)
  }

  // Si no hay cookie de slug → sesión corrupta/incompleta → limpiar y login
  if (!bizSlug) {
    const loginUrl = buildPartnerUrl(request, slugFromHost, '/login', isProduction)
    loginUrl.searchParams.set('error', 'session_invalid')
    return clearSessionAndRedirect(request, loginUrl, isProduction)
  }

  // Comparación estricta: slug del subdominio vs slug de la cookie
  // Normalización: lowercase + trim para evitar bypasses por capitalización
  const normalizedHostSlug = slugFromHost.trim().toLowerCase()
  const normalizedCookieSlug = bizSlug.trim().toLowerCase()

  if (normalizedHostSlug === normalizedCookieSlug) {
    return null // ✅ Slug coincide — acceso legítimo
  }

  // ❌ VIOLACIÓN CROSS-TENANT detectada
  // El admin está intentando acceder al dashboard de OTRO comercio.
  // Redirigimos a SU propio subdominio autorizado (no lo dejamos elegir).
  const authorizedUrl = buildPartnerUrl(request, normalizedCookieSlug, '/dashboard', isProduction)
  authorizedUrl.searchParams.set('error', 'cross_tenant_blocked')
  // No limpiamos cookies — el usuario sigue con su sesión válida, sólo lo devolvemos a casa.
  return NextResponse.redirect(authorizedUrl)
}

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE PRINCIPAL (Exportado como proxy para Next.js 16)
// ─────────────────────────────────────────────────────────────────────────────
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const hostname = request.headers.get('host') || ''

  // ── 1. BYPASS GLOBAL: assets, APIs y paths internos ─────────────────────
  if (STATIC_EXT.test(path)) return NextResponse.next()
  for (const prefix of BYPASS_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return NextResponse.next()
    }
  }

  const { slug, isPartner, isAdmin, isBiker, isSocio, isProduction } = parseHostname(hostname)

  // ══════════════════════════════════════════════════════════════════════════
  // BLOQUE SOCIOS — portal de socios / terminal de cocina para tablets
  // ══════════════════════════════════════════════════════════════════════════
  if (isSocio && slug) {
    return rewriteTo(request, `/socio/${slug}/dashboard`)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BLOQUE BIKERS ESPECÍFICO DEL TENANT — [slug].bikers.localhost
  // ══════════════════════════════════════════════════════════════════════════
  if (isBiker && slug && slug !== 'bikers') {
    return rewriteTo(request, `/biker/${slug}/dashboard`)
  }

  // Leer cookies de sesión (server-side, no manipulables por JS cliente)
  const rol     = request.cookies.get('session_rol')?.value
  const bizSlug = request.cookies.get('session_business_slug')?.value

  // ══════════════════════════════════════════════════════════════════════════
  // BLOQUE BIKERS — portal de flota de repartidores
  // ══════════════════════════════════════════════════════════════════════════
  if (isBiker) {
    // Servir assets específicos del portal biker
    if (path === '/manifest.json') {
      return NextResponse.rewrite(new URL('/manifest-bikers.json', request.url))
    }
    if (path === '/logo.png') {
      return NextResponse.rewrite(new URL('/bikers.png', request.url))
    }

    if (isPartner) {
      // bikers.partners.* → modulador de flota (panel admin)
      const subPath = path === '/' || path === '/login' ? '' : path
      return rewriteTo(request, `/tenant/bikers/modulador${subPath}`)
    } else {
      // bikers.localhost → portal móvil del repartidor
      if (path === '/registro' || path.startsWith('/registro/')) {
        return rewriteTo(request, '/tenant/bikers/registro')
      }
      return rewriteTo(request, '/tenant/bikers/biker')
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BLOQUE SUPERADMIN — admin.loyaltyclub.mx / admin.localhost
  // ══════════════════════════════════════════════════════════════════════════
  if (!slug && path.startsWith('/superadmin') && !isAdmin) {
    // Intentar acceder a /superadmin desde un subdominio no-admin → bloqueado
    const url = request.nextUrl.clone()
    url.hostname = isProduction ? `admin.${PROD_BASE}` : `admin.${DEV_BASE}`
    url.pathname = '/superadmin/login'
    if (!isProduction) url.port = '3000'
    return NextResponse.redirect(url)
  }

  if (isAdmin) {
    // Login de superadmin siempre libre
    if (path === '/superadmin/login') return NextResponse.next()

    // Raíz o /login → redirigir según sesión
    if (path === '/' || path === '/login' || path.startsWith('/login/')) {
      const url = request.nextUrl.clone()
      url.pathname = rol === 'superadmin' ? '/superadmin' : '/superadmin/login'
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

    // Cualquier otra ruta en admin.* → forzar login
    const url = request.nextUrl.clone()
    url.pathname = '/superadmin/login'
    return NextResponse.redirect(url)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NIVEL 2 — PARTNERS [slug].partners.* (Staff del comercio)
  // ══════════════════════════════════════════════════════════════════════════
  if (isPartner && slug) {

    // ── BLINDAJE CROSS-TENANT ───────────────────────────────────────────
    // Solo aplica cuando se accede a rutas protegidas (no al login público)
    const isProtectedRoute =
      path === '/dashboard' || path.startsWith('/dashboard/') ||
      path === '/escaner'   || path.startsWith('/escaner/')   ||
      path === '/ajustes'   || path.startsWith('/ajustes/')   ||
      path === '/biker'     || path.startsWith('/biker/')

    if (isProtectedRoute) {
      const crossTenantViolation = enforceTenantIsolation(
        request, slug, rol, bizSlug, isProduction,
      )
      if (crossTenantViolation) return crossTenantViolation
    }

    // ── Login / Raíz ────────────────────────────────────────────────────
    if (path === '/' || path === '/login' || path.startsWith('/login/')) {
      if (rol === 'admin_comercio' && bizSlug === slug) {
        return rewriteTo(request, `/tenant/${slug}/dashboard`)
      }
      if ((rol === 'empleado' || rol === 'cajero') && bizSlug === slug) {
        return rewriteTo(request, `/tenant/${slug}/escaner`)
      }
      return rewriteTo(request, `/tenant/${slug}/login`)
    }

    // ── /dashboard/* → sólo admin_comercio ─────────────────────────────
    if (path === '/dashboard' || path.startsWith('/dashboard/')) {
      if (!rol) {
        return NextResponse.redirect(new URL('/login', request.url))
      }
      if (rol === 'empleado' || rol === 'cajero') {
        return rewriteTo(request, `/tenant/${slug}/escaner`)
      }
      const subPath = path.slice('/dashboard'.length) || ''
      return rewriteTo(request, `/tenant/${slug}/dashboard${subPath}`)
    }

    // ── /escaner ────────────────────────────────────────────────────────
    if (path === '/escaner' || path.startsWith('/escaner/')) {
      if (!rol) return NextResponse.redirect(new URL('/login', request.url))
      return rewriteTo(request, `/tenant/${slug}/escaner`)
    }

    // ── /biker ──────────────────────────────────────────────────────────
    if (path === '/biker' || path.startsWith('/biker/')) {
      if (!rol) return NextResponse.redirect(new URL('/login', request.url))
      return rewriteTo(request, `/tenant/${slug}/biker`)
    }

    // ── /ajustes/* → sólo admin_comercio ───────────────────────────────
    if (path === '/ajustes' || path.startsWith('/ajustes/')) {
      if (!rol) return NextResponse.redirect(new URL('/login', request.url))
      if (rol === 'empleado' || rol === 'cajero') {
        return rewriteTo(request, `/tenant/${slug}/escaner`)
      }
      const subPath = path.slice('/ajustes'.length) || ''
      return rewriteTo(request, `/tenant/${slug}/ajustes${subPath}`)
    }

    // ── Rutas de cliente accedidas desde partners.* → redirigir al subdominio público
    if (path.startsWith('/cliente') || path.startsWith('/registro')) {
      const url = request.nextUrl.clone()
      if (isProduction) {
        url.hostname = `${slug}.${PROD_BASE}`
        url.port = ''
      } else {
        url.hostname = `${slug}.${DEV_BASE}`
        url.port = '3000'
      }
      url.pathname = '/'
      return NextResponse.redirect(url)
    }

    return NextResponse.next()
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NIVEL 3 — PORTAL CLIENTE [slug].loyaltyclub.mx / [slug].localhost
  // ══════════════════════════════════════════════════════════════════════════
  if (slug && !isPartner && !isAdmin) {

    // Bloquear acceso a rutas administrativas desde el subdominio público
    const isAdminRoute =
      path === '/login'     || path.startsWith('/login/')     ||
      path === '/dashboard' || path.startsWith('/dashboard/') ||
      path === '/escaner'   || path.startsWith('/escaner/')   ||
      path === '/biker'     || path.startsWith('/biker/')     ||
      path === '/ajustes'   || path.startsWith('/ajustes/')

    if (isAdminRoute) {
      // Redirigir al subdominio partners correcto
      const url = request.nextUrl.clone()
      if (isProduction) {
        url.hostname = `${slug}.partners.${PROD_BASE}`
        url.port = ''
      } else {
        url.hostname = `${slug}.partners.${DEV_BASE}`
        url.port = '3000'
      }
      url.pathname = path === '/login' ? '/login' : '/'
      return NextResponse.redirect(url)
    }

    // /menu y subpaths
    if (path === '/menu' || path.startsWith('/menu/')) {
      const url = request.nextUrl.clone()
      url.pathname = '/cliente/guest'
      url.searchParams.set('tab', 'menu')
      return NextResponse.redirect(url)
    }

    // Raíz → landing/login del tenant
    if (path === '/') {
      return rewriteTo(request, `/tenant/${slug}`)
    }

    // /registro → formulario de registro del cliente
    if (path === '/registro' || path.startsWith('/registro/')) {
      return rewriteTo(request, `/tenant/${slug}/registro`)
    }

    // /cliente/[id] o /card/[id] → tarjeta VIP del cliente
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
  // DOMINIO BASE — loyaltyclub.mx / localhost (sin subdominio)
  // ══════════════════════════════════════════════════════════════════════════

  // Staff en dominio base con sesión activa → redirigir a su subdominio partners
  const isAdminPath =
    path.startsWith('/dashboard') ||
    path.startsWith('/ajustes')   ||
    path === '/escaner'           || path.startsWith('/escaner/') ||
    path === '/biker'             || path.startsWith('/biker/')

  if (isAdminPath) {
    if (rol && rol !== 'superadmin' && bizSlug) {
      const redirectUrl = isProduction
        ? `https://${bizSlug}.partners.${PROD_BASE}${path}`
        : `http://${bizSlug}.partners.${DEV_BASE}:3000${path}`
      return NextResponse.redirect(redirectUrl)
    }
    if (!rol) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  // Landing base → libre
  if (path === '/') return NextResponse.next()

  // Login en dominio base
  if (path === '/login' || path.startsWith('/login/')) {
    if (rol === 'superadmin') {
      const url = request.nextUrl.clone()
      url.hostname = isProduction ? `admin.${PROD_BASE}` : `admin.${DEV_BASE}`
      url.pathname = '/superadmin'
      if (!isProduction) url.port = '3000'
      return NextResponse.redirect(url)
    }
    if (rol && bizSlug && STAFF_ROLES.has(rol)) {
      const targetPath = rol === 'admin_comercio' ? '/dashboard' : '/escaner'
      const redirectUrl = isProduction
        ? `https://${bizSlug}.partners.${PROD_BASE}${targetPath}`
        : `http://${bizSlug}.partners.${DEV_BASE}:3000${targetPath}`
      return NextResponse.redirect(redirectUrl)
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG: Matcher — excluye explícitamente assets y endpoints de API
// para que el middleware/proxy sólo corra donde es necesario (performance).
// ─────────────────────────────────────────────────────────────────────────────
export const config = {
  matcher: [
    /*
     * Interceptar todas las rutas EXCEPTO:
     * - _next/static   → assets compilados por Next.js
     * - _next/image    → optimización de imágenes
     * - favicon.ico    → icono del navegador
     * - api/           → endpoints de Next.js (service_role en Supabase)
     * - archivos con extensión (*.png, *.js, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\..*).*)',
  ],
}