import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {AuthenticationFailedError, ClientSdk, SsidAuthMethod, WsConnectionStateEnum} from "../src";
import type {Client} from "mock-socket";
import {Server} from "mock-socket";
import {waitForCondition} from "./utils/waiters";

vi.mock("isomorphic-ws", async () => {
    const {WebSocket} = await import("mock-socket");
    return {default: WebSocket, WebSocket};
});

type TestRequestHandler = (frame: any, socket: Client) => boolean;

const WS_URL = "ws://localhost:12346";

function startServer() {
    const server = new Server(WS_URL);
    let testHandler: TestRequestHandler | undefined;

    server.on("connection", (socket) => {
        (socket as any).terminate = socket.close.bind(socket);
        socket.on("message", (data) => {
            const frame = JSON.parse(String(data));

            if (testHandler && testHandler(frame, socket)) {
                return;
            }

            if (frame.name === "authenticate") {
                socket.send(JSON.stringify({
                    request_id: frame.request_id,
                    name: "authenticate",
                    msg: true
                }));
                return;
            }

            if (frame.name === "setOptions") {
                socket.send(JSON.stringify({
                    request_id: frame.request_id,
                    name: "result",
                    msg: {success: true, reason: ""}
                }));
                return;
            }

            if (frame.name === "subscribeMessage") {
                socket.send(JSON.stringify({
                    request_id: frame.request_id,
                    name: "result",
                    msg: {success: true, reason: ""}
                }));
                return;
            }

            if (frame.name === "sendMessage" && frame.msg?.name === "features.get-features") {
                socket.send(JSON.stringify({
                    request_id: frame.request_id,
                    name: "features",
                    msg: {features: []}
                }));
                return;
            }

            if (frame.name === "sendMessage" && frame.msg?.name === "core.get-profile") {
                socket.send(JSON.stringify({
                    request_id: frame.request_id,
                    name: "core.profile",
                    msg: {
                        result: {
                            user_id: 1,
                            first_name: "test",
                            last_name: "user"
                        }
                    }
                }));
                return;
            }
        });
    });

    return {
        server,
        setTestHandler(handler: TestRequestHandler | undefined) {
            testHandler = handler;
        }
    };
}

class TestRequest {
    messageName() {
        return "test.request";
    }

    messageBody() {
        return {ping: true};
    }

    resultOnly() {
        return false;
    }

    createResponse(data: any) {
        return data;
    }
}

class TestSubscribeRequest {
    messageName() {
        return "subscribeMessage";
    }

    messageBody() {
        return {name: "test.event", version: "1.0"};
    }

    resultOnly() {
        return true;
    }

    createResponse(data: any) {
        return data;
    }

    eventMicroserviceName() {
        return "test-ms";
    }

    eventName() {
        return "test.event";
    }

    createEvent(data: any) {
        return data;
    }
}

function dropAllConnections(server: Server) {
    for (const socket of server.clients()) {
        socket.close();
    }
}

describe("WsApiClient reconnect authentication", () => {
    let server: Server;
    let setTestHandler: (handler: TestRequestHandler | undefined) => void;

    beforeEach(() => {
        const started = startServer();
        server = started.server;
        setTestHandler = started.setTestHandler;
    });

    afterEach(() => {
        server.stop();
        setTestHandler(undefined);
        vi.useRealTimers();
    });

    it("retries re-authentication on reconnect and recovers when auth succeeds again", async () => {
        const sdk = await ClientSdk.create(WS_URL, 82, new SsidAuthMethod("ssid"));
        const wsApiClient = (sdk as any).wsApiClient;
        const states: WsConnectionStateEnum[] = [];
        wsApiClient.onConnectionStateChanged = (s: WsConnectionStateEnum) => states.push(s);

        let authFailuresLeft = 2;
        setTestHandler((frame, socket) => {
            if (frame.name !== "authenticate") return false;
            const isSuccessful = authFailuresLeft <= 0;
            if (!isSuccessful) authFailuresLeft -= 1;
            socket.send(JSON.stringify({
                request_id: frame.request_id,
                name: "authenticate",
                msg: isSuccessful
            }));
            return true;
        });

        dropAllConnections(server);

        const reconnected = await waitForCondition(
            () => states[states.length - 1] === WsConnectionStateEnum.Connected,
            15000
        );

        expect(reconnected).toBe(true);
        expect(authFailuresLeft).toBe(0);
        expect(states).toContain(WsConnectionStateEnum.Disconnected);
        expect(states).not.toContain(WsConnectionStateEnum.AuthenticationFailed);

        setTestHandler((frame, socket) => {
            if (frame.name !== "test.request") return false;
            socket.send(JSON.stringify({
                request_id: frame.request_id,
                name: "test.response",
                msg: {ok: true}
            }));
            return true;
        });

        await expect(wsApiClient.doRequest(new TestRequest())).resolves.toEqual({ok: true});

        await sdk.shutdown();
    });

    it("enters terminal AuthenticationFailed state after repeated re-auth failures", async () => {
        const sdk = await ClientSdk.create(WS_URL, 82, new SsidAuthMethod("ssid"));
        const wsApiClient = (sdk as any).wsApiClient;
        (wsApiClient as any).maxConsecutiveReauthFailures = 2;

        const states: WsConnectionStateEnum[] = [];
        wsApiClient.onConnectionStateChanged = (s: WsConnectionStateEnum) => states.push(s);

        setTestHandler((frame, socket) => {
            if (frame.name !== "authenticate") return false;
            socket.send(JSON.stringify({
                request_id: frame.request_id,
                name: "authenticate",
                msg: false
            }));
            return true;
        });

        dropAllConnections(server);

        const terminated = await waitForCondition(
            () => states.includes(WsConnectionStateEnum.AuthenticationFailed),
            15000
        );

        expect(terminated).toBe(true);
        expect(states[0]).toBe(WsConnectionStateEnum.Disconnected);
        expect(states[states.length - 1]).toBe(WsConnectionStateEnum.AuthenticationFailed);

        expect((wsApiClient as any).reconnecting).toBe(false);
        expect((wsApiClient as any).reconnectTimeoutHandle).toBeUndefined();
        expect((wsApiClient as any).timeSyncInterval).toBeUndefined();

        const error = await wsApiClient.doRequest(new TestRequest()).then(
            () => null,
            (err: unknown) => err
        );
        expect(error).toBeInstanceOf(AuthenticationFailedError);
        expect((error as Error).message).toContain("re-authentication failed");
        expect((error as Error).message).toContain("Create a new ClientSdk instance");

        wsApiClient.reconnect();
        expect((wsApiClient as any).reconnecting).toBe(false);
        expect((wsApiClient as any).reconnectTimeoutHandle).toBeUndefined();
    });

    it("does not enter terminal state when auth failures are not consecutive enough", async () => {
        const sdk = await ClientSdk.create(WS_URL, 82, new SsidAuthMethod("ssid"));
        const wsApiClient = (sdk as any).wsApiClient;
        (wsApiClient as any).maxConsecutiveReauthFailures = 3;

        const states: WsConnectionStateEnum[] = [];
        wsApiClient.onConnectionStateChanged = (s: WsConnectionStateEnum) => states.push(s);

        let authFailuresLeft = 2;
        setTestHandler((frame, socket) => {
            if (frame.name !== "authenticate") return false;
            const isSuccessful = authFailuresLeft <= 0;
            if (!isSuccessful) authFailuresLeft -= 1;
            socket.send(JSON.stringify({
                request_id: frame.request_id,
                name: "authenticate",
                msg: isSuccessful
            }));
            return true;
        });

        dropAllConnections(server);

        const reconnected = await waitForCondition(
            () => states[states.length - 1] === WsConnectionStateEnum.Connected,
            15000
        );

        expect(reconnected).toBe(true);
        expect(states).not.toContain(WsConnectionStateEnum.AuthenticationFailed);
        expect((wsApiClient as any).authenticationFailed).toBe(false);

        await sdk.shutdown();
    });

    it("rejects ClientSdk.create when initial authentication fails", async () => {
        setTestHandler((frame, socket) => {
            if (frame.name !== "authenticate") return false;
            socket.send(JSON.stringify({
                request_id: frame.request_id,
                name: "authenticate",
                msg: false
            }));
            return true;
        });

        await expect(ClientSdk.create(WS_URL, 82, new SsidAuthMethod("bad-ssid")))
            .rejects.toThrow("authentication is failed");
    });

    it("preserves subscriptions across failed reconnect attempts", async () => {
        const sdk = await ClientSdk.create(WS_URL, 82, new SsidAuthMethod("ssid"));
        const wsApiClient = (sdk as any).wsApiClient;
        const states: WsConnectionStateEnum[] = [];
        wsApiClient.onConnectionStateChanged = (s: WsConnectionStateEnum) => states.push(s);

        await wsApiClient.subscribe(new TestSubscribeRequest(), () => {
        });
        expect((wsApiClient as any).subscriptions.size).toBe(1);

        let authFailuresLeft = 1;
        let resubscribeCount = 0;
        setTestHandler((frame, socket) => {
            if (frame.name === "authenticate") {
                const isSuccessful = authFailuresLeft <= 0;
                if (!isSuccessful) authFailuresLeft -= 1;
                socket.send(JSON.stringify({
                    request_id: frame.request_id,
                    name: "authenticate",
                    msg: isSuccessful
                }));
                return true;
            }

            if (frame.name === "subscribeMessage") {
                resubscribeCount += 1;
                socket.send(JSON.stringify({
                    request_id: frame.request_id,
                    name: "result",
                    msg: {success: true, reason: ""}
                }));
                return true;
            }

            return false;
        });

        dropAllConnections(server);

        const resubscribed = await waitForCondition(
            () => states[states.length - 1] === WsConnectionStateEnum.Connected && resubscribeCount >= 1,
            15000
        );

        expect(resubscribed).toBe(true);
        expect((wsApiClient as any).subscriptions.size).toBe(1);

        await sdk.shutdown();
    });
});
