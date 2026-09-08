import Logout from '@/views/pages/auth/Logout.vue';
import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/composables/useSession', () => ({
    logout: vi.fn()
}));

import { logout } from '@/composables/useSession';

async function mountLogout() {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/auth/logout', component: Logout },
            { path: '/auth/login', component: { template: '<div>login</div>' } }
        ]
    });
    router.push('/auth/logout');
    await router.isReady();
    return { wrapper: mount(Logout, { global: { plugins: [router, [PrimeVue, {}]] } }), router };
}

describe('Logout.vue', () => {
    beforeEach(() => {
        logout.mockReset();
        logout.mockResolvedValue();
    });

    it('calls logout then redirects to login', async () => {
        const { wrapper, router } = await mountLogout();
        await vi.waitFor(() => {
            expect(logout).toHaveBeenCalled();
            expect(router.currentRoute.value.path).toBe('/auth/login');
        });
        expect(wrapper.text()).toContain('Anda telah keluar.');
        wrapper.unmount();
    });

    it('still redirects when logout throws', async () => {
        logout.mockRejectedValue(new Error('offline'));
        const { wrapper, router } = await mountLogout();
        await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/auth/login'));
        wrapper.unmount();
    });
});
