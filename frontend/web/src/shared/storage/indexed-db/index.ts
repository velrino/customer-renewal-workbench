// Each collection owns its database and stores records under their string ID.
export function createRecordStore<T extends { id: string }>(
  databaseName: string,
  storeName: string,
) {
  let connection: Promise<IDBDatabase> | undefined

  function open() {
    if (!connection) {
      connection = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1)
        request.onupgradeneeded = () =>
          request.result.createObjectStore(storeName, { keyPath: 'id' })
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          db.onclose = () => { connection = undefined }
          db.onversionchange = () => {
            db.onclose = null
            db.close()
            connection = undefined
          }
          resolve(db)
        }
      }).catch((error) => {
        connection = undefined
        throw error
      })
    }
    return connection
  }

  type Records = Record<string, T>

  // Read and derive the next record in one transaction, including across tabs.
  async function transact(update?: (current: Records) => T): Promise<Records> {
    const db = await open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, update ? 'readwrite' : 'readonly')
      const store = tx.objectStore(storeName)
      const read = store.getAll()
      let snapshot: Records
      let failure: unknown
      tx.oncomplete = () => resolve(snapshot)
      tx.onabort = () => reject(failure ?? tx.error)
      read.onsuccess = () => {
        try {
          snapshot = Object.fromEntries((read.result as T[]).map(record => [record.id, record]))
          if (update) {
            const record = update(snapshot)
            store.put(record)
            snapshot = { ...snapshot, [record.id]: record }
          }
        } catch (error) {
          failure = error
          tx.abort()
        }
      }
    })
  }

  return {
    readAll: () => transact(),
    update: (derive: (current: Records) => T) => transact(derive),
  }
}
