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
        }]
    },

    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/index.ts',
        '!src/deploy-commands.ts',
        '!src/commands/**',
        '!src/services/scheduler.ts',
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
            branches: 100,
            functions: 100,
            lines: 100,
            statements: 100,
        }
    },

    testTimeout: 10000,

    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

    clearMocks: true,

    verbose: true,
};
