<script setup>
import { hasMenuPermission } from '@/composables/usePermission';
import { createSetting, deleteSetting, listSettings, updateSetting } from '@/composables/useSettingsApi';
import { useSoftReload } from '@/composables/useSoftReload';
import { FilterMatchMode } from '@primevue/core/api';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

const MENU_PATH = '/system/website';
const UI_THEME_KODE = 'ui-theme';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/webp'];
const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.ico', '.webp'];

const canInsert = computed(() => hasMenuPermission(MENU_PATH, 'IN'));
const canUpdate = computed(() => hasMenuPermission(MENU_PATH, 'UP'));
const canDelete = computed(() => hasMenuPermission(MENU_PATH, 'DT'));

const toast = useToast();
const confirm = useConfirm();

const rows = ref([]);
const loading = ref(false);
const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS }
});

const dialogVisible = ref(false);
const dialogMode = ref('create');
const saving = ref(false);
const form = ref({
    id_settings: '',
    nm_settings: '',
    kode: '',
    value: null
});
const fileInputRef = ref(null);
const FILE_ACCEPT = '.jpg,.jpeg,.png,.ico,.webp,image/jpeg,image/png,image/x-icon,image/webp';

const previewVisible = ref(false);
const previewSrc = ref('');
const previewLabel = ref('');

function isImageUrl(url) {
    if (!url) return false;
    const lower = String(url).toLowerCase();
    if (/\.(png|jpe?g|gif|webp|ico|svg)(\?|$)/i.test(lower)) return true;
    // Object key tanpa ekstensi (settings/{kode}) — anggap gambar
    return /\/settings\//i.test(lower) || /\/assets\//i.test(lower);
}

function openPreview(row) {
    if (!row?.value) return;
    previewSrc.value = row.value;
    previewLabel.value = row.nm_settings || row.kode || 'Preview';
    previewVisible.value = true;
}

async function loadData() {
    loading.value = true;
    try {
        rows.value = (await listSettings()).filter((row) => row?.kode !== UI_THEME_KODE);
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message, life: 4000 });
    } finally {
        loading.value = false;
    }
}

function openCreate() {
    dialogMode.value = 'create';
    form.value = { id_settings: '', nm_settings: '', kode: '', value: null };
    clearPendingFile();
    dialogVisible.value = true;
}

function openEdit(row) {
    dialogMode.value = 'edit';
    form.value = {
        id_settings: row.id_settings,
        nm_settings: row.nm_settings,
        kode: row.kode,
        value: null
    };
    clearPendingFile();
    dialogVisible.value = true;
}

function triggerFilePick() {
    fileInputRef.value?.click();
}

function clearPendingFile() {
    form.value.value = null;
    if (fileInputRef.value) fileInputRef.value.value = '';
}

function onFileSelected(event) {
    const file = event.target?.files?.[0] || null;
    if (!file) {
        form.value.value = null;
        return;
    }

    const ext = `.${(file.name.split('.').pop() || '').toLowerCase()}`;
    const typeOk = !file.type || ALLOWED_TYPES.includes(file.type) || ALLOWED_EXT.includes(ext);
    if (!typeOk) {
        toast.add({
            severity: 'warn',
            summary: 'Validasi',
            detail: 'File harus jpg, jpeg, png, ico, atau webp',
            life: 3500
        });
        clearPendingFile();
        return;
    }
    if (file.size > MAX_FILE_BYTES) {
        toast.add({
            severity: 'warn',
            summary: 'Validasi',
            detail: 'Ukuran file maksimal 5 MB',
            life: 3500
        });
        clearPendingFile();
        return;
    }
    form.value.value = file;
}

async function submitForm() {
    const nm = form.value.nm_settings?.trim();
    const kode = form.value.kode?.trim();
    if (!nm || !kode) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Nama dan kode wajib', life: 3000 });
        return;
    }
    if (dialogMode.value === 'create' && !form.value.value) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'File wajib diunggah', life: 3000 });
        return;
    }

    saving.value = true;
    try {
        if (dialogMode.value === 'create') {
            await createSetting({
                nm_settings: nm,
                kode,
                value: form.value.value
            });
        } else {
            await updateSetting({
                id_settings: form.value.id_settings,
                nm_settings: nm,
                kode,
                value: form.value.value || null
            });
        }
        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Settings disimpan', life: 2500 });
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
        message: `Hapus settings "${row.nm_settings}"?`,
        header: 'Konfirmasi',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await deleteSetting(row.id_settings);
                toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Settings dihapus', life: 2500 });
                await loadData();
            } catch (e) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: e.message, life: 4000 });
            }
        }
    });
}

onMounted(loadData);
const { reload } = useSoftReload(loadData, { isEnabled: () => !dialogVisible.value });
</script>

<template>
    <div class="card">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
                <h2 class="m-0 text-xl font-semibold">Website Settings</h2>
                <p class="m-0 mt-1 text-color-secondary text-sm">Kelola aset branding (logo, favicon, background login).</p>
            </div>
            <div class="flex gap-2">
                <Button icon="pi pi-refresh" label="Muat Ulang" severity="secondary" outlined :loading="loading" @click="reload" />
                <Button v-if="canInsert" label="Tambah" icon="pi pi-plus" @click="openCreate" />
            </div>
        </div>

        <DataTable :value="rows" :loading="loading" dataKey="id_settings" paginator :rows="10" v-model:filters="filters" filterDisplay="menu" :globalFilterFields="['nm_settings', 'kode', 'id_settings']" stripedRows>
            <template #header>
                <IconField>
                    <InputIcon class="pi pi-search" />
                    <InputText v-model="filters['global'].value" placeholder="Cari..." />
                </IconField>
            </template>
            <Column field="nm_settings" header="Nama" sortable />
            <Column field="kode" header="Kode" sortable style="width: 10rem" />
            <Column header="File" style="width: 10rem">
                <template #body="{ data }">
                    <Button v-if="data.value" label="Lihat" icon="pi pi-eye" text size="small" @click="openPreview(data)" />
                    <span v-else class="text-color-secondary text-sm">—</span>
                </template>
            </Column>
            <Column header="" style="width: 7rem">
                <template #body="{ data }">
                    <Button v-if="canUpdate" icon="pi pi-pencil" text rounded @click="openEdit(data)" />
                    <Button v-if="canDelete" icon="pi pi-trash" text rounded severity="danger" @click="askDelete(data)" />
                </template>
            </Column>
            <template #empty>
                <div class="text-center text-color-secondary my-8">Tidak ada data.</div>
            </template>
        </DataTable>
    </div>

    <Dialog v-model:visible="dialogVisible" modal :header="dialogMode === 'create' ? 'Tambah Settings' : 'Edit Settings'" :style="{ width: '32rem' }">
        <div class="flex flex-col gap-3">
            <div>
                <label class="block mb-2">Nama *</label>
                <InputText v-model="form.nm_settings" class="w-full" placeholder="Color Logo" />
            </div>
            <div>
                <label class="block mb-2">Kode *</label>
                <InputText v-model="form.kode" class="w-full" placeholder="logo-color" />
            </div>
            <div>
                <label class="block mb-1 font-medium">
                    Berkas gambar (jpg/png/ico/webp)
                    <span v-if="dialogMode === 'create'" class="text-red-500">*</span>
                    <span v-else class="text-color-secondary text-sm font-normal"> (opsional)</span>
                </label>
                <div class="flex gap-2 w-full items-stretch">
                    <InputText class="w-full pointer-events-none" :modelValue="form.value?.name || ''" placeholder="Belum ada berkas dipilih" :readonly="true" tabindex="-1" />
                    <Button v-if="form.value" type="button" icon="pi pi-times" severity="secondary" outlined @click="clearPendingFile" />
                    <Button type="button" icon="pi pi-folder-open" label="Browse" outlined @click="triggerFilePick" />
                </div>
                <input ref="fileInputRef" type="file" class="hidden" :accept="FILE_ACCEPT" @change="onFileSelected" />
                <p class="m-0 mt-1 text-xs text-color-secondary">Maks. 5 MB</p>
            </div>
        </div>
        <template #footer>
            <Button label="Batal" text @click="dialogVisible = false" />
            <Button label="Simpan" :loading="saving" @click="submitForm" />
        </template>
    </Dialog>

    <Dialog v-model:visible="previewVisible" modal :header="previewLabel" :style="{ width: '36rem' }">
        <div class="flex justify-center">
            <img v-if="isImageUrl(previewSrc)" :src="previewSrc" :alt="previewLabel" class="max-w-full max-h-[28rem] object-contain" />
            <a v-else :href="previewSrc" target="_blank" rel="noopener" class="text-primary">Buka file</a>
        </div>
    </Dialog>
</template>
