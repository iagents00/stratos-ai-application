export function memoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(String(key)) ?? null,
    setItem: (key, value) => values.set(String(key), String(value)),
    removeItem: key => values.delete(String(key)),
    clear: () => values.clear(),
  };
}

export function installGuestBoundary(target) {
  const deny = () => { throw new Error('La demo no conecta con servicios externos.'); };
  // Do not read or clear the enterprise session, caches or any real storage.
  // Fail closed if the host refuses a boundary: the application never mounts.
  for (const name of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(target, name, { value: memoryStorage(), writable: false, configurable: false });
  }
  Object.defineProperty(target, 'Capacitor', { value: undefined, writable: false, configurable: false });
  for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'Worker', 'SharedWorker']) {
    Object.defineProperty(target, name, { value: deny, writable: false, configurable: false });
  }
  Object.defineProperty(target, 'indexedDB', { value: undefined, writable: false, configurable: false });
  target.open = () => null;
  if (target.navigator?.sendBeacon) target.navigator.sendBeacon = () => false;
}
