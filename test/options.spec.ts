import {
    Balance,
    BinaryOptions,
    BinaryOptionsActiveInstrument,
    BinaryOptionsDirection,
    BlitzOptions,
    BlitzOptionsDirection,
    DigitalOptions,
    DigitalOptionsDirection,
    DigitalOptionsOrder,
    DigitalOptionsUnderlyingInstrument,
    LoginPasswordAuthMethod,
    QuadcodeClientSdk,
    TurboOptions,
    TurboOptionsActiveInstrument,
    TurboOptionsDirection
} from "../src";
import {getUserByTitle} from "./utils/userUtils";
import {User} from "./data/types";
import {expect} from "chai";
import {justWait, waitForCondition} from "./utils/waiters";
import {PositionsHelper} from "./utils/positionsHelper";

describe('Options', () => {
    let sdk: QuadcodeClientSdk;
    let positionsHelper: PositionsHelper;
    let demoBalance: Balance;
    let realBalance: Balance;

    before(async () => {
        const user = getUserByTitle('regular_user') as User;
        const wsURL = process.env.WS_URL as string;
        const apiUrl = process.env.API_URL as string;
        sdk = await QuadcodeClientSdk.create(wsURL, 82, new LoginPasswordAuthMethod(apiUrl, user.email, user.password));
        const balances = await sdk.balances();
        demoBalance = balances.getBalances().filter(value => value.type === "demo")[0];
        realBalance = balances.getBalances().filter(value => value.type === "real")[0];
        positionsHelper = await PositionsHelper.create(sdk);
    });

    after(async function () {
        await sdk.shutdown();
    });

    describe('Binary-options', () => {
        let binaryOptions: BinaryOptions;

        before(async () => {
            binaryOptions = await sdk.binaryOptions();
        });

        it('should return binary option actives', async () => {
            expect(binaryOptions.getActives().length).to.be.above(0);
        });

        describe('Getting binary-option instruments', async () => {
            let instruments: BinaryOptionsActiveInstrument[];

            before(async () => {
                const actives = binaryOptions.getActives();
                const first = actives[0];
                const binaryOptionsActiveInstruments = await first.instruments();
                const currentTime = sdk.currentTime()
                instruments = binaryOptionsActiveInstruments.getAvailableForBuyAt(currentTime);
            });

            function getAvailableInstrument() {
                return instruments.filter(value => value.durationRemainingForPurchase(sdk.currentTime()) > 1000)[0];
            }

            it('should return instruments array', () => {
                expect(instruments, 'Invalid binary-option instruments count').to.be.a('array').with.length.above(0);
            });

            it('should return valid purchaseEndTime', () => {
                const firstInstrument = getAvailableInstrument();
                expect(firstInstrument.purchaseEndTime().getTime(), 'Invalid purchase end time')
                    .to.closeTo(firstInstrument.expiredAt.getTime() - firstInstrument.deadtime * 1000, 0)
            });

            it('should return valid purchaseEndTime for End of Week expiration', () => {
                const instrument = instruments.find(value => value.expirationSize === 'front.End of month');
                if (!instrument)
                    throw new Error("Instrument with 'End of Month' expiration must be present")
                expect(instrument.purchaseEndTime().getTime(), "Invalid purchase end time").to.be.eq(instrument.expiredAt.getTime() - instrument.deadtime * 1000)
            });

            it('should return valid durationRemainingForPurchase', () => {
                const firstInstrument = getAvailableInstrument();
                const currentTime = sdk.currentTime();
                expect(firstInstrument.durationRemainingForPurchase(currentTime), 'Invalid duration remaining for purchase')
                    .to.eq(firstInstrument.purchaseEndTime().getTime() - currentTime.getTime())
            });

            describe('Buy option', () => {

                it('insufficient funds for this transaction', async () => {
                    const firstInstrument = getAvailableInstrument();
                    await expect(binaryOptions.buy(firstInstrument, BinaryOptionsDirection.Put, 10, realBalance))
                        .to.eventually.be.rejectedWith("Insufficient funds for this transaction.")
                });

                async function openOption() {
                    const firstInstrument = getAvailableInstrument();
                    expect(firstInstrument.profitCommissionPercent, 'ProfitCommissionPercent is not specified').not.to.be.null
                    const binaryOption = await binaryOptions.buy(firstInstrument, BinaryOptionsDirection.Call, 10, demoBalance);
                    expect(binaryOption.id, 'Option id should be not null').to.be.not.null
                    return await positionsHelper.waitForPosition((position) => position.orderIds.includes(binaryOption.id));
                }

                it('should be opened', async () => {
                    const position = await openOption();
                    expect(position.externalId, 'Position must be present').to.be.not.null
                });

                it('should be sold', async () => {
                    const position = await openOption();
                    expect(positionsHelper.findPosition(position.externalId), 'Position must be present in all positions').not.to.be.undefined
                    await justWait(3000);
                    await position.sell();
                    expect(await waitForCondition(() => position.status === "closed", 2000)).to.be.true;
                    expect(position.closeReason, "Invalid close reason").eq("sold");
                    expect(position.sellProfit, "Sell profit must be present").not.be.null;
                    expect(positionsHelper.findHistoryPosition(position.externalId), 'Position must be present in history positions').not.to.be.undefined
                    expect(positionsHelper.findPosition(position.externalId), 'Position must be not present in all positions').to.be.undefined
                });
            });
        });
    });
    describe('Turbo-options', () => {

        let turboOptions: TurboOptions;

        before(async () => {
            turboOptions = await sdk.turboOptions();
        });

        it('should return turbo option actives', async () => {
            expect(turboOptions.getActives().length).to.be.above(0);
        });

        describe('Getting turbo-option instruments', async () => {
            let instruments: TurboOptionsActiveInstrument[];

            before(async () => {
                const actives = turboOptions.getActives();
                const first = actives[0];
                const turboOptionsActiveInstruments = await first.instruments();
                const currentTime = sdk.currentTime()
                instruments = turboOptionsActiveInstruments.getAvailableForBuyAt(currentTime);
            });

            function getAvailableInstrument() {
                return instruments.filter(value => value.durationRemainingForPurchase(sdk.currentTime()) > 1000)[0];
            }

            it('should return instruments array', () => {
                expect(instruments, 'Invalid turbo-option instruments count').to.be.a('array').with.length.above(0);
            });

            it('should return valid purchaseEndTime', () => {
                const firstInstrument = getAvailableInstrument();
                expect(firstInstrument.purchaseEndTime().getTime(), 'Invalid purchase end time')
                    .to.closeTo(firstInstrument.expiredAt.getTime() - firstInstrument.deadtime * 1000, 0)
            });

            it('should return valid durationRemainingForPurchase', () => {
                const firstInstrument = getAvailableInstrument();
                const currentTime = sdk.currentTime();
                expect(firstInstrument.durationRemainingForPurchase(currentTime), 'Invalid duration remaining for purchase')
                    .to.eq(firstInstrument.purchaseEndTime().getTime() - currentTime.getTime())
            });

            describe('Buy option', () => {

                it('insufficient funds for this transaction', async () => {
                    const firstInstrument = getAvailableInstrument();
                    await expect(turboOptions.buy(firstInstrument, TurboOptionsDirection.Call, 10, realBalance))
                        .to.eventually.be.rejectedWith("Insufficient funds for this transaction.")
                });

                async function openOption() {
                    const firstInstrument = getAvailableInstrument();
                    expect(firstInstrument.profitCommissionPercent, 'ProfitCommissionPercent is not specified').not.to.be.null
                    const turboOption = await turboOptions.buy(firstInstrument, TurboOptionsDirection.Call, 1, demoBalance);
                    expect(turboOption.id, 'Option id should be not null').not.to.be.null
                    return await positionsHelper.waitForPosition((position) => position.orderIds.includes(turboOption.id));
                }

                it('should be opened', async () => {
                    const position = await openOption();
                    expect(position.externalId, 'Position must be present').not.to.be.null
                });

                it('position should be updated by position-state event', async () => {
                    const position = await openOption();
                    expect(position.currentQuoteTimestamp, 'currentQuoteTimestamp must be present').to.be.not.null
                    expect(position.pnlNet, 'pnlNet must be present').to.be.not.null
                    expect(position.sellProfit, 'sellProfit must be present').not.to.be.null
                });

                it('should be sold', async () => {
                    const position = await openOption();
                    expect(positionsHelper.findPosition(position.externalId), 'Position must be present in all positions').not.to.be.undefined
                    await justWait(3000);
                    await position.sell();
                    expect(await waitForCondition(() => position.status === "closed", 2000)).to.be.true;
                    expect(position.closeReason, "Invalid close reason").eq("sold");
                    expect(position.sellProfit, "Sell profit must be present").not.be.null;
                    expect(positionsHelper.findHistoryPosition(position.externalId), 'Position must be present in history positions').not.to.be.undefined
                    expect(positionsHelper.findPosition(position.externalId), 'Position must be not present in all positions').to.be.undefined
                }).timeout(7000);
            });
        });
    });
    describe('Blitz-options', () => {
        let blitzOptions: BlitzOptions;

        before(async () => {
            blitzOptions = await sdk.blitzOptions();
        });

        it('should return blitz option actives', async () => {
            expect(blitzOptions.getActives().length, 'Invalid blitz-option actives count').to.be.above(0);
        });

        describe('Buy option', () => {

            it('insufficient funds for this transaction', async () => {
                const active = blitzOptions.getActives()[0];
                const expirationSize = active.expirationTimes[0];
                await expect(blitzOptions.buy(active, BlitzOptionsDirection.Put, expirationSize, 10, realBalance))
                    .to.eventually.be.rejectedWith("Insufficient funds for this transaction.")
            });

            async function openOption() {
                const active = blitzOptions.getActives()[0];
                expect(active.profitCommissionPercent, 'ProfitCommissionPercent is not specified').not.to.be.null
                const expirationSize = active.expirationTimes[0];
                const blitzOption = await blitzOptions.buy(active, BlitzOptionsDirection.Call, expirationSize, 10, demoBalance);
                expect(blitzOption.id, 'Option id should be not null').to.be.not.null
                return await positionsHelper.waitForPosition((position) => position.orderIds.includes(blitzOption.id), 5000);
            }

            it('should be opened', async () => {
                const position = await openOption();
                expect(position.externalId, 'Position must be present').to.be.not.null
            });

            describe('Expiration', () => {

                it('should expired', async () => {
                    const position = await openOption();
                    expect(await waitForCondition(() => position.closeReason !== undefined, 7000)).to.be.true;
                    expect(position.closeReason, 'Invalid close reason').to.be.oneOf(["win", "equal", "loose"])
                    expect(positionsHelper.findHistoryPosition(position.externalId), 'Position must be present in history positions').not.to.be.undefined
                    expect(positionsHelper.findPosition(position.externalId), 'Position must be not present in all positions').to.be.undefined
                }).timeout(10000);

                it('should not be sold', async () => {
                    const position = await openOption();
                    await justWait(1000);
                    await expect(position.sell()).to.eventually.be.rejectedWith("Blitz options are not supported")
                });

            });
        });
    });
    describe('Digital-options', () => {
        let digitalOptions: DigitalOptions;

        before(async () => {
            digitalOptions = await sdk.digitalOptions();
        });

        it('should return digital option actives', async () => {
            expect(digitalOptions.getUnderlyingsAvailableForTradingAt(sdk.currentTime()).length).to.be.above(0);
        });

        describe('Getting digital-option instruments', async () => {
            let availableInstruments: DigitalOptionsUnderlyingInstrument[];

            function findInstrumentByPeriod(period: number) {
                const instrument = availableInstruments.find(instr => instr.period === period
                    && instr.durationRemainingForPurchase(sdk.currentTime()) > 1000);
                if (!instrument)
                    throw new Error('Instrument with period ${period} wasn\'t found');
                return instrument;
            }

            before(async () => {
                const underlyings = digitalOptions.getUnderlyingsAvailableForTradingAt(sdk.currentTime())
                const first = underlyings[0];
                const instruments = await first.instruments();
                availableInstruments = instruments.getAvailableForBuyAt(sdk.currentTime());
            });

            it('should return instruments array', () => {
                expect(availableInstruments, 'Invalid digital-option instruments count').to.be.a('array').with.length.above(0);
            });

            it('should return valid purchaseEndTime', () => {
                const firstInstrument = availableInstruments[0];
                expect(firstInstrument.purchaseEndTime().getTime(), 'Invalid purchase end time')
                    .to.closeTo(firstInstrument.expiration.getTime() - firstInstrument.deadtime * 1000, 0)
            });

            it('should return valid durationRemainingForPurchase', () => {
                const firstInstrument = availableInstruments[0];
                const currentTime = sdk.currentTime();
                expect(firstInstrument.durationRemainingForPurchase(currentTime), 'Invalid duration remaining for purchase')
                    .to.eq(firstInstrument.purchaseEndTime().getTime() - currentTime.getTime())
            });

            it('should return ask/bid prices if subscribed', async () => {
                const instrument = availableInstruments.find(instr => instr.period === 300);
                if (!instrument)
                    throw new Error("Instrument with 5min expiration wasn't found");
                const strikes = Array.from(instrument.strikes.values());
                expect(strikes.filter(value => value.bid !== undefined || value.ask !== undefined),
                    'Strikes should not have ask/bid prices').lengthOf(0)

                await instrument.subscribeOnStrikesAskBidPrices();
                await new Promise(resolve => setTimeout(resolve, 1000)) // wait 1 sec

                const strikesWithPrices = Array.from(instrument.strikes.values())
                    .filter(value => value.bid !== undefined || value.ask !== undefined);
                expect(strikesWithPrices.length, 'Strikes must have ask/bid prices').eq(strikes.length)
            });

            describe('Buy option', () => {

                it("ignore insufficient funds for this transaction because it's order", async () => {
                    const firstInstrument = findInstrumentByPeriod(60);
                    await expect(digitalOptions.buySpotStrike(firstInstrument, DigitalOptionsDirection.Call, 10, realBalance))
                        .to.eventually.be.an.instanceof(DigitalOptionsOrder)
                });

                async function createOpenOrder() {
                    const instrument = findInstrumentByPeriod(60);
                    const order = await digitalOptions.buySpotStrike(instrument, DigitalOptionsDirection.Call, 1, demoBalance);
                    expect(order.id, 'Option id should be not null').to.be.not.null
                    const position = await positionsHelper.waitForPosition((position) => position.orderIds.includes(order.id));
                    expect(position.externalId, 'Position must be present').to.be.not.null
                    return {order, position};
                }

                it('should be sold', async () => {
                    const {position} = await createOpenOrder();
                    expect(positionsHelper.findPosition(position.externalId), 'Position must be present in all positions').not.to.be.undefined
                    await justWait(3000);
                    await position.sell();
                    expect(await waitForCondition(() => position.status === "closed", 3000)).to.be.true;
                    expect(position.status, "Invalid status").eq("closed");
                    expect(position.closeReason, "Close reason must be default").eq("default");
                    expect(positionsHelper.findHistoryPosition(position.externalId), 'Position must be present in history positions').not.to.be.undefined
                    expect(positionsHelper.findPosition(position.externalId), 'Position must be not present in all positions').to.be.undefined
                }).timeout(10000);
            });
        });
    });
});

