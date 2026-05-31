import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// ── Importación CommonJS estricta para evitar conflictos ESM/CJS ──────────────
// @ts-ignore
const { PKPass } = require('passkit-generator')
// @ts-ignore
const JimpModule = require('jimp')
const Jimp = JimpModule.Jimp || JimpModule

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
cDETMBEGA1UECwwKUjhLNEhKNTk0UTEWMBQGA1UECgwNU2FtdWVsIE1lbmRlejEL
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
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCp0A60SgPWiRim
VQA3GVRvCOopSk4Xzn1uje7deUMwix2YHE70QWHs8DGxcosrPbw7hEZda4z50HIt
RiiUZFzM6HVeiRX8qODPHtnQ2uwECmFDKjp2aSstCnYwJ0z2N84tAP4UQx/21wR7
4R6RWEetrRXcxtDUhiyi3j/6UKcxx8ZNwdt7D1NOoVmbROa/8Fojwt8k02+Etwpu
jmkp7xPiK9qoj1bcn2NKNl3tPa8A9+Jk1Sr+wStmsYvi04/58ZeEanxlExrEInxx
cQQMAte/B8/jgQvzNDn3gyU8B5a6ui57+ECKwlWnKy40d/T7pc+3aMLRQh1hWxPt
M5Rew0RXAgMBAAECggEAEohm+m0zgwf+XTTcq6bDjMSzzaLS6A08qkKqRZiU6Sjd
p3q7cTPrjJDgU4X1Q1hfAT3b8hkpTyBdPayxBBT5/dEG8jTS5frGYkRzMDScWoqJ
d+uVatPqhuVj5bh8UUjg4w9/K1XyGJ352s1EaUdxtzYzMx+trewg1fucjuSbgral
2xeSBCrInYEy06HhJTW/k+qukzrNn/4AnWNxuzvbz4KWw190Waq9wYn7ppkrwEcK
vcdvFORU2lCvfA4e3GSlpUzSF4DVKQQgUUeyYm5/vj2q8bcD7DvFdXG51WH9gzXn
41bIYkkFkSe7A4iAUl4dCt3Lawd9hT4UcOg6LScz4QKBgQDVsnKvzqb/BFoKA/ci
PPAOTMiLzlQNuVKJ54loW5J/XFhZ+bpEcqRLpOn9ewoZeCoiTXVyFATguBNWN1hh
sNFjyd3Vn/jGtmmXhpPNXz1LOokk5a4AaeA2biy8IT8L1LsL8ZIJypNua9z1PQaW
fjAYTuLFIim4CAwvsBIMoDKK9wKBgQDLba1xJ45UdXMyke16YkqW6Cqb2uCiGgEj
+Vqc0M9l9mUFmMJKjIQ7H4S0wCBZ+pfGnJ69EzN8trAKg61T9LX4kSO/+TxzKXfr
nSRX+XWjQSyAYr2QrC6tHBg/lRcAbl2oP+SM70VCrE6gye7lTdv1ZnQMlGFNQLKi
62By9CZZoQKBgQCjxA2ADa6M4Jjf9AoAgxK04sMN4SEpI0zNwlLbVtH+KJbM3USS
EAk4rzliuFgVDLG9d/75Xb4fOPIYsHFa7FaLUrhebioInuJs7QV37fTbIhDX5exj
BMB+9g/yXMgkGPL/RDHWrxgtFxxOFGZoDmxtNIc06+lszz4HjbdHVb1mIQKBgFCv
nd2FvPRO6XQjYTfriH42c8ABnpttCQrFumT8hWaBxivkHRwIg+IXbEFs+uf1dwG1
2VhRJ1jN9SEWfUcRhqOinbVlG87pocD4QRQLw9cO4KHDiEC7qn/K5utBLTBklg1H
2lT0ClqZkU5BCdo1eYrqKhlbOQS1JqVsCoNNx3BBAoGBAI42mVbUpB5UZYf8n5Ta
Bpgmh/ojkHSiemb6FA4kbSms20e7w+NehpfyLW5S2Y3C0eofVGV3Ss0r352yrZqq
pj0uFAQGLfb3Xu8EoV0FpXjzHafalEFORszve51bpNIMQK80XS+3z5gGIagidG7G
rJ+8nPBQ6prq1qIXQFN+8Bo9
-----END PRIVATE KEY-----`

const WWDR_FALLBACK = `-----BEGIN CERTIFICATE-----
MIIEVTCCAz2gAwIBAgIUE9x3lVJx5T3GMujM/+Uh88zFztIwDQYJKoZIhvcNAQEL
BQAwYjELMAkGA1UEBhMCVVMxEzARBgNVBAoTCkFwcGxlIEluYy4xJjAkBgNVBAsT
HUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRYwFAYDVQQDEw1BcHBsZSBS
b290IENBMB4XDTIwMTIxNjE5MzYwNFoXDTMwMTIxMDAwMDAwMFowdTFEMEIGA1UE
Aww7QXBwbGUgV29ybGR3aWRlIERldmVsb3BlciBSZWxhdGlvbnMgQ2VydGlmaWNh
dGlvbiBBdXRob3JpdHkxCzAJBgNVBAsMAkc0MRMwEQYDVQQKDApBcHBsZSBJbmMu
MQswCQYDVQQGEwJVUzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBANAf
eKp6JzKwRl/nF3bYoJ0OKY6tPTKlxGs3yeRBkWq3eXFdDDQEYHX3rkOPR8SGHgjo
v9Y5Ui8eZ/xx8YJtPH4GUnadLLzVQ+mxtLxAOnhRXVGhJeG+bJGdayFZGEHVD41t
QSo5SiHgkJ9OE0/QjJoyuNdqkh4laqQyziIZhQVg3AJK8lrrd3kCfcCXVGySjnYB
5kaP5eYq+6KwrRitbTOFOCOL6oqW7Z+uZk+jDEAnbZXQYojZQykn/e2kv1MukBVl
PNkuYmQzHWxq3Y4hqqRfFcYw7V/mjDaSlLfcOQIA+2SM1AyB8j/VNJeHdSbCb64D
YyEMe9QbsWLFApy9/a8CAwEAAaOB7zCB7DASBgNVHRMBAf8ECDAGAQH/AgEAMB8G
A1UdIwQYMBaAFCvQaUeUdgn+9GuNLkCm90dNfwheMEQGCCsGAQUFBwEBBDgwNjA0
BggrBgEFBQcwAYYoaHR0cDovL29jc3AuYXBwbGUuY29tL29jc3AwMy1hcHBsZXJv
b3RjYTAuBgNVHR8EJzAlMCOgIaAfhh1odHRwOi8vY3JsLmFwcGxlLmNvbS9yb290
LmNybDAdBgNVHQ4EFgQUW9n6HeeaGgujmXYiUIY+kchbd6gwDgYDVR0PAQH/BAQD
AgEGMBAGCiqGSIb3Y2QGAgEEAgUAMA0GCSqGSIb3DQEBCwUAA4IBAQA/Vj2e5bbD
eeZFIGi9v3OLLBKeAuOugCKMBB7DUshwgKj7zqew1UJEggOCTwb8O0kU+9h0UoWv
p50h5wESA5/NQFjQAde/MoMrU1goPO6cn1R2PWQnxn6NHThNLa6B5rmluJyJlPef
x4elUWY0GzlxOSTjh2fvpbFoe4zuPfeutnvi0v/fYcZqdUmVIkSoBPyUuAsuORFJ
EtHlgepZAE9bPFo22noicwkJac3AfOriJP6YRLj477JxPxpd1F1+M02cHSS+APCQ
A1iZQT0xWmJArzmoUUOSqwSonMJNsUvSq3xKX+udO7xPiEAGE/+QF4oIRynoYpgp
pU8RBWk6z/Kf
-----END CERTIFICATE-----`

// ── Helper: Sanitizar PEM ─────────────────────────────────────────────────────
function sanitizePem(raw: string, type: 'CERTIFICATE' | 'PRIVATE KEY'): string {
  if (!raw) return ''
  let clean = raw.trim()
  
  // Quitar comillas si están presentes
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.slice(1, -1)
  }
  
  // Reemplazar saltos de línea escapados
  clean = clean.replace(/\\n/g, '\n')
  
  // Reconstruir si se han aplanado los saltos de línea con espacios
  if (!clean.includes('\n')) {
    const header = `-----BEGIN ${type}-----`
    const footer = `-----END ${type}-----`
    if (clean.includes(header) && clean.includes(footer)) {
      let body = clean.replace(header, '').replace(footer, '').trim()
      body = body.replace(/\s+/g, '\n')
      clean = `${header}\n${body}\n${footer}`
    }
  }
  
  return clean.trim()
}

// ── Helper: Redimensionar y comprimir imágenes con Jimp ───────────────────────
async function resizeImage(buffer: Buffer, width: number, height: number, mode: 'cover' | 'contain'): Promise<Buffer> {
  try {
    const image = await Jimp.read(buffer)
    let processed: any

    if (mode === 'cover') {
      try {
        processed = image.cover({ w: width, h: height })
      } catch {
        processed = image.cover(width, height)
      }
    } else {
      try {
        processed = image.contain({ w: width, h: height })
      } catch {
        processed = image.contain(width, height)
      }
    }

    const mimePng = Jimp.MIME_PNG || "image/png"
    if (typeof processed.getBuffer === 'function') {
      const res = processed.getBuffer(mimePng)
      if (res && typeof res.then === 'function') {
        return await res
      }
      return res
    } else if (typeof processed.getBufferAsync === 'function') {
      return await processed.getBufferAsync(mimePng)
    }

    return buffer
  } catch (err: any) {
    console.warn(`[AppleWallet] Error resizing image to ${width}x${height}:`, err.message)
    return buffer // Fallback to raw buffer if resize fails
  }
}

// ── Función: leer certificados con lógica híbrida priorizando base64 para producción ──
function leerCertificados(): { signerCert: string; signerKey: string; wwdrCert: string } {
  let signerCert = ''
  let signerKey = ''
  let wwdrCert = ''

  // Paso 1: Intentar leer variables de entorno (PEM plano o Base64)
  if (process.env.APPLE_WWDR_CERT) {
    const raw = process.env.APPLE_WWDR_CERT.trim()
    if (raw.includes('BEGIN CERTIFICATE')) {
      wwdrCert = sanitizePem(raw, 'CERTIFICATE')
      console.log('[AppleWallet] ✅ WWDR cargado directamente desde APPLE_WWDR_CERT (PEM plano env)')
    } else {
      try {
        const decoded = Buffer.from(raw, 'base64').toString('utf8')
        if (decoded.includes('BEGIN CERTIFICATE')) {
          wwdrCert = sanitizePem(decoded, 'CERTIFICATE')
          console.log('[AppleWallet] ✅ WWDR cargado desde APPLE_WWDR_CERT (Base64 env)')
        }
      } catch (e: any) { console.error('[AppleWallet] Error decodificando APPLE_WWDR_CERT:', e.message) }
    }
  }

  if (process.env.APPLE_SIGNER_CERT) {
    const raw = process.env.APPLE_SIGNER_CERT.trim()
    if (raw.includes('BEGIN CERTIFICATE')) {
      signerCert = sanitizePem(raw, 'CERTIFICATE')
      console.log('[AppleWallet] ✅ Certificado cargado directamente desde APPLE_SIGNER_CERT (PEM plano env)')
    } else {
      try {
        const decoded = Buffer.from(raw, 'base64').toString('utf8')
        if (decoded.includes('BEGIN CERTIFICATE')) {
          signerCert = sanitizePem(decoded, 'CERTIFICATE')
          console.log('[AppleWallet] ✅ Certificado cargado desde APPLE_SIGNER_CERT (Base64 env)')
        }
      } catch (e: any) { console.error('[AppleWallet] Error decodificando APPLE_SIGNER_CERT:', e.message) }
    }
  }

  if (process.env.APPLE_SIGNER_KEY) {
    const raw = process.env.APPLE_SIGNER_KEY.trim()
    if (raw.includes('BEGIN')) {
      signerKey = sanitizePem(raw, 'PRIVATE KEY')
      console.log('[AppleWallet] ✅ Llave cargada directamente desde APPLE_SIGNER_KEY (PEM plano env)')
    } else {
      try {
        const decoded = Buffer.from(raw, 'base64').toString('utf8')
        if (decoded.includes('BEGIN')) {
          signerKey = sanitizePem(decoded, 'PRIVATE KEY')
          console.log('[AppleWallet] ✅ Llave cargada desde APPLE_SIGNER_KEY (Base64 env)')
        }
      } catch (e: any) { console.error('[AppleWallet] Error decodificando APPLE_SIGNER_KEY:', e.message) }
    }
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
  if (!wwdrCert || !wwdrCert.includes('BEGIN CERTIFICATE')) {
    wwdrCert = WWDR_FALLBACK
  }
  if (!signerCert || !signerCert.includes('BEGIN CERTIFICATE')) {
    signerCert = CERT_FALLBACK
  }
  if (!signerKey || !signerKey.includes('BEGIN')) {
    signerKey = KEY_FALLBACK
  }

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
      let baseBuffer: Buffer
      try {
        baseBuffer = fs.readFileSync(logoPngPath)
      } catch {
        baseBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
      }

      // Intentar cargar logo remoto/específico del negocio si está disponible
      try {
        const logoUrl = business?.logo_url
        if (logoUrl && (logoUrl.startsWith('http') || logoUrl.startsWith('/'))) {
          if (logoUrl.startsWith('http')) {
            const logoRes = await fetch(logoUrl)
            if (logoRes.ok) {
              baseBuffer = Buffer.from(await logoRes.arrayBuffer())
              console.log('[AppleWallet] ✅ Logo remoto cargado para compresión')
            }
          } else {
            const localImgPath = path.join(process.cwd(), 'public', logoUrl)
            if (fs.existsSync(localImgPath)) {
              baseBuffer = fs.readFileSync(localImgPath)
              console.log('[AppleWallet] ✅ Logo local cargado para compresión')
            }
          }
        }
      } catch (imgErr: any) {
        console.warn('[AppleWallet] No se pudo cargar imagen del negocio, usando logo por defecto:', imgErr.message)
      }

      // Redimensionar las imágenes de forma ultra-ligera en base a baseBuffer
      console.log('[AppleWallet] 🎨 Redimensionando y comprimiendo imágenes para el pase...')
      const passBuffers: Record<string, Buffer> = {
        "icon.png": await resizeImage(baseBuffer, 29, 29, 'cover'),
        "icon@2x.png": await resizeImage(baseBuffer, 58, 58, 'cover'),
        "logo.png": await resizeImage(baseBuffer, 160, 50, 'contain'),
        "logo@2x.png": await resizeImage(baseBuffer, 320, 100, 'contain')
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

// ── GET HANDLER (Nativo para descarga directa y registro en iOS Safari) ────────
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const clienteId = searchParams.get('clienteId')
    const businessId = searchParams.get('businessId')

    if (!clienteId) {
      return new NextResponse('Falta clienteId', { status: 400 })
    }

    // 1. Obtener cliente de Supabase
    const { data: cliente, error: clientErr } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', clienteId)
      .maybeSingle()

    if (clientErr || !cliente) {
      return new NextResponse(`Cliente no encontrado: ${clientErr?.message || ''}`, { status: 404 })
    }

    const nombre = cliente.nombre
    const puntos = cliente.puntos

    // Cargar datos del negocio si están presentes
    let business: any = null
    const bId = businessId || cliente.business_id
    if (bId) {
      try {
        const { data } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', bId)
          .maybeSingle()
        if (data) business = data
      } catch (e: any) {
        console.warn('[AppleWallet] No se pudo cargar negocio:', e.message)
      }
    }

    // Leer certificados con lógica robusta
    const { signerCert, signerKey, wwdrCert } = leerCertificados()

    // Construir el PKPass usando passkit-generator
    try {
      const logoPngPath = path.resolve(process.cwd(), 'public/logo.png')
      let baseBuffer: Buffer
      try {
        baseBuffer = fs.readFileSync(logoPngPath)
      } catch {
        baseBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
      }

      // Intentar cargar logo remoto/específico del negocio si está disponible
      try {
        const logoUrl = business?.logo_url
        if (logoUrl && (logoUrl.startsWith('http') || logoUrl.startsWith('/'))) {
          if (logoUrl.startsWith('http')) {
            const logoRes = await fetch(logoUrl)
            if (logoRes.ok) {
              baseBuffer = Buffer.from(await logoRes.arrayBuffer())
              console.log('[AppleWallet] ✅ Logo remoto cargado para compresión')
            }
          } else {
            const localImgPath = path.join(process.cwd(), 'public', logoUrl)
            if (fs.existsSync(localImgPath)) {
              baseBuffer = fs.readFileSync(localImgPath)
              console.log('[AppleWallet] ✅ Logo local cargado para compresión')
            }
          }
        }
      } catch (imgErr: any) {
        console.warn('[AppleWallet] No se pudo cargar imagen del negocio, usando logo por defecto:', imgErr.message)
      }

      // Redimensionar las imágenes de forma ultra-ligera en base a baseBuffer
      console.log('[AppleWallet] 🎨 Redimensionando y comprimiendo imágenes para el pase...')
      const passBuffers: Record<string, Buffer> = {
        "icon.png": await resizeImage(baseBuffer, 29, 29, 'cover'),
        "icon@2x.png": await resizeImage(baseBuffer, 58, 58, 'cover'),
        "logo.png": await resizeImage(baseBuffer, 160, 50, 'contain'),
        "logo@2x.png": await resizeImage(baseBuffer, 320, 100, 'contain')
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

      console.log('[AppleWallet] ✅ Pase .pkpass generado exitosamente via GET para:', clienteId)
      return new NextResponse(passBuffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.pkpass',
          'Content-Disposition': `attachment; filename="${(business?.nombre || 'VIP').replace(/\s+/g, '')}-${clienteId.substring(0, 8)}.pkpass"`,
        },
      })

    } catch (passError: any) {
      console.warn('[AppleWallet] Error generando .pkpass via GET (generando HTML de respaldo):', passError.message)

      // Fallback: Pase Web Premium en HTML para el navegador
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
      <a href="javascript:history.back()" style="color:#71717a;text-decoration:none;font-size:12px;font-weight:650;display:inline-flex;align-items:center;gap:4px;transition:colors 0.2s;">← Regresar al Portal</a>
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

      return new NextResponse(htmlContent, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      })
    }

  } catch (error: any) {
    console.error('[AppleWallet] Error crítico en GET handler:', error.message)
    return new NextResponse(`Error: ${error.message}`, { status: 500 })
  }
}