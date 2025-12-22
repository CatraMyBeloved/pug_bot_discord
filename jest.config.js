module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',

    testMatch: [
        '**/tests/**/*.test.ts'
    ],

    moduleFileExtensions: ['ts', 'js', 'json'],

    transform: {
        '^.+\\.ts$': ['ts-jest', {
            tsconfig: {
                strict: true,
                esModuleInterop: true,
                skipLibCheck: true,
            }
        }],
        '^.+\\.js$': 'babel-jest',
    },
    transformIgnorePatterns: [
        'node_modules/(?!(ts-trueskill|ts-gaussian)/)'
    ],

    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/index.ts',
        '!src/deploy-commands.ts',
        '!src/commands/**',
        '!src/services/scheduler.ts',
        '!src/wizard/**',
        '!src/handlers/**',
        '!src/database/init.ts',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],

    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
        },
        './src/utils/algorithms/': {
            // High-quality thresholds accounting for TypeScript instrumentation edge cases
            // These enforce rigorous testing while allowing for source map artifacts
            branches: 88,
            functions: 94,
            lines: 94,
            statements: 94,
        }
    },

    testTimeout: 10000,

    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

    clearMocks: true,

    verbose: true,
};
