import { describe, expect, it } from 'vitest';
import { getPasswordRequirements, getPasswordStrengthError, isPasswordStrong } from '@/composables/usePassword';

describe('usePassword', () => {
    it('reports each requirement independently', () => {
        expect(getPasswordRequirements('')).toEqual({
            minLength: false,
            hasUppercase: false,
            hasLowercase: false,
            hasNumber: false,
            hasSymbol: false
        });
        expect(getPasswordRequirements('Abcdef1!')).toEqual({
            minLength: true,
            hasUppercase: true,
            hasLowercase: true,
            hasNumber: true,
            hasSymbol: true
        });
    });

    it('isPasswordStrong requires every rule', () => {
        expect(isPasswordStrong('Abcdef1!')).toBe(true);
        expect(isPasswordStrong('abcdef1!')).toBe(false);
        expect(isPasswordStrong()).toBe(false);
    });

    it('returns the first failing strength message', () => {
        expect(getPasswordStrengthError('Ab1!')).toBe('Password minimal 8 karakter');
        expect(getPasswordStrengthError('abcdef1!')).toBe('Password harus mengandung huruf besar');
        expect(getPasswordStrengthError('ABCDEF1!')).toBe('Password harus mengandung huruf kecil');
        expect(getPasswordStrengthError('Abcdefg!')).toBe('Password harus mengandung angka');
        expect(getPasswordStrengthError('Abcdefg1')).toBe('Password harus mengandung simbol');
        expect(getPasswordStrengthError('Abcdef1!')).toBeNull();
    });
});
