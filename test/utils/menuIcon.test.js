import { describe, expect, it } from 'vitest';
import { extractRemixIconClass, parseRemixIconsFromHtml, resolveMenuIconClass } from '@/utils/menuIcon';

describe('resolveMenuIconClass', () => {
    it('returns fallback for empty values', () => {
        expect(resolveMenuIconClass(null)).toBe('pi pi-circle');
        expect(resolveMenuIconClass('')).toBe('pi pi-circle');
        expect(resolveMenuIconClass('   ')).toBe('pi pi-circle');
        expect(resolveMenuIconClass(null, 'custom')).toBe('custom');
    });

    it('keeps remix class as-is', () => {
        expect(resolveMenuIconClass('ri-home-line')).toBe('ri-home-line');
        expect(resolveMenuIconClass('<i class="ri-user-line"></i>')).toBe('ri-user-line');
    });

    it('normalizes PrimeIcons tokens', () => {
        expect(resolveMenuIconClass('pi-home')).toBe('pi pi-fw pi-home');
        expect(resolveMenuIconClass('pi pi-home')).toBe('pi pi-fw pi-home');
        expect(resolveMenuIconClass('home')).toBe('pi pi-fw pi-home');
        expect(resolveMenuIconClass('pi-cog')).toBe('pi pi-fw pi-cog');
    });

    it('falls back when tokens are not a usable icon', () => {
        expect(resolveMenuIconClass('pi pi-fw')).toBe('pi pi-circle');
    });
});

describe('extractRemixIconClass', () => {
    it('returns empty string when missing', () => {
        expect(extractRemixIconClass(null)).toBe('');
        expect(extractRemixIconClass('')).toBe('');
        expect(extractRemixIconClass('pi-home')).toBe('');
    });

    it('extracts remix from raw or HTML', () => {
        expect(extractRemixIconClass('ri-home-line')).toBe('ri-home-line');
        expect(extractRemixIconClass('<i class="ri-settings-3-line extra"></i>')).toBe('ri-settings-3-line');
    });
});

describe('parseRemixIconsFromHtml', () => {
    it('returns unique sorted remix classes', () => {
        const html = '<i class="ri-home-line"></i><i class="ri-user-line ri-home-line"></i>';
        expect(parseRemixIconsFromHtml(html)).toEqual(['ri-home-line', 'ri-user-line']);
    });

    it('handles empty input', () => {
        expect(parseRemixIconsFromHtml('')).toEqual([]);
        expect(parseRemixIconsFromHtml(null)).toEqual([]);
    });
});
