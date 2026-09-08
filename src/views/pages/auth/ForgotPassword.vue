<script setup>
import FloatingConfigurator from '@/components/FloatingConfigurator.vue';
import { forgotPassword } from '@/composables/useAuthPassword';
import { applyDocumentFavicon, getPublicSettingUrl, PUBLIC_SETTING_CODES } from '@/composables/usePublicSettings';
import { onMounted, ref } from 'vue';

const identifier = ref('');
const loading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

const logoUrl = getPublicSettingUrl(PUBLIC_SETTING_CODES.logoColor);
const loginBgUrl = getPublicSettingUrl(PUBLIC_SETTING_CODES.loginBg);

onMounted(() => {
    applyDocumentFavicon(getPublicSettingUrl(PUBLIC_SETTING_CODES.favicon));
});

async function onSubmit() {
    errorMessage.value = '';
    successMessage.value = '';

    if (!identifier.value.trim()) {
        errorMessage.value = 'Username atau email wajib diisi.';
        return;
    }

    loading.value = true;
    try {
        const result = await forgotPassword(identifier.value.trim());
        successMessage.value =
            result?.message ||
            'Jika akun ditemukan dan memiliki email, link reset password telah dikirim.';
    } catch (error) {
        errorMessage.value = error?.message || 'Gagal memproses permintaan.';
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <FloatingConfigurator />
    <div class="login-page flex items-center justify-center min-h-screen min-w-[100vw] overflow-hidden" :style="{ backgroundImage: `url(${loginBgUrl})` }">
        <div class="flex flex-col items-center justify-center relative z-10">
            <div style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%)">
                <div class="w-full bg-surface-0 dark:bg-surface-900 py-20 px-8 sm:px-20" style="border-radius: 53px">
                    <div class="text-center mb-8">
                        <img :src="logoUrl" alt="Logo" class="mx-auto mb-4 h-14 w-auto object-contain" />
                        <div class="text-surface-900 dark:text-surface-0 text-3xl font-medium mb-4">Lupa Password</div>
                        <span class="text-muted-color font-medium">Masukkan username atau email akun Anda</span>
                    </div>

                    <form @submit.prevent="onSubmit">
                        <label for="identifier" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Username / Email</label>
                        <InputText
                            id="identifier"
                            type="text"
                            placeholder="username atau email"
                            class="w-full md:w-[30rem] mb-6"
                            v-model="identifier"
                            autocomplete="username"
                        />

                        <Message v-if="successMessage" severity="success" :closable="false" class="mb-4">{{ successMessage }}</Message>
                        <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>

                        <Button type="submit" label="Kirim link reset" class="w-full mb-3" :loading="loading" />
                        <router-link to="/auth/login" class="block text-center font-medium text-primary no-underline">Kembali ke login</router-link>
                    </form>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.login-page {
    position: relative;
    background-color: var(--surface-50);
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
}

.login-page::before {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    pointer-events: none;
}
</style>
