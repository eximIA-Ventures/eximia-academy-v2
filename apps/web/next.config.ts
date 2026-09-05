import { withSentryConfig } from "@sentry/nextjs"
import type { NextConfig } from "next"

// O host do Supabase é derivado de `NEXT_PUBLIC_SUPABASE_URL` em BUILD-time
// (Next não aceita padrão dinâmico em runtime para `images.remotePatterns`).
// Um projeto Supabase por serviço único multi-tenant (D1): não há mais um
// `apps/web/logo-upload.tsx` por cliente com hostname fixo hardcoded — trocar
// de projeto Supabase é só trocar a env, sem tocar este arquivo.
const supabaseHostname = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return undefined
  try {
    return new URL(url).hostname
  } catch {
    return undefined
  }
})()

const nextConfig: NextConfig = {
  output: "standalone",
  productionBrowserSourceMaps: true,
  transpilePackages: ["@eximia/shared", "@eximia/ui", "@eximia/database", "@eximia/agents"],
  serverExternalPackages: ["pdf-parse"],
  images: {
    remotePatterns: [
      ...(supabaseHostname
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHostname,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
}

export default withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
})
