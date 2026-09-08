<script setup>
import { saveTheme } from '@/composables/useSettingsApi';
import { applyLayoutTheme, getLayoutThemeSnapshot, useLayout } from '@/layout/composables/layout';
import { applyFullTheme, applyThemePart, PRIMARY_COLORS, PRESET_OPTIONS, SURFACE_COLORS } from '@/utils/theme';
import { useToast } from 'primevue/usetoast';
import { computed, ref } from 'vue';

const { layoutConfig, isDarkTheme, changeMenuMode } = useLayout();
const toast = useToast();

const preset = ref(layoutConfig.preset);
const presetOptions = ref(PRESET_OPTIONS);

const menuMode = ref(layoutConfig.menuMode);
const menuModeOptions = ref([
    { label: 'Static', value: 'static' },
    { label: 'Overlay', value: 'overlay' }
]);

const primaryColors = ref(PRIMARY_COLORS);
const surfaces = ref(SURFACE_COLORS);

const savedSnapshot = ref(getLayoutThemeSnapshot());
const saving = ref(false);

const currentTheme = computed(() => ({
    primary: layoutConfig.primary,
    surface: layoutConfig.surface,
    preset: layoutConfig.preset,
    menuMode: layoutConfig.menuMode
}));

const isDirty = computed(() => {
    const a = currentTheme.value;
    const b = savedSnapshot.value;
    return a.primary !== b.primary || a.surface !== b.surface || a.preset !== b.preset || a.menuMode !== b.menuMode;
});

function updateColors(type, color) {
    if (type === 'primary') {
        layoutConfig.primary = color.name;
    } else if (type === 'surface') {
        layoutConfig.surface = color.name;
    }
    applyThemePart(type, color, layoutConfig.primary);
}

function onPresetChange() {
    layoutConfig.preset = preset.value;
    applyFullTheme({
        primary: layoutConfig.primary,
        surface: layoutConfig.surface,
        preset: layoutConfig.preset
    });
}

function onMenuModeChange(event) {
    changeMenuMode(event);
    menuMode.value = layoutConfig.menuMode;
}

function cancelTheme() {
    const restored = applyLayoutTheme(savedSnapshot.value);
    preset.value = restored.preset;
    menuMode.value = restored.menuMode;
    applyFullTheme(restored);
}

async function saveThemeChanges() {
    if (!isDirty.value || saving.value) return;
    saving.value = true;
    try {
        const payload = { ...currentTheme.value };
        const saved = await saveTheme(payload);
        const normalized = applyLayoutTheme(saved || payload);
        savedSnapshot.value = { ...normalized };
        preset.value = normalized.preset;
        menuMode.value = normalized.menuMode;
        applyFullTheme(normalized);
        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Tema UI disimpan', life: 2500 });
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message || 'Gagal menyimpan tema', life: 4000 });
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <div
        class="config-panel hidden absolute top-[3.25rem] right-0 w-72 p-4 bg-surface-0 dark:bg-surface-900 border border-surface rounded-border origin-top shadow-[0px_3px_5px_rgba(0,0,0,0.02),0px_0px_2px_rgba(0,0,0,0.05),0px_1px_4px_rgba(0,0,0,0.08)]"
    >
        <div class="flex flex-col gap-4">
            <div>
                <span class="text-sm text-muted-color font-semibold">Primary</span>
                <div class="pt-2 flex gap-2 flex-wrap justify-between">
                    <button
                        v-for="primaryColor of primaryColors"
                        :key="primaryColor.name"
                        type="button"
                        :title="primaryColor.name"
                        @click="updateColors('primary', primaryColor)"
                        :class="['border-none w-5 h-5 rounded-full p-0 cursor-pointer outline-none outline-offset-1', { 'outline-primary': layoutConfig.primary === primaryColor.name }]"
                        :style="{ backgroundColor: `${primaryColor.name === 'noir' ? 'var(--text-color)' : primaryColor.palette['500']}` }"
                    ></button>
                </div>
            </div>
            <div>
                <span class="text-sm text-muted-color font-semibold">Surface</span>
                <div class="pt-2 flex gap-2 flex-wrap justify-between">
                    <button
                        v-for="surface of surfaces"
                        :key="surface.name"
                        type="button"
                        :title="surface.name"
                        @click="updateColors('surface', surface)"
                        :class="[
                            'border-none w-5 h-5 rounded-full p-0 cursor-pointer outline-none outline-offset-1',
                            { 'outline-primary': layoutConfig.surface ? layoutConfig.surface === surface.name : isDarkTheme ? surface.name === 'zinc' : surface.name === 'slate' }
                        ]"
                        :style="{ backgroundColor: `${surface.palette['500']}` }"
                    ></button>
                </div>
            </div>
            <div class="flex flex-col gap-2">
                <span class="text-sm text-muted-color font-semibold">Presets</span>
                <SelectButton v-model="preset" @change="onPresetChange" :options="presetOptions" :allowEmpty="false" />
            </div>
            <div class="flex flex-col gap-2">
                <span class="text-sm text-muted-color font-semibold">Menu Mode</span>
                <SelectButton v-model="menuMode" @change="onMenuModeChange" :options="menuModeOptions" :allowEmpty="false" optionLabel="label" optionValue="value" />
            </div>
            <div class="flex gap-2 justify-end pt-1">
                <Button type="button" label="Batal" severity="secondary" size="small" outlined :disabled="!isDirty || saving" @click="cancelTheme" />
                <Button type="button" label="Simpan" size="small" :loading="saving" :disabled="!isDirty || saving" @click="saveThemeChanges" />
            </div>
        </div>
    </div>
</template>
