import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/composables/useApi', () => ({
    apiFetch: vi.fn()
}));

import { apiFetch } from '@/composables/useApi';
import { changePassword } from '@/composables/useAccount';
import { createAction, deleteAction, listActions, updateAction } from '@/composables/useActionApi';
import { createMenu, deleteMenu, encodeJson, listMenuAdminFlat, listMenuAdminTree, saveMenuBoard, updateMenu } from '@/composables/useMenuApi';
import {
    createPermission,
    createPermissionPrivate,
    deletePermission,
    deletePermissionPrivate,
    getActionEdit,
    getActionEditPrivate,
    getActionEditRolePrivate,
    listPermissionGrouped,
    listPermissionPrivateGrouped,
    listRolesWithoutPermission,
    listUsersWithoutPrivate,
    updatePermission,
    updatePermissionPrivate
} from '@/composables/usePermissionApi';
import { createSetting, deleteSetting, getPublicTheme, getSetting, listSettings, saveTheme, updateSetting } from '@/composables/useSettingsApi';
import { createUser, deleteUser, listUserRoles, listUsersAdmin, sendUserResetEmail, unlockUser, updateUser } from '@/composables/useUser';

describe('thin API wrappers', () => {
    beforeEach(() => {
        apiFetch.mockReset();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('useUser / useAccount', async () => {
        apiFetch.mockResolvedValue({ data: [{ id: 1 }] });
        await expect(listUsersAdmin()).resolves.toEqual([{ id: 1 }]);
        await expect(listUserRoles()).resolves.toEqual([{ id: 1 }]);
        await createUser({ uid: '1' });
        await updateUser({ uid: '1' });
        await deleteUser('u1');
        await unlockUser('u1');
        await sendUserResetEmail('u1');

        apiFetch.mockResolvedValueOnce({ success: true, data: { message: 'ok' } });
        await expect(changePassword({ current_password: 'a', new_password: 'b', confirm_password: 'b' })).resolves.toEqual({
            message: 'ok'
        });
        apiFetch.mockResolvedValueOnce({ success: false, error: 'wrong' });
        await expect(changePassword({ current_password: 'a', new_password: 'b', confirm_password: 'b' })).rejects.toThrow('wrong');
        apiFetch.mockResolvedValueOnce({ success: true });
        await expect(changePassword({ current_password: 'a', new_password: 'b', confirm_password: 'b' })).resolves.toEqual({
            success: true
        });
        apiFetch.mockResolvedValueOnce({ success: false });
        await expect(changePassword({ current_password: 'a', new_password: 'b', confirm_password: 'b' })).rejects.toThrow(/Gagal mengubah password/);
        apiFetch.mockResolvedValue({});
        await expect(listUsersAdmin()).resolves.toEqual([]);
        await expect(listUserRoles()).resolves.toEqual([]);

        expect(apiFetch).toHaveBeenCalledWith('/master/user');
        expect(apiFetch).toHaveBeenCalledWith('/master/user', { method: 'DELETE', data: { uid_user_system: 'u1' } });
        expect(apiFetch).toHaveBeenCalledWith('/master/user/unlock', { method: 'POST', data: { uid_user_system: 'u1' } });
        expect(apiFetch).toHaveBeenCalledWith('/master/user/send-reset-email', {
            method: 'POST',
            data: { uid_user_system: 'u1' }
        });
        expect(apiFetch).toHaveBeenCalledWith('/auth/password', expect.objectContaining({ method: 'PUT' }));
    });

    it('useMenuApi encode/save and CRUD', async () => {
        expect(JSON.parse(atob(encodeJson([{ a: 1 }])))).toEqual([{ a: 1 }]);
        apiFetch.mockResolvedValue({ data: [{ kd_menu: '1' }] });
        await expect(listMenuAdminTree()).resolves.toEqual([{ kd_menu: '1' }]);
        await expect(listMenuAdminFlat()).resolves.toEqual([{ kd_menu: '1' }]);
        await createMenu({ nm_menu: 'A' });
        await updateMenu({ kd_menu: '1' });
        await deleteMenu('1');
        await expect(saveMenuBoard([])).rejects.toThrow(/Tidak ada menu/);
        apiFetch.mockResolvedValueOnce({ data: { gagal: ['MN1'] } });
        await expect(saveMenuBoard([{ kd_menu: 'MN1', nm_menu: 'A', children: [] }])).rejects.toThrow(/gagal disimpan/);
        apiFetch.mockResolvedValueOnce({ data: { gagal: [] } });
        await expect(saveMenuBoard([{ kd_menu: 'MN1', nm_menu: 'A', children: [] }])).resolves.toMatchObject({ data: { gagal: [] } });
        apiFetch.mockResolvedValueOnce({ success: true });
        await expect(listMenuAdminTree()).resolves.toEqual([]);
        apiFetch.mockResolvedValueOnce({});
        await expect(listMenuAdminFlat()).resolves.toEqual([]);
    });

    it('useActionApi / usePermissionApi / useSettingsApi', async () => {
        apiFetch.mockResolvedValue({ data: [{ id: 1 }] });
        await expect(listActions()).resolves.toEqual([{ id: 1 }]);
        await createAction({ kode: 'AC', nm_action: 'Access', deskripsi: '', menus: ['1'] });
        await createAction({ kode: 'AC', nm_action: 'Access', deskripsi: '' });
        await updateAction({ kd_action: '1', kode: 'AC', nm_action: 'Access', deskripsi: '', menus: ['1'] });
        await updateAction({ kd_action: '1', kode: 'AC', nm_action: 'Access', deskripsi: '' });
        await deleteAction('1');

        await expect(listPermissionGrouped()).resolves.toEqual([{ id: 1 }]);
        await expect(listRolesWithoutPermission()).resolves.toEqual([{ id: 1 }]);
        await expect(getActionEdit('R1')).resolves.toEqual([{ id: 1 }]);
        await createPermission('Admin', [{ menu: '1', akses: 'AC' }]);
        await updatePermission('R1', [{ menu: '1', akses: 'AC' }], 'Admin');
        await updatePermission('R1', [{ menu: '1', akses: 'AC' }]);
        await deletePermission('R1');
        await expect(listPermissionPrivateGrouped()).resolves.toEqual([{ id: 1 }]);
        await expect(listUsersWithoutPrivate()).resolves.toEqual([{ id: 1 }]);
        await expect(getActionEditPrivate('u1')).resolves.toEqual([{ id: 1 }]);
        await expect(getActionEditRolePrivate('u1')).resolves.toEqual([{ id: 1 }]);
        await createPermissionPrivate('u1', []);
        await updatePermissionPrivate('u1', []);
        await deletePermissionPrivate('u1');

        await expect(listSettings()).resolves.toEqual([{ id: 1 }]);
        await expect(getSetting('s1')).resolves.toEqual([{ id: 1 }]);
        apiFetch.mockResolvedValueOnce({});
        await expect(listActions()).resolves.toEqual([]);
        apiFetch.mockResolvedValueOnce({});
        await expect(listPermissionGrouped()).resolves.toEqual([]);
        apiFetch.mockResolvedValueOnce({});
        await expect(listRolesWithoutPermission()).resolves.toEqual([]);
        apiFetch.mockResolvedValueOnce({});
        await expect(getActionEdit('R1')).resolves.toEqual([]);
        apiFetch.mockResolvedValueOnce({});
        await expect(listPermissionPrivateGrouped()).resolves.toEqual([]);
        apiFetch.mockResolvedValueOnce({});
        await expect(listUsersWithoutPrivate()).resolves.toEqual([]);
        apiFetch.mockResolvedValueOnce({});
        await expect(getActionEditPrivate('u1')).resolves.toEqual([]);
        apiFetch.mockResolvedValueOnce({});
        await expect(getActionEditRolePrivate('u1')).resolves.toEqual([]);
        apiFetch.mockResolvedValueOnce({});
        await expect(listSettings()).resolves.toEqual([]);
        apiFetch.mockResolvedValueOnce({});
        await expect(getSetting('s1')).resolves.toBeNull();
        apiFetch.mockResolvedValue({ success: true });
        await createSetting({ nm_settings: 'A', kode: 'a', value: new File(['x'], 'a.png') });
        await createSetting({ nm_settings: 'A', kode: 'a' });
        await updateSetting({ id_settings: '1', nm_settings: 'A', kode: 'a', value: new File(['x'], 'a.png') });
        await updateSetting({ id_settings: '1', nm_settings: 'A', kode: 'a' });
        await deleteSetting('1');
        apiFetch.mockResolvedValueOnce({ data: { primary: 'emerald', surface: null, preset: 'Aura', menuMode: 'static' } });
        await expect(getPublicTheme()).resolves.toEqual({ primary: 'emerald', surface: null, preset: 'Aura', menuMode: 'static' });
        apiFetch.mockResolvedValueOnce({});
        await expect(getPublicTheme()).resolves.toBeNull();
        apiFetch.mockResolvedValueOnce({ data: { primary: 'blue', surface: 'slate', preset: 'Lara', menuMode: 'overlay' } });
        await expect(saveTheme({ primary: 'blue', surface: 'slate', preset: 'Lara', menuMode: 'overlay' })).resolves.toEqual({
            primary: 'blue',
            surface: 'slate',
            preset: 'Lara',
            menuMode: 'overlay'
        });
        apiFetch.mockResolvedValueOnce({});
        await expect(saveTheme({ primary: 'blue', surface: null, preset: 'Aura', menuMode: 'static' })).resolves.toBeNull();
    });
});
