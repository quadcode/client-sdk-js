import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {ClientSdk, LoginPasswordAuthMethod, Quotes} from "../src";
import {API_URL, BASE_HOST, User, WS_URL} from "./vars";
import {getUserByTitle} from "./utils/userUtils";
import {getCurrentQuote} from "./utils/utils";

describe('Quotes', () => {
    let sdk: ClientSdk;
    let quotes: Quotes;
    const user = getUserByTitle('regular_user') as User;

    beforeAll(async () => {
        const options = IS_BROWSER ? {host: BASE_HOST} : undefined;
        sdk = await ClientSdk.create(WS_URL, 82, new LoginPasswordAuthMethod(API_URL, user.email, user.password), options);
        quotes = await sdk.quotes();
    })

    afterAll(async () => {
        await sdk.shutdown();
    });

    it('should return current quote', async () => {
        const binaryOptions = await sdk.binaryOptions();
        const binaryOptionsActives = binaryOptions.getActives();
        const binaryOptionsActive = binaryOptionsActives[0];
        const activeId = binaryOptionsActive.id;
        const currentQuote = await getCurrentQuote(quotes, activeId);
        if (currentQuote.time) {
            expect(Math.abs(currentQuote.time.getTime() - Date.now()), "Invalid quote current time").toBeLessThanOrEqual(1000); // +-1 sec
        } else {
            throw new Error('currentQuote.time is undefined');
        }
    });
})