module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  extends: ['../.eslintrc.js'],
  rules: {
    // Backend-specific overrides
    'no-console': 'off', // Logger is used via @nestjs/common
  },
  overrides: [
    {
      // Test files are excluded from tsconfig.json, so disable type-checked rules
      files: ['test/**/*.ts', '**/*.spec.ts', '**/*.e2e-spec.ts'],
      parserOptions: {
        project: null,
      },
      rules: {
        '@typescript-eslint/prefer-nullish-coalescing': 'off',
        '@typescript-eslint/prefer-optional-chain': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
      },
    },
  ],
};
