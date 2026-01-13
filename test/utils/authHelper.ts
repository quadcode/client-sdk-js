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
        new SecretsTokensStorage(user),
    );
    return {oauth, options};
}

export class SecretsTokensStorage implements OAuthTokensStorage {

    constructor(private readonly user: User) {
    }

    private mask(token?: string): string {
        if (!token) {
            return 'undefined'
        }

        return `${token.slice(0, 3)}***`
    }

    get(): { accessToken: string; refreshToken?: string } {
        const tokens = getTokensForUser(this.user.title)

        console.log(
            `Getting tokens for user: ${this.user.title}`,
            `accessToken=${this.mask(tokens.accessToken)}`,
            `refreshToken=${this.mask(tokens.refreshToken)}`
        )

        return tokens
    }

    set(tokens: { accessToken: string; refreshToken?: string }): void {
        console.log(
            `Setting tokens for user: ${this.user.title}`,
            `accessToken=${this.mask(tokens.accessToken)}`,
            `refreshToken=${this.mask(tokens.refreshToken)}`
        )

        setTokensForUser(this.user.title, tokens)
    }
}
