import { apiFetch } from '@/composables/useApi';

export async function forgotPassword(username_or_email) {
    const res = await apiFetch('/auth/forgot-password', {
        method: 'POST',
        data: { username_or_email }
    });
    return res?.data || res;
}

export async function resetPassword({ token, new_password, confirm_password }) {
    const res = await apiFetch('/auth/reset-password', {
        method: 'POST',
        data: { token, new_password, confirm_password }
    });
    return res?.data || res;
}

export async function changeExpiredPassword({ change_token, new_password, confirm_password }) {
    const res = await apiFetch('/auth/password/expired', {
        method: 'POST',
        data: { change_token, new_password, confirm_password }
    });
    return res?.data || res;
}
