import { apiFetch } from '@/composables/useApi';

export async function listSettings() {
    const res = await apiFetch('/system/settings');
    return res?.data || [];
}

export async function getSetting(id) {
    const res = await apiFetch(`/system/settings/${encodeURIComponent(id)}`);
    return res?.data || null;
}

/**
 * @param {{ nm_settings: string, kode: string, value: File }} payload
 */
export async function createSetting(payload) {
    const formData = new FormData();
    formData.append('nm_settings', payload.nm_settings);
    formData.append('kode', payload.kode);
    if (payload.value) {
        formData.append('value', payload.value);
    }
    return apiFetch('/system/settings', { method: 'POST', data: formData });
}

/**
 * @param {{ id_settings: string, nm_settings: string, kode: string, value?: File|null }} payload
 */
export async function updateSetting(payload) {
    const formData = new FormData();
    formData.append('id_settings', payload.id_settings);
    formData.append('nm_settings', payload.nm_settings);
    formData.append('kode', payload.kode);
    if (payload.value) {
        formData.append('value', payload.value);
    }
    return apiFetch('/system/settings', { method: 'PUT', data: formData });
}

export async function deleteSetting(id_settings) {
    return apiFetch('/system/settings', {
        method: 'DELETE',
        data: { id_settings }
    });
}

/** Public boot endpoint — no JWT required. */
export async function getPublicTheme() {
    const res = await apiFetch('/public/settings/theme');
    return res?.data || null;
}

/**
 * @param {{ primary: string, surface: string|null, preset: string, menuMode: string }} payload
 */
export async function saveTheme(payload) {
    const res = await apiFetch('/system/settings/theme', {
        method: 'PUT',
        data: payload
    });
    return res?.data || null;
}
