import {defineConfig} from 'vitest/config'

export default defineConfig({
    define: {
        hookTimeout: 600000,
        IS_BROWSER: false
    },
    test: {
        hookTimeout: 65000,
        testTimeout: 35000,
        include: ['./test/*.spec.{ts,js}'],
    },
})