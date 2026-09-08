/**
 * Local-only obfuscation for session/menu/akses in localStorage.
 * NOT a security boundary (key is in the bundle) — only prevents casual inspection.
 * Implemented without crypto-js because that package's UMD wrapper breaks under Vite 8 ESM
 * (`root is undefined` / no default export).
 */

const SECRET_KEY = import.meta.env.VITE_ENCRYPTION_SECRET_KEY || 'default-secret-key-32-chars-long!!';

function toBytes(str) {
    return new TextEncoder().encode(str);
}

function fromBytes(bytes) {
    return new TextDecoder().decode(bytes);
}

function xorBytes(data, keyBytes) {
    const out = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i += 1) {
        out[i] = data[i] ^ keyBytes[i % keyBytes.length];
    }
    return out;
}

function bytesToBase64(bytes) {
    let binary = '';
    bytes.forEach((b) => {
        binary += String.fromCharCode(b);
    });
    return btoa(binary);
}

function base64ToBytes(base64) {
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        out[i] = binary.charCodeAt(i);
    }
    return out;
}

/**
 * Encrypt arbitrary JSON-serializable data (XOR + base64).
 * @param {unknown} data
 * @returns {string}
 */
export function encryptData(data) {
    const jsonString = JSON.stringify(data);
    const keyBytes = toBytes(SECRET_KEY);
    const xored = xorBytes(toBytes(jsonString), keyBytes);
    return bytesToBase64(xored);
}

/**
 * Decrypt a string previously produced by encryptData().
 * @param {string} encryptedData
 * @returns {unknown}
 */
export function decryptData(encryptedData) {
    try {
        const keyBytes = toBytes(SECRET_KEY);
        const xored = base64ToBytes(encryptedData);
        const jsonString = fromBytes(xorBytes(xored, keyBytes));
        return JSON.parse(jsonString);
    } catch {
        throw new Error('Failed to decrypt data - invalid key or corrupted data');
    }
}

/**
 * Encrypt + persist a value under `key` in localStorage.
 * @param {string} key
 * @param {unknown} data
 */
export function setEncryptedItem(key, data) {
    try {
        localStorage.setItem(key, encryptData(data));
    } catch (error) {
        console.error(`Error setting encrypted item ${key}:`, error);
    }
}

/**
 * Read + decrypt a value from localStorage. Returns null when missing or
 * when decryption fails (and removes the corrupt entry).
 * @param {string} key
 * @returns {unknown}
 */
export function getEncryptedItem(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return decryptData(raw);
    } catch (error) {
        console.error(`Error getting encrypted item ${key}:`, error);
        localStorage.removeItem(key);
        return null;
    }
}

/**
 * Remove a localStorage entry.
 * @param {string} key
 */
export function removeEncryptedItem(key) {
    localStorage.removeItem(key);
}
