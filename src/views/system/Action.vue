<script setup>
import { createAction, deleteAction, listActions, updateAction } from '@/composables/useActionApi';
import { listMenuAdminFlat } from '@/composables/useMenuApi';
import { hasMenuPermission } from '@/composables/usePermission';
import { updateSessionMenu } from '@/composables/useSession';
import { useSoftReload } from '@/composables/useSoftReload';
import { FilterMatchMode } from '@primevue/core/api';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

const MENU_PATH = '/system/action';
const canInsert = computed(() => hasMenuPermission(MENU_PATH, 'IN'));
const canUpdate = computed(() => hasMenuPermission(MENU_PATH, 'UP'));
const canDelete = computed(() => hasMenuPermission(MENU_PATH, 'DT'));

const toast = useToast();
const confirm = useConfirm();

const rows = ref([]);
const menuOptions = ref([]);
const menuNameByKd = ref({});
const menuFilter = ref('');
const loading = ref(false);
const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS }
});

const dialogVisible = ref(false);
const dialogMode = ref('create');
const saving = ref(false);
const form = ref({
    kd_action: '',
    kode: '',
    nm_action: '',
    deskripsi: '',
    menus: []
});

/** Kosong di d_action_menu = semua menu; selain itu maks. 2 nama + sisa. */
function formatMenusCell(menuIds) {
    const ids = Array.isArray(menuIds) ? menuIds.filter(Boolean) : [];
    if (ids.length === 0) return 'Semua menu';

    const names = ids.map((kd) => menuNameByKd.value[kd] || kd);
    if (names.length <= 2) return names.join(', ');

    const shown = names.slice(0, 2).join(', ');
    const rest = names.length - 2;
    return `${shown}, ${rest} menu lainnya`;
}

function sanitizeMenuSelection(values) {
    if (!Array.isArray(values)) return [];
    const activeCodes = new Set(menuOptions.value.map((row) => String(row.value)));
    return [
        ...new Set(
            values
                .map((v) => String(v ?? '').trim())
                .filter(Boolean)
                .filter((v) => activeCodes.has(v))
        )
    ];
}

const filteredMenuOptions = computed(() => {
    const q = String(menuFilter.value || '')
        .trim()
        .toLowerCase();
    if (!q) return menuOptions.value;
    return menuOptions.value.filter((row) => {
        const hay = `${row.label || ''} ${row.value || ''}`.toLowerCase();
        return hay.includes(q);
    });
});

async function loadData() {
    loading.value = true;
    try {
        const [actions, menus] = await Promise.all([listActions(), listMenuAdminFlat()]);
        rows.value = actions;
        const byKd = {};
        menuOptions.value = (menus || [])
            .slice()
            .sort((a, b) => (a.urut_global ?? 0) - (b.urut_global ?? 0) || String(a.nm_menu || '').localeCompare(String(b.nm_menu || '')))
            .map((m) => {
                byKd[m.kd_menu] = m.nm_menu;
                return {
                    label: m.nm_menu,
                    value: m.kd_menu,
                    level: Number(m.level) || 1
                };
            });
        menuNameByKd.value = byKd;
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message, life: 4000 });
    } finally {
        loading.value = false;
    }
}

function openCreate() {
    dialogMode.value = 'create';
    menuFilter.value = '';
    form.value = { kd_action: '', kode: '', nm_action: '', deskripsi: '', menus: [] };
    dialogVisible.value = true;
}

function openEdit(row) {
    dialogMode.value = 'edit';
    menuFilter.value = '';
    form.value = {
        kd_action: row.kd_action,
        kode: row.kode,
        nm_action: row.nm_action,
        deskripsi: row.deskripsi || '',
        menus: sanitizeMenuSelection(row.menus || [])
    };
    dialogVisible.value = true;
}

async function submitForm() {
    if (!form.value.kode?.trim() || !form.value.nm_action?.trim()) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Kode dan nama wajib', life: 3000 });
        return;
    }
    saving.value = true;
    try {
        const payload = {
            kode: form.value.kode.trim(),
            nm_action: form.value.nm_action.trim(),
            deskripsi: form.value.deskripsi?.trim() || null,
            menus: sanitizeMenuSelection(form.value.menus)
        };
        if (dialogMode.value === 'create') {
            await createAction(payload);
        } else {
            await updateAction({ ...payload, kd_action: form.value.kd_action });
        }
        await updateSessionMenu();
        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Action disimpan', life: 2500 });
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
        message: `Hapus action "${row.nm_action}"?`,
        header: 'Konfirmasi',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await deleteAction(row.kd_action);
                await updateSessionMenu();
                toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Action dihapus', life: 2500 });
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
                <h2 class="m-0 text-xl font-semibold">Action</h2>
                <p class="m-0 mt-1 text-color-secondary text-sm">Kelola aksi (AC/IN/UP/…) dan assign ke menu.</p>
            </div>
            <div class="flex gap-2">
                <Button icon="pi pi-refresh" label="Muat Ulang" severity="secondary" outlined :loading="loading" @click="reload" />
                <Button v-if="canInsert" label="Tambah" icon="pi pi-plus" @click="openCreate" />
            </div>
        </div>

        <DataTable :value="rows" :loading="loading" dataKey="kd_action" paginator :rows="10" v-model:filters="filters" filterDisplay="menu" :globalFilterFields="['kode', 'nm_action', 'deskripsi', 'kd_action']" stripedRows>
            <template #header>
                <IconField>
                    <InputIcon class="pi pi-search" />
                    <InputText v-model="filters['global'].value" placeholder="Cari..." />
                </IconField>
            </template>
            <Column field="kode" header="Kode" sortable style="width: 6rem" />
            <Column field="nm_action" header="Nama" sortable />
            <Column field="deskripsi" header="Deskripsi" />
            <Column header="Menu">
                <template #body="{ data }">
                    <span class="text-sm">{{ formatMenusCell(data.menus) }}</span>
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

    <Dialog v-model:visible="dialogVisible" modal :header="dialogMode === 'create' ? 'Tambah Action' : 'Edit Action'" :style="{ width: '32rem' }">
        <div class="flex flex-col gap-3">
            <div>
                <label class="block mb-2">Kode *</label>
                <InputText v-model="form.kode" class="w-full" placeholder="AC" />
            </div>
            <div>
                <label class="block mb-2">Nama *</label>
                <InputText v-model="form.nm_action" class="w-full" />
            </div>
            <div>
                <label class="block mb-2">Deskripsi</label>
                <Textarea v-model="form.deskripsi" class="w-full" rows="3" />
            </div>
            <div>
                <label class="block mb-2">Menu</label>
                <MultiSelect v-model="form.menus" :options="filteredMenuOptions" optionLabel="label" optionValue="value" display="chip" class="w-full" :filter="false" :showToggleAll="false" placeholder="Semua menu" @hide="menuFilter = ''">
                    <template #header>
                        <div class="flex flex-col gap-2 p-2 w-full">
                            <IconField class="w-full">
                                <InputIcon class="pi pi-search" />
                                <InputText v-model="menuFilter" class="w-full" placeholder="Cari menu..." @click.stop @keydown.stop />
                            </IconField>
                        </div>
                    </template>
                    <template #option="{ option }">
                        <span :style="{ paddingLeft: `${Math.max(0, (option.level || 1) - 1) * 1}rem` }">{{ option.label }}</span>
                    </template>
                </MultiSelect>
            </div>
        </div>
        <template #footer>
            <Button label="Batal" text @click="dialogVisible = false" />
            <Button label="Simpan" :loading="saving" @click="submitForm" />
        </template>
    </Dialog>
</template>
