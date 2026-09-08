<script setup>
import { logout } from '@/composables/useSession';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const message = ref('Sedang keluar...');

onMounted(async () => {
    try {
        await logout();
    } catch {
        // Session lokal tetap dibersihkan di logout()
    } finally {
        message.value = 'Anda telah keluar.';
        await router.replace('/auth/login');
    }
});
</script>

<template>
    <div class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-screen overflow-hidden">
        <div class="flex flex-col items-center gap-3">
            <i class="pi pi-spin pi-spinner text-4xl text-primary" />
            <p class="text-surface-700 dark:text-surface-100 m-0">{{ message }}</p>
        </div>
    </div>
</template>
