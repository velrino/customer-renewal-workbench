import { getApps, initializeApp } from 'firebase/app'
import { connectFirestoreEmulator, doc, getFirestore, onSnapshot } from 'firebase/firestore'
import type { Changes } from '.'

export type SharedBoard = { version: number; changes: Changes }

const appName = 'renewal-workbench'
const app = getApps().find(item => item.name === appName) ?? initializeApp({
  projectId: process.env.NEXT_PUBLIC_FIRESTORE_PROJECT_ID || 'customer-renewal-workbench',
}, appName)
const db = getFirestore(app)
const emulator = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST
if (emulator) {
  const { hostname, port } = new URL(`http://${emulator}`)
  connectFirestoreEmulator(db, hostname, Number(port))
}

export function subscribeBoard(
  receive: (board: SharedBoard, cached: boolean) => void,
  failed: () => void,
) {
  return onSnapshot(doc(db, 'workbenches/shared'), { includeMetadataChanges: true }, snapshot => {
    const board = snapshot.exists() ? snapshot.data() as SharedBoard : { version: 0, changes: {} }
    receive(board, snapshot.metadata.fromCache)
  }, failed)
}
