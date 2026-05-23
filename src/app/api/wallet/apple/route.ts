import { NextResponse } from 'next/server'
// @ts-ignore
import { Template } from '@walletpass/pass-js'

// --- ESCUDO ANTI-VERCEL PARA CERTIFICADOS ---
// Esta función limpia la variable para que Apple la reconozca perfectamente
function formatPem(pemStr: string | undefined) {
  if (!pemStr) return '';
  return pemStr
    .replace(/^["']|["']$/g, '') // Elimina comillas fantasmas que Vercel pueda agregar
    .replace(/\\n/g, '\n')       // Fuerza los saltos de línea reales
    .trim();                     // Elimina espacios muertos
}

// --- CONFIGURACIÓN DE SEGURIDAD ---
const PASS_TYPE_IDENTIFIER = process.env.APPLE_PASS_TYPE_IDENTIFIER;
const TEAM_IDENTIFIER = process.env.APPLE_TEAM_ID;

// Aquí aplicamos el escudo a tus 3 certificados
const SIGNER_KEY = formatPem(process.env.APPLE_SIGNER_KEY); 
const SIGNER_CERT = formatPem(process.env.APPLE_SIGNER_CERT); 
const WWDR_CERT = formatPem(process.env.APPLE_WWDR_CERT);

export async function POST(req: Request) {
  try {
    const { clienteId, nombre, puntos } = await req.json()

    if (!clienteId || !nombre) {
      return NextResponse.json({ error: 'Faltan datos del cliente' }, { status: 400 })
    }

    if (!SIGNER_KEY || !SIGNER_CERT || !WWDR_CERT) {
      console.warn("⚠️ API Apple Wallet: Faltan certificados. Simulando...");
      return NextResponse.json({ success: true, simulacion: true, mensaje: `⚠️ Simulando pase para ${nombre}` });
    }

    // 1. Crear el Template
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

    // 2. GEOPUSH (El Radar de Notificaciones)
    template.locations = [{
      latitude: 19.421583,
      longitude: -102.067222,
      relevantText: "¡Estás cerca! Pasa por tu Chavipizza a La Burrería."
    }];

    // 3. Inyectar Certificados (Ya purificados)
    template.setCertificate(SIGNER_CERT);
    template.setPrivateKey(SIGNER_KEY, process.env.APPLE_SIGNER_PASSWORD || '');
    template.setWWDR(WWDR_CERT);

    // 4. Inyectar Imágenes (Descarga remota segura)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://laburreriaclub.vercel.app';
      const iconRes = await fetch(`${baseUrl}/logo.png`);
      if (iconRes.ok) {
        const iconBuffer = Buffer.from(await iconRes.arrayBuffer());
        template.images.add('icon', iconBuffer);
        template.images.add('logo', iconBuffer);
      }
    } catch (e) {
      console.error("⚠️ No se pudo cargar el logo remoto, generando sin logo...", e);
    }

    // 5. Configurar Campos
    template.headerFields.add({ key: 'puntos', label: 'SELLOS', value: String(puntos || 0), textAlignment: 'pkTextAlignmentRight' });
    template.primaryFields.add({ key: 'cliente', label: 'SOCIO VIP', value: nombre });
    template.secondaryFields.add({ key: 'id', label: 'ID DE SOCIO', value: clienteId.substring(0, 8) });

    // 6. Generar Pase
    const pass = template.createPass({
      serialNumber: clienteId,
      authenticationToken: process.env.APPLE_PASS_AUTH_TOKEN || 'secure_token_123456789',
    });

    pass.barcodes = [{
      format: 'PKBarcodeFormatQR',
      message: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://laburreriaclub.vercel.app'}/cliente/${clienteId}`, 
      messageEncoding: 'iso-8859-1',
      altText: `ID: ${clienteId.substring(0, 8)}`,
    }];

    const passBuffer = await pass.asBuffer();

    return new NextResponse(passBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="LaBurreriaVIP-${clienteId.substring(0, 8)}.pkpass"`,
      },
    });

  } catch (error: any) {
    console.error('API Apple Wallet Error Detallado:', error);
    return NextResponse.json({ error: 'No se pudo generar el pase' }, { status: 500 })
  }
}