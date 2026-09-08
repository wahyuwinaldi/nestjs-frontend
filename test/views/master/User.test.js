import User from '@/views/master/User.vue';
import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clickAllButtons, clickByText, interactFormControls, primeStubs, setupState } from '../../helpers/mount';

const listUsersAdmin = vi.fn();
const listUserRoles = vi.fn();
const createUser = vi.fn();
const updateUser = vi.fn();
const deleteUser = vi.fn();
const unlockUser = vi.fn();
const sendUserResetEmail = vi.fn();
const toastAdd = vi.fn();

vi.mock('@/composables/useUser', () => ({
    listUsersAdmin: (...a) => listUsersAdmin(...a),
    listUserRoles: (...a) => listUserRoles(...a),
    createUser: (...a) => createUser(...a),
    updateUser: (...a) => updateUser(...a),
    deleteUser: (...a) => deleteUser(...a),
    unlockUser: (...a) => unlockUser(...a),
    sendUserResetEmail: (...a) => sendUserResetEmail(...a)
}));
vi.mock('@/composables/usePermission', () => ({ hasMenuPermission: () => true }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: (o) => o.accept?.() }) }));

describe('User.vue', () => {
    beforeEach(() => {
        listUsersAdmin.mockReset().mockResolvedValue([{ uid_user_system: 'u1', username: 'admin', nama: 'Admin', kd_role: 'R1', status_user: 'A' }]);
        listUserRoles.mockReset().mockResolvedValue([{ kd_role: 'R1', nm_role: 'Admin' }]);
        createUser.mockReset().mockResolvedValue({});
        updateUser.mockReset().mockResolvedValue({});
        deleteUser.mockReset().mockResolvedValue({});
        unlockUser.mockReset().mockResolvedValue({});
        sendUserResetEmail.mockReset().mockResolvedValue({ data: { message: 'ok' } });
        toastAdd.mockReset();
    });

    it('covers validation and CRUD', async () => {
        const wrapper = mount(User, { global: { plugins: [[PrimeVue, {}]], stubs: primeStubs() } });
        await vi.waitFor(() => expect(listUsersAdmin).toHaveBeenCalled());
        await clickByText(wrapper, 'Muat Ulang');
        await clickByText(wrapper, 'Tambah');
        await clickByText(wrapper, 'Batal');
        const state = setupState(wrapper);
        state.openCreate();
        await state.submitForm();
        expect(toastAdd.mock.calls.some((c) => String(c[0].detail).includes('Username'))).toBe(true);
        state.form.username = 'new';
        await state.submitForm();
        expect(toastAdd.mock.calls.some((c) => String(c[0].detail).includes('Nama'))).toBe(true);
        state.form.nama = 'New User';
        state.form.kd_role = 'R1';
        await state.submitForm();
        expect(toastAdd.mock.calls.some((c) => String(c[0].detail).includes('Password wajib'))).toBe(true);
        state.form.password = 'weak';
        await state.submitForm();
        expect(toastAdd.mock.calls.some((c) => String(c[0].severity) === 'warn')).toBe(true);
        state.form.password = 'Newpass1!';
        await state.submitForm();
        expect(createUser).toHaveBeenCalled();

        state.openCreate();
        state.form.username = 'x';
        state.form.nama = 'X';
        state.form.kd_role = '';
        await state.submitForm();
        state.openEdit({ uid_user_system: 'u1', username: 'admin', nama: 'Admin', kd_role: 'R1', status_user: 'A' });
        state.form.status = false;
        state.form.password = 'Newpass1!';
        await state.submitForm();
        expect(updateUser).toHaveBeenCalled();
        await state.askDelete({ uid_user_system: 'u1', username: 'admin' });
        expect(deleteUser).toHaveBeenCalledWith('u1');
        await state.toggleStatus({ uid_user_system: 'u1', status_user: 'A' });
        expect(state.statusLabel({ status_user: 'A' })).toBe('Aktif');
        expect(state.statusLabel({ status_user: 'N' })).toBe('Nonaktif');
        expect(state.statusLabel({ is_deleted: true })).toBe('Dihapus');
        expect(state.statusLabel({ is_locked: true })).toBe('Terkunci');
        expect(state.statusSeverity({ status_user: 'N' })).toBe('warn');
        expect(state.statusSeverity({ status_user: 'A' })).toBeTruthy();
        expect(state.statusSeverity({ is_locked: true })).toBe('danger');
        await state.askUnlock({ uid_user_system: 'u1', username: 'admin' });
        expect(unlockUser).toHaveBeenCalledWith('u1');
        await state.askSendResetEmail({ uid_user_system: 'u1', username: 'admin', email: null });
        expect(sendUserResetEmail).not.toHaveBeenCalled();
        await state.askSendResetEmail({ uid_user_system: 'u1', username: 'admin', email: 'a@b.c' });
        expect(sendUserResetEmail).toHaveBeenCalledWith('u1');
        await state.toggleStatus({ uid_user_system: 'u1', status_user: 'N' });
        state.openEdit({ uid_user_system: 'u1' });
        updateUser.mockRejectedValueOnce(new Error('fail'));
        await state.toggleStatus({ uid_user_system: 'u1', status_user: 'A' });
        createUser.mockRejectedValueOnce(new Error('fail'));
        state.openCreate();
        state.form.username = 'x';
        state.form.nama = 'X';
        state.form.kd_role = 'R1';
        state.form.password = 'Newpass1!';
        await state.submitForm();
        deleteUser.mockRejectedValueOnce(new Error('fail'));
        await state.askDelete({ uid_user_system: 'u1', username: 'admin' });
        listUsersAdmin.mockRejectedValueOnce(new Error('fail'));
        await state.loadData();
        state.openCreate();
        await wrapper.vm.$nextTick();
        await interactFormControls(wrapper);
        await clickAllButtons(wrapper);
        wrapper.unmount();
    });
});
