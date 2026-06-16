import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
        coverage: {
            reporter: ['text', 'json', 'html'],
            thresholds: {
                global: {
                    statements: 80,
                    branches: 60,
                    functions: 80,
                    lines: 80,
                },
            },
        },
    },
});
