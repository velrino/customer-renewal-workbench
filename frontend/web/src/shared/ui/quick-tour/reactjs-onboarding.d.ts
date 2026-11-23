declare module 'reactjs-onboarding' {
  import type { ComponentType, ReactNode } from 'react'
  export const OnboardingItem: ComponentType<{
    elementCoOrdinate?: { l: number; t: number; w: number; h: number }
    message: ReactNode
  }>
}
