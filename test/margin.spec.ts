import {
    Balance,
    ClientSdk,
    LoginPasswordAuthMethod,
    MarginCfd,
    MarginCrypto,
    MarginDirection,
    MarginForex,
    MarginTradingTPSL,
    MarginUnderlyingInstrument,
    Quotes
} from "../src";
import {getUserByTitle} from "./utils/userUtils";
import {API_URL, BASE_HOST, User, WS_URL} from "./vars";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PositionsHelper} from "./utils/positionsHelper";
import {justWait, waitForCondition} from "./utils/waiters";
import {getCurrentQuote} from "./utils/utils";

describe('Margin Forex/CFD/Crypto', () => {
    let sdk: ClientSdk;
    let user: User;
    let quotes: Quotes;
    let demoBalance: Balance;
    let realBalance: Balance;
    let positionsHelper: PositionsHelper;

    beforeAll(async () => {
        user = getUserByTitle('margin_user') as User;
        const options = IS_BROWSER ? {host: BASE_HOST} : undefined;
        sdk = await ClientSdk.create(WS_URL, 82, new LoginPasswordAuthMethod(API_URL, user.email, user.password), options);
        const balances = await sdk.balances();
        quotes = await sdk.quotes();
        demoBalance = balances.getBalances().filter(value => value.type === "demo")[0];
        realBalance = balances.getBalances().filter(value => value.type === "real")[0];
        positionsHelper = await PositionsHelper.create(sdk);
        await positionsHelper.closeOpenedPositions()
        await demoBalance.resetDemoBalance()
    });

    afterAll(async function () {
        await sdk.shutdown();
    });

    it('Margin CFD instrument should be available', async () => {
        expect(await sdk.marginCfdIsAvailable(), 'Margin CFD must be available').to.be.true;
    });

    it('Margin Crypto instrument should be available', async () => {
        expect(await sdk.marginCryptoIsAvailable(), 'Margin Crypto must be available').to.be.true;
    });

    it('Margin Forex instrument should be available', async () => {
        expect(await sdk.marginForexIsAvailable(), 'Margin Forex must be available').to.be.true;
    });

    describe('Margin CFD', async () => {
        let marginCFD: MarginCfd;

        beforeAll(async () => {
            marginCFD = await sdk.marginCfd();
        });

        async function getUnderlyingInstrument() {
            const underlyingsAvailableForTradingAt = marginCFD.getUnderlyingsAvailableForTradingAt(sdk.currentTime());
            expect(underlyingsAvailableForTradingAt.length, "Invalid underlyings available count").to.be.above(0);
            const marginUnderlying = underlyingsAvailableForTradingAt[0];
            expect(marginUnderlying, "Invalid MarginUnderlying instrument type").to.have.property("marginInstrumentType", "cfd")
            const marginUnderlyingInstruments = await marginUnderlying.instruments();
            return marginUnderlyingInstruments.getAvailableForBuyAt(sdk.currentTime())[0];
        }

        async function openOrder(stopLoss: MarginTradingTPSL | null = null,
                                 takeProfit: MarginTradingTPSL | null = null,) {
            const availableForBuy = await getUnderlyingInstrument();
            return await marginCFD.buy(availableForBuy, MarginDirection.Buy, availableForBuy.minQty, demoBalance, stopLoss, takeProfit);
        }

        async function openStopPriceOrder(instrument: MarginUnderlyingInstrument,
                                          direction: MarginDirection,
                                          price: number,
                                          stopLoss: MarginTradingTPSL | null = null,
                                          takeProfit: MarginTradingTPSL | null = null,) {
            return await marginCFD.buyStop(instrument, direction, instrument.minQty, demoBalance, price, stopLoss, takeProfit);
        }

        async function openLimitPriceOrder(instrument: MarginUnderlyingInstrument,
                                           direction: MarginDirection,
                                           price: number,
                                           stopLoss: MarginTradingTPSL | null = null,
                                           takeProfit: MarginTradingTPSL | null = null,) {
            return await marginCFD.buyLimit(instrument, direction, instrument.minQty, demoBalance, price, stopLoss, takeProfit);
        }

        it('should return time to purchase', async () => {
            const availableForBuy = await getUnderlyingInstrument();
            const currentTime = sdk.currentTime().getTime();
            expect(availableForBuy.durationRemainingForPurchase(sdk.currentTime()), "Invalid time to purchase")
                .to.eq(availableForBuy.tradable.to.getTime() - currentTime)
        });

        it('should not create order if do not have money', async () => {
            const availableForBuy = await getUnderlyingInstrument();
            await expect(marginCFD.buy(availableForBuy, MarginDirection.Buy, 1, realBalance)).rejects
                .toThrow(`request is failed with status 4008 and message: create order: user_id: ${user.id} user_balance_id: ${realBalance.id} user balance has no deposits`)
        });

        it('should open market order', async () => {
            const marginOrder = await openOrder();
            expect(marginOrder.id, "Order must be present").to.be.not.null;
            const order = await positionsHelper.waitForOrder(order => order.id === marginOrder.id);
            expect(order.status, "Incorrect order status").eq("filled")
            const position = await positionsHelper.waitForPosition(position => position.orderIds.includes(marginOrder.id));
            expect(position, "Position doesn't present").to.be.not.undefined;
            expect(position.internalId).eq(order.positionId, "Invalid internal position_id")
        });

        it('should open stop price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openStopPriceOrder(instrument, MarginDirection.Buy, currentQuoteAsk! + 0.001);
            expect(marginOrder.id, "Order doesn't present").to.be.not.undefined;
        });

        it('should cancel stop price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openStopPriceOrder(instrument, MarginDirection.Buy, currentQuoteAsk! + 0.1);
            const order = await positionsHelper.waitForOrder(order => order.id === marginOrder.id);
            await order.cancel();
            expect(await waitForCondition(() => order.status === 'canceled'), "Invalid order status, must be canceled").true;
        });

        it('should open limit price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openLimitPriceOrder(instrument, MarginDirection.Sell, currentQuoteAsk! + 0.001);
            expect(marginOrder.id, "Order doesn't present").to.be.not.undefined;
        });

        it('should cancel limit price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openLimitPriceOrder(instrument, MarginDirection.Sell, currentQuoteAsk! + 0.1);
            const order = await positionsHelper.waitForOrder(order => order.id === marginOrder.id);
            await order.cancel();
            expect(await waitForCondition(() => order.status === 'canceled'), "Invalid order status, must be canceled").true;
        });

        it('should close order', async () => {
            const marginOrder = await openOrder();
            const position = await positionsHelper.waitForPosition(position => position.orderIds.includes(marginOrder.id));
            await justWait(1000);
            await position.sell();
            expect(await waitForCondition(() => position.status === "closed"), "Position didn't close").to.be.true
            expect(position.closeProfit, "Close profit must be present after sell").not.to.be.undefined
        });
    });

    describe('Margin Crypto', async () => {
        let marginCrypto: MarginCrypto;

        beforeAll(async () => {
            marginCrypto = await sdk.marginCrypto();
        });

        async function getUnderlyingInstrument() {
            const underlyingsAvailableForTradingAt = marginCrypto.getUnderlyingsAvailableForTradingAt(sdk.currentTime());
            expect(underlyingsAvailableForTradingAt.length, "Invalid underlyings available count").to.be.above(0);
            const marginUnderlying = underlyingsAvailableForTradingAt[0];
            expect(marginUnderlying, "Invalid MarginUnderlying instrument type").to.have.property("marginInstrumentType", "crypto")
            const marginUnderlyingInstruments = await marginUnderlying.instruments();
            return marginUnderlyingInstruments.getAvailableForBuyAt(sdk.currentTime())[0];
        }

        async function openOrder(stopLoss: MarginTradingTPSL | null = null,
                                 takeProfit: MarginTradingTPSL | null = null,) {
            const availableForBuy = await getUnderlyingInstrument();
            return await marginCrypto.buy(availableForBuy, MarginDirection.Buy, availableForBuy.minQty, demoBalance, stopLoss, takeProfit);
        }

        async function openStopPriceOrder(instrument: MarginUnderlyingInstrument,
                                          direction: MarginDirection,
                                          price: number,
                                          stopLoss: MarginTradingTPSL | null = null,
                                          takeProfit: MarginTradingTPSL | null = null,) {
            return await marginCrypto.buyStop(instrument, direction, instrument.minQty, demoBalance, price, stopLoss, takeProfit);
        }

        async function openLimitPriceOrder(instrument: MarginUnderlyingInstrument,
                                           direction: MarginDirection,
                                           price: number,
                                           stopLoss: MarginTradingTPSL | null = null,
                                           takeProfit: MarginTradingTPSL | null = null,) {
            return await marginCrypto.buyLimit(instrument, direction, instrument.minQty, demoBalance, price, stopLoss, takeProfit);
        }

        it('should return time to purchase', async () => {
            const availableForBuy = await getUnderlyingInstrument();
            const currentTime = sdk.currentTime().getTime();
            expect(availableForBuy.durationRemainingForPurchase(sdk.currentTime()), "Invalid time to purchase")
                .to.eq(availableForBuy.tradable.to.getTime() - currentTime)
        });

        it('should not create order if do not have money', async () => {
            const availableForBuy = await getUnderlyingInstrument();
            await expect(marginCrypto.buy(availableForBuy, MarginDirection.Buy, 1, realBalance)).rejects
                .toThrow(`request is failed with status 4008 and message: create order: user_id: ${user.id} user_balance_id: ${realBalance.id} user balance has no deposits`)
        });

        it('should open market order', async () => {
            const marginOrder = await openOrder();
            expect(marginOrder.id, "Order must be present").to.be.not.null;
            const order = await positionsHelper.waitForOrder(order => order.id === marginOrder.id);
            expect(order.status, "Incorrect order status").eq("filled")
            const position = await positionsHelper.waitForPosition(position => position.orderIds.includes(marginOrder.id));
            expect(position, "Position doesn't present").to.be.not.undefined;
        });

        it('should open stop price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openStopPriceOrder(instrument, MarginDirection.Buy, currentQuoteAsk! + 0.001);
            expect(marginOrder.id, "Order doesn't present").to.be.not.undefined;
        });

        it('should cancel stop price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openStopPriceOrder(instrument, MarginDirection.Buy, currentQuoteAsk! + 0.1);
            const order = await positionsHelper.waitForOrder(order => order.id === marginOrder.id);
            await order.cancel()
            expect(await waitForCondition(() => order.status === 'canceled'), "Invalid order status, must be canceled").true;
        });

        it('should open limit price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openLimitPriceOrder(instrument, MarginDirection.Sell, currentQuoteAsk! + 0.001);
            expect(marginOrder.id, "Order doesn't present").to.be.not.undefined;
        });

        it('should cancel limit price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openLimitPriceOrder(instrument, MarginDirection.Sell, currentQuoteAsk! + 0.1);
            const order = await positionsHelper.waitForOrder(order => order.id === marginOrder.id);
            await order.cancel();
            expect(await waitForCondition(() => order.status === 'canceled'), "Invalid order status, must be canceled").true;
        });

        it('should close order', async () => {
            const marginOrder = await openOrder();
            const position = await positionsHelper.waitForPosition(position => position.orderIds.includes(marginOrder.id));
            await justWait(1000);
            await position.sell();
            expect(await waitForCondition(() => position.status === "closed"), "Position didn't close").to.be.true
            expect(position.closeProfit, "Close profit must be present after sell").not.to.be.undefined
        });
    });

    describe('Margin Forex', async () => {
        let marginForex: MarginForex;

        beforeAll(async () => {
            marginForex = await sdk.marginForex();
        });

        async function getUnderlyingInstrument() {
            const underlyingsAvailableForTradingAt = marginForex.getUnderlyingsAvailableForTradingAt(sdk.currentTime());
            expect(underlyingsAvailableForTradingAt.length, "Invalid underlyings available count").to.be.above(0);
            const marginUnderlying = underlyingsAvailableForTradingAt[0];
            expect(marginUnderlying, "Invalid MarginUnderlying instrument type").to.have.property("marginInstrumentType", "forex")
            const marginUnderlyingInstruments = await marginUnderlying.instruments();
            return marginUnderlyingInstruments.getAvailableForBuyAt(sdk.currentTime())[0];
        }

        async function openOrder(stopLoss: MarginTradingTPSL | null = null,
                                 takeProfit: MarginTradingTPSL | null = null,) {
            const availableForBuy = await getUnderlyingInstrument();
            const count = availableForBuy.minQty * 10 ** 5;
            return await marginForex.buy(availableForBuy, MarginDirection.Buy, count, demoBalance, stopLoss, takeProfit);
        }

        async function openStopPriceOrder(instrument: MarginUnderlyingInstrument,
                                          direction: MarginDirection,
                                          price: number,
                                          stopLoss: MarginTradingTPSL | null = null,
                                          takeProfit: MarginTradingTPSL | null = null,) {
            const count = instrument.minQty * 10 ** 5;
            return await marginForex.buyStop(instrument, direction, count, demoBalance, price, stopLoss, takeProfit);
        }

        async function openLimitPriceOrder(instrument: MarginUnderlyingInstrument,
                                           direction: MarginDirection,
                                           price: number,
                                           stopLoss: MarginTradingTPSL | null = null,
                                           takeProfit: MarginTradingTPSL | null = null,) {
            const count = instrument.minQty * 10 ** 5;
            return await marginForex.buyLimit(instrument, direction, count, demoBalance, price, stopLoss, takeProfit);
        }

        it('should return time to purchase', async () => {
            const availableForBuy = await getUnderlyingInstrument();
            const currentTime = sdk.currentTime().getTime();
            expect(availableForBuy.durationRemainingForPurchase(sdk.currentTime()), "Invalid time to purchase")
                .to.eq(availableForBuy.tradable.to.getTime() - currentTime)
        });

        it('should not create order if do not have money', async () => {
            const availableForBuy = await getUnderlyingInstrument();
            await expect(marginForex.buy(availableForBuy, MarginDirection.Buy, 1, realBalance)).rejects
                .toThrow(`request is failed with status 4008 and message: create order: user_id: ${user.id} user_balance_id: ${realBalance.id} user balance has no deposits`)
        });

        it('should open market order', async () => {
            const marginOrder = await openOrder();
            expect(marginOrder.id, "Order must be present").to.be.not.null;
            const order = await positionsHelper.waitForOrder(order => order.id === marginOrder.id);
            expect(order.status, "Incorrect order status").eq("filled")
            const position = await positionsHelper.waitForPosition(position => position.orderIds.includes(marginOrder.id));
            expect(position, "Position doesn't present").to.be.not.undefined;
        });

        it('should open stop price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openStopPriceOrder(instrument, MarginDirection.Buy, currentQuoteAsk! + 0.001);
            expect(marginOrder.id, "Order doesn't present").to.be.not.undefined;
        });

        it('should cancel stop price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openStopPriceOrder(instrument, MarginDirection.Buy, currentQuoteAsk! + 0.1);
            const order = await positionsHelper.waitForOrder(order => order.id === marginOrder.id);
            await order.cancel()
            expect(await waitForCondition(() => order.status === 'canceled'), "Invalid order status, must be canceled").true;
        });

        it('should open limit price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openLimitPriceOrder(instrument, MarginDirection.Sell, currentQuoteAsk! + 0.001);
            expect(marginOrder.id, "Order doesn't present").to.be.not.undefined;
        });

        it('should cancel limit price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openLimitPriceOrder(instrument, MarginDirection.Sell, currentQuoteAsk! + 0.1);
            const order = await positionsHelper.waitForOrder(order => order.id === marginOrder.id);
            await order.cancel();
            expect(await waitForCondition(() => order.status === 'canceled'), "Invalid order status, must be canceled").true;
        });

        it('should close order', async () => {
            const marginOrder = await openOrder();
            const position = await positionsHelper.waitForPosition(position => position.orderIds.includes(marginOrder.id));
            await justWait(1000);
            await position.sell();
            expect(await waitForCondition(() => position.status === "closed"), "Position didn't close").to.be.true
            expect(position.closeProfit, "Close profit must be present after sell").not.to.be.undefined
        });
    });
});