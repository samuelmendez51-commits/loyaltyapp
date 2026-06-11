import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Helper: gateway modular (Evolution API / Meta Cloud API / Mock) ─────────
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

// ── Helper: construir la plantilla dinámica del mensaje ────────────────────
function buildMessageTemplate({
  nombreCliente,
  sellosActuales,
  sellosTotales,
  slugNegocio,
  telefonoCliente,
  nombreNegocio,
}: {
  nombreCliente: string
  sellosActuales: number
  sellosTotales: number
  slugNegocio: string
  telefonoCliente: string
  nombreNegocio: string
}): string {
  // Calcular sellos restantes (nunca negativo)
  const sellosRestantes = Math.max(0, sellosTotales - sellosActuales)

  // Normalizar el teléfono para la URL: últimos 10 dígitos sin prefijo de país
  const telLimpio = telefonoCliente.replace(/\D/g, '').slice(-10)
  const cardUrl = `https://${slugNegocio}.loyaltyclub.mx/cliente/${telLimpio}`

  // Barra de progreso ASCII (12 chars max para no romper en móvil)
  const barLength = 10
  const filled = Math.round((sellosActuales / Math.max(sellosTotales, 1)) * barLength)
  const bar = '▓'.repeat(filled) + '░'.repeat(Math.max(0, barLength - filled))

  return `¡Hola, ${nombreCliente}! 🌯🔥

¡Felicidades! Ya eres parte oficial de nuestro Club de Lealtad en ${nombreNegocio}. Tu visita de hoy ya sumó en tu tarjeta digital.

📊 Tu Estado Actual:
[${bar}] ${sellosActuales}/${sellosTotales} sellos
¡Estás a solo ${sellosRestantes} visita${sellosRestantes === 1 ? '' : 's'} de reclamar tu premio gratis! 🎉

📱 Consulta tus sellos y juega en la Ruleta VIP aquí mismo:
👉 ${cardUrl}

Guarda este número en tus contactos para que el enlace se vuelva interactivo y puedas abrir tu tarjeta cuando quieras en un solo toque. ¡Gracias por tu preferencia! 👑`
}

// ── POST Handler ────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { clientPhone, tenantSlug, clienteId } = body

    if (!clientPhone || !tenantSlug) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: clientPhone o tenantSlug' },
        { status: 400 }
      )
    }

    // ── 1. Cargar datos del negocio (número emisor, nombre, max_sellos) ──────
    let telefonoEmisor = ''
    let nombreNegocio = 'La Burrería'
    let sellosTotalesNegocio = 10

    try {
      const { data: biz } = await supabase
        .from('businesses')
        .select('telefono_whatsapp, nombre, max_sellos')
        .eq('slug', tenantSlug.toLowerCase().trim())
        .maybeSingle()

      if (biz) {
        if (biz.telefono_whatsapp) telefonoEmisor = biz.telefono_whatsapp
        if (biz.nombre) nombreNegocio = biz.nombre
        if (biz.max_sellos) sellosTotalesNegocio = Number(biz.max_sellos) || 10
      }
    } catch (err) {
      console.warn('[WhatsApp Route] Error al buscar en businesses, intentando fallback:', err)
    }

    // ── 2. Intentar cargar desde programa de fidelidad activo (fuente preferida) ──
    try {
      const { data: bizForId } = await supabase
        .from('businesses')
        .select('id')
        .eq('slug', tenantSlug.toLowerCase().trim())
        .maybeSingle()

      if (bizForId?.id) {
        const { data: prog } = await supabase
          .from('programas_fidelidad')
          .select('total_estampillas')
          .eq('business_id', bizForId.id)
          .eq('activo', true)
          .maybeSingle()

        if (prog?.total_estampillas) {
          sellosTotalesNegocio = Number(prog.total_estampillas) || sellosTotalesNegocio
        }
      }
    } catch (_) {
      // Silencioso — usamos el fallback de businesses.max_sellos
    }

    // Fallback número emisor
    if (!telefonoEmisor) {
      telefonoEmisor = '524521042522'
    }

    // ── 3. Cargar datos del cliente (nombre y sellos actuales) ───────────────
    let nombreCliente = 'Socio VIP'
    let sellosActuales = 0

    // Normalizar el teléfono de entrada para buscar en Supabase
    const cleanRecipient = clientPhone.replace(/\D/g, '')
    const recipientPhone = cleanRecipient.startsWith('52')
      ? cleanRecipient
      : `52${cleanRecipient}`

    // El formato almacenado incluye + al inicio
    const telConPlus = `+${recipientPhone}`

    try {
      // Intentar por ID directo si viene en el payload (más preciso)
      if (clienteId) {
        const { data: cli } = await supabase
          .from('clientes')
          .select('nombre, puntos')
          .eq('id', clienteId)
          .maybeSingle()

        if (cli) {
          nombreCliente = cli.nombre || nombreCliente
          sellosActuales = Number(cli.puntos) || 0
        }
      } else {
        // Buscar por teléfono (con y sin +)
        const { data: cli } = await supabase
          .from('clientes')
          .select('nombre, puntos')
          .or(`telefono.eq.${telConPlus},telefono.eq.${recipientPhone}`)
          .maybeSingle()

        if (cli) {
          nombreCliente = cli.nombre || nombreCliente
          sellosActuales = Number(cli.puntos) || 0
        }
      }
    } catch (err) {
      console.warn('[WhatsApp Route] No se pudo obtener datos del cliente:', err)
    }

    // ── 4. Construir mensaje dinámico y persuasivo ───────────────────────────
    const messageText = buildMessageTemplate({
      nombreCliente,
      sellosActuales,
      sellosTotales: sellosTotalesNegocio,
      slugNegocio: tenantSlug.toLowerCase().trim(),
      telefonoCliente: recipientPhone,
      nombreNegocio,
    })

    // ── 5. Normalizar número emisor ──────────────────────────────────────────
    const cleanSender = telefonoEmisor.replace(/\D/g, '')
    const senderPhone = cleanSender.startsWith('52') ? cleanSender : `52${cleanSender}`

    // ── 6. Disparar el mensaje a través del gateway ──────────────────────────
    await sendViaWhatsAppGateway({
      senderPayload: senderPhone,
      recipient: recipientPhone,
      text: messageText
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
