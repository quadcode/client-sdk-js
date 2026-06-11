import {afterEach, describe, expect, it, vi} from "vitest";
import {OAuthMethod, OAuthTokensStorage} from "../src";

class InMemoryTokensStorage implements OAuthTokensStorage {
    private tokens: { accessToken: string; refreshToken?: string } = {accessToken: ""};

    get(): Promise<{ accessToken: string; refreshToken?: string }> {
        return Promise.resolve(this.tokens);
    }

    set(tokens: { accessToken: string; refreshToken?: string }): Promise<void> {
        this.tokens = tokens;
        return Promise.resolve();
    }
}

const PRIVATE_FIELDS = [
    "apiBaseUrl",
    "clientId",
    "redirectUri",
    "scope",
    "clientSecret",
    "accessToken",
    "refreshToken",
    "affId",
    "afftrack",
    "affModel",
    "tokensStorage",
] as const;

describe("OAuthMethod constructor", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("options object form is equivalent to the positional form", () => {
        const tokensStorage = new InMemoryTokensStorage();
        // clientSecret is forbidden in browser environments, where this suite also runs
        const clientSecret = typeof window !== "undefined" ? undefined : "secret";

        const positional = new OAuthMethod(
            "https://api.trade.example.com",
            42,
            "https://your.app/callback",
            "full offline_access",
            clientSecret,
            "access-token",
            "refresh-token",
            7,
            "track",
            "model",
            tokensStorage
        );

        const options = new OAuthMethod({
            apiBaseUrl: "https://api.trade.example.com",
            clientId: 42,
            redirectUri: "https://your.app/callback",
            scope: "full offline_access",
            clientSecret,
            accessToken: "access-token",
            refreshToken: "refresh-token",
            affId: 7,
            afftrack: "track",
            affModel: "model",
            tokensStorage
        });

        for (const field of PRIVATE_FIELDS) {
            expect((options as any)[field], field).toBe((positional as any)[field]);
        }
    });

    it("seeds dummy tokens storage from tokens passed via options", async () => {
        const method = new OAuthMethod({
            apiBaseUrl: "https://api.trade.example.com",
            clientId: 42,
            redirectUri: "https://your.app/callback",
            scope: "full",
            accessToken: "access-token",
            refreshToken: "refresh-token"
        });

        await expect((method as any).tokensStorage.get()).resolves.toEqual({
            accessToken: "access-token",
            refreshToken: "refresh-token"
        });
    });

    it("rejects client secret in browser for both forms", () => {
        // In a real browser `window` already exists (and cannot be redefined);
        // in Node it has to be stubbed to simulate the browser environment.
        if (typeof window === "undefined") {
            vi.stubGlobal("window", {});
        }

        expect(() => new OAuthMethod({
            apiBaseUrl: "https://api.trade.example.com",
            clientId: 42,
            redirectUri: "https://your.app/callback",
            scope: "full",
            clientSecret: "secret"
        })).toThrow("Client secret should not be used in browser applications");

        expect(() => new OAuthMethod(
            "https://api.trade.example.com",
            42,
            "https://your.app/callback",
            "full",
            "secret"
        )).toThrow("Client secret should not be used in browser applications");
    });
});
