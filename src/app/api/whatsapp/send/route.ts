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
  const provider = process.env.WHATSAPP_PROVIDER || 'mock'
  
  if (provider === 'evolution') {
    const apiUrl = process.env.WHATSAPP_API_URL
    const apiKey = process.env.WHATSAPP_API_KEY
    const instanceName = process.env.WHATSAPP_INSTANCE_NAME

    if (!apiUrl || !apiKey || !instanceName) {
      console.warn('⚠️ [WhatsApp] Falta configuración para Evolution API. Fallback a simulador.')
      return runMockSimulator(senderPayload, recipient, text)
    }

    const url = `${apiUrl.replace(/\/$/, '')}/message/sendText/${instanceName}`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        number: recipient,
        options: {
          delay: 1200,
          presence: 'composing'
        },
        textMessage: {
          text: text
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Evolution API error: ${response.status} - ${errorText}`)
    }

    console.log(`✅ [WhatsApp] Mensaje enviado vía Evolution API a ${recipient}`)
    return { success: true }
  }

  if (provider === 'meta') {
    const metaToken = process.env.WHATSAPP_META_TOKEN
    const phoneId = process.env.WHATSAPP_META_PHONE_ID

    if (!metaToken || !phoneId) {
      console.warn('⚠️ [WhatsApp] Falta configuración para Meta Cloud API. Fallback a simulador.')
      return runMockSimulator(senderPayload, recipient, text)
    }

    const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${metaToken}`
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: {
          preview_url: text.includes('http'),
          body: text
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Meta Cloud API error: ${response.status} - ${JSON.stringify(errorData)}`)
    }

    console.log(`✅ [WhatsApp] Mensaje enviado vía Meta Cloud API a ${recipient}`)
    return { success: true }
  }

  // Fallback / Mock
  return runMockSimulator(senderPayload, recipient, text)
}

function runMockSimulator(senderPayload: string, recipient: string, text: string) {
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
