'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hjaeireljkcvjnigfhzb.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Server Action to delete a business and all its dependencies, bypassing client-side RLS.
 */
export async function deleteBusinessAction(businessId: string) {
  try {
    // 1. Limpiar audit_logs
    await supabase.from('audit_logs').delete().eq('business_id', businessId)
    // 2. Limpiar tracking_events
    await supabase.from('tracking_events').delete().eq('business_id', businessId)
    // 3. Limpiar credit_transactions
    await supabase.from('credit_transactions').delete().eq('business_id', businessId)
    // 4. Limpiar orders
    await supabase.from('orders').delete().eq('business_id', businessId)
    // 5. Limpiar historial_puntos
    await supabase.from('historial_puntos').delete().eq('business_id', businessId)
    // 6. Limpiar clientes
    await supabase.from('clientes').delete().eq('business_id', businessId)
    // 7. Limpiar programas_fidelidad
    await supabase.from('programas_fidelidad').delete().eq('business_id', businessId)
    // 8. Limpiar ruletas
    await supabase.from('ruletas').delete().eq('business_id', businessId)
    // 9. Limpiar business_users
    await supabase.from('business_users').delete().eq('business_id', businessId)
    // 10. Limpiar loyalty_rewards
    await supabase.from('loyalty_rewards').delete().eq('business_id', businessId)

    // Finalmente, eliminar negocio
    const { error } = await supabase.from('businesses').delete().eq('id', businessId)
    if (error) {
      console.error('[deleteBusinessAction] Error deleting business:', error)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err: any) {
    console.error('[deleteBusinessAction] Exception occurred:', err)
    return { success: false, error: err.message || 'Error interno' }
  }
}

/**
 * Server Action to update business fields and owner credentials, bypassing RLS.
 */
export async function updateBusinessAction(businessId: string, fields: any, nuevoPin?: string) {
  try {
    const { error } = await supabase
      .from('businesses')
      .update(fields)
      .eq('id', businessId)

    if (error) {
      console.error('[updateBusinessAction] Error updating business:', error)
      return { success: false, error: error.message }
    }

    if (nuevoPin && nuevoPin.trim()) {
      const { error: pinError } = await supabase
        .from('business_users')
        .update({
          pin: nuevoPin.trim(),
          email: fields.owner_email ? fields.owner_email.trim().toLowerCase() : undefined,
          nombre: fields.owner_name ? fields.owner_name.trim() : undefined
        })
        .eq('business_id', businessId)
        .eq('rol', 'admin_comercio')

      if (pinError) {
        console.error('[updateBusinessAction] Error updating business_users pin:', pinError)
        return { success: false, error: pinError.message }
      }
    }
    return { success: true }
  } catch (err: any) {
    console.error('[updateBusinessAction] Exception occurred:', err)
    return { success: false, error: err.message || 'Error interno' }
  }
}

/**
 * Server Action to toggle manual block status, bypassing RLS.
 */
export async function toggleBloqueoAction(businessId: string, currentBloqueado: boolean) {
  try {
    const nuevoEstado = !currentBloqueado
    const { error } = await supabase
      .from('businesses')
      .update({ bloqueado_manual: nuevoEstado, estado: nuevoEstado ? 'bloqueado' : 'activo' })
      .eq('id', businessId)

    if (error) {
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error interno' }
  }
}

/**
 * Server Action to generate a demo subscription, bypassing RLS.
 */
export async function generarDemoAction(businessId: string, diasDemo: number) {
  try {
    const fin = new Date()
    fin.setDate(fin.getDate() + (diasDemo || 30))
    const { error } = await supabase
      .from('businesses')
      .update({
        estado: 'demo',
        es_demo: true,
        fecha_vencimiento: fin.toISOString(),
        bloqueado_manual: false,
      })
      .eq('id', businessId)

    if (error) {
      return { success: false, error: error.message }
    }

    // Insert credit transaction
    await supabase.from('credit_transactions').insert({
      business_id: businessId,
      tipo: 'demo',
      creditos: 1,
      meses: 1,
      monto_mxn: 0,
      notas: `Demo ${diasDemo} días activado desde SuperAdmin`,
      creado_por: 'superadmin'
    })

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error interno' }
  }
}
