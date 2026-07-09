import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "src/tests/**", "src/**/__tests__/**", "src/**/*.test.ts", "src/**/*.js"],
  },
  {
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
      // Complexity rule temporarily disabled - ongoing refactor
      // "complexity": ["error", 10],
      "max-depth": ["warn", 3],
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      '@typescript-eslint/no-explicit-any': 'off',
      "@typescript-eslint/consistent-type-imports": 'off',
      "@typescript-eslint/no-unsafe-argument": 'off',
      "@typescript-eslint/no-unsafe-member-access": 'off',
      "@typescript-eslint/no-unsafe-assignment": 'off',
      "@typescript-eslint/no-unsafe-call": 'off',
      "@typescript-eslint/no-unsafe-return": 'off',
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/await-thenable": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "no-unreachable": "error",
      "no-unused-labels": "error",
      "no-constant-condition": "error",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-base-to-string": "off",
    },
  }
);
