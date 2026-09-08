<script setup>
import { ensureSakaiMenuShape, getMenu } from '@/composables/useSession';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import AppMenuItem from './AppMenuItem.vue';

const fallbackModel = [
    {
        label: 'MAIN MENU',
        items: [
            {
                label: 'Dashboard',
                icon: 'pi pi-fw pi-home',
                to: '/'
            }
        ]
    }
];

const menuTick = ref(0);

const model = computed(() => {
    menuTick.value;
    const stored = ensureSakaiMenuShape(getMenu());
    return stored && stored.length > 0 ? stored : fallbackModel;
});

function onMenuUpdated() {
    menuTick.value += 1;
}

onMounted(() => {
    globalThis.addEventListener('menu-updated', onMenuUpdated);
});

onUnmounted(() => {
    globalThis.removeEventListener('menu-updated', onMenuUpdated);
});
</script>

<template>
    <ul class="layout-menu">
        <template v-for="(item, i) in model" :key="item.label + '_' + i">
            <app-menu-item v-if="!item.separator" :item="item" :index="i"></app-menu-item>
            <li v-if="item.separator" class="menu-separator"></li>
        </template>
    </ul>
</template>

<style lang="scss" scoped></style>
