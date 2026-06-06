import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Helper modular para simular o conectar con un gateway real (Meta API, Evolution API, etc.)
async function sendViaWhatsAppGateway({
  senderPayload,
  recipient,
  text
}: {
  senderPayload: string
  recipient: string
  text: string
}) {
  // Aquí es donde en producción se configuraría la integración real.
  // Ejemplo simulado para desarrollo:
  console.log(`\n=========================================`)
  console.log(`📲 [WHATSAPP GATEWAY SIMULATOR]`)
  console.log(`INSTANCIA EMISORA (TEL NEGOCIO) : ${senderPayload}`)
  console.log(`RECEPTOR (TEL CLIENTE)          : ${recipient}`)
  console.log(`MENSAJE ENVIADO:`)
  console.log(`-----------------------------------------`)
  console.log(text)
  console.log(`=========================================\n`)
  
  return { success: true }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { clientPhone, message, tenantSlug } = body

    if (!clientPhone || !message || !tenantSlug) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: clientPhone, message o tenantSlug' },
        { status: 400 }
      )
    }

    // 1. Consultar el número oficial configurado en la tabla businesses
    let telefonoEmisor = ''
    try {
      const { data: biz } = await supabase
        .from('businesses')
        .select('telefono_whatsapp')
        .eq('slug', tenantSlug.toLowerCase().trim())
        .maybeSingle()
      
      if (biz && biz.telefono_whatsapp) {
        telefonoEmisor = biz.telefono_whatsapp
      }
    } catch (err) {
      console.warn('[WhatsApp Route] Error al buscar en businesses, intentando fallback:', err)
    }

    // Fallback secundario si businesses falla o no tiene el número
    if (!telefonoEmisor) {
      try {
        const { data: ten } = await supabase
          .from('tenants')
          .select('telefono_whatsapp, color_primario') // supuestas columnas
          .eq('slug', tenantSlug.toLowerCase().trim())
          .maybeSingle()
        
        if (ten && (ten as any).telefono_whatsapp) {
          telefonoEmisor = (ten as any).telefono_whatsapp
        }
      } catch (err) {
        // Ignorar
      }
    }

    // Fallback definitivo si de plano no tiene configurado número
    if (!telefonoEmisor) {
      telefonoEmisor = '524521042522' // Número base/default de soporte o demo
    }

    // Asegurar formato de teléfono para emisor y receptor (ej: agregar prefijo de país 52 si no lo tiene)
    const cleanRecipient = clientPhone.replace(/\D/g, '')
    const recipientPhone = cleanRecipient.startsWith('52') ? cleanRecipient : `52${cleanRecipient}`

    const cleanSender = telefonoEmisor.replace(/\D/g, '')
    const senderPhone = cleanSender.startsWith('52') ? cleanSender : `52${cleanSender}`

    // 2. Disparar el mensaje a través de nuestro gateway helper
    await sendViaWhatsAppGateway({
      senderPayload: senderPhone,
      recipient: recipientPhone,
      text: message
    })

    return NextResponse.json({
      success: true,
      sender: senderPhone,
      recipient: recipientPhone,
      message: 'Mensaje despachado con éxito desde la línea oficial del negocio.'
    })

  } catch (error: any) {
    console.error('Error enviando mensaje de WhatsApp en backend:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
