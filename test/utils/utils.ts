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