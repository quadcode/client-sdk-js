import {BinaryOptionsDirection, ClientSdk, LoginPasswordAuthMethod} from "../src";
import {getUserByTitle} from "./utils/userUtils";
import {API_URL, BASE_HOST, User, WS_URL} from "./vars";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PositionsHelper} from "./utils/positionsHelper";

describe('Positions', () => {
    let user: User
    let sdk: ClientSdk
    let positionsHelper: PositionsHelper

    beforeAll(async () => {
        user = getUserByTitle('positions_user') as User
        const options = IS_BROWSER ? {host: BASE_HOST} : undefined;
        sdk = await ClientSdk.create(WS_URL, 82, new LoginPasswordAuthMethod(API_URL, user.email, user.password), options)
        positionsHelper = await PositionsHelper.create(sdk)
    });

    afterAll(async function () {
        await sdk.shutdown();
    });

    async function openBinaryOption() {
        const balances = await sdk.balances()
        const demoBalance = balances.getBalances().find(value => value.type === "demo")
        const binaryOptions = await sdk.binaryOptions()
        const binaryOptionsActive = binaryOptions.getActives().filter(value => value.canBeBoughtAt(sdk.currentTime()))[0]
        const availableForBuyAt = (await binaryOptionsActive.instruments()).getAvailableForBuyAt(sdk.currentTime())[0]
        return await binaryOptions.buy(availableForBuyAt, BinaryOptionsDirection.Call, 10, demoBalance!)
    }

    it(`Position should contains direction and expiration time (subscribe on updated position before opening)`, async () => {
        const binaryOptionsOption = await openBinaryOption()
        const position = await positionsHelper.waitForPosition(position => position.orderIds.includes(binaryOptionsOption.id))
        expect(position!.direction, "Direction should be define in position object").to.be.not.undefined
        expect(position!.expirationTime, "Expiration time should be define in position object").to.be.not.undefined
    });

    it(`Position should contains direction and expiration time (subscribe on updated position after opening)`, async () => {
        const binaryOptionsOption = await openBinaryOption()
        const options = IS_BROWSER ? {host: BASE_HOST} : undefined;
        const sdk = await ClientSdk.create(WS_URL, 82, new LoginPasswordAuthMethod(API_URL, user.email, user.password), options)
        const positionsHelper = await PositionsHelper.create(sdk)
        const position = await positionsHelper.waitForPosition(position => position.orderIds.includes(binaryOptionsOption.id))
        expect(position.direction, "Direction should be define in position object").to.be.not.undefined
        expect(position.expirationTime, "Expiration time should be define in position object").to.be.not.undefined
    });
});

describe('History positions', () => {
    let user: User
    let sdk: ClientSdk
    let positionsHelper: PositionsHelper

    beforeAll(async () => {
        user = getUserByTitle('history_positions_user') as User
        const options = IS_BROWSER ? {host: BASE_HOST} : undefined;
        sdk = await ClientSdk.create(WS_URL, 82, new LoginPasswordAuthMethod(API_URL, user.email, user.password), options)
        positionsHelper = await PositionsHelper.create(sdk)
    });

    afterAll(async function () {
        await sdk.shutdown();
    });

    const pages = [{page: 1, count: 30}, {page: 2, count: 90}]

    pages.forEach(({page, count}) => {

        it(`${page} more pages should be loaded, positions count ${count}`, async () => {
            const historyPositions = await positionsHelper.loadHistoryPositions(page);
            expect(historyPositions.length, 'History positions count must be ' + count).eq(count);
        });
    })
});