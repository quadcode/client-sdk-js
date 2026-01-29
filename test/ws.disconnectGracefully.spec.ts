import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {ClientSdk, SsidAuthMethod, WsConnectionStateEnum} from "../src";
import type {Client} from "mock-socket";
import {Server} from "mock-socket";
import {justWait} from "./utils/waiters";

vi.mock("isomorphic-ws", async () => {
    const {WebSocket} = await import("mock-socket");
    return {default: WebSocket, WebSocket};
});

type TestRequestHandler = (frame: any, socket: Client) => boolean;

const WS_URL = "ws://localhost:12345";

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

describe("WsApiClient.disconnectGracefully", () => {
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

    it("waits for pending requests to drain before closing", async () => {
        setTestHandler((frame, socket) => {
            if (frame.name !== "test.request") return false;
            setTimeout(() => {
                socket.send(JSON.stringify({
                    request_id: frame.request_id,
                    name: "test.response",
                    msg: {ok: true}
                }));
            }, 10);
            return true;
        });

        const sdk = await ClientSdk.create(WS_URL, 82, new SsidAuthMethod("ssid"));
        const wsApiClient = (sdk as any).wsApiClient;
        let state: WsConnectionStateEnum | undefined;
        wsApiClient.onConnectionStateChanged = (s: WsConnectionStateEnum) => state = s;

        const pending = wsApiClient.doRequest(new TestRequest());
        await justWait(0);
        await wsApiClient.disconnectGracefully(1000);

        await expect(pending).resolves.toEqual({ok: true});
        expect(state).toBe(WsConnectionStateEnum.Disconnected);
    });

    it("rejects pending requests after graceful timeout", async () => {
        setTestHandler((frame) => frame.name === "test.request");

        const sdk = await ClientSdk.create(WS_URL, 82, new SsidAuthMethod("ssid"));
        const wsApiClient = (sdk as any).wsApiClient;

        const pending = wsApiClient.doRequest(new TestRequest());
        const pendingError = pending.then(
            () => new Error("Expected request to be rejected"),
            (err: unknown) => err
        );
        await justWait(0);

        const disconnectPromise = wsApiClient.disconnectGracefully(50);
        await justWait(60);
        await disconnectPromise;

        const err = await pendingError;
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toBe("WebSocket disconnected (graceful timeout)");
    });

    it("rejects new requests after graceful disconnect", async () => {
        const sdk = await ClientSdk.create(WS_URL, 82, new SsidAuthMethod("ssid"));
        const wsApiClient = (sdk as any).wsApiClient;

        await wsApiClient.disconnectGracefully(1000);

        await expect(wsApiClient.doRequest(new TestRequest()))
            .rejects.toThrow("WebSocket is closing; new requests are rejected");
    });

    it("clears reconnect timers and flags on graceful disconnect", async () => {
        const sdk = await ClientSdk.create(WS_URL, 82, new SsidAuthMethod("ssid"));
        const wsApiClient = (sdk as any).wsApiClient;

        wsApiClient.reconnect();
        expect((wsApiClient as any).reconnectTimeoutHandle).toBeDefined();

        await wsApiClient.disconnectGracefully(1000);

        expect((wsApiClient as any).reconnectTimeoutHandle).toBeUndefined();
        expect((wsApiClient as any).reconnecting).toBe(false);
    });

    it("resets subscriptions, request id, and closing flags", async () => {
        const sdk = await ClientSdk.create(WS_URL, 82, new SsidAuthMethod("ssid"));
        const wsApiClient = (sdk as any).wsApiClient;

        (wsApiClient as any).subscriptions.set("test.key", []);
        (wsApiClient as any).lastRequestId = 42;

        await wsApiClient.disconnectGracefully(1000);

        expect((wsApiClient as any).subscriptions.size).toBe(0);
        expect((wsApiClient as any).lastRequestId).toBe(0);
        expect((wsApiClient as any).disconnecting).toBe(true);
        expect((wsApiClient as any).isClosing).toBe(true);
    });
});
