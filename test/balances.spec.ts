import {Balance, Balances, BalanceType, BinaryOptionsDirection, ClientSdk, LoginPasswordAuthMethod} from "../src";
import {API_URL, BASE_HOST, User, WS_URL} from "./vars";
import {getUserByTitle} from "./utils/userUtils";
import {waitForCondition} from "./utils/waiters";
import {afterAll, beforeAll, describe, expect, it} from "vitest";

describe('Balances', () => {
    let sdk: ClientSdk;
    let balances: Balances;
    const user = getUserByTitle('balance_user') as User;

    beforeAll(async () => {
        const options = IS_BROWSER ? {host: BASE_HOST} : undefined;
        sdk = await ClientSdk.create(WS_URL, 82, new LoginPasswordAuthMethod(API_URL, user.email, user.password), options);
        balances = await sdk.balances();
    })

    afterAll(async () => {
        await sdk.shutdown();
    });

    function getBalance(type: BalanceType) {
        const balance = balances.getBalances().find(value => value.type === type);
        if (!balance) throw new Error(`${type} balance not found`);
        return balance;
    }

    async function openOption(balance: Balance, amount: number) {
        const options = await sdk.binaryOptions();
        const activeInstruments = await options.getActives()
            .filter(active => active.canBeBoughtAt(sdk.currentTime()))[0].instruments();
        const availableInstruments = activeInstruments.getAvailableForBuyAt(sdk.currentTime());
        const availableForBuyAt = availableInstruments.reduce((prev, curr) => {
            return prev.expiredAt > curr.expiredAt ? prev : curr;
        });
        await options.buy(availableForBuyAt, BinaryOptionsDirection.Put, amount, balance)
    }

    it('should reset demo balance', async () => {
        const balance = getBalance(BalanceType.Demo);
        const balanceAmount = balance.amount;
        const defaultBalanceAmount = 10000;
        const amount = balanceAmount - defaultBalanceAmount + 1;
        const balanceAmountAfterOpen = balanceAmount - amount;
        if (balanceAmount >= defaultBalanceAmount) {
            await openOption(balance, amount);
            await waitForCondition(() => balance.amount !== balanceAmount, 3000);
            expect(balance.amount, "Balance amount should be changed").eq(balanceAmountAfterOpen);
        }
        await balance.resetDemoBalance();
        await waitForCondition(() => balance.amount !== balanceAmountAfterOpen, 3000);
        expect(balance.amount, "Resent is not working, balance wasn't changed").eq(defaultBalanceAmount);
    });

    it('balance should changed', async () => {
        const user = getUserByTitle('balance_user1') as User;
        const options = IS_BROWSER ? {host: BASE_HOST} : undefined;
        sdk = await ClientSdk.create(WS_URL, 82, new LoginPasswordAuthMethod(API_URL, user.email, user.password), options);
        balances = await sdk.balances();
        const balance = getBalance(BalanceType.Demo);
        let balanceAmount: number = 0;
        balances.subscribeOnUpdateBalance(balance.id, (balance) => {
            balanceAmount = balance.amount;
        })
        await openOption(balance, 1);
        expect(await waitForCondition(() => balanceAmount !== 0, 3000)).to.be.true;
    });

    it('error should be present when subscribe with invalid balance id', async () => {
        expect(() => balances.subscribeOnUpdateBalance(123, () => {
        })).toThrowError("balance with id '123' is not found")
    });

    it('cannot reset normal balance', async () => {
        const balance = getBalance(BalanceType.Real);
        await expect(balance.resetDemoBalance()).rejects.toThrow("Only demo balance can be reset")
    });
});