import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
// @ts-ignore
import { Template } from '@walletpass/pass-js'
import fs from 'fs'
import path from 'path'

// --- CONFIGURACIÓN DE SEGURIDAD ---
const PASS_TYPE_IDENTIFIER = process.env.APPLE_PASS_TYPE_IDENTIFIER;
const TEAM_IDENTIFIER = process.env.APPLE_TEAM_ID; // CORREGIDO A APPLE_TEAM_ID
const SIGNER_KEY = process.env.APPLE_SIGNER_KEY; 
const SIGNER_CERT = process.env.APPLE_SIGNER_CERT; 
const WWDR_CERT = process.env.APPLE_WWDR_CERT;

export async function POST(req: Request) {
  try {
    const { clienteId, nombre, puntos } = await req.json()

    if (!clienteId || !nombre) {
      return NextResponse.json({ error: 'Faltan datos del cliente' }, { status: 400 })
    }

    if (!SIGNER_KEY || !SIGNER_CERT || !WWDR_CERT) {
      console.warn("⚠️ API Apple Wallet: Faltan certificados. Simulando...");
      return NextResponse.json({ 
        success: true, 
        simulacion: true, 
        mensaje: `⚠️ (Modo Simulación) Pase generado exitosamente para ${nombre}.`
      });
    }

    // 1. Crear el Template
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

    // 2. Inyectar Certificados
    // Reemplazamos los saltos de línea \n literales si es que vienen del .env
    template.setCertificate(SIGNER_CERT.replace(/\\n/g, '\n'));
    template.setPrivateKey(SIGNER_KEY.replace(/\\n/g, '\n'), process.env.APPLE_SIGNER_PASSWORD || '');
    template.setWWDR(WWDR_CERT.replace(/\\n/g, '\n'));

    // 3. INYECTAR LAS IMÁGENES OBLIGATORIAS (El posible causante del error 500)
    // Buscamos tu archivo public/logo.png
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      template.images.add('icon', logoBuffer); // Obligatorio para Apple
      template.images.add('logo', logoBuffer);
    } else {
      console.warn("⚠️ No se encontró logo.png en la carpeta public");
    }

    // 4. Configurar Campos
    template.headerFields.add({ key: 'puntos', label: 'SELLOS', value: puntos || 0, textAlignment: 'pkDataDetectorTypeNone' });
    template.primaryFields.add({ key: 'cliente', label: 'SOCIO VIP', value: nombre });
    template.secondaryFields.add({ key: 'id', label: 'ID DE SOCIO', value: clienteId.substring(0, 8) });

    // 5. Generar Pase
    const pass = template.createPass({
      serialNumber: clienteId,
      authenticationToken: process.env.APPLE_PASS_AUTH_TOKEN || 'secure_token_123456789',
    });

    pass.barcodes = [{
      format: 'PKBarcodeFormatQR',
      message: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/cliente/${clienteId}`, 
      messageEncoding: 'iso-8859-1',
      altText: `ID: ${clienteId.substring(0, 8)}`,
    }];

    // 6. Enviar Buffer
    const passBuffer = await pass.asBuffer();
    const passArray = new Uint8Array(passBuffer);

    return new NextResponse(passArray, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="LaBurreriaVIP-${clienteId.substring(0, 8)}.pkpass"`,
      },
    });

  } catch (error: any) {
    // ESTE CONSOLE.LOG ES EL DETECTIVE
    console.error('API Apple Wallet Error Detallado:', error);
    return NextResponse.json({ error: 'No se pudo generar el pase real' }, { status: 500 })
  }
}