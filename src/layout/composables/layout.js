import { computed, reactive } from 'vue';
import { DEFAULT_UI_THEME, normalizeTheme } from '@/utils/theme';

const UI_PREFS_KEY = 'live.ui.prefs';

function readUiPrefs() {
    try {
        const raw = sessionStorage.getItem(UI_PREFS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function writeUiPrefs(partial) {
    try {
        const current = readUiPrefs() || {};
        sessionStorage.setItem(UI_PREFS_KEY, JSON.stringify({ ...current, ...partial }));
    } catch {
        // ignore quota / private mode
    }
}

const savedPrefs = readUiPrefs();

const layoutConfig = reactive({
    preset: DEFAULT_UI_THEME.preset,
    primary: DEFAULT_UI_THEME.primary,
    surface: DEFAULT_UI_THEME.surface,
    darkTheme: savedPrefs?.darkTheme === true,
    menuMode: DEFAULT_UI_THEME.menuMode
});

if (typeof document !== 'undefined' && layoutConfig.darkTheme) {
    document.documentElement.classList.add('app-dark');
}

const layoutState = reactive({
    staticMenuInactive: false,
    overlayMenuActive: false,
    profileSidebarVisible: false,
    configSidebarVisible: false,
    sidebarExpanded: false,
    menuHoverActive: false,
    activeMenuItem: null,
    activePath: null
});

/**
 * Apply global theme fields from DB/boot without touching darkTheme.
 * @param {Partial<{primary:string, surface:string|null, preset:string, menuMode:string}>} theme
 */
export function applyLayoutTheme(theme) {
    const normalized = normalizeTheme(theme);
    layoutConfig.preset = normalized.preset;
    layoutConfig.primary = normalized.primary;
    layoutConfig.surface = normalized.surface;
    layoutConfig.menuMode = normalized.menuMode;
    return normalized;
}

export function getLayoutThemeSnapshot() {
    return {
        primary: layoutConfig.primary,
        surface: layoutConfig.surface,
        preset: layoutConfig.preset,
        menuMode: layoutConfig.menuMode
    };
}

export function useLayout() {
    const toggleDarkMode = () => {
        if (!document.startViewTransition) {
            executeDarkModeToggle();
            return;
        }

        document.startViewTransition(() => executeDarkModeToggle());
    };

    const executeDarkModeToggle = () => {
        layoutConfig.darkTheme = !layoutConfig.darkTheme;
        document.documentElement.classList.toggle('app-dark', layoutConfig.darkTheme);
        writeUiPrefs({ darkTheme: layoutConfig.darkTheme });
    };

    const toggleMenu = () => {
        if (isDesktop()) {
            if (layoutConfig.menuMode === 'static') {
                layoutState.staticMenuInactive = !layoutState.staticMenuInactive;
            }

            if (layoutConfig.menuMode === 'overlay') {
                layoutState.overlayMenuActive = !layoutState.overlayMenuActive;
            }
        } else {
            layoutState.mobileMenuActive = !layoutState.mobileMenuActive;
        }
    };

    const toggleConfigSidebar = () => {
        layoutState.configSidebarVisible = !layoutState.configSidebarVisible;
    };

    const hideMobileMenu = () => {
        layoutState.mobileMenuActive = false;
    };

    const changeMenuMode = (event) => {
        layoutConfig.menuMode = event.value;
        layoutState.staticMenuInactive = false;
        layoutState.mobileMenuActive = false;
        layoutState.sidebarExpanded = false;
        layoutState.menuHoverActive = false;
        layoutState.anchored = false;
    };

    const isDarkTheme = computed(() => layoutConfig.darkTheme);
    const isDesktop = () => window.innerWidth > 991;

    const hasOpenOverlay = computed(() => layoutState.overlayMenuActive);

    return {
        layoutConfig,
        layoutState,
        isDarkTheme,
        toggleDarkMode,
        toggleConfigSidebar,
        toggleMenu,
        hideMobileMenu,
        changeMenuMode,
        isDesktop,
        hasOpenOverlay,
        applyLayoutTheme,
        getLayoutThemeSnapshot
    };
}
