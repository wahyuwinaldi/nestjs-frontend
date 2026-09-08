import Login from '@/views/pages/auth/Login.vue';
import { changeExpiredPassword } from '@/composables/useAuthPassword';
import { applyDocumentFavicon } from '@/composables/usePublicSettings';
import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { primeStubs, setupState } from '../../../helpers/mount';

const login = vi.fn();
const consumeSessionExpiredNotice = vi.fn(() => false);

vi.mock('@/composables/useSession', () => ({
    useSession: () => ({ login }),
    consumeSessionExpiredNotice: (...args) => consumeSessionExpiredNotice(...args)
}));

vi.mock('@/composables/useAuthPassword', () => ({
    changeExpiredPassword: vi.fn()
}));

vi.mock('@/composables/useHelper', () => ({
    getHomePath: () => '/master/user'
}));

vi.mock('@/composables/usePublicSettings', () => ({
    PUBLIC_SETTING_CODES: { logoColor: 'logo', loginBg: 'bg', favicon: 'fav' },
    getPublicSettingUrl: () => '/asset.png',
    applyDocumentFavicon: vi.fn()
}));

function passwordExpiredError(overrides = {}) {
    const err = new Error(
        overrides.message || 'Password telah kedaluwarsa. Silakan buat password baru untuk melanjutkan.'
    );
    err.code = 'PASSWORD_EXPIRED';
    err.data = { code: 'PASSWORD_EXPIRED', change_token: overrides.change_token || 'chg-token' };
    if (overrides.omitMessage) {
        delete err.message;
        Object.defineProperty(err, 'message', { value: undefined });
    }
    return err;
}

async function mountLogin(query = {}) {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: { template: '<div>home</div>' } },
            { path: '/auth/login', component: Login },
            { path: '/auth/forgot-password', component: { template: '<div>forgot</div>' } },
            { path: '/master/user', component: { template: '<div>user</div>' } },
            { path: '/dashboard', component: { template: '<div>dash</div>' } }
        ]
    });
    await router.push({ path: '/auth/login', query });
    await router.isReady();
    const wrapper = mount(Login, {
        global: { plugins: [router, [PrimeVue, {}]], stubs: primeStubs() }
    });
    return { wrapper, router };
}

async function enterExpiredMode(wrapper, token = 'chg-token') {
    const err = passwordExpiredError({ change_token: token });
    login.mockRejectedValueOnce(err);
    const state = setupState(wrapper);
    state.username = 'admin';
    state.password = 'OldPass1!';
    await state.onSubmit();
    await wrapper.vm.$nextTick();
    return state;
}

describe('Login.vue', () => {
    beforeEach(() => {
        localStorage.clear();
        login.mockReset();
        changeExpiredPassword.mockReset();
        consumeSessionExpiredNotice.mockReset().mockReturnValue(false);
        applyDocumentFavicon.mockClear();
    });

    it('renders login form with forgot-password link', async () => {
        const { wrapper } = await mountLogin();
        expect(applyDocumentFavicon).toHaveBeenCalled();
        expect(wrapper.find('#username1').exists()).toBe(true);
        expect(wrapper.find('form').exists()).toBe(true);
        expect(wrapper.text()).toContain('Sign In');
        expect(wrapper.text()).toContain('Sign in to continue');
        expect(wrapper.find('a[href="/auth/forgot-password"]').exists()).toBe(true);
        await wrapper.find('input[type="checkbox"]').trigger('click');
        wrapper.unmount();
    });

    it('shows a validation message when submitting an empty form', async () => {
        const { wrapper } = await mountLogin();
        await wrapper.find('form').trigger('submit.prevent');
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('Username dan password wajib diisi.');
        const inputs = wrapper.findAll('input');
        await inputs[0].setValue('admin');
        await inputs[1].setValue('secret');
        await wrapper.find('input[type="checkbox"]').setValue(true);
        await wrapper.find('button[type="submit"]').trigger('click');
        wrapper.unmount();
    });

    it('shows expired notice from query or flag', async () => {
        consumeSessionExpiredNotice.mockReturnValue(false);
        const { wrapper, router } = await mountLogin({ reason: 'expired', redirect: '/master/user' });
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('Sesi Anda telah berakhir');
        expect(consumeSessionExpiredNotice).toHaveBeenCalled();
        await vi.waitFor(() => expect(router.currentRoute.value.query.reason).toBeUndefined());
        expect(router.currentRoute.value.query.redirect).toBe('/master/user');
        wrapper.unmount();

        consumeSessionExpiredNotice.mockReturnValue(true);
        const { wrapper: flagged } = await mountLogin();
        await flagged.vm.$nextTick();
        expect(flagged.text()).toContain('Sesi Anda telah berakhir');
        flagged.unmount();
    });

    it('logs in and redirects to requested path', async () => {
        login.mockResolvedValue({ uid: '1' });
        const { wrapper, router } = await mountLogin({ redirect: '/master/user' });
        const state = setupState(wrapper);
        state.username = 'admin';
        state.password = 'secret';
        state.remember = true;
        await state.onSubmit();
        expect(login).toHaveBeenCalledWith('admin', 'secret', true);
        await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/master/user'));
        wrapper.unmount();
    });

    it('redirects to home when redirect is /', async () => {
        login.mockResolvedValue({ uid: '1' });
        const { wrapper, router } = await mountLogin({ redirect: '/' });
        const state = setupState(wrapper);
        state.username = 'admin';
        state.password = 'secret';
        await state.onSubmit();
        await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/master/user'));
        wrapper.unmount();
    });

    it('redirects to home when redirect query is not a string', async () => {
        login.mockResolvedValue({ uid: '1' });
        const { wrapper, router } = await mountLogin({ redirect: ['/a', '/b'] });
        const state = setupState(wrapper);
        state.username = 'admin';
        state.password = 'secret';
        await state.onSubmit();
        await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/master/user'));
        wrapper.unmount();
    });

    it('shows API error message on failed login', async () => {
        login.mockRejectedValue(new Error('Password salah'));
        const { wrapper } = await mountLogin();
        const state = setupState(wrapper);
        state.username = 'admin';
        state.password = 'x';
        await state.onSubmit();
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('Password salah');
        expect(state.expiredMode).toBe(false);

        login.mockRejectedValueOnce({});
        await state.onSubmit();
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toMatch(/Login gagal/i);
        wrapper.unmount();
    });

    it('enters expired mode when login returns PASSWORD_EXPIRED', async () => {
        const { wrapper } = await mountLogin();
        await enterExpiredMode(wrapper, 'tok-1');
        const state = setupState(wrapper);
        expect(state.expiredMode).toBe(true);
        expect(state.changeToken).toBe('tok-1');
        expect(wrapper.text()).toContain('Password kedaluwarsa — buat password baru');
        expect(wrapper.text()).toContain('Akun');
        expect(wrapper.text()).toContain('admin');
        expect(wrapper.text()).toContain('Simpan password baru');
        wrapper.unmount();
    });

    it('uses fallback expired info message when error has no message', async () => {
        const err = { code: 'PASSWORD_EXPIRED', data: { change_token: 'tok-2' } };
        login.mockRejectedValueOnce(err);
        const { wrapper } = await mountLogin();
        const state = setupState(wrapper);
        state.username = 'admin';
        state.password = 'OldPass1!';
        await state.onSubmit();
        await wrapper.vm.$nextTick();
        expect(state.expiredMode).toBe(true);
        expect(wrapper.text()).toContain(
            'Password telah kedaluwarsa. Silakan buat password baru untuk melanjutkan.'
        );
        wrapper.unmount();
    });

    it('validates weak password in expired mode', async () => {
        const { wrapper } = await mountLogin();
        const state = await enterExpiredMode(wrapper);
        state.newPassword = 'weak';
        state.confirmPassword = 'weak';
        await state.onChangeExpiredPassword();
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toMatch(/Password minimal 8 karakter|huruf besar|huruf kecil|angka|simbol/i);
        expect(changeExpiredPassword).not.toHaveBeenCalled();
        wrapper.unmount();
    });

    it('validates password mismatch in expired mode', async () => {
        const { wrapper } = await mountLogin();
        const state = await enterExpiredMode(wrapper);
        state.newPassword = 'NewPass1!';
        state.confirmPassword = 'OtherPass1!';
        await state.onChangeExpiredPassword();
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('Konfirmasi password baru tidak cocok.');
        expect(changeExpiredPassword).not.toHaveBeenCalled();
        wrapper.unmount();
    });

    it('updates requirement checklist when typing new password', async () => {
        const { wrapper } = await mountLogin();
        await enterExpiredMode(wrapper);
        const inputs = wrapper.findAll('input[type="password"]');
        // first password field is gone (login form hidden); expired form has new + confirm
        await inputs[0].setValue('NewPass1!');
        await wrapper.vm.$nextTick();
        expect(wrapper.findAll('li.text-green-600').length).toBe(5);
        await inputs[1].setValue('NewPass1!');
        await wrapper.vm.$nextTick();
        expect(setupState(wrapper).passwordsMatch).toBe(true);
        wrapper.unmount();
    });

    it('changes expired password successfully and returns to login form', async () => {
        changeExpiredPassword.mockResolvedValueOnce({ message: 'Password baru tersimpan.' });
        const { wrapper } = await mountLogin();
        const state = await enterExpiredMode(wrapper, 'tok-ok');
        state.newPassword = 'NewPass1!';
        state.confirmPassword = 'NewPass1!';
        await state.onChangeExpiredPassword();
        await wrapper.vm.$nextTick();

        expect(changeExpiredPassword).toHaveBeenCalledWith({
            change_token: 'tok-ok',
            new_password: 'NewPass1!',
            confirm_password: 'NewPass1!'
        });
        expect(state.expiredMode).toBe(false);
        expect(state.password).toBe('');
        expect(wrapper.text()).toContain('Password baru tersimpan.');
        expect(wrapper.text()).toContain('Sign In');
        wrapper.unmount();
    });

    it('uses fallback success message after expired password change', async () => {
        changeExpiredPassword.mockResolvedValueOnce({});
        const { wrapper } = await mountLogin();
        const state = await enterExpiredMode(wrapper);
        state.newPassword = 'NewPass1!';
        state.confirmPassword = 'NewPass1!';
        await state.onChangeExpiredPassword();
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain(
            'Password berhasil diubah. Silakan login dengan password baru Anda.'
        );
        wrapper.unmount();
    });

    it('shows API error when expired password change fails', async () => {
        changeExpiredPassword.mockRejectedValueOnce(new Error('Token tidak valid'));
        const { wrapper } = await mountLogin();
        const state = await enterExpiredMode(wrapper);
        state.newPassword = 'NewPass1!';
        state.confirmPassword = 'NewPass1!';
        await state.onChangeExpiredPassword();
        await wrapper.vm.$nextTick();
        expect(state.expiredMode).toBe(true);
        expect(wrapper.text()).toContain('Token tidak valid');
        wrapper.unmount();
    });

    it('uses fallback error message when expired change rejection has no message', async () => {
        changeExpiredPassword.mockRejectedValueOnce({});
        const { wrapper } = await mountLogin();
        const state = await enterExpiredMode(wrapper);
        state.newPassword = 'NewPass1!';
        state.confirmPassword = 'NewPass1!';
        await state.onChangeExpiredPassword();
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('Gagal mengubah password.');
        wrapper.unmount();
    });

    it('cancels expired mode and returns to login form', async () => {
        const { wrapper } = await mountLogin();
        const state = await enterExpiredMode(wrapper);
        state.infoMessage = 'info';
        state.errorMessage = 'err';
        state.cancelExpiredMode();
        await wrapper.vm.$nextTick();
        expect(state.expiredMode).toBe(false);
        expect(state.changeToken).toBe('');
        expect(state.infoMessage).toBe('');
        expect(state.errorMessage).toBe('');
        expect(wrapper.text()).toContain('Sign In');
        wrapper.unmount();
    });

    it('cancels expired mode via button click', async () => {
        const { wrapper } = await mountLogin();
        await enterExpiredMode(wrapper);
        const buttons = wrapper.findAll('button');
        const cancel = buttons.find((b) => b.text().includes('Kembali ke login'));
        expect(cancel).toBeTruthy();
        await cancel.trigger('click');
        await wrapper.vm.$nextTick();
        expect(setupState(wrapper).expiredMode).toBe(false);
        expect(wrapper.text()).toContain('Sign in to continue');
        wrapper.unmount();
    });
});
