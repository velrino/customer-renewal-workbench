import { storageKey } from '..'

export const preferenceKeys = {
  renewalRange: storageKey('preferences', 'renewal-range'),
  metricOrder: storageKey('preferences', 'metric-order'),
  theme: storageKey('preferences', 'theme'),
  dashboardTour: storageKey('preferences', 'dashboard-tour'),
} as const
