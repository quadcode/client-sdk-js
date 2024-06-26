import {LoginPasswordAuthMethod, QuadcodeClientSdk} from "../src";
import {API_URL, User, WS_URL} from "./vars";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {getUserByTitle} from "./utils/userUtils";

describe('Authentication with login and password', () => {
    let sdk: QuadcodeClientSdk;
    const user = getUserByTitle("regular_user") as User;

    beforeAll(async () => {
        sdk = await QuadcodeClientSdk.create(WS_URL, 82, new LoginPasswordAuthMethod(API_URL, user.email, user.password));
    })

    afterAll(async function () {
        await sdk.shutdown();
    });

    it('should authenticate user with valid credentials', async () => {
        const balances = (await sdk.balances()).getBalances();
        expect(balances.length, "Invalid balances count").to.be.above(0);
    });

    it('should not authenticate user with invalid credentials', async () => {
        await expect(QuadcodeClientSdk.create(
            WS_URL,
            82,
            new LoginPasswordAuthMethod(API_URL, user.email, "invalid_password"))).rejects.toThrow("authentication is failed")
    });
});