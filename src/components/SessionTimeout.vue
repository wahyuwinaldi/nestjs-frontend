<script setup>
import { getEncryptedItem } from '@/utils/encryption';
import { getSessionInfo, markSessionExpired } from '@/composables/useSession';
import { onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const PUBLIC_PREFIXES = ['/auth/login', '/auth/logout', '/auth/access', '/auth/error', '/pages/notfound'];

const route = useRoute();
const router = useRouter();

const dialogVisible = ref(false);
const checkTimer = ref(null);

function isPublicPath(path) {
    return PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function goLogin() {
    dialogVisible.value = false;
    router.replace({ path: '/auth/login', query: { reason: 'expired' } });
}

function handleExpired() {
    if (dialogVisible.value || isPublicPath(route.path)) return;
    markSessionExpired(false);
    dialogVisible.value = true;
}

function checkSessionStatus() {
    if (isPublicPath(route.path)) return;

    const session = getEncryptedItem('session');
    if (!session) return;

    const info = getSessionInfo();
    if (!info || !info.isValid) {
        handleExpired();
    }
}

function onSessionExpiredEvent() {
    if (isPublicPath(route.path)) {
        if (route.path !== '/auth/login') {
            router.replace({ path: '/auth/login', query: { reason: 'expired' } });
        }
        return;
    }
    handleExpired();
}

onMounted(() => {
    checkSessionStatus();
    checkTimer.value = setInterval(checkSessionStatus, 30 * 1000);
    globalThis.addEventListener('session-expired', onSessionExpiredEvent);
});

onUnmounted(() => {
    if (checkTimer.value) clearInterval(checkTimer.value);
    globalThis.removeEventListener('session-expired', onSessionExpiredEvent);
});
</script>

<template>
    <Dialog v-model:visible="dialogVisible" modal header="Sesi Berakhir" :closable="false" :closeOnEscape="false" :style="{ width: '28rem' }">
        <p class="m-0 text-color-secondary">Sesi Anda telah berakhir. Silakan login kembali untuk melanjutkan.</p>
        <template #footer>
            <Button label="Login Kembali" icon="pi pi-sign-in" @click="goLogin" />
        </template>
    </Dialog>
</template>
