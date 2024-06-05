import {Balance, BlitzOptions, BlitzOptionsDirection, LoginPasswordAuthMethod, QuadcodeClientSdk} from "../src";
import {getUserByTitle} from "./utils/userUtils";
import {User} from "./data/types";
import {expect} from "chai";
import {justWait, waitForCondition} from "./utils/waiters";
import {PositionsHelper} from "./utils/positionsHelper";

describe('Blitz-options', () => {
    let sdk: QuadcodeClientSdk;
    let blitzOptions: BlitzOptions;
    let demoBalance: Balance;
    let realBalance: Balance;
    let positionsHelper: PositionsHelper;

    before(async () => {
        const user = getUserByTitle('regular_user') as User;
        const wsURL = process.env.WS_URL as string;
        const apiUrl = process.env.API_URL as string;
        sdk = await QuadcodeClientSdk.create(wsURL, 82, new LoginPasswordAuthMethod(apiUrl, user.email, user.password));
        blitzOptions = await sdk.blitzOptions();
        const balances = await sdk.balances();
        demoBalance = balances.getBalances().filter(value => value.type === "demo")[0];
        realBalance = balances.getBalances().filter(value => value.type === "real")[0];
        positionsHelper = await PositionsHelper.create(sdk);
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
            const expirationSize = active.expirationTimes[0];
            await expect(blitzOptions.buy(active, BlitzOptionsDirection.Put, expirationSize, 10, realBalance))
                .to.eventually.be.rejectedWith("Insufficient funds for this transaction.")
        });

        async function openOption() {
            const active = blitzOptions.getActives()[0];
            const expirationSize = active.expirationTimes[0];
            const blitzOption = await blitzOptions.buy(active, BlitzOptionsDirection.Call, expirationSize, 10, demoBalance);
            expect(blitzOption.id, 'Option id should be not null').to.be.not.null
            return await positionsHelper.waitForPosition((position) => position.orderIds.includes(blitzOption.id), 5000);
        }

        it('should be opened', async () => {
            const position = await openOption();
            expect(position.id, 'Position must be present').to.be.not.null
        });

        describe('Expiration', () => {

            it('should expired', async () => {
                const position = await openOption();
                await waitForCondition(() => position.closeReason !== undefined, 7000);
                expect(position.closeReason, 'Invalid close reason').to.be.oneOf(["win", "equal", "loose"])
                expect(positionsHelper.findHistoryPosition(position.id), 'Position must be present in history positions').not.to.be.undefined
                expect(positionsHelper.findPosition(position.id), 'Position must be not present in all positions').to.be.undefined
            }).timeout(10000);

            it('should not be sold', async () => {
                const position = await openOption();
                await justWait(1000);
                await expect(position.sell()).to.eventually.be.rejectedWith("Blitz options are not supported")
            });

        });
    });
});