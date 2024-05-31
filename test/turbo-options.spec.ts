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
import {waitForPosition} from "./utils/positionsHelper";
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

        function getAvailableInstrument() {
            return instruments.filter(value => value.durationRemainingForPurchase(sdk.currentTime()) > 1000)[0];
        }

        it('should return instruments array', () => {
            expect(instruments, 'Invalid turbo-option instruments count').to.be.a('array').with.length.above(0);
        });

        it('should return valid purchaseEndTime', () => {
            const firstInstrument = getAvailableInstrument();
            expect(firstInstrument.purchaseEndTime().getTime(), 'Invalid purchase end time')
                .to.closeTo(firstInstrument.expiredAt.getTime() - firstInstrument.deadtime * 1000, 0)
        });

        it('should return valid durationRemainingForPurchase', () => {
            const firstInstrument = getAvailableInstrument();
            const currentTime = sdk.currentTime();
            expect(firstInstrument.durationRemainingForPurchase(currentTime), 'Invalid duration remaining for purchase')
                .to.eq(firstInstrument.purchaseEndTime().getTime() - currentTime.getTime())
        });

        describe('Buy option', () => {

            it('insufficient funds for this transaction', async () => {
                const firstInstrument = getAvailableInstrument();
                await expect(turboOptions.buy(firstInstrument, TurboOptionsDirection.Call, 10, realBalance))
                    .to.eventually.be.rejectedWith("Insufficient funds for this transaction.")
            });

            async function openOption() {
                const firstInstrument = getAvailableInstrument();
                const turboOption = await turboOptions.buy(firstInstrument, TurboOptionsDirection.Call, 1, demoBalance);
                expect(turboOption.id, 'Option id should be not null').not.to.be.null
                const positions = await sdk.positions();
                return await waitForPosition(positions, (position) => position.orderIds.includes(turboOption.id));
            }

            it('option should be open', async () => {
                const position = await openOption();
                expect(position.id, 'Position must be present').not.to.be.null
            });

            it('position should be updated by position-state event', async () => {
                const position = await openOption();
                expect(position.currentQuoteTimestamp, 'currentQuoteTimestamp must be present').to.be.not.null
                expect(position.pnlNet, 'pnlNet must be present').to.be.not.null
                expect(position.sellProfit, 'sellProfit must be present').not.to.be.null
            });

            it('option should be sold', async () => {
                const position = await openOption();
                await justWait(3000);
                await position.sell();
                await waitForCondition(() => position.status === "closed", 2000);
                expect(position.closeReason, "Invalid close reason").eq("sold");
                expect(position.sellProfit, "Sell profit must be present").not.be.null;
            }).timeout(7000);
        });
    });
})
;