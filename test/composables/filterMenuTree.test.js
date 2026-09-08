import { filterMenuTree } from '@/composables/useSession';
import { describe, expect, it } from 'vitest';

describe('filterMenuTree', () => {
    const tree = [
        {
            kd_menu: 'MN_MAIN',
            nm_menu: 'MAIN MENU',
            children: [
                { kd_menu: 'MN_DASH', nm_menu: 'Dashboard', children: [] },
                {
                    kd_menu: 'MN_SYS',
                    nm_menu: 'Pengaturan',
                    children: [
                        { kd_menu: 'MN_SYSMN', nm_menu: 'Menu', children: [] },
                        { kd_menu: 'MN_SYSAC', nm_menu: 'Action', children: [] }
                    ]
                }
            ]
        }
    ];

    it('treats null tree/akses as empty', () => {
        expect(filterMenuTree(null, null)).toEqual([]);
        expect(filterMenuTree(undefined, undefined)).toEqual([]);
        expect(filterMenuTree([{ kd_menu: 'X' }], null)).toEqual([]);
    });

    it('hides parent without AC even when children have AC', () => {
        const akses = [
            { kd_menu: 'MN_MAIN', permissions: ['AC'] },
            { kd_menu: 'MN_SYSMN', permissions: ['AC'] },
            { kd_menu: 'MN_SYSAC', permissions: ['AC'] }
            // MN_SYS (Pengaturan) tanpa AC
        ];
        const filtered = filterMenuTree(tree, akses);
        expect(filtered).toHaveLength(1);
        expect(filtered[0].kd_menu).toBe('MN_MAIN');
        expect(filtered[0].children.map((c) => c.kd_menu)).toEqual([]);
    });

    it('keeps parent with AC and only children that also have AC', () => {
        const akses = [
            { kd_menu: 'MN_MAIN', permissions: ['AC'] },
            { kd_menu: 'MN_SYS', permissions: ['AC'] },
            { kd_menu: 'MN_SYSMN', permissions: ['AC'] }
            // MN_SYSAC tanpa AC
        ];
        const filtered = filterMenuTree(tree, akses);
        expect(filtered[0].children).toHaveLength(1);
        expect(filtered[0].children[0].kd_menu).toBe('MN_SYS');
        expect(filtered[0].children[0].children.map((c) => c.kd_menu)).toEqual(['MN_SYSMN']);
    });
});
