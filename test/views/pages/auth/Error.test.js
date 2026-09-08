import ErrorPage from '@/views/pages/auth/Error.vue';
import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';
import { primeStubs } from '../../../helpers/mount';

vi.mock('@/composables/useHelper', () => ({
    getHomePath: () => '/'
}));

describe('Error.vue', () => {
    it('renders error page', async () => {
        const router = createRouter({
            history: createMemoryHistory(),
            routes: [{ path: '/auth/error', component: ErrorPage }]
        });
        await router.push('/auth/error');
        await router.isReady();
        const wrapper = mount(ErrorPage, {
            global: { plugins: [router, [PrimeVue, {}]], stubs: primeStubs() }
        });
        expect(wrapper.text()).toContain('Error Occured');
        wrapper.unmount();
    });
});
