import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { PKPass } from 'passkit-generator'
import { google } from 'googleapis'
import path from 'path'

// 1. RUTA DE LA LLAVE MAESTRA
// Esta es la ubicación del archivo JSON que descargaste de Google Cloud
const GOOGLE_KEY_PATH = path.join(process.cwd(), 'src/lib/google-key.json');

export async function POST(request: Request) {
  try {
    const { clienteId, platform } = await request.json()

    // 2. CONSULTA A SUPABASE
    // Traemos los datos actualizados del cliente (nombre y sellos) [3, 4]
    const { data: cliente, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', clienteId)
      .single()

    if (error || !cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    // 3. MOTOR DE GOOGLE WALLET
    if (platform === 'google') {
      const auth = new google.auth.GoogleAuth({
        keyFile: GOOGLE_KEY_PATH,
        scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
      });

      // TU CLASS ID GENERADO EN LA CONSOLA
      const classId = '338800000023143249.lealtad_v1'; 
      
      // Definimos el objeto del pase personalizado para el cliente
      const loyaltyObject = {
        id: `${classId}.${cliente.id.replace(/-/g, '_')}`, // ID único para el pase del cliente
        classId: classId,
        state: 'ACTIVE',
        barcode: {
          type: 'QR_CODE',
          value: cliente.id,
        },
        accountId: cliente.id,
        accountName: cliente.nombre,
        loyaltyPoints: {
          label: 'Sellos Acumulados',
          balance: {
            int: cliente.puntos
          }
        },
        // Estética de La Burrería [5, 6]
        secondaryFields: [
          {
            key: 'estatus',
            label: 'NIVEL',
            value: 'MIEMBRO VIP 🤠'
          }
        ]
      };

      return NextResponse.json({ 
        success: true, 
        message: "Motor de Google configurado correctamente",
        classId: classId,
        passData: loyaltyObject
      });
    }

    // 4. MOTOR DE APPLE WALLET (Respaldo)
    if (platform === 'apple') {
      // Esta sección se activará al cargar los certificados .p12 en el servidor [7]
      return NextResponse.json({ 
        success: true, 
        message: "Esperando certificados Apple",
        cliente: cliente.nombre 
      });
    }

  } catch (err) {
    console.error("ERROR CRÍTICO EN MOTOR WALLET:", err);
    return NextResponse.json({ error: 'Error interno en la generación del pase' }, { status: 500 })
  }
}