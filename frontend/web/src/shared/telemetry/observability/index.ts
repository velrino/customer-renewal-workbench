const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
export async function initializeObservability() {
  if (!dsn) return
  const { init } = await import('@sentry/nextjs')
  init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    sampleRate: 1,
    maxBreadcrumbs: 0,
    integrations: defaults => defaults.filter(integration => integration.name !== 'BrowserSession'),
    beforeSend(event) {
      delete event.user
      delete event.request
      return event
    },
  })
}
