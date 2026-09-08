<script setup>
import { findMenuIconByPath, getHomePath } from '@/composables/useHelper';
import { hasMenuPermission } from '@/composables/usePermission';
import { getPublicSettingUrl, PUBLIC_SETTING_CODES } from '@/composables/usePublicSettings';
import { getSession } from '@/composables/useSession';
import { useLayout } from '@/layout/composables/layout';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppConfigurator from './AppConfigurator.vue';

const SETTINGS_PATH = '/system/website';

const { toggleMenu, toggleDarkMode, isDarkTheme } = useLayout();
const router = useRouter();

const session = getSession();
const logoUrl = getPublicSettingUrl(PUBLIC_SETTING_CODES.logoColor);
const menuTick = ref(0);
const profileMenu = ref();
const canConfigureTheme = computed(() => {
    menuTick.value;
    return hasMenuPermission(SETTINGS_PATH, 'UP');
});

const homePath = computed(() => {
    menuTick.value;
    return getHomePath();
});

const profileLabel = computed(() => session?.nama || session?.username || 'Profile');

const profileItems = computed(() => {
    menuTick.value;
    return [
        {
            label: 'Ganti Password',
            icon: findMenuIconByPath('/account/password', undefined, 'pi pi-key'),
            command: () => router.push('/account/password')
        },
        {
            label: 'Logout',
            icon: findMenuIconByPath('/auth/logout', undefined, 'pi pi-sign-out'),
            command: () => router.push('/auth/logout')
        }
    ];
});

function onMenuUpdated() {
    menuTick.value += 1;
}

function toggleProfileMenu(event) {
    profileMenu.value?.toggle(event);
}

onMounted(() => {
    globalThis.addEventListener('menu-updated', onMenuUpdated);
});

onUnmounted(() => {
    globalThis.removeEventListener('menu-updated', onMenuUpdated);
});
</script>

<template>
    <div class="layout-topbar">
        <div class="layout-topbar-logo-container">
            <button class="layout-menu-button layout-topbar-action" @click="toggleMenu">
                <i class="pi pi-bars"></i>
            </button>
            <router-link :to="homePath" class="layout-topbar-logo">
                <img :src="logoUrl" alt="Logo" />
                <span>Dashboard</span>
            </router-link>
        </div>

        <div class="layout-topbar-actions">
            <div class="layout-config-menu">
                <button type="button" class="layout-topbar-action" @click="toggleDarkMode">
                    <i :class="['pi', { 'pi-moon': isDarkTheme, 'pi-sun': !isDarkTheme }]"></i>
                </button>
                <div v-if="canConfigureTheme" class="relative">
                    <button
                        v-styleclass="{ selector: '@next', enterFromClass: 'hidden', enterActiveClass: 'p-anchored-overlay-enter-active', leaveToClass: 'hidden', leaveActiveClass: 'p-anchored-overlay-leave-active', hideOnOutsideClick: true }"
                        type="button"
                        class="layout-topbar-action layout-topbar-action-highlight"
                    >
                        <i class="pi pi-palette"></i>
                    </button>
                    <AppConfigurator />
                </div>
            </div>

            <button
                class="layout-topbar-menu-button layout-topbar-action"
                v-styleclass="{ selector: '@next', enterFromClass: 'hidden', enterActiveClass: 'p-anchored-overlay-enter-active', leaveToClass: 'hidden', leaveActiveClass: 'p-anchored-overlay-leave-active', hideOnOutsideClick: true }"
            >
                <i class="pi pi-ellipsis-v"></i>
            </button>

            <div class="layout-topbar-menu hidden lg:block">
                <div class="layout-topbar-menu-content">
                    <button type="button" class="layout-topbar-action layout-topbar-action-with-label" @click="toggleProfileMenu">
                        <i class="pi pi-user"></i>
                        <span>{{ profileLabel }}</span>
                        <i class="pi pi-angle-down"></i>
                    </button>
                    <Menu ref="profileMenu" popup :model="profileItems" class="min-w-48" />
                </div>
            </div>
        </div>
    </div>
</template>
