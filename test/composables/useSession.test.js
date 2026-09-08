import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/composables/useApi', () => ({
    apiFetch: vi.fn()
}));

import { apiFetch } from '@/composables/useApi';
import { buildAksesList, consumeSessionExpiredNotice, getMenu, getMenuIcons, getSession, getSessionInfo, isAuthenticated, login, logout, markSessionExpired, updateSessionAkses, updateSessionMenu, useSession } from '@/composables/useSession';
import { getEncryptedItem, setEncryptedItem } from '@/utils/encryption';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';

describe('buildAksesList', () => {
    it('groups permission rows by menu code', () => {
        const menuByKode = new Map([
            ['MN1', { link_menu: '/a', nm_menu: 'A' }],
            ['MN2', { link_menu: 'b', nm_menu: 'B' }]
        ]);
        expect(
            buildAksesList(
                [
                    { kd_menu: 'MN1', kode: 'AC' },
                    { kd_menu: 'MN1', kode: 'IN' },
                    { kd_menu: 'MN2', kode: 'AC' },
                    { kd_menu: 'MN3', kode: 'VW' }
                ],
                menuByKode
            )
        ).toEqual([
            { kd_menu: 'MN1', link_menu: '/a', nm_menu: 'A', permissions: ['AC', 'IN'] },
            { kd_menu: 'MN2', link_menu: 'b', nm_menu: 'B', permissions: ['AC'] },
            { kd_menu: 'MN3', link_menu: '', nm_menu: '', permissions: ['VW'] }
        ]);
        expect(buildAksesList(null, menuByKode)).toEqual([]);
    });
});

describe('session storage helpers', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-12T01:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('markSessionExpired clears storage and can dispatch an event', () => {
        setEncryptedItem('session', { uid: '1', sessionExpiry: Date.now() + 1000 });
        setEncryptedItem('menu', []);
        setEncryptedItem('akses', []);
        setEncryptedItem('menuIcons', {});
        const listener = vi.fn();
        globalThis.addEventListener('session-expired', listener);

        markSessionExpired();
        expect(sessionStorage.getItem('session_expired_notice')).toBe('1');
        expect(getSession()).toBeNull();
        expect(listener).toHaveBeenCalled();

        markSessionExpired(false);
        globalThis.removeEventListener('session-expired', listener);
    });

    it('consumeSessionExpiredNotice is one-shot', () => {
        expect(consumeSessionExpiredNotice()).toBe(false);
        sessionStorage.setItem('session_expired_notice', '1');
        expect(consumeSessionExpiredNotice()).toBe(true);
        expect(consumeSessionExpiredNotice()).toBe(false);
        const proto = Object.getPrototypeOf(sessionStorage);
        const orig = proto.getItem;
        proto.getItem = function () {
            throw new Error('blocked');
        };
        expect(consumeSessionExpiredNotice()).toBe(false);
        proto.getItem = orig;
    });

    it('getSessionInfo reports remaining time', () => {
        expect(getSessionInfo()).toBeNull();
        setEncryptedItem('session', { uid: '1' });
        expect(getSessionInfo()).toEqual({ isValid: false, remainingMs: 0, remainingMinutes: 0 });
        setEncryptedItem('session', { uid: '1', sessionExpiry: Date.now() + 90_000 });
        expect(getSessionInfo()).toEqual({ isValid: true, remainingMs: 90_000, remainingMinutes: 2 });
        setEncryptedItem('session', { uid: '1', sessionExpiry: Date.now() - 1000 });
        expect(getSessionInfo().isValid).toBe(false);
    });

    it('getMenu normalizes legacy flat menu into session', () => {
        expect(getMenu()).toEqual([]);
        setEncryptedItem('menu', [{ label: 'Dashboard', to: '/' }]);
        expect(getMenu()).toEqual([{ label: 'MAIN MENU', items: [{ label: 'Dashboard', to: '/' }] }]);
        expect(getEncryptedItem('menu')[0].label).toBe('MAIN MENU');
        setEncryptedItem('menu', [
            {
                label: 'MAIN MENU',
                items: [{ label: 'MAIN MENU', items: [{ label: 'Dash', to: '/' }] }, { label: 'SYSTEM', items: [{ label: 'Menu', to: '/system/menu' }] }, { label: 'Orphan' }]
            }
        ]);
        const nested = getMenu();
        expect(nested[0].label).toBe('MAIN MENU');
        expect(nested.some((s) => s.label === 'SYSTEM')).toBe(true);
        expect(nested.some((s) => s.label === 'Orphan' && Array.isArray(s.items))).toBe(true);
    });

    it('getMenuIcons returns object map only', () => {
        expect(getMenuIcons()).toEqual({});
        setEncryptedItem('menuIcons', { '/a': 'ri-home-line' });
        expect(getMenuIcons()).toEqual({ '/a': 'ri-home-line' });
        setEncryptedItem('menuIcons', ['nope']);
        expect(getMenuIcons()).toEqual({});
    });

    it('isAuthenticated checks expiry', () => {
        expect(isAuthenticated()).toBe(false);
        setEncryptedItem('session', { uid: '1', sessionExpiry: Date.now() + 60_000 });
        expect(isAuthenticated()).toBe(true);
        setEncryptedItem('session', { uid: '1', sessionExpiry: Date.now() - 1 });
        expect(isAuthenticated()).toBe(false);
        expect(getSession()).toBeNull();
    });
});

describe('login / logout / updateSessionMenu', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        apiFetch.mockReset();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('login persists session and uses payload.build_menu when present', async () => {
        apiFetch.mockImplementation((path) => {
            if (path === '/auth/authorize') {
                return Promise.resolve({
                    data: {
                        user: { uid: 'u1', kd_role: 'R1', username: 'admin' },
                        build_menu: [
                            {
                                kd_menu: 'MN_MAIN',
                                nm_menu: 'MAIN MENU',
                                icon_menu: null,
                                link_menu: '#',
                                children: [
                                    { kd_menu: 'MN_D', nm_menu: 'Dash', icon_menu: 'home', link_menu: '/', children: [] },
                                    { nm_menu: 'Group A!', children: [{ nm_menu: 'Child', link_menu: 'child' }] }
                                ]
                            }
                        ],
                        menu: [{ kd_menu: 'MN_D', link_menu: '/', nm_menu: 'Dash', permissions: ['AC'] }]
                    }
                });
            }
            if (path === '/system/menu/flat') return Promise.resolve({ data: [{ kd_menu: 'MN_D', link_menu: '/', icon_menu: 'home' }] });
            return Promise.resolve({ data: [] });
        });

        const user = await login('admin', 'secret', true);
        expect(user.username).toBe('admin');
        expect(getSession().remember).toBe(true);
        expect(getEncryptedItem('akses')[0].permissions).toEqual(['AC']);
        expect(getMenu()[0].label).toBe('MAIN MENU');
    });

    it('login loads tree/flat/permission when payload has no build_menu', async () => {
        apiFetch.mockImplementation((path) => {
            if (path === '/auth/authorize') {
                return Promise.resolve({ data: { user: { uid: 'u1', kd_role: 'R1' } } });
            }
            if (path === '/system/menu/tree') {
                return Promise.resolve({
                    data: [
                        {
                            kd_menu: 'MN_MAIN',
                            nm_menu: 'MAIN MENU',
                            children: [{ kd_menu: 'MN_D', nm_menu: 'Dash', icon_menu: 'home', link_menu: '/', children: [] }]
                        }
                    ]
                });
            }
            if (path === '/system/menu/flat') {
                return Promise.resolve({
                    data: [
                        { kd_menu: 'MN_MAIN', link_menu: '#' },
                        { kd_menu: 'MN_D', link_menu: '/', icon_menu: 'home' }
                    ]
                });
            }
            if (String(path).startsWith('/master/permission')) {
                return Promise.resolve({
                    data: [
                        { kd_menu: 'MN_MAIN', kode: 'AC' },
                        { kd_menu: 'MN_D', kode: 'AC' }
                    ]
                });
            }
            return Promise.resolve({ data: [] });
        });

        await login('admin', 'x');
        expect(getEncryptedItem('akses').map((a) => a.kd_menu)).toEqual(['MN_MAIN', 'MN_D']);
        expect(getMenu()[0].items[0].to).toBe('/');
    });

    it('login still succeeds when secondary menu calls fail', async () => {
        apiFetch.mockImplementation((path) => {
            if (path === '/auth/authorize') return Promise.resolve({ data: { user: { uid: 'u1', kd_role: 'R1' } } });
            return Promise.reject(new Error('down'));
        });
        await login('admin', 'x');
        expect(getEncryptedItem('menu')).toEqual([]);
        expect(getEncryptedItem('akses')).toEqual([]);
    });

    it('login throws when user payload is missing', async () => {
        apiFetch.mockResolvedValue({ error: 'bad creds' });
        await expect(login('a', 'b')).rejects.toThrow('bad creds');
        apiFetch.mockResolvedValue({ success: false });
        await expect(login('a', 'b')).rejects.toThrow(/Login gagal/);
        apiFetch.mockResolvedValue({ data: {} });
        await expect(login('a', 'b')).rejects.toThrow(/data pengguna tidak ditemukan/);
    });

    it('logout clears local session even if API fails', async () => {
        setEncryptedItem('session', { uid: '1', sessionExpiry: Date.now() + 1000 });
        apiFetch.mockRejectedValue(new Error('offline'));
        await logout();
        expect(getSession()).toBeNull();

        apiFetch.mockResolvedValue({ success: true });
        setEncryptedItem('session', { uid: '1', sessionExpiry: Date.now() + 1000 });
        await logout();
        expect(getSession()).toBeNull();
    });

    it('updateSessionMenu refreshes menu/akses and dispatches events', async () => {
        setEncryptedItem('session', { uid: '1', sessionExpiry: Date.now() + 60_000 });
        const menuListener = vi.fn();
        globalThis.addEventListener('menu-updated', menuListener);
        apiFetch.mockImplementation((path) => {
            if (path === '/auth/menu') {
                return Promise.resolve({
                    data: {
                        build_menu: [{ kd_menu: 'MN_D', nm_menu: 'Dash', icon_menu: 'home', link_menu: '/', children: [] }],
                        menu: [{ kd_menu: 'MN_D', link_menu: '/', nm_menu: 'Dash', permissions: ['AC'] }]
                    }
                });
            }
            if (path === '/system/menu/flat') return Promise.resolve({ data: [] });
            return Promise.resolve({ data: [] });
        });
        await updateSessionMenu();
        expect(getEncryptedItem('akses')[0].kd_menu).toBe('MN_D');
        expect(menuListener).toHaveBeenCalled();
        await updateSessionAkses();
        globalThis.removeEventListener('menu-updated', menuListener);
    });

    it('updateSessionMenu no-ops without session and swallows errors', async () => {
        await updateSessionMenu();
        expect(apiFetch).not.toHaveBeenCalled();
        setEncryptedItem('session', { uid: '1', sessionExpiry: Date.now() + 60_000 });
        apiFetch.mockRejectedValue(new Error('fail'));
        await updateSessionMenu();
        expect(console.error).toHaveBeenCalled();
        apiFetch.mockReset();
        apiFetch.mockImplementation((path) => {
            if (path === '/auth/menu') return Promise.resolve({ data: { build_menu: [], menu: [] } });
            if (path === '/system/menu/flat') return Promise.reject(new Error('icons down'));
            return Promise.resolve({ data: [] });
        });
        await updateSessionMenu();
        expect(console.warn).toHaveBeenCalled();
        apiFetch.mockReset();
        apiFetch.mockImplementation((path) => {
            if (path === '/auth/menu') {
                return Promise.resolve({
                    data: { build_menu: [], menu: [{ kd_menu: 'M1' }] }
                });
            }
            return Promise.resolve({ data: [] });
        });
        await updateSessionMenu();
        expect(getEncryptedItem('akses')[0]).toMatchObject({ kd_menu: 'M1', link_menu: '', nm_menu: '', permissions: [] });
    });

    it('useSession composable wires login/logout/refresh', async () => {
        apiFetch.mockImplementation((path) => {
            if (path === '/auth/authorize') return Promise.resolve({ data: { user: { uid: 'u1', kd_role: 'R1' } } });
            if (path === '/auth/logout') return Promise.resolve({ success: true });
            return Promise.reject(new Error('skip'));
        });

        const Comp = defineComponent({
            setup() {
                return useSession();
            },
            template: '<div />'
        });
        const wrapper = mount(Comp);
        await wrapper.vm.login('admin', 'x', false);
        expect(wrapper.vm.session.uid).toBe('u1');
        expect(wrapper.vm.isAuthenticated()).toBe(true);
        await wrapper.vm.logout();
        expect(wrapper.vm.session).toBeNull();
        wrapper.unmount();
    });
});
