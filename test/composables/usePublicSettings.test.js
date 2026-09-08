import { applyDocumentFavicon, getPublicSettingUrl, PUBLIC_SETTING_CODES } from '@/composables/usePublicSettings';
import { describe, expect, it } from 'vitest';

describe('usePublicSettings', () => {
    it('builds public asset urls', () => {
        expect(PUBLIC_SETTING_CODES.favicon).toBe('favicon');
        expect(getPublicSettingUrl('login-bg')).toBe('/assets/login-bg');
        expect(getPublicSettingUrl('  logo-color  ')).toBe('/assets/logo-color');
        expect(getPublicSettingUrl('')).toBe('');
        expect(getPublicSettingUrl(null)).toBe('');
    });

    it('creates or updates the favicon link', () => {
        document.head.innerHTML = '';
        applyDocumentFavicon('');
        expect(document.querySelector('link[rel="icon"]')).toBeNull();

        applyDocumentFavicon('/assets/favicon');
        const link = document.querySelector('link[rel="icon"]');
        expect(link).toBeTruthy();
        expect(link.getAttribute('href') || link.href).toContain('favicon');

        applyDocumentFavicon('/assets/favicon-2');
        expect(document.querySelectorAll('link[rel="icon"]')).toHaveLength(1);
        expect(document.querySelector('link[rel="icon"]').getAttribute('href') || document.querySelector('link[rel="icon"]').href).toContain('favicon-2');
    });
});
