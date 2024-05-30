import {Position, Positions} from "../../src";

export async function waitForPosition(positions: Positions, condition: (position: Position) => boolean, timeout: number = 2000): Promise<Position> {
    return await new Promise((resolve, reject) => {
        setTimeout(() => {
            reject(new Error("Position not found within timeout " + timeout));
        }, timeout);
        positions.subscribeOnUpdatePosition((position) => {
            if (condition(position)) {
                resolve(position)
            }
        })
    });
}