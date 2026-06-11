# 🤖 Guía Definitiva de Infraestructura para Google Wallet en Next.js

Esta guía documenta de punta a punta la arquitectura técnica, la integración con las APIs de Google, el flujo de firmas criptográficas de tokens JWT y la configuración del entorno para habilitar de forma nativa la adición de pases de fidelización ("Save to Google Wallet") en dispositivos Android y la web.

---

## 🔍 1. Arquitectura Técnica de Google Wallet

A diferencia del formato cerrado de Apple (`.pkpass`), Google Wallet funciona mediante un **modelo basado en la nube**. Los pases no se descargan como archivos físicos ZIP; en su lugar, se representan mediante una relación entre dos entidades administradas a través de las APIs REST de Google:

### La Relación de Clases y Objetos

```
           [ Google Pay & Wallet Console ]
                         │
                         ▼
        ┌──────────────────────────────────┐
        │  LoyaltyClass (Plantilla base)   │  <── Creada una vez por negocio/slug
        │  - Logotipo del comercio         │
        │  - Portada (Hero Image)          │
        │  - Color de fondo del pase       │
        │  - Estructura de campos y slots  │
        └─────────────────┬────────────────┘
                          │
                          ▼  (1 a N)
        ┌──────────────────────────────────┐
        │  LoyaltyObject (Instancia socio) │  <── Creada de forma dinámica por cliente
        │  - ID único del socio            │
        │  - Nombre completo del socio     │
        │  - Código QR del socio           │
        │  - Saldo acumulado (Sellos)      │
        └──────────────────────────────────┘
```

1. **`LoyaltyClass`:** Es el molde común. Define la marca visual del comercio (nombre, colores, logotipos, imagen destacada e información general). Cada negocio tiene su propia clase identificada como `[ISSUER_ID].[CLASS_SUFFIX]`.
2. **`LoyaltyObject`:** Es la tarjeta personalizada del usuario. Contiene el nombre del cliente, su saldo de sellos actual, su código de barras (QR) y metadatos específicos. Se identifica como `[ISSUER_ID].[OBJECT_SUFFIX]`.

---

## 🛠️ 2. Guía de Configuración en Google Cloud & Wallet Console

Sigue estos pasos en orden para habilitar los permisos y credenciales necesarios:

### Paso 1: Crear un proyecto en Google Cloud Console
1. Accede a [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un nuevo proyecto (ej: `mineral-silicon-496400-a0`).
3. Busca **Google Wallet API** en el buscador superior y haz clic en **Habilitar (Enable)**.

### Paso 2: Crear la Cuenta de Servicio (Service Account)
1. Ve a **IAM & Admin > Service Accounts**.
2. Haz clic en **Create Service Account** en la barra superior.
3. Asígnale un nombre descriptivo (ej: `burreria-wallet-motor`) y haz clic en **Create and Continue**. No es necesario asignarle roles de IAM del proyecto de Google Cloud (los accesos se configuran en la consola de Google Wallet).

### Paso 3: Generar la Clave Privada JSON
1. En la lista de Cuentas de Servicio, haz clic sobre la cuenta recién creada.
2. Selecciona la pestaña **Keys** (Claves).
3. Haz clic en **Add Key > Create New Key** (Añadir Clave > Crear nueva clave).
4. Selecciona el formato **JSON** y haz clic en **Create**.
5. Se descargará automáticamente un archivo `.json` que contiene tu clave privada, el correo electrónico del service account y metadatos (ej: `mineral-silicon-496400-a0-6ddd04e40426.json`).

> [!IMPORTANT]
> **Protege este archivo JSON.** Contiene la clave criptográfica privada (`private_key`) que permite realizar firmas a nombre de tu cuenta de servicio. Nunca lo subas a repositorios de código públicos.

### Paso 4: Vincular el Service Account en la Consola de Google Pay & Wallet
Para que Google acepte las firmas de tu Cuenta de Servicio, debes otorgarle permisos de emisor:
1. Entra a la [Consola de Google Pay & Wallet](https://pay.google.com/gp/v/developer/dashboard).
2. Ve a la sección **Usuarios / Accesos** o **Configuración de la cuenta**.
3. Haz clic en **Invitar a un usuario / Añadir cuenta de servicio** y pega el correo electrónico de tu Service Account (ej: `burreria-wallet-motor@mineral-silicon-496400-a0.iam.gserviceaccount.com`).
4. Otórgale permisos de **Editor** o **Administrador** sobre tu ID de Emisor (`Issuer ID`).

---

## 🛡️ 3. Saneamiento Avanzado de Claves PEM en Vercel

Cuando configuras variables de entorno en plataformas como Vercel o Netlify, pegar una clave PEM multilínea suele resultar en advertencias como:
> *"This value starts and ends with whitespace and has return characters."*

Para garantizar que Node.js interprete la clave PEM de forma matemáticamente idéntica, implementamos un **saneamiento en caliente** en nuestra API que limpia automáticamente cualquier ruido, elimina comillas extras, interpreta caracteres escapados de nueva línea (`\n`) y reconstruye el formato de bloque si las líneas se aplanaron por accidente:

```typescript
function sanitizePrivateKey(raw: string): string {
  if (!raw) return ''
  let key = raw.trim()
  
  // Quitar comillas literales iniciales y finales si existen
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1)
  }
  
  // Reemplazar saltos de línea escapados como texto por saltos de línea reales
  key = key.replace(/\\n/g, '\n')
  
  // Si Vercel aplanó la llave en una sola línea usando espacios intermedios,
  // la reconstruimos con saltos de línea legítimos requeridos por OpenSSL/Jose.
  if (!key.includes('\n')) {
    const header = '-----BEGIN PRIVATE KEY-----'
    const footer = '-----END PRIVATE KEY-----'
    if (key.includes(header) && key.includes(footer)) {
      let body = key.replace(header, '').replace(footer, '').trim()
      body = body.replace(/\s+/g, '\n') // Convertir espacios intermedios en saltos
      key = `${header}\n${body}\n${footer}`
    }
  }
  
  return key.trim()
}
```

---

## 🚀 4. API de Google Wallet Completa (Save to Wallet JWT)

Este es el backend de producción definitivo implementado en `/api/wallet/google/route.ts`. Realiza:
1. **Autenticación OAuth2 Dinámica:** Se conecta a Google usando la librería oficial `google-auth-library` para verificar y mantener accesos seguros con la cuenta de servicio.
2. **Auto-Creación de Clases:** Si la `LoyaltyClass` no existe en Google Wallet (o si cambiaron los colores/portadas del negocio), la API ejecuta un flujo `GET` y posterior `POST` o `PATCH` automático para actualizarla.
3. **Generación de JWT Firmado:** Firma criptográficamente el payload del pase (`loyaltyObjects`) con el algoritmo de firma digital `RS256` utilizando la librería `jose`.
4. **Enlace "Save to Wallet":** Produce la URL oficial `https://pay.google.com/gp/v/save/[JWT]` para abrir de forma nativa la Billetera en Android.

```typescript
// file:///c:/proyecto/loyaltyclub/src/app/api/wallet/google/route.ts
import { JWT } from 'google-auth-library'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SignJWT, importPKCS8 } from 'jose'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const ISSUER_ID = '3388000000023143249' // Tu ID de Emisor de Google Wallet

// ... [Helper functions: sanitizePrivateKey, sanitizeEmail, normalizeHexColor] ...

async function getGoogleAccessToken(clientEmail: string, privateKey: string): Promise<string | null> {
  try {
    const client = new JWT({
      email: sanitizeEmail(clientEmail),
      key: sanitizePrivateKey(privateKey),
      scopes: ['https://www.googleapis.com/auth/wallet_object.issuer']
    })
    const credentials = await client.authorize()
    return credentials.access_token || null
  } catch (err) {
    console.error('[GoogleWallet] google-auth-library error:', err)
    return null
  }
}

// ... [buildLoyaltyClass, asegurarClaseExiste] ...

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { slug, user_id, nombre, puntos } = body

    // 1. Consultar Supabase
    const { data: business } = await supabase.from('businesses').select('*').eq('slug', slug).maybeSingle()
    const { data: cliente } = await supabase.from('clientes').select('*').eq('id', user_id).maybeSingle()

    // 2. Cargar Credenciales de Google
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const privateKey = sanitizePrivateKey(process.env.GOOGLE_PRIVATE_KEY || '')

    // Fallback a modo simulación si faltan variables de entorno
    if (!clientEmail || !privateKey || privateKey.length < 100) {
      return NextResponse.json({ url: `/google-wallet-simulacion?...`, simulacion: true })
    }

    // 3. Generar identificadores estructurados únicos
    const classSuffix = `lealtad_${business.slug.replace(/[^a-zA-Z0-9_]/g, '_')}`
    const classId = `${ISSUER_ID}.${classSuffix}`
    const safeClientId = user_id.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase().substring(0, 40)
    const objectId = `${ISSUER_ID}.obj_${business.slug.replace(/[^a-zA-Z0-9_]/g, '_')}_${safeClientId}`

    // 4. Asegurar la existencia de la clase plantilla en Google Wallet
    const accessToken = await getGoogleAccessToken(clientEmail, privateKey)
    if (!accessToken) throw new Error('No se pudo obtener el Access Token de Google')
    await asegurarClaseExiste(classId, accessToken, business)

    // 5. Construir objeto de fidelidad individual (LoyaltyObject)
    const loyaltyObject = {
      id: objectId,
      classId: classId,
      state: 'ACTIVE',
      accountId: cliente.id.substring(0, 20),
      accountName: cliente.nombre,
      loyaltyPoints: {
        balance: { string: `${cliente.puntos} ★` },
        label: 'Sellos Acumulados',
      },
      barcode: {
        type: 'QR_CODE',
        value: `https://${business.slug}.loyaltyclub.mx/cliente/${cliente.id}`,
        alternateText: `ID: ${cliente.id.substring(0, 8).toUpperCase()}`,
      },
      textModulesData: [
        { id: 'sellos_actuales', header: 'Sellos Acumulados', body: `${cliente.puntos} sellos` },
        { id: 'max_sellos', header: 'Meta', body: 'Completa 10 sellos' },
        { id: 'nombre_club', header: 'Club', body: `${business.nombre} VIP` }
      ]
    }

    // 6. Firmar el JWT de Google "Save to Wallet"
    const jwtPayload = {
      iss: clientEmail,
      aud: 'google',
      typ: 'savetowallet',
      iat: Math.floor(Date.now() / 1000),
      origins: ['https://loyaltyclub.mx', `https://${business.slug}.loyaltyclub.mx`],
      payload: { loyaltyObjects: [loyaltyObject] }
    }

    const privateKeyObj = await importPKCS8(privateKey, 'RS256')
    const token = await new SignJWT(jwtPayload)
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .sign(privateKeyObj)

    return NextResponse.json({ url: `https://pay.google.com/gp/v/save/${token}` })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

---

## 🛠️ 5. Scripts de Diagnóstico Rápido

Guarda estos scripts Node.js para diagnosticar tu integración directamente desde la terminal del servidor:

### Script 1: Probar Firma y Autenticación OAuth2 Localmente
Crea un archivo temporal `test_auth.js` y ejecútalo con `node test_auth.js`:

```javascript
const { JWT } = require('google-auth-library');
const fs = require('fs');

async function testGoogleAuth() {
  const sa = JSON.parse(fs.readFileSync('mineral-silicon-496400-a0-6ddd04e40426.json', 'utf8'));
  console.log("Service Account Email:", sa.client_email);

  try {
    const client = new JWT({
      email: sa.client_email,
      key: sa.private_key,
      scopes: ['https://www.googleapis.com/auth/wallet_object.issuer']
    });

    console.log("Solicitando Access Token a Google...");
    const credentials = await client.authorize();
    console.log("✅ AUTENTICACIÓN EXITOSA!");
    console.log("Access Token:", credentials.access_token.substring(0, 35) + "...");
  } catch (err) {
    console.error("❌ ERROR DE AUTENTICACIÓN:", err.message);
  }
}

testGoogleAuth();
```

### Script 2: Comprobar el estado de una clase en Google Wallet en vivo
Puedes usar `curl` con tu Token de Acceso para comprobar la existencia y configuración de una `LoyaltyClass` directamente desde los servidores de Google:

```bash
curl -H "Authorization: Bearer TU_ACCESS_TOKEN" \
     https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass/3388000000023143249.lealtad_laburreria
```
*(Si devuelve un objeto JSON estructurado con la información del negocio, la clase está activa, indexada y lista en Google Wallet).*
