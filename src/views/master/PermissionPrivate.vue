<script setup>
import { listActions } from '@/composables/useActionApi';
import { listMenuAdminTree } from '@/composables/useMenuApi';
import { hasMenuPermission } from '@/composables/usePermission';
import { createPermissionPrivate, deletePermissionPrivate, getActionEditPrivate, getActionEditRolePrivate, listPermissionPrivateGrouped, listUsersWithoutPrivate, updatePermissionPrivate } from '@/composables/usePermissionApi';
import { updateSessionMenu } from '@/composables/useSession';
import { useSoftReload } from '@/composables/useSoftReload';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

const MENU_PATH = '/master/permission/private';
const canInsert = computed(() => hasMenuPermission(MENU_PATH, 'IN'));
const canUpdate = computed(() => hasMenuPermission(MENU_PATH, 'UP'));
const canDelete = computed(() => hasMenuPermission(MENU_PATH, 'DT'));

const toast = useToast();
const confirm = useConfirm();

const rows = ref([]);
const userOptions = ref([]);
const flatMenus = ref([]);
const allActions = ref([]);
const loading = ref(false);

const dialogVisible = ref(false);
const dialogMode = ref('create');
const dialogMaximized = ref(false);
const saving = ref(false);
const selectedUser = ref(null);
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

async function loadData() {
    loading.value = true;
    try {
        const [grouped, users, tree, actions] = await Promise.all([listPermissionPrivateGrouped(), listUsersWithoutPrivate(), listMenuAdminTree(), listActions()]);
        rows.value = grouped;
        userOptions.value = users.map((u) => ({
            label: `${u.nm_user} (${u.username})`,
            value: u.uid_user_system
        }));
        flatMenus.value = flattenTree(tree);
        allActions.value = actions;
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message, life: 4000 });
    } finally {
        loading.value = false;
    }
}

async function applyMatrix(editRows) {
    const map = {};
    for (const m of flatMenus.value) map[m.kd_menu] = [];
    for (const item of editRows || []) {
        map[item.menu] = [...(item.action || [])];
    }
    if (!map.MN_MAIN?.includes('ACT_AC')) {
        map.MN_MAIN = [...(map.MN_MAIN || []), 'ACT_AC'];
    }
    menuActions.value = map;
}

async function openCreate() {
    if (!userOptions.value.length) {
        toast.add({ severity: 'info', summary: 'Info', detail: 'Semua user sudah punya private permission', life: 3000 });
        return;
    }
    dialogMode.value = 'create';
    selectedUser.value = userOptions.value[0]?.value || null;
    menuActions.value = { MN_MAIN: ['ACT_AC'] };
    if (selectedUser.value) {
        const seeded = await getActionEditRolePrivate(selectedUser.value);
        if (seeded?.length) await applyMatrix(seeded);
    }
    dialogVisible.value = true;
}

async function onUserChange() {
    if (dialogMode.value !== 'create' || !selectedUser.value) return;
    const seeded = await getActionEditRolePrivate(selectedUser.value);
    if (seeded?.length) await applyMatrix(seeded);
}

async function openEdit(row) {
    dialogMode.value = 'edit';
    selectedUser.value = row.uid_user_system;
    await applyMatrix(await getActionEditPrivate(row.uid_user_system));
    dialogVisible.value = true;
}

function pairsFromMatrix() {
    const pairs = [];
    Object.entries(menuActions.value).forEach(([menu, actions]) => {
        (actions || []).forEach((akses) => pairs.push({ menu, akses }));
    });
    if (!pairs.some((p) => p.menu === 'MN_MAIN' && p.akses === 'ACT_AC')) {
        pairs.unshift({ menu: 'MN_MAIN', akses: 'ACT_AC' });
    }
    return pairs;
}

async function submitForm() {
    if (!selectedUser.value) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'User wajib', life: 3000 });
        return;
    }
    saving.value = true;
    try {
        const pairs = pairsFromMatrix();
        if (dialogMode.value === 'create') {
            await createPermissionPrivate(selectedUser.value, pairs);
        } else {
            await updatePermissionPrivate(selectedUser.value, pairs);
        }
        await updateSessionMenu();
        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Permission private disimpan', life: 2500 });
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
        message: `Hapus permission private untuk "${row.nm_user}"?`,
        header: 'Konfirmasi',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await deletePermissionPrivate(row.uid_user_system);
                await updateSessionMenu();
                toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Permission private dihapus', life: 2500 });
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
                <h2 class="m-0 text-xl font-semibold">Permission Private</h2>
                <p class="m-0 mt-1 text-color-secondary text-sm">Override akses per user (menggantikan permission role saat login).</p>
            </div>
            <div class="flex gap-2">
                <Button icon="pi pi-refresh" label="Muat Ulang" severity="secondary" outlined :loading="loading" @click="reload" />
                <Button v-if="canInsert" label="Tambah" icon="pi pi-plus" @click="openCreate" />
            </div>
        </div>

        <DataTable :value="rows" :loading="loading" dataKey="uid_user_system" paginator :rows="10" stripedRows>
            <Column field="nm_user" header="User" sortable />
            <Column field="username" header="Username" sortable />
            <Column header="Jumlah Grant">
                <template #body="{ data }">{{ permissionCount(data) }}</template>
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

    <Dialog
        v-model:visible="dialogVisible"
        modal
        :header="dialogMode === 'create' ? 'Tambah Permission Private' : 'Edit Permission Private'"
        :style="{ width: 'min(56rem, 95vw)' }"
        :contentStyle="dialogContentStyle"
        maximizable
        @maximize="onDialogMaximize"
        @unmaximize="onDialogUnmaximize"
        @hide="onDialogHide"
    >
        <div class="perm-dialog flex flex-col gap-3 w-full">
            <div v-if="dialogMode === 'create'" class="w-full shrink-0">
                <label class="block mb-2">User *</label>
                <Select v-model="selectedUser" :options="userOptions" optionLabel="label" optionValue="value" class="w-full" @change="onUserChange" />
            </div>
            <div v-else class="font-medium w-full shrink-0">User: {{ selectedUser }}</div>

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
