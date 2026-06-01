import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
  try {
    const hasWWDR = !!process.env.APPLE_WWDR_CERT;
    const hasSignerCert = !!process.env.APPLE_SIGNER_CERT;
    const hasSignerKey = !!process.env.APPLE_SIGNER_KEY;

    // Load cert currently in use by the server
    let certUsed = '';
    let source = '';

    if (process.env.APPLE_SIGNER_CERT) {
      certUsed = process.env.APPLE_SIGNER_CERT.trim();
      source = 'Environment Variable (APPLE_SIGNER_CERT)';
    } else {
      // If not in env, check filesystem pass.pem
      try {
        const fs = require('fs');
        const path = require('path');
        const passPemPath = path.resolve(process.cwd(), 'pass.pem');
        if (fs.existsSync(passPemPath)) {
          certUsed = fs.readFileSync(passPemPath, 'utf8');
          source = 'Filesystem (pass.pem)';
        }
      } catch {}
    }

    let certDetails: any = 'None';
    if (certUsed) {
      try {
        let pem = certUsed;
        if (!pem.includes('BEGIN CERTIFICATE')) {
          pem = Buffer.from(pem, 'base64').toString('utf8');
        }
        const cert = new crypto.X509Certificate(pem);
        certDetails = {
          subject: cert.subject,
          issuer: cert.issuer,
          validFrom: cert.validFrom,
          validTo: cert.validTo,
          serialNumber: cert.serialNumber
        };
      } catch (e: any) {
        certDetails = 'Error parsing cert: ' + e.message;
      }
    }

    let wwdrDetails: any = 'None';
    if (process.env.APPLE_WWDR_CERT) {
      try {
        let pem = process.env.APPLE_WWDR_CERT.trim();
        if (!pem.includes('BEGIN CERTIFICATE')) {
          pem = Buffer.from(pem, 'base64').toString('utf8');
        }
        const cert = new crypto.X509Certificate(pem);
        wwdrDetails = {
          subject: cert.subject,
          issuer: cert.issuer,
          validFrom: cert.validFrom,
          validTo: cert.validTo,
          serialNumber: cert.serialNumber
        };
      } catch (e: any) {
        wwdrDetails = 'Error parsing WWDR: ' + e.message;
      }
    }

    return NextResponse.json({
      envVariablesPresent: {
        APPLE_WWDR_CERT: hasWWDR,
        APPLE_SIGNER_CERT: hasSignerCert,
        APPLE_SIGNER_KEY: hasSignerKey
      },
      currentCertSource: source,
      currentCertDetails: certDetails,
      wwdrEnvDetails: wwdrDetails
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
