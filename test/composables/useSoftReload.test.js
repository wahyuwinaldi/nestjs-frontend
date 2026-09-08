import { useSoftReload } from '@/composables/useSoftReload';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';

function mountSoftReload(loadFn, options) {
    const Comp = defineComponent({
        setup() {
            return useSoftReload(loadFn, options);
        },
        template: '<div />'
    });
    return mount(Comp);
}

describe('useSoftReload', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-12T01:00:00Z'));
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('skips stale reload until staleMs elapsed, then force reload always runs', async () => {
        const loadFn = vi.fn().mockResolvedValue();
        const wrapper = mountSoftReload(loadFn, { staleMs: 45_000 });

        await wrapper.vm.reload();
        expect(loadFn).toHaveBeenCalledTimes(1);

        await wrapper.vm.reload();
        expect(loadFn).toHaveBeenCalledTimes(2);

        wrapper.vm.noteLoaded();
        vi.setSystemTime(Date.now() + 10_000);
        document.dispatchEvent(new Event('visibilitychange'));
        await Promise.resolve();
        expect(loadFn).toHaveBeenCalledTimes(2);

        vi.setSystemTime(Date.now() + 50_000);
        window.dispatchEvent(new Event('focus'));
        await Promise.resolve();
        expect(loadFn).toHaveBeenCalledTimes(3);

        wrapper.unmount();
    });

    it('does not run when disabled or already in flight', async () => {
        let release;
        const loadFn = vi.fn(
            () =>
                new Promise((resolve) => {
                    release = resolve;
                })
        );
        const wrapper = mountSoftReload(loadFn, { isEnabled: () => false });
        await wrapper.vm.reload();
        expect(loadFn).not.toHaveBeenCalled();
        wrapper.unmount();

        const wrapper2 = mountSoftReload(loadFn, { isEnabled: () => true });
        const first = wrapper2.vm.reload();
        const second = wrapper2.vm.reload();
        expect(loadFn).toHaveBeenCalledTimes(1);
        release();
        await Promise.all([first, second]);
        wrapper2.unmount();
    });

    it('ignores visibilitychange when tab is hidden', async () => {
        const loadFn = vi.fn().mockResolvedValue();
        const wrapper = mountSoftReload(loadFn);
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
        vi.setSystemTime(Date.now() + 60_000);
        document.dispatchEvent(new Event('visibilitychange'));
        await Promise.resolve();
        expect(loadFn).not.toHaveBeenCalled();
        wrapper.unmount();
    });
});
