import {defineConfig} from 'vitest/config'

export default defineConfig({
    define: {
        IS_BROWSER: true
    },
    test: {
        testTimeout: 35000,
        browser: {
            provider: "webdriverio",
            headless: true,
            enabled: true,
            instances: [
                {
                    browser: 'chrome',
                }
            ],
        },
        include: ['./test/*.spec.{ts,js}'],
        exclude: ['./test/chart.mock.spec.ts'],
    }
})