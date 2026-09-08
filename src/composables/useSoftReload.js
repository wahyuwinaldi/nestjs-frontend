import { onMounted, onUnmounted } from 'vue';

/**
 * Muat ulang manual + soft reload saat tab kembali fokus/visible.
 * Tidak polling berkala — hanya refetch jika data sudah stale.
 *
 * @param {() => Promise<void>|void} loadFn
 * @param {{ staleMs?: number, isEnabled?: () => boolean }} [options]
 */
export function useSoftReload(loadFn, options = {}) {
    const staleMs = options.staleMs ?? 45_000;
    const isEnabled = options.isEnabled ?? (() => true);

    let lastAt = 0;
    let inFlight = false;

    async function run(force = false) {
        if (inFlight) return;
        if (!isEnabled()) return;
        if (!force && lastAt > 0 && Date.now() - lastAt < staleMs) return;

        inFlight = true;
        try {
            await loadFn();
            lastAt = Date.now();
        } finally {
            inFlight = false;
        }
    }

    function onVisibilityChange() {
        if (document.visibilityState === 'visible') {
            run(false);
        }
    }

    function onWindowFocus() {
        run(false);
    }

    onMounted(() => {
        // Anggap data awal akan di-load oleh halaman; tandai waktu agar soft reload tidak langsung dobel.
        lastAt = Date.now();
        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('focus', onWindowFocus);
    });

    onUnmounted(() => {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('focus', onWindowFocus);
    });

    return {
        /** Paksa muat ulang (tombol Muat Ulang). */
        reload: () => run(true),
        /** Panggil setelah load sukses di luar composable bila perlu. */
        noteLoaded: () => {
            lastAt = Date.now();
        }
    };
}
