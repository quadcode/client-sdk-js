import {
    Balance,
    ClientSdk,
    MarginCfd,
    MarginCrypto,
    MarginDirection,
    MarginForex,
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

/**
 * E2E for {@link MarginForex.calculateMargin} (+ CFD/Crypto) against the real backend.
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
        expect(await waitForCondition(() => calc.margin !== undefined, 5000),
            `${type}: calc.margin never became defined`).to.eq(true);
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
        expect(await waitForCondition(() => calc.margin !== undefined, 5000),
            'calc.margin never became defined').to.eq(true);

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
        expect(await waitForCondition(() => calc.margin !== undefined, 5000)).to.eq(true);

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
});
