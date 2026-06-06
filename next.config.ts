import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: [
    'partners.bikers.localhost',
    'bikers.localhost',
    'admin.localhost',
    'partners.laburreria.localhost',
    'laburreria.localhost',
    'localhost:3000'
  ],
  // Excluir next.config.ts y certificados/claves del rastreo NFT
  outputFileTracingExcludes: {
    '*': [
      './next.config.ts',
      './wwdr.pem',
      './pass.pem',
      './llave.pem',
      './LlaveBurreria.key',
      './llave_burreria.key',
      './llave_clasica.pem',
      './llave_maestra.key',
      './certificado_burreria.pem',
      './certificado_burreria_antiguo.pem',
      './pass.cer',
      './solicitud.csr',
      './AppleWWDRCAG4.cer',
      './MoldeApple.csr'
    ],
  },
  // Ignorar warnings específicos de NFT en Turbopack
  turbopack: {
    ignoreIssue: [
      {
        path: '**/src/app/api/wallet/apple/route.ts',
        title: /Encountered unexpected file in NFT list/,
      },
    ],
  },
  // Headers de seguridad y PWA
  async headers() {
    return [
      {
        source: '/service-worker.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
    ]
  },
};

export default nextConfig;