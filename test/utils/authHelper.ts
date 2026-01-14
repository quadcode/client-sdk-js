import {API_URL, BASE_URL, CLIENT_ID, CLIENT_SECRET, User} from "../vars";
import {OAuthMethod, OAuthTokensStorage} from "../../src";
import {getTokensForUser, setTokensForUser} from "./tokenSecrets.js";

export function getOAuthMethod(user: User) {
    const options = IS_BROWSER ? {host: BASE_URL} : undefined;
    const clientSecret = IS_BROWSER ? undefined : CLIENT_SECRET;
    const oauth = new OAuthMethod(
        API_URL,
        CLIENT_ID,
        'http://localhost:5173/#/oauth/callback',
        'full offline_access',
        clientSecret,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        SecretsTokensStorage.for(user),
    );
    return {oauth, options};
}

export class SecretsTokensStorage implements OAuthTokensStorage {

    constructor(private readonly user: User) {
    }

    private static instances = new Map<string, SecretsTokensStorage>();

    static for(user: User): SecretsTokensStorage {
        const key = user.title;
        let instance = this.instances.get(key);
        if (!instance) {
            instance = new SecretsTokensStorage(user);
            this.instances.set(key, instance);
        }
        return instance;
    }

    private mask(token?: string): string {
        if (!token) {
            return 'undefined'
        }

        return `${token.slice(0, 3)}***`
    }

    async get(): Promise<{ accessToken: string; refreshToken?: string }> {
        const tokens = await getTokensForUser(this.user.title)

        console.log(
            `Getting tokens for user: ${this.user.title}`,
            `accessToken=${this.mask(tokens.accessToken)}`,
            `refreshToken=${this.mask(tokens.refreshToken)}`
        )

        return tokens
    }

    async set(tokens: { accessToken: string; refreshToken?: string }): Promise<void> {
        console.log(
            `Setting tokens for user: ${this.user.title}`,
            `accessToken=${this.mask(tokens.accessToken)}`,
            `refreshToken=${this.mask(tokens.refreshToken)}`
        )

        await setTokensForUser(this.user.title, tokens)
    }
}
