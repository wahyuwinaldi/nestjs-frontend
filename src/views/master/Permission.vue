<script setup>
import { listActions } from '@/composables/useActionApi';
import { listMenuAdminTree } from '@/composables/useMenuApi';
import { hasMenuPermission } from '@/composables/usePermission';
import { createPermission, deletePermission, getActionEdit, listPermissionGrouped, updatePermission } from '@/composables/usePermissionApi';
import { updateSessionMenu } from '@/composables/useSession';
import { useSoftReload } from '@/composables/useSoftReload';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

const MENU_PATH = '/master/permission';
const canInsert = computed(() => hasMenuPermission(MENU_PATH, 'IN'));
const canUpdate = computed(() => hasMenuPermission(MENU_PATH, 'UP'));
const canDelete = computed(() => hasMenuPermission(MENU_PATH, 'DT'));

const toast = useToast();
const confirm = useConfirm();

const rows = ref([]);
const flatMenus = ref([]);
const allActions = ref([]);
const loading = ref(false);
const tableFirst = ref(0);

const dialogVisible = ref(false);
const dialogMode = ref('create');
const dialogMaximized = ref(false);
const saving = ref(false);
const selectedRole = ref('');
const roleName = ref('');
/** @type {import('vue').Ref<Record<string, string[]>>} */
const menuActions = ref({});
/** Filter pencarian akses per menu (kd_menu → query). */
const actionFilterByMenu = ref({});

const dialogContentStyle = computed(() => (dialogMaximized.value ? { display: 'flex', flexDirection: 'column', flex: '1 1 auto', height: '100%', overflow: 'hidden' } : {}));

function onDialogMaximize() {
    dialogMaximized.value = true;
}

function onDialogUnmaximize() {
    dialogMaximized.value = false;
}

function onDialogHide() {
    dialogMaximized.value = false;
    actionFilterByMenu.value = {};
}

function flattenTree(nodes, depth = 0, out = []) {
    for (const n of nodes || []) {
        out.push({ ...n, depth });
        if (n.children?.length) flattenTree(n.children, depth + 1, out);
    }
    return out;
}

function actionsForMenu(kdMenu) {
    // Kosong di d_action_menu = action berlaku untuk semua menu.
    return allActions.value.filter((a) => {
        const menus = Array.isArray(a.menus) ? a.menus : [];
        if (menus.length === 0) return true;
        return menus.includes(kdMenu);
    });
}

function filteredActionsForMenu(kdMenu) {
    const q = String(actionFilterByMenu.value[kdMenu] || '')
        .trim()
        .toLowerCase();
    const opts = actionsForMenu(kdMenu);
    if (!q) return opts;
    return opts.filter((a) => {
        const hay = `${a.nm_action || ''} ${a.kode || ''} ${a.kd_action || ''}`.toLowerCase();
        return hay.includes(q);
    });
}

function actionCodesForMenu(kdMenu) {
    return actionsForMenu(kdMenu).map((a) => a.kd_action);
}

function selectedActionCodes(kdMenu) {
    return Array.isArray(menuActions.value[kdMenu]) ? menuActions.value[kdMenu] : [];
}

function isAllAccess(kdMenu) {
    const all = actionCodesForMenu(kdMenu);
    if (all.length === 0) return false;
    const selected = selectedActionCodes(kdMenu);
    return all.every((kd) => selected.includes(kd));
}

function someAccessSelected(kdMenu) {
    return selectedActionCodes(kdMenu).length > 0;
}

function toggleAllAccess(kdMenu, checked) {
    const shouldSelect = typeof checked === 'boolean' ? checked : !isAllAccess(kdMenu);
    menuActions.value[kdMenu] = shouldSelect ? [...actionCodesForMenu(kdMenu)] : [];
}

function accessSelectedItemsLabel(kdMenu) {
    return isAllAccess(kdMenu) ? 'All access' : '{0} items selected';
}

function accessMaxSelectedLabels(kdMenu) {
    return isAllAccess(kdMenu) ? 0 : 4;
}

function onAccessPanelHide(kdMenu) {
    actionFilterByMenu.value = { ...actionFilterByMenu.value, [kdMenu]: '' };
}

function setActionFilter(kdMenu, value) {
    actionFilterByMenu.value = { ...actionFilterByMenu.value, [kdMenu]: value };
}

function emptyMatrix() {
    const map = {};
    for (const m of flatMenus.value) map[m.kd_menu] = [];
    map.MN_MAIN = ['ACT_AC'];
    return map;
}

async function loadData() {
    loading.value = true;
    try {
        const [grouped, tree, actions] = await Promise.all([listPermissionGrouped(), listMenuAdminTree(), listActions()]);
        rows.value = grouped;
        flatMenus.value = flattenTree(tree);
        allActions.value = actions;
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message, life: 4000 });
    } finally {
        loading.value = false;
    }
}

function openCreate() {
    dialogMode.value = 'create';
    selectedRole.value = '';
    roleName.value = '';
    menuActions.value = emptyMatrix();
    dialogVisible.value = true;
}

async function openEdit(row) {
    dialogMode.value = 'edit';
    selectedRole.value = row.kd_role;
    roleName.value = row.nm_role || '';
    const edit = await getActionEdit(row.kd_role);
    const map = emptyMatrix();
    for (const item of edit) {
        map[item.menu] = [...(item.action || [])];
    }
    menuActions.value = map;
    dialogVisible.value = true;
}

function pairsFromMatrix() {
    const pairs = [];
    Object.entries(menuActions.value).forEach(([menu, actions]) => {
        (actions || []).forEach((akses) => {
            pairs.push({ menu, akses });
        });
    });
    if (!pairs.some((p) => p.menu === 'MN_MAIN' && p.akses === 'ACT_AC')) {
        pairs.unshift({ menu: 'MN_MAIN', akses: 'ACT_AC' });
    }
    return pairs;
}

async function submitForm() {
    const nm = roleName.value.trim();
    if (!nm) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Nama role wajib', life: 3000 });
        return;
    }
    saving.value = true;
    try {
        const pairs = pairsFromMatrix();
        if (dialogMode.value === 'create') {
            await createPermission(nm, pairs);
        } else {
            await updatePermission(selectedRole.value, pairs, nm);
        }
        await updateSessionMenu();
        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Role & permission disimpan', life: 2500 });
        dialogVisible.value = false;
        await loadData();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message, life: 4000 });
    } finally {
        saving.value = false;
    }
}

function askDelete(row) {
    if (row.kd_role === 'RS001') {
        toast.add({
            severity: 'warn',
            summary: 'Tidak diizinkan',
            detail: 'Role Super Administrator (RS001) tidak boleh dihapus',
            life: 3000
        });
        return;
    }
    confirm.require({
        message: `Hapus role "${row.nm_role}" beserta semua permission-nya?`,
        header: 'Konfirmasi',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await deletePermission(row.kd_role);
                await updateSessionMenu();
                toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Role dihapus', life: 2500 });
                await loadData();
            } catch (e) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: e.message, life: 4000 });
            }
        }
    });
}

function permissionCount(row) {
    return (row.permissions || []).reduce((n, p) => n + (p.action?.length || 0), 0);
}

onMounted(loadData);
const { reload } = useSoftReload(loadData, { isEnabled: () => !dialogVisible.value });
</script>

<template>
    <div class="card">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
                <h2 class="m-0 text-xl font-semibold">Role & Permission</h2>
                <p class="m-0 mt-1 text-color-secondary text-sm">Kelola role dan matrix akses menu × action.</p>
            </div>
            <div class="flex gap-2">
                <Button icon="pi pi-refresh" label="Muat Ulang" severity="secondary" outlined :loading="loading" @click="reload" />
                <Button v-if="canInsert" label="Tambah" icon="pi pi-plus" @click="openCreate" />
            </div>
        </div>

        <DataTable v-model:first="tableFirst" :value="rows" :loading="loading" dataKey="kd_role" paginator :rows="10" stripedRows>
            <Column header="No" style="width: 4rem">
                <template #body="{ index }">{{ tableFirst + index + 1 }}</template>
            </Column>
            <Column field="nm_role" header="Nama Role" />
            <Column header="Jumlah Grant">
                <template #body="{ data }">{{ permissionCount(data) }}</template>
            </Column>
            <Column header="" style="width: 7rem">
                <template #body="{ data }">
                    <Button v-if="canUpdate" icon="pi pi-pencil" text rounded @click="openEdit(data)" />
                    <Button v-if="canDelete && data.kd_role !== 'RS001'" icon="pi pi-trash" text rounded severity="danger" @click="askDelete(data)" />
                </template>
            </Column>
            <template #empty>
                <div class="text-center text-color-secondary my-8">Tidak ada data.</div>
            </template>
        </DataTable>
    </div>

    <Dialog
        v-model:visible="dialogVisible"
        modal
        :header="dialogMode === 'create' ? 'Tambah Role & Permission' : 'Edit Role & Permission'"
        :style="{ width: 'min(56rem, 95vw)' }"
        :contentStyle="dialogContentStyle"
        maximizable
        @maximize="onDialogMaximize"
        @unmaximize="onDialogUnmaximize"
        @hide="onDialogHide"
    >
        <div class="perm-dialog flex flex-col gap-3 w-full">
            <div class="w-full shrink-0">
                <label class="block mb-2">Nama Role *</label>
                <InputText v-model="roleName" class="w-full" placeholder="Contoh: Operator" />
                <small v-if="dialogMode === 'edit'" class="text-color-secondary">Kode: {{ selectedRole }}</small>
                <small v-else class="text-color-secondary">Kode role digenerate otomatis (RS###).</small>
            </div>

            <div class="perm-matrix overflow-auto border border-surface-200 rounded w-full" :style="dialogMaximized ? { maxHeight: 'none', flex: '1 1 auto', minHeight: 0 } : undefined">
                <table class="w-full" style="border-collapse: collapse; table-layout: fixed">
                    <thead>
                        <tr class="surface-100">
                            <th class="text-left p-2" style="width: 40%">Menu</th>
                            <th class="text-left p-2">Akses</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="menu in flatMenus" :key="menu.kd_menu" class="border-t border-surface-200">
                            <td class="p-2 whitespace-nowrap overflow-hidden text-ellipsis">
                                <span :style="{ paddingLeft: `${(menu.depth || 0) * 12}px` }">
                                    <span v-if="menu.depth > 0" class="text-color-secondary">└ </span>
                                    {{ menu.nm_menu }}
                                </span>
                            </td>
                            <td class="p-2">
                                <MultiSelect
                                    v-model="menuActions[menu.kd_menu]"
                                    :options="filteredActionsForMenu(menu.kd_menu)"
                                    optionLabel="nm_action"
                                    optionValue="kd_action"
                                    display="chip"
                                    placeholder="Pilih akses"
                                    class="w-full"
                                    :filter="false"
                                    :showToggleAll="false"
                                    :maxSelectedLabels="accessMaxSelectedLabels(menu.kd_menu)"
                                    :selectedItemsLabel="accessSelectedItemsLabel(menu.kd_menu)"
                                    @hide="onAccessPanelHide(menu.kd_menu)"
                                >
                                    <template #header>
                                        <div class="flex flex-col gap-2 p-2 w-full">
                                            <IconField class="w-full">
                                                <InputIcon class="pi pi-search" />
                                                <InputText :modelValue="actionFilterByMenu[menu.kd_menu] || ''" class="w-full" placeholder="Cari akses..." @update:modelValue="(v) => setActionFilter(menu.kd_menu, v)" @click.stop @keydown.stop />
                                            </IconField>
                                            <div class="flex items-center gap-2 cursor-pointer select-none px-1" @click.stop="toggleAllAccess(menu.kd_menu, !isAllAccess(menu.kd_menu))">
                                                <Checkbox
                                                    :modelValue="isAllAccess(menu.kd_menu)"
                                                    :indeterminate="someAccessSelected(menu.kd_menu) && !isAllAccess(menu.kd_menu)"
                                                    binary
                                                    @click.stop
                                                    @update:modelValue="(v) => toggleAllAccess(menu.kd_menu, v)"
                                                />
                                                <span>(Pilih semua)</span>
                                            </div>
                                        </div>
                                    </template>
                                </MultiSelect>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        <template #footer>
            <Button label="Batal" text @click="dialogVisible = false" />
            <Button label="Simpan" :loading="saving" @click="submitForm" />
        </template>
    </Dialog>
</template>

<style scoped>
.perm-dialog {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 0;
}
.perm-matrix {
    max-height: min(28rem, 60vh);
    overflow: auto;
    flex: 1 1 auto;
    min-height: 12rem;
}
</style>

<style>
/* Dialog maximize: isi content flex penuh, matrix ikut tinggi sisa viewport */
.p-dialog.p-dialog-maximized .p-dialog-content:has(.perm-dialog) {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    height: 100%;
    max-height: none;
    overflow: hidden;
}
.p-dialog.p-dialog-maximized .p-dialog-content:has(.perm-dialog) .perm-dialog {
    flex: 1 1 auto;
    height: 100%;
    min-height: 0;
}
.p-dialog.p-dialog-maximized .p-dialog-content:has(.perm-dialog) .perm-matrix {
    flex: 1 1 auto;
    max-height: none !important;
    min-height: 0;
    height: auto;
}
.p-dialog.p-dialog-maximized:has(.perm-dialog) {
    display: flex;
    flex-direction: column;
}
.p-dialog.p-dialog-maximized:has(.perm-dialog) .p-dialog-content {
    flex: 1 1 auto;
}
</style>
