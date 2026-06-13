import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import net from 'net'
import { formatOrderTicket, cleanText, centerText, wrapText, formatItemRow } from '@/utils/printerHelper'

const execAsync = promisify(exec)

function printViaTcp(ip: string, buffer: Buffer, port: number = 9100): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.setTimeout(5000);
    
    client.connect(port, ip, () => {
      client.write(buffer, () => {
        client.end();
        resolve();
      });
    });

    client.on('error', (err) => {
      client.destroy();
      reject(err);
    });

    client.on('timeout', () => {
      client.destroy();
      reject(new Error('Tiempo de espera agotado al conectar a la impresora por red local'));
    });
  });
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

    const orderData = {
      title: "LOYALTY APP - TERMINAL DE COCINA",
      subtitle: "CONEXION EXITOSA!",
      tenant: tenant || 'LA BURRERÍA',
      fecha: fechaActual,
      folio: "0001",
      cliente: "CLIENTE DE PRUEBA",
      servicio: "TEST DE HARDWARE",
      items: [
        { qty: "1", name: "Burrito Vaquero Grande", price: "$135.00", notes: "Sin cebolla" },
        { qty: "2", name: "Papas Medianas", price: "$70.00" },
        { qty: "1", name: "Refresco de Lata", price: "$25.00" }
      ],
      total: "$230.00"
    }

    const config = {
      paper_width: lineWidth,
      large_font_items: !!large_font_items,
      tiene_autocorte: !!tiene_autocorte,
      fontSize: tamano_fuente === 'doble_alto' ? 'DOBLE_ALTO' : 'NORMAL'
    }

    const finalBuffer = formatOrderTicket(orderData, config)

    console.log('\n============= [ESC/POS PRINT TEST] =============')
    console.log(`Tipo de Conexión : ${tipo_impresora || 'wifi'}`)
    console.log(`Dirección / IP   : ${config_impresora}`)
    console.log(`Formato de Papel : ${lineWidth === 32 ? '58mm' : '80mm'} (${lineWidth} columnas)`)
    console.log(`Tamaño de Fuente : ${tamano_fuente || 'normal'}`)
    console.log(`Letra Grande     : ${large_font_items ? 'SÍ' : 'NO'}`)
    console.log(`Enviar Autocorte : ${tiene_autocorte ? 'SÍ' : 'NO'}`)
    console.log('--- Ticket Generado ---')
    console.log(cleanText(centerText(orderData.subtitle, lineWidth)).trimEnd())
    console.log(cleanText(centerText(orderData.title, lineWidth)).trimEnd())
    console.log(cleanText(centerText("TENANT: " + orderData.tenant, lineWidth)).trimEnd())
    console.log(cleanText(centerText("FECHA: " + orderData.fecha, lineWidth)).trimEnd())
    console.log("\n" + cleanText("FOLIO: #" + orderData.folio))
    console.log(cleanText("CLIENTE: " + orderData.cliente))
    console.log(cleanText("SERVICIO: " + orderData.servicio))
    console.log(divider.trimEnd())
    
    const logRow = (qty: string, desc: string, price: string, lg: boolean) => {
      const rowBuffers = formatItemRow(qty, desc, price, lineWidth, lg, tamano_fuente);
      for (const buf of rowBuffers) {
        let str = buf.toString('latin1');
        str = str.replace(/\x1b\x21[\x30\x00]/g, '');
        console.log(str.trimEnd());
      }
    };

    logRow("CANT", "DESCRIPCIÓN", "IMPORTE", false);
    console.log(divider.trimEnd());
    for (const item of orderData.items) {
      logRow(item.qty, item.name, item.price, !!large_font_items);
      if (item.notes) {
        const cleanNotes = cleanText(item.notes);
        const notesLines = wrapText(cleanNotes, lineWidth - 7);
        for (let j = 0; j < notesLines.length; j++) {
          const prefix = j === 0 ? "     * " : "       ";
          console.log((prefix + notesLines[j]).trimEnd());
        }
      }
    }
    console.log(divider.trimEnd())
    const colPriceWidth = lineWidth === 32 ? 8 : 9;
    const colLabelWidth = lineWidth - colPriceWidth;
    const totalLine = cleanText("TOTAL:".padStart(colLabelWidth) + orderData.total.padStart(colPriceWidth));
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
    } else if (tipo_impresora === 'wifi') {
      try {
        await printViaTcp(config_impresora, finalBuffer)
        return NextResponse.json({
          success: true,
          message: `Impresión física enviada con éxito a la IP ${config_impresora} via TCP (Puerto 9100)`,
          bytes: finalBuffer.length,
          hex: finalBuffer.toString('hex')
        })
      } catch (tcpError: any) {
        console.error('Fallo en conexión TCP de impresora:', tcpError)
        return NextResponse.json(
          { error: `No se pudo conectar a la impresora en la IP ${config_impresora}: ${tcpError.message}` },
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
