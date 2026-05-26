import { NextResponse } from 'next/server'
// @ts-ignore
import { Template } from '@walletpass/pass-js'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hjaeireljkcvjnigfhzb.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqYWVpcmVsamtjdmpuaWdmaHpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MDA4NjIsImV4cCI6MjA5NDI3Njg2Mn0.vB76RwGG_4VgDKC8RAllkH7HZgWQB4JWcUtq7Z6svas'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

let SIGNER_KEY = `-----BEGIN PRIVATE KEY-----
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
-----END PRIVATE KEY-----`;

let SIGNER_CERT = `-----BEGIN CERTIFICATE-----
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
-----END CERTIFICATE-----`;

// IDs Extraídos directamente de tu Certificado (¡A prueba de fallos!)
const PASS_TYPE_IDENTIFIER = "pass.com.laburreria.vip";
const TEAM_IDENTIFIER = "R8K4HJ594Q";

export async function POST(req: Request) {
  try {
    const { clienteId, nombre, puntos, businessId } = await req.json()

    if (!clienteId || !nombre) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

    // Carga dinámica de certificados físicos desde la raíz de forma absoluta (Vercel-proof)
    try {
      const keyPath = path.resolve(process.cwd(), 'llave_maestra.key')
      if (fs.existsSync(keyPath)) {
        SIGNER_KEY = fs.readFileSync(keyPath, 'utf8')
      }
      const certPath = path.resolve(process.cwd(), 'pass.pem')
      if (fs.existsSync(certPath)) {
        SIGNER_CERT = fs.readFileSync(certPath, 'utf8')
      }
    } catch (e: any) {
      console.warn("Fallo al leer llaves físicas, usando fallback estático:", e.message)
    }

    // Cargar datos del negocio si están presentes
    let business: any = null
    if (businessId) {
      const { data } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .maybeSingle()
      if (data) business = data
    }

    const template = new Template('storeCard', {
      passTypeIdentifier: PASS_TYPE_IDENTIFIER,
      teamIdentifier: TEAM_IDENTIFIER,
      organizationName: business ? `${business.nombre} Club` : 'La Burrería Club',
      description: business ? `Pase VIP de Fidelidad de ${business.nombre}` : 'Pase VIP de Fidelidad',
      logoText: business ? business.nombre : 'La Burrería',
      backgroundColor: '#0a0a0a',
      foregroundColor: '#ffffff',
      labelColor: '#d4af37',
    });

    if (business && business.latitude && business.longitude) {
      template.locations = [{
        latitude: Number(business.latitude),
        longitude: Number(business.longitude),
        relevantText: `¡Estás cerca! Visita ${business.nombre} y acumula sellos.`
      }];
    } else {
      template.locations = [{
        latitude: 19.421583,
        longitude: -102.067222,
        relevantText: "¡Estás cerca! Pasa por tu Chavipizza a La Burrería."
      }];
    }

    try {
      template.setCertificate(SIGNER_CERT);
      template.setPrivateKey(SIGNER_KEY);

      try {
        const LOGO_URL = business?.logo_url || "https://hjaeireljkcvjnigfhzb.supabase.co/storage/v1/object/public/assets/logo.png";
        const DESTACADA_URL = business?.banner_url || "https://hjaeireljkcvjnigfhzb.supabase.co/storage/v1/object/public/assets/destacada.jpg";

        const [iconRes, stripRes] = await Promise.all([
          fetch(LOGO_URL),
          fetch(DESTACADA_URL)
        ]);

        if (iconRes.ok) {
          const iconBuffer = Buffer.from(await iconRes.arrayBuffer());
          template.images.add('icon', iconBuffer); 
          template.images.add('logo', iconBuffer); 
        }
        
        if (stripRes.ok) {
          const stripBuffer = Buffer.from(await stripRes.arrayBuffer());
          template.images.add('strip', stripBuffer); 
        }
      } catch (e) {
        console.error("No se pudieron inyectar las imágenes al pase.", e);
      }

      template.headerFields.add({ key: 'puntos', label: 'SELLOS', value: String(puntos || 0), textAlignment: 'PKTextAlignmentRight' });
      template.primaryFields.add({ key: 'cliente', label: 'SOCIO VIP', value: nombre });
      template.secondaryFields.add({ key: 'id', label: 'ID DE SOCIO', value: clienteId.substring(0, 8) });

      const pass = template.createPass({
        serialNumber: clienteId,
        authenticationToken: process.env.APPLE_PASS_AUTH_TOKEN || 'secure_token_123456789',
      });

      const passBuffer = await pass.asBuffer();

      return new NextResponse(passBuffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.pkpass',
          'Content-Disposition': `attachment; filename="VIP-${clienteId}.pkpass"`,
        },
      });
    } catch (e: any) {
      console.warn("Fallo la generación del archivo .pkpass. Generando fallback de pase Web...", e.message);
      
      const logoText = business ? business.nombre : 'La Burrería';
      const starsHtml = Array.from({ length: 10 }).map((_, idx) => idx < (puntos || 0) ? `
        <svg viewBox="0 0 24 24" style="width: 2rem; height: 2rem; color: #f59e0b; fill: currentColor; filter: drop-shadow(0 0 8px rgba(245,158,11,0.6));">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      ` : `
        <svg viewBox="0 0 24 24" style="width: 2rem; height: 2rem; color: #27272a; fill: currentColor;">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" stroke="#27272a" stroke-width="1.5" />
        </svg>
      `).join('');

      const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pase VIP Digital - ${logoText}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;700;900&display=swap');
    body {
      font-family: 'Outfit', sans-serif;
      background: #050505;
      color: #fff;
    }
  </style>
</head>
<body class="min-h-screen flex flex-col items-center justify-center p-4">
  <div class="fixed top-0 left-1/4 w-96 h-96 bg-red-950/20 rounded-full blur-[120px] pointer-events-none"></div>
  <div class="fixed bottom-0 right-1/4 w-96 h-96 bg-amber-950/20 rounded-full blur-[120px] pointer-events-none"></div>

  <div class="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-[28px] overflow-hidden shadow-[0_0_50px_rgba(212,175,55,0.15)] flex flex-col relative p-6">
    <div class="absolute inset-0 bg-gradient-to-br from-red-950/20 via-transparent to-amber-950/10 pointer-events-none"></div>
    
    <!-- Top Header -->
    <div class="flex justify-between items-center mb-8 relative z-10">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-red-900 rounded-xl flex items-center justify-center text-xl shadow-[0_0_15px_rgba(185,28,28,0.4)]">
          🌯
        </div>
        <div>
          <h2 class="text-xs font-black uppercase tracking-widest text-zinc-500">${logoText}</h2>
          <p class="text-[9px] uppercase tracking-wider text-amber-500 font-bold">Tarjeta de Fidelidad</p>
        </div>
      </div>
      <div class="text-right">
        <span class="bg-amber-950/50 border border-amber-800/40 text-amber-400 font-black px-3 py-1 rounded-full text-[10px] tracking-wider">
          PASE VIP
        </span>
      </div>
    </div>

    <!-- Client Name -->
    <div class="mb-8 relative z-10">
      <span class="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Titular del Pase</span>
      <h1 class="text-2xl font-black text-white tracking-wide">${nombre}</h1>
      <span class="text-[10px] text-zinc-600 font-mono">ID: ${clienteId.substring(0, 8)}</span>
    </div>

    <!-- Stats & Stamps -->
    <div class="bg-black/60 border border-zinc-800 rounded-2xl p-4 mb-6 relative z-10">
      <div class="flex justify-between items-center mb-4">
        <div>
          <span class="text-[10px] text-zinc-500 uppercase block">Acumulado</span>
          <span class="text-3xl font-black text-amber-400 font-mono">${puntos} <span class="text-xs text-zinc-600">/ 10</span></span>
        </div>
        <div class="text-right">
          <span class="text-[10px] text-zinc-500 uppercase block">Rango</span>
          <span class="text-xs font-bold text-white uppercase tracking-wider">Socio Distinguido</span>
        </div>
      </div>
      
      <!-- Stars Grid -->
      <div class="flex gap-1.5 justify-center">
        ${starsHtml}
      </div>
    </div>

    <!-- QR Code Scan Section -->
    <div class="flex flex-col items-center justify-center pt-2 relative z-10 border-t border-zinc-900">
      <div class="bg-white p-3 rounded-2xl shadow-2xl mb-3">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${clienteId}" alt="QR VIP" class="w-28 h-28" />
      </div>
      <p class="text-[9px] text-zinc-500 uppercase tracking-widest text-center">Escanea en caja para acumular y canjear premios</p>
    </div>
  </div>

  <!-- Instruction Tip -->
  <div class="mt-6 text-center text-zinc-500 text-xs max-w-xs space-y-2 relative z-10">
    <p class="font-bold text-amber-400">💡 Tip de Instalación:</p>
    <p>Toma una captura de pantalla o añade esta página a tus marcadores/favoritos para acceder a tu pase VIP en cualquier momento.</p>
  </div>
</body>
</html>`;

      return NextResponse.json({ 
        webPass: true, 
        html: htmlContent, 
        mensaje: "Pase Web Generado correctamente en formato offline de contingencia." 
      });
    }

  } catch (error: any) {
    console.error('API Apple Wallet Error Detallado:', error);
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}