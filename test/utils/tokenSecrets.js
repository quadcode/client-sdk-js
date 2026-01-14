import {Redis} from '@upstash/redis';
import {UPSTASH_REDIS_REST_TOKEN, UPSTASH_REDIS_REST_URL} from "../vars.js";

let redis = null;

function getRedis() {
    if (redis) return redis;
    redis = new Redis({url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN});
    return redis;
}

const normalizeTitle = (title) => title.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');

export function secretNameForToken(userTitle, tokenKind) {
    return `${normalizeTitle(userTitle)}_${tokenKind}`;
}

export async function getTokensForUser(userTitle) {
    const redis = getRedis();
    const accessKey = secretNameForToken(userTitle, 'ACCESS_TOKEN');
    const refreshKey = secretNameForToken(userTitle, 'REFRESH_TOKEN');
    const [accessToken, refreshToken] = await redis.mget(accessKey, refreshKey);
    if (!accessToken) {
        throw new Error(`[tokenSecrets] Missing token for "${userTitle}" (ACCESS_TOKEN). Store key "${accessKey}" in Upstash.`);
    }
    if (!refreshToken) {
        throw new Error(`[tokenSecrets] Missing token for "${userTitle}" (REFRESH_TOKEN). Store key "${refreshKey}" in Upstash.`);
    }

    return {accessToken, refreshToken};
}

export async function setTokensForUser(userTitle, tokens) {
    const redis = getRedis();
    const accessKey = secretNameForToken(userTitle, 'ACCESS_TOKEN');
    const refreshKey = secretNameForToken(userTitle, 'REFRESH_TOKEN');
    try {
        const pipeline = redis.pipeline();
        pipeline.set(accessKey, tokens.accessToken);
        pipeline.set(refreshKey, tokens.refreshToken);
        await pipeline.exec();
    } catch (err) {
        console.error('[tokenSecrets] Failed to sync tokens to Upstash:', err?.message || err);
        throw err;
    }
}
