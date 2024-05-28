import {Balance, BlitzOptions, BlitzOptionsDirection, LoginPasswordAuthMethod, QuadcodeClientSdk} from "../src";
import {getUserByTitle} from "./utils/userUtils";
import {User} from "./data/types";
import {expect} from "chai";
import {justWait, waitForCondition} from "./utils/waiters";

describe('Blitz-options', () => {
    let sdk: QuadcodeClientSdk;
    let blitzOptions: BlitzOptions;
    let demoBalance: Balance;
    let realBalance: Balance;

    before(async () => {
        const user = getUserByTitle('regular_user') as User;
        const wsURL = process.env.WS_URL as string;
        const apiUrl = process.env.API_URL as string;
        sdk = await QuadcodeClientSdk.create(wsURL, 82, new LoginPasswordAuthMethod(apiUrl, user.email, user.password));
        blitzOptions = await sdk.blitzOptions();
        const balances = await sdk.balances();
        demoBalance = balances.getBalances().filter(value => value.type === "demo")[0];
        realBalance = balances.getBalances().filter(value => value.type === "real")[0];
    });

    after(async function () {
        await sdk.shutdown();
    });

    it('should return blitz option actives', async () => {
        expect(blitzOptions.getActives().length, 'Invalid blitz-option actives count').to.be.above(0);
    });

    describe('Buy option', () => {

        it('insufficient funds for this transaction', async () => {
            const active = blitzOptions.getActives()[0];
            await expect(blitzOptions.buy(active, BlitzOptionsDirection.Put, 3, 10, realBalance))
                .to.eventually.be.rejectedWith("Insufficient funds for this transaction.")
        });

        it('Option should be open', async () => {
            const active = blitzOptions.getActives()[0];
            const blitzOption = await blitzOptions.buy(active, BlitzOptionsDirection.Call, 5, 10, demoBalance);
            await justWait(2000) // TODO: remove it later
            expect(blitzOption.id, 'Option id should be not null').to.not.to.be.null
            const positions = await blitzOptions.positionsByBalance(demoBalance);
            expect(positions.getPositionById(blitzOption.id), 'Position must be present').to.be.not.null
        });
        describe('Expiration', () => {

            it('should expired', async () => {
                const active = blitzOptions.getActives()[0];
                const expirationSize = 5;
                const blitzOption = await blitzOptions.buy(active, BlitzOptionsDirection.Call, expirationSize, 10, demoBalance);
                await justWait(2000) // TODO: remove it later
                await waitForCondition(() => blitzOption.position().status !== "open", 7000);
                expect(blitzOption.position().closeReason, 'Invalid close reason').to.be.oneOf(["win", "loose"])
            }).timeout(7000);
        });
    });
});