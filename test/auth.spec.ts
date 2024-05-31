import {LoginPasswordAuthMethod, QuadcodeClientSdk} from "../src";
import {expect} from 'chai'
import {User} from "./data/types";
import {getUserByTitle} from "./utils/userUtils";

describe('Authentication with login and password', () => {
    let sdk: QuadcodeClientSdk;
    const user = getUserByTitle('regular_user') as User;
    const wsURL = process.env.WS_URL as string;
    const apiUrl = process.env.API_URL as string;

    after(async function () {
        await sdk.shutdown();
    });

    it('should authenticate user with valid credentials', async () => {
        sdk = await QuadcodeClientSdk.create(wsURL, 82, new LoginPasswordAuthMethod(apiUrl, user.email, user.password));
        expect((await sdk.balances()).getBalances().length, "Invalid balances count").to.be.above(0);
    });

    it('should not authenticate user with invalid credentials', async () => {
        await expect(QuadcodeClientSdk.create(
            wsURL,
            82,
            new LoginPasswordAuthMethod(apiUrl, user.email, "invalid_password")))
            .to.eventually.be.rejectedWith("authentication is failed")
    });
});