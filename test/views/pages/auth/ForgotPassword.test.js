import ForgotPassword from '@/views/pages/auth/ForgotPassword.vue';
import { applyDocumentFavicon } from '@/composables/usePublicSettings';
import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { primeStubs, setupState } from '../../../helpers/mount';

const forgotPassword = vi.fn();

vi.mock('@/composables/useAuthPassword', () => ({
    forgotPassword: (...args) => forgotPassword(...args)
}));

vi.mock('@/composables/usePublicSettings', () => ({
    PUBLIC_SETTING_CODES: { logoColor: 'logo', loginBg: 'bg', favicon: 'fav' },
    getPublicSettingUrl: () => '/asset.png',
    applyDocumentFavicon: vi.fn()
}));

async function mountForgot() {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/auth/forgot-password', component: ForgotPassword },
            { path: '/auth/login', component: { template: '<div>login</div>' } }
        ]
    });
    await router.push('/auth/forgot-password');
    await router.isReady();
    const wrapper = mount(ForgotPassword, {
        global: { plugins: [router, [PrimeVue, {}]], stubs: primeStubs() }
    });
    return { wrapper, router };
}

describe('ForgotPassword.vue', () => {
    beforeEach(() => {
        forgotPassword.mockReset();
        applyDocumentFavicon.mockClear();
    });

    it('renders title, form, and link back to login', async () => {
        const { wrapper } = await mountForgot();
        expect(applyDocumentFavicon).toHaveBeenCalled();
        expect(wrapper.text()).toContain('Lupa Password');
        expect(wrapper.find('#identifier').exists()).toBe(true);
        expect(wrapper.find('form').exists()).toBe(true);
        expect(wrapper.text()).toContain('Kirim link reset');
        expect(wrapper.find('a[href="/auth/login"]').exists()).toBe(true);
        wrapper.unmount();
    });

    it('shows validation when identifier is empty', async () => {
        const { wrapper } = await mountForgot();
        await wrapper.find('form').trigger('submit.prevent');
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('Username atau email wajib diisi.');
        expect(forgotPassword).not.toHaveBeenCalled();
        wrapper.unmount();
    });

    it('shows validation when identifier is whitespace only', async () => {
        const { wrapper } = await mountForgot();
        const state = setupState(wrapper);
        state.identifier = '   ';
        await state.onSubmit();
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('Username atau email wajib diisi.');
        expect(forgotPassword).not.toHaveBeenCalled();
        wrapper.unmount();
    });

    it('submits trimmed identifier via input and shows success message from API', async () => {
        forgotPassword.mockResolvedValueOnce({ message: 'Link terkirim ke email.' });
        const { wrapper } = await mountForgot();
        await wrapper.find('#identifier').setValue('  super  ');
        await wrapper.find('form').trigger('submit.prevent');
        await wrapper.vm.$nextTick();
        expect(forgotPassword).toHaveBeenCalledWith('super');
        expect(wrapper.text()).toContain('Link terkirim ke email.');
        expect(setupState(wrapper).loading).toBe(false);
        wrapper.unmount();
    });

    it('uses fallback success message when API data has no message', async () => {
        forgotPassword.mockResolvedValueOnce({});
        const { wrapper } = await mountForgot();
        const state = setupState(wrapper);
        state.identifier = 'user@example.com';
        await state.onSubmit();
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain(
            'Jika akun ditemukan dan memiliki email, link reset password telah dikirim.'
        );
        wrapper.unmount();
    });

    it('shows API error message on failure', async () => {
        forgotPassword.mockRejectedValueOnce(new Error('SMTP gagal'));
        const { wrapper } = await mountForgot();
        const state = setupState(wrapper);
        state.identifier = 'super';
        await state.onSubmit();
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('SMTP gagal');
        wrapper.unmount();
    });

    it('uses fallback error message when rejection has no message', async () => {
        forgotPassword.mockRejectedValueOnce({});
        const { wrapper } = await mountForgot();
        const state = setupState(wrapper);
        state.identifier = 'super';
        await state.onSubmit();
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('Gagal memproses permintaan.');
        wrapper.unmount();
    });
});
