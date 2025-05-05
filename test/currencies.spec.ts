import {ClientSdk, LoginPasswordAuthMethod} from "../src";
import {getUserByTitle} from "./utils/userUtils";
import {API_URL, BASE_HOST, User, WS_URL} from "./vars";
import {afterAll, beforeAll, describe, expect, it} from "vitest";

describe('Currencies', () => {
    let sdk: ClientSdk

    beforeAll(async () => {
        const user = getUserByTitle('regular_user') as User
        const options = IS_BROWSER ? {host: BASE_HOST} : undefined;
        sdk = await ClientSdk.create(WS_URL, 82, new LoginPasswordAuthMethod(API_URL, user.email, user.password), options)
    });

    afterAll(async function () {
        await sdk.shutdown();
    });

    it(`should currency present `, async () => {
        const currencies = await sdk.currencies()
        const brl = await currencies.getCurrency("BRL");
        expect(brl.id, "invalid currency id").eq(6)
        expect(brl.name, "invalid currency name").eq("BRL")
        expect(brl.symbol, "invalid currency symbol").eq("R$")
        expect(brl.imageUrl, "invalid currencies array").contains("https://")
        expect(brl.minorUnits, "invalid currencies minor units").eq(2)
    });
});