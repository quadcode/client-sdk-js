import {ClientSdk, Order, Orders, Position, Positions} from "../../src";

export class PositionsHelper {

    private positions!: Positions;
    private orders!: Orders;

    private constructor() {
    }

    public static async create(sdk: ClientSdk): Promise<PositionsHelper> {
        const instance = new PositionsHelper();
        await instance.initialize(sdk);
        return instance;
    }

    private async initialize(sdk: ClientSdk) {
        this.positions = await sdk.positions();
        this.orders = await sdk.orders();
    }

    public async waitForOrder(condition: (order: Order) => boolean, timeout: number = 2000): Promise<Order> {
        return await new Promise((resolve, reject) => {
            setTimeout(() => {
                reject(new Error("Order not found within timeout " + timeout));
            }, timeout);
            this.orders.subscribeOnUpdateOrder((order) => {
                if (condition(order)) {
                    resolve(order)
                }
            })
        });
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

    public findPositionByExternalId(position_id: number | undefined): Position | undefined {
        if (position_id === undefined) throw new Error('Parameter position_id is undefined')
        return this.positions.getOpenedPositions().find(value => value.externalId === position_id);
    }

    public findPositionByPredicate(predicate: (value: Position) => boolean): Position | undefined {
        return this.positions.getOpenedPositions().find(predicate);
    }

    public findOrder(order_id: number | undefined): Order | undefined {
        if (order_id === undefined) throw new Error('Parameter order_id is undefined')
        return this.orders.getAllOrders().find(value => value.id === order_id);
    }

    /**
     * Find history position only from last page
     * @return position
     * @param id
     */
    public findHistoryPosition(id: number | undefined): Position | undefined {
        if (id === undefined) throw new Error('Parameter position_id is undefined')
        return this.positions.getPositionsHistory().getPositions().find(value => value.externalId === id);
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

    public async closeOpenedPositions() {
        for (const position of this.positions.getOpenedPositions()) {
            await position.sell();
        }
    }
}
