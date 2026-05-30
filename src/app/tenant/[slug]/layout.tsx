import { notFound } from 'next/navigation'
import { getTenantBySlug } from '@/lib/tenant'

interface TenantLayoutProps {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

/**
 * Layout base del tenant.
 * 
 * Valida que el slug corresponda a un negocio existente y activo antes de
 * renderizar cualquier página hija. Si el negocio no existe, Next.js devuelve
 * automáticamente una página 404.
 * 
 * No añade marcado visual propio — respeta el look & feel de cada page.tsx.
 * Su único rol es la validación + inyección de metadata por tenant.
 */
export default async function TenantLayout({ children, params }: TenantLayoutProps) {
  const { slug } = await params
  const result = await getTenantBySlug(slug)

  // Negocio no registrado → 404 nativo de Next.js
  if (result.status === 'not_found') {
    notFound()
  }

  // Las páginas individuales (ej: page.tsx del portal) manejan el estado 'suspended'
  // con su propio UI de suspensión, por lo que aquí dejamos pasar.

  return <>{children}</>
}

/**
 * Genera metadata dinámica por tenant para SEO y PWA.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const result = await getTenantBySlug(slug)

  if (result.status !== 'ok') {
    return { title: 'Portal no encontrado — LoyaltyClub' }
  }

  const { tenant } = result

  return {
    title: `${tenant.nombre} — Club de Fidelidad`,
    description: `Accede a tu tarjeta VIP y estampillas de ${tenant.nombre}. Powered by LoyaltyClub.mx`,
    themeColor: tenant.color_primario || '#09090b',
  }
}
