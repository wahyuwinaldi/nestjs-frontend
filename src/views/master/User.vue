<script setup>
import { hasMenuPermission } from '@/composables/usePermission';
import { getPasswordRequirements, getPasswordStrengthError } from '@/composables/usePassword';
import { useSoftReload } from '@/composables/useSoftReload';
import {
    createUser,
    deleteUser,
    listUserRoles,
    listUsersAdmin,
    sendUserResetEmail,
    unlockUser,
    updateUser
} from '@/composables/useUser';
import { FilterMatchMode } from '@primevue/core/api';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

const MENU_PATH = '/master/user';
const canInsert = computed(() => hasMenuPermission(MENU_PATH, 'IN'));
const canUpdate = computed(() => hasMenuPermission(MENU_PATH, 'UP'));
const canDelete = computed(() => hasMenuPermission(MENU_PATH, 'DT'));

const toast = useToast();
const confirm = useConfirm();

const rows = ref([]);
const roleOptions = ref([]);
const loading = ref(false);
const tableFirst = ref(0);
const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS }
});

const dialogVisible = ref(false);
const dialogMode = ref('create');
const saving = ref(false);
const form = ref({
    uid_user_system: '',
    username: '',
    email: '',
    nama: '',
    kd_role: null,
    password: '',
    status: true
});

const passwordRequirements = computed(() => getPasswordRequirements(form.value.password));
const showPasswordRules = computed(() => dialogMode.value === 'create' || Boolean(form.value.password?.trim()));

async function loadData() {
    loading.value = true;
    try {
        const [users, roles] = await Promise.all([listUsersAdmin(), listUserRoles()]);
        rows.value = users;
        roleOptions.value = roles.map((r) => ({ label: r.nm_role, value: r.kd_role }));
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message, life: 4000 });
    } finally {
        loading.value = false;
    }
}

function openCreate() {
    dialogMode.value = 'create';
    form.value = {
        uid_user_system: '',
        username: '',
        email: '',
        nama: '',
        kd_role: roleOptions.value[0]?.value || null,
        password: '',
        status: true
    };
    dialogVisible.value = true;
}

function openEdit(row) {
    dialogMode.value = 'edit';
    form.value = {
        uid_user_system: row.uid_user_system,
        username: row.username || '',
        email: row.email || '',
        nama: row.nama || '',
        kd_role: row.kd_role || null,
        password: '',
        status: row.status_user === 'A'
    };
    dialogVisible.value = true;
}

async function submitForm() {
    if (!form.value.username?.trim()) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Username wajib', life: 3000 });
        return;
    }
    if (!form.value.nama?.trim()) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Nama wajib', life: 3000 });
        return;
    }
    if (!form.value.kd_role) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Role wajib', life: 3000 });
        return;
    }
    if (dialogMode.value === 'create' && !form.value.password?.trim()) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Password wajib', life: 3000 });
        return;
    }
    if (form.value.password?.trim()) {
        const passwordError = getPasswordStrengthError(form.value.password);
        if (passwordError) {
            toast.add({ severity: 'warn', summary: 'Validasi', detail: passwordError, life: 3500 });
            return;
        }
    }

    saving.value = true;
    try {
        const payload = {
            username: form.value.username.trim(),
            email: form.value.email?.trim() || null,
            nama: form.value.nama.trim(),
            kd_role: form.value.kd_role,
            status: form.value.status ? 'A' : 'N'
        };
        if (dialogMode.value === 'create') {
            await createUser({ ...payload, password: form.value.password });
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'User ditambahkan', life: 2500 });
        } else {
            const editPayload = {
                ...payload,
                uid_user_system: form.value.uid_user_system
            };
            if (form.value.password?.trim()) {
                editPayload.password = form.value.password;
            }
            await updateUser(editPayload);
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'User diperbarui', life: 2500 });
        }
        dialogVisible.value = false;
        await loadData();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message, life: 4000 });
    } finally {
        saving.value = false;
    }
}

function askDelete(row) {
    confirm.require({
        message: `Hapus user "${row.username}"?`,
        header: 'Konfirmasi',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await deleteUser(row.uid_user_system);
                toast.add({ severity: 'success', summary: 'Berhasil', detail: 'User dihapus', life: 2500 });
                await loadData();
            } catch (e) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: e.message, life: 4000 });
            }
        }
    });
}

async function toggleStatus(row) {
    const next = row.status_user === 'A' ? 'N' : 'A';
    try {
        await updateUser({ uid_user_system: row.uid_user_system, status: next });
        toast.add({
            severity: 'success',
            summary: 'Berhasil',
            detail: next === 'A' ? 'User diaktifkan' : 'User dinonaktifkan',
            life: 2500
        });
        await loadData();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message, life: 4000 });
    }
}

function askUnlock(row) {
    confirm.require({
        message: `Buka kunci akun "${row.username}"?`,
        header: 'Unlock akun',
        icon: 'pi pi-lock-open',
        accept: async () => {
            try {
                await unlockUser(row.uid_user_system);
                toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Akun dibuka kuncinya', life: 2500 });
                await loadData();
            } catch (e) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: e.message, life: 4000 });
            }
        }
    });
}

function askSendResetEmail(row) {
    if (!row.email) {
        toast.add({
            severity: 'warn',
            summary: 'Email kosong',
            detail: 'Isi email user terlebih dahulu sebelum mengirim link reset.',
            life: 4000
        });
        return;
    }
    confirm.require({
        message: `Kirim link reset password ke ${row.email}? Link berlaku 24 jam.`,
        header: 'Kirim email reset',
        icon: 'pi pi-envelope',
        accept: async () => {
            try {
                const res = await sendUserResetEmail(row.uid_user_system);
                toast.add({
                    severity: 'success',
                    summary: 'Berhasil',
                    detail: res?.data?.message || 'Email reset password telah dikirim',
                    life: 3000
                });
            } catch (e) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: e.message, life: 4000 });
            }
        }
    });
}

function statusLabel(row) {
    if (row.is_deleted) return 'Dihapus';
    if (row.is_locked) return 'Terkunci';
    return row.status_user === 'A' ? 'Aktif' : 'Nonaktif';
}

function statusSeverity(row) {
    if (row.is_deleted) return 'danger';
    if (row.is_locked) return 'danger';
    return row.status_user === 'A' ? 'success' : 'warn';
}

onMounted(loadData);
const { reload } = useSoftReload(loadData, { isEnabled: () => !dialogVisible.value });
</script>

<template>
    <div class="card">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
                <h2 class="m-0 text-xl font-semibold">User</h2>
                <p class="m-0 mt-1 text-color-secondary text-sm">Kelola akun pengguna, role, status, dan kunci akun.</p>
            </div>
            <div class="flex gap-2">
                <Button icon="pi pi-refresh" label="Muat Ulang" severity="secondary" outlined :loading="loading" @click="reload" />
                <Button v-if="canInsert" label="Tambah" icon="pi pi-plus" @click="openCreate" />
            </div>
        </div>

        <DataTable
            v-model:first="tableFirst"
            :value="rows"
            :loading="loading"
            dataKey="uid_user_system"
            paginator
            :rows="10"
            v-model:filters="filters"
            filterDisplay="menu"
            :globalFilterFields="['username', 'email', 'nama', 'nm_role']"
            stripedRows
        >
            <template #header>
                <IconField>
                    <InputIcon class="pi pi-search" />
                    <InputText v-model="filters['global'].value" placeholder="Cari..." />
                </IconField>
            </template>
            <Column header="No" style="width: 4rem">
                <template #body="{ index }">{{ tableFirst + index + 1 }}</template>
            </Column>
            <Column header="Username" sortable sortField="username">
                <template #body="{ data }">
                    <div class="flex flex-col">
                        <span class="font-medium">{{ data.username }}</span>
                        <span class="text-color-secondary text-sm">{{ data.email || '-' }}</span>
                    </div>
                </template>
            </Column>
            <Column field="nama" header="Nama" sortable />
            <Column field="nm_role" header="Role" sortable style="width: 10rem" />
            <Column header="Status" sortable sortField="status_user" style="width: 9rem">
                <template #body="{ data }">
                    <Tag :value="statusLabel(data)" :severity="statusSeverity(data)" />
                </template>
            </Column>
            <Column header="" style="width: 14rem" bodyStyle="white-space: nowrap">
                <template #body="{ data }">
                    <div class="flex flex-nowrap items-center gap-1 whitespace-nowrap">
                        <Button v-if="canUpdate && !data.is_deleted" icon="pi pi-pencil" text rounded title="Edit" @click="openEdit(data)" />
                        <Button
                            v-if="canUpdate && !data.is_deleted && data.is_locked"
                            icon="pi pi-lock-open"
                            text
                            rounded
                            severity="warn"
                            title="Unlock"
                            @click="askUnlock(data)"
                        />
                        <Button
                            v-if="canUpdate && !data.is_deleted"
                            icon="pi pi-envelope"
                            text
                            rounded
                            title="Kirim email reset password"
                            @click="askSendResetEmail(data)"
                        />
                        <Button
                            v-if="canUpdate && !data.is_deleted"
                            :icon="data.status_user === 'A' ? 'pi pi-ban' : 'pi pi-check'"
                            text
                            rounded
                            :severity="data.status_user === 'A' ? 'warn' : 'success'"
                            :title="data.status_user === 'A' ? 'Nonaktifkan' : 'Aktifkan'"
                            @click="toggleStatus(data)"
                        />
                        <Button v-if="canDelete && !data.is_deleted" icon="pi pi-trash" text rounded severity="danger" title="Hapus" @click="askDelete(data)" />
                    </div>
                </template>
            </Column>
            <template #empty>
                <div class="text-center text-color-secondary my-8">Tidak ada data.</div>
            </template>
        </DataTable>
    </div>

    <Dialog v-model:visible="dialogVisible" modal :header="dialogMode === 'create' ? 'Tambah User' : 'Edit User'" :style="{ width: '32rem' }">
        <div class="flex flex-col gap-3">
            <div>
                <label class="block mb-2">Username *</label>
                <InputText v-model="form.username" class="w-full" placeholder="username" autocomplete="off" />
            </div>
            <div>
                <label class="block mb-2">Email</label>
                <InputText v-model="form.email" type="email" class="w-full" placeholder="email@contoh.com" maxlength="255" />
            </div>
            <div>
                <label class="block mb-2">Nama *</label>
                <InputText v-model="form.nama" class="w-full" placeholder="Nama lengkap" />
            </div>
            <div>
                <label class="block mb-2">Role *</label>
                <Select v-model="form.kd_role" :options="roleOptions" optionLabel="label" optionValue="value" placeholder="Pilih role" class="w-full" />
            </div>
            <div>
                <label class="block mb-2">
                    Password
                    <span v-if="dialogMode === 'create'">*</span>
                    <span v-else class="text-color-secondary font-normal text-sm"> (kosongkan jika tidak diubah)</span>
                </label>
                <Password v-model="form.password" class="w-full" inputClass="w-full" :feedback="false" toggleMask autocomplete="new-password" />
                <ul v-if="showPasswordRules" class="mt-2 text-sm list-none p-0 m-0 flex flex-col gap-1">
                    <li :class="passwordRequirements.minLength ? 'text-green-600' : 'text-muted-color'">• Minimal 8 karakter</li>
                    <li :class="passwordRequirements.hasUppercase ? 'text-green-600' : 'text-muted-color'">• Mengandung huruf besar</li>
                    <li :class="passwordRequirements.hasLowercase ? 'text-green-600' : 'text-muted-color'">• Mengandung huruf kecil</li>
                    <li :class="passwordRequirements.hasNumber ? 'text-green-600' : 'text-muted-color'">• Mengandung angka</li>
                    <li :class="passwordRequirements.hasSymbol ? 'text-green-600' : 'text-muted-color'">• Mengandung simbol</li>
                </ul>
            </div>
            <div class="flex items-center gap-2">
                <ToggleSwitch v-model="form.status" />
                <span>{{ form.status ? 'Aktif' : 'Nonaktif' }}</span>
            </div>
        </div>
        <template #footer>
            <Button label="Batal" text @click="dialogVisible = false" />
            <Button label="Simpan" :loading="saving" @click="submitForm" />
        </template>
    </Dialog>
</template>
