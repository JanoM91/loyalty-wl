import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/coverage/**',
      // Experimentos de la Fase 0: evidencia, no código del producto.
      'docs/**',
      // Generado por Next.js en cada build. No se edita a mano.
      '**/next-env.d.ts',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Scripts de Node: usan los globales de Node y escriben en la terminal.
    files: ['**/scripts/**/*.mjs', '**/*.config.mjs', 'tests/e2e/**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', WebAssembly: 'readonly' },
    },
    rules: { 'no-console': 'off' },
  },
  {
    // packages/domain no debe importar frameworks ni SDKs.
    // Las reglas de negocio se prueban sin base ni servidor.
    files: ['packages/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['next', 'next/*', 'react', 'react-*', '@prisma/*', '@vercel/*'],
              message:
                'packages/domain debe permanecer puro: sin dependencias de framework, ORM ni SDKs.',
            },
          ],
        },
      ],
    },
  },
);
