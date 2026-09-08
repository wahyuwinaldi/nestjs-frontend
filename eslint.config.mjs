import js from '@eslint/js';
import prettierConfig from '@vue/eslint-config-prettier';
import pluginVue from 'eslint-plugin-vue';
import flatGitignore from 'eslint-config-flat-gitignore';
import globals from 'globals';

export default [
    flatGitignore(),
    {
        ignores: ['dist/**', 'coverage/**', 'public/**']
    },
    js.configs.recommended,
    ...pluginVue.configs['flat/essential'],
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node
            }
        },
        rules: {
            'vue/multi-word-component-names': 'off',
            'vue/no-reserved-component-names': 'off',
            'vue/block-order': [
                'error',
                {
                    order: ['script', 'template', 'style']
                }
            ]
        }
    },
    {
        files: ['test/**/*.{js,mjs,cjs}', '**/*.{test,spec}.{js,mjs,cjs}'],
        languageOptions: {
            globals: {
                ...globals.vitest
            }
        }
    },
    prettierConfig
];
