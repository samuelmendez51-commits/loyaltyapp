import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

// ── Certificado de Apple Wallet actualizado el 31 de Mayo de 2026 (C=MX) ────────
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
MIIGGjCCBQKgAwIBAgIQFvQJlZ58S/s1oTUP3Fe4jDANBgkqhkiG9w0BAQsFADB1
MUQwQgYDVQQDDDtBcHBsZSBXb3JsZHdpZGUgRGV2ZWxvcGVyIFJlbGF0aW9ucyBD
ZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTELMAkGA1UECwwCRzQxEzARBgNVBAoMCkFw
cGxlIEluYy4xCzAJBgNVBAYTAlVTMB4XDTI2MDUzMTIzMDA1NVoXDTI3MDYzMDIz
MDA1NFowgZMxJzAlBgoJkiaJk/IsZAEBDBdwYXNzLmNvbS5sYWJ1cnJlcmlhLnZp
cDEuMCwGA1UEAwwlUGFzcyBUeXBlIElEOiBwYXNzLmNvbS5sYWJ1cnJlcmlhLnZp
cDETMBEGA1UECwwKUjhLNEhKNTk0UTEWMBQGA1UECgwNU2FtdWVsIE1lbmRlejEL
MAkGA1UEBhMCTVgwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC4U7lE
74QnBIkIh2LXAIdALRO8EV+F9qVe10zi86W2ce64RD6ssxpL7KGbvXLxuJWnh+9U
uGq/r7T13niH/FbstY7slNDxfBe5mYjpYjaDmVcohxrlfwivR0lPhqMELWq81hP4
T9qGYuy2RY79nGMaD9dt+SpNjyHgmvwnSuoNAWdU8IEghBPs2cud9EoRp0W2Gpsm
24pLieqvV72U/HO4BxMel2HBXOKST1WxmJVi6jBJlJ3tWuXlDX89mpQsfx/Hpgu/
OG+kRKd2JhaaSVHAzyd/xPEmmEViVLvehNaz6GsKX43yhwOdHPuR76MQNf+KQViK
Q5mENROMdX8OZNKHAgMBAAGjggKFMIICgTAMBgNVHRMBAf8EAjAAMB8GA1UdIwQY
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
dHRwOi8vY3JsLmFwcGxlLmNvbS93d2RyZzQtNi5jcmwwHQYDVR0OBBYEFKWfczor
jGAHjzv25Dy7EDGwg0aqMA4GA1UdDwEB/wQEAwIHgDAnBgoqhkiG92NkBgEQBBkM
F3Bhc3MuY29tLmxhYnVycmVyaWEudmlwMBAGCiqGSIb3Y2QGAwIEAgUAMA0GCSqG
SIb3DQEBCwUAA4IBAQC4qzHbb7ZUvPa/B6ytAcMLnBW/ztj4pfOPIiaDBrq+EIVW
fsVDoPgfISdZcpQO4h4h8tnobuu7oxHzt0VrGN1tPP09jR4on2HP2NVpguA+KAD0
lkIoCcQPN09ldWS4D6w+ad7q8LfvXXhuELCDSua2ZKoHVLsj93lDzT92gUyW3Nfp
OTT5yV2wFp6GmQb6rqjCUtvDk8ukoU1+ImDfNzNRh22QsOxFVjRqF1oqQ9zqENU4
/nf8hGpIJNS+lDu3NyLX2zhVebkg/DeNsEOSFuhzJtlVi7xhhUX6NUYOvBk0B8i8
THFEz1gCah2zL3bR0VmHuXz+u/E5DBpuwtTP+j3f
-----END CERTIFICATE-----`

const KEY_FALLBACK = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC4U7lE74QnBIkI
h2LXAIdALRO8EV+F9qVe10zi86W2ce64RD6ssxpL7KGbvXLxuJWnh+9UuGq/r7T1
3niH/FbstY7slNDxfBe5mYjpYjaDmVcohxrlfwivR0lPhqMELWq81hP4T9qGYuy2
RY79nGMaD9dt+SpNjyHgmvwnSuoNAWdU8IEghBPs2cud9EoRp0W2Gpsm24pLieqv
V72U/HO4BxMel2HBXOKST1WxmJVi6jBJlJ3tWuXlDX89mpQsfx/Hpgu/OG+kRKd2
JhaaSVHAzyd/xPEmmEViVLvehNaz6GsKX43yhwOdHPuR76MQNf+KQViKQ5mENROM
dX8OZNKHAgMBAAECggEACLLkIerfGjZJFJl1t9QjDeDIDHk8wFDhAgZNbxfKK2ov
YWElx2GrwocteJuVXUSgRL08tWCp96zeReIqCa+GF1AEKYm7s0HEyYdY4jwL0DnA
LBNK2NIeF04ubq3ZwJyMwSel3p3qIAByz7FIVmihy/zmZklleS6MOJIn3IouXHmu
queRh7PUkh0E5MJnvDMNeyWIC4WxDMstpjyqsheWvHX6kJP8XQKyceRJpQW9kzbA
C6p/NOwQPkJS4T2y37ldmkFQZHcHeFY21qBIJgv5VhkMZwS61Fk4HkQt850fpvR4
eUIfkv0h4xVWr0pBJXZ6U4zCihzEkp/SKqdVGcX0iQKBgQD0qKTXBxDmwPM7in+M
EJT0p8NxYmuQchwXOpTW4Te8u5jXjGopcJigxwMxtPBQy3/EeLsLZ5Or7es71XRU
jgUP+bWUY65RW5AUckGa+0EovtAi0B0Twy0NbVnDxoJZEU2Hd5O0kKcy9Kg4hQEn
mMwr8gvjkAw7nCfJKgAW4ZOtyQKBgQDA3yAozQkKRiHFlC7iEgCPlmqnZaFNVwRB
SaqHyF5vxTtBvyGmil72KSfJb7E6EcRmgvU6jnJpry+F3g022gLtAKvyR0th63mc
wQ7W5DugX3SN9T4DEhrnp8/sZg64ENHQaBPxke8VPo7o00WpBzu2X66kPKuo8r0B
VyWCypNlzwKBgQCR6dqV28L6vGzUP9+d+227FCr9/oLEXSnfuLJ4DU4eo4ueUkIm
gN6mVMrU5GLG7PdAh/iV7qolyfmXb9C3dRQT2QuwelrGbuNZLmNuORc9Y7/iY1hU
Jv1BmswEdOnckPM6LdjLwdHWFBAX1UtBAGIUe4EXsRt6mcEouoHfI53d8QKBgECS
87t1Wk98R5ZVFJVQHav1WmQNXMH+HkiVl2i6pxOY30wV5/hQX5bfFJkWsimVBUKl
GeGvC5NiufCB9b6lo1EiZm9Je22fXyoiYQuFgokhLG7S6x4wE533y1+Ek+0AhJ7Y
GcVJbNiaB1LgWXRMHavjwR7vyTFZg/pM6RwvIsZ1AoGARfqEGjuUPYatsJdQcsHB
NZuxMd9fO2HqthXhIdsPd046BQHVx0Lg5XngyyS5T/Zm1S12xGV5y8clxpjo+kJ4
t66SBqjIXBjerOP0+GxTIOIAwoqOdRiLjDUX0gaquDS/K981VxGqCq+rkCHH0Exy
D38ujGpIdin8FEuIndfgz1A=
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


// ── Helper: Dibujo geométrico dinámico en Jimp ────────────────────────────────
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

async function generateStripImage(
  bannerBuffer: Buffer | null,
  puntos: number,
  maxSellos: number
): Promise<Buffer> {
  const width = 750
  const height = 246

  let canvas: any
  if (bannerBuffer) {
    try {
      const bannerImg = await Jimp.read(bannerBuffer)
      try {
        canvas = bannerImg.cover({ w: width, h: height })
      } catch {
        canvas = bannerImg.cover(width, height)
      }
    } catch (err) {
      console.warn('[AppleWallet] Error leyendo bannerBuffer, usando color sólido de fallback:', err)
      canvas = new Jimp({ width, height, color: 0x5B191BFF })
    }
  } else {
    canvas = new Jimp({ width, height, color: 0x5B191BFF })
  }

  // Dibujar los sellos (1 a 10 sellos dinámicos)
  const rows = maxSellos > 5 ? 2 : 1
  const cols = rows === 2 ? Math.ceil(maxSellos / 2) : maxSellos
  const stampRadius = 24
  const innerStarRadiusOuter = 14
  const innerStarRadiusInner = 6

  // Espaciado dinámico
  const gapX = cols > 5 ? 80 : 100
  const totalGridWidth = (cols - 1) * gapX
  const startX = (width - totalGridWidth) / 2
  
  const gapY = 85
  const startY = rows === 2 ? 65 : 123

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col
      if (idx >= maxSellos) break

      const cx = startX + col * gapX
      const cy = startY + row * gapY
      const isCompleted = idx < puntos

      // Dibujar círculo blanco de fondo
      for (let y = cy - stampRadius; y <= cy + stampRadius; y++) {
        for (let x = cx - stampRadius; x <= cx + stampRadius; x++) {
          if (x < 0 || x >= width || y < 0 || y >= height) continue

          const dx = x - cx
          const dy = y - cy
          const distSq = dx * dx + dy * dy

          if (distSq <= stampRadius * stampRadius) {
            if (distSq >= (stampRadius - 2) * (stampRadius - 2)) {
              canvas.setPixelColor(0x000000FF, x, y) // Borde negro
            } else {
              canvas.setPixelColor(0xFFFFFFFF, x, y) // Círculo blanco
            }
          }
        }
      }

      // Dibujar estrella
      const starPoly = getStarPolygon(cx, cy, innerStarRadiusOuter, innerStarRadiusInner)
      const starColor = isCompleted ? 0xF59E0BFF : 0xD1D5DBFF // Amarillo/Gris
      const starBorderColor = isCompleted ? 0xD97706FF : 0x9CA3AFFF

      for (let y = cy - innerStarRadiusOuter; y <= cy + innerStarRadiusOuter; y++) {
        for (let x = cx - innerStarRadiusOuter; x <= cx + innerStarRadiusOuter; x++) {
          if (x < 0 || x >= width || y < 0 || y >= height) continue

          if (isPointInPolygon(x, y, starPoly)) {
            let isBorder = false
            for (let i = 0; i < starPoly.length; i++) {
              const p1 = starPoly[i]
              const p2 = starPoly[(i + 1) % starPoly.length]
              
              const l2 = (p2[0]-p1[0])**2 + (p2[1]-p1[1])**2
              let t = ((x-p1[0])*(p2[0]-p1[0]) + (y-p1[1])*(p2[1]-p1[1])) / l2
              t = Math.max(0, Math.min(1, t))
              const projX = p1[0] + t*(p2[0]-p1[0])
              const projY = p1[1] + t*(p2[1]-p1[1])
              const distToSeg = (x-projX)**2 + (y-projY)**2
              
              if (distToSeg <= 1.5) {
                isBorder = true
                break
              }
            }

            if (isBorder) {
              canvas.setPixelColor(starBorderColor, x, y)
            } else {
              canvas.setPixelColor(starColor, x, y)
            }
          }
        }
      }
    }
  }

  const mimePng = Jimp.MIME_PNG || "image/png"
  if (typeof canvas.getBuffer === 'function') {
    const res = canvas.getBuffer(mimePng)
    if (res && typeof res.then === 'function') {
      return await res
    }
    return res
  } else if (typeof canvas.getBufferAsync === 'function') {
    return await canvas.getBufferAsync(mimePng)
  }
  return Buffer.from('')
}

function verificarPar(certPem: string, keyPem: string): boolean {
  try {
    if (!certPem || !keyPem || !certPem.includes('BEGIN CERTIFICATE') || !keyPem.includes('BEGIN')) {
      return false
    }
    const cert = crypto.createPublicKey(certPem)
    const key = crypto.createPrivateKey(keyPem)
    const data = Buffer.from('test-signature-data')
    const signature = crypto.sign('sha256', data, key)
    return crypto.verify('sha256', data, cert, signature)
  } catch (e) {
    return false
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

    if (wwdrCert) {
      try {
        const x509 = new crypto.X509Certificate(wwdrCert)
        if (x509.subject.includes('pass.com.laburreria.vip') || x509.subject.includes('Pass Type ID')) {
          console.warn('[AppleWallet] ⚠️ El certificado cargado en la variable APPLE_WWDR_CERT es un certificado de cliente pass, no un certificado Apple WWDR CA. Descartándolo para usar fallback.')
          wwdrCert = ''
        }
      } catch (e: any) {
        console.error('[AppleWallet] Error validando APPLE_WWDR_CERT:', e.message)
      }
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

  // Fallbacks de último recurso y verificación criptográfica estricta de par
  if (!wwdrCert || !wwdrCert.includes('BEGIN CERTIFICATE')) {
    wwdrCert = WWDR_FALLBACK
  }

  // Si no coinciden o alguno es inválido, forzar el par de fallback que sí coincide al 100%
  if (!signerCert || !signerKey || !verificarPar(signerCert, signerKey)) {
    console.warn('[AppleWallet] ⚠️ Desajuste criptográfico detectado entre el certificado y la llave cargados, o faltan credenciales en el servidor. Activando el par de fallback de seguridad coordinado.')
    signerCert = CERT_FALLBACK
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

      // Intentar cargar logo y banner remotos del negocio si están disponibles
      let logoBuffer = baseBuffer
      let bannerBuffer: Buffer | null = null

      try {
        const logoUrl = business?.logo_url
        if (logoUrl && (logoUrl.startsWith('http') || logoUrl.startsWith('/'))) {
          if (logoUrl.startsWith('http')) {
            const logoRes = await fetch(logoUrl)
            if (logoRes.ok) {
              logoBuffer = Buffer.from(await logoRes.arrayBuffer())
              console.log('[AppleWallet] ✅ Logo remoto cargado para POST')
            }
          } else {
            const localImgPath = path.join(process.cwd(), 'public', logoUrl)
            if (fs.existsSync(localImgPath)) {
              logoBuffer = fs.readFileSync(localImgPath)
              console.log('[AppleWallet] ✅ Logo local cargado para POST')
            }
          }
        }
      } catch (imgErr: any) {
        console.warn('[AppleWallet] Error cargando logo:', imgErr.message)
      }

      try {
        const bannerUrl = business?.banner_url
        if (bannerUrl && (bannerUrl.startsWith('http') || bannerUrl.startsWith('/'))) {
          if (bannerUrl.startsWith('http')) {
            const bannerRes = await fetch(bannerUrl)
            if (bannerRes.ok) {
              bannerBuffer = Buffer.from(await bannerRes.arrayBuffer())
              console.log('[AppleWallet] ✅ Banner remoto cargado para POST')
            }
          } else {
            const localImgPath = path.join(process.cwd(), 'public', bannerUrl)
            if (fs.existsSync(localImgPath)) {
              bannerBuffer = fs.readFileSync(localImgPath)
              console.log('[AppleWallet] ✅ Banner local cargado para POST')
            }
          }
        }
      } catch (imgErr: any) {
        console.warn('[AppleWallet] Error cargando banner:', imgErr.message)
      }

      // Generar la portada dinámica con estrellas circulares
      const maxSellos = business?.max_sellos || 10
      const stripBuffer = await generateStripImage(bannerBuffer, puntos || 0, maxSellos)

      console.log('[AppleWallet] 🎨 Redimensionando y comprimiendo imágenes para el pase...')
      const passBuffers: Record<string, Buffer> = {
        "icon.png": await resizeImage(logoBuffer, 29, 29, 'cover'),
        "icon@2x.png": await resizeImage(logoBuffer, 58, 58, 'cover'),
        "logo.png": await resizeImage(logoBuffer, 160, 50, 'contain'),
        "logo@2x.png": await resizeImage(logoBuffer, 320, 100, 'contain'),
        "strip.png": await resizeImage(stripBuffer, 375, 123, 'cover'),
        "strip@2x.png": stripBuffer
      }

      const firstName = (nombre || 'SOCIO').split(' ')[0].toUpperCase()

      const modelObject: any = {
        formatVersion: 1,
        passTypeIdentifier: PASS_TYPE_IDENTIFIER,
        teamIdentifier: TEAM_IDENTIFIER,
        organizationName: business ? `${business.nombre} Club` : 'La Burrería Club',
        description: business ? `Pase VIP de Fidelidad — ${business.nombre}` : 'Pase VIP de Fidelidad La Burrería',
        foregroundColor: 'rgb(249, 246, 240)', // Alabastro / Blanco premium (Legible y lujoso)
        backgroundColor: 'rgb(91, 25, 27)',     // Borgoña Premium Lujoso
        labelColor: 'rgb(212, 175, 55)',        // Oro Metálico Antiguo
        storeCard: {
          headerFields: [
            { key: 'socio', label: 'SOCIO', value: firstName, textAlignment: 'PKTextAlignmentRight' }
          ],
          secondaryFields: [
            { key: 'totales', label: 'ESTAMPILLAS TOTALES', value: String(maxSellos), textAlignment: 'PKTextAlignmentLeft' },
            { key: 'completadas', label: 'ESTAMPILLAS COMPLETADAS', value: String(puntos || 0), textAlignment: 'PKTextAlignmentRight' }
          ],
          backFields: [
            { key: 'info', label: 'CÓMO ACUMULAR', value: 'Presenta tu código QR en caja para acumular sellos y ganar premios.' },
            { key: 'contacto', label: 'CONTACTO', value: business?.telefono_whatsapp ? `+${business.telefono_whatsapp}` : 'Consulta al cajero' }
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
        }
      )

      const passBuffer = pass.getAsBuffer()

      console.log('[AppleWallet] ✅ Pase .pkpass generado exitosamente para:', clienteId)
      return new NextResponse(passBuffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.pkpass',
          'Content-Disposition': 'inline; filename="pass.pkpass"',
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

      // Intentar cargar logo y banner remotos del negocio si están disponibles
      let logoBuffer = baseBuffer
      let bannerBuffer: Buffer | null = null

      try {
        const logoUrl = business?.logo_url
        if (logoUrl && (logoUrl.startsWith('http') || logoUrl.startsWith('/'))) {
          if (logoUrl.startsWith('http')) {
            const logoRes = await fetch(logoUrl)
            if (logoRes.ok) {
              logoBuffer = Buffer.from(await logoRes.arrayBuffer())
              console.log('[AppleWallet] ✅ Logo remoto cargado para GET')
            }
          } else {
            const localImgPath = path.join(process.cwd(), 'public', logoUrl)
            if (fs.existsSync(localImgPath)) {
              logoBuffer = fs.readFileSync(localImgPath)
              console.log('[AppleWallet] ✅ Logo local cargado para GET')
            }
          }
        }
      } catch (imgErr: any) {
        console.warn('[AppleWallet] Error cargando logo:', imgErr.message)
      }

      try {
        const bannerUrl = business?.banner_url
        if (bannerUrl && (bannerUrl.startsWith('http') || bannerUrl.startsWith('/'))) {
          if (bannerUrl.startsWith('http')) {
            const bannerRes = await fetch(bannerUrl)
            if (bannerRes.ok) {
              bannerBuffer = Buffer.from(await bannerRes.arrayBuffer())
              console.log('[AppleWallet] ✅ Banner remoto cargado para GET')
            }
          } else {
            const localImgPath = path.join(process.cwd(), 'public', bannerUrl)
            if (fs.existsSync(localImgPath)) {
              bannerBuffer = fs.readFileSync(localImgPath)
              console.log('[AppleWallet] ✅ Banner local cargado para GET')
            }
          }
        }
      } catch (imgErr: any) {
        console.warn('[AppleWallet] Error cargando banner:', imgErr.message)
      }

      // Generar la portada dinámica con estrellas circulares
      const maxSellos = business?.max_sellos || 10
      const stripBuffer = await generateStripImage(bannerBuffer, puntos || 0, maxSellos)

      console.log('[AppleWallet] 🎨 Redimensionando y comprimiendo imágenes para el pase...')
      const passBuffers: Record<string, Buffer> = {
        "icon.png": await resizeImage(logoBuffer, 29, 29, 'cover'),
        "icon@2x.png": await resizeImage(logoBuffer, 58, 58, 'cover'),
        "logo.png": await resizeImage(logoBuffer, 160, 50, 'contain'),
        "logo@2x.png": await resizeImage(logoBuffer, 320, 100, 'contain'),
        "strip.png": await resizeImage(stripBuffer, 375, 123, 'cover'),
        "strip@2x.png": stripBuffer
      }

      const firstName = (nombre || 'SOCIO').split(' ')[0].toUpperCase()

      const modelObject: any = {
        formatVersion: 1,
        passTypeIdentifier: PASS_TYPE_IDENTIFIER,
        teamIdentifier: TEAM_IDENTIFIER,
        organizationName: business ? `${business.nombre} Club` : 'La Burrería Club',
        description: business ? `Pase VIP de Fidelidad — ${business.nombre}` : 'Pase VIP de Fidelidad La Burrería',
        foregroundColor: 'rgb(249, 246, 240)', // Alabastro / Blanco premium (Legible y lujoso)
        backgroundColor: 'rgb(91, 25, 27)',     // Borgoña Premium Lujoso
        labelColor: 'rgb(212, 175, 55)',        // Oro Metálico Antiguo
        storeCard: {
          headerFields: [
            { key: 'socio', label: 'SOCIO', value: firstName, textAlignment: 'PKTextAlignmentRight' }
          ],
          secondaryFields: [
            { key: 'totales', label: 'ESTAMPILLAS TOTALES', value: String(maxSellos), textAlignment: 'PKTextAlignmentLeft' },
            { key: 'completadas', label: 'ESTAMPILLAS COMPLETADAS', value: String(puntos || 0), textAlignment: 'PKTextAlignmentRight' }
          ],
          backFields: [
            { key: 'info', label: 'CÓMO ACUMULAR', value: 'Presenta tu código QR en caja para acumular sellos y ganar premios.' },
            { key: 'contacto', label: 'CONTACTO', value: business?.telefono_whatsapp ? `+${business.telefono_whatsapp}` : 'Consulta al cajero' }
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
        }
      )

      const passBuffer = pass.getAsBuffer()

      console.log('[AppleWallet] ✅ Pase .pkpass generado exitosamente via GET para:', clienteId)
      return new NextResponse(passBuffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.pkpass',
          'Content-Disposition': 'inline; filename="pass.pkpass"',
        },
      })

    } catch (passError: any) {
      console.warn('[AppleWallet] Error generando .pkpass via GET (generando HTML de respaldo):', passError.message)
      
      const debugHeader = `${passError.message} | ${passError.stack || ''}`.replace(/[\r\n]+/g, ' ').substring(0, 1000);
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
        headers: { 
          'Content-Type': 'text/html',
          'x-apple-pass-error': debugHeader
        }
      })
    }

  } catch (error: any) {
    console.error('[AppleWallet] Error crítico en GET handler:', error.message)
    return new NextResponse(`Error: ${error.message}`, { status: 500 })
  }
}
