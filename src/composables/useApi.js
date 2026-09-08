import axios from 'axios';
import { removeEncryptedItem } from '@/utils/encryption';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const APP_KEY = import.meta.env.VITE_APP_KEY || '';
const SESSION_EXPIRED_NOTICE_KEY = 'session_expired_notice';

export const API_BASE_URL = BASE_URL;

// `withCredentials: true` is required so the browser sends the httpOnly
// "token" cookie set by POST /auth/authorize back on every subsequent
// request. `x-api-key` matches the backend's ApiKeyGuard (API_TOKEN); it is
// only enforced on non-@Public() routes, so sending it always is harmless.
const apiClient = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
    headers: {
        Accept: 'application/json',
        'x-api-key': APP_KEY
    }
});

function normalizeErrorMessage(error) {
    if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
        return 'Network Error: tidak dapat terhubung ke server API.';
    }
    if (error.code === 'ECONNABORTED') {
        return 'Request timeout: server tidak merespons.';
    }

    const status = error.response?.status;
    const backendError = error.response?.data?.error;
    const backendMessage = error.response?.data?.message;
    const message = backendError || backendMessage;

    if (status === 401) return message || 'Sesi tidak valid atau telah berakhir.';
    if (status === 403) return message || 'Tidak memiliki akses.';
    if (status === 404) return message || 'Endpoint tidak ditemukan.';
    if (status && status >= 500) return message || 'Terjadi kesalahan pada server.';

    return message || error.message || 'Terjadi kesalahan yang tidak diketahui';
}

function isAuthExemptPath(path) {
    const p = String(path || '');
    return (
        p.includes('/auth/authorize') ||
        p.includes('/auth/logout') ||
        p.includes('/auth/login') ||
        p.includes('/auth/forgot-password') ||
        p.includes('/auth/reset-password') ||
        p.includes('/auth/password/expired')
    );
}

/** Hindari circular import dengan useSession: clear lokal + flag notice. */
function handleUnauthorizedLocally() {
    try {
        sessionStorage.setItem(SESSION_EXPIRED_NOTICE_KEY, '1');
    } catch {
        // ignore
    }
    removeEncryptedItem('session');
    removeEncryptedItem('menu');
    removeEncryptedItem('akses');
    if (typeof globalThis !== 'undefined') {
        globalThis.dispatchEvent(new CustomEvent('session-expired'));
    }
}

/**
 * Thin wrapper around axios that always resolves with `response.data`
 * (the backend's `{ success, error, data }` envelope) and normalizes
 * thrown errors into a single `Error` with a human-readable message.
 * @param {string} path
 * @param {import('axios').AxiosRequestConfig} [options]
 */
export async function apiFetch(path, options = {}) {
    try {
        const isFormData = options.data instanceof FormData;
        const hasBody = options.data !== undefined && options.data !== null;
        const headers = { ...(options.headers || {}) };
        if (isFormData) {
            // Biarkan browser set multipart boundary.
            delete headers['Content-Type'];
        } else if (hasBody && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        } else if (!hasBody) {
            // Jangan kirim application/json tanpa body (Fastify menolak DELETE/GET kosong).
            delete headers['Content-Type'];
        }

        const response = await apiClient({ url: path, ...options, headers });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 401 && !isAuthExemptPath(path)) {
                handleUnauthorizedLocally();
            }
            const err = new Error(normalizeErrorMessage(error));
            err.status = error.response?.status;
            err.data = error.response?.data?.data ?? null;
            err.code = error.response?.data?.data?.code || null;
            throw err;
        }
        throw error instanceof Error ? error : new Error('Terjadi kesalahan yang tidak diketahui');
    }
}

export default apiClient;
