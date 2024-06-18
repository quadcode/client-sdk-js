import {
    Balance,
    CurrentQuote,
    LoginPasswordAuthMethod,
    MarginCfd,
    MarginCrypto,
    MarginDirection,
    MarginForex,
    MarginTradingTPSL,
    MarginUnderlyingInstrument,
    QuadcodeClientSdk,
    Quotes
} from "../src";
import {getUserByTitle} from "./utils/userUtils";
import {User} from "./data/types";
import {expect} from "chai";
import {PositionsHelper} from "./utils/positionsHelper";
import {justWait, waitForCondition} from "./utils/waiters";

describe('Margin Forex/CFD/Crypto', () => {
    let sdk: QuadcodeClientSdk;
    let user: User;
    let quotes: Quotes;
    let demoBalance: Balance;
    let realBalance: Balance;
    let positionsHelper: PositionsHelper;

    before(async () => {
        user = getUserByTitle('margin_user') as User;
        const wsURL = process.env.WS_URL as string;
        const apiUrl = process.env.API_URL as string;
        sdk = await QuadcodeClientSdk.create(wsURL, 82, new LoginPasswordAuthMethod(apiUrl, user.email, user.password));
        const balances = await sdk.balances();
        quotes = await sdk.quotes();
        demoBalance = balances.getBalances().filter(value => value.type === "demo")[0];
        realBalance = balances.getBalances().filter(value => value.type === "real")[0];
        positionsHelper = await PositionsHelper.create(sdk);
        await positionsHelper.closeOpenedPositions()
        await demoBalance.resetDemoBalance()
    });

    after(async function () {
        await sdk.shutdown();
    });

    async function getCurrentQuote(activeId: number, timeout: number = 1000): Promise<CurrentQuote> {
        const currentQuote = await quotes.getCurrentQuoteForActive(activeId);
        return await new Promise((resolve, reject) => {
            setTimeout(() => {
                reject(new Error("Quote not found within timeout " + timeout));
            }, timeout);
            currentQuote.subscribeOnUpdate((quote) => {
                resolve(quote)
            })
        });
    }

    describe('Margin CFD', async () => {
        let marginCFD: MarginCfd;

        before(async () => {
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
            await expect(marginCFD.buy(availableForBuy, MarginDirection.Buy, 1, realBalance))
                .to.eventually.be.rejectedWith(`request is failed with status 4008 and message: create order: user_id: ${user.id} user_balance_id: ${realBalance.id} user balance has no deposits`)
        });

        it('should open market order', async () => {
            const marginOrder = await openOrder();
            expect(marginOrder.id, "Order must be present").to.be.not.null;
            const position = await positionsHelper.waitForPosition(position => position.orderIds.includes(marginOrder.id));
            expect(position, "Position doesn't present").to.be.not.undefined;
        });

        it('should open stop price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(instrument.activeId)).ask;
            const marginOrder = await openStopPriceOrder(instrument, MarginDirection.Buy, currentQuoteAsk! + 0.001);
            expect(marginOrder.id, "Order doesn't present").to.be.not.undefined;
        });

        it('should open limit price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(instrument.activeId)).ask;
            const marginOrder = await openLimitPriceOrder(instrument, MarginDirection.Buy, currentQuoteAsk! + 0.001);
            expect(marginOrder.id, "Order doesn't present").to.be.not.undefined;
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

        before(async () => {
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
            await expect(marginCrypto.buy(availableForBuy, MarginDirection.Buy, 1, realBalance))
                .to.eventually.be.rejectedWith(`request is failed with status 4008 and message: create order: user_id: ${user.id} user_balance_id: ${realBalance.id} user balance has no deposits`)
        });

        it('should open market order', async () => {
            const marginOrder = await openOrder();
            expect(marginOrder.id, "Order must be present").to.be.not.null;
            const position = await positionsHelper.waitForPosition(position => position.orderIds.includes(marginOrder.id));
            expect(position, "Position doesn't present").to.be.not.undefined;
        });

        it('should open stop price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(instrument.activeId)).ask;
            const marginOrder = await openStopPriceOrder(instrument, MarginDirection.Buy, currentQuoteAsk! + 0.001);
            expect(marginOrder.id, "Order doesn't present").to.be.not.undefined;
        });

        it('should open limit price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(instrument.activeId)).ask;
            const marginOrder = await openLimitPriceOrder(instrument, MarginDirection.Buy, currentQuoteAsk! + 0.001);
            expect(marginOrder.id, "Order doesn't present").to.be.not.undefined;
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

        before(async () => {
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
            await expect(marginForex.buy(availableForBuy, MarginDirection.Buy, 1, realBalance))
                .to.eventually.be.rejectedWith(`request is failed with status 4008 and message: create order: user_id: ${user.id} user_balance_id: ${realBalance.id} user balance has no deposits`)
        });

        it('should open market order', async () => {
            const marginOrder = await openOrder();
            expect(marginOrder.id, "Order must be present").to.be.not.null;
            const position = await positionsHelper.waitForPosition(position => position.orderIds.includes(marginOrder.id));
            expect(position, "Position doesn't present").to.be.not.undefined;
        });

        it('should open stop price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(instrument.activeId)).ask;
            const marginOrder = await openStopPriceOrder(instrument, MarginDirection.Buy, currentQuoteAsk! + 0.001);
            expect(marginOrder.id, "Order doesn't present").to.be.not.undefined;
        });

        it('should open limit price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(instrument.activeId)).ask;
            const marginOrder = await openLimitPriceOrder(instrument, MarginDirection.Buy, currentQuoteAsk! + 0.001);
            expect(marginOrder.id, "Order doesn't present").to.be.not.undefined;
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