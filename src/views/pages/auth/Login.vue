<script setup>
import FloatingConfigurator from '@/components/FloatingConfigurator.vue';
import { changeExpiredPassword } from '@/composables/useAuthPassword';
import { getHomePath } from '@/composables/useHelper';
import { getPasswordRequirements, getPasswordStrengthError, isPasswordStrong } from '@/composables/usePassword';
import { applyDocumentFavicon, getPublicSettingUrl, PUBLIC_SETTING_CODES } from '@/composables/usePublicSettings';
import { consumeSessionExpiredNotice, useSession } from '@/composables/useSession';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const username = ref('');
const password = ref('');
const remember = ref(false);
const loading = ref(false);
const errorMessage = ref('');
const infoMessage = ref('');

const expiredMode = ref(false);
const changeToken = ref('');
const newPassword = ref('');
const confirmPassword = ref('');

const { login } = useSession();
const router = useRouter();
const route = useRoute();
const logoUrl = getPublicSettingUrl(PUBLIC_SETTING_CODES.logoColor);
const loginBgUrl = getPublicSettingUrl(PUBLIC_SETTING_CODES.loginBg);

const passwordRequirements = computed(() => getPasswordRequirements(newPassword.value));
const passwordsMatch = computed(
    () => newPassword.value.length > 0 && newPassword.value === confirmPassword.value
);

onMounted(() => {
    applyDocumentFavicon(getPublicSettingUrl(PUBLIC_SETTING_CODES.favicon));
    const fromQuery = route.query.reason === 'expired';
    const fromFlag = consumeSessionExpiredNotice();
    if (fromQuery || fromFlag) {
        infoMessage.value = 'Sesi Anda telah berakhir. Silakan login kembali untuk melanjutkan.';
        if (fromQuery) {
            const nextQuery = { ...route.query };
            delete nextQuery.reason;
            router.replace({ path: '/auth/login', query: nextQuery });
        }
    }
});

function resetExpiredForm() {
    expiredMode.value = false;
    changeToken.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
}

async function onSubmit() {
    errorMessage.value = '';
    infoMessage.value = '';

    if (!username.value || !password.value) {
        errorMessage.value = 'Username dan password wajib diisi.';
        return;
    }

    loading.value = true;
    try {
        await login(username.value.trim(), password.value, remember.value);
        const requested = typeof route.query.redirect === 'string' ? route.query.redirect : '';
        const redirect = !requested || requested === '/' ? getHomePath() : requested;
        router.push(redirect);
    } catch (error) {
        if (error?.code === 'PASSWORD_EXPIRED' && error?.data?.change_token) {
            expiredMode.value = true;
            changeToken.value = error.data.change_token;
            newPassword.value = '';
            confirmPassword.value = '';
            infoMessage.value =
                error?.message ||
                'Password telah kedaluwarsa. Silakan buat password baru untuk melanjutkan.';
            errorMessage.value = '';
        } else {
            resetExpiredForm();
            errorMessage.value = error?.message || 'Login gagal. Periksa kembali username/password Anda.';
        }
    } finally {
        loading.value = false;
    }
}

async function onChangeExpiredPassword() {
    errorMessage.value = '';
    infoMessage.value = '';

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
        const result = await changeExpiredPassword({
            change_token: changeToken.value,
            new_password: newPassword.value,
            confirm_password: confirmPassword.value
        });
        resetExpiredForm();
        password.value = '';
        infoMessage.value =
            result?.message || 'Password berhasil diubah. Silakan login dengan password baru Anda.';
    } catch (error) {
        errorMessage.value = error?.message || 'Gagal mengubah password.';
    } finally {
        loading.value = false;
    }
}

function cancelExpiredMode() {
    resetExpiredForm();
    infoMessage.value = '';
    errorMessage.value = '';
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
                        <div class="text-surface-900 dark:text-surface-0 text-3xl font-medium mb-4">Dashboard Template</div>
                        <span class="text-muted-color font-medium">
                            {{ expiredMode ? 'Password kedaluwarsa — buat password baru' : 'Sign in to continue' }}
                        </span>
                    </div>

                    <form v-if="!expiredMode" @submit.prevent="onSubmit">
                        <label for="username1" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Username</label>
                        <InputText id="username1" type="text" placeholder="Username" class="w-full md:w-[30rem] mb-8" v-model="username" autocomplete="username" />

                        <label for="password1" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Password</label>
                        <Password id="password1" v-model="password" placeholder="Password" :toggleMask="true" class="mb-4" fluid :feedback="false" autocomplete="current-password"></Password>

                        <div class="flex items-center justify-between mt-2 mb-4 gap-8">
                            <div class="flex items-center">
                                <Checkbox v-model="remember" id="rememberme1" binary class="mr-2"></Checkbox>
                                <label for="rememberme1">Remember me</label>
                            </div>
                            <router-link to="/auth/forgot-password" class="font-medium text-primary text-sm no-underline">Lupa password?</router-link>
                        </div>

                        <Message v-if="infoMessage" severity="warn" :closable="false" class="mb-4">{{ infoMessage }}</Message>
                        <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>

                        <Button type="submit" label="Sign In" class="w-full" :loading="loading"></Button>
                    </form>

                    <form v-else @submit.prevent="onChangeExpiredPassword">
                        <p class="text-muted-color mb-4 md:w-[30rem]">
                            Akun <strong>{{ username }}</strong> memerlukan password baru (maksimal umur password 90 hari).
                        </p>

                        <label class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Password baru</label>
                        <Password v-model="newPassword" placeholder="Password baru" :toggleMask="true" class="mb-2" fluid :feedback="false" autocomplete="new-password" />
                        <ul class="mb-4 text-sm list-none p-0 m-0 flex flex-col gap-1">
                            <li :class="passwordRequirements.minLength ? 'text-green-600' : 'text-muted-color'">• Minimal 8 karakter</li>
                            <li :class="passwordRequirements.hasUppercase ? 'text-green-600' : 'text-muted-color'">• Mengandung huruf besar</li>
                            <li :class="passwordRequirements.hasLowercase ? 'text-green-600' : 'text-muted-color'">• Mengandung huruf kecil</li>
                            <li :class="passwordRequirements.hasNumber ? 'text-green-600' : 'text-muted-color'">• Mengandung angka</li>
                            <li :class="passwordRequirements.hasSymbol ? 'text-green-600' : 'text-muted-color'">• Mengandung simbol</li>
                        </ul>

                        <label class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Konfirmasi password</label>
                        <Password v-model="confirmPassword" placeholder="Ulangi password baru" :toggleMask="true" class="mb-4" fluid :feedback="false" autocomplete="new-password" />

                        <Message v-if="infoMessage" severity="warn" :closable="false" class="mb-4">{{ infoMessage }}</Message>
                        <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>

                        <Button
                            type="submit"
                            label="Simpan password baru"
                            class="w-full mb-3"
                            :loading="loading"
                            :disabled="!isPasswordStrong(newPassword) || !passwordsMatch"
                        />
                        <Button type="button" label="Kembali ke login" class="w-full" severity="secondary" outlined :disabled="loading" @click="cancelExpiredMode" />
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

.pi-eye {
    transform: scale(1.6);
    margin-right: 1rem;
}

.pi-eye-slash {
    transform: scale(1.6);
    margin-right: 1rem;
}
</style>
