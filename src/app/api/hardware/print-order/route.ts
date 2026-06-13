import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import net from 'net'
import { formatOrderTicket } from '@/utils/printerHelper'

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
  let tempFilePath = ''
  try {
    const body = await req.json()
    const { orderData, config } = body

    if (!orderData || !config) {
      return NextResponse.json(
        { error: 'Datos de pedido y configuración son requeridos' },
        { status: 400 }
      )
    }

    const { config_impresora, tipo_impresora } = config

    if (!config_impresora) {
      return NextResponse.json(
        { error: 'La dirección o IP de la impresora es requerida' },
        { status: 400 }
      )
    }

    const finalBuffer = formatOrderTicket(orderData, config)

    console.log('\n============= [ESC/POS PRINT ORDER] =============')
    console.log(`Folio            : ${orderData.folio || 'N/A'}`)
    console.log(`Tipo de Conexión : ${tipo_impresora || 'wifi'}`)
    console.log(`Dirección / IP   : ${config_impresora}`)
    console.log(`Formato de Papel : ${config.paper_width} columnas`)
    console.log(`Bytes a Enviar   : ${finalBuffer.length}`)
    console.log('================================================\n')

    if (tipo_impresora === 'red_usb') {
      const safeId = String(orderData.id || Date.now()).replace(/[^a-zA-Z0-9]/g, '_')
      tempFilePath = path.join(process.cwd(), `ticket_${safeId}.bin`)
      fs.writeFileSync(tempFilePath, finalBuffer)

      try {
        const printerPath = '\\\\127.0.0.1\\' + config_impresora
        const command = `cmd.exe /c copy /b "${tempFilePath}" "${printerPath}"`
        
        await execAsync(command)
        
        return NextResponse.json({
          success: true,
          message: `Impresión física de orden enviada con éxito a ${config_impresora} (USB Compartida)`,
          bytes: finalBuffer.length,
          hex: finalBuffer.toString('hex')
        })
      } catch (cmdError: any) {
        console.error('Fallo en comando de impresión física de orden:', cmdError)
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
          message: `Impresión física de orden enviada con éxito a la IP ${config_impresora} via TCP (Puerto 9100)`,
          bytes: finalBuffer.length,
          hex: finalBuffer.toString('hex')
        })
      } catch (tcpError: any) {
        console.error('Fallo en conexión TCP de impresora para orden:', tcpError)
        return NextResponse.json(
          { error: `No se pudo conectar a la impresora en la IP ${config_impresora}: ${tcpError.message}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Impresión de orden simulada y registrada con éxito',
      bytes: finalBuffer.length,
      hex: finalBuffer.toString('hex')
    })

  } catch (error: any) {
    console.error('Error en print-order route:', error)
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 })
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath)
      } catch (err) {
        console.error('Error al eliminar archivo temporal de ticket:', err)
      }
    }
  }
}
