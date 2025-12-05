export type TokenKind = 'ACCESS_TOKEN' | 'REFRESH_TOKEN';

export function secretNameForToken(userTitle: string, tokenKind: TokenKind): string;

export function requireTokenFromEnv(userTitle: string, tokenKind: TokenKind): string;

export function getTokensForUser(
    userTitle: string,
): { accessToken: string; refreshToken?: string };

export function setTokensForUser(
    userTitle: string,
    tokens: { accessToken: string; refreshToken?: string },
): Promise<void>;

export function waitForSecretsSync(): Promise<void>;
