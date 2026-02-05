const DB_NAME = 'gamedivers'
const STORE_NAME = 'kv'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    const request = fn(store)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    return await withStore('readonly', (store) => store.get(key))
  } catch (error) {
    console.error('IDB get failed:', error)
    return null
  }
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.put(value, key))
  } catch (error) {
    console.error('IDB set failed:', error)
  }
}

export async function idbDel(key: string): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.delete(key))
  } catch (error) {
    console.error('IDB delete failed:', error)
  }
}
