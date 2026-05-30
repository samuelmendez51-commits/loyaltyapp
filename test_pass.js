const { PKPass } = require('passkit-generator')
const fs = require('fs')
const path = require('path')

const PASS_TYPE_IDENTIFIER = 'pass.com.laburreria.vip'
const TEAM_IDENTIFIER = 'R8K4HJ594Q'

async function test() {
  console.log("Testing Apple Wallet pass generation via PKPass constructor (omitting passphrase)...")
  try {
    const wwdrPath = path.resolve(process.cwd(), 'wwdr.pem')
    const passPemPath = path.resolve(process.cwd(), 'pass.pem')
    const llavePemPath = path.resolve(process.cwd(), 'llave.pem')
    const logoPngPath = path.resolve(process.cwd(), 'public/logo.png')

    const wwdrCert = fs.readFileSync(wwdrPath, 'utf8')
    const signerCert = fs.readFileSync(passPemPath, 'utf8')
    const signerKey = fs.readFileSync(llavePemPath, 'utf8')
    const logoBuffer = fs.readFileSync(logoPngPath)

    const modelObject = {
      formatVersion: 1,
      passTypeIdentifier: PASS_TYPE_IDENTIFIER,
      teamIdentifier: TEAM_IDENTIFIER,
      organizationName: 'La Burrería Club',
      description: 'Pase VIP de Fidelidad La Burrería',
      logoText: 'La Burrería',
      foregroundColor: 'rgb(9, 9, 11)',
      backgroundColor: 'rgb(255, 255, 255)',
      labelColor: 'rgb(220, 38, 38)',
      storeCard: {
        headerFields: [
          { key: 'sellos', label: 'SELLOS', value: '1', textAlignment: 'PKTextAlignmentRight' }
        ],
        primaryFields: [
          { key: 'cliente', label: 'SOCIO VIP', value: 'Samuel Méndez' }
        ],
        secondaryFields: [
          { key: 'id', label: 'ID DE SOCIO', value: 'test1234' },
          { key: 'negocio', label: 'NEGOCIO', value: 'La Burrería' }
        ],
        backFields: [
          { key: 'info', label: 'CÓMO ACUMULAR', value: 'Presenta tu código QR en cada visita para acumular sellos.' }
        ]
      },
      barcode: {
        message: 'test-serial-1234',
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
        altText: 'ID: test-serial-1234'
      }
    }

    const pass = new PKPass({
      "pass.json": Buffer.from(JSON.stringify(modelObject)),
      "icon.png": logoBuffer,
      "icon@2x.png": logoBuffer,
      "logo.png": logoBuffer,
      "logo@2x.png": logoBuffer
    },
    {
      wwdr: wwdrCert,
      signerCert: signerCert,
      signerKey: signerKey
      // Omit signerKeyPassphrase since there is no passphrase
    },
    {
      serialNumber: 'test-serial-1234',
      webServiceURL: 'https://laburreria.loyaltyclub.mx',
      authenticationToken: 'secure_token_test'
    })

    const buffer = pass.getAsBuffer()
    console.log("SUCCESS! Generated pass buffer length:", buffer.length)
  } catch (err) {
    console.error("ERROR generating pass:", err)
  }
}

test()
