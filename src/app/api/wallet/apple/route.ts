// @ts-nocheck
import { NextResponse } from 'next/server';
const { PKPass } = require('passkit-generator');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { clienteId, nombre, puntos } = body;

    // Validación de variables de entorno (Deben estar configuradas en Vercel)
    if (!process.env.APPLE_SIGNER_CERT || !process.env.APPLE_SIGNER_KEY || !process.env.APPLE_WWDR_CERT) {
      throw new Error("Credenciales de Wallet no configuradas en el servidor.");
    }

    // Decodificación de certificados desde Base64 (sin tocar archivos físicos)
    const getBuffer = (envVar: string) => Buffer.from(process.env[envVar] || '', 'base64');

    const passCert = getBuffer('APPLE_SIGNER_CERT');
    const keyCert = getBuffer('APPLE_SIGNER_KEY');
    const wwdrCert = getBuffer('APPLE_WWDR_CERT');

    // Configuración del Pass
    const pass = new PKPass({
      format: 'wallet',
      certificates: {
        wwdr: wwdrCert,
        signerCert: passCert,
        signerKey: keyCert,
      },
    });

    // Identificadores (Asegúrate de que coincidan con tu Apple Developer Portal)
    pass.setPassTypeIdentifier('pass.com.laburreria.vip');
    pass.setTeamIdentifier('R8K4HJ594Q');
    pass.setOrganizationName('La Burrería Club');
    pass.setPassDescription('Tarjeta de Lealtad VIP');
    pass.setLogoText('La Burrería');
    pass.setBackgroundColor('rgb(0, 0, 0)'); // Estética oscura Pro

    // Inyección de datos dinámicos
    pass.addGenericPass({
      primaryFields: [{ key: 'puntos', label: 'SELLOS', value: `${puntos || 0}` }],
      secondaryFields: [{ key: 'nombre', label: 'CLIENTE', value: nombre || 'VIP' }]
    });

    const buffer = await pass.getAsBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="pase-${clienteId}.pkpass"`
      }
    });

  } catch (error: any) {
    console.error('--- ERROR CRÍTICO EN WALLET API ---', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}