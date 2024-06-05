import {
    Balance,
    BinaryOptions,
    BinaryOptionsActiveInstrument,
    BinaryOptionsDirection,
    LoginPasswordAuthMethod,
    QuadcodeClientSdk
} from "../src";
import {getUserByTitle} from "./utils/userUtils";
import {User} from "./data/types";
import {expect} from "chai";
import {justWait, waitForCondition} from "./utils/waiters";
import {PositionsHelper} from "./utils/positionsHelper";

describe('Binary-options', () => {
    let sdk: QuadcodeClientSdk;
    let demoBalance: Balance;
    let realBalance: Balance;
    let binaryOptions: BinaryOptions;

    before(async () => {
        const user = getUserByTitle('regular_user') as User;
        const wsURL = process.env.WS_URL as string;
        const apiUrl = process.env.API_URL as string;
        sdk = await QuadcodeClientSdk.create(wsURL, 82, new LoginPasswordAuthMethod(apiUrl, user.email, user.password));
        const balances = await sdk.balances();
        demoBalance = balances.getBalances().filter(value => value.type === "demo")[0];
        realBalance = balances.getBalances().filter(value => value.type === "real")[0];
        binaryOptions = await sdk.binaryOptions();

    });

    after(async function () {
        await sdk.shutdown();
    });

    it('should return binary option actives', async () => {
        expect(binaryOptions.getActives().length).to.be.above(0);
    });

    describe('Getting binary-option instruments', async () => {
        let instruments: BinaryOptionsActiveInstrument[];
        let positionsHelper: PositionsHelper;

        before(async () => {
            binaryOptions = await sdk.binaryOptions();
            const actives = binaryOptions.getActives();
            const first = actives[0];
            const binaryOptionsActiveInstruments = await first.instruments();
            const currentTime = sdk.currentTime()
            instruments = binaryOptionsActiveInstruments.getAvailableForBuyAt(currentTime);
            positionsHelper = await PositionsHelper.create(sdk);
        });

        function getAvailableInstrument() {
            return instruments.filter(value => value.durationRemainingForPurchase(sdk.currentTime()) > 1000)[0];
        }

        it('should return instruments array', () => {
            expect(instruments, 'Invalid binary-option instruments count').to.be.a('array').with.length.above(0);
        });


        it('should return valid purchaseEndTime', () => {
            const firstInstrument = getAvailableInstrument();
            expect(firstInstrument.purchaseEndTime().getTime(), 'Invalid purchase end time')
                .to.closeTo(firstInstrument.expiredAt.getTime() - firstInstrument.deadtime * 1000, 0)
        });

        it('should return valid purchaseEndTime for End of Week expiration', () => {
            const instrument = instruments.find(value => value.expirationSize === 'front.End of month');
            if (!instrument)
                throw new Error("Instrument with 'End of Month' expiration must be present")
            expect(instrument.purchaseEndTime().getTime(), "Invalid purchase end time").to.be.eq(instrument.expiredAt.getTime() - instrument.deadtime * 1000)
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
                await expect(binaryOptions.buy(firstInstrument, BinaryOptionsDirection.Put, 10, realBalance))
                    .to.eventually.be.rejectedWith("Insufficient funds for this transaction.")
            });

            async function openOption() {
                const firstInstrument = getAvailableInstrument();
                const binaryOption = await binaryOptions.buy(firstInstrument, BinaryOptionsDirection.Call, 10, demoBalance);
                expect(binaryOption.id, 'Option id should be not null').to.be.not.null
                return await positionsHelper.waitForPosition((position) => position.orderIds.includes(binaryOption.id));
            }

            it('should be opened', async () => {
                const position = await openOption();
                expect(position.id, 'Position must be present').to.be.not.null
            });

            it('should be sold', async () => {
                const position = await openOption();
                expect(positionsHelper.findPosition(position.id), 'Position must be present in all positions').not.to.be.undefined
                await justWait(3000);
                await position.sell();
                await waitForCondition(() => position.status === "closed", 2000);
                expect(position.closeReason, "Invalid close reason").eq("sold");
                expect(position.sellProfit, "Sell profit must be present").not.be.null;
                expect(positionsHelper.findHistoryPosition(position.id), 'Position must be present in history positions').not.to.be.undefined
                expect(positionsHelper.findPosition(position.id), 'Position must be not present in all positions').to.be.undefined
            });
        });
    });
});