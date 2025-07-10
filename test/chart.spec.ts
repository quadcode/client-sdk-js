import {ClientSdk, LoginPasswordAuthMethod} from "../src";
import {getUserByTitle} from "./utils/userUtils";
import {API_URL, BASE_HOST, User, WS_URL} from "./vars";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {justWait, waitForCondition} from "./utils/waiters";

describe('Chart Data', () => {
    let sdk: ClientSdk
    const ONE_DAY_S = 24 * 60 * 60;

    beforeAll(async () => {
        const user = getUserByTitle('regular_user') as User
        const options = IS_BROWSER ? {host: BASE_HOST} : undefined;
        sdk = await ClientSdk.create(WS_URL, 82, new LoginPasswordAuthMethod(API_URL, user.email, user.password), options)
    });

    afterAll(async function () {
        await sdk.shutdown();
    });

    it(`Fetch should return 1000 candles if from to far`, async () => {
        const chartDataLayer = await sdk.realTimeChartDataLayer(1, 1)
        const now = Math.floor(Date.now() / 1000)
        await chartDataLayer.fetchAllCandles(now)
        await chartDataLayer.fetchAllCandles(now - ONE_DAY_S)
        const candles = await chartDataLayer.fetchAllCandles(now - ONE_DAY_S)
        expect(candles.length, "length must be equal 1000").eq(1000)
    });

    it(`Fetch should load more candles`, async () => {
        const chartDataLayer = await sdk.realTimeChartDataLayer(1, 60)
        const now = Math.floor(Date.now() / 1000)
        await chartDataLayer.fetchAllCandles(now - ONE_DAY_S)
        let candles = await chartDataLayer.fetchAllCandles(now - ONE_DAY_S - 60 * 2)
        expect(candles.length, "length must be equal 1000").eq(1002)
        const from = now - ONE_DAY_S - 60 * 100
        candles = await chartDataLayer.fetchAllCandles(from)
        expect(candles.length, "length must be equal 1000").eq(1100)
        const nextMinuteStart = Math.ceil(from / 60) * 60
        expect(candles[0].from, "first candle in array should be later or equals 'from'").eq(nextMinuteStart)
    });

    it(`Candles should start from first candle`, async () => {
        const chartDataLayer = await sdk.realTimeChartDataLayer(1, 3600)
        const date = new Date(Date.UTC(2013, 10, 11))
        const unixSec = Math.floor(date.getTime() / 1000);
        const candles = await chartDataLayer.fetchAllCandles(unixSec - ONE_DAY_S);
        expect(candles[0].from, "first candle should be equals real first candle for asset").eq(unixSec)
    });

    it(`should subscribe on next candle`, async () => {
        const chartDataLayer = await sdk.realTimeChartDataLayer(1, 1)
        let at: number | undefined;
        chartDataLayer.subscribeOnLastCandleChanged(candle => at = candle.at)
        await waitForCondition(() => at != undefined)
        let current = at
        for (let i = 0; i < 5; i++) {
            await justWait(1100)
            expect(at).not.eq(current)
            current = at;
        }
    });
});