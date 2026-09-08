import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

import { getPublicTheme } from '@/composables/useSettingsApi';
import { applyLayoutTheme } from '@/layout/composables/layout';
import { applyFullTheme, DEFAULT_UI_THEME, resolvePreset } from '@/utils/theme';
import PrimeVue from 'primevue/config';
import ConfirmationService from 'primevue/confirmationservice';
import ToastService from 'primevue/toastservice';
import 'remixicon/fonts/remixicon.css';

import '@/assets/tailwind.css';
import '@/assets/styles.scss';

async function loadBootTheme() {
    try {
        const theme = await getPublicTheme();
        return applyLayoutTheme(theme || DEFAULT_UI_THEME);
    } catch {
        return applyLayoutTheme(DEFAULT_UI_THEME);
    }
}

async function bootstrap() {
    const theme = await loadBootTheme();
    const app = createApp(App);

    app.use(router);
    app.use(PrimeVue, {
        theme: {
            preset: resolvePreset(theme.preset),
            options: {
                darkModeSelector: '.app-dark'
            }
        },
        locale: {
            dayNames: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
            dayNamesShort: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
            dayNamesMin: ['Mg', 'Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb'],
            monthNames: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
            monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
            today: 'Hari ini',
            clear: 'Bersihkan',
            firstDayOfWeek: 1,
            dateFormat: 'dd MM yy',
            emptyMessage: 'Tidak ada data.',
            emptyFilterMessage: 'Tidak ada data.',
            emptySearchMessage: 'Tidak ada data.'
        }
    });
    app.use(ToastService);
    app.use(ConfirmationService);

    applyFullTheme(theme);
    app.mount('#app');
}

bootstrap();
