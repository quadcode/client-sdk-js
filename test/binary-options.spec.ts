import {BinaryOptionsActiveInstrument, LoginPasswordAuthMethod, QuadcodeClientSdk} from "../src";
import {getUserByTitle} from "./setup/userUtils";
import {User} from "./data/types";
import {expect} from "chai";

describe('Binary-options', () => {
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

    it('should return binary option actives', async () => {
        const binaryOptions = await sdk.binaryOptions();
        expect(binaryOptions.getActives().length).to.be.above(0);
    });

    describe('Getting binary-option instruments', async () => {
        let instruments: BinaryOptionsActiveInstrument[];

        before(async () => {
            const binaryOptions = await sdk.binaryOptions();
            const actives = binaryOptions.getActives();
            const first = actives[0];
            const binaryOptionsActiveInstruments = await first.instruments();
            const currentTime = sdk.currentTime()
            instruments = binaryOptionsActiveInstruments.getAvailableForBuyAt(currentTime);
        });

        it('should return instruments array', () => {
            expect(instruments, 'Invalid binary-option instruments count').to.be.a('array').with.length.above(0);
        });

        describe('Checking binary-option instrument params', () => {

            it('should return valid purchaseEndTime', () => {
                const firstInstrument = instruments[0];
                expect(firstInstrument.purchaseEndTime().getTime(), 'Invalid purchase end time')
                    .to.closeTo(firstInstrument.expiredAt.getTime() - firstInstrument.deadtime * 1000, 0)
            });

            it('should return valid purchaseEndTime for End of Week expiration', () => {
                const instrument = instruments.find(value => value.expirationSize === 'front.End of week');
                if (instrument) {
                    expect(instrument.purchaseEndTime().getTime(), "Invalid purchase end time").to.be.eq(instrument.expiredAt.getTime() - instrument.deadtime * 1000)
                } else throw new Error("Instrument with 'End of Day' expiration must be present")
            });

            it('should return valid durationRemainingForPurchase', () => {
                const firstInstrument = instruments[0];
                const currentTime = sdk.currentTime();
                expect(firstInstrument.durationRemainingForPurchase(currentTime), 'Invalid duration remaining for purchase')
                    .to.eq(firstInstrument.purchaseEndTime().getTime() - currentTime.getTime())
            });
        });
    });
});