import MenuPage from '@/views/system/Menu.vue';
import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clickAllButtons, clickByText, interactFormControls, primeStubs, setupState } from '../../helpers/mount';

const listMenuAdminTree = vi.fn();
const createMenu = vi.fn();
const updateMenu = vi.fn();
const deleteMenu = vi.fn();
const saveMenuBoard = vi.fn();
const toastAdd = vi.fn();

vi.mock('@/composables/useMenuApi', () => ({
    listMenuAdminTree: (...a) => listMenuAdminTree(...a),
    createMenu: (...a) => createMenu(...a),
    updateMenu: (...a) => updateMenu(...a),
    deleteMenu: (...a) => deleteMenu(...a),
    saveMenuBoard: (...a) => saveMenuBoard(...a)
}));
vi.mock('@/composables/useSession', () => ({ updateSessionMenu: vi.fn() }));
vi.mock('@/composables/usePermission', () => ({ hasMenuPermission: () => true }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: (o) => o.accept?.() }) }));
vi.mock('vuedraggable', () => ({
    default: {
        name: 'draggable',
        props: ['modelValue', 'itemKey', 'group', 'move'],
        emits: ['update:modelValue', 'change'],
        template: `<div class="draggable-stub" @click="$emit('change', { moved: true })">
            <div v-for="(element, index) in (modelValue || [])" :key="(element && itemKey && element[itemKey]) || index">
                <slot name="item" :element="element" :index="index" />
            </div>
        </div>`
    }
}));

describe('Menu.vue', () => {
    beforeEach(() => {
        listMenuAdminTree.mockReset().mockResolvedValue([
            {
                kd_menu: 'MN_MAIN',
                nm_menu: 'MAIN MENU',
                status: 'A',
                children: [
                    {
                        kd_menu: 'MN_D',
                        nm_menu: 'Dash',
                        link_menu: '/',
                        icon_menu: 'home',
                        status: 'A',
                        children: [{ kd_menu: 'MN_G', nm_menu: 'Grand', link_menu: '/g', icon_menu: 'ri-map-pin-line', status: 'N', children: [] }]
                    }
                ]
            }
        ]);
        createMenu.mockReset().mockResolvedValue({});
        updateMenu.mockReset().mockResolvedValue({});
        deleteMenu.mockReset().mockResolvedValue({});
        saveMenuBoard.mockReset().mockResolvedValue({});
        toastAdd.mockReset();
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });
    });

    it('loads board and covers create/edit/save/delete', async () => {
        const wrapper = mount(MenuPage, { global: { plugins: [[PrimeVue, {}]], stubs: primeStubs() } });
        await vi.waitFor(() => expect(listMenuAdminTree).toHaveBeenCalled());
        await clickByText(wrapper, 'Muat Ulang');
        await clickByText(wrapper, 'Tambah');
        await clickByText(wrapper, 'Batal');
        const state = setupState(wrapper);
        await state.submitForm();
        await state.askDelete({ kd_menu: 'MN_MAIN', nm_menu: 'MAIN MENU' });
        createMenu.mockRejectedValueOnce(new Error('fail'));
        state.openCreate();
        state.form.nm_menu = 'Fail';
        await state.submitForm();
        deleteMenu.mockRejectedValueOnce(new Error('fail'));
        await state.askDelete({ kd_menu: 'MN_D', nm_menu: 'Dash' });
        saveMenuBoard.mockRejectedValueOnce(new Error('fail'));
        await state.handleSaveBoard();
        state.openIconPicker({ icon_menu: 'home' });
        state.chooseIcon('ri-settings-line');
        const host = document.createElement('div');
        host.className = 'menu-indent';
        document.body.appendChild(host);
        expect(state.getDepthByContext({ component: { $el: host } })).toBeGreaterThan(0);
        expect(state.onMove({ relatedContext: { component: { $el: host } } })).toBe(true);
        host.remove();
        expect(state.statusLabel('A')).toBeTruthy();
        expect(state.statusLabel('N')).toBeTruthy();
        expect(state.iconClassOf({ icon_menu: 'home' })).toContain('pi-');
        expect(state.iconClassOf('ri-home-line')).toContain('ri-home-line');
        state.ensureChildren?.([]);
        state.extractBoard?.(state.board || []);
        state.markDirty?.();
        state.getDepthByContext?.({});
        state.onMove?.({ relatedContext: {} });
        state.openCreate();
        state.form.nm_menu = 'Baru';
        await state.submitForm();
        expect(createMenu).toHaveBeenCalled();
        state.openEdit({ kd_menu: 'MN_D', nm_menu: 'Dash', link_menu: '/', icon_menu: 'home', status: 'A' });
        await state.submitForm();
        expect(updateMenu).toHaveBeenCalled();
        await state.handleSaveBoard();
        expect(saveMenuBoard).toHaveBeenCalled();
        await state.askDelete({ kd_menu: 'MN_D', nm_menu: 'Dash' });
        expect(deleteMenu).toHaveBeenCalled();
        state.openIconPickerFromForm();
        state.chooseIcon('ri-home-line');
        expect(state.form.icon_menu).toContain('ri-home-line');
        state.clearFormIcon();
        state.closeIconPicker();
        await state.loadRemixIconsFromHtml?.();
        state.openCreate();
        await wrapper.vm.$nextTick();
        await interactFormControls(wrapper);
        await clickAllButtons(wrapper);
        wrapper.unmount();
    });

    it('renders 3-level board, dirty save, icon picker empty filter, and empty tree', async () => {
        const wrapper = mount(MenuPage, { global: { plugins: [[PrimeVue, {}]], stubs: primeStubs() } });
        await vi.waitFor(() => expect(listMenuAdminTree).toHaveBeenCalled());
        await vi.waitFor(() => expect(wrapper.text()).toContain('Dash'));
        expect(wrapper.text()).toContain('Grand');
        expect(wrapper.text()).toContain('Nonaktif');

        const drag = wrapper.find('.draggable-stub');
        if (drag.exists()) await drag.trigger('click');
        await wrapper.vm.$nextTick();
        await clickByText(wrapper, 'Simpan perubahan');
        expect(saveMenuBoard).toHaveBeenCalled();

        const state = setupState(wrapper);
        state.openIconPickerFromForm();
        await wrapper.vm.$nextTick();
        state.iconSearch = 'zzzz-tidak-ada';
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toMatch(/Tidak ada icon/i);
        state.iconSearch = 'home';
        await wrapper.vm.$nextTick();
        const iconBtn = wrapper.findAll('button').find((b) => b.attributes('aria-label')?.includes('ri-home-line'));
        if (iconBtn) await iconBtn.trigger('click');
        await clickByText(wrapper, 'Tutup');

        wrapper.unmount();

        listMenuAdminTree.mockResolvedValueOnce([]);
        const empty = mount(MenuPage, { global: { plugins: [[PrimeVue, {}]], stubs: primeStubs() } });
        await vi.waitFor(() => expect(empty.text()).toMatch(/Belum ada menu/i));
        empty.unmount();
    });
});
