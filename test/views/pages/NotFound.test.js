import NotFound from '@/views/pages/NotFound.vue';
import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';
import { primeStubs } from '../../helpers/mount';

vi.mock('@/composables/useHelper', () => ({
    getHomePath: () => '/'
}));

describe('NotFound.vue', () => {
    it('renders 404 page', async () => {
        const router = createRouter({
            history: createMemoryHistory(),
            routes: [{ path: '/missing', component: NotFound }]
        });
        await router.push('/missing');
        await router.isReady();
        const wrapper = mount(NotFound, {
            global: { plugins: [router, [PrimeVue, {}]], stubs: primeStubs() }
        });
        expect(wrapper.text()).toContain('Not Found');
        expect(wrapper.text()).toContain('404');
        wrapper.unmount();
    });
});
