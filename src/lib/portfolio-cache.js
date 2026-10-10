/** Complete portfolio snapshots, separate from the localStorage auth quota. */
export function createPortfolioCache({ database = () => globalThis.indexedDB, now = Date.now, ttl = 15 * 60 * 1000, timeout = 1000 } = {}) {
  let generation = 0;
  let writes = Promise.resolve();
  function transact(mode, action) {
    return new Promise(resolve => {
      let db, transaction, settled = false, result = null;
      const finish = value => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        db?.close();
        resolve(value);
      };
      const timer = setTimeout(() => {
        try { transaction?.abort(); } catch { /* already completed */ }
        finish(null);
      }, timeout);
      try {
        const request = database()?.open('stratos-portfolio-v1', 1);
        if (!request) return finish(null);
        request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
        request.onerror = () => finish(null);
        request.onblocked = () => finish(null);
        request.onsuccess = () => {
          db = request.result;
          if (settled) { db.close(); return; }
          try {
            transaction = db.transaction('snapshots', mode);
            transaction.oncomplete = () => finish(result);
            transaction.onabort = transaction.onerror = () => finish(null);
            const operation = action(transaction.objectStore('snapshots'));
            operation.onsuccess = () => { result = mode === 'readonly' ? operation.result : true; };
          } catch { finish(null); }
        };
      } catch { finish(null); }
    });
  }
  return {
    scope(key) {
      const sessionGeneration = generation;
      return {
        async read() {
          if (sessionGeneration !== generation) return null;
          const entry = await transact('readonly', store => store.get(key));
          if (sessionGeneration !== generation || !entry || entry.version !== 1 ||
              !Number.isFinite(entry.savedAt) || now() - entry.savedAt > ttl || entry.savedAt > now() ||
              !Array.isArray(entry.rows) || !entry.rows.every(row => row?.id)) return null;
          return entry.rows;
        },
        write(rows) {
          if (!Array.isArray(rows) || sessionGeneration !== generation) return Promise.resolve(null);
          writes = writes.then(() => sessionGeneration === generation
            ? transact('readwrite', store => store.put({ version: 1, savedAt: now(), rows }, key)) : null);
          return writes;
        },
      };
    },
    clear() {
      // Old scopes cannot repopulate a cache after logout, even if their network
      // requests resolve late. Clear runs after any already-started transaction.
      generation++;
      writes = writes.then(() => transact('readwrite', store => store.clear()));
      return writes;
    },
  };
}

export const portfolioCache = createPortfolioCache();
