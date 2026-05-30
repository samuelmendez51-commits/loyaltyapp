import { cache } from 'react'
import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface TenantBusiness {
  id: string
  nombre: string
  slug: string
  logo_url: string | null
  color_primario: string
  estado: 'activo' | 'vencido' | 'suspendido'
  bloqueado_manual: boolean
  plan?: string | null
}

export type TenantResult =
  | { status: 'ok'; tenant: TenantBusiness }
  | { status: 'not_found' }
  | { status: 'suspended' }

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS CORE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Carga los datos del negocio (tenant) desde Supabase dado su slug.
 *
 * Usa `React.cache()` para deduplicar peticiones dentro del mismo ciclo de
 * render en Server Components — si múltiples páginas hijas llaman a esta
 * función con el mismo slug en el mismo request, Supabase solo se consulta
 * una vez.
 *
 * @example
 * // En un Server Component o page.tsx
 * const result = await getTenantBySlug(params.slug)
 * if (result.status !== 'ok') notFound()
 * const { tenant } = result
 */
export const getTenantBySlug = cache(async (slug: string): Promise<TenantResult> => {
  if (!slug) return { status: 'not_found' }

  const { data, error } = await supabase
    .from('businesses')
    .select('id, nombre, slug, logo_url, color_primario, estado, bloqueado_manual, plan')
    .eq('slug', slug.toLowerCase().trim())
    .maybeSingle()

  if (error) {
    console.error('[tenant] Error consultando businesses:', error.message)
    return { status: 'not_found' }
  }

  if (!data) return { status: 'not_found' }

  const tenant = data as TenantBusiness

  if (tenant.bloqueado_manual || tenant.estado === 'vencido' || tenant.estado === 'suspendido') {
    return { status: 'suspended' }
  }

  return { status: 'ok', tenant }
})

/**
 * Versión simplificada que retorna el tenant directamente o null.
 * Útil en contextos donde no necesitas diferenciar entre not_found y suspended.
 */
export async function getTenantOrNull(slug: string): Promise<TenantBusiness | null> {
  const result = await getTenantBySlug(slug)
  if (result.status === 'ok') return result.tenant
  return null
}

/**
 * Verifica rápidamente si un slug de tenant existe y está activo.
 * Útil en middleware o guards sin necesitar todos los datos.
 */
export async function isTenantActiveBySlug(slug: string): Promise<boolean> {
  const result = await getTenantBySlug(slug)
  return result.status === 'ok'
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES DE UI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna el color primario del tenant o un valor por defecto.
 * Garantiza que siempre hay un color válido para estilos inline.
 */
export function getTenantColor(tenant: TenantBusiness, fallback = '#09090b'): string {
  return tenant.color_primario || fallback
}

/**
 * Construye la URL base de un tenant para redirecciones.
 * Funciona tanto en producción (*.loyaltyclub.mx) como en desarrollo (*.localhost:3000).
 */
export function buildTenantUrl(
  slug: string,
  path: string = '/',
  options: { isProduction?: boolean; port?: number } = {}
): string {
  const { isProduction = process.env.NODE_ENV === 'production', port = 3000 } = options

  if (isProduction) {
    return `https://${slug}.loyaltyclub.mx${path}`
  }
  return `http://${slug}.localhost:${port}${path}`
}
