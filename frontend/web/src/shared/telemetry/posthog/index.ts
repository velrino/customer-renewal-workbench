let initialization: Promise<void> | undefined

export function initializePostHog() {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production' ||
    ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) ||
    navigator.doNotTrack === '1' || process.env.NEXT_PUBLIC_POSTHOG_ENABLED !== 'true') return

  const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  if (!apiHost || !token?.startsWith('phc_')) return

  initialization ??= start(token, apiHost).catch(() => {
    // The workbench stays usable if analytics is blocked or unavailable.
  })
  return initialization
}

async function start(token: string, apiHost: string) {
  const host = new URL(apiHost)
  if (host.protocol !== 'https:' || host.username || host.password) return
  const { default: posthog } = await import('posthog-js/no-external')
  posthog.init(token, {
    api_host: host.origin,
    persistence: 'memory',
    person_profiles: 'never',
    capture_pageview: true,
    autocapture: false,
    capture_pageleave: false,
    capture_exceptions: false,
    capture_performance: false,
    capture_dead_clicks: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_external_dependency_loading: true,
    advanced_disable_feature_flags: true,
    respect_dnt: true,
    before_send(event) {
      if (!event || (event.event !== '$pageview' && event.event !== 'crw-error')) return null
      const { token, distinct_id, $device_id, $session_id, source } = event.properties
      return {
        ...event,
        $set: undefined,
        $set_once: undefined,
        properties: {
          token, distinct_id, $device_id, $session_id, $process_person_profile: false,
          app: 'crw', $current_url: location.origin + '/',
          ...(event.event === 'crw-error' ? { source } : {}),
        },
      }
    },
  })

  let errors = 0
  function report(source: 'window' | 'promise') {
    if (errors >= 10) return
    errors++
    posthog.capture('crw-error', { source })
  }
  window.addEventListener('error', () => report('window'))
  window.addEventListener('unhandledrejection', () => report('promise'))
}
