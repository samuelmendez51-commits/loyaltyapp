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

    const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')

    if (!issuerId || !privateKey || !clientEmail) {
      return NextResponse.json({ 
        url: `https://pay.google.com/gp/v/save/simulacion_modo_desarrollo_cliente_${id}` 
      })
    }

    // Le ponemos _v3 para que Google borre su caché y acepte el diseño nuevo
    const classId = `${issuerId}.burreria_vip_class_v3`
    const objectId = `${issuerId}.${id}`

    const payload = {
      iss: clientEmail,
      aud: 'google',
      typ: 'savetowallet',
      origins: [],
      payload: {
        // 1. LA CLASE (El molde general de La Burrería)
        genericClasses: [{
          id: classId,
          issuerName: 'La Burrería', // <-- CAMPO ESTRICTAMENTE OBLIGATORIO AQUÍ
          classTemplateInfo: {
            cardTemplateOverride: {
              cardRowTemplateInfos: [{
                twoItems: {
                  startItem: { firstValue: { fields: [{ fieldPath: 'object.textModulesData["puntos"]' }] } },
                  endItem: { firstValue: { fields: [{ fieldPath: 'object.textModulesData["info"]' }] } }
                }
              }]
            }
          }
        }],
        // 2. EL OBJETO (La tarjeta única de tu cliente)
        genericObjects: [{
          id: objectId,
          classId: classId,
          logo: {
            sourceUri: { uri: 'https://ui-avatars.com/api/?name=LB&background=dc2626&color=fff&size=512' }
          },
          heroImage: {
            sourceUri: { uri: 'https://images.unsplash.com/photo-1626700051175-1053100f1d21?q=80&w=1000&auto=format&fit=crop' }
          },
          cardTitle: {
            defaultValue: { language: 'es', value: 'LA BURRERÍA VIP' }
          },
          subheader: {
            defaultValue: { language: 'es', value: 'CLIENTE LEAL' }
          },
          header: {
            defaultValue: { language: 'es', value: nombre.toUpperCase() }
          },
          textModulesData: [
            { id: 'puntos', header: 'SELLOS ACUMULADOS', body: `${puntos} de 10 ★` },
            { id: 'info', header: 'ID VIP', body: id.split('-')[0].toUpperCase() }
          ],
          barcode: {
            type: 'QR_CODE',
            value: id,
            alternateText: 'Escanea en el mostrador'
          },
          hexBackgroundColor: '#09090b' // Fondo oscuro elegante
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