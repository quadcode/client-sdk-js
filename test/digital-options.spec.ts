import {
    Balance,
    DigitalOptions,
    DigitalOptionsDirection,
    DigitalOptionsOrder,
    DigitalOptionsUnderlyingInstrument,
    LoginPasswordAuthMethod,
    QuadcodeClientSdk
} from "../src";
import {getUserByTitle} from "./utils/userUtils";
import {User} from "./data/types";
import {expect} from "chai";
import {waitForPosition} from "./utils/positionsHelper";

describe('Digital-options', () => {
    let sdk: QuadcodeClientSdk;
    let digitalOptions: DigitalOptions;
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
        digitalOptions = await sdk.digitalOptions();
    });

    after(async function () {
        await sdk.shutdown();
    });

    it('should return digital option actives', async () => {
        expect(digitalOptions.getUnderlyingsAvailableForTradingAt(sdk.currentTime()).length).to.be.above(0);
    });

    describe('Getting digital-option instruments', async () => {
        let availableInstruments: DigitalOptionsUnderlyingInstrument[];

        function findInstrumentByPeriod(period: number) {
            const instrument = availableInstruments.find(instr => instr.period === period);
            if (!instrument)
                throw new Error('Instrument with period ${period} wasn\'t found');
            return instrument;
        }

        before(async () => {
            const underlyings = digitalOptions.getUnderlyingsAvailableForTradingAt(sdk.currentTime())
            const first = underlyings[0];
            const instruments = await first.instruments();
            availableInstruments = instruments.getAvailableForBuyAt(sdk.currentTime());
        });

        it('should return instruments array', () => {
            expect(availableInstruments, 'Invalid digital-option instruments count').to.be.a('array').with.length.above(0);
        });

        it('should return valid purchaseEndTime', () => {
            const firstInstrument = availableInstruments[0];
            expect(firstInstrument.purchaseEndTime().getTime(), 'Invalid purchase end time')
                .to.closeTo(firstInstrument.expiration.getTime() - firstInstrument.deadtime * 1000, 0)
        });

        it('should return valid durationRemainingForPurchase', () => {
            const firstInstrument = availableInstruments[0];
            const currentTime = sdk.currentTime();
            expect(firstInstrument.durationRemainingForPurchase(currentTime), 'Invalid duration remaining for purchase')
                .to.eq(firstInstrument.purchaseEndTime().getTime() - currentTime.getTime())
        });

        it('should return ask/bid prices if subscribed', async () => {
            const instrument = availableInstruments.find(instr => instr.period === 300);
            if (!instrument)
                throw new Error("Instrument with 5min expiration wasn't found");
            const strikes = Array.from(instrument.strikes.values());
            expect(strikes.filter(value => value.bid !== undefined || value.ask !== undefined),
                'Strikes should not have ask/bid prices').lengthOf(0)

            await instrument.subscribeOnStrikesAskBidPrices();
            await new Promise(resolve => setTimeout(resolve, 1000)) // wait 1 sec

            const strikesWithPrices = Array.from(instrument.strikes.values())
                .filter(value => value.bid !== undefined || value.ask !== undefined);
            expect(strikesWithPrices.length, 'Strikes must have ask/bid prices').eq(strikes.length)
        });

        describe('Buy option', () => {

            it("ignore insufficient funds for this transaction because it's order", async () => {
                const firstInstrument = findInstrumentByPeriod(60);
                await expect(digitalOptions.buySpotStrike(firstInstrument, DigitalOptionsDirection.Call, 10, realBalance))
                    .to.eventually.be.an.instanceof(DigitalOptionsOrder)
            });

            it('option should be opened', async () => {
                const instrument = findInstrumentByPeriod(60);
                const digitalOrder = await digitalOptions.buySpotStrike(instrument, DigitalOptionsDirection.Call, 1, demoBalance);
                expect(digitalOrder.id, 'Option id should be not null').to.be.not.null
                const positions = await sdk.positions();
                const position = await waitForPosition(positions, (position) => position.orderIds.includes(digitalOrder.id));
                expect(position.id, 'Position must be present').to.be.not.null
            });

            describe('Expiration', () => {

                it('should expired', async () => {
                    const firstInstrument = findInstrumentByPeriod(60);
                    const digitalOrder = await digitalOptions.buySpotStrike(firstInstrument, DigitalOptionsDirection.Call, 10, demoBalance);
                    const positions = await sdk.positions();
                    const position = await waitForPosition(positions, (position) => position.orderIds.includes(digitalOrder.id) && position.status !== "open", 100000);
                    expect(position.closeReason, 'Invalid close reason').to.be.oneOf(["win", "loose"])
                }).timeout(120000);

            });
        });
    });
});