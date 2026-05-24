import { NextResponse } from 'next/server'
// @ts-ignore
import { Template } from '@walletpass/pass-js'

const SIGNER_KEY = `-----BEGIN PRIVATE KEY-----
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

const SIGNER_CERT = `-----BEGIN CERTIFICATE-----
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
-----END CERTIFICATE-----`;

// IDs Extraídos directamente de tu Certificado (¡A prueba de fallos!)
const PASS_TYPE_IDENTIFIER = "pass.com.laburreria.vip";
const TEAM_IDENTIFIER = "R8K4HJ594Q";

export async function POST(req: Request) {
  try {
    const { clienteId, nombre, puntos } = await req.json()

    if (!clienteId || !nombre) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

    const template = new Template('storeCard', {
      passTypeIdentifier: PASS_TYPE_IDENTIFIER,
      teamIdentifier: TEAM_IDENTIFIER,
      organizationName: 'La Burrería Club',
      description: 'Pase VIP de Fidelidad',
      logoText: 'La Burrería',
      backgroundColor: '#0a0a0a',
      foregroundColor: '#ffffff',
      labelColor: '#d4af37',
    });

    template.locations = [{
      latitude: 19.421583,
      longitude: -102.067222,
      relevantText: "¡Estás cerca! Pasa por tu Chavipizza a La Burrería."
    }];

    template.setCertificate(SIGNER_CERT);
    template.setPrivateKey(SIGNER_KEY);

    try {
      const LOGO_URL = "https://hjaeireljkcvjnigfhzb.supabase.co/storage/v1/object/public/assets/logo.png";
      const DESTACADA_URL = "https://hjaeireljkcvjnigfhzb.supabase.co/storage/v1/object/public/assets/destacada.jpg";

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

  } catch (error: any) {
    console.error('API Apple Wallet Error Detallado:', error);
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}