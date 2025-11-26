import {ClientSdk, LoginPasswordAuthMethod, SsidAuthMethod} from "../src";
import {API_URL, BASE_URL, User, WS_URL} from "./vars";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {getUserByTitle} from "./utils/userUtils";
import {getOAuthMethod} from "./utils/authHelper";

describe('Authentication with login and password', () => {
    let sdk: ClientSdk;
    const user = getUserByTitle("regular_user") as User;

    beforeAll(async () => {
        const options = IS_BROWSER ? {host: BASE_URL} : undefined;
        sdk = await ClientSdk.create(WS_URL, 82, new LoginPasswordAuthMethod(API_URL, user.email, user.password), options);
    })

    afterAll(async function () {
        await sdk.shutdown();
    });

    it('should authenticate user with valid credentials', async () => {
        const balances = (await sdk.balances()).getBalances();
        expect(balances.length, "Invalid balances count").to.be.above(0);
    });

    it('should not authenticate user with invalid credentials', async () => {
        await expect(ClientSdk.create(
            WS_URL,
            82,
            new LoginPasswordAuthMethod(API_URL, user.email, "invalid_password"))).rejects.toThrow("authentication is failed")
    });
});

describe('Authentication with ssid', () => {

    it('should not authenticate user with invalid ssid', async () => {
        const options = IS_BROWSER ? {host: BASE_URL} : undefined;
        await expect(ClientSdk.create(
            WS_URL,
            82,
            new SsidAuthMethod("invalid_ssid"), options)).rejects.toThrow("authentication is failed")
    });
});

describe('Authentication with oauth', () => {
    const user = getUserByTitle("balance_user") as User;

    it('should authenticate user with oauth method', async () => {
        const {oauth, options} = getOAuthMethod(user);
        const sdk = await ClientSdk.create(WS_URL, 82, oauth, options);

        const balances = (await sdk.balances()).getBalances();
        expect(balances.length, "Invalid balances count").to.be.above(0);
    });
});