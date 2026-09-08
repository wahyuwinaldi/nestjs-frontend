<script setup>
import { changePassword } from '@/composables/useAccount';
import { getPasswordRequirements, isPasswordStrong } from '@/composables/usePassword';
import { useToast } from 'primevue/usetoast';
import { computed, reactive, ref } from 'vue';

const toast = useToast();
const saving = ref(false);

const form = reactive({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
});

const passwordRequirements = computed(() => getPasswordRequirements(form.newPassword));
const allRequirementsMet = computed(() => isPasswordStrong(form.newPassword));

const passwordsMatch = computed(() => form.newPassword.length > 0 && form.newPassword === form.confirmPassword);

const isDifferentFromCurrent = computed(() => form.newPassword.length > 0 && form.newPassword !== form.currentPassword);

const isFormValid = computed(() => form.currentPassword.length > 0 && allRequirementsMet.value && passwordsMatch.value && isDifferentFromCurrent.value);

function resetForm() {
    form.currentPassword = '';
    form.newPassword = '';
    form.confirmPassword = '';
}

async function onSubmit() {
    if (!form.currentPassword) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Password saat ini wajib diisi', life: 3000 });
        return;
    }
    if (!allRequirementsMet.value) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Password baru belum memenuhi persyaratan', life: 3000 });
        return;
    }
    if (!isDifferentFromCurrent.value) {
        toast.add({
            severity: 'warn',
            summary: 'Validasi',
            detail: 'Password baru harus berbeda dari password saat ini',
            life: 3000
        });
        return;
    }
    if (!passwordsMatch.value) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Konfirmasi password baru tidak cocok', life: 3000 });
        return;
    }

    saving.value = true;
    try {
        const result = await changePassword({
            current_password: form.currentPassword,
            new_password: form.newPassword,
            confirm_password: form.confirmPassword
        });
        resetForm();
        toast.add({
            severity: 'success',
            summary: 'Berhasil',
            detail: result?.message || 'Password berhasil diubah',
            life: 3500
        });
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Gagal',
            detail: error?.message || 'Gagal mengubah password',
            life: 4500
        });
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <div class="card max-w-xl mx-auto">
        <div class="text-center mb-6">
            <h2 class="text-2xl font-semibold m-0 mb-2">Ganti Password</h2>
            <p class="text-muted-color m-0">Perbarui password akun Anda untuk menjaga keamanan.</p>
        </div>

        <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
            <div>
                <label for="currentPassword" class="block mb-2 font-medium">Password Saat Ini <span class="text-red-500">*</span></label>
                <Password id="currentPassword" v-model="form.currentPassword" class="w-full" inputClass="w-full" :feedback="false" toggleMask autocomplete="current-password" placeholder="Masukkan password saat ini" />
            </div>

            <div>
                <label for="newPassword" class="block mb-2 font-medium">Password Baru <span class="text-red-500">*</span></label>
                <Password id="newPassword" v-model="form.newPassword" class="w-full" inputClass="w-full" :feedback="false" toggleMask autocomplete="new-password" placeholder="Masukkan password baru" />
                <ul class="mt-2 text-sm list-none p-0 m-0 flex flex-col gap-1">
                    <li :class="passwordRequirements.minLength ? 'text-green-600' : 'text-muted-color'">• Minimal 8 karakter</li>
                    <li :class="passwordRequirements.hasUppercase ? 'text-green-600' : 'text-muted-color'">• Mengandung huruf besar</li>
                    <li :class="passwordRequirements.hasLowercase ? 'text-green-600' : 'text-muted-color'">• Mengandung huruf kecil</li>
                    <li :class="passwordRequirements.hasNumber ? 'text-green-600' : 'text-muted-color'">• Mengandung angka</li>
                    <li :class="passwordRequirements.hasSymbol ? 'text-green-600' : 'text-muted-color'">• Mengandung simbol</li>
                    <li v-if="form.newPassword && !isDifferentFromCurrent" class="text-orange-500">• Harus berbeda dari password saat ini</li>
                </ul>
            </div>

            <div>
                <label for="confirmPassword" class="block mb-2 font-medium">Konfirmasi Password Baru <span class="text-red-500">*</span></label>
                <Password id="confirmPassword" v-model="form.confirmPassword" class="w-full" inputClass="w-full" :feedback="false" toggleMask autocomplete="new-password" placeholder="Ulangi password baru" />
                <small v-if="form.confirmPassword && !passwordsMatch" class="text-red-500">Konfirmasi password tidak cocok</small>
            </div>

            <Button type="submit" label="Ubah Password" class="w-full mt-2" :loading="saving" :disabled="saving || !isFormValid" />
        </form>
    </div>
</template>
