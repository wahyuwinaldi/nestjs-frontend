import Permission from '@/views/master/Permission.vue';
import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clickAllButtons, clickByText, interactFormControls, primeStubs, setupState } from '../../helpers/mount';

const listPermissionGrouped = vi.fn();
const listMenuAdminTree = vi.fn();
const listActions = vi.fn();
const getActionEdit = vi.fn();
const createPermission = vi.fn();
const updatePermission = vi.fn();
const deletePermission = vi.fn();
const toastAdd = vi.fn();

vi.mock('@/composables/usePermissionApi', () => ({
    listPermissionGrouped: (...a) => listPermissionGrouped(...a),
    getActionEdit: (...a) => getActionEdit(...a),
    createPermission: (...a) => createPermission(...a),
    updatePermission: (...a) => updatePermission(...a),
    deletePermission: (...a) => deletePermission(...a)
}));
vi.mock('@/composables/useMenuApi', () => ({ listMenuAdminTree: (...a) => listMenuAdminTree(...a) }));
vi.mock('@/composables/useActionApi', () => ({ listActions: (...a) => listActions(...a) }));
vi.mock('@/composables/useSession', () => ({ updateSessionMenu: vi.fn() }));
vi.mock('@/composables/usePermission', () => ({ hasMenuPermission: () => true }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: (o) => o.accept?.() }) }));

describe('Permission.vue', () => {
    beforeEach(() => {
        listPermissionGrouped.mockReset().mockResolvedValue([{ kd_role: 'R1', nm_role: 'Admin', permissions: [{ kd_menu: 'M1', kode: 'AC' }] }]);
        listMenuAdminTree.mockReset().mockResolvedValue([{ kd_menu: 'M1', nm_menu: 'Dash', children: [{ kd_menu: 'M2', nm_menu: 'Child', children: [] }] }]);
        listActions.mockReset().mockResolvedValue([
            { kode: 'AC', nm_action: 'Access', kd_action: 'ACT_AC', menus: ['M1'] },
            { kode: 'IN', nm_action: 'Insert', kd_action: 'ACT_IN', menus: ['M1'] },
            { kode: 'UP', nm_action: 'Update', kd_action: 'ACT_UP', menus: ['X'] },
            { kode: 'ZZ', nm_action: 'Z', kd_action: 'ACT_ZZ', menus: ['M1'] }
        ]);
        getActionEdit.mockReset().mockResolvedValue([{ menu: 'M1', action: ['AC'] }]);
        createPermission.mockReset().mockResolvedValue({});
        updatePermission.mockReset().mockResolvedValue({});
        deletePermission.mockReset().mockResolvedValue({});
        toastAdd.mockReset();
    });

    it('covers matrix helpers and submit/delete', async () => {
        const wrapper = mount(Permission, { global: { plugins: [[PrimeVue, {}]], stubs: primeStubs() } });
        await vi.waitFor(() => expect(listPermissionGrouped).toHaveBeenCalled());
        await clickByText(wrapper, 'Muat Ulang');
        await clickByText(wrapper, 'Tambah');
        await clickByText(wrapper, 'Batal');
        const state = setupState(wrapper);
        expect(state.flattenTree(null)).toEqual([]);
        expect(state.flattenTree([{ kd_menu: 'A', children: [{ kd_menu: 'B' }] }]).map((n) => n.kd_menu)).toEqual(['A', 'B']);
        await vi.waitFor(() => expect(state.allActions.length).toBe(4));
        expect(state.actionsForMenu('M1').length).toBe(3);
        state.setActionFilter('M1', 'acc');
        expect(state.filteredActionsForMenu('M1').length).toBe(1);
        state.toggleAllAccess('M1', true);
        expect(state.isAllAccess('M1')).toBe(true);
        expect(state.someAccessSelected('M1')).toBe(true);
        expect(state.accessSelectedItemsLabel('M1')).toBeTruthy();
        expect(state.accessMaxSelectedLabels('M1')).toBe(0);
        expect(state.actionCodesForMenu('M1').length).toBeGreaterThan(0);
        expect(state.selectedActionCodes('M1').length).toBeGreaterThan(0);
        expect(state.permissionCount({ permissions: [{ action: ['AC'] }] })).toBe(1);
        expect(state.permissionCount({})).toBe(0);
        expect(state.isAllAccess('NOPE')).toBe(false);
        state.onAccessPanelHide('M1');
        state.toggleAllAccess('M1', false);
        expect(state.isAllAccess('M1')).toBe(false);
        expect(state.someAccessSelected('M1')).toBe(false);
        state.toggleAllAccess('M1');
        state.setActionFilter('M1', 'zzz');
        expect(state.filteredActionsForMenu('M1').length).toBe(0);
        expect(state.isAllAccess('M2')).toBe(false);
        state.setActionFilter('M1', '');
        expect(state.emptyMatrix()).toBeTruthy();
        state.onDialogMaximize();
        state.onDialogUnmaximize();
        state.onDialogHide();

        state.openCreate();
        await wrapper.vm.$nextTick();
        const ms = wrapper.find('.multiselect-stub');
        if (ms.exists()) {
            const filterInput = ms.find('input:not([type="checkbox"])');
            if (filterInput.exists()) await filterInput.setValue('acc');
            const cb = ms.find('input[type="checkbox"]');
            if (cb.exists()) await cb.trigger('change');
            await ms.trigger('hide');
        }
        await state.submitForm();
        state.roleName = 'Ops';
        await state.submitForm();
        expect(createPermission).toHaveBeenCalled();
        createPermission.mockRejectedValueOnce(new Error('fail'));
        state.openCreate();
        state.roleName = 'Ops';
        await state.submitForm();

        await state.openEdit({ kd_role: 'R1', nm_role: 'Admin' });
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toMatch(/Kode:/);
        await state.submitForm();
        expect(updatePermission).toHaveBeenCalled();
        updatePermission.mockRejectedValueOnce(new Error('fail'));
        await state.openEdit({ kd_role: 'R1', nm_role: 'Admin' });
        await state.submitForm();
        await state.askDelete({ kd_role: 'R1', nm_role: 'Admin' });
        expect(deletePermission).toHaveBeenCalledWith('R1');
        deletePermission.mockRejectedValueOnce(new Error('fail'));
        await state.askDelete({ kd_role: 'R1', nm_role: 'Admin' });
        await state.askDelete({ kd_role: 'RS001', nm_role: 'Super' });
        state.openCreate();
        await wrapper.vm.$nextTick();
        await interactFormControls(wrapper);
        const pilihSemua = wrapper.findAll('div').find((el) => el.text().includes('Pilih semua'));
        if (pilihSemua) await pilihSemua.trigger('click');
        listPermissionGrouped.mockRejectedValueOnce(new Error('fail'));
        await state.loadData?.();
        await clickAllButtons(wrapper);
        wrapper.unmount();
    });
});
