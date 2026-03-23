import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Enforce no console.log in production (use structured logger instead)
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Prevent accidental secrets in code
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/password|secret|api_key/i]',
          message: 'Potential hardcoded secret detected. Use environment variables.',
        },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'],
  }
);
