export type TokenKind = 'ACCESS_TOKEN' | 'REFRESH_TOKEN';

export function secretNameForToken(userTitle: string, tokenKind: TokenKind): string;

export function getTokensForUser(
    userTitle: string,
): Promise<{ accessToken: string; refreshToken?: string }>;

export function setTokensForUser(
    userTitle: string,
    tokens: { accessToken: string; refreshToken?: string },
): Promise<void>;
