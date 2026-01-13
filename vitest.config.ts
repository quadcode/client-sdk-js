import {defineConfig} from 'vitest/config'

export default defineConfig({
    define: {
        IS_BROWSER: false
    },
    test: {
        pool: 'threads',
        maxWorkers: 1,
        hookTimeout: 65000,
        testTimeout: 35000,
        include: ['./test/*.spec.{ts,js}'],
        setupFiles: ['./test/setup.ts'],
    },
})
