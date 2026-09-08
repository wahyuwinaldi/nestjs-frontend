import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock('axios', () => ({
    default: {
        create: () => mockRequest,
        isAxiosError: (err) => Boolean(err?.isAxiosError)
    }
}));

import { API_BASE_URL, apiFetch } from '@/composables/useApi';
import { setEncryptedItem } from '@/utils/encryption';

function axiosError(partial) {
    return { isAxiosError: true, ...partial };
}

describe('apiFetch', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        mockRequest.mockReset();
        setEncryptedItem('session', { uid: 'u1' });
        setEncryptedItem('menu', []);
        setEncryptedItem('akses', []);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('exports API_BASE_URL and returns response.data', async () => {
        expect(typeof API_BASE_URL).toBe('string');
        mockRequest.mockResolvedValue({ data: { success: true, data: { ok: 1 } } });
        await expect(apiFetch('/master/tipe')).resolves.toEqual({ success: true, data: { ok: 1 } });
        expect(mockRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                url: '/master/tipe',
                headers: expect.not.objectContaining({ 'Content-Type': 'application/json' })
            })
        );
    });

    it('sets JSON content-type when sending a body', async () => {
        mockRequest.mockResolvedValue({ data: { success: true } });
        await apiFetch('/master/tipe', { method: 'POST', data: { nm: 'A' } });
        expect(mockRequest.mock.calls[0][0].headers['Content-Type']).toBe('application/json');
    });

    it('drops content-type for FormData bodies', async () => {
        mockRequest.mockResolvedValue({ data: { success: true } });
        const form = new FormData();
        form.append('file', new Blob(['x']), 'a.txt');
        await apiFetch('/upload', { method: 'POST', data: form, headers: { 'Content-Type': 'application/json' } });
        expect(mockRequest.mock.calls[0][0].headers['Content-Type']).toBeUndefined();
    });

    it('normalizes network, timeout and status errors', async () => {
        mockRequest.mockRejectedValueOnce(axiosError({ code: 'ERR_NETWORK' }));
        await expect(apiFetch('/x')).rejects.toThrow(/tidak dapat terhubung/);

        mockRequest.mockRejectedValueOnce(axiosError({ code: 'ERR_CONNECTION_REFUSED' }));
        await expect(apiFetch('/x')).rejects.toThrow(/tidak dapat terhubung/);

        mockRequest.mockRejectedValueOnce(axiosError({ code: 'ECONNABORTED' }));
        await expect(apiFetch('/x')).rejects.toThrow(/timeout/);

        mockRequest.mockRejectedValueOnce(axiosError({ response: { status: 403, data: {} } }));
        await expect(apiFetch('/x')).rejects.toThrow(/Tidak memiliki akses/);

        mockRequest.mockRejectedValueOnce(axiosError({ response: { status: 404, data: { message: 'missing' } } }));
        await expect(apiFetch('/x')).rejects.toThrow('missing');

        mockRequest.mockRejectedValueOnce(axiosError({ response: { status: 404, data: {} } }));
        await expect(apiFetch('/x')).rejects.toThrow(/Endpoint tidak ditemukan/);

        mockRequest.mockRejectedValueOnce(axiosError({ response: { status: 401, data: {} } }));
        await expect(apiFetch('/auth/logout')).rejects.toThrow(/Sesi tidak valid/);

        mockRequest.mockRejectedValueOnce(axiosError({ response: { status: 401, data: {} } }));
        await expect(apiFetch('')).rejects.toThrow(/Sesi tidak valid/);

        mockRequest.mockRejectedValueOnce(axiosError({ response: { status: 500, data: {} } }));
        await expect(apiFetch('/x')).rejects.toThrow(/kesalahan pada server/);

        mockRequest.mockRejectedValueOnce(axiosError({ response: { status: 422, data: { error: 'bad' } } }));
        await expect(apiFetch('/x')).rejects.toThrow('bad');

        mockRequest.mockRejectedValueOnce(axiosError({ message: 'oops' }));
        await expect(apiFetch('/x')).rejects.toThrow('oops');
    });

    it('clears local session on 401 except auth endpoints', async () => {
        const listener = vi.fn();
        globalThis.addEventListener('session-expired', listener);

        mockRequest.mockRejectedValueOnce(axiosError({ response: { status: 401, data: { error: 'expired' } } }));
        await expect(apiFetch('/master/user')).rejects.toMatchObject({ message: 'expired', status: 401 });
        expect(sessionStorage.getItem('session_expired_notice')).toBe('1');
        expect(localStorage.getItem('session')).toBeNull();
        expect(listener).toHaveBeenCalled();

        setEncryptedItem('session', { uid: 'u1' });
        mockRequest.mockRejectedValueOnce(axiosError({ response: { status: 401, data: {} } }));
        await expect(apiFetch('/auth/authorize', { method: 'POST', data: {} })).rejects.toThrow(/Sesi tidak valid/);
        expect(localStorage.getItem('session')).toBeTruthy();

        globalThis.removeEventListener('session-expired', listener);
    });

    it('rethrows non-axios errors', async () => {
        mockRequest.mockRejectedValueOnce(new Error('boom'));
        await expect(apiFetch('/x')).rejects.toThrow('boom');

        mockRequest.mockRejectedValueOnce('string-fail');
        await expect(apiFetch('/x')).rejects.toThrow(/tidak diketahui/);
    });

    it('drops json content-type when there is no body and ignores notice storage errors', async () => {
        mockRequest.mockResolvedValue({ data: { success: true } });
        await apiFetch('/master/tipe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
        expect(mockRequest.mock.calls.at(-1)[0].headers['Content-Type']).toBeUndefined();

        const orig = sessionStorage.setItem.bind(sessionStorage);
        sessionStorage.setItem = () => {
            throw new Error('blocked');
        };
        mockRequest.mockRejectedValueOnce(axiosError({ response: { status: 401, data: { error: 'expired' } } }));
        await expect(apiFetch('/master/user')).rejects.toMatchObject({ status: 401 });
        sessionStorage.setItem = orig;
    });
});
