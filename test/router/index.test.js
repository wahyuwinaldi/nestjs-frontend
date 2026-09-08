import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const isAuthenticated = vi.fn();
const hasMenuPermission = vi.fn();
const getHomePath = vi.fn(() => '/master/user');
const applyDocumentTitle = vi.fn();

vi.mock('@/composables/useSession', () => ({
    isAuthenticated: (...args) => isAuthenticated(...args)
}));

vi.mock('@/composables/usePermission', () => ({
    hasMenuPermission: (...args) => hasMenuPermission(...args)
}));

vi.mock('@/composables/useHelper', () => ({
    getHomePath: (...args) => getHomePath(...args),
    applyDocumentTitle: (...args) => applyDocumentTitle(...args)
}));

vi.mock('@/layout/AppLayout.vue', () => ({
    default: { template: '<div class="app-layout"><router-view /></div>' }
}));

vi.mock('@/views/Dashboard.vue', () => ({ default: { template: '<div>dashboard</div>' } }));
vi.mock('@/views/master/User.vue', () => ({ default: { template: '<div>user</div>' } }));
vi.mock('@/views/account/ChangePassword.vue', () => ({ default: { template: '<div>password</div>' } }));
vi.mock('@/views/pages/auth/Login.vue', () => ({ default: { template: '<div>login</div>' } }));
vi.mock('@/views/pages/auth/Access.vue', () => ({ default: { template: '<div>access</div>' } }));

import router from '@/router';

describe('router guards', () => {
    beforeEach(() => {
        isAuthenticated.mockReset();
        hasMenuPermission.mockReset();
        getHomePath.mockReset().mockReturnValue('/master/user');
        applyDocumentTitle.mockClear();
        sessionStorage.clear();
    });

    afterEach(async () => {
        isAuthenticated.mockReturnValue(false);
        await router.push('/auth/login').catch(() => {});
    });

    it('allows auth pages without auth', async () => {
        isAuthenticated.mockReturnValue(false);
        await router.push('/auth/login');
        expect(router.currentRoute.value.path).toBe('/auth/login');
        expect(applyDocumentTitle).toHaveBeenCalled();
    });

    it('redirects authenticated users away from login to home', async () => {
        isAuthenticated.mockReturnValue(true);
        hasMenuPermission.mockReturnValue(true);
        await router.push('/pages/notfound');
        await router.push('/auth/login');
        expect(router.currentRoute.value.path).toBe('/master/user');
    });

    it('sends guests to login with redirect and expired reason', async () => {
        isAuthenticated.mockReturnValue(false);
        sessionStorage.setItem('session_expired_notice', '1');
        await router.push('/master/user');
        expect(router.currentRoute.value.path).toBe('/auth/login');
        expect(router.currentRoute.value.query.redirect).toBe('/master/user');
        expect(router.currentRoute.value.query.reason).toBe('expired');
    });

    it('redirects / to first home path when authenticated', async () => {
        isAuthenticated.mockReturnValue(true);
        hasMenuPermission.mockReturnValue(true);
        await router.push('/');
        expect(router.currentRoute.value.path).toBe('/master/user');
    });

    it('allows account routes without menu permission', async () => {
        isAuthenticated.mockReturnValue(true);
        hasMenuPermission.mockReturnValue(false);
        await router.push('/account/password');
        expect(router.currentRoute.value.path).toBe('/account/password');
    });

    it('blocks protected routes without AC', async () => {
        isAuthenticated.mockReturnValue(true);
        hasMenuPermission.mockReturnValue(false);
        await router.push('/master/user');
        expect(router.currentRoute.value.path).toBe('/auth/access');
        expect(hasMenuPermission).toHaveBeenCalledWith('/master/user', 'AC');
    });

    it('allows protected routes with AC', async () => {
        isAuthenticated.mockReturnValue(true);
        hasMenuPermission.mockReturnValue(true);
        await router.push('/master/user');
        expect(router.currentRoute.value.path).toBe('/master/user');
    });

    it('stays on / when home path is also /', async () => {
        isAuthenticated.mockReturnValue(true);
        hasMenuPermission.mockReturnValue(true);
        getHomePath.mockReturnValue('/');
        await router.push('/');
        expect(router.currentRoute.value.path).toBe('/');
    });

    it('ignores sessionStorage errors when redirecting guests', async () => {
        isAuthenticated.mockReturnValue(false);
        const orig = sessionStorage.getItem.bind(sessionStorage);
        sessionStorage.getItem = (key) => {
            if (key === 'session_expired_notice') throw new Error('blocked');
            return orig(key);
        };
        try {
            await router.push('/master/user');
            expect(router.currentRoute.value.path).toBe('/auth/login');
            expect(router.currentRoute.value.query.reason).toBeUndefined();
        } finally {
            sessionStorage.getItem = orig;
        }
    });

    it('invokes lazy route factories', () => {
        const walk = (routes) => {
            for (const r of routes || []) {
                if (typeof r.component === 'function') {
                    Promise.resolve(r.component()).catch(() => {});
                }
                if (r.children) walk(r.children);
            }
        };
        walk(router.options.routes);
    });
});
