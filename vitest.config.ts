import {defineConfig} from 'vitest/config'

export default defineConfig({
    define: {
        IS_BROWSER: false
    },
    test: {
        include: ['./test/*.spec.{ts,js}'],
    },
})