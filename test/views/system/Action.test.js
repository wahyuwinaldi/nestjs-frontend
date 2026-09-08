import Action from '@/views/system/Action.vue';
import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clickAllButtons, clickByText, interactFormControls, primeStubs, setupState } from '../../helpers/mount';

const listActions = vi.fn();
const createAction = vi.fn();
const updateAction = vi.fn();
const deleteAction = vi.fn();
const listMenuAdminFlat = vi.fn();
const toastAdd = vi.fn();

vi.mock('@/composables/useActionApi', () => ({
    listActions: (...a) => listActions(...a),
    createAction: (...a) => createAction(...a),
    updateAction: (...a) => updateAction(...a),
    deleteAction: (...a) => deleteAction(...a)
}));
vi.mock('@/composables/useMenuApi', () => ({
    listMenuAdminFlat: (...a) => listMenuAdminFlat(...a)
}));
vi.mock('@/composables/useSession', () => ({ updateSessionMenu: vi.fn() }));
vi.mock('@/composables/usePermission', () => ({ hasMenuPermission: () => true }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: (o) => o.accept?.() }) }));

describe('Action.vue', () => {
    beforeEach(() => {
        listActions.mockReset().mockResolvedValue([{ kd_action: '1', kode: 'AC', nm_action: 'Access', menus: ['M1'] }]);
        listMenuAdminFlat.mockReset().mockResolvedValue([
            { kd_menu: 'M1', nm_menu: 'Menu 1', urut_global: 1, level: 1 },
            { kd_menu: 'M2', nm_menu: 'Menu 2', urut_global: 2, level: 1 }
        ]);
        createAction.mockReset().mockResolvedValue({});
        updateAction.mockReset().mockResolvedValue({});
        deleteAction.mockReset().mockResolvedValue({});
        toastAdd.mockReset();
    });

    it('covers list, format, create/edit/delete', async () => {
        const wrapper = mount(Action, { global: { plugins: [[PrimeVue, {}]], stubs: primeStubs() } });
        await vi.waitFor(() => expect(listActions).toHaveBeenCalled());
        await clickByText(wrapper, 'Muat Ulang');
        await clickByText(wrapper, 'Tambah');
        await clickByText(wrapper, 'Batal');
        const state = setupState(wrapper);
        expect(state.formatMenusCell([])).toBe('Semua menu');
        expect(state.formatMenusCell(null)).toBeTruthy();
        expect(state.sanitizeMenuSelection?.(null)).toEqual([]);
        await vi.waitFor(() => expect(Object.keys(state.menuNameByKd || {})).toContain('M1'));
        expect(state.formatMenusCell(['M1'])).toBe('Menu 1');
        expect(state.formatMenusCell(['M1', 'M2', 'M3'])).toContain('menu lainnya');
        state.menuFilter = 'menu 2';
        expect(state.filteredMenuOptions.map((r) => r.value)).toEqual(['M2']);

        state.openCreate();
        await wrapper.vm.$nextTick();
        const ms = wrapper.find('.multiselect-stub');
        if (ms.exists()) {
            const inp = ms.find('input');
            if (inp.exists()) await inp.setValue('menu');
            await ms.trigger('hide');
        }
        await state.submitForm();
        expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.stringMatching(/Kode dan nama/i) }));
        state.form.kode = 'IN';
        state.form.nm_action = 'Insert';
        await state.submitForm();
        expect(createAction).toHaveBeenCalled();

        state.openEdit({ kd_action: '1', kode: 'AC', nm_action: 'Access', menus: ['M1'] });
        await state.submitForm();
        expect(updateAction).toHaveBeenCalled();
        await state.askDelete({ kd_action: '1', nm_action: 'Access' });
        expect(deleteAction).toHaveBeenCalledWith('1');
        createAction.mockRejectedValueOnce(new Error('fail'));
        state.openCreate();
        state.form.kode = 'X';
        state.form.nm_action = 'X';
        await state.submitForm();
        deleteAction.mockRejectedValueOnce(new Error('fail'));
        await state.askDelete({ kd_action: '1', nm_action: 'Access' });
        listActions.mockRejectedValueOnce(new Error('fail'));
        await state.loadData();
        state.openCreate();
        await wrapper.vm.$nextTick();
        await interactFormControls(wrapper);
        await clickAllButtons(wrapper);
        wrapper.unmount();
    });
});
