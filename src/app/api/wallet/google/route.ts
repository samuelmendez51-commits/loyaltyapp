import { SignJWT, importPKCS8 } from 'jose'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const id = body.id || body.clienteId 
    const nombre = body.nombre || "Cliente VIP"
    const puntos = body.puntos || 0

    if (!id) {
      return NextResponse.json({ error: 'Falta el ID del cliente' }, { status: 400 })
    }

    // LEEMOS EXACTAMENTE TUS VARIABLES DEL .ENV.LOCAL
    const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    // Esta línea es clave: traduce los \n de tu archivo a saltos de línea reales para la criptografía
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')

    if (!issuerId || !privateKey || !clientEmail) {
      console.warn("Faltan credenciales. Asegúrate de reiniciar el servidor.")
      return NextResponse.json({ 
        url: `https://pay.google.com/gp/v/save/simulacion_modo_desarrollo_cliente_${id}` 
      })
    }

    const classId = `${issuerId}.burreria_vip_class`
    const objectId = `${issuerId}.${id}`

    const payload = {
      iss: clientEmail,
      aud: 'google',
      typ: 'savetowallet',
      origins: [],
      payload: {
        genericClasses: [{
          id: classId,
          classTemplateInfo: {
            cardTemplateOverride: {
              cardRowTemplateInfos: [{
                twoItems: {
                  startItem: { firstValue: { fields: [{ fieldPath: 'object.textModulesData["puntos"]' }] } },
                  endItem: { firstValue: { fields: [{ fieldPath: 'object.textModulesData["nombre"]' }] } }
                }
              }]
            }
          }
        }],
        genericObjects: [{
          id: objectId,
          classId: classId,
          logo: {
            sourceUri: { uri: 'https://images.unsplash.com/photo-1566805178652-97b7899b360d?auto=format&fit=crop&q=80&w=200&h=200' } // Logo temporal
          },
          cardTitle: {
            defaultValue: { language: 'es', value: 'La Burrería VIP' }
          },
          subheader: {
            defaultValue: { language: 'es', value: 'Cliente Leal' }
          },
          header: {
            defaultValue: { language: 'es', value: nombre }
          },
          textModulesData: [
            { id: 'puntos', header: 'Sellos Acumulados', body: `${puntos} de 10` },
            { id: 'nombre', header: 'ID VIP', body: id.split('-')[0].toUpperCase() }
          ],
          barcode: {
            type: 'QR_CODE',
            value: id,
            alternateText: 'Escanea en mostrador'
          },
          hexBackgroundColor: '#09090b' // Tu color corporativo
        }]
      }
    }

    const privateKeyObj = await importPKCS8(privateKey, 'RS256')
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime('1h') 
      .sign(privateKeyObj)

    const saveUrl = `https://pay.google.com/gp/v/save/${token}`
    return NextResponse.json({ url: saveUrl })

  } catch (error: any) {
    console.error('Error del Servidor:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}