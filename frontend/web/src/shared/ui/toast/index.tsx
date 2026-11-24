'use client'

import { useTheme } from 'next-themes'
import { Toaster, toast as sonner, type ExternalToast } from 'sonner'

let activeToast: { id: string | number; key?: string | number } | undefined

function show(kind: 'success' | 'error' | 'message', message: string, options: ExternalToast = {}) {
  if (activeToast) sonner.dismiss(activeToast.id)
  const { id: key, ...settings } = options
  const id = sonner[kind](message, settings)
  activeToast = { id, key }
  return id
}

export const toast = {
  message: (message: string, options?: ExternalToast) => show('message', message, options),
  success: (message: string, options?: ExternalToast) => show('success', message, options),
  error: (message: string, options?: ExternalToast) => show('error', message, options),
  dismiss(key: string) {
    if (activeToast?.key === key) {
      sonner.dismiss(activeToast.id)
      activeToast = undefined
    }
  },
}

export function ToastRegion() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      position="top-center"
      visibleToasts={1}
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      toastOptions={{
        className: 'data-[visible=false]:hidden!',
        classNames: {
          error: 'bg-[#9e0812]! border-[#9e0812]! text-white!',
          success: 'bg-emerald-700! border-emerald-700! text-white! [&_[data-description]]:text-white!',
        },
      }}
      closeButton
      duration={6500}
    />
  )
}
