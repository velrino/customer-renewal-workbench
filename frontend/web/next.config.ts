import { withSentryConfig } from '@sentry/nextjs/config'
import type { NextConfig } from 'next'
const config: NextConfig = {
  output: 'export',
  env: {
    NEXT_PUBLIC_SENTRY_RELEASE: process.env.VERCEL_GIT_COMMIT_SHA,
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.VERCEL_ENV,
  },
  agentRules: false,
  devIndicators: false,
}
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(config, {
      org: 'futureproofing-customer-renewa',
      project: 'customer-renewal-workbench-frontend',
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      telemetry: false,
    })
  : config
