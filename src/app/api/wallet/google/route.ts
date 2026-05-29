import { SignJWT, importPKCS8 } from 'jose'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE — cliente server-side (sin RLS restrictions para uso en API routes)
// ─────────────────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hjaeireljkcvjnigfhzb.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES DEL ISSUER (fijas del Google Cloud Console)
// ─────────────────────────────────────────────────────────────────────────────
const ISSUER_ID = '3388000000023143249'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
interface BusinessData {
  id: string
  nombre: string
  slug: string
  logo_url: string | null
  banner_url: string | null
  color_primario: string | null
}

interface ClienteData {
  id: string
  nombre: string
  puntos: number
  telefono?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Sanitizar la private key de las variables de entorno de Vercel
// Vercel puede añadir comillas y escapar \n como literales
// ─────────────────────────────────────────────────────────────────────────────
function sanitizePrivateKey(raw: string): string {
  let key = raw.trim()
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1)
  }
  return key.replace(/\\n/g, '\n').trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Normalizar color hexadecimal (Google requiere #RRGGBB exactamente)
// ─────────────────────────────────────────────────────────────────────────────
function normalizeHexColor(color: string | null | undefined, fallback = '#1a5e3a'): string {
  if (!color) return fallback
  const c = color.trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(c)) return c
  // Expandir color corto (#abc → #aabbcc)
  if (/^#[0-9A-Fa-f]{3}$/.test(c)) {
    return '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]
  }
  // Sin # al inicio
  if (/^[0-9A-Fa-f]{6}$/.test(c)) return '#' + c
  return fallback
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Obtener Access Token OAuth2 via JWT de service account
// ─────────────────────────────────────────────────────────────────────────────
async function getGoogleAccessToken(clientEmail: string, privateKey: string): Promise<string | null> {
  try {
    const now = Math.floor(Date.now() / 1000)
    const privateKeyObj = await importPKCS8(privateKey, 'RS256')
    const jwt = await new SignJWT({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
      .setProtectedHeader({ alg: 'RS256' })
      .sign(privateKeyObj)

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[GoogleWallet] OAuth2 token error:', res.status, errText)
      return null
    }

    const tokenData = await res.json()
    return tokenData.access_token || null
  } catch (err) {
    console.error('[GoogleWallet] getGoogleAccessToken error:', err)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Construir el payload de la LoyaltyClass con override dinámico
// La clase base es 'lealtad_v1' (class suffix). Los campos dinámicos del
// negocio se sobreescriben desde los datos de Supabase.
// ─────────────────────────────────────────────────────────────────────────────
function buildLoyaltyClass(classId: string, business: BusinessData) {
  const bgColor = normalizeHexColor(business.color_primario)
  const logoUrl = business.logo_url || 'https://loyaltyclub.mx/logo.png'
  const heroUrl = business.banner_url || business.logo_url || 'https://loyaltyclub.mx/logo.png'
  const programLink = `https://${business.slug}.loyaltyclub.mx/dashboard`

  return {
    id: classId,
    // ── Identificación dinámica del comercio ──────────────────────────────
    issuerName: business.nombre,
    programName: `${business.nombre} — Club VIP`,

    // ── Marca visual dinámica del negocio ────────────────────────────────
    hexBackgroundColor: bgColor,

    // Logo del comercio (override obligatorio)
    programLogo: {
      sourceUri: {
        uri: logoUrl,
      },
      contentDescription: {
        defaultValue: {
          language: 'es-MX',
          value: `Logo de ${business.nombre}`,
        },
      },
    },

    // Hero image (imagen destacada del negocio)
    heroImage: {
      sourceUri: {
        uri: heroUrl,
      },
      contentDescription: {
        defaultValue: {
          language: 'es-MX',
          value: `${business.nombre} — Imagen de portada`,
        },
      },
    },

    // ── Configuración del programa de lealtad ────────────────────────────
    rewardsTier: 'base',
    rewardsTierLabel: 'Sello',
    reviewStatus: 'UNDER_REVIEW',
    countryCode: 'MX',
    redemptionIssuers: [],

    // ── Enlace al portal del comercio ────────────────────────────────────
    linksModuleData: {
      uris: [
        {
          uri: programLink,
          description: `Portal ${business.nombre}`,
          id: 'portal_link',
        },
      ],
    },

    // ── Layout de la tarjeta (3 campos dinámicos) ────────────────────────
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          {
            threeItems: {
              startItem: {
                firstValue: {
                  fields: [{ fieldPath: 'object.loyaltyPoints.balance' }],
                },
              },
              middleItem: {
                firstValue: {
                  fields: [{ fieldPath: 'object.accountName' }],
                },
              },
              endItem: {
                firstValue: {
                  fields: [{ fieldPath: 'object.textModulesData["max_sellos"]' }],
                },
              },
            },
          },
        ],
      },
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Asegurar que la LoyaltyClass exista en Google Wallet (autocreación)
// ─────────────────────────────────────────────────────────────────────────────
async function asegurarClaseExiste(
  classId: string,
  accessToken: string,
  business: BusinessData
): Promise<boolean> {
  const baseUrl = 'https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass'
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }

  // GET: verificar si la clase ya existe
  try {
    const checkRes = await fetch(`${baseUrl}/${encodeURIComponent(classId)}`, { method: 'GET', headers })
    if (checkRes.ok) {
      console.log('[GoogleWallet] ✅ Clase existente:', classId)
      // PATCH: actualizar la clase con los datos más recientes del negocio
      const patchRes = await fetch(`${baseUrl}/${encodeURIComponent(classId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(buildLoyaltyClass(classId, business)),
      })
      if (!patchRes.ok) {
        const errText = await patchRes.text()
        console.warn('[GoogleWallet] PATCH clase warning:', patchRes.status, errText)
      } else {
        console.log('[GoogleWallet] ✅ Clase actualizada con datos de:', business.nombre)
      }
      return true
    }

    if (checkRes.status !== 404) {
      const errText = await checkRes.text()
      console.warn('[GoogleWallet] GET clase error inesperado:', checkRes.status, errText)
      // Continuamos para intentar crear la clase de todas formas
    }
  } catch (err) {
    console.error('[GoogleWallet] Error al verificar clase (GET):', err)
    // Continuamos para intentar crear
  }

  // POST: crear la clase (no existía o hubo un error no bloqueante)
  try {
    console.log('[GoogleWallet] 🔧 Creando clase para:', business.nombre, classId)
    const createRes = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildLoyaltyClass(classId, business)),
    })

    if (createRes.ok) {
      console.log('[GoogleWallet] ✅ Clase creada exitosamente:', classId)
      return true
    }

    // Si la clase ya existe (409 Conflict) → OK, no es un error real
    if (createRes.status === 409) {
      console.log('[GoogleWallet] ℹ️ Clase ya existía (409 Conflict):', classId)
      return true
    }

    const errText = await createRes.text()
    console.error('[GoogleWallet] Error al crear clase:', createRes.status, errText)
    return false
  } catch (err) {
    console.error('[GoogleWallet] Error al crear clase (catch):', err)
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER PRINCIPAL — POST /api/wallet/google
// Body esperado: { slug, user_id } o fallback con { id, nombre, puntos, business_name }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // ── Parámetros de entrada ─────────────────────────────────────────────
    const slug: string | undefined = body.slug
    const userId: string = body.user_id || body.id || body.clienteId || ''
    const nombreFallback: string = body.nombre || 'Socio VIP'
    const puntosFallback: number = body.puntos || 0

    console.log('[GoogleWallet] POST recibido:', { slug, userId, nombreFallback })

    if (!userId) {
      return NextResponse.json({ error: 'Falta el parámetro user_id o id del cliente' }, { status: 400 })
    }

    // ── 1. Consultar datos del negocio en Supabase ────────────────────────
    let business: BusinessData | null = null

    if (slug) {
      const { data, error: bizError } = await supabase
        .from('businesses')
        .select('id, nombre, slug, logo_url, banner_url, color_primario')
        .eq('slug', slug)
        .maybeSingle()

      if (bizError) {
        console.warn('[GoogleWallet] Error consultando businesses:', bizError.message)
      } else if (data) {
        business = data as BusinessData
        console.log('[GoogleWallet] ✅ Negocio encontrado:', business.nombre)
      }
    }

    // Fallback si no se encontró el negocio por slug
    if (!business) {
      console.warn('[GoogleWallet] ⚠️ Negocio no encontrado por slug. Usando datos del body como fallback.')
      business = {
        id: '',
        nombre: body.business_name || 'LoyaltyClub',
        slug: slug || 'loyaltyclub',
        logo_url: body.logo_url || null,
        banner_url: body.banner_url || null,
        color_primario: body.color_primario || '#1a5e3a',
      }
    }

    // ── 2. Consultar datos del cliente en Supabase ────────────────────────
    let cliente: ClienteData = {
      id: userId,
      nombre: nombreFallback,
      puntos: puntosFallback,
    }

    const { data: clienteData, error: clienteError } = await supabase
      .from('clientes')
      .select('id, nombre, puntos, telefono')
      .eq('id', userId)
      .maybeSingle()

    if (clienteError) {
      console.warn('[GoogleWallet] Error consultando clientes:', clienteError.message)
    } else if (clienteData) {
      cliente = clienteData as ClienteData
      console.log('[GoogleWallet] ✅ Cliente encontrado:', cliente.nombre, '| Sellos:', cliente.puntos)
    }

    // ── 3. Credenciales de Google Cloud desde variables de entorno ────────
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY || ''
    const privateKey = sanitizePrivateKey(rawPrivateKey)

    // Si no hay credenciales → modo simulación controlada
    if (!clientEmail || !privateKey || privateKey.length < 100) {
      console.warn('[GoogleWallet] ⚠️ Sin credenciales de Google. Modo simulación.')
      const simUrl = `/google-wallet-simulacion?id=${encodeURIComponent(cliente.id)}&nombre=${encodeURIComponent(cliente.nombre)}&puntos=${cliente.puntos}&business_name=${encodeURIComponent(business.nombre)}`
      return NextResponse.json({ url: simUrl, simulacion: true })
    }

    // ── 4. IDs únicos para esta clase y objeto ────────────────────────────
    // La clase es por negocio (slug), el objeto es por cliente
    const classSuffix = `lealtad_${business.slug.replace(/[^a-zA-Z0-9_]/g, '_')}`
    const classId = `${ISSUER_ID}.${classSuffix}`
    const safeClientId = userId.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase().substring(0, 40)
    const objectId = `${ISSUER_ID}.obj_${business.slug.replace(/[^a-zA-Z0-9_]/g, '_')}_${safeClientId}`

    console.log('[GoogleWallet] ClassId:', classId)
    console.log('[GoogleWallet] ObjectId:', objectId)

    // ── 5. Obtener Access Token OAuth2 ───────────────────────────────────
    const accessToken = await getGoogleAccessToken(clientEmail, privateKey)
    if (!accessToken) {
      return NextResponse.json({ error: 'Error de autenticación con Google Wallet API' }, { status: 500 })
    }

    // ── 6. Asegurar que la LoyaltyClass existe y está actualizada ─────────
    await asegurarClaseExiste(classId, accessToken, business)

    // ── 7. Construir el LoyaltyObject dinámico ────────────────────────────
    const bgColor = normalizeHexColor(business.color_primario)
    const portalUrl = `https://${business.slug}.loyaltyclub.mx/dashboard`
    const qrData = `https://${business.slug}.loyaltyclub.mx/cliente/${cliente.id}`

    const loyaltyObject = {
      id: objectId,
      classId: classId,
      state: 'ACTIVE',

      // ── Identificación del titular ──────────────────────────────────────
      accountId: cliente.id.substring(0, 20),
      accountName: cliente.nombre,

      // ── Saldo de sellos (campo principal visible en la tarjeta) ─────────
      loyaltyPoints: {
        balance: {
          string: `${cliente.puntos} ★`,
        },
        label: 'Sellos Acumulados',
      },

      // ── Código QR que abre el perfil del socio ──────────────────────────
      barcode: {
        type: 'QR_CODE',
        value: qrData,
        alternateText: `ID: ${cliente.id.substring(0, 8).toUpperCase()}`,
      },

      // ── Módulos de texto con datos dinámicos del cliente ─────────────────
      // Estos campos se mapean en el classTemplateInfo para los 3 slots de la card
      textModulesData: [
        {
          id: 'sellos_actuales',
          header: 'Sellos Acumulados',
          body: `${cliente.puntos} sellos`,
        },
        {
          id: 'max_sellos',
          header: 'Meta',
          body: 'Completa 10 sellos',
        },
        {
          id: 'nombre_club',
          header: 'Club',
          body: `${business.nombre} VIP`,
        },
        {
          id: 'instrucciones',
          header: 'Cómo Canjear',
          body: 'Presenta tu código QR en caja en cada visita para acumular sellos y ganar premios exclusivos.',
        },
      ],

      // ── Filas informativas del dorso de la tarjeta ───────────────────────
      infoModuleData: {
        labelValueRows: [
          {
            columns: [
              { label: 'Socio VIP', value: cliente.nombre },
              { label: 'Sellos', value: `${cliente.puntos}` },
            ],
          },
          {
            columns: [
              { label: 'Comercio', value: business.nombre },
              { label: 'Portal', value: `${business.slug}.loyaltyclub.mx` },
            ],
          },
        ],
        showLastUpdateTime: true,
      },

      // ── Enlace al portal del comercio ────────────────────────────────────
      linksModuleData: {
        uris: [
          {
            uri: portalUrl,
            description: `Ir al portal de ${business.nombre}`,
            id: 'portal',
          },
        ],
      },

      // ── Imagen de hero override a nivel de objeto (refuerza el visual) ───
      // Nota: Google Wallet puede ignorar hero a nivel de objeto si ya está en la clase
      ...(business.banner_url
        ? {
            heroImage: {
              sourceUri: {
                uri: business.banner_url,
              },
              contentDescription: {
                defaultValue: {
                  language: 'es-MX',
                  value: `${business.nombre} — Portada`,
                },
              },
            },
          }
        : {}),
    }

    // ── 8. Construir el payload JWT (Save to Wallet) ──────────────────────
    const jwtPayload = {
      iss: clientEmail,
      aud: 'google',
      typ: 'savetowallet',
      iat: Math.floor(Date.now() / 1000),
      origins: [
        'https://loyaltyclub.mx',
        `https://${business.slug}.loyaltyclub.mx`,
        'http://localhost:3000',
      ],
      payload: {
        loyaltyObjects: [loyaltyObject],
      },
    }

    // ── 9. Firmar el JWT con la private_key del service account ───────────
    const privateKeyObj = await importPKCS8(privateKey, 'RS256')
    const token = await new SignJWT(jwtPayload)
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .sign(privateKeyObj)

    const saveUrl = `https://pay.google.com/gp/v/save/${token}`

    console.log('[GoogleWallet] ✅ URL generada para:', cliente.nombre, '| Negocio:', business.nombre)

    return NextResponse.json({
      url: saveUrl,
      debug: {
        classId,
        objectId,
        business: business.nombre,
        cliente: cliente.nombre,
        sellos: cliente.puntos,
        color: bgColor,
      },
    })
  } catch (error: any) {
    console.error('[GoogleWallet] Error crítico:', error.message, error.stack)
    return NextResponse.json(
      { error: 'Error interno al generar el pase de Google Wallet: ' + error.message },
      { status: 500 }
    )
  }
}