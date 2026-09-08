import ChangePassword from '@/views/account/ChangePassword.vue';
import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { interactFormControls, primeStubs, setupState } from '../../helpers/mount';

const changePassword = vi.fn();
const toastAdd = vi.fn();

vi.mock('@/composables/useAccount', () => ({
    changePassword: (...args) => changePassword(...args)
}));

vi.mock('primevue/usetoast', () => ({
    useToast: () => ({ add: toastAdd })
}));

describe('ChangePassword.vue', () => {
    beforeEach(() => {
        changePassword.mockReset();
        toastAdd.mockReset();
    });

    function mountPage() {
        return mount(ChangePassword, {
            global: {
                plugins: [[PrimeVue, {}], ToastService],
                stubs: primeStubs()
            }
        });
    }

    it('validates current/new/confirm password', async () => {
        const wrapper = mountPage();
        const state = setupState(wrapper);
        expect(state.passwordRequirements).toBeTruthy();
        expect(state.allRequirementsMet).toBe(false);
        expect(state.isFormValid).toBe(false);

        await state.onSubmit();
        expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.stringMatching(/Password saat ini/i) }));

        state.form.currentPassword = 'Oldpass1!';
        state.form.newPassword = 'weak';
        await state.onSubmit();
        expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.stringMatching(/belum memenuhi/i) }));

        state.form.newPassword = 'Oldpass1!';
        state.form.confirmPassword = 'Oldpass1!';
        await state.onSubmit();
        expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.stringMatching(/berbeda dari password saat ini/i) }));

        state.form.newPassword = 'Newpass1!';
        state.form.confirmPassword = 'Mismatch1!';
        await state.onSubmit();
        expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.stringMatching(/tidak cocok/i) }));
        const inputs = wrapper.findAll('input[type="password"]');
        if (inputs.length >= 3) {
            await inputs[0].setValue('Oldpass1!');
            await inputs[1].setValue('Newpass1!');
            await inputs[2].setValue('Newpass1!');
        }
        await wrapper.find('form').trigger('submit.prevent');
        await interactFormControls(wrapper);
        wrapper.unmount();
    });

    it('submits successfully and on API error', async () => {
        const wrapper = mountPage();
        const state = setupState(wrapper);
        state.form.currentPassword = 'Oldpass1!';
        state.form.newPassword = 'Newpass1!';
        state.form.confirmPassword = 'Newpass1!';

        changePassword.mockResolvedValueOnce({ message: 'ok' });
        await state.onSubmit();
        expect(changePassword).toHaveBeenCalled();
        await wrapper.find('form').trigger('submit.prevent');
        expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
        expect(state.form.currentPassword).toBe('');

        state.form.currentPassword = 'Oldpass1!';
        state.form.newPassword = 'Newpass1!';
        state.form.confirmPassword = 'Newpass1!';
        changePassword.mockRejectedValueOnce(new Error('salah'));
        await state.onSubmit();
        expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error', detail: 'salah' }));
        wrapper.unmount();
    });
});
