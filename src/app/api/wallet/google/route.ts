import { SignJWT, importPKCS8 } from 'jose'
import { NextResponse } from 'next/server'

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json()
    const id = String(body.id || body.clienteId || '')
    const nombre = String(body.nombre || 'Cliente VIP')
    const puntos = Number(body.puntos || 0)

    if (!id) {
      return NextResponse.json({ error: 'Falta ID' }, { status: 400 })
    }

    const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    
    const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY || ''
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n')

    if (!issuerId || !privateKey || !clientEmail) {
      return NextResponse.json({ error: 'Credenciales incompletas en el servidor' }, { status: 500 })
    }

    // CAMBIAMOS A V6 PARA BURLAR EL CACHÉ DE GOOGLE OTRA VEZ
    const classId = `${issuerId}.burreria_vip_class_v6`
    const objectId = `${issuerId}.${id}`

    const payload = {
      iss: clientEmail,
      aud: 'google',
      typ: 'savetowallet',
      // CORRECCIÓN 1: Origins es obligatorio para que Google no bloquee el pase
      origins: ['http://localhost:3000', 'https://lealtad-burreria.vercel.app'], 
      payload: {
        genericClasses: [{
          id: classId,
          // CORRECCIÓN 2: Omitir esto hace que Google rechace la clase silenciosamente
          issuerName: 'La Burrería', 
          classTemplateInfo: {
            cardTemplateOverride: {
              cardRowTemplateInfos: [{
                twoItems: {
                  startItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['puntos']" }] } },
                  endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['nombre']" }] } }
                }
              }]
            }
          }
        }],
        genericObjects: [{
          id: objectId,
          classId: classId,
          cardTitle: { defaultValue: { language: 'es', value: 'La Burrería VIP' } },
          header: { defaultValue: { language: 'es', value: nombre } },
          textModulesData: [
            { id: 'puntos', header: 'Sellos Acumulados', body: `${puntos} de 10` },
            { id: 'nombre', header: 'ID VIP', body: id.split('-')[0].toUpperCase() }
          ],
          barcode: { type: 'QR_CODE', value: id },
          hexBackgroundColor: '#09090b'
        }]
      }
    }

    const privateKeyObj = await importPKCS8(privateKey, 'RS256')
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKeyObj)

    return NextResponse.json({ url: `https://pay.google.com/gp/v/save/${token}` })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido en el servidor';
    console.error("Error al generar pase:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}