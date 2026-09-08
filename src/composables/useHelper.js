import { ensureSakaiMenuShape, getMenu, getMenuIcons } from '@/composables/useSession';

export const APP_TITLE = 'Dashboard Template';

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeMenuPath(value) {
    if (value == null) return '';
    const raw = String(value).trim();
    if (!raw || raw === '#') return '';
    return raw.startsWith('/') ? raw : `/${raw}`;
}

/**
 * Cari path (`to`) pertama yang bisa dinavigasi di daftar item menu Sakai (DFS).
 * Melewati separator / item yang `visible === false`.
 * @param {Array<any>|null|undefined} items
 * @returns {string|null}
 */
export function findFirstActiveMenuPath(items) {
    if (!Array.isArray(items)) return null;

    for (const item of items) {
        if (!item || item.separator || item.visible === false) continue;

        if (typeof item.to === 'string' && item.to) {
            return item.to;
        }

        const nested = findFirstActiveMenuPath(item.items);
        if (nested) return nested;
    }

    return null;
}

/**
 * Path beranda: menu aktif pertama dari parent/section pertama (MAIN MENU, dll).
 * Fallback `/` jika menu kosong.
 * @param {unknown} [menu] - model Sakai opsional; default dari session `getMenu()`
 * @returns {string}
 */
export function getHomePath(menu) {
    const sections = ensureSakaiMenuShape(menu ?? getMenu());
    const firstParent = sections[0];
    return findFirstActiveMenuPath(firstParent?.items) || '/';
}

/**
 * Cari label menu yang `to`-nya cocok dengan path (exact match).
 * @param {string} path
 * @param {unknown} [menu]
 * @returns {string|null}
 */
export function findMenuLabelByPath(path, menu) {
    if (!path) return null;
    const target = normalizeMenuPath(path);

    const sections = ensureSakaiMenuShape(menu ?? getMenu());
    let bestLabel = null;
    let bestLen = -1;

    const walk = (items) => {
        for (const item of items || []) {
            if (!item || item.separator || item.visible === false) continue;

            if (typeof item.to === 'string' && item.to === target && item.to.length > bestLen) {
                bestLabel = typeof item.label === 'string' ? item.label : null;
                bestLen = item.to.length;
            }

            if (Array.isArray(item.items)) walk(item.items);
        }
    };

    for (const section of sections) {
        walk(section?.items);
    }

    return bestLabel;
}

/**
 * Cari icon menu dari md_menu (map link_menu → icon), fallback ke model Sakai session.
 * @param {string} path - link_menu / route path, mis. `/account/password`
 * @param {unknown} [menu]
 * @param {string} [fallback='pi pi-circle']
 * @returns {string}
 */
export function findMenuIconByPath(path, menu, fallback = 'pi pi-circle') {
    const target = normalizeMenuPath(path);
    if (!target) return fallback;

    const stored = getMenuIcons()[target];
    if (stored) return stored;

    const sections = ensureSakaiMenuShape(menu ?? getMenu());
    let bestIcon = null;
    let bestLen = -1;

    const walk = (items) => {
        for (const item of items || []) {
            if (!item || item.separator || item.visible === false) continue;

            if (typeof item.to === 'string' && item.to === target && item.to.length > bestLen && item.icon) {
                bestIcon = item.icon;
                bestLen = item.to.length;
            }

            if (Array.isArray(item.items)) walk(item.items);
        }
    };

    for (const section of sections) {
        walk(section?.items);
    }

    return bestIcon || fallback;
}

/**
 * @param {string|null|undefined} pageTitle
 * @returns {string}
 */
export function formatDocumentTitle(pageTitle) {
    const part = typeof pageTitle === 'string' ? pageTitle.trim() : '';
    return part ? `${part} - ${APP_TITLE}` : APP_TITLE;
}

/**
 * Urutan: label menu aktif → meta.title route → null.
 * @param {{ path?: string, matched?: Array<{ meta?: Record<string, unknown> }> }} route
 * @param {unknown} [menu]
 * @returns {string|null}
 */
export function resolvePageTitle(route, menu) {
    const fromMenu = findMenuLabelByPath(route?.path || '', menu);
    if (fromMenu) return fromMenu;

    const matched = route?.matched || [];
    for (let i = matched.length - 1; i >= 0; i -= 1) {
        const title = matched[i]?.meta?.title;
        if (typeof title === 'string' && title.trim()) return title.trim();
    }

    return null;
}

/**
 * Set `document.title` berdasarkan route saat ini.
 * @param {{ path?: string, matched?: Array<{ meta?: Record<string, unknown> }> }} route
 * @param {unknown} [menu]
 */
export function applyDocumentTitle(route, menu) {
    if (typeof document === 'undefined') return;
    document.title = formatDocumentTitle(resolvePageTitle(route, menu));
}
