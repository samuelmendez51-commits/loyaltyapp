import { SignJWT, importPKCS8 } from 'jose'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const id = body.id || body.clienteId 
    const nombre = body.nombre || "Socio VIP"
    const puntos = body.puntos || 0

    if (!id) {
      return NextResponse.json({ error: 'Falta el ID del cliente' }, { status: 400 })
    }

    // 1. LEEMOS CREDENCIALES
    const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim()

    if (!issuerId || !privateKey || !clientEmail) {
      console.warn("⚠️ API Google Wallet: Faltan credenciales. Simulando...")
      return NextResponse.json({ 
        url: `https://pay.google.com/gp/v/save/simulacion_modo_desarrollo_cliente_${id}` 
      })
    }

    // 2. IDENTIFICADORES ÚNICOS (Blindados contra mayúsculas y caracteres raros)
    const classId = `${issuerId}.lealtad_v1`
    const objectId = `${issuerId}.${id.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase()}`

    // 3. ESTRUCTURA DE LA TARJETA
    const payload = {
      iss: clientEmail,
      aud: 'google',
      typ: 'savetowallet',
      iat: Math.floor(Date.now() / 1000),
      origins: [process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'],
      payload: {
        loyaltyObjects: [{
          id: objectId,
          classId: classId,
          state: "ACTIVE",
          accountId: id.substring(0, 10),
          accountName: nombre,
          barcode: {
            type: "QR_CODE",
            value: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/cliente/${id}`,
            alternateText: `ID: ${id.substring(0, 8)}`
          },
          loyaltyPoints: {
            balance: { string: `${puntos}` },
            label: "Sellos"
          }
        }]
      }
    }

    // 4. FIRMA DEL TOKEN
    const privateKeyObj = await importPKCS8(privateKey, 'RS256')
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .sign(privateKeyObj)

    // 5. RESPUESTA AL CLIENTE
    const saveUrl = `https://pay.google.com/gp/v/save/${token}`
    return NextResponse.json({ url: saveUrl })

  } catch (error: any) {
    console.error('API Google Wallet Error Detallado:', error)
    return NextResponse.json({ error: 'Fallo la generación del pase de Google' }, { status: 500 })
  }
}