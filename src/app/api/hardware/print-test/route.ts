import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      tipo_impresora,
      config_impresora,
      tamano_fuente,
      tiene_autocorte,
      tenant
    } = body

    if (!config_impresora) {
      return NextResponse.json(
        { error: 'La dirección o IP de la impresora es requerida' },
        { status: 400 }
      )
    }

    // Obtener la fecha y hora actual en formato legible
    const fechaActual = new Date().toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      dateStyle: 'medium',
      timeStyle: 'medium'
    })

    const parts: Buffer[] = []

    // 1. Inicializar impresora (ESC @) -> 0x1B, 0x40
    parts.push(Buffer.from([0x1B, 0x40]))

    // 2. Alinear al centro (ESC a 1) -> 0x1B, 0x61, 0x01
    parts.push(Buffer.from([0x1B, 0x61, 0x01]))

    // 3. Ajustar tamaño de fuente (GS ! n)
    if (tamano_fuente === 'doble_alto') {
      // 0x01 para doble altura (o 0x11 para doble altura y doble ancho)
      parts.push(Buffer.from([0x1D, 0x21, 0x01]))
    } else {
      // 0x00 para fuente normal
      parts.push(Buffer.from([0x1D, 0x21, 0x00]))
    }

    // 4. Agregar contenido de texto (en codificación latin1 para compatibilidad de caracteres como ¡ o ó)
    parts.push(Buffer.from("-----------------------------------------\n", 'latin1'))
    parts.push(Buffer.from("¡CONEXIÓN EXITOSA!\n", 'latin1'))
    parts.push(Buffer.from("Loyalty App - Terminal de Cocina\n", 'latin1'))
    parts.push(Buffer.from(`Tenant: ${tenant || 'La Burrería'}\n`, 'latin1'))
    parts.push(Buffer.from(`Fecha: ${fechaActual}\n`, 'latin1'))
    parts.push(Buffer.from("-----------------------------------------\n", 'latin1'))

    // 5. Avance de papel antes del corte (típicamente 4 líneas)
    parts.push(Buffer.from("\n\n\n\n", 'latin1'))

    // 6. Guillotina / Autocorte si está habilitado (GS V 66 0) -> 0x1D, 0x56, 0x42, 0x00
    if (tiene_autocorte) {
      parts.push(Buffer.from([0x1D, 0x56, 0x42, 0x00]))
    }

    const finalBuffer = Buffer.concat(parts)

    // Log en la consola del servidor
    console.log('\n============= [ESC/POS PRINT TEST] =============')
    console.log(`Tipo de Conexión : ${tipo_impresora || 'wifi'}`)
    console.log(`Dirección / IP   : ${config_impresora}`)
    console.log(`Tamaño de Fuente : ${tamano_fuente || 'normal'}`)
    console.log(`Enviar Autocorte : ${tiene_autocorte ? 'SÍ' : 'NO'}`)
    console.log('--- Ticket Generado ---')
    console.log("-----------------------------------------")
    console.log("¡CONEXIÓN EXITOSA!")
    console.log("Loyalty App - Terminal de Cocina")
    console.log(`Tenant: ${tenant || 'La Burrería'}`)
    console.log(`Fecha: ${fechaActual}`)
    console.log("-----------------------------------------")
    if (tiene_autocorte) {
      console.log("[ Comando Autocorte Enviado: GS V 66 0 ]")
    }
    console.log('--- Hex Dump ---')
    console.log(finalBuffer.toString('hex').match(/.{1,2}/g)?.join(' ') || '')
    console.log('================================================\n')

    return NextResponse.json({
      success: true,
      message: 'Impresión de prueba simulada y registrada con éxito',
      bytes: finalBuffer.length,
      hex: finalBuffer.toString('hex')
    })

  } catch (error: any) {
    console.error('Error en print-test route:', error)
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 })
  }
}
