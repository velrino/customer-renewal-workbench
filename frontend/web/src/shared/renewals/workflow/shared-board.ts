import { getApps, initializeApp } from 'firebase/app'
import { connectFirestoreEmulator, doc, getFirestore, onSnapshot } from 'firebase/firestore'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import type { Changes } from '.'

const appName = 'renewal-workbench'
const app = getApps().find(item => item.name === appName) ?? initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  projectId: process.env.NEXT_PUBLIC_FIRESTORE_PROJECT_ID || 'customer-renewal-workbench',
}, appName)
const emulator = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST
const siteKey = process.env.NEXT_PUBLIC_APP_CHECK_SITE_KEY
if (siteKey && !emulator) {
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true })
}
const db = getFirestore(app, process.env.NEXT_PUBLIC_FIRESTORE_DATABASE || '(default)')
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
