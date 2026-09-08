<script setup>
import { APP_TITLE } from '@/composables/useHelper';
</script>

<template>
    <div class="card">
        <h2 class="m-0 text-xl font-semibold">Selamat datang</h2>
        <p class="m-0 mt-2 text-color-secondary">
            {{ APP_TITLE }}. Gunakan menu di sebelah kiri untuk mengelola user, permission, menu, action, dan pengaturan sistem.
        </p>
    </div>
</template>
