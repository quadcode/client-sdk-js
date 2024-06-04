import {LoginPasswordAuthMethod, QuadcodeClientSdk} from "../src";
import {getUserByTitle} from "./utils/userUtils";
import {User} from "./data/types";
import {expect} from "chai";
import {PositionsHelper} from "./utils/positionsHelper";

describe('Positions', () => {
    let sdk: QuadcodeClientSdk;
    let positionsHelper: PositionsHelper;

    before(async () => {
        const user = getUserByTitle('regular_user') as User;
        const wsURL = process.env.WS_URL as string;
        const apiUrl = process.env.API_URL as string;
        sdk = await QuadcodeClientSdk.create(wsURL, 82, new LoginPasswordAuthMethod(apiUrl, user.email, user.password));
        positionsHelper = await PositionsHelper.create(sdk);
    });

    after(async function () {
        await sdk.shutdown();
    });

    describe('History positions', () => {
        const pages = [{page: 1, count: 30}, {page: 2, count: 90}]

        pages.forEach(({page, count}) => {

            it(`${page} more pages should be loaded, positions count ${count}`, async () => {
                const historyPositions = await positionsHelper.loadHistoryPositions(page);
                expect(historyPositions.length, 'History positions count must be ' + count).eq(count);
            });
        })

    });
});