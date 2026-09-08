<script setup>
import { createMenu, deleteMenu, listMenuAdminTree, saveMenuBoard, updateMenu } from '@/composables/useMenuApi';
import { hasMenuPermission } from '@/composables/usePermission';
import { updateSessionMenu } from '@/composables/useSession';
import { useSoftReload } from '@/composables/useSoftReload';
import { extractRemixIconClass, parseRemixIconsFromHtml, resolveMenuIconClass } from '@/utils/menuIcon';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import draggable from 'vuedraggable';

const MENU_PATH = '/system/menu';
const MAIN_KD = 'MN_MAIN';

const canInsert = computed(() => hasMenuPermission(MENU_PATH, 'IN'));
const canUpdate = computed(() => hasMenuPermission(MENU_PATH, 'UP'));
const canDelete = computed(() => hasMenuPermission(MENU_PATH, 'DT'));

const toast = useToast();
const confirm = useConfirm();

const menuTree = ref([]);
const loading = ref(false);
const savingBoard = ref(false);
const dirty = ref(false);

const dialogVisible = ref(false);
const dialogMode = ref('create');
const form = ref({
    kd_menu: '',
    nm_menu: '',
    link_menu: '',
    icon_menu: '',
    status: true
});
const saving = ref(false);

const iconPickerVisible = ref(false);
const iconPickerTarget = ref(null); // 'form' | node
const iconSearch = ref('');
const remoteIcons = ref(null);

/** Fallback singkat jika public/icons.html belum tersedia. */
const FALLBACK_ICONS = [
    'ri-home-line',
    'ri-dashboard-line',
    'ri-settings-3-line',
    'ri-user-3-line',
    'ri-team-line',
    'ri-folder-2-line',
    'ri-file-list-3-line',
    'ri-bar-chart-2-line',
    'ri-pie-chart-2-line',
    'ri-calendar-line',
    'ri-mail-line',
    'ri-chat-3-line',
    'ri-list-check-2',
    'ri-database-2-line',
    'ri-map-pin-line',
    'ri-image-line',
    'ri-shield-keyhole-line',
    'ri-lock-line',
    'ri-menu-line',
    'ri-flashlight-line'
];

const allIcons = computed(() => {
    if (Array.isArray(remoteIcons.value) && remoteIcons.value.length > 0) {
        return remoteIcons.value;
    }
    return FALLBACK_ICONS;
});

const filteredIcons = computed(() => {
    const q = iconSearch.value.trim().toLowerCase();
    if (!q) return allIcons.value;
    return allIcons.value.filter((c) => c.toLowerCase().includes(q));
});

const selectedFormIcon = computed(() => extractRemixIconClass(form.value.icon_menu));

const dragGroup = { name: 'menu', pull: true, put: true };

async function loadRemixIconsFromHtml() {
    try {
        const res = await fetch('/icons.html', { cache: 'no-store' });
        if (!res.ok) return;
        const html = await res.text();
        const unique = parseRemixIconsFromHtml(html);
        if (unique.length > 0) remoteIcons.value = unique;
    } catch {
        // fallback FALLBACK_ICONS
    }
}

function normalizeNode(node) {
    return {
        ...node,
        kd_menu: node.kd_menu,
        children: Array.isArray(node.children) ? node.children.map(normalizeNode) : []
    };
}

function ensureChildren(list) {
    (list || []).forEach((n) => {
        if (!Array.isArray(n.children)) n.children = [];
        ensureChildren(n.children);
    });
}

function extractBoard(tree) {
    if (!Array.isArray(tree) || !tree.length) return [];
    // Root penuh termasuk MAIN MENU — board 3 level (root → anak → cucu).
    const board = tree.map(normalizeNode);
    ensureChildren(board);
    return board;
}

async function loadData() {
    loading.value = true;
    try {
        const tree = await listMenuAdminTree();
        menuTree.value = extractBoard(tree);
        dirty.value = false;
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message, life: 4000 });
    } finally {
        loading.value = false;
    }
}

function markDirty() {
    dirty.value = true;
}

function getDepthByContext(relatedContext) {
    try {
        const el = relatedContext?.component?.$el;
        if (!el) return 1;
        let depth = 1;
        let node = el;
        while (node) {
            if (node.classList?.contains('menu-indent')) depth += 1;
            node = node.parentElement;
        }
        return Math.max(1, Math.min(depth, 3));
    } catch {
        return 1;
    }
}

function onMove(evt) {
    return getDepthByContext(evt.relatedContext) <= 3;
}

function openCreate() {
    dialogMode.value = 'create';
    form.value = {
        kd_menu: '',
        nm_menu: '',
        link_menu: '',
        icon_menu: '',
        status: true
    };
    dialogVisible.value = true;
}

function openEdit(node) {
    dialogMode.value = 'edit';
    form.value = {
        kd_menu: node.kd_menu,
        nm_menu: node.nm_menu || '',
        link_menu: node.link_menu || '',
        icon_menu: extractRemixIconClass(node.icon_menu) || String(node.icon_menu || '').trim(),
        status: node.status !== 'N'
    };
    dialogVisible.value = true;
}

function openIconPicker(target) {
    iconPickerTarget.value = target;
    iconSearch.value = '';
    iconPickerVisible.value = true;
}

function openIconPickerFromForm() {
    openIconPicker('form');
}

function closeIconPicker() {
    iconPickerVisible.value = false;
    iconPickerTarget.value = null;
    iconSearch.value = '';
}

function chooseIcon(iconClass) {
    if (iconPickerTarget.value === 'form') {
        form.value.icon_menu = iconClass;
    } else if (iconPickerTarget.value && typeof iconPickerTarget.value === 'object') {
        iconPickerTarget.value.icon_menu = iconClass;
        markDirty();
    }
    closeIconPicker();
}

function clearFormIcon() {
    form.value.icon_menu = '';
}

function iconClassOf(nodeOrValue) {
    if (nodeOrValue && typeof nodeOrValue === 'object') {
        return resolveMenuIconClass(nodeOrValue.icon_menu, 'ri-menu-add-line');
    }
    return resolveMenuIconClass(nodeOrValue, 'ri-menu-add-line');
}

async function submitForm() {
    if (!form.value.nm_menu?.trim()) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Nama menu wajib', life: 3000 });
        return;
    }
    saving.value = true;
    try {
        const payload = {
            nm_menu: form.value.nm_menu.trim(),
            link_menu: form.value.link_menu?.trim() || null,
            icon_menu: form.value.icon_menu || null,
            status: form.value.status ? 'A' : 'N'
        };
        if (dialogMode.value === 'create') {
            await createMenu(payload);
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Menu ditambahkan', life: 2500 });
        } else {
            await updateMenu({ ...payload, kd_menu: form.value.kd_menu });
            await updateSessionMenu();
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Menu diperbarui', life: 2500 });
        }
        dialogVisible.value = false;
        await loadData();
        await updateSessionMenu();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message, life: 4000 });
    } finally {
        saving.value = false;
    }
}

function askDelete(node) {
    if (node.kd_menu === MAIN_KD) {
        toast.add({
            severity: 'warn',
            summary: 'Tidak diizinkan',
            detail: 'MAIN MENU tidak boleh dihapus',
            life: 3000
        });
        return;
    }
    confirm.require({
        message: `Hapus menu "${node.nm_menu}"? Submenu harus kosong.`,
        header: 'Konfirmasi',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await deleteMenu(node.kd_menu);
                await updateSessionMenu();
                toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Menu dihapus', life: 2500 });
                await loadData();
            } catch (e) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: e.message, life: 4000 });
            }
        }
    });
}

async function handleSaveBoard() {
    savingBoard.value = true;
    try {
        await saveMenuBoard(menuTree.value);
        await updateSessionMenu();
        dirty.value = false;
        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Urutan menu disimpan', life: 2500 });
        await loadData();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message, life: 4000 });
    } finally {
        savingBoard.value = false;
    }
}

function statusLabel(status) {
    return status === 'N' ? 'Nonaktif' : 'Aktif';
}

onMounted(() => {
    loadRemixIconsFromHtml();
    loadData();
});
const { reload } = useSoftReload(loadData, {
    isEnabled: () => !dialogVisible.value && !dirty.value && !iconPickerVisible.value
});
</script>

<template>
    <div class="card">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
                <h2 class="m-0 text-xl font-semibold">Menu</h2>
                <p class="m-0 mt-1 text-color-secondary text-sm">Susun hierarki menu hingga 3 level (termasuk MAIN MENU di root).</p>
            </div>
            <div class="flex gap-2">
                <Button icon="pi pi-refresh" label="Muat Ulang" severity="secondary" outlined :loading="loading" :disabled="dirty" @click="reload" />
                <Button v-if="canInsert" label="Tambah" icon="pi pi-plus" @click="openCreate" />
                <Button v-if="canUpdate" label="Simpan perubahan" icon="pi pi-save" :loading="savingBoard" :disabled="!dirty" severity="success" @click="handleSaveBoard" />
            </div>
        </div>

        <div v-if="loading" class="flex justify-center p-5">
            <ProgressSpinner style="width: 40px; height: 40px" />
        </div>

        <div v-else class="flex flex-col gap-3 w-full">
            <draggable v-model="menuTree" :group="dragGroup" item-key="kd_menu" class="menu-board flex flex-col gap-3 w-full" :move="onMove" @change="markDirty">
                <template #item="{ element: node }">
                    <div class="w-full">
                        <div class="menu-row surface-ground border-round p-3 flex items-center justify-between gap-3 w-full">
                            <div class="flex items-center gap-3 flex-1 min-w-0">
                                <i class="pi pi-bars text-color-secondary shrink-0" />
                                <span class="font-medium truncate">{{ node.nm_menu }}</span>
                                <span class="text-color-secondary text-sm truncate">{{ node.link_menu || '—' }}</span>
                                <Tag :value="statusLabel(node.status)" :severity="node.status === 'N' ? 'danger' : 'success'" />
                            </div>
                            <div class="flex gap-1 shrink-0">
                                <Button v-if="canUpdate" icon="pi pi-pencil" text rounded @click="openEdit(node)" />
                                <Button v-if="canDelete && node.kd_menu !== MAIN_KD" icon="pi pi-trash" text rounded severity="danger" @click="askDelete(node)" />
                            </div>
                        </div>

                        <div class="menu-indent menu-indent-l2 mt-2">
                            <draggable v-model="node.children" :group="dragGroup" item-key="kd_menu" class="menu-board flex flex-col gap-2 w-full" :move="onMove" @change="markDirty">
                                <template #item="{ element: child }">
                                    <div class="w-full">
                                        <div class="menu-row surface-ground border-round p-3 flex items-center justify-between gap-3 w-full">
                                            <div class="flex items-center gap-3 flex-1 min-w-0">
                                                <Button v-if="canUpdate" type="button" class="p-1 shrink-0" text @click="openIconPicker(child)">
                                                    <i :class="iconClassOf(child)" class="text-xl" />
                                                </Button>
                                                <i v-else :class="[iconClassOf(child), 'shrink-0 text-xl']" />
                                                <span class="font-medium truncate">{{ child.nm_menu }}</span>
                                                <span class="text-color-secondary text-sm truncate">{{ child.link_menu || '—' }}</span>
                                                <Tag :value="statusLabel(child.status)" :severity="child.status === 'N' ? 'danger' : 'success'" />
                                            </div>
                                            <div class="flex gap-1 shrink-0">
                                                <Button v-if="canUpdate" icon="pi pi-pencil" text rounded @click="openEdit(child)" />
                                                <Button v-if="canDelete" icon="pi pi-trash" text rounded severity="danger" @click="askDelete(child)" />
                                            </div>
                                        </div>

                                        <div class="menu-indent menu-indent-l3 mt-2">
                                            <draggable v-model="child.children" :group="dragGroup" item-key="kd_menu" class="menu-board flex flex-col gap-2 w-full" :move="onMove" @change="markDirty">
                                                <template #item="{ element: grand }">
                                                    <div class="menu-row surface-ground border-round p-3 flex items-center justify-between gap-3 w-full">
                                                        <div class="flex items-center gap-3 flex-1 min-w-0">
                                                            <Button v-if="canUpdate" type="button" class="p-1 shrink-0" text @click="openIconPicker(grand)">
                                                                <i :class="iconClassOf(grand)" class="text-xl" />
                                                            </Button>
                                                            <i v-else :class="[iconClassOf(grand), 'shrink-0 text-xl']" />
                                                            <span class="font-medium truncate">{{ grand.nm_menu }}</span>
                                                            <span class="text-color-secondary text-sm truncate">{{ grand.link_menu || '—' }}</span>
                                                            <Tag :value="statusLabel(grand.status)" :severity="grand.status === 'N' ? 'danger' : 'success'" />
                                                        </div>
                                                        <div class="flex gap-1 shrink-0">
                                                            <Button v-if="canUpdate" icon="pi pi-pencil" text rounded @click="openEdit(grand)" />
                                                            <Button v-if="canDelete" icon="pi pi-trash" text rounded severity="danger" @click="askDelete(grand)" />
                                                        </div>
                                                    </div>
                                                </template>
                                            </draggable>
                                        </div>
                                    </div>
                                </template>
                            </draggable>
                        </div>
                    </div>
                </template>
            </draggable>

            <p v-if="!menuTree.length" class="text-color-secondary text-center p-4">Belum ada menu. Tambah item baru.</p>
        </div>
    </div>

    <Dialog v-model:visible="dialogVisible" modal :header="dialogMode === 'create' ? 'Tambah Menu' : 'Edit Menu'" :style="{ width: '32rem' }">
        <div class="flex flex-col gap-3">
            <div>
                <label class="block mb-2">Nama *</label>
                <InputText v-model="form.nm_menu" class="w-full" />
            </div>
            <div>
                <label class="block mb-2">Link</label>
                <InputText v-model="form.link_menu" class="w-full" placeholder="/path" />
            </div>
            <div>
                <label class="block mb-2">Icon</label>
                <div class="flex gap-2">
                    <button type="button" class="icon-select-btn flex flex-1 items-center justify-between gap-2 min-w-0 px-3 py-2.5 text-left cursor-pointer" @click="openIconPickerFromForm">
                        <span class="flex items-center gap-2 min-w-0">
                            <i v-if="selectedFormIcon" :class="[selectedFormIcon, 'text-xl shrink-0']" />
                            <i v-else class="ri-image-add-line text-xl text-color-secondary shrink-0" />
                            <span class="truncate" :class="selectedFormIcon ? '' : 'text-color-secondary'">
                                {{ selectedFormIcon || 'Pilih icon…' }}
                            </span>
                        </span>
                        <i class="pi pi-chevron-down text-color-secondary shrink-0" />
                    </button>
                    <Button v-if="selectedFormIcon" type="button" icon="pi pi-times" severity="secondary" outlined title="Hapus icon" @click="clearFormIcon" />
                </div>
                <small class="text-color-secondary">Opsional.</small>
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

    <Dialog v-model:visible="iconPickerVisible" modal header="Pilih Icon" :style="{ width: 'min(56rem, 96vw)' }" :breakpoints="{ '960px': '95vw' }" maximizable @hide="closeIconPicker">
        <div class="flex flex-col gap-3" style="min-height: 20rem">
            <div class="flex gap-2 items-center">
                <IconField class="flex-1">
                    <InputIcon class="pi pi-search" />
                    <InputText v-model="iconSearch" class="w-full" placeholder="Cari nama icon (contoh: ri-home-line, dashboard, settings)…" autofocus />
                </IconField>
                <Button label="Tutup" severity="secondary" outlined @click="closeIconPicker" />
            </div>
            <p class="text-color-secondary text-sm m-0">{{ filteredIcons.length }} icon</p>
            <div class="icon-picker-grid overflow-auto border border-surface-200 rounded p-3" style="max-height: min(28rem, 60vh)">
                <button
                    v-for="cls in filteredIcons"
                    :key="cls"
                    type="button"
                    class="icon-picker-item flex items-center justify-center p-3 rounded border cursor-pointer"
                    :class="{ 'is-selected': selectedFormIcon === cls && iconPickerTarget === 'form' }"
                    :title="cls"
                    :aria-label="cls"
                    @click="chooseIcon(cls)"
                >
                    <i :class="[cls, 'text-xl']" />
                </button>
                <p v-if="!filteredIcons.length" class="text-color-secondary col-span-full text-center p-4">Tidak ada icon yang cocok.</p>
            </div>
        </div>
    </Dialog>
</template>

<style scoped>
.menu-board {
    display: flex;
    flex-direction: column;
    width: 100%;
}
.menu-board > * {
    width: 100%;
}
.menu-indent {
    border-left: 2px solid var(--p-surface-300, #dee2e6);
    padding-left: 0.75rem;
}
.menu-indent-l2 {
    margin-left: 1.25rem;
}
.menu-indent-l3 {
    margin-left: 2.5rem;
}
.icon-select-btn {
    min-height: 2.75rem;
    color: var(--p-inputtext-color, var(--p-form-field-color, inherit));
    background: var(--p-inputtext-background, var(--p-form-field-background, transparent));
    border: 1px solid var(--p-inputtext-border-color, var(--p-form-field-border-color, var(--p-content-border-color)));
    border-radius: var(--p-inputtext-border-radius, var(--p-form-field-border-radius, var(--p-border-radius)));
    transition:
        background-color 0.2s,
        border-color 0.2s,
        color 0.2s;
}
.icon-select-btn:hover {
    border-color: var(--p-primary-color, var(--p-primary-500));
}
.icon-select-btn:focus-visible {
    outline: 0;
    border-color: var(--p-inputtext-focus-border-color, var(--p-primary-color));
    box-shadow: var(--p-inputtext-focus-ring-shadow, var(--p-focus-ring-shadow, none));
}
.icon-picker-item {
    color: inherit;
    background: transparent;
    border-color: var(--p-content-border-color, var(--p-surface-200));
    transition:
        background-color 0.15s,
        border-color 0.15s,
        color 0.15s;
}
.icon-picker-item:hover,
.icon-picker-item.is-selected {
    border-color: var(--p-primary-color);
    background: color-mix(in srgb, var(--p-primary-color) 18%, var(--p-content-background, var(--p-surface-0)));
    color: var(--p-text-color, inherit);
}
.icon-picker-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.5rem;
}
@media (min-width: 640px) {
    .icon-picker-grid {
        grid-template-columns: repeat(6, minmax(0, 1fr));
    }
}
@media (min-width: 768px) {
    .icon-picker-grid {
        grid-template-columns: repeat(8, minmax(0, 1fr));
    }
}
@media (min-width: 1024px) {
    .icon-picker-grid {
        grid-template-columns: repeat(10, minmax(0, 1fr));
    }
}
@media (min-width: 1280px) {
    .icon-picker-grid {
        grid-template-columns: repeat(12, minmax(0, 1fr));
    }
}
</style>
