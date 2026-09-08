import Access from '@/views/pages/auth/Access.vue';
import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';
import { primeStubs } from '../../../helpers/mount';

vi.mock('@/composables/useHelper', () => ({
    getHomePath: () => '/'
}));

describe('Access.vue', () => {
    it('renders access denied and links home', async () => {
        const router = createRouter({
            history: createMemoryHistory(),
            routes: [{ path: '/auth/access', component: Access }]
        });
        await router.push('/auth/access');
        await router.isReady();
        const wrapper = mount(Access, {
            global: { plugins: [router, [PrimeVue, {}]], stubs: primeStubs() }
        });
        expect(wrapper.text()).toContain('Access Denied');
        wrapper.unmount();
    });
});
