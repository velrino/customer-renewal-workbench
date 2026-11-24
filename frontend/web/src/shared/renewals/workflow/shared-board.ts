import { reviewerEnabled } from '@/shared/api/reviewer'
import { getApps, initializeApp } from 'firebase/app'
import { connectFirestoreEmulator, doc, getFirestore, onSnapshot } from 'firebase/firestore'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import type { Changes } from '.'

const appName = reviewerEnabled ? 'local-reviewer' : 'renewal-workbench'
const app = getApps().find(item => item.name === appName) ?? initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  projectId: reviewerEnabled ? 'demo-renewal-reviewer' : process.env.NEXT_PUBLIC_FIRESTORE_PROJECT_ID || 'customer-renewal-workbench',
}, appName)
const emulator = reviewerEnabled ? '127.0.0.1:8185' : process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST
const siteKey = process.env.NEXT_PUBLIC_APP_CHECK_SITE_KEY
if (siteKey && !emulator) {
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true })
}
const db = getFirestore(app, reviewerEnabled ? '(default)' : process.env.NEXT_PUBLIC_FIRESTORE_DATABASE || '(default)')
if (emulator) {
  const { hostname, port } = new URL(`http://${emulator}`)
  connectFirestoreEmulator(db, hostname, Number(port))
}

export function subscribeBoard(
  receive: (changes: Changes, cached: boolean) => void,
  failed: () => void,
) {
  return onSnapshot(doc(db, 'workbenches/shared'), { includeMetadataChanges: true }, snapshot => {
    const changes = snapshot.exists() ? snapshot.get('changes') as Changes : {}
    receive(changes, snapshot.metadata.fromCache)
  }, failed)
}
