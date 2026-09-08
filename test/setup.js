/**
 * Node 22+ exposes experimental `localStorage` that is undefined unless
 * `--localstorage-file` is set, which shadows jsdom's implementation.
 */
function createMemoryStorage() {
    const store = new Map();
    return {
        getItem(key) {
            const k = String(key);
            return store.has(k) ? store.get(k) : null;
        },
        setItem(key, value) {
            store.set(String(key), String(value));
        },
        removeItem(key) {
            store.delete(String(key));
        },
        clear() {
            store.clear();
        },
        key(index) {
            return [...store.keys()][index] ?? null;
        },
        get length() {
            return store.size;
        }
    };
}

const storageOk = typeof globalThis.localStorage?.clear === 'function';
if (!storageOk) {
    Object.defineProperty(globalThis, 'localStorage', {
        value: createMemoryStorage(),
        configurable: true,
        writable: true
    });
}

if (typeof globalThis.sessionStorage?.clear !== 'function') {
    Object.defineProperty(globalThis, 'sessionStorage', {
        value: createMemoryStorage(),
        configurable: true,
        writable: true
    });
}
