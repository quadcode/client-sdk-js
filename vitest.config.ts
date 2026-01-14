import {defineConfig} from 'vitest/config'

export default defineConfig({
    define: {
        IS_BROWSER: false
    },
    test: {
        isolate: false,
        pool: 'threads',
        poolOptions: { threads: { minThreads: 1, maxThreads: 10 } },
        hookTimeout: 65000,
        testTimeout: 35000,
        include: ['./test/*.spec.{ts,js}'],
        setupFiles: ['./test/setup.ts'],
    },
})
