import {DigitalOptionsUnderlyingInstrument, LoginPasswordAuthMethod, QuadcodeClientSdk} from "../src";
import {getUserByTitle} from "./setup/userUtils";
import {User} from "./data/types";
import {expect} from "chai";

describe('Digital-options', () => {
    let sdk: QuadcodeClientSdk;

    before(async () => {
        const user = getUserByTitle('regular_user') as User;
        const wsURL = process.env.WS_URL as string;
        const apiUrl = process.env.API_URL as string;
        sdk = await QuadcodeClientSdk.create(wsURL, 82, new LoginPasswordAuthMethod(apiUrl, user.email, user.password));
    });

    after(async function () {
        await sdk.shutdown();
    });

    it('should return digital option actives', async () => {
        const digitalOptions = await sdk.digitalOptions();
        expect(digitalOptions.getUnderlyingsAvailableForTradingAt(sdk.currentTime()).length).to.be.above(0);
    });

    describe('Getting digital-option instruments', async () => {
        let availableInstruments: DigitalOptionsUnderlyingInstrument[];

        before(async () => {
            const digitalOptions = await sdk.digitalOptions();
            const underlyings = digitalOptions.getUnderlyingsAvailableForTradingAt(sdk.currentTime())
            const first = underlyings[0];
            const instruments = await first.instruments();
            availableInstruments = instruments.getAvailableForBuyAt(sdk.currentTime());
        });

        it('should return instruments array', () => {
            expect(availableInstruments, 'Invalid digital-option instruments count').to.be.a('array').with.length.above(0);
        });

        describe('Checking digital-option instrument params', () => {

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
        });
    });
});