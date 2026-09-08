import { apiFetch } from '@/composables/useApi';

export async function listUsersAdmin() {
    const res = await apiFetch('/master/user');
    return res?.data || [];
}

export async function listUserRoles() {
    const res = await apiFetch('/master/user/roles');
    return res?.data || [];
}

export async function createUser(payload) {
    return apiFetch('/master/user', { method: 'POST', data: payload });
}

export async function updateUser(payload) {
    return apiFetch('/master/user', { method: 'PUT', data: payload });
}

export async function deleteUser(uid_user_system) {
    return apiFetch('/master/user', { method: 'DELETE', data: { uid_user_system } });
}

export async function unlockUser(uid_user_system) {
    return apiFetch('/master/user/unlock', { method: 'POST', data: { uid_user_system } });
}

export async function sendUserResetEmail(uid_user_system) {
    return apiFetch('/master/user/send-reset-email', { method: 'POST', data: { uid_user_system } });
}
