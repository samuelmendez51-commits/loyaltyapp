# 🍎 Guía Definitiva de Infraestructura para Apple Wallet en Next.js

Esta guía documenta la arquitectura técnica de punta a punta, la configuración criptográfica, el motor de procesamiento dinámico de imágenes y el código de backend necesarios para construir un sistema de pases digitales de fidelización (`.pkpass`) compatible con iOS Safari, la aplicación nativa Apple Wallet y sincronizado con Google Wallet.

---

## 🔍 1. Anatomía Criptográfica de un Pase `.pkpass`

Un pase de Apple Wallet no es solo un archivo zip; es un paquete firmado digitalmente que cumple con estrictos estándares de seguridad de Apple. Contiene la siguiente estructura de archivos:

```
pass.pkpass (Formato ZIP renombrado)
├── icon.png & icon@2x.png (Icono para notificaciones y búsquedas)
├── logo.png & logo@2x.png (Logotipo en la cabecera del pase)
├── strip.png & strip@2x.png (Portada / Portada dinámica de estrellas dibujadas)
├── pass.json (Definición de campos, colores, textos, códigos QR y metadatos)
├── manifest.json (Listado de archivos y sus hashes SHA-1)
└── signature (Firma digital PKCS#7 en formato DER binario de 'manifest.json')
```

### El Flujo de Firma Digital
Para que el iPhone acepte el pase en Safari sin mostrar errores de descarga, la firma debe cumplir esta cadena matemática:
1. Se calculan los hashes de todos los recursos y se escriben en `manifest.json`.
2. Se firma `manifest.json` utilizando tu **Llave Privada** creada a partir del CSR original.
3. Se empaqueta el **Certificado de Pase Público** firmado por Apple (`passTypeID certificate`) junto con el certificado **Apple WWDR G4 CA** intermedio.
4. Si la llave privada no corresponde matemáticamente al certificado de Apple, o si falta el certificado intermedio G4 en el bloque de firma, iOS Safari abortará la descarga.

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
Apple requiere incluir el certificado de autoridad de relaciones de desarrollo intermedio G4.
1. Descarga el **Apple Worldwide Developer Relations Certification Authority G4 (G4)** en formato DER desde [Apple PKI](https://www.apple.com/certificateauthority/).
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

## 🚀 4. API de Generación de Pases Premium (Next.js & Jimp)

Esta es la implementación definitiva del endpoint en Next.js. El controlador realiza las siguientes operaciones:
1. **Lógica de Carga Híbrida:** Carga certificados desde variables de entorno Vercel en Base64 o desde archivos del servidor local.
2. **Cribado de Desajustes Criptográficos:** Si detecta discrepancias en llaves, activa el par de fallback.
3. **Motor de Dibujo en Jimp (circular/estrella):** Dibuja geométricamente los sellos circulares sobre la foto de portada. Las estrellas ganadas se colorean en oro metálico y las vacías en gris.
4. **Endpoint Multipropósito `type=strip`:** Si se solicita `type=strip`, sirve directamente la imagen del banner con las estrellas renderizadas para previsualizaciones o para **sincronizar en tiempo real el visual de Google Wallet**.
5. **Esquema de Diseño Ultra-Premium:** Fondo Borgoña Lujoso (`rgb(91, 25, 27)`), textos en Alabastro Alabaster (`rgb(249, 246, 240)`) y etiquetas en Oro Metálico Antiguo (`rgb(212, 175, 55)`).
6. **Validación Joi 100% Exitosa:** Omitimos la llave vacía `logoText` que causaba rechazos en consola y estructuramos el QR bajo el arreglo moderno `barcodes` (plural).

```typescript
// file:///c:/proyecto/loyaltyclub/src/app/api/wallet/apple/route.ts
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

const PASS_TYPE_IDENTIFIER = 'pass.com.laburreria.vip'
const TEAM_IDENTIFIER = 'R8K4HJ594Q'

// ... [Leer certificados y sanitización PEM] ...

// ── Helper: Dibujo geométrico en Jimp ────────────────────────────────
function isPointInPolygon(x: number, y: number, polygon: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1]
    const xj = polygon[j][0], yj = polygon[j][1]
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

function getStarPolygon(cx: number, cy: number, rOuter: number, rInner: number): [number, number][] {
  const points: [number, number][] = []
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2
    const r = i % 2 === 0 ? rOuter : rInner
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)])
  }
  return points
}

async function generateStripImage(bannerBuffer: Buffer | null, puntos: number, maxSellos: number): Promise<Buffer> {
  const width = 750
  const height = 246
  let canvas = bannerBuffer 
    ? (await Jimp.read(bannerBuffer)).cover(width, height)
    : new Jimp({ width, height, color: 0x5B191BFF })

  // Dibujar 10 círculos blancos con bordes y estrellas doradas/grises
  const stampRadius = 24
  const startX = 65, startY = 65, gapX = 80, gapY = 85
  // ... [Algoritmo de dibujo de sellos pixel a pixel usando isPointInPolygon] ...
  
  return await canvas.getBufferAsync(Jimp.MIME_PNG || "image/png")
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const clienteId = searchParams.get('clienteId')
    if (!clienteId) return new NextResponse('Falta clienteId', { status: 400 })

    const { data: cliente } = await supabase.from('clientes').select('*').eq('id', clienteId).maybeSingle()
    if (!cliente) return new NextResponse('Cliente no encontrado', { status: 404 })

    const { data: business } = await supabase.from('businesses').select('*').eq('id', cliente.business_id).maybeSingle()
    const puntos = cliente.puntos || 0
    const maxSellos = business?.max_sellos || 10

    // ── ENDPOINT DIVERGENTE PARA SERVIR LA PORTADA DE ESTRELLAS DIRECTAMENTE ────────
    const type = searchParams.get('type')
    if (type === 'strip') {
      let bannerBuffer = null
      // ... [Descargar banner_url del negocio] ...
      const stripImg = await generateStripImage(bannerBuffer, puntos, maxSellos)
      return new NextResponse(stripImg, {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' }
      })
    }

    // ── CONSTRUCCIÓN DE FORMATO COMPLETO PKPASS ────────
    const { signerCert, signerKey, wwdrCert } = leerCertificados()
    
    // ... [Descargar logos y portadas, y redimensionarlos] ...
    
    const firstName = (cliente.nombre || 'SOCIO').split(' ')[0].toUpperCase()

    const modelObject: any = {
      formatVersion: 1,
      passTypeIdentifier: PASS_TYPE_IDENTIFIER,
      teamIdentifier: TEAM_IDENTIFIER,
      organizationName: business ? `${business.nombre} Club` : 'La Burrería Club',
      description: `Pase VIP — ${business?.nombre}`,
      foregroundColor: 'rgb(249, 246, 240)', // Alabastro
      backgroundColor: 'rgb(91, 25, 27)',     // Borgoña Premium
      labelColor: 'rgb(212, 175, 55)',        // Oro Antiguo
      storeCard: {
        headerFields: [
          { key: 'socio', label: 'SOCIO', value: firstName, textAlignment: 'PKTextAlignmentRight' }
        ],
        secondaryFields: [
          { key: 'totales', label: 'ESTAMPILLAS TOTALES', value: String(maxSellos), textAlignment: 'PKTextAlignmentLeft' },
          { key: 'completadas', label: 'ESTAMPILLAS COMPLETADAS', value: String(puntos), textAlignment: 'PKTextAlignmentRight' }
        ],
        backFields: [
          { key: 'info', label: 'CÓMO ACUMULAR', value: 'Presenta tu código QR en caja para acumular sellos.' }
        ]
      },
      barcodes: [
        {
          message: clienteId,
          format: 'PKBarcodeFormatQR',
          messageEncoding: 'iso-8859-1',
          altText: `ID: ${clienteId.substring(0, 8)}`
        }
      ]
    }

    // ... [Cargar passBuffers, firmar y retornar NextResponse con VND.APPLE.PKPASS] ...
  } catch (err: any) {
    return new NextResponse(`Error: ${err.message}`, { status: 500 })
  }
}
```

---

## 🔗 5. Sincronización en Tiempo Real de Estrellas con Google Wallet

Aprovechando el endpoint de portada PNG dinámico anterior, podemos hacer que **Google Wallet muestre la misma portada de comida con estrellas dibujadas en tiempo real** en lugar de una foto estática sin sellos.

En el backend de Google Wallet (`/api/wallet/google/route.ts`), configura la propiedad `heroImage` del objeto individual del socio (`loyaltyObject`) para que apunte dinámicamente a nuestra API de Apple con un parámetro de versión (`v=puntos`):

```typescript
// Sincronización visual de estrellas en tiempo real
heroImage: {
  sourceUri: {
    uri: `https://${business.slug}.loyaltyclub.mx/api/wallet/apple?clienteId=${cliente.id}&type=strip&v=${cliente.puntos}`,
  },
  contentDescription: {
    defaultValue: {
      language: 'es-MX',
      value: `${business.nombre} — Portada con Sellos`,
    },
  },
}
```
* **¿Cómo funciona?** Cada vez que los puntos del cliente cambian (ej. de 2 a 3), la URL del JWT cambia a `&v=3`. Google Wallet detecta que la URL es un recurso nuevo, descarga el PNG dinámico rediseñado desde nuestro servidor y refresca la tarjeta del socio en Android al instante con las estrellas actualizadas.

---

## 🛠️ 6. Comandos de Diagnóstico con OpenSSL en Servidores

Guarda estos comandos OpenSSL en tu caja de herramientas para diagnosticar cualquier problema de pases directamente desde la línea de comandos de tu servidor:

### 1. Obtener la "huella dactilar" (Modulus) de una llave o certificado
Para verificar si coinciden, sus módulos hexadecimales deben ser **exactamente idénticos**:
```bash
# Modulus de la Llave Privada
openssl rsa -noout -modulus -in llave.pem | openssl md5

# Modulus del Certificado
openssl x509 -noout -modulus -in pass.pem | openssl md5
```

### 2. Extraer y verificar el contenido del bloque de firma de un `.pkpass` en vivo
```bash
# 1. Descomprimir el pase .pkpass
tar -xf pass.pkpass -C ./unpacked_pass/

# 2. Validar matemáticamente la firma del pase contra su manifiesto
openssl smime -verify -in ./unpacked_pass/signature -inform DER -content ./unpacked_pass/manifest.json -noverify
```
*(Si la respuesta es `Verification successful`, la firma digital es matemáticamente impecable).*
