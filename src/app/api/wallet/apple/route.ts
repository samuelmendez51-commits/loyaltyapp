import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// ── Importación CommonJS estricta para evitar conflictos ESM/CJS ──────────────
// @ts-ignore
const { PKPass } = require('passkit-generator')

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hjaeireljkcvjnigfhzb.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqYWVpcmVsamtjdmpuaWdmaHpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MDA4NjIsImV4cCI6MjA5NDI3Njg2Mn0.vB76RwGG_4VgDKC8RAllkH7HZgWQB4JWcUtq7Z6svas'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Identificadores Apple ─────────────────────────────────────────────────────
const PASS_TYPE_IDENTIFIER = 'pass.com.laburreria.vip'
const TEAM_IDENTIFIER = 'R8K4HJ594Q'

// ── Certificados de respaldo (fallback de último recurso) ────────────────────
const CERT_FALLBACK = `-----BEGIN CERTIFICATE-----
MIIGGjCCBQKgAwIBAgIQJEz86++dmd8xtTG3btOFvzANBgkqhkiG9w0BAQsFADB1
MUQwQgYDVQQDDDtBcHBsZSBXb3JsZHdpZGUgRGV2ZWxvcGVyIFJlbGF0aW9ucyBD
ZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTELMAkGA1UECwwCRzQxEzARBgNVBAoMCkFw
cGxlIEluYy4xCzAJBgNVBAYTAlVTMB4XDTI2MDUxOTIyMDM1NVoXDTI3MDYxODIy
MDM1NFowgZMxJzAlBgoJkiaJk/IsZAEBDBdwYXNzLmNvbS5sYWJ1cnJlcmlhLnZp
cDEuMCwGA1UEAwwlUGFzcyBUeXBlIElEOiBwYXNzLmNvbS5sYWJ1cnJlcmlhLnZp
cDEuMCwGA1UECwwKUjhLNEhKNTk0UTEWMBQGA1UECgwNU2FtdWVsIE1lbmRlejEL
MAkGA1UEBhMCVVMwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDTD8Gq
C5+zYbJ27sKLkrfUVJorVsWFfVqyQoCoQDxj3juS/zicXXM4qEjMfvdm9oKKCAAi
s9PNd2o0kJ9o6cRgOAbQo0JPDqVgC0kxHGFYR7JWIFGfhQO/8EnT5XVVmwxxEXqT
1Yj2QDlWVoiwFryRpUzzZGrOTAbcFcZOWRya7NndgyM8BvGQeOJ9YPo9VDsPhmm1
7TjDb4WIKKJULiYblNDn8wK7a7h7pvWy7VOIf5xiDvCX6zVQL5XhK1RDIhEqnT7f
6Y0Z8vA+cFdis81vnyArS5dfozsrFvtpdzCmxn6Yhw8brRMk1z0cDJkJ/sC8hcpw
VmlIx6dj0rHbrPy/AgMBAAGjggKFMIICgTAMBgNVHRMBAf8EAjAAMB8GA1UdIwQY
MBaAFFvZ+h3nmhoLo5l2IlCGPpHIW3eoMHAGCCsGAQUFBwEBBGQwYjAtBggrBgEF
BQcwAoYhaHR0cDovL2NlcnRzLmFwcGxlLmNvbS93d2RyZzQuZGVyMDEGCCsGAQUF
BzABhiVodHRwOi8vb2NzcC5hcHBsZS5jb20vb2NzcDAzLXd3ZHJnNDA0MIIBHgYD
VR0gBIIBFTCCAREwggENBgkqhkiG92NkBQEwgf8wgcMGCCsGAQUFBwICMIG2DIGz
UmVsaWFuY2Ugb24gdGhpcyBjZXJ0aWZpY2F0ZSBieSBhbnkgcGFydHkgYXNzdW1l
Y2Ygb2YgdGhpcyBjZXJ0aWZpY2F0ZSBieSBhbnkgcGFydHkgYXNzdW1l
cyBhY2NlcHRhbmNlIG9mIHRoZSB0aGVuIGFwcGxpY2FibGUgc3RhbmRhcmQgdGVy
bXMgYW5kIGNvbmRpdGlvbnMgb2YgdXNlLCBjZXJ0aWZpY2F0ZSBwb2xpY3kgYW5k
IGNlcnRpZmljYXRpb24gcHJhY3RpY2Ugc3RhdGVtZW50cy4wNwYIKwYBBQUHAgEW
K2h0dHBzOi8vd3d3LmFwcGxlLmNvbS9jZXJ0aWZpY2F0ZWF1dGhvcml0eS8wHgYD
VR0lBBcwFQYIKwYBBQUHAwIGCSqGSIb3Y2QEDjAyBgNVHR8EKzApMCegJaAjhiFo
dHRwOi8vY3JsLmFwcGxlLmNvbS93d2RyZzQtNS5jcmwwHQYDVR0OBBYEFEpt8rDd
ucAMgyxPwPkecj/SN4cZMA4GA1UdDwEB/wQEAwIHgDAnBgoqhkiG92NkBgEQBBkM
F3Bhc3MuY29tLmxhYnVycmVyaWEudmlwMBAGCiqGSIb3Y2QGAwIEAgUAMA0GCSqG
SIb3DQEBCwUAA4IBAQDOrt4jlwM9QoGLKYgd1WJI/SAvwxtqHKi4iZnjzDfe63UB
BXvSG7Z8tqDbmWYRBPq6zujqAoJ2GD06EHctIdzmnwChCGm/4dJsARSsgOKWAMat
8Nx3YmVFVReqyP6zU5cGBBfDWecrXSmtNws2mD8V7mM73cozbg+RJ31950t810rX
tyTnsK+hPqJ7eLZgN/Ye1tEwXRZflMjsxNgoMgQUJqVaHR+HSl5Ht+sKXTcSZknh
8CWmCYXTaguzsKILJJuqudBqKzsG4FkhQqHSm4/qk1gHDMTY6WilLflyPha89vD/
RLAYAd+bHKXx6qT5AcXnhSMShni/jpNriAoOtEGP
-----END CERTIFICATE-----`

const KEY_FALLBACK = `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCVbSqTGHKhk1uk
mPSDUi58U8PIo7KZpVCQxlW1N3VF69gp0uQkdkcTeZGVEhCM6DrVay9fb2HMYlXw
etK/aCla4YCbupDIAQabId0nD/+vR2LlOBCi8b48s66lD+aBxUg/QZFkCEceEDAn
XLM6mm7NwoimAWLT7tD0923yDiOUG3UQPcwYPzQCqTwMY7v23WsF6YndCCQQswRR
at2Rw+IP4dqG3y0/HIiAhzQadO2jMkZs5QYP7VAyhNQ9FAqU2GdgGlggxBrOlLHl
KK/jax425vGvOJrKY+e/MiiTLLZRE490kSpTBKmiMf0hxVfvSggdqJBIs0Pnmueq
6Kt8gbFXAgMBAAECggEAFKuecpe0r8ZB10yeB8EpaLhxAm3RVIYfqs9M5uhuOBxu
cXwDZEnaU4bYd+MhAqT+EoIlHPy8Q3jXmOXHW9lYXdfeTGyWqkbTYkgLyY4MhB40
v4RYb3n6eMzbBr64LSZxyTz+6Z69hm/zLAFw/P/aU8CqhNr3OrMJboGrJgtaVO/w
kqpW2O87KYKIFnkvS7KbzA4sl59eo1Tl0PVSPN1FU51LW4CoIMz9LwyUf1e2irPd
QHderR0718R1fB5lP9RsGzMfC0mXPfLOFhhVwzPKHxVKatlid5POAoEnjVp2sPt8
8NS1buaA+6Pa+v8JHkwaLvFil42zdcqX3qD6H5lnEQKBgQDNlozwyNLiBZ1wo084
seWle5rhG4BFp9XAhv30tPEdbmPXm3uKVtvCHRjjxQ8Ajcq/71cYSDSrdTUuamQK
JE68k6ito5yXkDWXmRg7mWvZlTChGjZhRsM27F7vBAe9m1vJnEr0WjAO8Cwg91Lb
ERC2roI1UvHyRUNzud22U7uwMQKBgQC6ESlPS1rKjYA9e2OwXSptBO5dJAG6DDNf
QF3TNoe3Pp5ZavocxOCGy6xMoviaB2kUaNHVDIaCI32mSWcpPd/Hym/5ZvlxFLNR
CM3Irn/AMeNNa5DV/aU2BbghBSx0C4hOnsJFcEYZsPWI/ZdDroAWZs7s1Ej0Wbnz
luIwa0XgBwKBgQCnpKlfO1ODTXLZw8G5CI+sBoQAJg3OPxL1gN6baeTny/mMelQe
Nb/TpSiDq1AVcoovQvrxaQfR/KyWIdlbz8mIypuUpELv8H9TFFsHVo70iUxzQk2v
uyU6pzquisnJGmOZnmIcqWJg/AXwB92/l0XawaiZ1P5IQaTEPH8Hy3XUMQKBgQCS
s+U2N9ulyFtMHnVDILHKsxCdLz6NSgFXIJDZby0iNaT0K3x4ImJE5WE8K2KHT0By
bxLCP9Xt1b3D1iwYQEioZdxTb/VMS132jlJx3+OpzavB5wWTMyGHroq2vjWGaXFX
S6Uwyoz6xKNTF16kZnlnMDgGUnoS7ovGmzhLpMi7EQKBgQCs6aCKlKWObCOpceT3
Mtsmue7iemyOcmopns/DANF6Tl064nYdhab2D+VzpVLcfswk6YIR1/Jeo9mmu1g2
UdGuw8xv9dK4fCBXbLEP8F2M7nXzIUlWTmPoQS5LjGdoKq5lK5W9NGg78HO1zJZu
DiwrugDPatu4KRuN0WK87TJeJw==
-----END PRIVATE KEY-----`

// ── Función: leer certificados con lógica híbrida priorizando base64 para producción ──
function leerCertificados(): { signerCert: string; signerKey: string; wwdrCert: string } {
  let signerCert = ''
  let signerKey = ''
  let wwdrCert = ''

  // Paso 1: Intentar leer variables de entorno Base64 (máxima estabilidad en producción en Vercel)
  if (process.env.APPLE_WWDR_CERT) {
    try {
      wwdrCert = Buffer.from(process.env.APPLE_WWDR_CERT, 'base64').toString('utf8')
      console.log('[AppleWallet] ✅ WWDR cargado desde APPLE_WWDR_CERT (Base64 env)')
    } catch (e: any) { console.error('[AppleWallet] Error decodificando APPLE_WWDR_CERT:', e.message) }
  }

  if (process.env.APPLE_SIGNER_CERT) {
    try {
      const decoded = Buffer.from(process.env.APPLE_SIGNER_CERT, 'base64').toString('utf8')
      if (decoded.includes('BEGIN CERTIFICATE')) {
        signerCert = decoded
        console.log('[AppleWallet] ✅ Certificado cargado desde APPLE_SIGNER_CERT (Base64 env)')
      }
    } catch (e: any) { console.error('[AppleWallet] Error decodificando APPLE_SIGNER_CERT:', e.message) }
  }

  if (process.env.APPLE_SIGNER_KEY) {
    try {
      const decoded = Buffer.from(process.env.APPLE_SIGNER_KEY, 'base64').toString('utf8')
      if (decoded.includes('BEGIN')) {
        signerKey = decoded
        console.log('[AppleWallet] ✅ Llave cargada desde APPLE_SIGNER_KEY (Base64 env)')
      }
    } catch (e: any) { console.error('[AppleWallet] Error decodificando APPLE_SIGNER_KEY:', e.message) }
  }

  // Paso 2: Intentar leer archivos físicos si no están presentes las variables de entorno (para desarrollo local)
  if (!wwdrCert || !signerCert || !signerKey) {
    console.log('[AppleWallet] 🔍 Intentando cargar certificados desde archivos físicos del servidor...')
    try {
      const wwdrPath = path.resolve(process.cwd(), 'wwdr.pem')
      if (fs.existsSync(wwdrPath) && !wwdrCert) {
        wwdrCert = fs.readFileSync(wwdrPath, 'utf8')
        console.log('[AppleWallet] ✅ WWDR cargado desde wwdr.pem (filesystem)')
      }
    } catch (e: any) { console.warn('[AppleWallet] No se pudo leer wwdr.pem:', e.message) }

    try {
      const passPemPath = path.resolve(process.cwd(), 'pass.pem')
      if (fs.existsSync(passPemPath) && !signerCert) {
        signerCert = fs.readFileSync(passPemPath, 'utf8')
        console.log('[AppleWallet] ✅ Certificado cargado desde pass.pem (filesystem)')
      }
    } catch (e: any) { console.warn('[AppleWallet] No se pudo leer pass.pem:', e.message) }

    try {
      const llavePemPath = path.resolve(process.cwd(), 'llave.pem')
      if (fs.existsSync(llavePemPath) && !signerKey) {
        signerKey = fs.readFileSync(llavePemPath, 'utf8')
        console.log('[AppleWallet] ✅ Llave cargada desde llave.pem (filesystem)')
      } else if (!signerKey) {
        const alts = ['llave_maestra.key', 'LlaveBurreria.key', 'llave_clasica.pem', 'llave_burreria.key']
        for (const alt of alts) {
          const altPath = path.resolve(process.cwd(), alt)
          if (fs.existsSync(altPath)) {
            signerKey = fs.readFileSync(altPath, 'utf8')
            console.log(`[AppleWallet] ✅ Llave cargada desde ${alt}`)
            break
          }
        }
      }
    } catch (e: any) { console.warn('[AppleWallet] No se pudo leer llave.pem:', e.message) }
  }

  // Fallbacks de último recurso
  if (!signerCert) signerCert = CERT_FALLBACK
  if (!signerKey) signerKey = KEY_FALLBACK

  return { signerCert, signerKey, wwdrCert }
}

// ── HANDLER PRINCIPAL ─────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { clienteId, nombre, puntos, businessId } = await req.json()
    console.log('[AppleWallet] POST recibido:', { clienteId, nombre, puntos })

    if (!clienteId || !nombre) {
      return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 })
    }

    // Cargar datos del negocio si están presentes
    let business: any = null
    if (businessId) {
      try {
        const { data } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', businessId)
          .maybeSingle()
        if (data) business = data
      } catch (e: any) {
        console.warn('[AppleWallet] No se pudo cargar negocio:', e.message)
      }
    }

    // Leer certificados con lógica híbrida priorizando variables Base64
    const { signerCert, signerKey, wwdrCert } = leerCertificados()

    // Construir el PKPass usando passkit-generator v3 API
    try {
      const logoPngPath = path.resolve(process.cwd(), 'public/logo.png')
      let logoBuffer: Buffer
      try {
        logoBuffer = fs.readFileSync(logoPngPath)
      } catch {
        logoBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
      }

      const passBuffers: Record<string, Buffer> = {
        "icon.png": logoBuffer,
        "icon@2x.png": logoBuffer,
        "logo.png": logoBuffer,
        "logo@2x.png": logoBuffer
      }

      // Agregar imágenes si disponibles
      try {
        const logoUrl = business?.logo_url
        if (logoUrl && (logoUrl.startsWith('http') || logoUrl.startsWith('/'))) {
          let remoteBuffer: Buffer | null = null
          if (logoUrl.startsWith('http')) {
            const logoRes = await fetch(logoUrl)
            if (logoRes.ok) {
              remoteBuffer = Buffer.from(await logoRes.arrayBuffer())
            }
          } else {
            const localImgPath = path.join(process.cwd(), 'public', logoUrl)
            if (fs.existsSync(localImgPath)) {
              remoteBuffer = fs.readFileSync(localImgPath)
            }
          }
          if (remoteBuffer) {
            passBuffers["icon.png"] = remoteBuffer
            passBuffers["icon@2x.png"] = remoteBuffer
            passBuffers["logo.png"] = remoteBuffer
            passBuffers["logo@2x.png"] = remoteBuffer
          }
        }
      } catch (imgErr: any) {
        console.warn('[AppleWallet] No se pudieron cargar imágenes:', imgErr.message)
      }

      const modelObject: any = {
        formatVersion: 1,
        passTypeIdentifier: PASS_TYPE_IDENTIFIER,
        teamIdentifier: TEAM_IDENTIFIER,
        organizationName: business ? `${business.nombre} Club` : 'La Burrería Club',
        description: business ? `Pase VIP de Fidelidad — ${business.nombre}` : 'Pase VIP de Fidelidad La Burrería',
        logoText: business ? business.nombre : 'La Burrería',
        foregroundColor: 'rgb(9, 9, 11)',
        backgroundColor: 'rgb(255, 255, 255)',
        labelColor: 'rgb(220, 38, 38)',
        storeCard: {
          headerFields: [
            { key: 'sellos', label: 'SELLOS', value: String(puntos || 0), textAlignment: 'PKTextAlignmentRight' }
          ],
          primaryFields: [
            { key: 'cliente', label: 'SOCIO VIP', value: nombre }
          ],
          secondaryFields: [
            { key: 'id', label: 'ID DE SOCIO', value: clienteId.substring(0, 8) },
            { key: 'negocio', label: 'NEGOCIO', value: business?.nombre || 'La Burrería' }
          ],
          backFields: [
            { key: 'info', label: 'CÓMO ACUMULAR', value: 'Presenta tu código QR en cada visita para acumular sellos y ganar premios.' },
            { key: 'contacto', label: 'CONTACTO', value: business?.telefono_whatsapp ? `+${business.telefono_whatsapp}` : 'Consulta al cajero' }
          ]
        },
        barcode: {
          message: clienteId,
          format: 'PKBarcodeFormatQR',
          messageEncoding: 'iso-8859-1',
          altText: `ID: ${clienteId.substring(0, 8)}`
        }
      }

      // Agregar geolocalización si disponible
      if (business?.latitude && business?.longitude) {
        modelObject.locations = [{
          latitude: Number(business.latitude),
          longitude: Number(business.longitude),
          relevantText: `¡Estás cerca! Visita ${business.nombre} y acumula sellos.`
        }]
      } else {
        modelObject.locations = [{
          latitude: 19.421583,
          longitude: -102.067222,
          relevantText: '¡Estás cerca! Pasa por La Burrería.'
        }]
      }

      passBuffers["pass.json"] = Buffer.from(JSON.stringify(modelObject))

      const pass = new PKPass(
        passBuffers,
        {
          wwdr: wwdrCert || undefined,
          signerCert: signerCert,
          signerKey: signerKey
        },
        {
          serialNumber: clienteId,
          webServiceURL: process.env.NEXT_PUBLIC_SITE_URL || 'https://laburreria.loyaltyclub.mx',
          authenticationToken: process.env.APPLE_PASS_AUTH_TOKEN || 'secure_token_laburreria_2026',
        }
      )

      const passBuffer = pass.getAsBuffer()

      console.log('[AppleWallet] ✅ Pase .pkpass generado exitosamente para:', clienteId)
      return new NextResponse(passBuffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.pkpass',
          'Content-Disposition': `attachment; filename="${(business?.nombre || 'VIP').replace(/\s+/g, '')}-${clienteId.substring(0, 8)}.pkpass"`,
        },
      })

    } catch (passError: any) {
      console.warn('[AppleWallet] Error generando .pkpass (generando pase web de respaldo):', passError.message)

      // ── Fallback: Pase Web Premium ─────────────────────────────────────────
      const logoText = business ? business.nombre : 'La Burrería'
      const starsHtml = Array.from({ length: 10 }).map((_, idx) =>
        idx < (puntos || 0)
          ? `<div style="width:32px;height:32px;background:linear-gradient(135deg,#FFD700,#FDB931);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px rgba(255,215,0,0.5);"><span style="color:#452000;font-size:1.1rem;font-weight:900;">★</span></div>`
          : `<div style="width:32px;height:32px;border:2px dashed #e4e4e7;border-radius:50%;display:flex;align-items:center;justify-content:center;"><span style="color:#d4d4d8;font-size:1rem;">★</span></div>`
      ).join('')

      const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pase VIP — ${logoText}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #fafafa; color: #09090b; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 1.5rem; }
    .card { background: white; border: 1px solid #e4e4e7; border-radius: 24px; padding: 2rem; max-width: 360px; width: 100%; box-shadow: 0 10px 40px rgba(0,0,0,0.08); }
    .badge { background: #fef2f2; color: #dc2626; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 10px; border-radius: 999px; border: 1px solid #fecaca; }
    .name { font-size: 1.6rem; font-weight: 900; letter-spacing: -0.03em; margin: 1rem 0 0.25rem; }
    .stamps { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; padding: 1.25rem; background: #fafafa; border-radius: 16px; margin: 1.25rem 0; }
    .qr-wrap { background: white; border: 1px solid #e4e4e7; border-radius: 12px; padding: 0.75rem; display: inline-block; }
    .tip { margin-top: 1.5rem; text-align: center; font-size: 12px; color: #71717a; line-height: 1.6; }
    .tip strong { color: #dc2626; }
  </style>
</head>
<body>
  <div class="card">
    <div style="text-align:left;margin-bottom:1.25rem;">
      <a href="javascript:window.location.reload()" style="color:#71717a;text-decoration:none;font-size:12px;font-weight:650;display:inline-flex;align-items:center;gap:4px;transition:colors 0.2s;">← Regresar al Portal</a>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
      <div>
        <p style="font-size:11px;color:#71717a;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">${logoText}</p>
        <p style="font-size:11px;color:#dc2626;font-weight:700;letter-spacing:0.04em;">Club de Fidelización</p>
      </div>
      <span class="badge">Pase VIP</span>
    </div>
    <p style="font-size:11px;color:#a1a1aa;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Titular</p>
    <h1 class="name">${nombre}</h1>
    <p style="font-size:11px;color:#a1a1aa;font-family:monospace;">ID: ${clienteId.substring(0, 8)}</p>
    <div class="stamps">${starsHtml}</div>
    <p style="text-align:center;font-size:28px;font-weight:900;color:#09090b;margin-bottom:0.25rem;">${puntos || 0}<span style="font-size:14px;color:#a1a1aa;font-weight:600;"> / 10 sellos</span></p>
    <div style="text-align:center;margin-top:1.25rem;">
      <div class="qr-wrap">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${clienteId}&bgcolor=ffffff&color=09090b&margin=0" alt="QR VIP" width="150" height="150" />
      </div>
    </div>
    <p class="tip">📸 Guarda esta página en tus favoritos o toma una captura de pantalla para acceder a tu pase VIP en cualquier momento.<br><br><strong>Muestra el QR en caja para acumular sellos.</strong></p>
  </div>
</body>
</html>`

      return NextResponse.json({
        webPass: true,
        html: htmlContent,
        mensaje: 'Pase Web generado correctamente como respaldo.'
      })
    }

  } catch (error: any) {
    console.error('[AppleWallet] Error crítico en POST handler:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}