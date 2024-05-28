import {
    Balance,
    LoginPasswordAuthMethod,
    QuadcodeClientSdk,
    TurboOptions,
    TurboOptionsActiveInstrument,
    TurboOptionsDirection
} from "../src";
import {getUserByTitle} from "./utils/userUtils";
import {User} from "./data/types";
import {expect} from "chai";
import {justWait, waitForCondition} from "./utils/waiters";

describe('Turbo-options', () => {
    let sdk: QuadcodeClientSdk;
    let turboOptions: TurboOptions;
    let demoBalance: Balance;
    let realBalance: Balance;

    before(async () => {
        const user = getUserByTitle('regular_user') as User;
        const wsURL = process.env.WS_URL as string;
        const apiUrl = process.env.API_URL as string;
        sdk = await QuadcodeClientSdk.create(wsURL, 82, new LoginPasswordAuthMethod(apiUrl, user.email, user.password));
        const balances = await sdk.balances();
        demoBalance = balances.getBalances().filter(value => value.type === "demo")[0];
        realBalance = balances.getBalances().filter(value => value.type === "real")[0];
        turboOptions = await sdk.turboOptions();
    });

    after(async function () {
        await sdk.shutdown();
    });

    it('should return turbo option actives', async () => {
        expect(turboOptions.getActives().length).to.be.above(0);
    });

    describe('Getting turbo-option instruments', async () => {
        let instruments: TurboOptionsActiveInstrument[];

        before(async () => {
            const actives = turboOptions.getActives();
            const first = actives[0];
            const turboOptionsActiveInstruments = await first.instruments();
            const currentTime = sdk.currentTime()
            instruments = turboOptionsActiveInstruments.getAvailableForBuyAt(currentTime);
        });

        it('should return instruments array', () => {
            expect(instruments, 'Invalid turbo-option instruments count').to.be.a('array').with.length.above(0);
        });

        it('should return valid purchaseEndTime', () => {
            const firstInstrument = instruments[0];
            expect(firstInstrument.purchaseEndTime().getTime(), 'Invalid purchase end time')
                .to.closeTo(firstInstrument.expiredAt.getTime() - firstInstrument.deadtime * 1000, 0)
        });

        it('should return valid durationRemainingForPurchase', () => {
            const firstInstrument = instruments[0];
            const currentTime = sdk.currentTime();
            expect(firstInstrument.durationRemainingForPurchase(currentTime), 'Invalid duration remaining for purchase')
                .to.eq(firstInstrument.purchaseEndTime().getTime() - currentTime.getTime())
        });

        describe('Buy option', () => {

            it('insufficient funds for this transaction', async () => {
                const firstInstrument = instruments[0];
                await expect(turboOptions.buy(firstInstrument, TurboOptionsDirection.Call, 10, realBalance))
                    .to.eventually.be.rejectedWith("Insufficient funds for this transaction.")
            });

            it('Option should be open', async () => {
                const firstInstrument = instruments[0];
                const turboOption = await turboOptions.buy(firstInstrument, TurboOptionsDirection.Call, 1, demoBalance);
                await justWait(2000) // TODO: remove it later
                expect(turboOption.id, 'Option id should be not null').to.not.to.be.null
                const positions = await turboOptions.positionsByBalance(demoBalance);
                expect(positions.getPositionById(turboOption.id), 'Position must be present').to.be.not.null
            });

            describe('Expiration', () => {

                it('should expired', async () => {
                    const firstInstrument = instruments[0];
                    const turboOption = await turboOptions.buy(firstInstrument, TurboOptionsDirection.Call, 1, demoBalance);
                    await justWait(2000) // TODO: remove it later
                    await waitForCondition(() => turboOption.position().status !== "open", 100000);
                    expect(turboOption.position().closeReason, 'Invalid close reason').to.be.oneOf(["win", "loose"])
                }).timeout(100000);
            });
        });
    });
});