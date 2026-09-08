<script setup>
import FloatingConfigurator from '@/components/FloatingConfigurator.vue';
import { resetPassword } from '@/composables/useAuthPassword';
import { getPasswordRequirements, getPasswordStrengthError, isPasswordStrong } from '@/composables/usePassword';
import { applyDocumentFavicon, getPublicSettingUrl, PUBLIC_SETTING_CODES } from '@/composables/usePublicSettings';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const token = ref(typeof route.query.token === 'string' ? route.query.token : '');
const newPassword = ref('');
const confirmPassword = ref('');
const loading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

const logoUrl = getPublicSettingUrl(PUBLIC_SETTING_CODES.logoColor);
const loginBgUrl = getPublicSettingUrl(PUBLIC_SETTING_CODES.loginBg);

const passwordRequirements = computed(() => getPasswordRequirements(newPassword.value));
const passwordsMatch = computed(
    () => newPassword.value.length > 0 && newPassword.value === confirmPassword.value
);

onMounted(() => {
    applyDocumentFavicon(getPublicSettingUrl(PUBLIC_SETTING_CODES.favicon));
    if (!token.value) {
        errorMessage.value = 'Token reset password tidak ditemukan. Minta link baru.';
    }
});

async function onSubmit() {
    errorMessage.value = '';
    successMessage.value = '';

    if (!token.value) {
        errorMessage.value = 'Token reset password tidak valid.';
        return;
    }

    const strengthError = getPasswordStrengthError(newPassword.value);
    if (strengthError) {
        errorMessage.value = strengthError;
        return;
    }
    if (!passwordsMatch.value) {
        errorMessage.value = 'Konfirmasi password baru tidak cocok.';
        return;
    }

    loading.value = true;
    try {
        const result = await resetPassword({
            token: token.value,
            new_password: newPassword.value,
            confirm_password: confirmPassword.value
        });
        successMessage.value =
            result?.message || 'Password berhasil diubah. Silakan login dengan password baru Anda.';
        newPassword.value = '';
        confirmPassword.value = '';
        setTimeout(() => router.push('/auth/login'), 2000);
    } catch (error) {
        errorMessage.value = error?.message || 'Gagal mereset password.';
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
                        <div class="text-surface-900 dark:text-surface-0 text-3xl font-medium mb-4">Reset Password</div>
                        <span class="text-muted-color font-medium">Buat password baru untuk akun Anda</span>
                    </div>

                    <form @submit.prevent="onSubmit">
                        <label class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Password baru</label>
                        <Password v-model="newPassword" placeholder="Password baru" :toggleMask="true" class="mb-2" fluid :feedback="false" autocomplete="new-password" />
                        <ul class="mb-4 text-sm list-none p-0 m-0 flex flex-col gap-1 md:w-[30rem]">
                            <li :class="passwordRequirements.minLength ? 'text-green-600' : 'text-muted-color'">• Minimal 8 karakter</li>
                            <li :class="passwordRequirements.hasUppercase ? 'text-green-600' : 'text-muted-color'">• Mengandung huruf besar</li>
                            <li :class="passwordRequirements.hasLowercase ? 'text-green-600' : 'text-muted-color'">• Mengandung huruf kecil</li>
                            <li :class="passwordRequirements.hasNumber ? 'text-green-600' : 'text-muted-color'">• Mengandung angka</li>
                            <li :class="passwordRequirements.hasSymbol ? 'text-green-600' : 'text-muted-color'">• Mengandung simbol</li>
                        </ul>

                        <label class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Konfirmasi password</label>
                        <Password v-model="confirmPassword" placeholder="Ulangi password baru" :toggleMask="true" class="mb-4" fluid :feedback="false" autocomplete="new-password" />

                        <Message v-if="successMessage" severity="success" :closable="false" class="mb-4">{{ successMessage }}</Message>
                        <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>

                        <Button
                            type="submit"
                            label="Simpan password"
                            class="w-full mb-3"
                            :loading="loading"
                            :disabled="!token || !isPasswordStrong(newPassword) || !passwordsMatch"
                        />
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
