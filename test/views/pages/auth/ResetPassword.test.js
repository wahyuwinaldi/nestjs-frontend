import ResetPassword from '@/views/pages/auth/ResetPassword.vue';
import { applyDocumentFavicon } from '@/composables/usePublicSettings';
import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { primeStubs, setupState } from '../../../helpers/mount';

const resetPassword = vi.fn();

vi.mock('@/composables/useAuthPassword', () => ({
    resetPassword: (...args) => resetPassword(...args)
}));

vi.mock('@/composables/usePublicSettings', () => ({
    PUBLIC_SETTING_CODES: { logoColor: 'logo', loginBg: 'bg', favicon: 'fav' },
    getPublicSettingUrl: () => '/asset.png',
    applyDocumentFavicon: vi.fn()
}));

async function mountReset(query = { token: 'valid-token' }) {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/auth/reset-password', component: ResetPassword },
            { path: '/auth/login', component: { template: '<div>login</div>' } }
        ]
    });
    await router.push({ path: '/auth/reset-password', query });
    await router.isReady();
    const wrapper = mount(ResetPassword, {
        global: { plugins: [router, [PrimeVue, {}]], stubs: primeStubs() }
    });
    return { wrapper, router };
}

describe('ResetPassword.vue', () => {
    beforeEach(() => {
        resetPassword.mockReset();
        applyDocumentFavicon.mockClear();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('shows error on mount when token is missing', async () => {
        const { wrapper } = await mountReset({});
        await wrapper.vm.$nextTick();
        expect(applyDocumentFavicon).toHaveBeenCalled();
        expect(wrapper.text()).toContain('Token reset password tidak ditemukan. Minta link baru.');
        wrapper.unmount();
    });

    it('shows error on mount when token query is not a string', async () => {
        const { wrapper } = await mountReset({ token: ['a', 'b'] });
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('Token reset password tidak ditemukan. Minta link baru.');
        wrapper.unmount();
    });

    it('renders reset form when token is present', async () => {
        const { wrapper } = await mountReset();
        expect(applyDocumentFavicon).toHaveBeenCalled();
        expect(wrapper.text()).toContain('Reset Password');
        expect(wrapper.find('form').exists()).toBe(true);
        expect(wrapper.text()).toContain('Simpan password');
        expect(wrapper.find('a[href="/auth/login"]').exists()).toBe(true);
        expect(wrapper.text()).toContain('Minimal 8 karakter');
        wrapper.unmount();
    });

    it('rejects submit when token is empty', async () => {
        const { wrapper } = await mountReset({});
        const state = setupState(wrapper);
        state.errorMessage = '';
        state.newPassword = 'NewPass1!';
        state.confirmPassword = 'NewPass1!';
        await state.onSubmit();
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('Token reset password tidak valid.');
        expect(resetPassword).not.toHaveBeenCalled();
        wrapper.unmount();
    });

    it('shows strength validation error for weak password', async () => {
        const { wrapper } = await mountReset();
        const inputs = wrapper.findAll('input[type="password"]');
        await inputs[0].setValue('weak');
        await inputs[1].setValue('weak');
        await wrapper.find('form').trigger('submit.prevent');
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toMatch(/Password minimal 8 karakter|huruf besar|huruf kecil|angka|simbol/i);
        expect(resetPassword).not.toHaveBeenCalled();
        wrapper.unmount();
    });

    it('updates password requirement classes when typing a strong password', async () => {
        const { wrapper } = await mountReset();
        const inputs = wrapper.findAll('input[type="password"]');
        await inputs[0].setValue('NewPass1!');
        await wrapper.vm.$nextTick();
        expect(wrapper.findAll('li.text-green-600').length).toBe(5);
        await inputs[1].setValue('NewPass1!');
        await wrapper.vm.$nextTick();
        const state = setupState(wrapper);
        expect(state.passwordsMatch).toBe(true);
        wrapper.unmount();
    });

    it('shows mismatch error when confirm password differs', async () => {
        const { wrapper } = await mountReset();
        const state = setupState(wrapper);
        state.newPassword = 'NewPass1!';
        state.confirmPassword = 'OtherPass1!';
        await state.onSubmit();
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('Konfirmasi password baru tidak cocok.');
        expect(resetPassword).not.toHaveBeenCalled();
        wrapper.unmount();
    });

    it('resets password successfully and redirects to login', async () => {
        resetPassword.mockResolvedValueOnce({ message: 'Password berhasil diubah custom.' });
        const { wrapper, router } = await mountReset({ token: 'abc' });
        const inputs = wrapper.findAll('input[type="password"]');
        await inputs[0].setValue('NewPass1!');
        await inputs[1].setValue('NewPass1!');
        await wrapper.find('form').trigger('submit.prevent');
        await wrapper.vm.$nextTick();

        expect(resetPassword).toHaveBeenCalledWith({
            token: 'abc',
            new_password: 'NewPass1!',
            confirm_password: 'NewPass1!'
        });
        expect(wrapper.text()).toContain('Password berhasil diubah custom.');
        const state = setupState(wrapper);
        expect(state.newPassword).toBe('');
        expect(state.confirmPassword).toBe('');
        expect(state.loading).toBe(false);

        await vi.advanceTimersByTimeAsync(2000);
        expect(router.currentRoute.value.path).toBe('/auth/login');
        wrapper.unmount();
    });

    it('uses fallback success message when API returns no message', async () => {
        resetPassword.mockResolvedValueOnce({});
        const { wrapper } = await mountReset();
        const state = setupState(wrapper);
        state.newPassword = 'NewPass1!';
        state.confirmPassword = 'NewPass1!';
        await state.onSubmit();
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain(
            'Password berhasil diubah. Silakan login dengan password baru Anda.'
        );
        wrapper.unmount();
    });

    it('shows API error message on failure', async () => {
        resetPassword.mockRejectedValueOnce(new Error('Token reset password sudah kedaluwarsa'));
        const { wrapper } = await mountReset();
        const state = setupState(wrapper);
        state.newPassword = 'NewPass1!';
        state.confirmPassword = 'NewPass1!';
        await state.onSubmit();
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('Token reset password sudah kedaluwarsa');
        wrapper.unmount();
    });

    it('uses fallback error message when rejection has no message', async () => {
        resetPassword.mockRejectedValueOnce({});
        const { wrapper } = await mountReset();
        const state = setupState(wrapper);
        state.newPassword = 'NewPass1!';
        state.confirmPassword = 'NewPass1!';
        await state.onSubmit();
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('Gagal mereset password.');
        wrapper.unmount();
    });
});
