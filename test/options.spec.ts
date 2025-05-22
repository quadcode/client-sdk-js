import {
    Balance,
    BinaryOptions,
    BinaryOptionsActiveInstrument,
    BinaryOptionsDirection,
    BlitzOptions,
    BlitzOptionsDirection,
    ClientSdk,
    DigitalOptions,
    DigitalOptionsDirection,
    DigitalOptionsUnderlyingInstrument,
    LoginPasswordAuthMethod,
    TurboOptions,
    TurboOptionsActiveInstrument,
    TurboOptionsDirection
} from "../src";
import {getUserByTitle} from "./utils/userUtils";
import {API_URL, BASE_HOST, User, WS_URL} from "./vars";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {justWait, waitForCondition} from "./utils/waiters";
import {PositionsHelper} from "./utils/positionsHelper";

describe('Options', () => {
    let sdk: ClientSdk;
    let positionsHelper: PositionsHelper;
    let demoBalance: Balance;
    let realBalance: Balance;

    beforeAll(async () => {
        const user = getUserByTitle('regular_user') as User;
        const options = IS_BROWSER ? {host: BASE_HOST} : undefined;
        sdk = await ClientSdk.create(WS_URL, 82, new LoginPasswordAuthMethod(API_URL, user.email, user.password), options);
        const balances = await sdk.balances();
        demoBalance = balances.getBalances().filter(value => value.type === "demo")[0];
        realBalance = balances.getBalances().filter(value => value.type === "real")[0];
        positionsHelper = await PositionsHelper.create(sdk);
    });

    afterAll(async function () {
        await sdk.shutdown();
    });

    it('should binary option instrument be available', async () => {
        expect(await sdk.binaryOptionsIsAvailable(), 'Binary-option must be available').to.be.true;
    });

    it('should turbo option instrument be available', async () => {
        expect(await sdk.turboOptionsIsAvailable(), 'Turbo-option must be available').to.be.true;
    });

    it('should blitz option instrument be available', async () => {
        expect(await sdk.blitzOptionsIsAvailable(), 'Blitz-option must be available').to.be.true;
    });

    it('should digital option instrument be available', async () => {
        expect(await sdk.digitalOptionsIsAvailable(), 'Digital-option must be available').to.be.true;
    });

    describe('Binary-options', () => {
        let binaryOptions: BinaryOptions;

        beforeAll(async () => {
            binaryOptions = await sdk.binaryOptions();
        });

        it('should return binary option actives', async () => {
            expect(binaryOptions.getActives().length, 'Invalid binary-option actives count').to.be.above(0);
        });

        describe('Getting binary-option instruments', async () => {
            let instruments: BinaryOptionsActiveInstrument[];

            beforeAll(async () => {
                const currentTime = sdk.currentTime()
                const actives = binaryOptions.getActives();
                const active = actives.find(value => value.canBeBoughtAt(currentTime));
                if (active) {
                    const binaryOptionsActiveInstruments = await active.instruments();
                    instruments = binaryOptionsActiveInstruments.getAvailableForBuyAt(currentTime);
                }
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

            it('should return valid purchaseEndTime for End of Month expiration', () => {
                const instrument = instruments.find(value => value.expirationSize === 'front.End of month');
                if (!instrument)
                    console.error("Instrument with 'End of Month' expiration must be present. Test skipped")  // sometimes End of Month is not enabled
                else
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
                    await expect(binaryOptions.buy(firstInstrument, BinaryOptionsDirection.Put, 10, realBalance)).rejects
                        .toThrow("Insufficient funds for this transaction.")
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
                    expect(positionsHelper.findPositionByExternalId(position.externalId), 'Position must be present in all positions').not.to.be.undefined
                    await justWait(3000);
                    await position.sell();
                    expect(await waitForCondition(() => position.status === "closed", 3000), `Position [${position.externalId}] status is incorrect, now is "${position.status}"`).to.be.true;
                    expect(position.closeReason, "Invalid close reason").eq("sold");
                    expect(position.sellProfit, "Sell profit must be present").not.be.null;
                    expect(positionsHelper.findHistoryPosition(position.externalId), 'Position must be present in history positions').not.to.be.undefined
                    expect(positionsHelper.findPositionByExternalId(position.externalId), 'Position must be not present in all positions').to.be.undefined
                });
            });
        });
    });
    describe('Turbo-options', () => {

        let turboOptions: TurboOptions;

        beforeAll(async () => {
            turboOptions = await sdk.turboOptions();
        });

        it('should return turbo option actives', async () => {
            expect(turboOptions.getActives().length, 'Invalid turbo-option actives count').to.be.above(0);
        });

        describe('Getting turbo-option instruments', async () => {
            let instruments: TurboOptionsActiveInstrument[];

            beforeAll(async () => {
                const currentTime = sdk.currentTime()
                const actives = turboOptions.getActives();
                const active = actives.find(value => value.canBeBoughtAt(currentTime));
                if (active) {
                    const turboOptionsActiveInstruments = await active.instruments();
                    instruments = turboOptionsActiveInstruments.getAvailableForBuyAt(currentTime);
                }
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
                        .rejects.toThrow("Insufficient funds for this transaction.")
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
                    expect(positionsHelper.findPositionByExternalId(position.externalId), 'Position must be present in all positions').not.to.be.undefined
                    await justWait(3000);
                    await position.sell();
                    expect(await waitForCondition(() => position.status === "closed", 3000), `Position [${position.externalId}] status is incorrect, now is "${position.status}"`).to.be.true;
                    expect(position.closeReason, "Invalid close reason").eq("sold");
                    expect(position.sellProfit, "Sell profit must be present").not.be.null;
                    expect(positionsHelper.findHistoryPosition(position.externalId), 'Position must be present in history positions').not.to.be.undefined
                    expect(positionsHelper.findPositionByExternalId(position.externalId), 'Position must be not present in all positions').to.be.undefined
                }, 7000);
            });
        });
    });
    describe('Blitz-options', () => {
        let blitzOptions: BlitzOptions;

        beforeAll(async () => {
            blitzOptions = await sdk.blitzOptions();
        });

        it('should return blitz option actives', async () => {
            expect(blitzOptions.getActives().length, 'Invalid blitz-option actives count').to.be.above(0);
        });

        describe('Buy option', () => {

            it('insufficient funds for this transaction', async () => {
                const active = blitzOptions.getActives().find((a) => a.canBeBoughtAt(sdk.currentTime()));
                const expirationSize = active!.expirationTimes[0];
                await expect(blitzOptions.buy(active!, BlitzOptionsDirection.Put, expirationSize, 10, realBalance))
                    .rejects.toThrow("Insufficient funds for this transaction.")
            });

            async function openOption() {
                const active = blitzOptions.getActives().find((a) => a.canBeBoughtAt(sdk.currentTime()))
                expect(active!.profitCommissionPercent, 'ProfitCommissionPercent is not specified').not.to.be.null
                const expirationSize = active!.expirationTimes[0];
                const blitzOption = await blitzOptions.buy(active!, BlitzOptionsDirection.Call, expirationSize, 10, demoBalance);
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
                    expect(await waitForCondition(() => position.closeReason !== undefined, 35000)).to.be.true;
                    expect(position.closeReason, 'Invalid close reason').to.be.oneOf(["win", "equal", "loose"])
                    expect(positionsHelper.findHistoryPosition(position.externalId), 'Position must be present in history positions').not.to.be.undefined
                    expect(positionsHelper.findPositionByExternalId(position.externalId), 'Position must be not present in all positions').to.be.undefined
                });

                it('should not be sold', async () => {
                    const position = await openOption();
                    await justWait(1000);
                    await expect(position.sell()).rejects.toThrow("Blitz options are not supported")
                });

            });
        });
    });
    describe('Digital-options', () => {
        let digitalOptions: DigitalOptions;

        beforeAll(async () => {
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

            beforeAll(async () => {
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
                await justWait(2000) // wait 2 sec

                const strikesWithPrices = Array.from(instrument.strikes.values())
                    .filter(value => value.bid !== undefined || value.ask !== undefined);
                expect(strikesWithPrices.length, 'Strikes must have ask/bid prices').eq(strikes.length)
            });

            describe('Buy option', () => {

                it("ignore insufficient funds for this transaction because it's order", async () => {
                    const firstInstrument = findInstrumentByPeriod(60);
                    const digitalOptionsOrder = await digitalOptions.buySpotStrike(firstInstrument, DigitalOptionsDirection.Call, 10, realBalance);
                    const order = await positionsHelper.waitForOrder(order => order.id === digitalOptionsOrder.id)
                    expect(order.status).eq("rejected", "Order status must be rejected");
                    await expect(positionsHelper.waitForPosition(position => position.internalId === order.positionId, 1000)).rejects.toThrow("Position not found within timeout 1000");
                });

                async function createOpenOrder() {
                    const instrument = findInstrumentByPeriod(60);
                    const digitalOptionsOrder = await digitalOptions.buySpotStrike(instrument, DigitalOptionsDirection.Call, 1, demoBalance);
                    const order = await positionsHelper.waitForOrder(order => order.id === digitalOptionsOrder.id);
                    expect(order.status, 'Incorrect order status').eq("filled");
                    const position = await positionsHelper.waitForPosition((position) => position.orderIds.includes(digitalOptionsOrder.id));
                    expect(position.externalId, 'Position must be present').to.be.not.null
                    return {order: digitalOptionsOrder, position};
                }

                it('should be sold', async () => {
                    const {position} = await createOpenOrder();
                    expect(positionsHelper.findPositionByExternalId(position.externalId), 'Position must be present in all positions').not.to.be.undefined
                    await justWait(3000);
                    await position.sell();
                    expect(await waitForCondition(() => position.status === "closed", 3000), `Position [${position.externalId}] status is incorrect, now is "${position.status}"`).to.be.true;
                    expect(position.status, "Invalid status").eq("closed");
                    expect(position.closeReason, "Close reason must be default").eq("default");
                    expect(positionsHelper.findHistoryPosition(position.externalId), 'Position must be present in history positions').not.to.be.undefined
                    expect(positionsHelper.findPositionByExternalId(position.externalId), 'Position must be not present in all positions').to.be.undefined
                }, 10000);
            });
        });
    });
});

