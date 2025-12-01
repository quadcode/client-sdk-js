import {API_URL, BASE_URL, CLIENT_ID, CLIENT_SECRET, User} from "../vars";
import {OAuthMethod, OAuthTokensStorage} from "../../src";

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
        new InMemoryOAuthTokensStorage(user),
    );
    return {oauth, options};
}

export class InMemoryOAuthTokensStorage implements OAuthTokensStorage{

    constructor(
        private readonly user: User,
    ) {
        this.tokens = {accessToken: user.access_token, refreshToken: user.refresh_token}
    }

    private tokens: { accessToken: string; refreshToken?: string } = {
        accessToken: '',
    };

    get(): { accessToken: string; refreshToken?: string } {
        return this.tokens;
    }

    set(tokens: { accessToken: string; refreshToken?: string }): void {
        this.tokens = tokens;
    }
}