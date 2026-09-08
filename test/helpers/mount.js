import PrimeVue from 'primevue/config';
import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { vi } from 'vitest';

/** Binding `<script setup>`; ref sudah di-unwrap (jangan pakai `.value`). */
export function setupState(wrapper) {
    return wrapper.vm.$.setupState;
}

export function primeStubs(extra = {}) {
    return {
        Button: { inheritAttrs: false, template: '<button type="button" v-bind="$attrs"><slot />{{ $attrs.label }}</button>' },
        InputText: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
        },
        Password: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<input type="password" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
        },
        DataTable: {
            props: ['value'],
            template: '<div class="datatable"><slot name="header" /><slot /><slot name="empty" /></div>'
        },
        Column: {
            inheritAttrs: false,
            template: '<div class="column"><slot name="header" /><slot name="body" :data="dummy" :index="0" /><slot name="body" :data="dummyAlt" :index="1" /><slot name="body" :data="dummyFail" :index="2" /><slot /></div>',
            setup() {
                const dummy = {
                    id: 1,
                    name: 'Upload',
                    action: 'upload',
                    is_deleted: false,
                    uid_user_system: 'u1',
                    username: 'admin',
                    nama: 'Admin',
                    kd_role: 'R1',
                    nm_role: 'Admin',
                    status_user: 'A',
                    kd_action: '1',
                    kode: 'AC',
                    nm_action: 'Access',
                    menus: [],
                    id_settings: '1',
                    nm_settings: 'Logo',
                    value: '/assets/logo.png',
                    kd_menu: 'MN_D',
                    nm_menu: 'Dash',
                    status: 'A',
                    icon_menu: 'home',
                    link_menu: '/',
                    title: 'Banner',
                    client_id: 'c1',
                    permissions: [{ action: ['AC'] }],
                    convert_status: 'done',
                    convert_label: 'done',
                    detail: 'a.webp',
                    type_label: 'Upload',
                    description: 'desc',
                    duration: 8,
                    username_requester: 'admin',
                    id_requester: 'u1'
                };
                return {
                    dummy,
                    dummyAlt: {
                        ...dummy,
                        id: 2,
                        name: 'Link',
                        action: 'link',
                        is_deleted: true,
                        uid_user_system: 'u2',
                        username: 'ops',
                        kd_role: 'RS001',
                        nm_role: 'Super',
                        status_user: 'N',
                        kd_action: '2',
                        kode: 'IN',
                        nm_action: 'Insert',
                        menus: ['M1'],
                        id_settings: '2',
                        nm_settings: 'Fav',
                        value: '',
                        kd_menu: 'MN_G',
                        nm_menu: 'Grand',
                        status: 'Q',
                        icon_menu: '',
                        link_menu: '',
                        title: 'Queue',
                        client_id: 'c2',
                        permissions: [],
                        convert_status: 'pending',
                        convert_progress: 40,
                        convert_label: 'pending',
                        detail: 'b.webm',
                        type_label: 'Upload',
                        description: 'queue',
                        duration: null,
                        username_requester: 'ops',
                        id_requester: 'u2'
                    },
                    dummyFail: {
                        ...dummy,
                        id: 3,
                        status: 'E',
                        convert_status: 'failed',
                        convert_label: 'failed',
                        title: 'Expired',
                        detail: 'c.webm',
                        end_date: '2020-01-01',
                        username_pic: 'pic',
                        nm_pic: 'Pic',
                        id_pic: 'p1',
                        status_user: 'N',
                        is_deleted: false
                    }
                };
            }
        },
        Dialog: {
            props: ['visible'],
            emits: ['update:visible', 'maximize', 'unmaximize', 'hide'],
            template: `<div v-if="visible !== false" class="dialog">
                <button type="button" class="dialog-maximize" @click="$emit('maximize')">max</button>
                <button type="button" class="dialog-unmaximize" @click="$emit('unmaximize')">unmax</button>
                <button type="button" class="dialog-hide" @click="$emit('hide'); $emit('update:visible', false)">hide</button>
                <slot /><slot name="footer" />
            </div>`
        },
        Tag: { props: ['value'], template: '<span class="tag-stub">{{ value }}<slot /></span>' },
        Select: {
            props: ['modelValue', 'options'],
            emits: ['update:modelValue'],
            template: `<div class="select-stub">
                <button v-for="(opt, i) in (options || [])" :key="i" type="button"
                    @click="$emit('update:modelValue', typeof opt === 'object' ? (opt.value ?? opt.kd_role ?? opt) : opt)">
                    {{ typeof opt === 'object' ? (opt.label || opt.name || opt.value) : opt }}
                </button>
            </div>`
        },
        SelectButton: {
            props: ['modelValue', 'options'],
            emits: ['update:modelValue', 'change'],
            template: `<div class="selectbutton-stub">
                <button v-for="opt in (options || [])" :key="String(typeof opt === 'object' ? opt.value : opt)" type="button"
                    @click="$emit('update:modelValue', typeof opt === 'object' ? opt.value : opt); $emit('change', { value: typeof opt === 'object' ? opt.value : opt })">
                    {{ typeof opt === 'object' ? (opt.label || opt.value) : opt }}
                </button>
            </div>`
        },
        Toast: { template: '<div />' },
        ConfirmDialog: { template: '<div />' },
        Message: { template: '<div class="message"><slot /></div>' },
        Checkbox: {
            props: ['modelValue', 'binary', 'indeterminate'],
            emits: ['update:modelValue', 'click'],
            template: '<input type="checkbox" :checked="!!modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" @click="$emit(\'click\', $event)" />'
        },
        IconField: { template: '<div><slot /></div>' },
        InputIcon: { template: '<i />' },
        Menu: {
            setup(_, { expose }) {
                const toggle = () => {};
                expose({ toggle });
                return { toggle };
            },
            template: '<div class="p-menu-stub"></div>'
        },
        FileUpload: { template: '<div />' },
        Textarea: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
        },
        InputNumber: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<input type="number" :value="modelValue" @input="$emit(\'update:modelValue\', Number($event.target.value))" />'
        },
        Calendar: { template: '<input />' },
        DatePicker: { template: '<input class="datepicker-stub" />' },
        MultiSelect: {
            props: ['modelValue', 'options'],
            emits: ['update:modelValue', 'hide'],
            template: `<div class="multiselect-stub" @click="$emit('hide')">
                <slot name="header" />
                <div v-for="(option, i) in (options || [])" :key="i" @click.stop="$emit('update:modelValue', [typeof option === 'object' ? (option.value ?? option.kd_action ?? option) : option])">
                    <slot name="option" :option="option" />
                </div>
            </div>`
        },
        RadioButton: { template: '<input type="radio" />' },
        ToggleSwitch: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<input type="checkbox" :checked="!!modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />'
        },
        InputSwitch: { template: '<input type="checkbox" />' },
        Badge: { template: '<span />' },
        ProgressBar: { template: '<div />' },
        ProgressSpinner: { template: '<div class="spinner" />' },
        Skeleton: { template: '<div />' },
        Paginator: { template: '<div />' },
        Toolbar: { template: '<div><slot /><slot name="start" /><slot name="end" /></div>' },
        FloatingConfigurator: { template: '<div class="floating-config" />' },
        AppConfigurator: { template: '<div class="app-config" />' },
        draggable: {
            props: ['modelValue', 'itemKey', 'group', 'move'],
            emits: ['update:modelValue', 'change'],
            template: `<div class="draggable-stub" @click="$emit('change', { moved: true })">
                <div v-for="(element, index) in (modelValue || [])" :key="(element && itemKey && element[itemKey]) || index">
                    <slot name="item" :element="element" :index="index" />
                </div>
                <slot />
            </div>`
        },
        ...extra
    };
}

export async function interactFormControls(wrapper) {
    for (const input of wrapper.findAll('input, textarea')) {
        const type = String(input.attributes('type') || 'text').toLowerCase();
        if (type === 'file') continue;
        if (type === 'checkbox' || type === 'radio') {
            try {
                await input.setValue(true);
            } catch {
                await input.trigger('click');
            }
            continue;
        }
        try {
            await input.setValue(type === 'number' ? 8 : 'x');
        } catch {
            /* readonly / disabled */
        }
    }
    for (const btn of wrapper.findAll('.select-stub button, .selectbutton-stub button')) {
        await btn.trigger('click');
    }
    for (const ms of wrapper.findAll('.multiselect-stub')) {
        for (const opt of ms.findAll(':scope > div')) {
            await opt.trigger('click');
        }
        await ms.trigger('click');
    }
}

export async function clickByText(wrapper, text) {
    const btn = wrapper.findAll('button').find((el) => el.text().includes(text));
    if (btn) await btn.trigger('click');
    return btn;
}

export async function clickAllButtons(wrapper) {
    for (const btn of wrapper.findAll('button')) {
        await btn.trigger('click');
    }
}

export function mockToast() {
    return { add: vi.fn() };
}

export function mockConfirm() {
    return {
        require: vi.fn((opts) => {
            if (typeof opts?.accept === 'function') return opts.accept();
        })
    };
}

export async function mountWithApp(component, { routes, stubs, provide, props } = {}) {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: routes || [
            { path: '/', component: { template: '<div />' } },
            { path: '/auth/login', component: { template: '<div />' } },
            { path: '/auth/logout', component: { template: '<div />' } },
            { path: '/auth/access', component: { template: '<div />' } },
            { path: '/account/password', component: component }
        ]
    });
    await router.push(routes?.[0]?.path || '/');
    await router.isReady();

    return mount(component, {
        props,
        global: {
            plugins: [router, [PrimeVue, {}]],
            stubs: primeStubs(stubs),
            provide
        }
    });
}
