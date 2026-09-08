import { apiFetch } from '@/composables/useApi';
import { encodeJson } from '@/composables/useMenuApi';

export async function listActions() {
    const res = await apiFetch('/system/action');
    return res?.data || [];
}

export async function createAction({ kode, nm_action, deskripsi, menus }) {
    return apiFetch('/system/action', {
        method: 'POST',
        data: {
            kode,
            nm_action,
            deskripsi,
            menus: menus ? encodeJson(menus) : undefined
        }
    });
}

export async function updateAction({ kd_action, kode, nm_action, deskripsi, menus }) {
    return apiFetch('/system/action', {
        method: 'PUT',
        data: {
            kd_action,
            kode,
            nm_action,
            deskripsi,
            menus: menus ? encodeJson(menus) : undefined
        }
    });
}

export async function deleteAction(kd_action) {
    return apiFetch('/system/action', { method: 'DELETE', data: { kd_action } });
}
