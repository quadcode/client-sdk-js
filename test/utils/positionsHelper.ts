import {Position, Positions, QuadcodeClientSdk} from "../../src";

export class PositionsHelper {

    private positions!: Positions;

    private constructor() {
    }

    public static async create(sdk: QuadcodeClientSdk): Promise<PositionsHelper> {
        const instance = new PositionsHelper();
        await instance.initialize(sdk);
        return instance;
    }

    private async initialize(sdk: QuadcodeClientSdk) {
        this.positions = await sdk.positions();
    }

    public async waitForPosition(condition: (position: Position) => boolean, timeout: number = 2000): Promise<Position> {
        return await new Promise((resolve, reject) => {
            setTimeout(() => {
                reject(new Error("Position not found within timeout " + timeout));
            }, timeout);
            this.positions.subscribeOnUpdatePosition((position) => {
                if (condition(position)) {
                    resolve(position)
                }
            })
        });
    }

    public findPosition(id: number | undefined): Position | undefined {
        if (id === undefined) throw new Error('Parameter position_id is undefined')
        return this.positions.getAllPositions().find(value => value.id === id);
    }

    /**
     * Find history position only from last page
     * @return position
     * @param id
     */
    public findHistoryPosition(id: number | undefined): Position | undefined {
        if (id === undefined) throw new Error('Parameter position_id is undefined')
        return this.positions.getPositionsHistory().getPositions().find(value => value.id === id);
    }

    public async loadHistoryPositions(pages: number) {
        const positionsHistory = this.positions.getPositionsHistory();
        let currentPage: number = 1;
        while (positionsHistory.hasPrevPage()) {
            await positionsHistory.fetchPrevPage();
            if (currentPage++ === pages) break;
        }
        return positionsHistory.getPositions();
    }
}
