export function justWait(timeout: number): Promise<string> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve("Success");
        }, timeout);
    });
}

export async function waitForCondition(condition: () => boolean, timeout: number = 2000): Promise<boolean> {
    const interval = 100;
    const endTime = Date.now() + timeout;

    while (Date.now() < endTime) {
        if (condition()) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    return false;
}