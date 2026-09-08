import { apiFetch } from '@/composables/useApi';
import { getEncryptedItem, removeEncryptedItem, setEncryptedItem } from '@/utils/encryption';
import { resolveMenuIconClass } from '@/utils/menuIcon';
import { ref } from 'vue';

const SHORT_SESSION_MS = 2 * 60 * 60 * 1000; // 2h
const REMEMBER_SESSION_MS = 24 * 60 * 60 * 1000; // 24h
const SESSION_EXPIRED_NOTICE_KEY = 'session_expired_notice';

/**
 * Group flat `master/permission` rows by kd_menu into the "akses" shape used
 * throughout the app: [{ kd_menu, link_menu, permissions: ['AC','IN',...] }].
 * @param {Array<any>} permissionRows
 * @param {Map<string, any>} menuByKode
 */
export function buildAksesList(permissionRows, menuByKode) {
    const grouped = new Map();
    for (const row of permissionRows || []) {
        if (!grouped.has(row.kd_menu)) grouped.set(row.kd_menu, new Set());
        grouped.get(row.kd_menu).add(row.kode);
    }

    const akses = [];
    grouped.forEach((kodeSet, kdMenu) => {
        const menu = menuByKode.get(kdMenu);
        akses.push({
            kd_menu: kdMenu,
            link_menu: menu?.link_menu || '',
            nm_menu: menu?.nm_menu || '',
            permissions: Array.from(kodeSet)
        });
    });
    return akses;
}

/**
 * Prune the menu tree: node hanya tampil jika punya AC sendiri.
 * Parent tanpa AC tidak muncul meski punya children yang ber-AC.
 * @param {Array<any>} nodes
 * @param {Array<{kd_menu:string, permissions:string[]}>} akses
 */
export function filterMenuTree(nodes, akses) {
    const permsByMenu = new Map((akses || []).map((a) => [a.kd_menu, a.permissions]));

    const walk = (node) => {
        const perms = permsByMenu.get(node.kd_menu) || [];
        const hasOwnAccess = perms.includes('AC');
        if (!hasOwnAccess) return null;
        const children = (node.children || []).map(walk).filter(Boolean);
        return { ...node, children };
    };

    return (nodes || []).map(walk).filter(Boolean);
}

/**
 * Convert a `system/menu/tree` node list into the Sakai `AppMenu` model.
 * Setiap root dari DB (MAIN MENU, Master Data, …) jadi section setingkat — label dari DB.
 * Legacy flat (semua root tanpa children) tetap di-wrap sekali.
 * @param {Array<any>} nodes
 */
export function toSakaiMenu(nodes) {
    const list = nodes || [];
    if (list.length === 0) return [];

    const hasSectionRoot = list.some((node) => Array.isArray(node.children) && node.children.length > 0);

    if (hasSectionRoot) {
        return list.map((node) => ({
            label: node.nm_menu,
            items: Array.isArray(node.children) ? node.children.map((child) => convertMenuNode(child)) : []
        }));
    }

    // Legacy flat: seluruh root adalah leaf — butuh satu section agar Sakai render.
    return [
        {
            label: 'MAIN MENU',
            items: list.map((node) => convertMenuNode(node))
        }
    ];
}

/**
 * Pastikan bentuk model Sakai: section header(s) berisi items.
 * Multiple root section (dari DB) dipertahankan.
 * Unwrap double-wrap lama; sibling root (mis. Master Data) jadi section sendiri.
 * Flat legacy tanpa wrapper di-wrap ke satu MAIN MENU.
 * @param {unknown} menu
 * @returns {Array<{label:string, items?: any[]}>}
 */
export function ensureSakaiMenuShape(menu) {
    if (!Array.isArray(menu) || menu.length === 0) return [];

    // Sudah berbentuk section Sakai: top-level punya `items`, tanpa `to` (bukan leaf route).
    const looksLikeSections = menu.every((m) => m && typeof m === 'object' && Array.isArray(m.items) && !m.to);
    if (looksLikeSections) {
        // Session lama: hardcode MAIN MENU membungkus ulang MAIN MENU dari DB.
        if (menu.length === 1 && menu[0].label === 'MAIN MENU' && Array.isArray(menu[0].items) && menu[0].items[0]?.label === 'MAIN MENU' && Array.isArray(menu[0].items[0].items)) {
            const [mainFromDb, ...rest] = menu[0].items;
            const sections = [{ label: mainFromDb.label, items: mainFromDb.items || [] }];
            for (const item of rest) {
                if (Array.isArray(item.items)) {
                    sections.push({ label: item.label, items: item.items });
                } else {
                    sections.push({ label: item.label, items: [] });
                }
            }
            return sections;
        }
        return menu;
    }

    // Flat / legacy: top-level entries are real menu nodes (punya to/path/items).
    return [
        {
            label: 'MAIN MENU',
            items: menu
        }
    ];
}

/**
 * @param {any} node
 * @returns {{ label: string, icon: string, to?: string, path?: string, items?: any[] }}
 */
function convertMenuNode(node) {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const item = {
        label: node.nm_menu,
        icon: resolveMenuIconClass(node.icon_menu, 'pi pi-fw pi-circle')
    };

    if (hasChildren) {
        // Submenu parents must expose `path` for AppMenuItem expand/collapse.
        const base = node.link_menu && node.link_menu !== '#' ? (node.link_menu.startsWith('/') ? node.link_menu : `/${node.link_menu}`) : `/group/${node.kd_menu || slugify(node.nm_menu)}`;
        item.path = base;
        item.items = node.children.map((child) => convertMenuNode(child));
    } else if (node.link_menu) {
        item.to = node.link_menu.startsWith('/') ? node.link_menu : `/${node.link_menu}`;
    }

    return item;
}

function slugify(value) {
    return String(value || 'menu')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function isExpired(session) {
    if (!session || typeof session.sessionExpiry !== 'number') return true;
    return Date.now() > session.sessionExpiry;
}

function clearLocalSession() {
    removeEncryptedItem('session');
    removeEncryptedItem('menu');
    removeEncryptedItem('akses');
    removeEncryptedItem('menuIcons');
}

/**
 * Normalize link_menu so lookups match route paths.
 * @param {unknown} value
 * @returns {string}
 */
function normalizeMenuLink(value) {
    if (value == null) return '';
    const raw = String(value).trim();
    if (!raw || raw === '#') return '';
    return raw.startsWith('/') ? raw : `/${raw}`;
}

/**
 * Build map link_menu → CSS icon class from md_menu flat/tree rows.
 * @param {Array<any>|null|undefined} items
 * @param {{ nested?: boolean }} [options]
 * @returns {Record<string, string>}
 */
function buildMenuIconsByLink(items, options = {}) {
    const icons = {};
    const walk = (list) => {
        for (const item of list || []) {
            const link = normalizeMenuLink(item?.link_menu);
            if (link) {
                const icon = resolveMenuIconClass(item?.icon_menu, '');
                if (icon) icons[link] = icon;
            }
            if (options.nested && Array.isArray(item?.children)) walk(item.children);
        }
    };
    walk(items);
    return icons;
}

/**
 * Persist md_menu icons by link_menu. Prefers flat list; else walks tree; else fetches /system/menu/flat.
 * @param {Array<any>|null|undefined} [flatOrTree]
 * @param {{ nested?: boolean }} [options]
 */
async function persistMenuIcons(flatOrTree, options = {}) {
    if (Array.isArray(flatOrTree) && flatOrTree.length > 0) {
        setEncryptedItem('menuIcons', buildMenuIconsByLink(flatOrTree, options));
        return;
    }
    try {
        const flatRes = await apiFetch('/system/menu/flat');
        setEncryptedItem('menuIcons', buildMenuIconsByLink(flatRes?.data || []));
    } catch (error) {
        console.warn('Failed to load menu icons from md_menu:', error);
    }
}

/** @returns {Record<string, string>} */
export function getMenuIcons() {
    const icons = getEncryptedItem('menuIcons');
    return icons && typeof icons === 'object' && !Array.isArray(icons) ? icons : {};
}

/** Tandai session habis agar halaman login bisa menampilkan pemberitahuan. */
export function markSessionExpired(dispatchEvent = true) {
    try {
        sessionStorage.setItem(SESSION_EXPIRED_NOTICE_KEY, '1');
    } catch {
        // ignore storage errors
    }
    clearLocalSession();
    if (dispatchEvent && typeof globalThis !== 'undefined') {
        globalThis.dispatchEvent(new CustomEvent('session-expired'));
    }
}

/** Ambil dan hapus flag pemberitahuan session habis (sekali pakai). */
export function consumeSessionExpiredNotice() {
    try {
        const flagged = sessionStorage.getItem(SESSION_EXPIRED_NOTICE_KEY) === '1';
        if (flagged) sessionStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY);
        return flagged;
    } catch {
        return false;
    }
}

/**
 * Info sisa waktu session lokal.
 * @returns {{ isValid: boolean, remainingMs: number, remainingMinutes: number } | null}
 */
export function getSessionInfo() {
    const session = getEncryptedItem('session');
    if (!session) return null;
    if (typeof session.sessionExpiry !== 'number') {
        return { isValid: false, remainingMs: 0, remainingMinutes: 0 };
    }
    const remainingMs = session.sessionExpiry - Date.now();
    return {
        isValid: remainingMs > 0,
        remainingMs: Math.max(0, remainingMs),
        remainingMinutes: Math.max(0, Math.ceil(remainingMs / 60000))
    };
}

/**
 * Fetch the menu tree/flat list + role permissions and persist the derived
 * sidebar menu ("menu") and flat permission list ("akses"). Best-effort:
 * if these secondary calls fail the login itself is still considered
 * successful (the JWT cookie is already set), just with an empty sidebar.
 * @param {{kd_role:string}} user
 */
async function loadMenuAndPermissions(user, payload = {}) {
    try {
        if (payload.build_menu && payload.menu) {
            const akses = (payload.menu || []).map((item) => ({
                kd_menu: item.kd_menu,
                link_menu: item.link_menu || '',
                nm_menu: item.nm_menu || '',
                permissions: item.permissions || []
            }));
            const sidebarMenu = toSakaiMenu(payload.build_menu);
            setEncryptedItem('menu', ensureSakaiMenuShape(sidebarMenu));
            setEncryptedItem('akses', akses);
            // Icon map dari seluruh md_menu aktif (bukan hanya sidebar ber-AC).
            await persistMenuIcons();
            return;
        }

        const [treeRes, flatRes, permissionRes] = await Promise.all([apiFetch('/system/menu/tree'), apiFetch('/system/menu/flat'), apiFetch(`/master/permission?kd_role=${encodeURIComponent(user.kd_role)}`)]);

        const tree = treeRes?.data || [];
        const flat = flatRes?.data || [];
        const permissions = permissionRes?.data || [];

        const menuByKode = new Map(flat.map((item) => [item.kd_menu, item]));
        const akses = buildAksesList(permissions, menuByKode);
        const filteredTree = filterMenuTree(tree, akses);
        const sidebarMenu = ensureSakaiMenuShape(toSakaiMenu(filteredTree));

        setEncryptedItem('menu', sidebarMenu);
        setEncryptedItem('akses', akses);
        await persistMenuIcons(flat);
    } catch (error) {
        console.error('Failed to load menu/permissions, sidebar will be empty:', error);
        setEncryptedItem('menu', []);
        setEncryptedItem('akses', []);
        setEncryptedItem('menuIcons', {});
    }
}

/**
 * Authenticate against POST /auth/authorize. On success the backend sets an
 * httpOnly JWT cookie; we persist the user profile + derived menu/akses in
 * localStorage (AES-encrypted) for the sidebar and route guards.
 * @param {string} username
 * @param {string} password
 * @param {boolean} [remember]
 */
export async function login(username, password, remember = false) {
    const response = await apiFetch('/auth/authorize', {
        method: 'POST',
        data: { username, password, remember }
    });

    const user = response?.data?.user;
    if (!user) {
        throw new Error(response?.error || 'Login gagal: data pengguna tidak ditemukan');
    }

    const sessionTimeout = remember ? REMEMBER_SESSION_MS : SHORT_SESSION_MS;
    setEncryptedItem('session', {
        ...user,
        remember,
        loginAt: Date.now(),
        sessionExpiry: Date.now() + sessionTimeout
    });

    await loadMenuAndPermissions(user, response?.data || {});

    return user;
}

/**
 * Clear the cookie server-side (best-effort) and wipe local session state.
 */
export async function logout() {
    try {
        await apiFetch('/auth/logout', { method: 'POST' });
    } catch (error) {
        console.warn('Logout request failed (clearing local session anyway):', error);
    } finally {
        clearLocalSession();
    }
}

export function getSession() {
    return getEncryptedItem('session');
}

export function getMenu() {
    const menu = getEncryptedItem('menu');
    const normalized = ensureSakaiMenuShape(Array.isArray(menu) ? menu : []);
    // Perbaiki session lama yang belum punya wrapper MAIN MENU.
    if (Array.isArray(menu) && menu.length > 0 && JSON.stringify(menu) !== JSON.stringify(normalized)) {
        setEncryptedItem('menu', normalized);
    }
    return normalized;
}

export function isAuthenticated() {
    const session = getSession();
    if (!session) return false;
    if (isExpired(session)) {
        markSessionExpired(false);
        return false;
    }
    return true;
}

/**
 * Reload sidebar menu + akses from GET /auth/menu (private prefers role).
 * Dispatches `menu-updated` so AppMenu can refresh without full page reload.
 */
export async function updateSessionMenu() {
    try {
        if (!getSession()) return;
        const response = await apiFetch('/auth/menu');
        const payload = response?.data || {};
        const akses = (payload.menu || []).map((item) => ({
            kd_menu: item.kd_menu,
            link_menu: item.link_menu || '',
            nm_menu: item.nm_menu || '',
            permissions: item.permissions || []
        }));
        const sidebarMenu = ensureSakaiMenuShape(toSakaiMenu(payload.build_menu || []));
        setEncryptedItem('menu', sidebarMenu);
        setEncryptedItem('akses', akses);
        await persistMenuIcons();
        if (typeof globalThis !== 'undefined') {
            globalThis.dispatchEvent(new CustomEvent('menu-updated'));
            globalThis.dispatchEvent(new CustomEvent('akses-updated'));
        }
    } catch (error) {
        console.error('Failed to update session menu:', error);
    }
}

/** Alias: akses is refreshed together with menu via /auth/menu. */
export async function updateSessionAkses() {
    return updateSessionMenu();
}

/**
 * Vue composable wrapper exposing reactive session state + the actions
 * above, for use inside components.
 */
export function useSession() {
    const session = ref(getSession());

    const refresh = () => {
        session.value = getSession();
    };

    const doLogin = async (username, password, remember = false) => {
        const user = await login(username, password, remember);
        refresh();
        return user;
    };

    const doLogout = async () => {
        await logout();
        refresh();
    };

    return {
        session,
        refresh,
        login: doLogin,
        logout: doLogout,
        isAuthenticated,
        getMenu,
        getMenuIcons,
        getSessionInfo,
        markSessionExpired,
        consumeSessionExpiredNotice,
        updateSessionMenu,
        updateSessionAkses
    };
}
