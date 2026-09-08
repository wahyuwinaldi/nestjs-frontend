import Settings from '@/views/system/Settings.vue';
import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clickAllButtons, clickByText, interactFormControls, primeStubs, setupState } from '../../helpers/mount';

const listSettings = vi.fn();
const createSetting = vi.fn();
const updateSetting = vi.fn();
const deleteSetting = vi.fn();
const toastAdd = vi.fn();

vi.mock('@/composables/useSettingsApi', () => ({
    listSettings: (...a) => listSettings(...a),
    createSetting: (...a) => createSetting(...a),
    updateSetting: (...a) => updateSetting(...a),
    deleteSetting: (...a) => deleteSetting(...a)
}));
vi.mock('@/composables/usePermission', () => ({ hasMenuPermission: () => true }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: (o) => o.accept?.() }) }));

describe('Settings.vue', () => {
    beforeEach(() => {
        listSettings.mockReset().mockResolvedValue([
            { id_settings: '1', nm_settings: 'Logo', kode: 'logo', value: '/assets/logo.png' },
            { id_settings: 'ST009', nm_settings: 'UI Theme', kode: 'ui-theme', value: '{"primary":"emerald"}' }
        ]);
        createSetting.mockReset().mockResolvedValue({});
        updateSetting.mockReset().mockResolvedValue({});
        deleteSetting.mockReset().mockResolvedValue({});
        toastAdd.mockReset();
    });

    it('validates file and CRUD', async () => {
        const wrapper = mount(Settings, { global: { plugins: [[PrimeVue, {}]], stubs: primeStubs() } });
        await vi.waitFor(() => expect(listSettings).toHaveBeenCalled());
        const state = setupState(wrapper);
        expect(state.rows.every((r) => r.kode !== 'ui-theme')).toBe(true);
        await clickByText(wrapper, 'Muat Ulang');
        await clickByText(wrapper, 'Tambah');
        await clickByText(wrapper, 'Batal');
        expect(state.isImageUrl('/assets/logo.png')).toBe(true);
        expect(state.isImageUrl('')).toBe(false);
        expect(state.isImageUrl('/assets/logo.ico')).toBe(true);
        state.triggerFilePick();
        state.onFileSelected({ target: { files: [] } });
        const big = new File([new Uint8Array(6 * 1024 * 1024)], 'a.png', { type: 'image/png' });
        state.onFileSelected({ target: { files: [big] } });
        state.openPreview({ value: '/assets/logo.png', nm_settings: 'Logo' });
        expect(state.previewVisible).toBe(true);

        state.openCreate();
        await state.submitForm();
        expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.stringMatching(/Nama dan kode/i) }));
        state.form.nm_settings = 'Favicon';
        state.form.kode = 'favicon';
        await state.submitForm();
        expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.stringMatching(/File wajib/i) }));

        state.onFileSelected({ target: { files: [new File(['x'], 'a.txt', { type: 'text/plain' })] } });
        expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.stringMatching(/jpg/i) }));

        const okFile = new File(['x'], 'a.png', { type: 'image/png' });
        state.onFileSelected({ target: { files: [okFile] } });
        await state.submitForm();
        expect(createSetting).toHaveBeenCalled();

        state.openEdit({ id_settings: '1', nm_settings: 'Logo', kode: 'logo' });
        await state.submitForm();
        expect(updateSetting).toHaveBeenCalled();
        await state.askDelete({ id_settings: '1', nm_settings: 'Logo' });
        expect(deleteSetting).toHaveBeenCalledWith('1');
        createSetting.mockRejectedValueOnce(new Error('fail'));
        state.openCreate();
        state.form.nm_settings = 'X';
        state.form.kode = 'x';
        state.onFileSelected({ target: { files: [okFile] } });
        await state.submitForm();
        deleteSetting.mockRejectedValueOnce(new Error('fail'));
        await state.askDelete({ id_settings: '1', nm_settings: 'Logo' });
        state.openCreate();
        await wrapper.vm.$nextTick();
        await interactFormControls(wrapper);
        await clickAllButtons(wrapper);
        wrapper.unmount();
    });
});
