import sodium from "tweetsodium";

const SECRET_PREFIX = 'SDK_TEST';
const SECRET_WRITE_TOKEN_ENV = 'GH_SECRETS_TOKEN';
const DEFAULT_REPO_ENV = 'GITHUB_REPOSITORY';
const GH_API = 'https://api.github.com';
const GH_API_VERSION = '2022-11-28';

const tokenCache = new Map();
const pendingWrites = new Set();

function getEnv() {
    if (typeof process !== 'undefined' && process?.env) {
        return process.env;
    }
    if (typeof import.meta !== 'undefined' && import.meta?.env) {
        return import.meta.env;
    }
    return {};
}

const normalizeTitle = (title) => title.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');

export function secretNameForToken(userTitle, tokenKind) {
    return `${SECRET_PREFIX}_${normalizeTitle(userTitle)}_${tokenKind}`;
}

export function requireTokenFromEnv(userTitle, tokenKind) {
    const envName = secretNameForToken(userTitle, tokenKind);
    const env = getEnv();
    const value = env[envName] ?? env[`VITE_${envName}`];
    if (!value) {
        throw new Error(`[tokenSecrets] Missing token for "${userTitle}" (${tokenKind}). Set ${envName} secret/env value.`);
    }
    return value;
}

export function getTokensForUser(userTitle) {
    const cached = tokenCache.get(userTitle);
    if (cached) return cached;

    const accessToken = requireTokenFromEnv(userTitle, 'ACCESS_TOKEN');
    const refreshToken = requireTokenFromEnv(userTitle, 'REFRESH_TOKEN');
    const tokens = {accessToken, refreshToken};

    tokenCache.set(userTitle, tokens);
    return tokens;
}

export function setTokensForUser(userTitle, tokens) {
    tokenCache.set(userTitle, tokens);
    const sync = updateGithubSecrets(userTitle, tokens).catch((err) => {
        console.error('[tokenSecrets] Failed to update secrets:', err?.message || err);
    });
    return trackWrite(sync);
}

function githubHeaders(token, contentTypeJson = false) {
    return {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': GH_API_VERSION,
        Authorization: `Bearer ${token}`,
        ...(contentTypeJson ? {'Content-Type': 'application/json'} : {}),
    };
}

async function fetchRepoPublicKey(repo, token) {
    const res = await fetch(`${GH_API}/repos/${repo}/actions/secrets/public-key`, {
        headers: githubHeaders(token),
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`[tokenSecrets] Failed to fetch public key: ${res.status} ${body || res.statusText}`);
    }
    return res.json();
}

function encryptSecret(secretValue, publicKey) {
    const messageBytes = Buffer.from(secretValue);
    const keyBytes = Buffer.from(publicKey, 'base64');
    const encryptedBytes = sodium.seal(messageBytes, keyBytes);
    return Buffer.from(encryptedBytes).toString('base64');
}

async function putGithubSecret(repo, token, publicKey, secretName, secretValue) {
    if (!secretValue) return;

    const encrypted_value = encryptSecret(secretValue, publicKey.key);
    const res = await fetch(`${GH_API}/repos/${repo}/actions/secrets/${secretName}`, {
        method: 'PUT',
        headers: githubHeaders(token, true),
        body: JSON.stringify({encrypted_value, key_id: publicKey.key_id}),
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`[tokenSecrets] Failed to update secret ${secretName}: ${res.status} ${body || res.statusText}`);
    }
}

async function updateGithubSecrets(userTitle, tokens) {
    const repo = process.env[DEFAULT_REPO_ENV];
    const token = process.env[SECRET_WRITE_TOKEN_ENV] ?? process.env.GITHUB_TOKEN;
    if (!repo || !token) {
        if (process.env.CI) {
            console.warn(`[tokenSecrets] Skip secret update for ${userTitle}: missing ${DEFAULT_REPO_ENV} or ${SECRET_WRITE_TOKEN_ENV}/GITHUB_TOKEN`);
        }
        return;
    }

    try {
        const publicKey = await fetchRepoPublicKey(repo, token);
        await putGithubSecret(repo, token, publicKey, secretNameForToken(userTitle, 'ACCESS_TOKEN'), tokens.accessToken);
        if (tokens.refreshToken) {
            await putGithubSecret(repo, token, publicKey, secretNameForToken(userTitle, 'REFRESH_TOKEN'), tokens.refreshToken);
        }
    } catch (err) {
        console.error('[tokenSecrets] Failed to sync secrets:', err?.message || err);
        throw err;
    }
}

export async function waitForSecretsSync() {
    if (!pendingWrites.size) return;
    await Promise.allSettled(Array.from(pendingWrites));
}

function trackWrite(promise) {
    pendingWrites.add(promise);
    promise.finally(() => pendingWrites.delete(promise));
    return promise;
}
