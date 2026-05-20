import { SignJWT, importPKCS8 } from 'jose'
import { NextResponse } from 'next/server'

// 1. Cambiamos Promise<NextResponse> por Promise<Response> (Next.js lo prefiere así)
export async function POST(req: Request): Promise<Response> {
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

    // Apuntamos a la clase que creaste en la consola
    const classId = `${issuerId}.lealtad_v1`
    const objectId = `${issuerId}.${id.replace(/[^a-zA-Z0-9_-]/g, '')}` 

    const payload = {
      iss: clientEmail,
      aud: 'google',
      typ: 'savetowallet',
      origins: ['http://localhost:3000', 'https://lealtad-burreria.vercel.app'], 
      payload: {
        loyaltyObjects: [{
          id: objectId,
          classId: classId,
          state: 'ACTIVE',
          accountId: id,
          accountName: nombre,
          barcode: {
            type: 'QR_CODE',
            value: id,
            alternateText: 'Escanea en mostrador'
          },
          loyaltyPoints: {
            balance: { string: String(puntos) },
            label: 'Sellos Acumulados'
          }
        }]
      }
    }

    const privateKeyObj = await importPKCS8(privateKey, 'RS256')
    
    // 2. Agregamos "as any" para que la librería jose no marque advertencia naranja
    const token = await new SignJWT(payload as any)
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