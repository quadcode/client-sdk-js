export function justWait(timeout: number): Promise<string> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve("Success");
        }, timeout);
    });
}

export async function waitForCondition(condition: () => boolean, timeout: number): Promise<void> {
    const interval = 100;
    const endTime = Date.now() + timeout;

    while (Date.now() < endTime) {
        if (condition()) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error("Timeout waiting for condition");
}