import {
    Balance,
    ClientSdk,
    MarginCfd,
    MarginCrypto,
    MarginDirection,
    MarginForex,
    MarginTradingTPSL,
    MarginUnderlyingInstrument,
    Quotes
} from "../src";
import {getUserByTitle} from "./utils/userUtils";
import {User, WS_URL} from "./vars";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PositionsHelper} from "./utils/positionsHelper";
import {justWait, waitForCondition} from "./utils/waiters";
import {getCurrentQuote} from "./utils/utils";
import {getOAuthMethod} from "./utils/authHelper";

describe('Margin Forex/CFD/Crypto', () => {
    let sdk: ClientSdk;
    let user: User;
    let quotes: Quotes;
    let demoBalance: Balance;
    let realBalance: Balance;
    let positionsHelper: PositionsHelper;

    beforeAll(async () => {
        user = getUserByTitle('margin_user') as User;
        const {oauth, options} = getOAuthMethod(user);
        sdk = await ClientSdk.create(WS_URL, 82, oauth, options)
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
        expect(await sdk.marginCfdIsAvailable(), 'Margin CFD must be available').to.eq(true);
    });

    it('Margin Crypto instrument should be available', async () => {
        expect(await sdk.marginCryptoIsAvailable(), 'Margin Crypto must be available').to.eq(true);
    });

    it('Margin Forex instrument should be available', async () => {
        expect(await sdk.marginForexIsAvailable(), 'Margin Forex must be available').to.eq(true);
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

        it('should be singleton object', async () => {
            const {oauth, options} = getOAuthMethod(user);
            sdk = await ClientSdk.create(WS_URL, 82, oauth, options)
            const [marginCfd1, marginCfd2] = await Promise.all([
                sdk.marginCfd(),
                sdk.marginCfd(),
            ]);
            expect(marginCfd1, "marginCfd facade differ").eq(marginCfd2)
        });

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
            expect(marginOrder.id, "Order must be present").to.not.eq(null);
            const order = await positionsHelper.waitForOrder(order => order.id === marginOrder.id);
            expect(order.status, "Incorrect order status").eq("filled")
            const position = await positionsHelper.waitForPosition(position => position.orderIds.includes(marginOrder.id));
            expect(position, "Position doesn't present").to.not.eq(undefined);
            expect(position.internalId).eq(order.positionId, "Invalid internal position_id")
        });

        it('should open stop price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openStopPriceOrder(instrument, MarginDirection.Buy, currentQuoteAsk! + 0.001);
            expect(marginOrder.id, "Order doesn't present").to.not.eq(undefined);
        });

        it('should cancel stop price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openStopPriceOrder(instrument, MarginDirection.Buy, currentQuoteAsk! + 1.1);
            const order = await positionsHelper.waitForOrder(order => order.id === marginOrder.id);
            await order.cancel();
            expect(await waitForCondition(() => order.status === 'canceled', 20000),
                `Invalid order status, must be canceled, but was ${order.status}`).eq(true);
        });

        it('should open limit price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openLimitPriceOrder(instrument, MarginDirection.Sell, currentQuoteAsk! + 0.001);
            expect(marginOrder.id, "Order doesn't present").to.not.eq(undefined);
        });

        it('should cancel limit price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openLimitPriceOrder(instrument, MarginDirection.Sell, currentQuoteAsk! + 1.1);
            const order = await positionsHelper.waitForOrder(order => order.id === marginOrder.id);
            await order.cancel();
            expect(await waitForCondition(() => order.status === 'canceled', 20000),
                `Invalid order status, must be canceled, but was ${order.status}`).eq(true);
        });

        it('should close order', async () => {
            const marginOrder = await openOrder();
            const position = await positionsHelper.waitForPosition(position => position.orderIds.includes(marginOrder.id));
            await justWait(1000);
            await position.sell();
            expect(await waitForCondition(() => position.status === "closed", 20000), "Position didn't close").to.eq(true)
            expect(position.closeProfit, "Close profit must be present after sell").to.not.eq(undefined)
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

        it('should be singleton object', async () => {
            const {oauth, options} = getOAuthMethod(user);
            sdk = await ClientSdk.create(WS_URL, 82, oauth, options)
            const [marginCrypto1, marginCrypto2] = await Promise.all([
                sdk.marginCrypto(),
                sdk.marginCrypto(),
            ]);
            expect(marginCrypto1, "marginCrypto facade differ").eq(marginCrypto2)
        });

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
            expect(marginOrder.id, "Order must be present").to.not.eq(null);
            const order = await positionsHelper.waitForOrder(order => order.id === marginOrder.id);
            expect(order.status, "Incorrect order status").eq("filled")
            const position = await positionsHelper.waitForPosition(position => position.orderIds.includes(marginOrder.id));
            expect(position, "Position doesn't present").to.not.eq(undefined);
        });

        it('should open stop price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openStopPriceOrder(instrument, MarginDirection.Buy, currentQuoteAsk! + 0.001);
            expect(marginOrder.id, "Order doesn't present").to.not.eq(undefined);
        });

        it('should cancel stop price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openStopPriceOrder(instrument, MarginDirection.Buy, currentQuoteAsk! + 0.1);
            const order = await positionsHelper.waitForOrder(order => order.id === marginOrder.id);
            await order.cancel()
            expect(await waitForCondition(() => order.status === 'canceled', 20000),
                `Invalid order status, must be canceled, but was ${order.status}`).eq(true);
        });

        it('should open limit price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openLimitPriceOrder(instrument, MarginDirection.Sell, currentQuoteAsk! + 0.001);
            expect(marginOrder.id, "Order doesn't present").to.not.eq(undefined);
        });

        it('should cancel limit price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openLimitPriceOrder(instrument, MarginDirection.Sell, currentQuoteAsk! + 1.1);
            expect(marginOrder.id, "Margin order id must be present").to.not.eq(undefined);
            const order = await positionsHelper.waitForOrder(order => order.id === marginOrder.id);
            await order.cancel();
            expect(await waitForCondition(() => order.status === 'canceled', 20000),
                `Invalid order status, must be canceled, but was ${order.status}`).eq(true);
        });

        it('should close order', async () => {
            const marginOrder = await openOrder();
            const position = await positionsHelper.waitForPosition(position => position.orderIds.includes(marginOrder.id));
            await justWait(1000);
            await position.sell();
            expect(await waitForCondition(() => position.status === "closed", 20000), "Position didn't close").to.eq(true)
            expect(position.closeProfit, "Close profit must be present after sell").to.not.eq(undefined)
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

        it('should be singleton object', async () => {
            const {oauth, options} = getOAuthMethod(user);
            sdk = await ClientSdk.create(WS_URL, 82, oauth, options)
            const [marginForex1, marginForex2] = await Promise.all([
                sdk.marginForex(),
                sdk.marginForex(),
            ]);
            expect(marginForex1, "marginForex facade differ").eq(marginForex2)
        });

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
            expect(marginOrder.id, "Order must be present").to.not.eq(null);
            const order = await positionsHelper.waitForOrder(order => order.id === marginOrder.id);
            expect(order.status, "Incorrect order status").eq("filled")
            const position = await positionsHelper.waitForPosition(position => position.orderIds.includes(marginOrder.id));
            expect(position, "Position doesn't present").to.not.eq(undefined);
        });

        it('should open stop price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openStopPriceOrder(instrument, MarginDirection.Buy, currentQuoteAsk! + 0.001);
            expect(marginOrder.id, "Order doesn't present").to.not.eq(undefined);
        });

        it('should cancel stop price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openStopPriceOrder(instrument, MarginDirection.Buy, currentQuoteAsk! + 0.1);
            const order = await positionsHelper.waitForOrder(order => order.id === marginOrder.id);
            await order.cancel()
            expect(await waitForCondition(() => order.status === 'canceled', 20000),
                `Invalid order status, must be canceled, but was ${order.status}`).eq(true);
        });

        it('should open limit price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openLimitPriceOrder(instrument, MarginDirection.Sell, currentQuoteAsk! + 0.001);
            expect(marginOrder.id, "Order doesn't present").to.not.eq(undefined);
        });

        it('should cancel limit price order', async () => {
            const instrument = await getUnderlyingInstrument();
            const currentQuoteAsk = (await getCurrentQuote(quotes, instrument.activeId)).ask;
            const marginOrder = await openLimitPriceOrder(instrument, MarginDirection.Sell, currentQuoteAsk! + 1.1);
            const order = await positionsHelper.waitForOrder(order => order.id === marginOrder.id);
            await order.cancel();
            expect(await waitForCondition(() => order.status === 'canceled', 20000),
                `Invalid order status, must be canceled, but was ${order.status}`).eq(true);
        });

        it('should close order', async () => {
            const marginOrder = await openOrder();
            const position = await positionsHelper.waitForPosition(position => position.orderIds.includes(marginOrder.id));
            await justWait(1000);
            await position.sell();
            expect(await waitForCondition(() => position.status === "closed", 20000), "Position didn't close").to.eq(true)
            expect(position.closeProfit, "Close profit must be present after sell").to.not.eq(undefined)
        })
    })
})

/**
 * E2E for {@link MarginForex.calculateMargin} (+ CFD/Crypto) against the real backend.
 *
 * Kept in this file (not a separate spec) on purpose: it shares the `margin_user` demo account with the
 * suite above, and vitest runs files in parallel — separate files would race on account state (one opens
 * orders / reserves margin while the other asserts a flat book). Sibling describes in ONE file run
 * sequentially, so the shared account is never touched concurrently while other spec files stay parallel.
 *
 * Runs in CI only: `getOAuthMethod` reads tokens from Upstash Redis and the suite needs live WS to
 * the trading backend — neither is available offline.
 *
 * Two layers of assertions:
 *  - Number-pinning: forex margin re-derived from public inputs (count, leverage, EURUSD bid), and the
 *    backend-reserved account margin (`Balance.margin`) cross-checked against `calc.margin` after a real
 *    market order. These catch off-by-leverage and missing-conversion bugs.
 *  - Self-consistency: pipValue/pnlForTPSL arithmetic, and the refreshable-update contract.
 *
 * Known coverage gap (see PR notes): with a USD demo balance, `*USD` cfd/crypto pairs hit the
 * `account===quote` branch (no exchange-rate division), so the cfd/crypto ÷ASK conversion path is only
 * exercised if a non-USD-quoted instrument is available. The backend cross-check still validates the
 * total number in every case.
 */
describe('Margin calculateMargin (real backend)', () => {
    let sdk: ClientSdk;
    let user: User;
    let quotes: Quotes;
    let demoBalance: Balance;
    let positionsHelper: PositionsHelper;
    let marginForex: MarginForex;
    let marginCfd: MarginCfd;
    let marginCrypto: MarginCrypto;

    beforeAll(async () => {
        user = getUserByTitle('margin_user') as User;
        const {oauth, options} = getOAuthMethod(user);
        sdk = await ClientSdk.create(WS_URL, 82, oauth, options);
        const balances = await sdk.balances();
        quotes = await sdk.quotes();
        demoBalance = balances.getBalances().filter(value => value.type === "demo")[0];
        positionsHelper = await PositionsHelper.create(sdk);
        [marginForex, marginCfd, marginCrypto] = await Promise.all([
            sdk.marginForex(),
            sdk.marginCfd(),
            sdk.marginCrypto(),
        ]);
        await positionsHelper.closeOpenedPositions();
        await demoBalance.resetDemoBalance();
    });

    afterAll(async () => {
        await sdk.shutdown();
    });

    async function tryFirstInstrument(
        facade: MarginForex | MarginCfd | MarginCrypto,
    ): Promise<MarginUnderlyingInstrument | undefined> {
        const underlyings = facade.getUnderlyingsAvailableForTradingAt(sdk.currentTime());
        if (underlyings.length === 0) {
            return undefined;
        }
        const instruments = await underlyings[0].instruments();
        return instruments.getAvailableForBuyAt(sdk.currentTime())[0];
    }

    // count must match what buy() expects: a quantity multiplied by the instrument lot size.
    function countFor(instrument: MarginUnderlyingInstrument): number {
        return instrument.minQty * instrument.lotSize;
    }

    // Opens one market Buy on a flat demo book and asserts the backend-reserved account margin
    // (Balance.margin, only meaningful with a single open position) matches calc.margin within 3%.
    async function backendCrossCheck(
        facade: MarginForex | MarginCfd | MarginCrypto,
        type: 'forex' | 'cfd' | 'crypto',
    ): Promise<void> {
        const instrument = await tryFirstInstrument(facade);
        if (!instrument) {
            console.warn(`[margin e2e] no tradable ${type} instrument right now — skipping cross-check`);
            return;
        }
        const count = countFor(instrument);

        expect(await waitForCondition(() => (demoBalance.margin ?? 0) === 0, 10000),
            `${type}: demo book not flat before open`).to.eq(true);

        const calc = await facade.calculateMargin(instrument, count, demoBalance, MarginDirection.Buy);
        // calculateMargin resolves only once the first quote/rate tick has filled the numbers.
        expect(calc.margin, `${type}: calc.margin not ready after calculateMargin resolved`).to.not.eq(undefined);
        const calcMargin = calc.margin!;
        expect(Number.isFinite(calcMargin), `${type}: calc.margin not finite`).to.eq(true);
        expect(calcMargin, `${type}: calc.margin not positive`).to.be.above(0);

        // CFD/Crypto with account === quote: margin = (count/leverage) * ask, no exchange-rate division.
        // (Forex is re-derived separately in its own test — it uses the exchange-rate bid, not the quote.)
        const {quote} = await instrument.getCurrencyPair();
        const usesConversion = quote.toUpperCase() !== demoBalance.currency.toUpperCase();
        if (type !== 'forex' && !usesConversion) {
            const leverage = instrument.calculateLeverageProfile(demoBalance);
            const currentQuote = await getCurrentQuote(quotes, instrument.activeId, 5000);
            const expected = (count / leverage) * currentQuote.ask!;
            expect(Math.abs(calcMargin - expected) / expected,
                `${type}: no-conversion re-derivation calc=${calcMargin} expected=${expected}`).to.be.below(0.02);
        }

        const order = await facade.buy(instrument, MarginDirection.Buy, count, demoBalance);
        const placedOrder = await positionsHelper.waitForOrder(o => o.id === order.id);
        expect(placedOrder.status, `${type}: order not filled`).to.eq('filled');
        const position = await positionsHelper.waitForPosition(p => p.orderIds.includes(order.id));
        expect(position, `${type}: position missing`).to.not.eq(undefined);

        expect(await waitForCondition(() => (demoBalance.margin ?? 0) > 0, 10000),
            `${type}: account margin never went positive after open`).to.eq(true);

        expect(Math.abs(demoBalance.margin! - calcMargin) / calcMargin,
            `${type} (conversion=${usesConversion}): backend margin=${demoBalance.margin} calc=${calcMargin}`)
            .to.be.below(0.03);

        await justWait(1000);
        await position.sell();
        expect(await waitForCondition(() => position.status === 'closed', 20000),
            `${type}: position did not close`).to.eq(true);
        expect(await waitForCondition(() => (demoBalance.margin ?? 0) === 0, 20000),
            `${type}: account margin did not return to 0`).to.eq(true);
    }

    it('forex: margin and pipValue match the formula re-derived from public inputs', async () => {
        const instrument = await tryFirstInstrument(marginForex);
        expect(instrument, 'no tradable forex instrument right now').to.not.eq(undefined);

        const {base, quote} = await instrument!.getCurrencyPair();
        const account = demoBalance.currency.toUpperCase();
        // Re-derivation is only valid for the EUR/USD-on-USD shape: account === quote (no pip division)
        // and base !== account (the base/account BID-multiply branch). margin_user demo is USD.
        expect(quote.toUpperCase(), 'expected quote currency == account currency (USD)').to.eq(account);
        expect(base.toUpperCase(), 'expected base currency != account currency').to.not.eq(account);

        const count = countFor(instrument!);
        const leverage = instrument!.calculateLeverageProfile(demoBalance);
        expect(leverage, 'leverage must be > 0').to.be.above(0);

        const calc = await marginForex.calculateMargin(instrument!, count, demoBalance, MarginDirection.Buy);
        // calculateMargin resolves only once the EUR/USD exchange-rate tick has filled margin.
        expect(calc.margin, 'calc.margin not ready after calculateMargin resolved').to.not.eq(undefined);

        // calc.margin uses the EUR/USD exchange-rate bid; the instrument quote bid tracks the same price
        // from a different feed, so compare within 2% (drift between the two feeds + time).
        const currentQuote = await getCurrentQuote(quotes, instrument!.activeId, 5000);
        expect(currentQuote.bid, 'quote bid missing').to.not.eq(undefined);
        const expectedMargin = (count / leverage) * currentQuote.bid!;
        expect(Number.isFinite(calc.margin!)).to.eq(true);
        expect(calc.margin!).to.be.above(0);
        expect(Math.abs(calc.margin! - expectedMargin) / expectedMargin,
            `calc=${calc.margin} expected=${expectedMargin} (leverage=${leverage} bid=${currentQuote.bid})`)
            .to.be.below(0.02);

        // account === quote, so pipValue = 10^-pipScale * count (no division) — exact.
        const pipScale = await instrument!.getPipScale();
        const pip = Math.pow(10, -pipScale);
        const expectedPipValue = pip * count;
        expect(calc.pipValue, 'pipValue undefined').to.not.eq(undefined);
        expect(Number.isFinite(calc.pipValue!)).to.eq(true);
        expect(calc.pipValue!).to.be.above(0);
        expect(Math.abs(calc.pipValue! - expectedPipValue) / expectedPipValue).to.be.below(1e-6);

        // pnlForTPSL (Buy): +N pips => +N*pipValue, -N pips => -that.
        const open = currentQuote.ask ?? currentQuote.value!;
        const n = 10;
        const up = calc.pnlForTPSL(open, open + n * pip)!;
        const down = calc.pnlForTPSL(open, open - n * pip)!;
        expect(up).to.be.above(0);
        expect(Math.abs(up - n * calc.pipValue!) / (n * calc.pipValue!)).to.be.below(1e-6);
        expect(Math.abs(up + down)).to.be.below(Math.abs(up) * 1e-6 + 1e-9);
    });

    it('forex: backend-reserved account margin matches calc.margin', async () => {
        await backendCrossCheck(marginForex, 'forex');
    }, 60000);

    it('cfd: backend-reserved account margin matches calc.margin', async () => {
        await backendCrossCheck(marginCfd, 'cfd');
    }, 60000);

    it('crypto: backend-reserved account margin matches calc.margin', async () => {
        await backendCrossCheck(marginCrypto, 'crypto');
    }, 60000);

    it('forex: subscribeOnUpdate fires and margin stays finite and positive across a tick', async () => {
        const instrument = await tryFirstInstrument(marginForex);
        expect(instrument, 'no tradable forex instrument right now').to.not.eq(undefined);

        const count = countFor(instrument!);
        const calc = await marginForex.calculateMargin(instrument!, count, demoBalance, MarginDirection.Buy);
        expect(calc.margin, 'calc.margin not ready after calculateMargin resolved').to.not.eq(undefined);

        let fired = 0;
        let stayedValid = true;
        calc.subscribeOnUpdate(c => {
            fired++;
            if (!(Number.isFinite(c.margin!) && c.margin! > 0)) {
                stayedValid = false;
            }
        });
        expect(await waitForCondition(() => fired > 0, 8000), 'no update tick within 8s').to.eq(true);
        expect(stayedValid, 'margin became invalid on a tick').to.eq(true);
        expect(Number.isFinite(calc.margin!) && calc.margin! > 0).to.eq(true);
    });
})