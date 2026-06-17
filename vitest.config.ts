import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
        coverage: {
            reporter: ['text', 'json', 'html'],
            exclude: [
                'src/tests/**',
                'src/tools/extensions/git/tools/**',
                'src/tools/session/handoff.ts',
                'src/tools/session/operations/handoff.ts',
            ],
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
