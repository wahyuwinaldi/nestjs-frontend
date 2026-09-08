import { ensureSakaiMenuShape, toSakaiMenu } from '@/composables/useSession';
import { describe, expect, it } from 'vitest';

describe('toSakaiMenu', () => {
    it('maps MAIN MENU from DB as Sakai section (not double-wrapped)', () => {
        const tree = [
            {
                kd_menu: 'MN_MAIN',
                nm_menu: 'MAIN MENU',
                icon_menu: null,
                link_menu: '#',
                children: [
                    { kd_menu: 'MN_DASH', nm_menu: 'Dashboard', icon_menu: 'home', link_menu: '/', children: [] },
                    {
                        kd_menu: 'MN_SYS',
                        nm_menu: 'Pengaturan',
                        icon_menu: 'cog',
                        link_menu: '/system',
                        children: [
                            {
                                kd_menu: 'MN_SYSMN',
                                nm_menu: 'Menu',
                                icon_menu: 'list',
                                link_menu: '/system/menu',
                                children: []
                            }
                        ]
                    }
                ]
            }
        ];

        const model = toSakaiMenu(tree);

        expect(model).toHaveLength(1);
        expect(model[0].label).toBe('MAIN MENU');
        expect(model[0].items).toHaveLength(2);
        expect(model[0].items[0]).toMatchObject({
            label: 'Dashboard',
            to: '/',
            icon: 'pi pi-fw pi-home'
        });
        expect(model[0].items[1]).toMatchObject({
            label: 'Pengaturan',
            path: '/system',
            icon: 'pi pi-fw pi-cog'
        });
        expect(model[0].items[1].items[0]).toMatchObject({
            label: 'Menu',
            to: '/system/menu'
        });
    });

    it('maps group without link, leaf without link, and relative link', () => {
        expect(toSakaiMenu([])).toEqual([]);
        expect(toSakaiMenu(null)).toEqual([]);
        const grouped = toSakaiMenu([
            {
                nm_menu: 'Group!',
                link_menu: '#',
                children: [{ nm_menu: 'Sub!', children: [{ nm_menu: 'Deep', link_menu: 'bare' }] }, { nm_menu: 'Leaf' }]
            }
        ]);
        expect(grouped[0].items[0].path).toMatch(/group/);
        expect(grouped[0].items[0].items[0].to).toBe('/bare');
        expect(grouped[0].items[1].to).toBeUndefined();
        const flat = toSakaiMenu([
            { nm_menu: 'Dash', link_menu: '/' },
            { nm_menu: 'Rel', link_menu: 'bare' }
        ]);
        expect(flat[0].items.map((i) => i.to)).toEqual(['/', '/bare']);
    });

    it('wraps legacy flat roots under MAIN MENU', () => {
        const tree = [
            { kd_menu: 'MN_DASH', nm_menu: 'Dashboard', icon_menu: 'home', link_menu: '/', children: [] },
            { kd_menu: 'MN_USER', nm_menu: 'User', icon_menu: 'users', link_menu: '/master/user', children: [] }
        ];

        const model = toSakaiMenu(tree);
        expect(model).toHaveLength(1);
        expect(model[0].label).toBe('MAIN MENU');
        expect(model[0].items).toHaveLength(2);
        expect(model[0].items[0].to).toBe('/');
    });

    it('keeps each DB root as its own section (same level)', () => {
        const tree = [
            {
                kd_menu: 'MN_MAIN',
                nm_menu: 'MAIN MENU',
                icon_menu: null,
                link_menu: '#',
                children: [{ kd_menu: 'MN_DASH', nm_menu: 'Dashboard', icon_menu: 'home', link_menu: '/', children: [] }]
            },
            { kd_menu: 'MN_MST', nm_menu: 'Master Data', icon_menu: null, link_menu: '#', children: [] }
        ];

        const model = toSakaiMenu(tree);
        expect(model).toHaveLength(2);
        expect(model[0]).toMatchObject({ label: 'MAIN MENU' });
        expect(model[0].items).toHaveLength(1);
        expect(model[0].items[0]).toMatchObject({ label: 'Dashboard', to: '/' });
        expect(model[1]).toEqual({ label: 'Master Data', items: [] });
    });
});

describe('ensureSakaiMenuShape', () => {
    it('wraps legacy flat menu under MAIN MENU', () => {
        const legacy = [
            { label: 'Dashboard', icon: 'pi pi-fw pi-home', to: '/' },
            { label: 'User', icon: 'pi pi-fw pi-users', to: '/master/user' }
        ];
        const normalized = ensureSakaiMenuShape(legacy);
        expect(normalized).toHaveLength(1);
        expect(normalized[0].label).toBe('MAIN MENU');
        expect(normalized[0].items).toEqual(legacy);
    });

    it('keeps already-wrapped menu', () => {
        const wrapped = [{ label: 'MAIN MENU', items: [{ label: 'Dashboard', to: '/' }] }];
        expect(ensureSakaiMenuShape(wrapped)).toEqual(wrapped);
    });

    it('unwraps double-wrapped MAIN MENU and restores sibling roots as sections', () => {
        const doubleWrapped = [
            {
                label: 'MAIN MENU',
                items: [
                    {
                        label: 'MAIN MENU',
                        icon: 'pi pi-fw pi-circle',
                        path: '/group/mn-main',
                        items: [{ label: 'Dashboard', to: '/' }]
                    },
                    { label: 'Master Data', icon: 'pi pi-fw pi-circle' }
                ]
            }
        ];
        const normalized = ensureSakaiMenuShape(doubleWrapped);
        expect(normalized).toEqual([
            { label: 'MAIN MENU', items: [{ label: 'Dashboard', to: '/' }] },
            { label: 'Master Data', items: [] }
        ]);
    });
});
