export function justWait(timeout: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, timeout);
    });
}

export async function waitForCondition(condition: () => boolean, timeout: number = 5000): Promise<boolean> {
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
