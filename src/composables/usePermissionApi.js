import { apiFetch } from '@/composables/useApi';
import { encodeJson } from '@/composables/useMenuApi';

/** @param {Array<{menu:string, akses:string}>} pairs */
function encodePairs(pairs) {
    return encodeJson(pairs);
}

export async function listPermissionGrouped() {
    const res = await apiFetch('/master/permission?grouped=true');
    return res?.data || [];
}

export async function listRolesWithoutPermission() {
    const res = await apiFetch('/master/permission/role');
    return res?.data || [];
}

export async function getActionEdit(kd_role) {
    const res = await apiFetch(`/master/permission/action_edit?kd_role=${encodeURIComponent(kd_role)}`);
    return res?.data || [];
}

/** Buat role baru + permissions. */
export async function createPermission(nm_role, pairs) {
    return apiFetch('/master/permission', {
        method: 'POST',
        data: { nm_role, menu: encodePairs(pairs) }
    });
}

/** Update nama role (opsional) + replace permissions. */
export async function updatePermission(kd_role, pairs, nm_role) {
    return apiFetch('/master/permission', {
        method: 'PUT',
        data: {
            kd_role,
            menu: encodePairs(pairs),
            ...(nm_role !== undefined ? { nm_role } : {})
        }
    });
}

export async function deletePermission(kd_role) {
    return apiFetch('/master/permission', { method: 'DELETE', data: { kd_role } });
}

export async function listPermissionPrivateGrouped() {
    const res = await apiFetch('/master/permission/private?grouped=true');
    return res?.data || [];
}

export async function listUsersWithoutPrivate() {
    const res = await apiFetch('/master/permission/user_no_private');
    return res?.data || [];
}

export async function getActionEditPrivate(uid) {
    const res = await apiFetch(`/master/permission/action_edit_private?uid_user_system=${encodeURIComponent(uid)}`);
    return res?.data || [];
}

export async function getActionEditRolePrivate(uid) {
    const res = await apiFetch(`/master/permission/action_edit_role_private?uid_user_system=${encodeURIComponent(uid)}`);
    return res?.data || [];
}

export async function createPermissionPrivate(uid_user_system, pairs) {
    return apiFetch('/master/permission/private', {
        method: 'POST',
        data: { uid_user_system, menu: encodePairs(pairs) }
    });
}

export async function updatePermissionPrivate(uid_user_system, pairs) {
    return apiFetch('/master/permission/private', {
        method: 'PUT',
        data: { uid_user_system, menu: encodePairs(pairs) }
    });
}

export async function deletePermissionPrivate(uid_user_system) {
    return apiFetch('/master/permission/private', {
        method: 'DELETE',
        data: { uid_user_system }
    });
}
