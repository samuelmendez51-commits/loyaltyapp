import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import IngredientsClient from './IngredientsClient'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hjaeireljkcvjnigfhzb.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

// Disable static rendering cache for the dashboard page
export const revalidate = 0

export default async function IngredientsPage() {
  const session = await getSession()

  // Guard clause: enforce partner authentication session
  if (!session || !session.businessId) {
    redirect('/login')
  }

  const businessId = session.businessId

  // Fetch ingredients for this tenant
  const { data: ingredients, error } = await supabase
    .from('ingredients')
    .select('*')
    .eq('tenant_id', businessId)
    .order('nombre', { ascending: true })

  if (error) {
    console.error('[IngredientsPage] Failed to fetch ingredients:', error)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col gap-1 border-b border-zinc-200 pb-5">
        <h1 className="text-2xl font-black uppercase tracking-tight font-serif">
          Kill Switch de Insumos
        </h1>
        <p className="text-xs text-zinc-500">
          Controla la disponibilidad de ingredientes en tiempo real. Al apagar un insumo, se desactivará al instante en el menú de los clientes y evitará que ordenen productos agotados.
        </p>
      </div>

      <IngredientsClient initialIngredients={ingredients || []} />
    </div>
  )
}
