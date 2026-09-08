import { APP_TITLE, applyDocumentTitle, findFirstActiveMenuPath, findMenuIconByPath, findMenuLabelByPath, formatDocumentTitle, getHomePath, resolvePageTitle } from '@/composables/useHelper';
import { setEncryptedItem } from '@/utils/encryption';
import { describe, expect, it } from 'vitest';

describe('findFirstActiveMenuPath', () => {
    it('returns first leaf with to', () => {
        const items = [
            { label: 'Dashboard', to: '/' },
            { label: 'User', to: '/master/user' }
        ];
        expect(findFirstActiveMenuPath(items)).toBe('/');
    });

    it('dives into nested items when parent has no to', () => {
        const items = [
            {
                label: 'Pengaturan',
                path: '/system',
                items: [
                    { label: 'Menu', to: '/system/menu' },
                    { label: 'Action', to: '/system/action' }
                ]
            }
        ];
        expect(findFirstActiveMenuPath(items)).toBe('/system/menu');
    });

    it('skips invisible and separator entries', () => {
        const items = [{ separator: true }, { label: 'Hidden', to: '/hidden', visible: false }, { label: 'User', to: '/master/user' }];
        expect(findFirstActiveMenuPath(items)).toBe('/master/user');
    });

    it('returns null for empty list', () => {
        expect(findFirstActiveMenuPath([])).toBeNull();
        expect(findFirstActiveMenuPath(null)).toBeNull();
    });
});

describe('getHomePath', () => {
    it('uses first active item under the first parent section', () => {
        const menu = [
            {
                label: 'MAIN MENU',
                items: [
                    { label: 'User', to: '/master/user' },
                    { label: 'Permission', to: '/master/permission' }
                ]
            },
            {
                label: 'Master Data',
                items: [{ label: 'User', to: '/master/user' }]
            }
        ];
        expect(getHomePath(menu)).toBe('/master/user');
    });

    it('falls back to / when first parent has no navigable items', () => {
        expect(getHomePath([{ label: 'MAIN MENU', items: [] }])).toBe('/');
        expect(getHomePath([])).toBe('/');
    });

    it('reads menu from session when none is passed', () => {
        localStorage.clear();
        setEncryptedItem('menu', [{ label: 'MAIN MENU', items: [{ label: 'User', to: '/master/user' }] }]);
        expect(getHomePath()).toBe('/master/user');
        localStorage.clear();
        expect(getHomePath()).toBe('/');
    });
});

describe('document title helpers', () => {
    const menu = [
        {
            label: 'MAIN MENU',
            items: [
                {
                    label: 'Pengaturan',
                    path: '/system',
                    items: [{ label: 'Menu Sistem', to: '/system/menu' }]
                }
            ]
        }
    ];

    it('finds menu label by exact path', () => {
        expect(findMenuLabelByPath('/system/menu', menu)).toBe('Menu Sistem');
        expect(findMenuLabelByPath('system/menu', menu)).toBe('Menu Sistem');
        expect(findMenuLabelByPath('/unknown', menu)).toBeNull();
        expect(findMenuLabelByPath('', menu)).toBeNull();
        expect(findMenuLabelByPath('#', menu)).toBeNull();
    });

    it('finds menu icon from stored map or sakai model', () => {
        localStorage.clear();
        setEncryptedItem('menuIcons', { '/system/menu': 'ri-list-check' });
        expect(findMenuIconByPath('/system/menu', menu)).toBe('ri-list-check');
        localStorage.clear();
        const withIcon = [
            {
                label: 'MAIN MENU',
                items: [{ label: 'Menu Sistem', to: '/system/menu', icon: 'pi pi-fw pi-list' }]
            }
        ];
        expect(findMenuIconByPath('/system/menu', withIcon)).toBe('pi pi-fw pi-list');
        expect(findMenuIconByPath('', withIcon)).toBe('pi pi-circle');
        expect(findMenuIconByPath('/missing', withIcon, 'custom')).toBe('custom');
        expect(
            findMenuIconByPath('/system/menu', [
                {
                    label: 'MAIN MENU',
                    items: [{ separator: true }, { visible: false, to: '/system/menu', icon: 'x' }, { to: '/system/menu', icon: 'pi pi-list' }]
                }
            ])
        ).toBe('pi pi-list');
    });

    it('formats document title with app suffix', () => {
        expect(formatDocumentTitle('Login')).toBe(`Login - ${APP_TITLE}`);
        expect(formatDocumentTitle('')).toBe(APP_TITLE);
        expect(formatDocumentTitle(null)).toBe(APP_TITLE);
    });

    it('prefers menu label over route meta', () => {
        const route = {
            path: '/system/menu',
            matched: [{ meta: { title: 'Menu' } }]
        };
        expect(resolvePageTitle(route, menu)).toBe('Menu Sistem');
    });

    it('falls back to route meta for public pages', () => {
        const route = {
            path: '/auth/login',
            matched: [{ meta: { title: 'Login' } }]
        };
        expect(resolvePageTitle(route, [])).toBe('Login');
        expect(resolvePageTitle({ path: '/x', matched: [{ meta: {} }] }, [])).toBeNull();
        expect(resolvePageTitle(null, [])).toBeNull();
    });

    it('applies document.title from the current route', () => {
        applyDocumentTitle({ path: '/system/menu', matched: [{ meta: { title: 'Menu' } }] }, menu);
        expect(document.title).toBe(`Menu Sistem - ${APP_TITLE}`);
        applyDocumentTitle({ path: '/auth/login', matched: [{ meta: { title: 'Login' } }] }, []);
        expect(document.title).toBe(`Login - ${APP_TITLE}`);
    });
});
