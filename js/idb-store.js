/* exported NexusIDB */
// Almacén duradero en IndexedDB (sin el límite de ~5 MB de localStorage ni bloquear el navegador).
// Guarda cadenas por clave. Si IndexedDB no existe (modo privado de algunos navegadores), available() es false.
const NexusIDB = (() => {
  const DB_NAME = 'nexus-orb';
  const STORE = 'kv';
  /** @type {Promise<IDBDatabase> | null} */
  let dbPromise = null;

  function available() {
    try {
      return typeof indexedDB !== 'undefined' && indexedDB !== null;
    } catch (e) {
      return false;
    }
  }

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('IndexedDB bloqueado por otra pestaña'));
      }).catch(err => {
        dbPromise = null;
        throw err;
      });
    }
    return dbPromise;
  }

  function run(mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    }));
  }

  return {
    available,
    get: key => run('readonly', store => store.get(key)),
    set: (key, value) => run('readwrite', store => store.put(value, key)),
    remove: key => run('readwrite', store => store.delete(key))
  };
})();
