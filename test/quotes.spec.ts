import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {ClientSdk, Quotes} from "../src";
import {User, WS_URL} from "./vars";
import {getUserByTitle} from "./utils/userUtils";
import {getCurrentQuote} from "./utils/utils";
import {getOAuthMethod} from "./utils/authHelper";

describe('Quotes', () => {
    let sdk: ClientSdk;
    let quotes: Quotes;
    const user = getUserByTitle('regular_user') as User;

    beforeAll(async () => {
        const {oauth, options} = getOAuthMethod(user);
        sdk = await ClientSdk.create(WS_URL, 82, oauth, options)
        quotes = await sdk.quotes();
    })

    afterAll(async () => {
        await sdk.shutdown();
    });

    it('should be singleton object', async () => {
        const {oauth, options} = getOAuthMethod(user);
        sdk = await ClientSdk.create(WS_URL, 82, oauth, options)
        const [quotes1, quotes2] = await Promise.all([
            sdk.quotes(),
            sdk.quotes(),
        ]);
        expect(quotes1, "Quotes facade differ").eq(quotes2)
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