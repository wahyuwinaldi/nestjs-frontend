import { fileURLToPath, URL } from 'node:url';

import { PrimeVueResolver } from '@primevue/auto-import-resolver';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
    optimizeDeps: {
        noDiscovery: true,
        include: ['sortablejs']
    },
    plugins: [
        vue({
            template: {
                transformAssetUrls: {
                    includeAbsolute: false
                }
            }
        }),
        tailwindcss(),
        Components({
            resolvers: [PrimeVueResolver()]
        })
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            // vuedraggable package entry adalah UMD tanpa default ESM export
            vuedraggable: fileURLToPath(new URL('./node_modules/vuedraggable/src/vuedraggable.js', import.meta.url))
        }
    },
    css: {
        preprocessorOptions: {
            scss: {
                api: 'modern-compiler'
            }
        }
    },
    // Dev: VITE_API_BASE_URL=/api → proxy ke Nest (prefix /api di-strip).
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, '')
            }
        }
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['test/setup.js'],
        include: ['test/**/*.test.js'],
        coverage: {
            provider: 'istanbul',
            reporter: ['text', 'html', 'lcov'],
            reportsDirectory: './coverage',
            include: ['src/**/*.{js,vue}'],
            exclude: ['src/main.js'],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 80,
                statements: 80
            }
        }
    }
});
