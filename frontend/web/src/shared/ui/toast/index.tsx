'use client'

import { useTheme } from 'next-themes'
import { Toaster } from 'sonner'

export { toast } from 'sonner'
export function ToastRegion() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      position="top-center"
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      toastOptions={{ classNames: { error: 'bg-[#9e0812]! border-[#9e0812]! text-white!' } }}
      closeButton
      duration={6500}
    />
  )
}
