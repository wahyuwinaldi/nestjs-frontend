import App from '@/App.vue';
import FloatingConfigurator from '@/components/FloatingConfigurator.vue';
import SessionTimeout from '@/components/SessionTimeout.vue';
import AppFooter from '@/layout/AppFooter.vue';
import AppLayout from '@/layout/AppLayout.vue';
import AppMenu from '@/layout/AppMenu.vue';
import AppMenuItem from '@/layout/AppMenuItem.vue';
import AppSidebar from '@/layout/AppSidebar.vue';
import AppTopbar from '@/layout/AppTopbar.vue';
import AppConfigurator from '@/layout/AppConfigurator.vue';
import { useLayout } from '@/layout/composables/layout';
import { setEncryptedItem } from '@/utils/encryption';
import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';
import { primeStubs, setupState } from '../helpers/mount';

vi.mock('@primeuix/themes', () => ({
    $t: () => ({ preset: () => ({ preset: () => ({ surfacePalette: () => ({ use: vi.fn() }) }) }) }),
    updatePreset: vi.fn(),
    updateSurfacePalette: vi.fn()
}));
vi.mock('@primeuix/themes/aura', () => ({ default: {} }));
vi.mock('@primeuix/themes/lara', () => ({ default: {} }));
vi.mock('@primeuix/themes/nora', () => ({ default: {} }));

const saveTheme = vi.fn();
const toastAdd = vi.fn();
vi.mock('@/composables/useSettingsApi', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        saveTheme: (...a) => saveTheme(...a)
    };
});
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));

async function withRouter(component, extraRoutes = []) {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/', component: { template: '<div>home</div>' } }, { path: '/auth/login', component: { template: '<div>login</div>' } }, { path: '/master/user', component: { template: '<div />' } }, ...extraRoutes]
    });
    await router.push('/');
    await router.isReady();
    return { router, wrapper: mount(component, { global: { plugins: [router, [PrimeVue, {}]], stubs: primeStubs() } }) };
}

describe('app shell', () => {
    it('renders App with router-view and session timeout', async () => {
        const { wrapper } = await withRouter(App);
        expect(wrapper.findComponent(SessionTimeout).exists()).toBe(true);
        wrapper.unmount();
    });

    it('mounts layout pieces', async () => {
        localStorage.clear();
        setEncryptedItem('session', { username: 'admin', nama: 'Admin', sessionExpiry: Date.now() + 60_000 });
        setEncryptedItem('menu', [{ label: 'MAIN MENU', items: [{ label: 'Dash', to: '/', icon: 'pi pi-home' }] }]);
        const { wrapper: layout } = await withRouter(AppLayout);
        expect(layout.find('.layout-wrapper').exists()).toBe(true);
        await layout.find('.layout-mask').trigger('click');
        layout.unmount();

        const { wrapper: topbar } = await withRouter(AppTopbar);
        expect(topbar.text()).toContain('Dashboard');
        expect(topbar.findComponent(AppConfigurator).exists()).toBe(false);
        expect(topbar.find('.pi-palette').exists()).toBe(false);
        await topbar.find('.layout-menu-button').trigger('click');
        await topbar.findAll('button.layout-topbar-action')[1].trigger('click');
        const profileBtn = topbar.find('.layout-topbar-action-with-label');
        if (profileBtn.exists()) await profileBtn.trigger('click');
        const topState = setupState(topbar);
        topState.onMenuUpdated();
        topState.profileItems[0].command();
        topState.profileItems[1].command();
        topState.toggleProfileMenu({ currentTarget: document.body });
        globalThis.dispatchEvent(new CustomEvent('menu-updated'));
        await topbar.vm.$nextTick();
        topbar.unmount();

        vi.stubGlobal('innerWidth', 1200);
        const { wrapper: sidebar } = await withRouter(AppSidebar);
        expect(sidebar.find('.layout-sidebar').exists()).toBe(true);
        const { layoutState } = useLayout();
        layoutState.overlayMenuActive = true;
        await sidebar.vm.$nextTick();
        layoutState.overlayMenuActive = false;
        await sidebar.vm.$nextTick();
        layoutState.overlayMenuActive = true;
        await sidebar.vm.$nextTick();
        vi.stubGlobal('innerWidth', 500);
        layoutState.overlayMenuActive = false;
        await sidebar.vm.$nextTick();
        layoutState.overlayMenuActive = true;
        await sidebar.vm.$nextTick();
        vi.stubGlobal('innerWidth', 1200);
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const sideState = setupState(sidebar);
        sideState.bindOutsideClickListener();
        sideState.bindOutsideClickListener();
        document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        sideState.unbindOutsideClickListener();
        sidebar.unmount();

        const { wrapper: menu } = await withRouter(AppMenu);
        globalThis.dispatchEvent(new CustomEvent('menu-updated'));
        await menu.vm.$nextTick();
        menu.unmount();
        localStorage.clear();
        setEncryptedItem('menu', [
            { label: 'MAIN MENU', items: [{ label: 'Dash', to: '/' }] },
            { separator: true, items: [] }
        ]);
        const { wrapper: menuSep } = await withRouter(AppMenu);
        expect(menuSep.find('.menu-separator').exists()).toBe(true);
        menuSep.unmount();
        localStorage.clear();
        const { wrapper: menuFallback } = await withRouter(AppMenu);
        expect(menuFallback.find('.layout-menu').exists()).toBe(true);
        menuFallback.unmount();

        mount(AppFooter).unmount();
        const menuItemRouter = createRouter({
            history: createMemoryHistory(),
            routes: [
                { path: '/', component: { template: '<div />' } },
                { path: '/system/menu', component: { template: '<div />' } }
            ]
        });
        await menuItemRouter.push('/');
        await menuItemRouter.isReady();
        const item = mount(AppMenuItem, {
            props: {
                item: { label: 'Pengaturan', path: '/system', icon: 'pi pi-cog', items: [{ label: 'Menu', to: '/system/menu' }] },
                root: true
            },
            global: { plugins: [menuItemRouter, [PrimeVue, {}]], stubs: primeStubs() }
        });
        const menuState = setupState(item);
        const rootLink = item.find('a');
        if (rootLink.exists()) {
            await rootLink.trigger('click');
            await rootLink.trigger('mouseenter');
        }
        menuState.itemClick({ preventDefault: vi.fn() }, { items: [{ to: '/system/menu' }], path: '/system' });
        menuState.itemClick({ preventDefault: vi.fn() }, { items: [{ to: '/system/menu' }], path: '/system' });
        menuState.itemClick({ preventDefault: vi.fn() }, { disabled: true });
        menuState.itemClick({ preventDefault: vi.fn() }, { command: vi.fn(), to: '/system/menu' });
        expect(menuState.hasActiveChildRoute({ items: [{ to: '/system/menu', items: [{ to: '/system/menu/x' }] }] }, '/system/menu/x')).toBe(true);
        expect(menuState.hasActiveChildRoute({ items: [] }, '/x')).toBe(false);
        const { layoutState: ls } = useLayout();
        ls.menuHoverActive = true;
        menuState.onMouseEnter();
        await menuItemRouter.push('/system/menu');
        await item.vm.$nextTick();
        item.unmount();

        const leaf = mount(AppMenuItem, {
            props: { item: { label: 'Dash', to: '/', icon: 'pi pi-home' }, root: false },
            global: { plugins: [menuItemRouter, [PrimeVue, {}]], stubs: primeStubs() }
        });
        setupState(leaf).itemClick({ preventDefault: vi.fn() }, { to: '/' });
        const leafLink = leaf.find('a');
        if (leafLink.exists()) {
            await leafLink.trigger('click');
            await leafLink.trigger('mouseenter');
        }
        await leaf.trigger('mouseenter');
        leaf.unmount();

        const hidden = mount(AppMenuItem, {
            props: { item: { label: 'Hidden', to: '/x', visible: false }, root: true },
            global: { plugins: [menuItemRouter, [PrimeVue, {}]], stubs: primeStubs() }
        });
        expect(hidden.find('.layout-menuitem-text').exists()).toBe(false);
        hidden.unmount();

        const { wrapper: floating } = await withRouter(FloatingConfigurator);
        // FloatingConfigurator hanya toggle dark mode (tanpa AppConfigurator).
        expect(floating.findComponent(AppConfigurator).exists()).toBe(false);
        await floating.find('button').trigger('click');
        await floating.find('button').trigger('click');
        floating.unmount();

        setEncryptedItem('akses', [{ kd_menu: 'MN_WEB', link_menu: '/system/website', permissions: ['UP'] }]);
        const { wrapper: topbarWithTheme } = await withRouter(AppTopbar);
        expect(topbarWithTheme.findComponent(AppConfigurator).exists()).toBe(true);
        expect(topbarWithTheme.find('.pi-palette').exists()).toBe(true);
        topbarWithTheme.unmount();
        const { wrapper: floatingNoTheme } = await withRouter(FloatingConfigurator);
        expect(floatingNoTheme.findComponent(AppConfigurator).exists()).toBe(false);
        floatingNoTheme.unmount();
        localStorage.clear();
        const { wrapper: config } = await withRouter(AppConfigurator);
        const state = setupState(config);
        state.updateColors('primary', { name: 'noir', palette: {} });
        state.onPresetChange();
        state.updateColors('primary', { name: 'emerald', palette: { 500: '#10b981' } });
        state.updateColors('surface', { name: 'zinc', palette: { 500: '#71717a' } });
        state.preset = 'Lara';
        state.onPresetChange();
        state.onMenuModeChange({ value: 'overlay' });
        expect(state.isDirty).toBe(true);
        state.cancelTheme();
        expect(state.isDirty).toBe(false);
        state.updateColors('primary', { name: 'blue', palette: { 500: '#3b82f6' } });
        saveTheme.mockResolvedValueOnce({ primary: 'blue', surface: null, preset: 'Aura', menuMode: 'static' });
        await state.saveThemeChanges();
        expect(saveTheme).toHaveBeenCalled();
        expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
        state.updateColors('primary', { name: 'rose', palette: { 500: '#f43f5e' } });
        saveTheme.mockRejectedValueOnce(new Error('fail'));
        await state.saveThemeChanges();
        expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
        for (const btn of config.findAll('button')) await btn.trigger('click');
        config.unmount();
    });

    it('SessionTimeout shows dialog when session expires on private route', async () => {
        localStorage.clear();
        setEncryptedItem('session', { uid: '1', sessionExpiry: Date.now() - 1000 });
        const router = createRouter({
            history: createMemoryHistory(),
            routes: [
                { path: '/', component: { template: '<div />' } },
                { path: '/auth/login', component: { template: '<div>login</div>' } }
            ]
        });
        await router.push('/');
        await router.isReady();
        const wrapper = mount(SessionTimeout, { global: { plugins: [router, [PrimeVue, {}]], stubs: primeStubs() } });
        await wrapper.vm.$nextTick();
        const state = setupState(wrapper);
        state.handleExpired();
        expect(state.dialogVisible).toBe(true);
        state.goLogin();
        await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/auth/login'));
        wrapper.unmount();
    });

    it('SessionTimeout ignores public routes and handles expired event', async () => {
        const router = createRouter({
            history: createMemoryHistory(),
            routes: [
                { path: '/pages/notfound', component: { template: '<div />' } },
                { path: '/auth/login', component: { template: '<div>login</div>' } }
            ]
        });
        await router.push('/pages/notfound');
        await router.isReady();
        const wrapper = mount(SessionTimeout, { global: { plugins: [router, [PrimeVue, {}]], stubs: primeStubs() } });
        const state = setupState(wrapper);
        expect(state.isPublicPath('/pages/notfound')).toBe(true);
        expect(state.isPublicPath('/auth/access')).toBe(true);
        state.checkSessionStatus();
        state.handleExpired();
        globalThis.dispatchEvent(new CustomEvent('session-expired'));
        await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/auth/login'));
        wrapper.unmount();

        localStorage.clear();
        setEncryptedItem('session', { uid: '1', sessionExpiry: Date.now() + 60_000 });
        const privateRouter = createRouter({
            history: createMemoryHistory(),
            routes: [
                { path: '/', component: { template: '<div />' } },
                { path: '/auth/login', component: { template: '<div>login</div>' } }
            ]
        });
        await privateRouter.push('/');
        await privateRouter.isReady();
        const privateWrap = mount(SessionTimeout, { global: { plugins: [privateRouter, [PrimeVue, {}]], stubs: primeStubs() } });
        globalThis.dispatchEvent(new CustomEvent('session-expired'));
        await vi.waitFor(() => expect(setupState(privateWrap).dialogVisible).toBe(true));
        privateWrap.unmount();
    });
});
