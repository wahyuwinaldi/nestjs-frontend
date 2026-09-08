const SYMBOL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

/**
 * Checklist persyaratan password (sama dengan backend `assertPasswordStrength`).
 * @param {string} password
 */
export function getPasswordRequirements(password = '') {
    const value = password || '';
    return {
        minLength: value.length >= 8,
        hasUppercase: /[A-Z]/.test(value),
        hasLowercase: /[a-z]/.test(value),
        hasNumber: /\d/.test(value),
        hasSymbol: SYMBOL_RE.test(value)
    };
}

/**
 * @param {string} password
 * @returns {boolean}
 */
export function isPasswordStrong(password) {
    return Object.values(getPasswordRequirements(password)).every(Boolean);
}

/**
 * @param {string} password
 * @returns {string|null} pesan error, atau null jika valid
 */
export function getPasswordStrengthError(password) {
    const req = getPasswordRequirements(password);
    if (!req.minLength) return 'Password minimal 8 karakter';
    if (!req.hasUppercase) return 'Password harus mengandung huruf besar';
    if (!req.hasLowercase) return 'Password harus mengandung huruf kecil';
    if (!req.hasNumber) return 'Password harus mengandung angka';
    if (!req.hasSymbol) return 'Password harus mengandung simbol';
    return null;
}
