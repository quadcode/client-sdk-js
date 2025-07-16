import {CurrentQuote, Quotes} from "../../src";

export async function getCurrentQuote(quotes: Quotes, activeId: number, timeout: number = 1500): Promise<CurrentQuote> {
    const currentQuote = await quotes.getCurrentQuoteForActive(activeId);
    return await new Promise((resolve, reject) => {
        setTimeout(() => {
            reject(new Error("Quote not found within timeout " + timeout));
        }, timeout);
        currentQuote.subscribeOnUpdate((quote) => {
            resolve(quote)
        })
    });
}

export function randomFloat(
    min: number,
    max: number,
    digits: number = 2
): number {
    const factor = Math.pow(10, digits);
    return (
        Math.round((Math.random() * (max - min) + min) * factor) / factor
    );
}

export function randomInt(min: number, max: number): number {
    // +1, чтобы max тоже мог выпасть
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function uuid() {
    return () =>
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const v = (Math.random() * 16) | 0;
            const r = c === 'x' ? v : (v & 0x3) | 0x8;
            return r.toString(16);
        });
}

export function safeJsonParse(str: string) {
    try {
        return JSON.parse(str);
    } catch {
        return str;
    }
}