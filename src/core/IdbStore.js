export class IdbStore {
  constructor({ dbName = "specforge-cache", storeName = "kv", version = 1 } = {}) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.version = version;
    this.dbPromise = null;
  }

  async open() {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, this.version);

        request.onerror = () => reject(new Error("Failed to open IndexedDB"));
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName);
          }
        };
        request.onsuccess = () => resolve(request.result);
      });
    }

    return this.dbPromise;
  }

  async get(key) {
    const db = await this.open();
    return this.runTransaction(db, "readonly", (store) => store.get(key));
  }

  async set(key, value) {
    const db = await this.open();
    await this.runTransaction(db, "readwrite", (store) => store.put(value, key));
  }

  async put(key, value) {
    await this.set(key, value);
  }

  async delete(key) {
    const db = await this.open();
    await this.runTransaction(db, "readwrite", (store) => store.delete(key));
  }

  async clear() {
    const db = await this.open();
    await this.runTransaction(db, "readwrite", (store) => store.clear());
  }

  async clearAll() {
    await this.clear();
  }

  runTransaction(db, mode, operation) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, mode);
      const store = transaction.objectStore(this.storeName);
      const request = operation(store);

      request.onerror = () => reject(new Error("IndexedDB request failed"));
      request.onsuccess = () => resolve(request.result);

      transaction.onerror = () => reject(new Error("IndexedDB transaction failed"));
    });
  }
}
