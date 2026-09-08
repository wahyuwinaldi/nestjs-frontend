import { apiFetch } from '@/composables/useApi';

/**
 * Ganti password user yang sedang login.
 * @param {{ current_password: string, new_password: string, confirm_password: string }} payload
 */
export async function changePassword(payload) {
    const response = await apiFetch('/auth/password', {
        method: 'PUT',
        data: payload
    });
    if (response?.success === false) {
        throw new Error(response.error || response.message || 'Gagal mengubah password');
    }
    return response?.data ?? response;
}
