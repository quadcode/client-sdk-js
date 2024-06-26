import {defineConfig} from 'vitest/config'

export default defineConfig({
    define: {
        IS_BROWSER: true
    },
    test: {
        browser: {
            provider: "webdriverio",
            name: "chrome",
            enabled: true,
            headless: true,
        },
        include: ['./test/*.spec.{ts,js}'],
    },
})