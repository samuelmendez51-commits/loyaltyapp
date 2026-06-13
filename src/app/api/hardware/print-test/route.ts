import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)

function centerText(text: string, width: number): string {
  if (text.length >= width) return text + "\n";
  const pad = Math.floor((width - text.length) / 2);
  return " ".repeat(pad) + text + "\n";
}

function wrapText(text: string, limit: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + (currentLine ? ' ' : '') + word).length <= limit) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word.slice(0, limit);
      let rem = word.slice(limit);
      while (rem.length > limit) {
        lines.push(currentLine);
        currentLine = rem.slice(0, limit);
        rem = rem.slice(limit);
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function replaceAt(str: string, replacement: string, start: number, end: number): string {
  const before = str.substring(0, start);
  const after = str.substring(end);
  const len = end - start;
  const cleanReplacement = replacement.substring(0, len).padEnd(len);
  return before + cleanReplacement + after;
}

function formatItemRow(qty: string, desc: string, discount: string, price: string, width: number): string {
  const is32 = width === 32;
  const colQtyStart = 0;
  const colDescStart = is32 ? 1 : 4;
  const colDescWidth = is32 ? 12 : 25;
  const colDiscStart = is32 ? 13 : 30;
  const colDiscWidth = is32 ? 8 : 8;
  const colPriceStart = is32 ? 21 : 39;
  const colPriceWidth = is32 ? 11 : 9;

  const descLines = wrapText(desc, colDescWidth);
  let result = '';

  for (let i = 0; i < descLines.length; i++) {
    let line = ' '.repeat(width);

    // Cantidad (only on first line)
    if (i === 0) {
      line = replaceAt(line, qty, colQtyStart, colDescStart);
      line = replaceAt(line, discount.padStart(colDiscWidth), colDiscStart, colPriceStart);
      line = replaceAt(line, price.padStart(colPriceWidth), colPriceStart, width);
    }

    line = replaceAt(line, descLines[i], colDescStart, colDescStart + colDescWidth);
    result += line.substring(0, width) + '\n';
  }

  return result;
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      tipo_impresora,
      config_impresora,
      tamano_fuente,
      tiene_autocorte,
      paper_width,
      tenant
    } = body

    if (!config_impresora) {
      return NextResponse.json(
        { error: 'La dirección o IP de la impresora es requerida' },
        { status: 400 }
      )
    }

    // Calcular el ancho de línea
    const lineWidth = paper_width === '58mm' || paper_width === 32 || paper_width === '32' ? 32 : 48;
    const divider = "-".repeat(lineWidth) + "\n";
    const dividerDouble = "=".repeat(lineWidth) + "\n";

    // Obtener la fecha y hora actual en formato legible
    const fechaActual = new Date().toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      dateStyle: 'medium',
      timeStyle: 'medium'
    })

    const parts: Buffer[] = []

    // 1. Inicializar impresora (ESC @) -> 0x1B, 0x40
    parts.push(Buffer.from([0x1B, 0x40]))

    // Seleccionar página de caracteres WPC1252 (ESC t 16) -> 0x1B, 0x74, 0x10
    parts.push(Buffer.from([0x1B, 0x74, 0x10]))

    // 2. Alinear al centro (ESC a 1) -> 0x1B, 0x61, 0x01
    parts.push(Buffer.from([0x1B, 0x61, 0x01]))

    // 3. Ajustar tamaño de fuente (GS ! n)
    if (tamano_fuente === 'doble_alto') {
      parts.push(Buffer.from([0x1D, 0x21, 0x01]))
    } else {
      parts.push(Buffer.from([0x1D, 0x21, 0x00]))
    }

    // Cabecera Centrada
    parts.push(Buffer.from(centerText("¡CONEXIÓN EXITOSA!", lineWidth), 'latin1'))
    parts.push(Buffer.from(centerText("Loyalty App - Terminal de Cocina", lineWidth), 'latin1'))
    parts.push(Buffer.from(centerText(`Tenant: ${tenant || 'La Burrería'}`, lineWidth), 'latin1'))
    parts.push(Buffer.from(centerText(`Fecha: ${fechaActual}`, lineWidth), 'latin1'))

    // Restaurar alineación a la izquierda (ESC a 0) -> 0x1B, 0x61, 0x00
    parts.push(Buffer.from([0x1B, 0x61, 0x00]))
    // Restaurar tamaño de fuente normal
    parts.push(Buffer.from([0x1D, 0x21, 0x00]))

    // Tabla de Artículos
    parts.push(Buffer.from(divider, 'latin1'))
    parts.push(Buffer.from(formatItemRow("C", "Descripción", "Desc.", "Importe", lineWidth), 'latin1'))
    parts.push(Buffer.from(divider, 'latin1'))
    parts.push(Buffer.from(formatItemRow("1", "Burrito Vaquero Grande", "-$15.00", "$135.00", lineWidth), 'latin1'))
    parts.push(Buffer.from(formatItemRow("2", "Papas Medianas", "$0.00", "$70.00", lineWidth), 'latin1'))
    parts.push(Buffer.from(formatItemRow("1", "Refresco de Lata", "$0.00", "$25.00", lineWidth), 'latin1'))
    parts.push(Buffer.from(divider, 'latin1'))

    // Total
    const totalLabel = "TOTAL:";
    const totalVal = "$230.00";
    let totalLine = " ".repeat(lineWidth);
    if (lineWidth === 32) {
      totalLine = replaceAt(totalLine, totalLabel, 13, 21);
      totalLine = replaceAt(totalLine, totalVal.padStart(11), 21, 32);
    } else {
      totalLine = replaceAt(totalLine, totalLabel, 30, 39);
      totalLine = replaceAt(totalLine, totalVal.padStart(9), 39, 48);
    }
    parts.push(Buffer.from(totalLine + "\n", 'latin1'))
    parts.push(Buffer.from(dividerDouble, 'latin1'))

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
    console.log(`Formato de Papel : ${paper_width || '80mm'} (${lineWidth} columnas)`)
    console.log(`Tamaño de Fuente : ${tamano_fuente || 'normal'}`)
    console.log(`Enviar Autocorte : ${tiene_autocorte ? 'SÍ' : 'NO'}`)
    console.log('--- Ticket Generado ---')
    console.log(centerText("¡CONEXIÓN EXITOSA!", lineWidth).trimEnd())
    console.log(centerText("Loyalty App - Terminal de Cocina", lineWidth).trimEnd())
    console.log(centerText(`Tenant: ${tenant || 'La Burrería'}`, lineWidth).trimEnd())
    console.log(centerText(`Fecha: ${fechaActual}`, lineWidth).trimEnd())
    console.log(divider.trimEnd())
    console.log(formatItemRow("C", "Descripción", "Desc.", "Importe", lineWidth).trimEnd())
    console.log(divider.trimEnd())
    console.log(formatItemRow("1", "Burrito Vaquero Grande", "-$15.00", "$135.00", lineWidth).trimEnd())
    console.log(formatItemRow("2", "Papas Medianas", "$0.00", "$70.00", lineWidth).trimEnd())
    console.log(formatItemRow("1", "Refresco de Lata", "$0.00", "$25.00", lineWidth).trimEnd())
    console.log(divider.trimEnd())
    console.log(totalLine.trimEnd())
    console.log(dividerDouble.trimEnd())
    if (tiene_autocorte) {
      console.log("[ Comando Autocorte Enviado: GS V 66 0 ]")
    }
    console.log('--- Hex Dump ---')
    console.log(finalBuffer.toString('hex').match(/.{1,2}/g)?.join(' ') || '')
    console.log('================================================\n')

    if (tipo_impresora === 'red_usb') {
      const tempFilePath = path.join(process.cwd(), 'test_ticket.bin')
      fs.writeFileSync(tempFilePath, finalBuffer)

      try {
        const printerPath = '\\\\127.0.0.1\\' + config_impresora
        const command = `cmd.exe /c copy /b "${tempFilePath}" "${printerPath}"`
        
        await execAsync(command)
        
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath)
        }
        
        return NextResponse.json({
          success: true,
          message: `Impresión física enviada con éxito a ${config_impresora} (USB Compartida)`,
          bytes: finalBuffer.length,
          hex: finalBuffer.toString('hex')
        })
      } catch (cmdError: any) {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath)
        }
        console.error('Fallo en comando de impresión física:', cmdError)
        return NextResponse.json(
          { error: `Error de spooler Windows al copiar a la impresora: ${cmdError.message}` },
          { status: 500 }
        )
      }
    }

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
