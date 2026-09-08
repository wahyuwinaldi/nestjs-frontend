import { applyFullTheme, applyThemePart, DEFAULT_UI_THEME, getPrimaryPresetExt, normalizeTheme, resolvePreset, UI_THEME_KODE } from '@/utils/theme';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@primeuix/themes', () => ({
    $t: () => ({
        preset: () => ({
            preset: () => ({
                surfacePalette: () => ({
                    use: vi.fn()
                })
            })
        })
    }),
    updatePreset: vi.fn(),
    updateSurfacePalette: vi.fn()
}));

describe('theme utils', () => {
    it('normalizes invalid values to defaults', () => {
        expect(UI_THEME_KODE).toBe('ui-theme');
        expect(normalizeTheme(null)).toEqual(DEFAULT_UI_THEME);
        expect(normalizeTheme({ primary: 'nope', preset: 'X', menuMode: 'x', surface: 'nope' })).toEqual(DEFAULT_UI_THEME);
        expect(normalizeTheme({ primary: 'blue', surface: 'slate', preset: 'Lara', menuMode: 'overlay' })).toEqual({
            primary: 'blue',
            surface: 'slate',
            preset: 'Lara',
            menuMode: 'overlay'
        });
    });

    it('builds primary preset extensions and applies theme parts', async () => {
        const { updatePreset, updateSurfacePalette } = await import('@primeuix/themes');
        expect(getPrimaryPresetExt('noir').semantic.primary[500]).toBe('{surface.500}');
        expect(getPrimaryPresetExt('emerald').semantic.primary[500]).toBe('#10b981');
        applyThemePart('primary', { name: 'blue' });
        expect(updatePreset).toHaveBeenCalled();
        applyThemePart('surface', { name: 'slate', palette: { 500: '#64748b' } });
        expect(updateSurfacePalette).toHaveBeenCalled();
        expect(resolvePreset('Lara')).toBeTruthy();
        expect(resolvePreset('missing')).toBeTruthy();
        expect(applyFullTheme({ primary: 'blue', surface: 'slate', preset: 'Lara', menuMode: 'overlay' }).preset).toBe('Lara');
    });
});
