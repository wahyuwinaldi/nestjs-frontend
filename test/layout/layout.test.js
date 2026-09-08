import { applyLayoutTheme, getLayoutThemeSnapshot, useLayout } from '@/layout/composables/layout';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('useLayout', () => {
    beforeEach(() => {
        sessionStorage.clear();
        document.documentElement.classList.remove('app-dark');
        vi.stubGlobal('innerWidth', 1200);
        applyLayoutTheme({ primary: 'emerald', surface: null, preset: 'Aura', menuMode: 'static' });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('toggles dark mode and persists preference', () => {
        const { layoutConfig, toggleDarkMode, isDarkTheme } = useLayout();
        const start = layoutConfig.darkTheme;
        toggleDarkMode();
        expect(layoutConfig.darkTheme).toBe(!start);
        expect(isDarkTheme.value).toBe(!start);
        expect(document.documentElement.classList.contains('app-dark')).toBe(!start);
        expect(JSON.parse(sessionStorage.getItem('live.ui.prefs')).darkTheme).toBe(!start);
        toggleDarkMode();
        expect(layoutConfig.darkTheme).toBe(start);
    });

    it('applies layout theme without changing dark mode', () => {
        const { layoutConfig, toggleDarkMode } = useLayout();
        toggleDarkMode();
        const dark = layoutConfig.darkTheme;
        const normalized = applyLayoutTheme({
            primary: 'blue',
            surface: 'slate',
            preset: 'Lara',
            menuMode: 'overlay'
        });
        expect(normalized.preset).toBe('Lara');
        expect(layoutConfig.primary).toBe('blue');
        expect(layoutConfig.menuMode).toBe('overlay');
        expect(layoutConfig.darkTheme).toBe(dark);
        expect(getLayoutThemeSnapshot()).toEqual({
            primary: 'blue',
            surface: 'slate',
            preset: 'Lara',
            menuMode: 'overlay'
        });
    });

    it('uses view transition when available', () => {
        const startViewTransition = vi.fn((cb) => cb());
        document.startViewTransition = startViewTransition;
        const { toggleDarkMode } = useLayout();
        toggleDarkMode();
        expect(startViewTransition).toHaveBeenCalled();
        delete document.startViewTransition;
    });

    it('toggles desktop static/overlay menu and mobile menu', () => {
        const { layoutConfig, layoutState, toggleMenu, hideMobileMenu, changeMenuMode, toggleConfigSidebar, isDesktop } = useLayout();

        layoutConfig.menuMode = 'static';
        layoutState.staticMenuInactive = false;
        toggleMenu();
        expect(layoutState.staticMenuInactive).toBe(true);

        layoutConfig.menuMode = 'overlay';
        layoutState.overlayMenuActive = false;
        toggleMenu();
        expect(layoutState.overlayMenuActive).toBe(true);

        vi.stubGlobal('innerWidth', 500);
        expect(isDesktop()).toBe(false);
        layoutState.mobileMenuActive = false;
        toggleMenu();
        expect(layoutState.mobileMenuActive).toBe(true);
        hideMobileMenu();
        expect(layoutState.mobileMenuActive).toBe(false);

        toggleConfigSidebar();
        expect(layoutState.configSidebarVisible).toBe(true);

        changeMenuMode({ value: 'static' });
        expect(layoutConfig.menuMode).toBe('static');
        expect(layoutState.staticMenuInactive).toBe(false);
        expect(layoutState.sidebarExpanded).toBe(false);
    });

    it('reads invalid ui prefs as empty', () => {
        sessionStorage.setItem('live.ui.prefs', '{not-json');
        const { layoutConfig } = useLayout();
        expect(layoutConfig.preset).toBeTruthy();
    });

    it('ignores non-object ui prefs and write errors', () => {
        sessionStorage.setItem('live.ui.prefs', 'true');
        const { layoutConfig, toggleDarkMode } = useLayout();
        expect(layoutConfig.preset).toBeTruthy();
        const orig = sessionStorage.setItem.bind(sessionStorage);
        sessionStorage.setItem = () => {
            throw new Error('quota');
        };
        toggleDarkMode();
        sessionStorage.setItem = orig;
    });
});
