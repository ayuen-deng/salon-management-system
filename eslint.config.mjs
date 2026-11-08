import tsParser from '@typescript-eslint/parser';
import nextPlugin from '@next/eslint-plugin-next';

export default [
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
    plugins: { '@next/next': nextPlugin },
    rules: { '@next/next/no-html-link-for-pages': 'off' },
    rules: {
      'no-restricted-globals': ['error', { name: 'alert', message: 'Use the shared toast.' }, { name: 'confirm', message: 'Use the shared confirm dialog.' }, { name: 'prompt', message: 'Use the shared dialog.' }],
      'no-restricted-properties': ['error',
        { object: 'window', property: 'alert', message: 'Use the shared toast.' },
        { object: 'window', property: 'confirm', message: 'Use the shared confirm dialog.' },
        { object: 'window', property: 'prompt', message: 'Use the shared dialog.' },
      ],
    },
  },
];
