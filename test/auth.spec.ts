import {LoginPasswordAuthMethod, QuadcodeClientSdk} from "../src";
import {expect} from 'chai'
import {User} from "./data/types";
import {getUserByTitle} from "./setup/userUtils";

describe('Authentication with login and password', () => {
    const user = getUserByTitle('regular_user') as User;
    const wsURL = process.env.WS_URL as string;
    const apiUrl = process.env.API_URL as string;

    it('should authenticate user with valid credentials', async () => {
        const sdk = await QuadcodeClientSdk.create(
            wsURL,
            82,
            new LoginPasswordAuthMethod(apiUrl, user.email, user.password));
        try {
            expect((await sdk.balances()).getBalances().length, "Invalid balances count").to.be.above(0);
        } finally {
            await sdk.shutdown();
        }
    });

    it('should not authenticate user with invalid credentials', async () => {
        await expect(QuadcodeClientSdk.create(
            wsURL,
            82,
            new LoginPasswordAuthMethod(apiUrl, user.email, "invalid_password")))
            .to.eventually.be.rejectedWith("authentication is failed")
    });
});