import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: [
    'bikers.partners.localhost',
    'bikers.localhost',
    'admin.localhost',
    'laburreria.partners.localhost',
    'laburreria.localhost',
    'laburreria.socios.localhost',
    'localhost:3000'
  ],

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
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.output.hotUpdateMainFilename = 'static/webpack/[runtime].hot-update.json';
    }
    return config;
  },
};

export default nextConfig;