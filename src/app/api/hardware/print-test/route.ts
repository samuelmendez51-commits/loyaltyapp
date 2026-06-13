import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)

function cleanText(text: string): string {
  if (!text) return "";
  return text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

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

function formatItemRow(qty: string, desc: string, price: string, width: number, largeFontItems: boolean): Buffer[] {
  qty = cleanText(qty);
  desc = cleanText(desc);
  price = cleanText(price);

  const is32 = width === 32;
  const colQtyStart = 0;
  const colQtyWidth = 5;
  
  const colPriceWidth = is32 ? 8 : 9;
  const colDescWidth = width - colQtyWidth - colPriceWidth;

  const wrapLimit = largeFontItems ? Math.floor(colDescWidth / 2) : colDescWidth;
  const descLines = wrapText(desc, wrapLimit);
  
  const resultBuffers: Buffer[] = [];

  for (let i = 0; i < descLines.length; i++) {
    const parts: Buffer[] = [];

    if (i === 0) {
      parts.push(Buffer.from(qty.padEnd(colQtyWidth).substring(0, colQtyWidth), 'latin1'));

      if (largeFontItems) {
        parts.push(Buffer.from([0x1B, 0x21, 0x30]));
        const lineDesc = descLines[i].padEnd(wrapLimit).substring(0, wrapLimit);
        parts.push(Buffer.from(lineDesc, 'latin1'));
        parts.push(Buffer.from([0x1B, 0x21, 0x00]));

        const remainingForPrice = width - colQtyWidth - (wrapLimit * 2);
        parts.push(Buffer.from(price.padStart(remainingForPrice).substring(0, remainingForPrice) + '\n', 'latin1'));
      } else {
        const lineDesc = descLines[i].padEnd(colDescWidth).substring(0, colDescWidth);
        parts.push(Buffer.from(lineDesc, 'latin1'));
        parts.push(Buffer.from(price.padStart(colPriceWidth).substring(0, colPriceWidth) + '\n', 'latin1'));
      }
    } else {
      parts.push(Buffer.from(' '.repeat(colQtyWidth), 'latin1'));

      if (largeFontItems) {
        parts.push(Buffer.from([0x1B, 0x21, 0x30]));
        const lineDesc = descLines[i].padEnd(wrapLimit).substring(0, wrapLimit);
        parts.push(Buffer.from(lineDesc, 'latin1'));
        parts.push(Buffer.from([0x1B, 0x21, 0x00]));

        const remainingSpaces = width - colQtyWidth - (wrapLimit * 2);
        parts.push(Buffer.from(' '.repeat(remainingSpaces) + '\n', 'latin1'));
      } else {
        const lineDesc = descLines[i].padEnd(colDescWidth).substring(0, colDescWidth);
        parts.push(Buffer.from(lineDesc, 'latin1'));
        parts.push(Buffer.from(' '.repeat(colPriceWidth) + '\n', 'latin1'));
      }
    }

    resultBuffers.push(Buffer.concat(parts));
  }

  return resultBuffers;
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
      large_font_items,
      tenant
    } = body

    if (!config_impresora) {
      return NextResponse.json(
        { error: 'La dirección o IP de la impresora es requerida' },
        { status: 400 }
      )
    }

    const lineWidth = Number(paper_width) === 32 || paper_width === '58mm' || paper_width === '32' ? 32 : 48;
    const divider = "-".repeat(lineWidth) + "\n";
    const dividerDouble = "=".repeat(lineWidth) + "\n";

    const fechaActual = new Date().toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      dateStyle: 'medium',
      timeStyle: 'medium'
    })

    const parts: Buffer[] = []

    parts.push(Buffer.from([0x1B, 0x40]))
    parts.push(Buffer.from([0x1B, 0x74, 0x10]))
    parts.push(Buffer.from([0x1B, 0x61, 0x01]))

    if (tamano_fuente === 'doble_alto') {
      parts.push(Buffer.from([0x1D, 0x21, 0x01]))
    } else {
      parts.push(Buffer.from([0x1D, 0x21, 0x00]))
    }

    parts.push(Buffer.from(cleanText(centerText("¡CONEXIÓN EXITOSA!", lineWidth)), 'latin1'))
    parts.push(Buffer.from(cleanText(centerText("Loyalty App - Terminal de Cocina", lineWidth)), 'latin1'))
    parts.push(Buffer.from(cleanText(centerText(`Tenant: ${tenant || 'La Burrería'}`, lineWidth)), 'latin1'))
    parts.push(Buffer.from(cleanText(centerText(`Fecha: ${fechaActual}`, lineWidth)), 'latin1'))

    parts.push(Buffer.from([0x1B, 0x61, 0x00]))
    parts.push(Buffer.from([0x1D, 0x21, 0x00]))

    parts.push(Buffer.from(divider, 'latin1'))
    parts.push(Buffer.concat(formatItemRow("CANT", "DESCRIPCIÓN", "IMPORTE", lineWidth, false)))
    parts.push(Buffer.from(divider, 'latin1'))
    parts.push(Buffer.concat(formatItemRow("1", "Burrito Vaquero Grande", "$135.00", lineWidth, !!large_font_items)))
    parts.push(Buffer.concat(formatItemRow("2", "Papas Medianas", "$70.00", lineWidth, !!large_font_items)))
    parts.push(Buffer.concat(formatItemRow("1", "Refresco de Lata", "$25.00", lineWidth, !!large_font_items)))
    parts.push(Buffer.from(divider, 'latin1'))

    let totalLine = "";
    if (lineWidth === 32) {
      totalLine = cleanText("TOTAL:".padStart(24) + "$230.00".padStart(8));
    } else {
      totalLine = cleanText("TOTAL:".padStart(39) + "$230.00".padStart(9));
    }
    parts.push(Buffer.from(totalLine + "\n", 'latin1'))
    parts.push(Buffer.from(dividerDouble, 'latin1'))

    parts.push(Buffer.from("\n\n\n\n", 'latin1'))

    if (tiene_autocorte) {
      parts.push(Buffer.from([0x1D, 0x56, 0x42, 0x00]))
    }

    const finalBuffer = Buffer.concat(parts)

    console.log('\n============= [ESC/POS PRINT TEST] =============')
    console.log(`Tipo de Conexión : ${tipo_impresora || 'wifi'}`)
    console.log(`Dirección / IP   : ${config_impresora}`)
    console.log(`Formato de Papel : ${lineWidth === 32 ? '58mm' : '80mm'} (${lineWidth} columnas)`)
    console.log(`Tamaño de Fuente : ${tamano_fuente || 'normal'}`)
    console.log(`Letra Grande     : ${large_font_items ? 'SÍ' : 'NO'}`)
    console.log(`Enviar Autocorte : ${tiene_autocorte ? 'SÍ' : 'NO'}`)
    console.log('--- Ticket Generado ---')
    console.log(cleanText(centerText("¡CONEXIÓN EXITOSA!", lineWidth)).trimEnd())
    console.log(cleanText(centerText("Loyalty App - Terminal de Cocina", lineWidth)).trimEnd())
    console.log(cleanText(centerText(`Tenant: ${tenant || 'La Burrería'}`, lineWidth)).trimEnd())
    console.log(cleanText(centerText(`Fecha: ${fechaActual}`, lineWidth)).trimEnd())
    console.log(divider.trimEnd())
    
    const logRow = (qty: string, desc: string, price: string, lg: boolean) => {
      const rowBuffers = formatItemRow(qty, desc, price, lineWidth, lg);
      for (const buf of rowBuffers) {
        let str = buf.toString('latin1');
        str = str.replace(/\x1b\x21[\x30\x00]/g, '');
        console.log(str.trimEnd());
      }
    };

    logRow("CANT", "DESCRIPCIÓN", "IMPORTE", false);
    console.log(divider.trimEnd());
    logRow("1", "Burrito Vaquero Grande", "$135.00", !!large_font_items);
    logRow("2", "Papas Medianas", "$70.00", !!large_font_items);
    logRow("1", "Refresco de Lata", "$25.00", !!large_font_items);
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
