export class IdbORM {
  constructor(dbName, version = 1) {
    this.dbName = dbName
    this.version = version
    this.db = null
  }

  async init(stores = []) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onupgradeneeded = (event) => {
        this.db = event.target.result
        stores.forEach((store) => {
          if (!this.db.objectStoreNames.contains(store.name)) {
            console.log('Creating store', store.name)
            const objectStore = this.db.createObjectStore(store.name, {
              keyPath: store.keyPath || 'id',
              autoIncrement: store.autoIncrement || true,
            })

            if (store.indices) {
              store.indices.forEach((index) =>
                objectStore.createIndex(index.name, index.keyPath, {
                  unique: index.unique || false,
                })
              )
            }
          } else {
            // Update existing store
            const objectStore = event.target.transaction.objectStore(store.name)
            if (store.indices) {
              store.indices.forEach((index) => {
                if (!objectStore.indexNames.contains(index.name)) {
                  objectStore.createIndex(index.name, index.keyPath, {
                    unique: index.unique || false,
                  })
                }
              })
            }
          }
        })
      }

      request.onsuccess = (event) => {
        this.db = event.target.result
        resolve(this.db)
      }

      request.onerror = (event) => {
        reject(event.target.error)
      }
    })
  }

  async create(storeName, data) {
    if (!this.db) return
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.add(data)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async read(storeName, key) {
    if (!this.db) return
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.get(key)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async update(storeName, data) {
    if (!this.db) return
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.put(data)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async delete(storeName, key) {
    if (!this.db) return
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.delete(key)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async getAll(storeName) {
    if (!this.db) return
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
}
