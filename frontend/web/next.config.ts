import { withSentryConfig } from '@sentry/nextjs/config'
import type { NextConfig } from 'next'
const localReviewer = process.env.NEXT_PUBLIC_LOCAL_REVIEWER === '1'
if (localReviewer && (process.env.VERCEL || process.env.NODE_ENV === 'production')) {
  throw new Error('The reviewer profile runs only with the local development server.')
}
const config: NextConfig = {
  output: 'export',
  ...(localReviewer && {
    distDir: '.next-reviewer',
    typescript: { tsconfigPath: 'tsconfig.reviewer.json' },
  }),
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
