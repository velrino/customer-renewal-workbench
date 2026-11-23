import { storageKey } from '..'

export const preferenceKeys = {
  theme: storageKey('preferences', 'theme'),
  dashboardTour: storageKey('preferences', 'dashboard-tour'),
} as const
