import {LoginPasswordAuthMethod, QuadcodeClientSdk, TurboOptionsActiveInstrument} from "../src";
import {getUserByTitle} from "./setup/userUtils";
import {User} from "./data/types";
import {expect} from "chai";

describe('Turbo-options', () => {
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

    it('should return turbo option actives', async () => {
        const turboOptions = await sdk.turboOptions();
        expect(turboOptions.getActives().length).to.be.above(0);
    });

    describe('Getting turbo-option instruments', async () => {
        let instruments: TurboOptionsActiveInstrument[];

        before(async () => {
            const turboOptions = await sdk.turboOptions();
            const actives = turboOptions.getActives();
            const first = actives[0];
            const turboOptionsActiveInstruments = await first.instruments();
            const currentTime = sdk.currentTime()
            instruments = turboOptionsActiveInstruments.getAvailableForBuyAt(currentTime);
        });

        it('should return instruments array', () => {
            expect(instruments, 'Invalid turbo-option instruments count').to.be.a('array').with.length.above(0);
        });

        describe('Checking turbo-option instrument params', () => {

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
        });
    });
});