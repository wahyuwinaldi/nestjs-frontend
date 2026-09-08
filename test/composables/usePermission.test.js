import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setEncryptedItem } from '@/utils/encryption';
import { getAkses, getMenuPermissions, hasMenuPermission, usePermission } from '@/composables/usePermission';
import * as encryption from '@/utils/encryption';

describe('usePermission', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('returns false when no akses has been persisted yet', () => {
        expect(hasMenuPermission('/master/user', 'AC')).toBe(false);
        expect(hasMenuPermission('', 'AC')).toBe(false);
        expect(getMenuPermissions(null)).toEqual([]);
    });

    it('matches permissions for a stored menu link', () => {
        setEncryptedItem('akses', [{ kd_menu: '1', link_menu: 'master/user', permissions: ['AC', 'IN', 'VW'] }]);

        expect(hasMenuPermission('/master/user', 'AC')).toBe(true);
        expect(hasMenuPermission('/master/user', 'IN')).toBe(true);
        expect(hasMenuPermission('/master/user', 'DT')).toBe(false);
    });

    it('normalizes leading slashes so link_menu with/without "/" both match', () => {
        setEncryptedItem('akses', [{ kd_menu: '2', link_menu: '/master/permission', permissions: ['AC'] }]);

        expect(hasMenuPermission('master/permission', 'AC')).toBe(true);
        expect(hasMenuPermission('/master/permission', 'AC')).toBe(true);
    });

    it('getMenuPermissions returns an empty array for an unknown path', () => {
        setEncryptedItem('akses', [{ kd_menu: '1', link_menu: 'master/user', permissions: ['AC'] }]);
        expect(getMenuPermissions('/does/not/exist')).toEqual([]);
    });

    it('is resilient to corrupted/garbage akses data', () => {
        localStorage.setItem('akses', 'not-encrypted-json');
        expect(hasMenuPermission('/master/user', 'AC')).toBe(false);
        expect(getAkses()).toEqual([]);
    });

    it('returns empty akses when stored value is not an array', () => {
        setEncryptedItem('akses', { kd_menu: '1' });
        expect(getAkses()).toEqual([]);
    });

    it('returns empty permissions when getEncryptedItem throws', () => {
        vi.spyOn(encryption, 'getEncryptedItem').mockImplementation(() => {
            throw new Error('boom');
        });
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(getMenuPermissions('/master/user')).toEqual([]);
        expect(spy).toHaveBeenCalled();
    });

    it('exposes can() for the current window path', () => {
        setEncryptedItem('akses', [{ kd_menu: '1', link_menu: '/master/user', permissions: ['AC'] }]);
        const { can, hasMenuPermission: hasPerm, getMenuPermissions: getPerms, getAkses: akses } = usePermission();
        window.history.pushState({}, '', '/master/user');
        expect(can('AC')).toBe(true);
        expect(can('IN')).toBe(false);
        expect(can('AC', '/master/user')).toBe(true);
        expect(can('AC', '/master/permission')).toBe(false);
        expect(hasPerm('/master/user', 'AC')).toBe(true);
        expect(getPerms('/master/user')).toEqual(['AC']);
        expect(akses()).toHaveLength(1);
    });
});
