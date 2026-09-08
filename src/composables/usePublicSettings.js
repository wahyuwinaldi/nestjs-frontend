export const PUBLIC_SETTING_CODES = {
    loginBg: 'login-bg',
    logoColor: 'logo-color',
    logoWhite: 'logo-white',
    logoColorSm: 'logo-color-sm',
    logoWhiteSm: 'logo-white-sm',
    favicon: 'favicon'
};

/**
 * Path publik aset branding (di-serve backend / settings upload).
 * @param {string} kode
 */
export function getPublicSettingUrl(kode) {
    const key = String(kode || '').trim();
    if (!key) return '';
    return `/assets/${key}`;
}

export function applyDocumentFavicon(url) {
    if (!url || typeof document === 'undefined') return;

    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    link.href = url;
}
