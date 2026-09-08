import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/composables/useApi', () => ({
    apiFetch: vi.fn()
}));

import { apiFetch } from '@/composables/useApi';
import {
    changeExpiredPassword,
    forgotPassword,
    resetPassword
} from '@/composables/useAuthPassword';

describe('useAuthPassword', () => {
    beforeEach(() => {
        apiFetch.mockReset();
    });

    describe('forgotPassword', () => {
        it('posts username_or_email and returns data payload', async () => {
            apiFetch.mockResolvedValueOnce({
                success: true,
                data: {
                    message:
                        'Jika akun ditemukan dan memiliki email, link reset password telah dikirim.'
                }
            });

            await expect(forgotPassword('super')).resolves.toEqual({
                message:
                    'Jika akun ditemukan dan memiliki email, link reset password telah dikirim.'
            });

            expect(apiFetch).toHaveBeenCalledWith('/auth/forgot-password', {
                method: 'POST',
                data: { username_or_email: 'super' }
            });
        });

        it('falls back to full response when data is missing', async () => {
            apiFetch.mockResolvedValueOnce({ success: true });
            await expect(forgotPassword('user@example.com')).resolves.toEqual({ success: true });
        });

        it('propagates apiFetch errors', async () => {
            apiFetch.mockRejectedValueOnce(new Error('Network Error'));
            await expect(forgotPassword('super')).rejects.toThrow('Network Error');
        });
    });

    describe('resetPassword', () => {
        it('posts token and passwords then returns data payload', async () => {
            apiFetch.mockResolvedValueOnce({
                success: true,
                data: { message: 'Password berhasil diubah. Silakan login dengan password baru Anda.' }
            });

            const payload = {
                token: 'reset-token',
                new_password: 'NewPass1!',
                confirm_password: 'NewPass1!'
            };

            await expect(resetPassword(payload)).resolves.toEqual({
                message: 'Password berhasil diubah. Silakan login dengan password baru Anda.'
            });

            expect(apiFetch).toHaveBeenCalledWith('/auth/reset-password', {
                method: 'POST',
                data: payload
            });
        });

        it('falls back to full response when data is missing', async () => {
            apiFetch.mockResolvedValueOnce({ success: true });
            await expect(
                resetPassword({
                    token: 't',
                    new_password: 'NewPass1!',
                    confirm_password: 'NewPass1!'
                })
            ).resolves.toEqual({ success: true });
        });

        it('propagates apiFetch errors', async () => {
            apiFetch.mockRejectedValueOnce(new Error('Token reset password sudah kedaluwarsa'));
            await expect(
                resetPassword({
                    token: 'expired',
                    new_password: 'NewPass1!',
                    confirm_password: 'NewPass1!'
                })
            ).rejects.toThrow(/kedaluwarsa/);
        });
    });

    describe('changeExpiredPassword', () => {
        it('posts change_token and passwords then returns data payload', async () => {
            apiFetch.mockResolvedValueOnce({
                success: true,
                data: { message: 'Password berhasil diubah. Silakan login dengan password baru Anda.' }
            });

            const payload = {
                change_token: 'expired-change-token',
                new_password: 'FreshPass1!',
                confirm_password: 'FreshPass1!'
            };

            await expect(changeExpiredPassword(payload)).resolves.toEqual({
                message: 'Password berhasil diubah. Silakan login dengan password baru Anda.'
            });

            expect(apiFetch).toHaveBeenCalledWith('/auth/password/expired', {
                method: 'POST',
                data: payload
            });
        });

        it('falls back to full response when data is missing', async () => {
            apiFetch.mockResolvedValueOnce({});
            await expect(
                changeExpiredPassword({
                    change_token: 't',
                    new_password: 'FreshPass1!',
                    confirm_password: 'FreshPass1!'
                })
            ).resolves.toEqual({});
        });

        it('propagates apiFetch errors', async () => {
            apiFetch.mockRejectedValueOnce(new Error('Token reset password tidak valid'));
            await expect(
                changeExpiredPassword({
                    change_token: 'bad',
                    new_password: 'FreshPass1!',
                    confirm_password: 'FreshPass1!'
                })
            ).rejects.toThrow(/tidak valid/);
        });
    });
});
