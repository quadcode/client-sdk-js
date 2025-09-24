import {ClientSdk, LoginPasswordAuthMethod, TurboOptionsDirection, WsConnectionStateEnum} from "../src";
import {API_URL, User, WS_URL} from "./vars";
import {afterAll, describe, expect, it} from "vitest";
import {getUserByTitle} from "./utils/userUtils";
import {justWait, waitForCondition} from "./utils/waiters";
import {PositionsHelper} from "./utils/positionsHelper";
import {randomFloat} from "./utils/utils";

describe('ws connection state', () => {
    let sdk: ClientSdk;
    const user = getUserByTitle("regular_user") as User;


    afterAll(async function () {
        await sdk.shutdown();
    });

    it.skip('should reconnected', async () => {
        sdk = await ClientSdk.create(WS_URL, 82, new LoginPasswordAuthMethod(API_URL, user.email, user.password));
        const wsConnectionState = await sdk.wsConnectionState();
        let ws: WsConnectionStateEnum;
        wsConnectionState.subscribeOnStateChanged(state => ws = state)
        console.log("Disconnect this device...")
        expect(await waitForCondition(() => ws === WsConnectionStateEnum.Disconnected, 120000)).to.be.true;
        console.log("Connect this device...")
        expect(await waitForCondition(() => ws === WsConnectionStateEnum.Connected, 120000)).to.be.true;
    });


    it('should subscribeOnWsCurrentTime update time', async () => {
        sdk = await ClientSdk.create(WS_URL, 82, new LoginPasswordAuthMethod(API_URL, user.email, user.password));
        let time: Date = sdk.currentTime()
        let prev: Date = time;
        sdk.subscribeOnWsCurrentTime(currentTime => time = currentTime)
        for (let i = 0; i < 10; i++) {
            await justWait(1100)
            expect(time.getTime() - prev.getTime()).greaterThanOrEqual(900);
            prev = time;
        }
    });

    async function openOption() {
        const options = await sdk.turboOptions();
        const activeInstruments = await options.getActives()
            .filter(active => active.canBeBoughtAt(sdk.currentTime()))[0].instruments();
        const availableInstruments = activeInstruments.getAvailableForBuyAt(sdk.currentTime());
        const availableForBuyAt = availableInstruments.reduce((prev, curr) => {
            return prev.expiredAt < curr.expiredAt ? prev : curr;
        });
        const balances = await sdk.balances()
        const demoBalance = balances.getBalances().find(value => value.type === "demo")
        return await options.buy(availableForBuyAt, TurboOptionsDirection.Call, 11.29, demoBalance!)
    }


    it.skip('should reconnect and update positions', async () => {
        sdk = await ClientSdk.create(WS_URL, 82, new LoginPasswordAuthMethod(API_URL, user.email, user.password));
        const positions = await sdk.positions()
        const wsConnectionState = await sdk.wsConnectionState()
        const option = await openOption()
        const positionsHelper = await PositionsHelper.create(sdk)
        let ws: WsConnectionStateEnum
        wsConnectionState.subscribeOnStateChanged(state => ws = state)
        console.log("Disconnect this device...")
        expect(await waitForCondition(() => ws === WsConnectionStateEnum.Disconnected, 120000)).to.be.true
        const invest = randomFloat(1, 50, 2);
        console.log(`Open position by your phone(through mobile internet) with this invest ${invest} and connect this device...`)
        expect(await waitForCondition(() => ws === WsConnectionStateEnum.Connected, 120000)).to.be.true
        console.log("Connected")
        console.log("Waiting for position opened by phone")
        await positionsHelper.waitForPosition(position => position.invest == invest && position.status == "open", 120000);
        console.log("Waiting for position opened before disconnect was updated(closed)")
        const position1 = await positionsHelper.waitForPosition(position => position.externalId == option.id && position.status === "closed", 120000);
        console.log("Check that getOpenedPositions return only 1 open position")
        expect(positions.getOpenedPositions().length).to.be.eq(1);
        positionsHelper.findPositionByPredicate(position => position.invest == invest && position.status == "open")
        console.log("Check that second position is in the history positions")
        expect(positionsHelper.findHistoryPosition(position1.externalId)).not.undefined;
    });
});