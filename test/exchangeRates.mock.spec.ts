import {ClientSdk, SsidAuthMethod} from "../src";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import WS from "vitest-websocket-mock";
import {randomInt, safeJsonParse, uuid} from "./utils/utils";
import {Client} from "mock-socket";

vi.mock('isomorphic-ws', async () => {
    const {WebSocket} = await import('mock-socket');
    return {default: WebSocket, WebSocket};
});

function sendExchangeRateGenerated(
    socket: Client,
    data: { base: string; quote: string; ask: string; bid: string; changedAt: number }
) {
    socket.send(JSON.stringify({
        name: 'exchange-rate-generated',
        microserviceName: 'exchange-rates',
        msg: {
            base_currency: data.base,
            quote_currency: data.quote,
            ask: data.ask,
            bid: data.bid,
            changed_at: data.changedAt,
        },
    }));
}

describe('ExchangeRates facade mock', () => {
    let server: WS;
    let sdk: ClientSdk;
    let socket: Client;
    let subscribeBodies: any[];

    beforeEach(() => {
        subscribeBodies = [];
        server = new WS("ws://localhost:1234", {jsonProtocol: false});

        server.on('connection', s => {
            socket = s;
            s.on('message', raw => {
                const msg = typeof raw === 'string' ? safeJsonParse(raw) : raw;
                if (msg && (msg as any).name === 'authenticate') {
                    s.send(JSON.stringify({
                        name: 'authenticated',
                        msg: true,
                        client_session_id: uuid(),
                        request_id: msg.request_id,
                    }));
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
                        msg: {features: [{name: "client-sdk", status: "enabled"}]},
                        request_id: msg.request_id,
                    }))
                }
                if (msg?.msg?.name === 'core.get-profile') {
                    s.send(JSON.stringify({
                        msg: {result: {user_id: randomInt(1, 10000000), first_name: "x", last_name: "y"}},
                        request_id: msg.request_id,
                    }))
                }
                // Generic subscribe acknowledgement + capture of subscribe bodies.
                if (msg.name === 'subscribeMessage') {
                    subscribeBodies.push(msg.msg);
                    s.send(JSON.stringify({msg: {success: true}, request_id: msg.request_id}));
                }
                (s as any).terminate = s.close.bind(s);
            })
        })
    })

    afterEach(async function () {
        await sdk.shutdown();
        WS.clean();
    });

    it('should subscribe once per pair and dedup shared callers', async () => {
        sdk = await ClientSdk.create("ws://localhost:1234", 82, new SsidAuthMethod("test-ssid"))
        const exchangeRates = await (sdk as any).exchangeRates();

        const [rate1, rate2] = await Promise.all([
            exchangeRates.getCurrentExchangeRate('HKD', 'USD'),
            exchangeRates.getCurrentExchangeRate('HKD', 'USD'),
        ]);
        const rate3 = await exchangeRates.getCurrentExchangeRate('hkd', 'usd'); // case-insensitive same key

        expect(rate1, "shared callers must get the same instance").toBe(rate2);
        expect(rate3, "case-insensitive key must dedup").toBe(rate1);

        const exchangeRateSubs = subscribeBodies.filter(b => b?.name === 'exchange-rates.exchange-rate-generated');
        expect(exchangeRateSubs.length, "exactly one server subscription per pair").eq(1);
        expect(exchangeRateSubs[0].version).eq('2.0');
        expect(exchangeRateSubs[0].params.routingFilters).toEqual({base_currency: 'HKD', quote_currency: 'USD'});
    });

    it('should update from event and parse string ask/bid', async () => {
        sdk = await ClientSdk.create("ws://localhost:1234", 82, new SsidAuthMethod("test-ssid"))
        const exchangeRates = await (sdk as any).exchangeRates();
        const rate = await exchangeRates.getCurrentExchangeRate('HKD', 'USD');

        sendExchangeRateGenerated(socket, {base: 'HKD', quote: 'USD', ask: '0.1275544370448698', bid: '0.1270000000000000', changedAt: 1782196596942});

        await vi.waitFor(() => expect(rate.ask).not.undefined, {timeout: 3000});
        expect(rate.ask).eq(0.1275544370448698);
        expect(rate.bid).eq(0.127);
        expect(rate.baseCurrency).eq('HKD');
        expect(rate.quoteCurrency).eq('USD');
        expect(rate.changedAt?.getTime()).eq(1782196596942);
    });

    it('should not cross-contaminate other pairs (self-filter)', async () => {
        sdk = await ClientSdk.create("ws://localhost:1234", 82, new SsidAuthMethod("test-ssid"))
        const exchangeRates = await (sdk as any).exchangeRates();
        const hkdUsd = await exchangeRates.getCurrentExchangeRate('HKD', 'USD');
        const eurUsd = await exchangeRates.getCurrentExchangeRate('EUR', 'USD');

        sendExchangeRateGenerated(socket, {base: 'EUR', quote: 'USD', ask: '1.1', bid: '1.0', changedAt: 1782196596942});

        await vi.waitFor(() => expect(eurUsd.ask).eq(1.1), {timeout: 3000});
        expect(hkdUsd.ask, "HKD/USD must stay untouched by an EUR/USD event").to.be.undefined;
    });
});
