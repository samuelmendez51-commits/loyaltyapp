import { NextResponse } from 'next/server'
// @ts-ignore
import { Template } from '@walletpass/pass-js'

function formatPem(pemStr: string | undefined) {
  if (!pemStr) return '';
  return pemStr.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').trim();
}

const PASS_TYPE_IDENTIFIER = process.env.APPLE_PASS_TYPE_IDENTIFIER;
const TEAM_IDENTIFIER = process.env.APPLE_TEAM_ID;
const SIGNER_KEY = formatPem(process.env.APPLE_SIGNER_KEY); 
const SIGNER_CERT = formatPem(process.env.APPLE_SIGNER_CERT); 

export async function POST(req: Request) {
  try {
    const { clienteId, nombre, puntos } = await req.json()

    if (!clienteId || !nombre) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

    const template = new Template('storeCard', {
      passTypeIdentifier: PASS_TYPE_IDENTIFIER!,
      teamIdentifier: TEAM_IDENTIFIER!,
      organizationName: 'La Burrería Club',
      description: 'Pase VIP de Fidelidad',
      logoText: 'La Burrería',
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
    
    // --- EL ROMPECANDADOS: Limpieza extrema de la contraseña ---
    let signerPassword = process.env.APPLE_SIGNER_PASSWORD || '';
    signerPassword = signerPassword.replace(/^["']|["']$/g, '').trim();

    if (signerPassword.length > 0) {
      template.setPrivateKey(SIGNER_KEY, signerPassword);
    } else {
      template.setPrivateKey(SIGNER_KEY); // Ahora sí, entra sin contraseña fantasma
    }

    // --- MAGIA DE IMÁGENES ---
    try {
      const LOGO_URL = "https://hjaeireljkcvjnigfhzb.supabase.co/storage/v1/object/public/assets/logo.png";
      const DESTACADA_URL = "https://hjaeireljkcvjnigfhzb.supabase.co/storage/v1/object/public/assets/destacada.jpg";

      const [iconRes, stripRes] = await Promise.all([
        fetch(LOGO_URL),
        fetch(DESTACADA_URL)
      ]);

      if (iconRes.ok) {
        const iconBuffer = Buffer.from(await iconRes.arrayBuffer());
        template.images.add('icon', iconBuffer); 
        template.images.add('logo', iconBuffer); 
      }
      
      if (stripRes.ok) {
        const stripBuffer = Buffer.from(await stripRes.arrayBuffer());
        template.images.add('strip', stripBuffer); 
      }
    } catch (e) {
      console.error("No se pudieron inyectar las imágenes al pase.", e);
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