import AppLayout from '@/layout/AppLayout.vue';
import { applyDocumentTitle, getHomePath } from '@/composables/useHelper';
import { createRouter, createWebHistory } from 'vue-router';
import { hasMenuPermission } from '@/composables/usePermission';
import { isAuthenticated } from '@/composables/useSession';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            component: AppLayout,
            children: [
                {
                    path: '/',
                    name: 'dashboard',
                    meta: { title: 'Dashboard' },
                    component: () => import('@/views/Dashboard.vue')
                },
                {
                    path: '/master/user',
                    name: 'master-user',
                    meta: { title: 'User' },
                    component: () => import('@/views/master/User.vue')
                },
                {
                    path: '/system/menu',
                    name: 'system-menu',
                    meta: { title: 'Menu' },
                    component: () => import('@/views/system/Menu.vue')
                },
                {
                    path: '/system/action',
                    name: 'system-action',
                    meta: { title: 'Action' },
                    component: () => import('@/views/system/Action.vue')
                },
                {
                    path: '/system/website',
                    name: 'system-website',
                    meta: { title: 'Website Settings' },
                    component: () => import('@/views/system/Settings.vue')
                },
                {
                    path: '/master/permission',
                    name: 'master-permission',
                    meta: { title: 'Role & Permission' },
                    component: () => import('@/views/master/Permission.vue')
                },
                {
                    path: '/master/permission/private',
                    name: 'master-permission-private',
                    meta: { title: 'Permission Private' },
                    component: () => import('@/views/master/PermissionPrivate.vue')
                },
                {
                    path: '/account/password',
                    name: 'account-password',
                    meta: { title: 'Ganti Password' },
                    component: () => import('@/views/account/ChangePassword.vue')
                }
            ]
        },
        {
            path: '/pages/notfound',
            name: 'notfound',
            meta: { title: 'Not Found' },
            component: () => import('@/views/pages/NotFound.vue')
        },
        {
            path: '/auth/login',
            name: 'login',
            meta: { title: 'Login' },
            component: () => import('@/views/pages/auth/Login.vue')
        },
        {
            path: '/auth/forgot-password',
            name: 'forgot-password',
            meta: { title: 'Lupa Password' },
            component: () => import('@/views/pages/auth/ForgotPassword.vue')
        },
        {
            path: '/auth/reset-password',
            name: 'reset-password',
            meta: { title: 'Reset Password' },
            component: () => import('@/views/pages/auth/ResetPassword.vue')
        },
        {
            path: '/auth/logout',
            name: 'logout',
            meta: { title: 'Logout' },
            component: () => import('@/views/pages/auth/Logout.vue')
        },
        {
            path: '/auth/access',
            name: 'accessDenied',
            meta: { title: 'Access Denied' },
            component: () => import('@/views/pages/auth/Access.vue')
        },
        {
            path: '/auth/error',
            name: 'error',
            meta: { title: 'Error' },
            component: () => import('@/views/pages/auth/Error.vue')
        },
        {
            path: '/:pathMatch(.*)*',
            name: 'catchAll',
            meta: { title: 'Not Found' },
            component: () => import('@/views/pages/NotFound.vue')
        }
    ]
});

// Auth pages + notfound. Everything nested under AppLayout requires a valid
// session plus an 'AC' (access) permission entry for that path.
const PUBLIC_PATH_PREFIXES = [
    '/auth/login',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/logout',
    '/auth/access',
    '/auth/error',
    '/pages/notfound'
];

function isPublicPath(path) {
    return PUBLIC_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

router.beforeEach((to) => {
    if (isPublicPath(to.path)) {
        if (to.path === '/auth/login' && isAuthenticated()) {
            return { path: getHomePath() };
        }
        return true;
    }

    if (!isAuthenticated()) {
        const query = { redirect: to.fullPath };
        try {
            if (sessionStorage.getItem('session_expired_notice') === '1') {
                query.reason = 'expired';
            }
        } catch {
            // ignore
        }
        return { path: '/auth/login', query };
    }

    // Halaman utama → menu aktif pertama dari parent pertama.
    if (to.path === '/') {
        const home = getHomePath();
        if (home !== '/') return { path: home };
        return true;
    }

    // Akun sendiri: cukup login, tidak butuh permission menu.
    if (to.path === '/account/password' || to.path.startsWith('/account/')) {
        return true;
    }

    if (!hasMenuPermission(to.path, 'AC')) {
        return { path: '/auth/access' };
    }

    return true;
});

router.afterEach((to) => {
    applyDocumentTitle(to);
});

export default router;
