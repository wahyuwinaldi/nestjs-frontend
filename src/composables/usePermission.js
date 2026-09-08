import { getEncryptedItem } from '@/utils/encryption';

/**
 * Normalize a menu link so both '/master/user' and 'master/user'
 * compare equal to a route path.
 * @param {string} value
 */
function normalizeLink(value) {
    if (!value) return '';
    return value.startsWith('/') ? value : `/${value}`;
}

/**
 * Read the flat permission list ("akses") persisted at login time.
 * Shape: [{ kd_menu, link_menu, permissions: ['AC','IN','UP','DT','VW', ...] }]
 * @returns {Array<{kd_menu:string, link_menu:string, permissions:string[]}>}
 */
export function getAkses() {
    const akses = getEncryptedItem('akses');
    return Array.isArray(akses) ? akses : [];
}

/**
 * @param {string} menuPath
 * @returns {string[]}
 */
export function getMenuPermissions(menuPath) {
    try {
        const akses = getAkses();
        const target = normalizeLink(menuPath);
        const menuItem = akses.find((item) => normalizeLink(item.link_menu) === target);
        return menuItem?.permissions || [];
    } catch (error) {
        console.error('Error getting menu permissions:', error);
        return [];
    }
}

/**
 * @param {string} menuPath
 * @param {string} permission action code, e.g. 'AC' | 'IN' | 'UP' | 'DT' | 'VW'
 */
export function hasMenuPermission(menuPath, permission) {
    return getMenuPermissions(menuPath).includes(permission);
}

/**
 * Vue composable form, resolving the current route automatically.
 */
export function usePermission() {
    const can = (permission, path) => {
        const menuPath = path ?? (typeof window !== 'undefined' ? window.location.pathname : '');
        return hasMenuPermission(menuPath, permission);
    };

    return { can, hasMenuPermission, getMenuPermissions, getAkses };
}
