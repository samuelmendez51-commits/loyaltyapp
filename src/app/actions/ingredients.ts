'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hjaeireljkcvjnigfhzb.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Server Action to toggle ingredient status and invalidate Next.js cache
 */
export async function toggleIngredientStatus(ingredientId: string, currentStatus: boolean) {
  try {
    const { error } = await supabase
      .from('ingredients')
      .update({ is_available: !currentStatus })
      .eq('id', ingredientId)

    if (error) {
      console.error('[toggleIngredientStatus] Supabase error:', error)
      return { success: false, error: error.message }
    }

    // Clear Next.js cache under demand (ISR)
    revalidatePath('/(subdomains)/[slug]')
    revalidatePath('/tenant/[slug]/dashboard')
    revalidatePath('/tenant/[slug]')

    return { success: true }
  } catch (err: any) {
    console.error('[toggleIngredientStatus] Exception occurred:', err)
    return { success: false, error: err.message || 'Error interno del servidor' }
  }
}
