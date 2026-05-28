import { SignJWT, importPKCS8 } from 'jose'
import { NextResponse } from 'next/server'

// ── Constantes del Issuer ──────────────────────────────────────────────────────
const REAL_ISSUER_ID = '3388000000023143249'
const REAL_CLASS_SUFFIX = 'CLASE_BURRERIA'
const LOGO_OFICIAL = 'https://laburreriaclub.vercel.app/logo-burreria.png'

// ── Payload de la Clase de Lealtad ────────────────────────────────────────────
function buildLoyaltyClass(classId: string, siteUrl: string, businessName: string) {
  return {
    id: classId,
    issuerName: businessName || 'La Burrería Club VIP',
    programName: `${businessName || 'La Burrería'} — Club de Lealtad`,
    programLogo: {
      sourceUri: { uri: LOGO_OFICIAL },
      contentDescription: { defaultValue: { language: 'es', value: `Logo ${businessName}` } }
    },
    rewardsTier: 'base',
    rewardsTierLabel: 'Sello',
    reviewStatus: 'UNDER_REVIEW',
    countryCode: 'MX',
    redemptionIssuers: [],
    hexBackgroundColor: '#dc2626',
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          {
            threeItems: {
              startItem: { firstValue: { fields: [{ fieldPath: 'object.loyaltyPoints.balance' }] } },
              middleItem: { firstValue: { fields: [{ fieldPath: 'object.accountName' }] } },
              endItem: { firstValue: { fields: [{ fieldPath: 'object.accountId' }] } }
            }
          }
        ]
      }
    }
  }
}

// ── Helper: obtener token de acceso OAuth2 via JWT de service account ──────────
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
      console.error('[GoogleWallet] OAuth2 token error:', errText)
      return null
    }
    const tokenData = await res.json()
    return tokenData.access_token || null
  } catch (err) {
    console.error('[GoogleWallet] getGoogleAccessToken error:', err)
    return null
  }
}

// ── Helper: verificar/crear la LoyaltyClass de forma autosanable ──────────────
async function asegurarClaseExiste(classId: string, accessToken: string, businessName: string): Promise<boolean> {
  const baseUrl = 'https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass'
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }

  // 1. GET: ¿Existe la clase?
  try {
    const checkRes = await fetch(`${baseUrl}/${encodeURIComponent(classId)}`, {
      method: 'GET',
      headers,
    })
    if (checkRes.ok) {
      console.log('[GoogleWallet] ✅ Clase existente confirmada:', classId)
      return true
    }
    // 404 → la clase no existe, hay que crearla
    if (checkRes.status === 404) {
      console.log('[GoogleWallet] 🔧 Clase no encontrada (404). Creando automáticamente...')
    } else {
      const errText = await checkRes.text()
      console.warn('[GoogleWallet] GET clase error inesperado:', checkRes.status, errText)
      return false
    }
  } catch (err) {
    console.error('[GoogleWallet] Error al verificar clase:', err)
    return false
  }

  // 2. POST: Crear la clase
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://loyaltyapp.vercel.app'
    const clasePayload = buildLoyaltyClass(classId, siteUrl, businessName)
    const createRes = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(clasePayload),
    })
    if (createRes.ok) {
      console.log('[GoogleWallet] ✅ Clase creada exitosamente:', classId)
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

// ── HANDLER PRINCIPAL ─────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const id = body.id || body.clienteId
    const nombre = body.nombre || 'Socio VIP'
    const puntos = body.puntos || 0
    const businessName = body.business_name || 'La Burrería'

    console.log('[GoogleWallet] POST recibido:', { id, nombre, puntos })

    if (!id) {
      return NextResponse.json({ error: 'Falta el ID del cliente' }, { status: 400 })
    }

    // 1. Leer credenciales de entorno de Vercel
    const issuerId = REAL_ISSUER_ID
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    
    // Parseo robusto y seguro de la clave privada de Google
    let rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY || ''
    
    // Sanitizar comillas añadidas por Vercel
    if (rawPrivateKey.startsWith('"') && rawPrivateKey.endsWith('"')) {
      rawPrivateKey = rawPrivateKey.substring(1, rawPrivateKey.length - 1)
    }
    if (rawPrivateKey.startsWith("'") && rawPrivateKey.endsWith("'")) {
      rawPrivateKey = rawPrivateKey.substring(1, rawPrivateKey.length - 1)
    }
    
    // Corregir los escapes de saltos de línea literales
    const privateKey = rawPrivateKey.replace(/\\n/g, '\n').trim()

    const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://loyaltyapp.vercel.app'
    const classId = `${issuerId}.${REAL_CLASS_SUFFIX}`
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase().substring(0, 40)
    const objectId = `${issuerId}.obj_${safeId}`

    // Si no hay credenciales completas → simulación controlada
    if (!clientEmail || !privateKey) {
      console.warn('[GoogleWallet] ⚠️ Sin credenciales de Vercel. Modo simulación.')
      return NextResponse.json({
        url: `/google-wallet-simulacion?id=${id}&nombre=${encodeURIComponent(nombre)}&puntos=${puntos}&business_name=${encodeURIComponent(businessName)}`
      })
    }

    // 2. Obtener Access Token OAuth2
    const accessToken = await getGoogleAccessToken(clientEmail, privateKey)
    if (!accessToken) {
      console.error('[GoogleWallet] No se pudo obtener access token OAuth2')
      return NextResponse.json({ error: 'Error de autenticación con Google Wallet' }, { status: 500 })
    }

    // 3. Asegurar que la LoyaltyClass existe (autosanable)
    const claseOk = await asegurarClaseExiste(classId, accessToken, businessName)
    if (!claseOk) {
      console.warn('[GoogleWallet] No se pudo asegurar la clase. Procediendo sin verificación de clase...')
    }

    // 4. Construir payload JWT para Save to Wallet
    const payload = {
      iss: clientEmail,
      aud: 'google',
      typ: 'savetowallet',
      iat: Math.floor(Date.now() / 1000),
      origins: [SITE_URL, 'http://localhost:3000'],
      payload: {
        loyaltyObjects: [{
          id: objectId,
          classId: classId,
          state: 'ACTIVE',
          accountId: id.substring(0, 12),
          accountName: nombre,
          barcode: {
            type: 'QR_CODE',
            value: `${SITE_URL}/cliente/${id}`,
            alternateText: `ID: ${id.substring(0, 8)}`
          },
          loyaltyPoints: {
            balance: { string: `${puntos}` },
            label: 'Sellos'
          },
          infoModuleData: {
            labelValueRows: [
              {
                columns: [
                  { label: 'Socio', value: nombre },
                  { label: 'Sellos', value: String(puntos) }
                ]
              }
            ]
          }
        }]
      }
    }

    // 5. Firmar JWT con la private_key corregida
    const privateKeyObj = await importPKCS8(privateKey, 'RS256')
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .sign(privateKeyObj)

    const saveUrl = `https://pay.google.com/gp/v/save/${token}`
    console.log('[GoogleWallet] ✅ URL generada exitosamente para cliente:', id)
    return NextResponse.json({ url: saveUrl })

  } catch (error: any) {
    console.error('[GoogleWallet] Error crítico en JWT signature:', error.message)
    return NextResponse.json(
      { error: 'Error al firmar token de Google Wallet: ' + error.message },
      { status: 500 }
    )
  }
}