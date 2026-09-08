import PermissionPrivate from '@/views/master/PermissionPrivate.vue';
import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clickAllButtons, clickByText, interactFormControls, primeStubs, setupState } from '../../helpers/mount';

const listPermissionPrivateGrouped = vi.fn();
const listUsersWithoutPrivate = vi.fn();
const listMenuAdminTree = vi.fn();
const listActions = vi.fn();
const getActionEditPrivate = vi.fn();
const getActionEditRolePrivate = vi.fn();
const createPermissionPrivate = vi.fn();
const updatePermissionPrivate = vi.fn();
const deletePermissionPrivate = vi.fn();

vi.mock('@/composables/usePermissionApi', () => ({
    listPermissionPrivateGrouped: (...a) => listPermissionPrivateGrouped(...a),
    listUsersWithoutPrivate: (...a) => listUsersWithoutPrivate(...a),
    getActionEditPrivate: (...a) => getActionEditPrivate(...a),
    getActionEditRolePrivate: (...a) => getActionEditRolePrivate(...a),
    createPermissionPrivate: (...a) => createPermissionPrivate(...a),
    updatePermissionPrivate: (...a) => updatePermissionPrivate(...a),
    deletePermissionPrivate: (...a) => deletePermissionPrivate(...a)
}));
vi.mock('@/composables/useMenuApi', () => ({ listMenuAdminTree: (...a) => listMenuAdminTree(...a) }));
vi.mock('@/composables/useActionApi', () => ({ listActions: (...a) => listActions(...a) }));
vi.mock('@/composables/useSession', () => ({ updateSessionMenu: vi.fn() }));
vi.mock('@/composables/usePermission', () => ({ hasMenuPermission: () => true }));
const toastAdd = vi.fn();
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: (o) => o.accept?.() }) }));

describe('PermissionPrivate.vue', () => {
    beforeEach(() => {
        listPermissionPrivateGrouped.mockReset().mockResolvedValue([{ uid_user_system: 'u1', username: 'admin', permissions: [] }]);
        listUsersWithoutPrivate.mockReset().mockResolvedValue([{ uid_user_system: 'u2', username: 'ops', nm_user: 'Ops' }]);
        listMenuAdminTree.mockReset().mockResolvedValue([{ kd_menu: 'M1', nm_menu: 'Dash', children: [{ kd_menu: 'M2', nm_menu: 'Child', children: [] }] }]);
        listActions.mockReset().mockResolvedValue([
            { kode: 'AC', nm_action: 'Access', kd_action: 'ACT_AC', menus: ['M1'] },
            { kode: 'IN', nm_action: 'Insert', kd_action: 'ACT_IN', menus: ['M1'] },
            { kode: 'UP', nm_action: 'Update', kd_action: 'ACT_UP', menus: ['OTHER'] },
            { kode: 'ZZ', nm_action: 'Z', kd_action: 'ACT_ZZ', menus: ['M1'] }
        ]);
        getActionEditPrivate.mockReset().mockResolvedValue([{ menu: 'M1', action: ['AC'] }]);
        getActionEditRolePrivate.mockReset().mockResolvedValue([{ menu: 'M1', action: ['AC'] }]);
        createPermissionPrivate.mockReset().mockResolvedValue({});
        updatePermissionPrivate.mockReset().mockResolvedValue({});
        deletePermissionPrivate.mockReset().mockResolvedValue({});
        toastAdd.mockReset();
    });

    it('covers create/edit/delete private permission', async () => {
        const wrapper = mount(PermissionPrivate, { global: { plugins: [[PrimeVue, {}]], stubs: primeStubs() } });
        await vi.waitFor(() => expect(listPermissionPrivateGrouped).toHaveBeenCalled());
        await clickByText(wrapper, 'Muat Ulang');
        await clickByText(wrapper, 'Tambah');
        await clickByText(wrapper, 'Batal');
        const state = setupState(wrapper);
        await vi.waitFor(() => expect(state.userOptions.length).toBe(1));
        expect(state.flattenTree(null)).toEqual([]);
        expect(state.flattenTree([{ kd_menu: 'A', children: [{ kd_menu: 'B' }] }]).map((n) => n.kd_menu)).toEqual(['A', 'B']);
        await vi.waitFor(() => expect(state.allActions.length).toBe(4));
        expect(state.actionsForMenu('M1').some((a) => a.kode === 'IN')).toBe(true);
        expect(state.actionsForMenu('M1').some((a) => a.kode === 'UP')).toBe(false);
        state.setActionFilter('M1', 'acc');
        expect(state.filteredActionsForMenu('M1').length).toBeGreaterThan(0);
        state.setActionFilter('M1', 'zzz');
        expect(state.filteredActionsForMenu('M1').length).toBe(0);
        expect(state.isAllAccess('M2')).toBe(false);
        state.setActionFilter('M1', '');
        state.toggleAllAccess('M1', true);
        expect(state.isAllAccess('M1')).toBe(true);
        expect(state.someAccessSelected('M1')).toBe(true);
        expect(state.accessSelectedItemsLabel('M1')).toBeTruthy();
        expect(state.accessMaxSelectedLabels('M1')).toBe(0);
        expect(state.actionCodesForMenu('M1').length).toBeGreaterThan(0);
        expect(state.permissionCount({ permissions: [{ action: ['AC', 'IN'] }] })).toBe(2);
        expect(state.permissionCount({})).toBe(0);
        expect(state.isAllAccess('NOPE')).toBe(false);
        state.onAccessPanelHide('M1');
        state.toggleAllAccess('M1', false);
        state.toggleAllAccess('M1');
        state.onDialogMaximize();
        expect(state.dialogContentStyle).toBeTruthy();
        state.onDialogUnmaximize();
        state.onDialogHide();
        state.selectedUser = null;
        await state.submitForm();
        await state.openCreate();
        await wrapper.vm.$nextTick();
        const ms = wrapper.find('.multiselect-stub');
        if (ms.exists()) {
            const filterInput = ms.find('input:not([type="checkbox"])');
            if (filterInput.exists()) await filterInput.setValue('acc');
            const cb = ms.find('input[type="checkbox"]');
            if (cb.exists()) await cb.trigger('change');
            await ms.trigger('hide');
        }
        await state.onUserChange();
        await state.submitForm();
        expect(createPermissionPrivate).toHaveBeenCalled();
        createPermissionPrivate.mockRejectedValueOnce(new Error('fail'));
        await state.openCreate();
        await state.onUserChange();
        await state.submitForm();
        await state.openEdit({ uid_user_system: 'u1', username: 'admin' });
        await state.submitForm();
        expect(updatePermissionPrivate).toHaveBeenCalled();
        updatePermissionPrivate.mockRejectedValueOnce(new Error('fail'));
        await state.openEdit({ uid_user_system: 'u1', username: 'admin' });
        await state.submitForm();
        await state.askDelete({ uid_user_system: 'u1', username: 'admin', nm_user: 'Admin' });
        expect(deletePermissionPrivate).toHaveBeenCalledWith('u1');
        deletePermissionPrivate.mockRejectedValueOnce(new Error('fail'));
        await state.askDelete({ uid_user_system: 'u1', username: 'admin', nm_user: 'Admin' });
        await state.openCreate();
        await wrapper.vm.$nextTick();
        await interactFormControls(wrapper);
        const pilihSemua = wrapper.findAll('div').find((el) => el.text().includes('Pilih semua'));
        if (pilihSemua) await pilihSemua.trigger('click');
        listUsersWithoutPrivate.mockResolvedValueOnce([]);
        await state.openCreate();
        listPermissionPrivateGrouped.mockRejectedValueOnce(new Error('fail'));
        await state.loadData?.();
        await clickAllButtons(wrapper);
        wrapper.unmount();
    });
});
