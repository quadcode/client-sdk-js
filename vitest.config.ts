import {defineConfig} from 'vitest/config'

export default defineConfig({
    define: {
        IS_BROWSER: false
    },
    test: {
        testTimeout: 7000,
        include: ['./test/*.spec.{ts,js}'],
    },
})