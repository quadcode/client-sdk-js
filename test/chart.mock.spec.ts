import {Candle, ClientSdk, WsConnectionStateEnum} from "../src";
import {getUserByTitle} from "./utils/userUtils";
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import WS from "vitest-websocket-mock";
import {User} from "./vars";
import {randomInt, safeJsonParse, uuid} from "./utils/utils";
import {
    generateCandlesJson,
    generateFirstCandleJson,
    generateMissingCandlesJson,
    startCandleStream
} from "./utils/candleMock";
import {Client} from "mock-socket";
import {justWait} from "./utils/waiters";
import {getOAuthMethod} from "./utils/authHelper";

const ONE_DAY_S = 24 * 60 * 60;

vi.mock('isomorphic-ws', async () => {
    // импортируем класс WebSocket из mock-socket
    const {WebSocket} = await import('mock-socket');
    // возвращаем его и как default-экспорт, и как именованный
    return {default: WebSocket, WebSocket};
});

function candlesShouldNotHaveGaps(candles: Candle[]) {
    // проверяем что все id идут друг за другом, нет дублей, нет дыр.
    const hasGaps = candles.some((c, i, arr) =>
        i > 0 && c.id - arr[i - 1].id !== 1
    );
    expect(hasGaps, "Candles array still has gaps").to.be.false;
}

function sendCandleGenerated(
    socket: Client,
    data: {
        activeId: number;
        size: number;
        id: number;
        from: number;
        to: number;
        at: number;
    }
) {
    socket.send(JSON.stringify({
        name: 'candle-generated',
        microserviceName: 'quotes',
        msg: {
            active_id: data.activeId,
            size: data.size,
            id: data.id,
            from: data.from,
            to: data.to,
            at: data.at,
            open: 1,
            close: 1,
            min: 1,
            max: 1,
            ask: 1,
            bid: 1,
            volume: 1,
            phase: data.at < data.to * 1_000_000_000 ? 'T' : 'C',
        },
    }));
}

describe('Chart Data mock', () => {
    let server: WS;
    let sdk: ClientSdk;
    let socket: Client;
    let now: number;
    let user: User;
    let stopStream: () => void

    beforeAll(() => {
        user = getUserByTitle('regular_user') as User
    })

    beforeEach(() => {
        // поднимаем мок-сервер
        server = new WS("ws://localhost:1234", {jsonProtocol: false});
        now = Math.floor(Date.now() / 1000);

        server.on('connection', s => {
            socket = s;
            s.on('message', raw => {
                const msg = typeof raw === 'string' ? safeJsonParse(raw) : raw;
                if (msg && (msg as any).name === 'authenticate') {
                    const answer = JSON.stringify({
                        name: 'authenticated',
                        msg: true,
                        client_session_id: uuid(),
                        request_id: msg.request_id,
                    });
                    s.send(answer,);
                    const id = setInterval(() => {
                        s.send(JSON.stringify({name: 'timeSync', msg: Date.now()}));
                    }, 10_000);

                    s.on('close', () => clearInterval(id));
                }
                if (msg.name === 'setOptions') {
                    s.send(JSON.stringify({msg: {success: true}, request_id: msg.request_id}));
                }
                if (msg?.msg?.name === 'features.get-features') {
                    s.send(JSON.stringify({
                        msg: {
                            "features": [
                                {
                                    "name": "client-sdk",
                                    "status": "enabled"
                                }
                            ]
                        }, request_id: msg.request_id
                    }))
                }
                if (msg?.msg?.name === 'core.get-profile') {
                    s.send(JSON.stringify({
                        msg: {
                            "result": {
                                "user_id": randomInt(1, 10000000),
                                "first_name": "client-sdk",
                                "last_name": "client-sdk"
                            }
                        }, request_id: msg.request_id
                    }))
                }
                if (msg?.msg?.name === 'get-first-candles') {
                    socket.send(
                        JSON.stringify({
                            msg: generateFirstCandleJson(100, now - ONE_DAY_S * 200, 60),
                            request_id: msg.request_id,
                        }),
                    )
                }
                // terminate, чтобы SDK не упал
                (s as any).terminate = s.close.bind(s);
            })
        })
    })

    afterEach(async function () {
        stopStream?.();
        await sdk.shutdown();
        WS.clean();
    });

    it('should filling history gaps', async () => {
        const {oauth, options} = getOAuthMethod(user);
        sdk = await ClientSdk.create("ws://localhost:1234", 82, oauth, options)
        now = Math.floor(Date.now() / 1000);

        const candlesReq = vi.fn();
        socket.on('message', raw => {
            const msg = typeof raw === 'string' ? safeJsonParse(raw) : raw;
            if (msg?.msg?.name === 'quotes-history.get-candles') {
                if (msg?.msg?.body.from == now - ONE_DAY_S) {
                    candlesReq(msg);
                    socket.send(JSON.stringify({
                        // массив с дырами внутри и слева
                        msg: generateCandlesJson(100000, now - ONE_DAY_S, 60, 1000, [[100000, 100001], [100767, 100769]]),
                        request_id: msg.request_id,
                    }),)
                }
                if (msg?.msg?.body.from == now - ONE_DAY_S - 60 * 500) {
                    candlesReq(msg);
                    socket.send(JSON.stringify({
                        // догружаем массив влево(в историю), но оставляем дыру справа на 1 свечу 99998
                        msg: generateCandlesJson(99500, now - ONE_DAY_S - 60 * 500, 60, 499),
                        request_id: msg.request_id,
                    }),)
                }
            }
        })

        const missingSpy = vi.fn();
        socket.on('message', raw => {
            const msg = typeof raw === 'string' ? safeJsonParse(raw) : raw;
            if (msg?.msg?.name === 'quotes-history.get-candles' && msg?.msg?.body.from_id) {
                missingSpy(msg?.msg.body);
                switch (msg?.msg?.body.from_id) {
                    case 99998:
                        socket.send(JSON.stringify({
                            msg: generateMissingCandlesJson(
                                100000,
                                now - ONE_DAY_S,
                                60,
                                [[99998, 100002]],
                            ),
                            request_id: msg.request_id,
                        }))
                        break
                    case 100766:
                        socket.send(JSON.stringify({
                            msg: generateMissingCandlesJson(
                                100000,
                                now - ONE_DAY_S,
                                60,
                                [[100766, 100770]],
                            ),
                            request_id: msg.request_id,
                        }))
                        break
                }
            }
        })

        const layer = await sdk.realTimeChartDataLayer(1, 60);
        let candles = await layer.fetchAllCandles(now - ONE_DAY_S);

        expect(candlesReq).toHaveBeenCalledTimes(1);
        expect(candles.length, "length must be equal 1000").eq(995)
        // проверяем, что клиент попросил ровно 3 недостающие свечи
        /** ждём максимум 5 000 мс, пока клиент не запросит «дыры» */
        await vi.waitFor(
            () => {
                expect(missingSpy).toHaveBeenCalledTimes(1);
                expect(missingSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        from_id: 100766,
                        to_id: 100770
                    }),
                )
            },
            {timeout: 5000},
        );
        expect(candles.length, "length must be equal 1000").eq(998)
        candles = await layer.fetchAllCandles(now - ONE_DAY_S - 60 * 500);
        expect(candlesReq).toHaveBeenCalledTimes(2);
        expect(candles.length, "length must be equal 1000").eq(998 + 499)
        await vi.waitFor(
            () => {
                expect(missingSpy).toHaveBeenCalledTimes(2);
                expect(missingSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        from_id: 99998,
                        to_id: 100002
                    }),
                )
            },
            {timeout: 5000},
        );
        expect(candles.length, "length must be equal 1500").eq(1500)
        candlesShouldNotHaveGaps(layer.getAllCandles())
        // проверяем что не было "лишних" вызовов еще 5 сек
        await expect(
            vi.waitFor(
                () => expect(missingSpy.mock.calls.length).toBeGreaterThan(2),
                {timeout: 5_000}
            ),
        ).rejects.toThrow();
    })

    it('should filling history gaps when call fetchCandles', async () => {
        const {oauth, options} = getOAuthMethod(user);
        sdk = await ClientSdk.create("ws://localhost:1234", 82, oauth, options)
        now = Math.floor(Date.now() / 1000);

        const candlesReq = vi.fn();
        const size = 1;
        socket.on('message', raw => {
            const msg = typeof raw === 'string' ? safeJsonParse(raw) : raw;
            if (msg?.msg?.name === 'quotes-history.get-candles') {
                if (msg?.msg?.body.to == now) {
                    const count = msg?.msg?.body.count
                    candlesReq(msg);
                    socket.send(JSON.stringify({
                        // массив с дырами внутри и слева
                        msg: generateCandlesJson(100 - count + 1, now - count, size, count, [91, 95, 100]),
                        request_id: msg.request_id,
                    }),)
                }
                if (msg?.msg?.body.to == now - 11) {
                    const count = msg?.msg?.body.count
                    candlesReq(msg);
                    socket.send(JSON.stringify({
                        msg: generateCandlesJson(100 - 14, now - 15, size, count),
                        request_id: msg.request_id,
                    }),)
                }
            }
        })

        const missingSpy = vi.fn();
        socket.on('message', raw => {
            const msg = typeof raw === 'string' ? safeJsonParse(raw) : raw;
            if (msg?.msg?.name === 'quotes-history.get-candles' && msg?.msg?.body.from_id) {
                missingSpy(msg?.msg.body);
                switch (msg?.msg?.body.from_id) {
                    case 87:
                        socket.send(JSON.stringify({
                            msg: generateMissingCandlesJson(
                                87,
                                now - 14,
                                size,
                                [[87, 92]],
                            ),
                            request_id: msg.request_id,
                        }))
                        break
                    case 94:
                        socket.send(JSON.stringify({
                            msg: generateMissingCandlesJson(
                                94,
                                now - 7,
                                size,
                                [[94, 96]],
                            ),
                            request_id: msg.request_id,
                        }))
                        break
                    case 99:
                        socket.send(JSON.stringify({
                            msg: generateMissingCandlesJson(
                                99,
                                now - 2,
                                size,
                                [[99, 101]],
                            ),
                            request_id: msg.request_id,
                        }))
                        break
                }
            }
        })

        const facade = await sdk.realTimeChartDataLayer(1, size);
        const candles = await facade.fetchCandles(now, 10);
        expect(candlesReq).toHaveBeenCalledTimes(1);
        expect(candles.length, "length must be equal 7").eq(7)

        // проверяем, что клиент попросил ровно 3 недостающие свечи
        /** ждём максимум 5 000 мс, пока клиент не запросит «дыры» */
        await vi.waitFor(
            () => {
                expect(missingSpy).toHaveBeenCalledTimes(1);
                expect(missingSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        from_id: 94,
                        to_id: 96
                    }),
                )
            },
            {timeout: 5000},
        );
        expect(facade.getAllCandles().length, "length must be equal 8").eq(8)
        socket.on('message', raw => {
            const msg = typeof raw === 'string' ? safeJsonParse(raw) : raw;
            if (msg?.msg?.name === 'candle-generated') {
                socket.send(JSON.stringify({msg: {success: true}, request_id: msg.request_id}));
                stopStream = startCandleStream(socket, 1, size, 101, [], 103)
            }
        })

        facade.subscribeOnLastCandleChanged(candles => candles);
        /** ждём максимум 5 000 мс, пока клиент не запросит «дыры» */
        await vi.waitFor(
            () => {
                expect(missingSpy).toHaveBeenCalledTimes(2);
                expect(missingSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        from_id: 99,
                        to_id: 101
                    }),
                )
            },
            {timeout: 5000},
        );
        await justWait(5000)
        expect(facade.getAllCandles().length, "length must be equal 12").eq(12)
        await facade.fetchCandles(now - 11, 2);
        /** ждём максимум 5 000 мс, пока клиент не запросит «дыры» */
        await vi.waitFor(
            () => {
                expect(missingSpy).toHaveBeenCalledTimes(3);
                expect(missingSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        from_id: 87,
                        to_id: 92
                    }),
                )
            },
            {timeout: 5000},
        );
        expect(facade.getAllCandles().length, "length must be equal 18").eq(18)
        candlesShouldNotHaveGaps(facade.getAllCandles());
    })

    it('should filling gaps in current candles', async () => {
        const {oauth, options} = getOAuthMethod(user);
        sdk = await ClientSdk.create("ws://localhost:1234", 82, oauth, options)
        const size = 1;
        const layer = await sdk.realTimeChartDataLayer(1, size);
        const missingSpy = vi.fn();
        const notClosedSpy = vi.fn();
        let count = 0
        now = Math.floor(Date.now() / 1000);
        socket.on('message', raw => {
            const msg = typeof raw === 'string' ? safeJsonParse(raw) : raw;
            if (msg?.msg?.name === 'candle-generated') {
                socket.send(JSON.stringify({msg: {success: true}, request_id: msg.request_id}));
                // Начинаем каждую секунду отдавать секундные свечи, начиная с id 1000 по 1009, игнорирую с 1001 по 1005 и свеча 1008 не закрыта.
                stopStream = startCandleStream(socket, 1, size, 1000, [[1001, 1005]], 1009, [1008])
            }
            if (msg?.msg?.body?.from_id == 1000) {
                missingSpy(msg?.msg.body);
                if (count < 1) {
                    socket.send(JSON.stringify({
                        msg: generateMissingCandlesJson(
                            1000,
                            now,
                            size,
                            [[1000, 1002]],
                        ),
                        request_id: msg.request_id,
                    }))
                } else {
                    socket.send(JSON.stringify({
                        msg: generateMissingCandlesJson(
                            1000,
                            now,
                            size,
                            [[1000, 1006]],
                        ),
                        request_id: msg.request_id,
                    }))
                }
                count++
            }
            if (msg?.msg?.body?.from_id == 1008) {
                notClosedSpy(msg?.msg.body)
                socket.send(JSON.stringify({
                    msg: generateMissingCandlesJson(
                        1000,
                        now,
                        size,
                        [[1008, 1009]],
                    ),
                    request_id: msg.request_id,
                }))
            }
        })

        layer.subscribeOnLastCandleChanged(candle => candle)
        await justWait(15000)
        // останавливаем отправку после 5 сек
        expect(layer.getAllCandles().length, "Incorrect loaded candles length").eq(10)
        /** ждём максимум 5 000 мс, пока клиент не запросит «дыры» */
        await vi.waitFor(
            () => {
                expect(missingSpy).toHaveBeenCalledTimes(2)
                expect(missingSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        from_id: 1000,
                        to_id: 1006
                    }),
                )
            },
            {timeout: 5000},
        )
        await vi.waitFor(
            () => {
                expect(notClosedSpy).toHaveBeenCalledTimes(1)
                expect(notClosedSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        from_id: 1008,
                        to_id: 1009
                    }),
                )
            },
            {timeout: 5000},
        )
        candlesShouldNotHaveGaps(layer.getAllCandles())
        // проверяем что не было "лишних" вызовов еще 5 сек
        await expect(
            vi.waitFor(
                () => expect(missingSpy.mock.calls.length).toBeGreaterThan(2),
                {timeout: 5_000}
            ),
        ).rejects.toThrow();
    })

    it('should fallback on 4220 reconnect recovery and keep realtime updates', async () => {
        const {oauth, options} = getOAuthMethod(user);
        sdk = await ClientSdk.create("ws://localhost:1234", 82, oauth, options)

        const activeId = 1;
        const size = 60;
        const wsApiClient = (sdk as any).wsApiClient;
        const alignedNow = Math.floor(Math.floor(Date.now() / 1000) / size) * size;
        const serverNow = alignedNow + Math.floor(size / 2);
        const initialFrom = alignedNow - size * 5;
        wsApiClient.currentTime.unixMilliTime = serverNow * 1000;

        const recoveryRequests: any[] = [];
        const fallbackRequests: any[] = [];

        socket.on('message', raw => {
            const msg = typeof raw === 'string' ? safeJsonParse(raw) : raw;

            if (msg?.msg?.name === 'quotes-history.get-candles') {
                const body = msg.msg.body;

                if (body.from === initialFrom && body.to === undefined) {
                    socket.send(JSON.stringify({
                        msg: generateCandlesJson(1000, initialFrom, size, 5),
                        request_id: msg.request_id,
                    }))
                    return;
                }

                if (body.count === 1000) {
                    fallbackRequests.push(body);
                    socket.send(JSON.stringify({
                        msg: {candles: []},
                        request_id: msg.request_id,
                    }))
                    return;
                }

                recoveryRequests.push(body);
                socket.send(JSON.stringify({
                    status: 4220,
                    msg: {from: "must not be greater than current time"},
                    request_id: msg.request_id,
                }))
            }

            if (msg?.msg?.name === 'candle-generated') {
                socket.send(JSON.stringify({msg: {success: true}, request_id: msg.request_id}));
                setTimeout(() => sendCandleGenerated(socket, {
                    activeId,
                    size,
                    id: 1005,
                    from: alignedNow,
                    to: alignedNow + size,
                    at: serverNow * 1_000_000_000,
                }), 0);
            }
        })

        const layer = await sdk.realTimeChartDataLayer(activeId, size);
        const candles = await layer.fetchAllCandles(initialFrom);
        expect(candles.length).eq(5);

        const updates: number[] = [];
        layer.subscribeOnLastCandleChanged(candle => updates.push(candle.id));

        await vi.waitFor(() => {
            expect(updates).toContain(1005);
        }, {timeout: 5000});

        wsApiClient.onConnectionStateChanged?.(WsConnectionStateEnum.Disconnected);
        wsApiClient.onConnectionStateChanged?.(WsConnectionStateEnum.Connected);

        await vi.waitFor(() => {
            expect(recoveryRequests).toHaveLength(1);
            expect(fallbackRequests).toHaveLength(1);
        }, {timeout: 5000});

        expect(recoveryRequests[0].from).toBeLessThanOrEqual(recoveryRequests[0].to);
        expect(recoveryRequests[0].to - recoveryRequests[0].from).toBeLessThanOrEqual(size * 1000);
        expect(recoveryRequests[0].to).toBeLessThanOrEqual(serverNow);
        expect(fallbackRequests[0]).toEqual(expect.objectContaining({
            to: expect.any(Number),
            count: 1000,
        }));
        expect(fallbackRequests[0].from).toBeUndefined();

        sendCandleGenerated(socket, {
            activeId,
            size,
            id: 1006,
            from: alignedNow + size,
            to: alignedNow + size * 2,
            at: (alignedNow + size) * 1_000_000_000,
        });

        await vi.waitFor(() => {
            expect(updates).toContain(1006);
        }, {timeout: 5000});
        expect(layer.getAllCandles()[layer.getAllCandles().length - 1].id).eq(1006);
    })

    it('should clamp long reconnect recovery to 1000 candles', async () => {
        const {oauth, options} = getOAuthMethod(user);
        sdk = await ClientSdk.create("ws://localhost:1234", 82, oauth, options)

        const activeId = 1;
        const size = 60;
        const wsApiClient = (sdk as any).wsApiClient;
        const alignedNow = Math.floor(Math.floor(Date.now() / 1000) / size) * size;
        const serverNow = alignedNow + Math.floor(size / 2);
        const initialFrom = alignedNow - size * 5;
        const longDisconnectNow = alignedNow + size * 2000;
        wsApiClient.currentTime.unixMilliTime = serverNow * 1000;

        const recoveryRequests: any[] = [];

        socket.on('message', raw => {
            const msg = typeof raw === 'string' ? safeJsonParse(raw) : raw;

            if (msg?.msg?.name === 'quotes-history.get-candles') {
                const body = msg.msg.body;

                if (body.from === initialFrom && body.to === undefined) {
                    socket.send(JSON.stringify({
                        msg: generateCandlesJson(1000, initialFrom, size, 5),
                        request_id: msg.request_id,
                    }))
                    return;
                }

                recoveryRequests.push(body);
                socket.send(JSON.stringify({
                    msg: {candles: []},
                    request_id: msg.request_id,
                }))
            }

            if (msg?.msg?.name === 'candle-generated') {
                socket.send(JSON.stringify({msg: {success: true}, request_id: msg.request_id}));
                setTimeout(() => sendCandleGenerated(socket, {
                    activeId,
                    size,
                    id: 1005,
                    from: alignedNow,
                    to: alignedNow + size,
                    at: (alignedNow + size) * 1_000_000_000,
                }), 0);
            }
        })

        const layer = await sdk.realTimeChartDataLayer(activeId, size);
        await layer.fetchAllCandles(initialFrom);

        const updates: number[] = [];
        layer.subscribeOnLastCandleChanged(candle => updates.push(candle.id));
        await vi.waitFor(() => {
            expect(updates).toContain(1005);
        }, {timeout: 5000});

        wsApiClient.currentTime.unixMilliTime = longDisconnectNow * 1000;
        wsApiClient.onConnectionStateChanged?.(WsConnectionStateEnum.Disconnected);
        wsApiClient.onConnectionStateChanged?.(WsConnectionStateEnum.Connected);

        await vi.waitFor(() => {
            expect(recoveryRequests).toHaveLength(1);
        }, {timeout: 5000});

        expect(recoveryRequests[0].from).eq(longDisconnectNow - size * 1000);
        expect(recoveryRequests[0].to).eq(longDisconnectNow);
        expect(recoveryRequests[0].to - recoveryRequests[0].from).eq(size * 1000);
    })

    it('should reject request if disconnect happened', async () => {
        const {oauth, options} = getOAuthMethod(user);
        sdk = await ClientSdk.create("ws://localhost:1234", 82, oauth, options)
        now = Math.floor(Date.now() / 1000);
        const layer = await sdk.realTimeChartDataLayer(1, 60);
        const fetchPromise = layer.fetchAllCandles(now - ONE_DAY_S);
        socket.close()
        await expect(fetchPromise).rejects.toThrow();
    })
})
