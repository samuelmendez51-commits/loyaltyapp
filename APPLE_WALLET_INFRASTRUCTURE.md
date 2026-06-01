# 🍎 Guía Definitiva de Infraestructura para Apple Wallet en Next.js

Esta guía documenta la arquitectura técnica de punta a punta, la configuración criptográfica, el procesamiento dinámico de imágenes y el código de backend necesarios para construir un sistema de pases digitales de fidelización (`.pkpass`) compatible con iOS Safari y la aplicación nativa Apple Wallet.

---

## 🔍 1. Anatomía Criptográfica de un Pase `.pkpass`

Un pase de Apple Wallet no es solo un archivo zip; es un paquete firmado digitalmente que cumple con estrictos estándares de seguridad de Apple. Contiene la siguiente estructura de archivos:

```
pass.pkpass (Formato ZIP renombrado)
├── icon.png & icon@2x.png (Icono para notificaciones y búsquedas)
├── logo.png & logo@2x.png (Logotipo en la cabecera del pase)
├── strip.png & strip@2x.png (Portada / Imagen de fondo del cuerpo del pase)
├── pass.json (Definición de campos, colores, textos, códigos QR y metadatos)
├── manifest.json (Listado de archivos y sus hashes SHA-1)
└── signature (Firma digital PKCS#7 en formato DER binario de 'manifest.json')
```

### El Flujo de Firma Digital
Para que el iPhone acepte el pase en Safari sin mostrar el error *"Safari no puede descargar este archivo"*, la firma debe cumplir esta cadena matemática:
1. Se calculan los hashes de todos los recursos y se escriben en `manifest.json`.
2. Se firma `manifest.json` utilizando tu **Llave Privada** creada a partir del CSR original.
3. Se empaqueta el **Certificado de Pase Público** firmado por Apple (`passTypeID certificate`) junto con el certificado **Apple WWDR G4 CA** intermedio.
4. Si la llave privada no corresponde matemáticamente al certificado de Apple, o si falta el certificado intermedio G4 en el bloque de firma, iOS Safari abortará la descarga de forma segura.

---

## 🛠️ 2. Guía de Configuración en el Apple Developer Portal

Sigue estos pasos exactos desde cero para generar las credenciales de firma:

### Paso 1: Generar la Llave Privada y el CSR (Certificate Signing Request)
Ejecuta este comando con OpenSSL en tu terminal local para generar una llave privada RSA de 2048 bits y la solicitud de firma:
```bash
openssl req -new -nodes -newkey rsa:2048 -keyout llave.pem -out solicitud.csr -subj "/CN=Pass Type ID: pass.com.tunegocio.vip/OU=TUTEAMID/O=Tu Negocio/C=MX"
```
> [!IMPORTANT]
> Guarda el archivo `llave.pem` en un lugar seguro. Esta es tu **llave privada** y nunca debes compartirla ni subirla a repositorios públicos.

### Paso 2: Crear el Pass Type ID en Apple Developer
1. Entra a [Apple Developer Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list).
2. Selecciona **Identifiers** y haz clic en el botón `+` (Añadir).
3. Selecciona **Pass Type IDs**, ponle una descripción y un identificador único (ej: `pass.com.tunegocio.vip`).

### Paso 3: Firmar el Certificado en Apple
1. En la lista de **Pass Type IDs**, haz clic en tu identificador recién creado.
2. Haz clic en **Create Certificate** bajo la sección de certificados.
3. Sube el archivo `solicitud.csr` que generaste en el Paso 1.
4. Haz clic en **Generate** y descarga el archivo resultante: `pass.cer`.

### Paso 4: Descargar el Certificado Apple WWDR G4 CA
Apple requiere incluir el certificado de autoridad de relaciones de desarrollo intermedio.
1. Descarga el **Apple Worldwide Developer Relations Certification Authority G4 (G4)** en formato DER desde: [Apple PKI](https://www.apple.com/certificateauthority/).
2. Guárdalo como `AppleWWDRCAG4.cer`.

### Paso 5: Convertir todo a Formato PEM (Texto plano para Node.js)
Convierte el certificado de Apple de formato binario DER a PEM plano:
```bash
openssl x509 -inform DER -in pass.cer -out pass.pem
openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem
```

---

## 🛡️ 3. Mecanismo de Validación Criptográfica en Tiempo Real

El error más común en producción es que el servidor intente firmar usando una llave incorrecta o un certificado desactualizado (debido a variables de entorno mal configuradas o archivos residuales en el servidor). 

Para solucionar esto de raíz, implementamos una **validación criptográfica estricta de par en tiempo real** antes de generar cualquier pase. Si se detecta un desajuste, el sistema recurre automáticamente a constantes de fallback que coinciden perfectamente:

```typescript
import crypto from 'crypto'

/**
 * Verifica matemáticamente si un certificado PEM público corresponde a una llave privada PEM
 */
function verificarPar(certPem: string, keyPem: string): boolean {
  try {
    if (!certPem || !keyPem || !certPem.includes('BEGIN CERTIFICATE') || !keyPem.includes('BEGIN')) {
      return false
    }
    const cert = crypto.createPublicKey(certPem)
    const key = crypto.createPrivateKey(keyPem)
    const data = Buffer.from('test-signature-data')
    
    // Firma una porción de datos con la llave privada
    const signature = crypto.sign('sha256', data, key)
    
    // Verifica la firma con la clave pública del certificado
    return crypto.verify('sha256', data, cert, signature)
  } catch (e) {
    return false
  }
}
```

---

## 🚀 4. API de Generación de Pases Completa (Next.js & Jimp)

Esta es la implementación del endpoint `GET` en Next.js. El controlador realiza las siguientes operaciones:
1. **Lógica de Carga Híbrida:** Prioriza variables de entorno y archivos locales.
2. **Filtro de Seguridad Activo:** Si el certificado `APPLE_WWDR_CERT` en las variables de entorno es inválido (por ejemplo, si subiste por error el pase del cliente), lo rechaza y usa el de respaldo.
3. **Cribado de Desajustes:** Ejecuta `verificarPar()`. Si hay un desajuste, fuerza el uso coordinado del par de fallback del código.
4. **Diseño dinámico de Portada (Strip Image):** Centra el logotipo del negocio en un lienzo de relación de aspecto 3:1 de forma adaptativa.
5. **Tarjeta de Sellos Virtual Nativa:** Renderiza estrellas rellenas y vacías en un campo auxiliar Unicode.
6. **Integración con Marca:** Aplica colores de marca dinámicos del negocio a las etiquetas.

```typescript
// file:///c:/proyecto/loyaltyapp/src/app/api/wallet/apple/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const { PKPass } = require('passkit-generator')
const JimpModule = require('jimp')
const Jimp = JimpModule.Jimp || JimpModule

// Supabase Setup
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const PASS_TYPE_IDENTIFIER = 'pass.com.tunegocio.vip'
const TEAM_IDENTIFIER = 'R8K4HJ594Q'

// CONSTANTES DE FALLBACK SEGURO
const CERT_FALLBACK = `-----BEGIN CERTIFICATE-----
... (Tu certificado PEM nuevo aquí)
-----END CERTIFICATE-----`

const KEY_FALLBACK = `-----BEGIN PRIVATE KEY-----
... (Tu llave privada PEM nueva aquí)
-----END PRIVATE KEY-----`

const WWDR_FALLBACK = `-----BEGIN CERTIFICATE-----
MIIEVTCCAz2gAwIBAgIUE9x3lVJx5T3GMujM/+Uh88zFztIwDQYJKoZIhvcNAQEL
... (Apple WWDR G4 CA)
-----END CERTIFICATE-----`

function leerCertificados(): { signerCert: string; signerKey: string; wwdrCert: string } {
  let signerCert = ''
  let signerKey = ''
  let wwdrCert = ''

  // 1. Cargar desde Variables de Entorno (Producción Serverless)
  if (process.env.APPLE_WWDR_CERT) {
    const raw = process.env.APPLE_WWDR_CERT.trim()
    wwdrCert = raw.includes('BEGIN') ? raw : Buffer.from(raw, 'base64').toString('utf8')
    
    // Filtro inteligente: rechazar si metieron un pass de cliente en WWDR
    if (wwdrCert) {
      try {
        const x509 = new crypto.X509Certificate(wwdrCert)
        if (x509.subject.includes(PASS_TYPE_IDENTIFIER) || x509.subject.includes('Pass Type ID')) {
          console.warn('[AppleWallet] ⚠️ APPLE_WWDR_CERT inválido detectado en entorno. Descartándolo.')
          wwdrCert = ''
        }
      } catch {}
    }
  }

  if (process.env.APPLE_SIGNER_CERT) {
    const raw = process.env.APPLE_SIGNER_CERT.trim()
    signerCert = raw.includes('BEGIN') ? raw : Buffer.from(raw, 'base64').toString('utf8')
  }

  if (process.env.APPLE_SIGNER_KEY) {
    const raw = process.env.APPLE_SIGNER_KEY.trim()
    signerKey = raw.includes('BEGIN') ? raw : Buffer.from(raw, 'base64').toString('utf8')
  }

  // 2. Cargar desde Archivos Locales (Desarrollo)
  if (!wwdrCert || !signerCert || !signerKey) {
    try {
      const p = (f: string) => path.resolve(process.cwd(), f)
      if (fs.existsSync(p('wwdr.pem')) && !wwdrCert) wwdrCert = fs.readFileSync(p('wwdr.pem'), 'utf8')
      if (fs.existsSync(p('pass.pem')) && !signerCert) signerCert = fs.readFileSync(p('pass.pem'), 'utf8')
      if (fs.existsSync(p('llave.pem')) && !signerKey) signerKey = fs.readFileSync(p('llave.pem'), 'utf8')
    } catch {}
  }

  // 3. Aplicar Fallbacks y Verificación Criptográfica Estricta de Par
  if (!wwdrCert || !wwdrCert.includes('BEGIN CERTIFICATE')) {
    wwdrCert = WWDR_FALLBACK
  }

  if (!signerCert || !signerKey || !verificarPar(signerCert, signerKey)) {
    console.warn('[AppleWallet] ⚠️ Mismatch de firma o llaves faltantes en servidor. Activando fallbacks coordinados.')
    signerCert = CERT_FALLBACK
    signerKey = KEY_FALLBACK
  }

  return { signerCert, signerKey, wwdrCert }
}

async function resizeImage(buffer: Buffer, width: number, height: number, mode: 'cover' | 'contain'): Promise<Buffer> {
  try {
    const image = await Jimp.read(buffer)
    let processed = mode === 'cover' 
      ? image.cover({ w: width, h: height }) 
      : image.contain({ w: width, h: height })

    const res = processed.getBuffer(Jimp.MIME_PNG || "image/png")
    return res && typeof res.then === 'function' ? await res : res
  } catch (err: any) {
    return buffer
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const clienteId = searchParams.get('clienteId')
    if (!clienteId) return new NextResponse('Falta clienteId', { status: 400 })

    // Cargar datos de la BD Supabase
    const { data: cliente } = await supabase.from('clientes').select('*').eq('id', clienteId).maybeSingle()
    if (!cliente) return new NextResponse('Cliente no encontrado', { status: 404 })

    const { data: business } = await supabase.from('businesses').select('*').eq('id', cliente.business_id).maybeSingle()

    const nombre = cliente.nombre
    const puntos = cliente.puntos || 0

    // Conversor Hexadecimal a RGB para mantener colores de marca
    const toRgb = (hex: string, def: string) => {
      if (!hex) return def
      const clean = hex.replace('#', '')
      const parse = (start: number, len: number) => parseInt(clean.substring(start, start + len), 16)
      if (clean.length === 3) return `rgb(${parse(0,1)*17}, ${parse(1,1)*17}, ${parse(2,1)*17})`
      if (clean.length === 6) return `rgb(${parse(0,2)}, ${parse(2,2)}, ${parse(4,2)})`
      return def
    }

    const { signerCert, signerKey, wwdrCert } = leerCertificados()

    // Carga de logotipo base
    const logoPngPath = path.resolve(process.cwd(), 'public/logo.png')
    let baseBuffer = fs.existsSync(logoPngPath) 
      ? fs.readFileSync(logoPngPath) 
      : Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

    if (business?.logo_url) {
      try {
        const logoRes = await fetch(business.logo_url)
        if (logoRes.ok) baseBuffer = Buffer.from(await logoRes.arrayBuffer())
      } catch {}
    }

    // Redimensionamiento de Assets de Imagen
    const passBuffers: Record<string, Buffer> = {
      "icon.png": await resizeImage(baseBuffer, 29, 29, 'cover'),
      "icon@2x.png": await resizeImage(baseBuffer, 58, 58, 'cover'),
      "logo.png": await resizeImage(baseBuffer, 160, 50, 'contain'),
      "logo@2x.png": await resizeImage(baseBuffer, 320, 100, 'contain'),
      "strip.png": await resizeImage(baseBuffer, 375, 123, 'contain'),
      "strip@2x.png": await resizeImage(baseBuffer, 750, 246, 'contain') // Portada Premium
    }

    // Crear tarjeta de estrellas con caracteres Unicode
    const starsString = Array.from({ length: 10 })
      .map((_, i) => i < puntos ? '★' : '☆')
      .join(' ')

    const modelObject = {
      formatVersion: 1,
      passTypeIdentifier: PASS_TYPE_IDENTIFIER,
      teamIdentifier: TEAM_IDENTIFIER,
      organizationName: business ? `${business.nombre} Club` : 'VIP Club',
      description: `Pase VIP — ${business?.nombre || 'VIP'}`,
      logoText: business?.nombre || 'VIP',
      foregroundColor: 'rgb(9, 9, 11)',
      backgroundColor: 'rgb(255, 255, 255)',
      labelColor: toRgb(business?.color_primario, 'rgb(220, 38, 38)'), // Estilo adaptativo
      storeCard: {
        headerFields: [
          { key: 'sellos', label: 'SELLOS', value: String(puntos), textAlignment: 'PKTextAlignmentRight' }
        ],
        primaryFields: [
          { key: 'cliente', label: 'SOCIO VIP', value: nombre }
        ],
        secondaryFields: [
          { key: 'id', label: 'ID DE SOCIO', value: clienteId.substring(0, 8) },
          { key: 'negocio', label: 'NEGOCIO', value: business?.nombre || 'Fidelidad' }
        ],
        auxiliaryFields: [
          { key: 'estrellas', label: 'TARJETA DE SELLOS', value: starsString } // Estrellas nativas
        ],
        backFields: [
          { key: 'info', label: 'CÓMO ACUMULAR', value: 'Presenta tu código QR en caja para acumular sellos.' }
        ]
      },
      barcode: {
        message: clienteId,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
        altText: `ID: ${clienteId.substring(0, 8)}`
      }
    }

    passBuffers["pass.json"] = Buffer.from(JSON.stringify(modelObject))

    const pass = new PKPass(passBuffers, { wwdr: wwdrCert, signerCert, signerKey }, { serialNumber: clienteId })
    const passBuffer = pass.getAsBuffer()

    return new NextResponse(passBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': 'inline; filename="pass.pkpass"',
      },
    })
  } catch (err: any) {
    return new NextResponse(`Error: ${err.message}`, { status: 500 })
  }
}
```

---

## 🛠️ 5. Comandos de Diagnóstico con OpenSSL en Servidores

Guarda estos comandos OpenSSL en tu caja de herramientas para diagnosticar cualquier problema de pases directamente desde la línea de comandos de tu servidor:

### 1. Obtener la "huella dactilar" (Modulus) de una llave o certificado
Para verificar si coinciden, sus módulos hexadecimales deben ser **exactamente idénticos**:
```bash
# Modulus de la Llave Privada
openssl rsa -noout -modulus -in llave.pem | openssl md5

# Modulus del Certificado
openssl x509 -noout -modulus -in pass.pem | openssl md5

# Modulus de la solicitud de firma (CSR)
openssl req -noout -modulus -in solicitud.csr | openssl md5
```

### 2. Verificar la fecha de validez de un certificado
```bash
openssl x509 -noout -dates -in pass.pem
```

### 3. Extraer y leer el contenido del bloque de firma de un `.pkpass` en vivo
```bash
# 1. Descomprimir el pase .pkpass
tar -xf pass.pkpass -C ./unpacked_pass/

# 2. Imprimir los certificados incluidos dentro de la firma digital
openssl pkcs7 -in ./unpacked_pass/signature -inform DER -print_certs -text

# 3. Validar matemáticamente la firma del pase contra su manifiesto
openssl smime -verify -in ./unpacked_pass/signature -inform DER -content ./unpacked_pass/manifest.json -noverify
```
*(Si la respuesta es `Verification successful`, la integridad física y criptográfica de tu pase es impecable).*
