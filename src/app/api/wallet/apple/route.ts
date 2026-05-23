import { NextResponse } from 'next/server'
// @ts-ignore
import { Template } from '@walletpass/pass-js'

// --- REPARADOR EXTREMO DE CERTIFICADOS PARA VERCEL ---
function formatPem(pemStr: string | undefined) {
  if (!pemStr) return '';
  let clean = pemStr.replace(/^["']|["']$/g, ''); // Quita comillas
  
  // Si Vercel guardó el literal "\n", lo convertimos a salto real
  if (clean.includes('\\n')) {
    clean = clean.replace(/\\n/g, '\n');
  } else if (!clean.includes('\n')) {
    // Si Vercel lo hizo todo una sola línea, intentamos reconstruirlo (Magia negra)
    clean = clean.replace(/(-----BEGIN[^-]+-----)(.+?)(-----END[^-]+-----)/g, (match, p1, p2, p3) => {
      const body = p2.replace(/\s+/g, ''); // Quitamos espacios
      const lines = body.match(/.{1,64}/g)?.join('\n') || body; // Cortamos cada 64 caracteres
      return `${p1}\n${lines}\n${p3}`;
    });
  }
  return clean.trim();
}

const PASS_TYPE_IDENTIFIER = process.env.APPLE_PASS_TYPE_IDENTIFIER;
const TEAM_IDENTIFIER = process.env.APPLE_TEAM_ID;
const SIGNER_KEY = formatPem(process.env.APPLE_SIGNER_KEY); 
const SIGNER_CERT = formatPem(process.env.APPLE_SIGNER_CERT); 
const WWDR_CERT = formatPem(process.env.APPLE_WWDR_CERT);

export async function POST(req: Request) {
  try {
    const { clienteId, nombre, puntos } = await req.json()

    if (!clienteId || !nombre) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

    const template = new Template('storeCard', {
      passTypeIdentifier: PASS_TYPE_IDENTIFIER!,
      teamIdentifier: TEAM_IDENTIFIER!,
      organizationName: 'La Burrería Club',
      description: 'Pase VIP de Fidelidad',
      logoText: 'La Burrería VIP',
      backgroundColor: '#0a0a0a',
      foregroundColor: '#ffffff',
      labelColor: '#d4af37',
    });

    template.locations = [{
      latitude: 19.421583,
      longitude: -102.067222,
      relevantText: "¡Estás cerca! Pasa por tu Chavipizza a La Burrería."
    }];

    template.setCertificate(SIGNER_CERT);
    template.setPrivateKey(SIGNER_KEY, process.env.APPLE_SIGNER_PASSWORD || '');
    template.setWWDR(WWDR_CERT);

    // --- CARGA DE IMAGEN REAL DESDE TU SUPABASE ---
    try {
      const LOGO_URL = "https://hjaeireljkcvjnigfhzb.supabase.co/storage/v1/object/public/assets/logo.png";
      const iconRes = await fetch(LOGO_URL);
      if (iconRes.ok) {
        const iconBuffer = Buffer.from(await iconRes.arrayBuffer());
        template.images.add('icon', iconBuffer);
        template.images.add('logo', iconBuffer);
      }
    } catch (e) {
      console.error("No se pudo cargar el logo:", e);
    }

    template.headerFields.add({ key: 'puntos', label: 'SELLOS', value: String(puntos || 0), textAlignment: 'pkTextAlignmentRight' });
    template.primaryFields.add({ key: 'cliente', label: 'SOCIO VIP', value: nombre });
    template.secondaryFields.add({ key: 'id', label: 'ID DE SOCIO', value: clienteId.substring(0, 8) });

    const pass = template.createPass({
      serialNumber: clienteId,
      authenticationToken: process.env.APPLE_PASS_AUTH_TOKEN || 'secure_token_123456789',
    });

    pass.barcodes = [{
      format: 'PKBarcodeFormatQR',
      message: `https://laburreriaclub.vercel.app/cliente/${clienteId}`, 
      messageEncoding: 'iso-8859-1',
      altText: `ID: ${clienteId.substring(0, 8)}`,
    }];

    const passBuffer = await pass.asBuffer();

    return new NextResponse(passBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="VIP-${clienteId}.pkpass"`,
      },
    });

  } catch (error: any) {
    console.error('API Apple Wallet Error Detallado:', error);
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}