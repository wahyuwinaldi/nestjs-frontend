import { afterEach, describe, expect, it, vi } from 'vitest';
import { decryptData, encryptData, getEncryptedItem, removeEncryptedItem, setEncryptedItem } from '@/utils/encryption';

describe('encryption', () => {
    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('round-trips JSON-serializable data', () => {
        const payload = { name: 'Admin', roles: ['AC'], n: 1 };
        expect(decryptData(encryptData(payload))).toEqual(payload);
        expect(encryptData(payload)).not.toContain('Admin');
    });

    it('throws on corrupted ciphertext', () => {
        expect(() => decryptData('not-valid-base64!!!')).toThrow(/Failed to decrypt/);
        expect(() => decryptData(btoa('not-xor-json'))).toThrow(/Failed to decrypt/);
    });

    it('persists and reads encrypted localStorage items', () => {
        setEncryptedItem('session', { uid: 'u1' });
        expect(localStorage.getItem('session')).toBeTruthy();
        expect(getEncryptedItem('session')).toEqual({ uid: 'u1' });
        removeEncryptedItem('session');
        expect(getEncryptedItem('session')).toBeNull();
    });

    it('returns null and removes corrupt localStorage entries', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        localStorage.setItem('akses', 'garbage');
        expect(getEncryptedItem('akses')).toBeNull();
        expect(localStorage.getItem('akses')).toBeNull();
        expect(spy).toHaveBeenCalled();
    });

    it('logs when localStorage.setItem fails', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
            throw new Error('quota');
        });
        setEncryptedItem('menu', []);
        expect(spy).toHaveBeenCalled();
    });
});
