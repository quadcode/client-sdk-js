import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {Candles, ClientSdk, LoginPasswordAuthMethod} from "../src";
import {API_URL, BASE_HOST, User, WS_URL} from "./vars";
import {getUserByTitle} from "./utils/userUtils";

describe('Candles', () => {
    let sdk: ClientSdk;
    let candles: Candles;
    const user = getUserByTitle('regular_user') as User;

    beforeAll(async () => {
        const options = IS_BROWSER ? {host: BASE_HOST} : undefined;
        sdk = await ClientSdk.create(WS_URL, 82, new LoginPasswordAuthMethod(API_URL, user.email, user.password), options);
        candles = await sdk.candles();
    })

    afterAll(async () => {
        await sdk.shutdown();
    });

    it('should return candles', async () => {
        const binaryOptions = await sdk.binaryOptions();
        const binaryOptionsActives = binaryOptions.getActives();
        const binaryOptionsActive = binaryOptionsActives[0];
        const activeId = binaryOptionsActive.id;
        const size = 5;
        const candleArray = await candles.getCandles(activeId, size);
        expect(candleArray.length, "Invalid candle array length").to.be.above(0)
        const candle = candleArray[Math.trunc(candleArray.length / 2)];
        expect(candle.to - candle.from, "Invalid candle size").eq(size)
    });

    it('should return candles by filter', async () => {
        const binaryOptions = await sdk.binaryOptions();
        const binaryOptionsActives = binaryOptions.getActives();
        const binaryOptionsActive = binaryOptionsActives[0];
        const activeId = binaryOptionsActive.id;
        const size = 15;
        const from = Math.floor(Date.now() / 1000) - 5 * 60; // minus 35 minutes in seconds
        const candleArray = await candles.getCandles(activeId, size, {
            count: 3,
            from: from,
            onlyClosed: true,
            kind: "mid",
            backoff: 10,
            splitNormalization: true
        });
        expect(candleArray.length, "Invalid candle array length").eq(3)
        expect(candleArray[0].from, "Invalid first candle From time").eq(Math.ceil(from / size) * size)
        const candle = candleArray[Math.trunc(candleArray.length / 2)];
        expect(candle.to - candle.from, "Invalid candle size").eq(size)
        expect(candle.at, "At must be undefined").to.be.undefined
    });
})