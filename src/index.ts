import WebSocket from "isomorphic-ws"

/**
 * This is the entry point of this SDK for your application. Use it to implement the business logic of your application.
 */
export class QuadcodeClientSdk {
    /**
     * Refreshable user profile class instance.
     */
    public readonly userProfile: UserProfile

    /**
     * Instance of WebSocket API client.
     * @private
     */
    private readonly wsApiClient: WsApiClient

    /**
     * Balances facade cache.
     * @private
     */
    private balancesFacade: Balances | undefined

    /**
     * Quotes facade cache.
     * @private
     */
    private quotesFacade: Quotes | undefined

    /**
     * Blitz options facade cache.
     * @private
     */
    private blitzOptionsFacade: BlitzOptions | undefined

    /**
     * Turbo options facade cache.
     * @private
     */
    private turboOptionsFacade: TurboOptions | undefined

    /**
     * Binary options facade cache.
     * @private
     */
    private binaryOptionsFacade: BinaryOptions | undefined

    /**
     * Digital options facade cache.
     * @private
     */
    private digitalOptionsFacade: DigitalOptions | undefined

    /**
     * Creates instance of class.
     * @param userProfile - Information about the user on whose behalf your application is working.
     * @param wsApiClient - Instance of WebSocket API client.
     * @internal
     * @private
     */
    private constructor(userProfile: UserProfile, wsApiClient: WsApiClient) {
        this.userProfile = userProfile
        this.wsApiClient = wsApiClient
    }

    /**
     * Creates instance of SDK entry point class.
     * This method establishes and authenticates connection to Quadcode system API.
     * @param apiUrl - URL to Quadcode system API. Usually it has the following format: `wss://ws.trade.{brand_domain}/echo/websocket`.
     * @param platformId - Identification number of your application. You can get platform ID from Quadcode representatives.
     * @param authMethod - Authentication method used for connection authentication.
     */
    public static async create(apiUrl: string, platformId: number, authMethod: AuthMethod): Promise<QuadcodeClientSdk> {
        const wsApiClient = new WsApiClient(apiUrl, platformId, authMethod)
        await wsApiClient.connect()
        const userProfile = await UserProfile.create(wsApiClient)
        return new QuadcodeClientSdk(userProfile, wsApiClient)
    }

    /**
     * Shuts down instance of SDK entry point class.
     */
    public async shutdown(): Promise<void> {
        this.wsApiClient.disconnect()
    }

    /**
     * Returns balances facade class.
     */
    public async balances(): Promise<Balances> {
        if (!this.balancesFacade) {
            this.balancesFacade = await Balances.create(this.wsApiClient)
        }
        return this.balancesFacade
    }

    /**
     * Returns quotes facade class.
     */
    public async quotes(): Promise<Quotes> {
        if (!this.quotesFacade) {
            this.quotesFacade = new Quotes(this.wsApiClient)
        }
        return this.quotesFacade
    }

    /**
     * Returns blitz options facade class.
     */
    public async blitzOptions(): Promise<BlitzOptions> {
        if (!this.blitzOptionsFacade) {
            this.blitzOptionsFacade = await BlitzOptions.create(this.wsApiClient)
        }
        return this.blitzOptionsFacade
    }

    /**
     * Returns turbo options facade class.
     */
    public async turboOptions(): Promise<TurboOptions> {
        if (!this.turboOptionsFacade) {
            this.turboOptionsFacade = await TurboOptions.create(this.wsApiClient)
        }
        return this.turboOptionsFacade
    }

    /**
     * Returns binary options facade class.
     */
    public async binaryOptions(): Promise<BinaryOptions> {
        if (!this.binaryOptionsFacade) {
            this.binaryOptionsFacade = await BinaryOptions.create(this.wsApiClient)
        }
        return this.binaryOptionsFacade
    }

    /**
     * Returns digital options facade class.
     */
    public async digitalOptions(): Promise<DigitalOptions> {
        if (!this.digitalOptionsFacade) {
            this.digitalOptionsFacade = await DigitalOptions.create(this.wsApiClient)
        }
        return this.digitalOptionsFacade
    }

    /**
     * Returns ws current time.
     */
    public currentTime(): Date {
        return new Date(this.wsApiClient.currentTime.unixMilliTime)
    }
}

/**
 * Authenticates user in Quadcode system APIs.
 */
export interface AuthMethod {
    /**
     * Should implement authentication logic in WebSocket API.
     * @param wsApiClient - Instance of WebSocket API client.
     */
    authenticateWsApiClient(wsApiClient: WsApiClient): Promise<boolean>
}

/**
 * Implements SSID authentication flow.
 */
export class SsidAuthMethod implements AuthMethod {
    /**
     * Accepts SSID for authentication.
     *
     * B2B-client's application can retrieve SSID over b2b-gateway API: [/v1/b2b-gateway/users/{user_id}/sessions](https://github.com/quadcode/b2b-gateway-api/blob/ec176e29fcf8a60e94398ce9a0120a23802a83dd/quadcode-internal-balance-openapi.yaml#L104).
     *
     * @param ssid - User's session ID.
     */
    public constructor(private readonly ssid: string) {
    }

    /**
     * Authenticates client in WebSocket API.
     * @param wsApiClient - Instance of WebSocket API client.
     */
    public async authenticateWsApiClient(wsApiClient: WsApiClient): Promise<boolean> {
        const authResponse = await wsApiClient.doRequest<Authenticated>(new Authenticate(this.ssid))
        return authResponse.isSuccessful
    }
}

/**
 * Implements login/password authentication flow.
 */
export class LoginPasswordAuthMethod implements AuthMethod {
    private readonly httpApiClient: HttpApiClient

    /**
     * Accepts login and password for authentication.
     *
     * @param httpApiUrl
     * @param login
     * @param password
     */
    public constructor(private readonly httpApiUrl: string, private readonly login: string, private readonly password: string) {
        this.httpApiClient = new HttpApiClient(this.httpApiUrl)
    }

    /**
     * Authenticates client in WebSocket API.
     * @param wsApiClient
     */
    public async authenticateWsApiClient(wsApiClient: WsApiClient): Promise<boolean> {
        const response = await this.httpApiClient.doRequest(new HttpLoginRequest(this.login, this.password))

        if (response.status === 200 && response.data.code === 'success') {
            const authResponse = await wsApiClient.doRequest<Authenticated>(new Authenticate(response.data.ssid))
            return authResponse.isSuccessful
        }

        return false
    }
}

/**
 * Don't use this class directly from your code. Use {@link QuadcodeClientSdk.userProfile} field instead.
 *
 * User profile facade class. Stores information about the user on whose behalf your application is working.
 */
export class UserProfile {
    /**
     * Creates instance of class {@link UserProfile}.
     * @param userId - User's identification number.
     * @internal
     * @private
     */
    private constructor(public readonly userId: number) {
    }

    /**
     * Requests information about current user, puts the information to instance of class UserProfile and returns it.
     * @param wsApiClient - Instance of WebSocket API client.
     */
    public static async create(wsApiClient: WsApiClient): Promise<UserProfile> {
        const userProfile = await wsApiClient.doRequest<CoreProfileV1>(new CallCoreGetProfileV1())
        return new UserProfile(userProfile.userId)
    }
}

/**
 * Don't use this class directly from your code. Use {@link QuadcodeClientSdk.balances} static method instead.
 *
 * Balances facade class. Stores information about user's balances. Keeps balances' information up to date.
 */
export class Balances {
    /**
     * Balances current state.
     * @private
     */
    private balances: Map<number, Balance> = new Map<number, Balance>()

    /**
     * Create instance from DTO.
     * @param types - List of supported balance type ids.
     * @param balancesMsg - Balances data transfer object.
     * @internal
     * @private
     */
    private constructor(private readonly types: number[], balancesMsg: InternalBillingBalancesV1) {
        for (const index in balancesMsg.items) {
            const balance = new Balance(balancesMsg.items[index])
            this.balances.set(balance.id, balance)
        }
    }

    /**
     * Requests information about user's balances, subscribes on user's balances updates, puts the information to instance of class Balances and returns it.
     * @param wsApiClient - Instance of WebSocket API client.
     */
    public static async create(wsApiClient: WsApiClient): Promise<Balances> {
        const types = [1, 4]
        const balancesMsg = await wsApiClient.doRequest<InternalBillingBalancesV1>(new CallInternalBillingGetBalancesV1(types))

        const balances = new Balances(types, balancesMsg)

        await wsApiClient.subscribe<InternalBillingBalanceChangedV1>(new SubscribeInternalBillingBalanceChangedV1(), (event: InternalBillingBalanceChangedV1) => {
            balances.updateBalance(event)
        })

        return balances
    }

    /**
     * Returns list of user's balances. Every item of the list is reference to refreshable object.
     */
    public getBalances(): Balance[] {
        const list: Balance[] = []
        for (const [index] of this.balances) {
            list.push(this.balances.get(index)!)
        }
        return list
    }

    /**
     * Returns user's balance with specified ID. If balance does not exist then error will be thrown.
     * @param balanceId - Balance identification number.
     */
    public getBalanceById(balanceId: number): Balance {
        if (!this.balances.has(balanceId)) {
            throw new Error(`balance with id '${balanceId}' is not found`)
        }

        return this.balances.get(balanceId)!
    }

    /**
     * Updates instance from DTO.
     * @param balanceChangedMsg - Balances data transfer object.
     * @private
     */
    private updateBalance(balanceChangedMsg: InternalBillingBalanceChangedV1): void {
        if (!this.types.includes(balanceChangedMsg.type)) {
            return
        }

        if (!this.balances.has(balanceChangedMsg.id)) {
            return
        }

        this.balances.get(balanceChangedMsg.id)!.update(balanceChangedMsg)
    }
}

/**
 * User's balance refreshable class.
 */
export class Balance {
    /**
     * User's balance identification number.
     */
    public id: number

    /**
     * User's balance type.
     */
    public type: BalanceType | undefined

    /**
     * Current amount of money on user's balance.
     */
    public amount: number

    /**
     * User's balance currency code (ISO 4217).
     */
    public currency: string

    /**
     * User's identification number.
     */
    public userId: number

    /**
     * Balance updates observer.
     * @private
     */
    private onUpdateObserver: Observable<Balance> = new Observable<Balance>()

    /**
     * Initialises the class instance from DTO.
     * @param msg - Balance data transfer object.
     * @internal
     * @private
     */
    public constructor(msg: InternalBillingBalanceV1) {
        this.id = msg.id
        this.type = this.convertBalanceType(msg.type)
        this.amount = msg.amount
        this.currency = msg.currency
        this.userId = msg.userId
    }

    /**
     * Adds specified callback to balance update subscribers' list.
     * @param callback - Callback will be called for every change of balance.
     */
    public subscribeOnUpdate(callback: CallbackForBalanceUpdate): void {
        this.onUpdateObserver.subscribe(callback)
    }

    /**
     * Removes specified callback from balance update subscribers' list.
     * @param callback - Callback for remove.
     */
    public unsubscribeOnUpdate(callback: CallbackForBalanceUpdate): void {
        this.onUpdateObserver.unsubscribe(callback)
    }

    /**
     * Updates the class instance from DTO.
     * @param msg - Balance data transfer object.
     * @private
     */
    update(msg: InternalBillingBalanceChangedV1): void {
        this.type = this.convertBalanceType(msg.type)
        this.amount = msg.amount
        this.currency = msg.currency
        this.userId = msg.userId

        this.onUpdateObserver.notify(this)
    }

    /**
     * Converts balance type id to text representation.
     * @param typeId - Balance type ID.
     * @private
     */
    private convertBalanceType(typeId: number): BalanceType | undefined {
        switch (typeId) {
            case 1:
                return BalanceType.Real
            case 4:
                return BalanceType.Demo
        }

        return undefined
    }
}

/**
 * Callback for handle balance's update.
 */
export type CallbackForBalanceUpdate = (balance: Balance) => void

/**
 * Balance type enum.
 */
export enum BalanceType {
    /**
     * Real balance type. This type is used for trading on real funds.
     */
    Real = 'real',

    /**
     * Demo balance type. This type is used for practice/testing on non-real funds. Funds on demo balance can't be withdrawal.
     */
    Demo = 'demo',
}

/**
 * Don't use this class directly from your code. Use {@link QuadcodeClientSdk.quotes} static method instead.
 *
 * Quotes facade class. Stores information about quotes (market data). Keeps quotes' information up to date.
 */
export class Quotes {
    /**
     * Instance of WebSocket API client.
     * @private
     */
    private wsApiClient: WsApiClient

    /**
     * Quotes current state.
     * @private
     */
    private currentQuotes: Map<number, CurrentQuote> = new Map<number, CurrentQuote>()

    /**
     * Creates class instance.
     * @param wsApiClient - Instance of WebSocket API client.
     * @internal
     * @private
     */
    public constructor(wsApiClient: WsApiClient) {
        this.wsApiClient = wsApiClient
    }

    /**
     * Returns refreshable current quote instance for specified active.
     * @param activeId - Active ID for which the current quote is requested.
     */
    public async getCurrentQuoteForActive(activeId: number): Promise<CurrentQuote> {
        if (this.currentQuotes.has(activeId)) {
            return this.currentQuotes.get(activeId)!
        }

        const currentQuote = new CurrentQuote()
        this.currentQuotes.set(activeId, currentQuote)

        await this.wsApiClient.subscribe<QuoteGenerated>(new SubscribeQuoteGenerated(activeId), (event: QuoteGenerated) => {
            if (event.activeId !== activeId) {
                return
            }
            currentQuote.update(event)
        })

        return currentQuote
    }
}

/**
 * Active's current quote refreshable class.
 */
export class CurrentQuote {
    /**
     * Current quote's active ID.
     */
    public activeId: number | undefined

    /**
     * Current quote's time.
     */
    public time: Date | undefined

    /**
     * Current quote's ask (offer) price.
     */
    public ask: number | undefined

    /**
     * Current quote's bid price.
     */
    public bid: number | undefined

    /**
     * Current quote's middle price between ask and bid. `value=(ask+bid)/2`. This price is used for buy/expire option's orders.
     */
    public value: number | undefined

    /**
     * Current quote's phase.
     *
     * `T` - quote is inside regular trading session.
     *
     * `C` - quote is outside any trading session.
     */
    public phase: string | undefined

    /**
     * Position updates observer.
     * @private
     */
    private onUpdateObserver: Observable<CurrentQuote> = new Observable<CurrentQuote>()

    /**
     * Adds specified callback to current quote update subscribers' list.
     * @param callback - Callback will be called for every change of current quote.
     */
    public subscribeOnUpdate(callback: CallbackForCurrentQuoteUpdate): void {
        this.onUpdateObserver.subscribe(callback)
    }

    /**
     * Removes specified callback from current quote update subscribers' list.
     * @param callback - Callback for remove.
     */
    public unsubscribeOnUpdate(callback: CallbackForCurrentQuoteUpdate): void {
        this.onUpdateObserver.unsubscribe(callback)
    }

    /**
     * Updates current quote from DTO.
     * @param msg - Current quote data transfer object.
     * @private
     */
    update(msg: {
        /**
         * Active ID.
         */
        activeId: number,

        /**
         * Quote UNIX time.
         */
        time: number,

        /**
         * Quote ask (offer) price.
         */
        ask: number,

        /**
         * Quote bid price.
         */
        bid: number,

        /**
         * Quote middle price.
         */
        value: number,

        /**
         * Quote trading phase.
         */
        phase: string
    }): void {
        this.activeId = msg.activeId
        this.time = new Date(msg.time * 1000)
        this.ask = msg.ask
        this.bid = msg.bid
        this.value = msg.value
        this.phase = msg.phase

        this.onUpdateObserver.notify(this)
    }
}

/**
 * Callback for handle current quote update.
 */
export type CallbackForCurrentQuoteUpdate = (currentQuote: CurrentQuote) => void;

/**
 * Don't use this class directly from your code. Use the following methods instead:
 *
 * * {@link BlitzOptions.positionsByBalance}
 * * {@link TurboOptions.positionsByBalance}
 * * {@link BinaryOptions.positionsByBalance}
 * * {@link DigitalOptions.positionsByBalance}
 *
 * Positions facade class. Stores information about opened positions. Keeps positions' information up to date.
 */
export class Positions {
    /**
     * Positions current state.
     * @private
     */
    private positions: Map<number, Position> = new Map<number, Position>()

    /**
     * Positions updates observer.
     * @private
     */
    private onUpdatePositionObserver: Observable<Position> = new Observable<Position>()

    /**
     * Just private constructor. Just private constructor. Use {@link Positions.create create} instead.
     * @internal
     * @private
     */
    private constructor() {
    }

    /**
     * Subscribes on opened positions' updates, requests current state of opened positions, puts the current state to instance of class Positions and returns it.
     * @param wsApiClient - Instance of WebSocket API client.
     * @param instrumentType - Type of trading instrument.
     * @param balance - Balance for which the positions are being requested.
     */
    public static async create(wsApiClient: WsApiClient, instrumentType: string, balance: Balance): Promise<Positions> {
        const positionsFacade = new Positions()

        await wsApiClient.subscribe<PortfolioPositionChangedV3>(new SubscribePortfolioPositionChangedV3(
            balance.userId,
            balance.id,
            instrumentType
        ), (event: PortfolioPositionChangedV3) => {
            if (event.instrumentType !== instrumentType || event.userBalanceId !== balance.id) {
                return
            }

            positionsFacade.syncPositionFromEvent(event)
        })

        let offset = 0
        for (; ;) {
            const positionsPage = await wsApiClient.doRequest<PortfolioPositionsV4>(new CallPortfolioGetPositionsV4(
                [instrumentType],
                balance.id,
                30,
                offset
            ))

            for (const index in positionsPage.positions) {
                positionsFacade.syncPositionFromResponse(positionsPage.positions[index])
            }

            if (positionsPage.positions.length < positionsPage.limit) {
                break
            }

            offset++
        }

        return positionsFacade
    }

    /**
     * Returns list of all positions.
     */
    public getAllPositions(): Position[] {
        const list = []

        for (const [index] of this.positions) {
            list.push(this.positions.get(index)!)
        }

        return list
    }

    /**
     * Adds specified callback to position update subscribers' list.
     * @param callback - Callback will be called for every change of position.
     */
    public subscribeOnUpdatePosition(callback: CallbackForPositionUpdate): void {
        this.onUpdatePositionObserver.subscribe(callback)
    }

    /**
     * Removes specified callback from position update subscribers' list.
     * @param callback - Callback for remove.
     */
    public unsubscribeOnUpdatePosition(callback: CallbackForPositionUpdate): void {
        this.onUpdatePositionObserver.unsubscribe(callback)
    }

    /**
     * Updates instance from DTO.
     * @param msg - Position data transfer object.
     * @private
     */
    private syncPositionFromResponse(msg: PortfolioPositionsV4Position): void {
        if (!this.positions.has(msg.externalId)) {
            const position = new Position()
            position.id = msg.externalId
            this.positions.set(msg.externalId, position)
        }

        const position = this.positions.get(msg.externalId)!
        position.syncFromResponse(msg)
        this.onUpdatePositionObserver.notify(position)
    }

    /**
     * Updates instance from DTO.
     * @param msg - Position data transfer object.
     * @private
     */
    private syncPositionFromEvent(msg: PortfolioPositionChangedV3): void {
        if (!this.positions.has(msg.externalId)) {
            const position = new Position()
            position.id = msg.externalId
            this.positions.set(msg.externalId, position)
        }

        const position = this.positions.get(msg.externalId)!
        position.syncFromEvent(msg)
        this.onUpdatePositionObserver.notify(position)
    }
}

/**
 * Callback for handle position's update.
 */
export type CallbackForPositionUpdate = (position: Position) => void

/**
 * Position refreshable class.
 */
export class Position {
    /**
     * Position's identification number.
     */
    public id: number | undefined

    /**
     * Position's active ID.
     */
    public activeId: number | undefined

    /**
     * Position's balance ID.
     */
    public balanceId: number | undefined

    /**
     * Amount of profit by the position.
     */
    public closeProfit: number | undefined

    /**
     * Quote price at which the position was closed.
     */
    public closeQuote: number | undefined

    /**
     * Position's close reason.
     */
    public closeReason: string | undefined

    /**
     * The time at which the position was closed.
     */
    public closeTime: Date | undefined

    /**
     * Expected profit for the position.
     */
    public expectedProfit: number | undefined

    /**
     * Type of trading instrument.
     */
    public instrumentType: string | undefined

    /**
     * The amount of the initial investment.
     */
    public invest: number | undefined

    /**
     * Quote price at which the position was opened.
     */
    public openQuote: number | undefined

    /**
     * The time at which the position was opened.
     */
    public openTime: Date | undefined

    /**
     * Expected PnL for the position.
     */
    public pnl: number | undefined

    /**
     * PnL with which the position was closed.
     */
    public pnlRealized: number | undefined

    /**
     * Quote time at which the position was opened.
     */
    public quoteTimestamp: Date | undefined

    /**
     * Position's status.
     */
    public status: string | undefined

    /**
     * Position's user ID.
     */
    public userId: number | undefined

    /**
     * Version of position. Used for filter old versions of position's state.
     * @private
     */
    private version: number | undefined

    /**
     * Synchronises position from DTO.
     * @param msg - Position data transfer object.
     * @private
     */
    syncFromResponse(msg: PortfolioPositionsV4Position): void {
        this.id = msg.externalId
        this.activeId = msg.activeId
        this.balanceId = msg.userBalanceId
        this.expectedProfit = msg.expectedProfit
        this.instrumentType = msg.instrumentType
        this.invest = msg.invest
        this.openQuote = msg.openQuote
        this.openTime = new Date(msg.openTime)
        this.pnl = msg.pnl
        this.quoteTimestamp = msg.quoteTimestamp !== undefined ? new Date(msg.quoteTimestamp) : undefined
        this.status = msg.status
        this.userId = msg.userId
    }

    /**
     * Synchronises position from DTO.
     * @param msg - Position data transfer object.
     * @private
     */
    syncFromEvent(msg: PortfolioPositionChangedV3): void {
        if (this.version !== undefined && msg.version !== undefined && this.version >= msg.version) {
            return
        }
        this.activeId = msg.activeId
        this.balanceId = msg.userBalanceId
        this.closeProfit = msg.closeProfit
        this.closeQuote = msg.closeQuote
        this.closeReason = msg.closeReason
        this.closeTime = msg.closeTime !== undefined ? new Date(msg.closeTime) : undefined
        this.expectedProfit = msg.expectedProfit
        this.version = msg.version
        this.instrumentType = msg.instrumentType
        this.invest = msg.invest
        this.openQuote = msg.openQuote
        this.openTime = new Date(msg.openTime)
        this.pnl = msg.pnl
        this.pnlRealized = msg.pnlRealized
        this.quoteTimestamp = msg.quoteTimestamp !== undefined ? new Date(msg.quoteTimestamp) : undefined
        this.status = msg.status
        this.userId = msg.userId
    }
}

/**
 * Don't use this class directly from your code. Use {@link QuadcodeClientSdk.blitzOptions} static method instead.
 *
 * Blitz options facade class.
 */
export class BlitzOptions {
    /**
     * Actives current state.
     * @private
     */
    private actives: Map<number, BlitzOptionsActive> = new Map<number, BlitzOptionsActive>()

    /**
     * Instance of WebSocket API client.
     * @private
     */
    private readonly wsApiClient: WsApiClient

    /**
     * Creates instance from DTO.
     * @param activesMsg - actives data transfer object.
     * @param wsApiClient - Instance of WebSocket API client.
     * @internal
     * @private
     */
    private constructor(activesMsg: InitializationDataV3BlitzActive[], wsApiClient: WsApiClient) {
        this.wsApiClient = wsApiClient

        this.updateActives(activesMsg)
    }

    /**
     * Requests information about blitz options actives, runs timer for periodical actives list update, puts the information to instance of class BlitzOptions and returns it.
     * @param wsApiClient - Instance of WebSocket API client.
     */
    public static async create(wsApiClient: WsApiClient): Promise<BlitzOptions> {
        const initializationData = await wsApiClient.doRequest<InitializationDataV3>(new CallGetInitializationDataV3())

        const blitzOptions = new BlitzOptions(initializationData.blitzActives, wsApiClient)

        setInterval(async () => {
            const response = await wsApiClient.doRequest<InitializationDataV3>(new CallGetInitializationDataV3())
            blitzOptions.updateActives(response.blitzActives)
        }, 600000)

        return blitzOptions
    }

    /**
     * Returns list of blitz options actives.
     */
    public getActives(): BlitzOptionsActive[] {
        const list = []
        for (const [index] of this.actives) {
            list.push(this.actives.get(index)!)
        }
        return list
    }

    /**
     * Returns refreshable instance of class BlitzOptionsActive by specified active ID. If active doesn't exist then error will be thrown.
     * @param activeId - Active identification number.
     */
    public getActive(activeId: number): BlitzOptionsActive {
        if (!this.actives.has(activeId)) {
            throw new Error(`active with id '${activeId}' is not found`)
        }

        return this.actives.get(activeId)!
    }

    /**
     * Makes request for buy blitz option.
     * @param active - The asset for which the option is purchased.
     * @param direction - Direction of price change.
     * @param expirationSize - How many seconds after buying an option should the option expire. A list of available expiration sizes can be found {@link BlitzOptionsActive.expirationTimes}.
     * @param price - The amount of the initial investment.
     * @param balance - The balance from which the initial investment will be written off and upon successful closing of the position, profit will be credited to this balance.
     */
    public async buy(
        active: BlitzOptionsActive,
        direction: BlitzOptionsDirection,
        expirationSize: number,
        price: number,
        balance: Balance
    ): Promise<BlitzOptionsOption> {
        const request = new CallBinaryOptionsOpenBlitzOptionV1(
            active.id,
            direction,
            expirationSize,
            price,
            balance.id
        )
        const response = await this.wsApiClient.doRequest<BinaryOptionsOptionV1>(request)
        return new BlitzOptionsOption(response)
    }

    /**
     * Returns blitz options positions facade class for specified balance.
     * @param balance - User's balance for which the positions are being requested.
     */
    public positionsByBalance(balance: Balance): Promise<Positions> {
        return Positions.create(this.wsApiClient, 'blitz-option', balance)
    }

    /**
     * Update instance from DTO.
     * @param activesMsg - Actives data transfer object.
     * @private
     */
    private updateActives(activesMsg: InitializationDataV3BlitzActive[]): void {
        for (const index in activesMsg) {
            if (this.actives.has(activesMsg[index].id)) {
                this.actives.get(activesMsg[index].id)!.update(activesMsg[index])
            } else {
                this.actives.set(activesMsg[index].id, new BlitzOptionsActive(activesMsg[index]))
            }
            // @todo mark absent actives as deleted.
        }
    }
}

/**
 * Blitz options direction of price change.
 */
export enum BlitzOptionsDirection {
    /**
     * The decision is that the price will go up.
     */
    Call = 'call',

    /**
     * The decision is that the price will go down.
     */
    Put = 'put',
}

/**
 * Blitz options active refreshable class.
 */
export class BlitzOptionsActive {
    /**
     * Active's identification number.
     */
    public id: number

    /**
     * Active's ticker (symbol).
     */
    public ticker: string

    /**
     * Is trading suspended on the active.
     */
    public isSuspended: boolean

    /**
     * Expiration times (sizes) available for the active.
     */
    public expirationTimes: number[]

    /**
     * The commission is taken from 100% of the profit. Therefore, income percent can be calculated using the following formula: `profitIncomePercent=100-profitCommissionPercent`.
     */
    public profitCommissionPercent: number

    /**
     * Active's trading schedule.
     */
    public schedule: BlitzOptionsActiveTradingSession[] = []

    /**
     * Creates class instance from DTO.
     * @param msg - Actives' data transfer object.
     * @internal
     * @private
     */
    public constructor(msg: InitializationDataV3BlitzActive) {
        this.id = msg.id
        this.ticker = msg.ticker
        this.isSuspended = msg.isSuspended
        this.expirationTimes = msg.expirationTimes
        this.profitCommissionPercent = msg.profitCommission
        this.schedule = []
        for (const index in msg.schedule) {
            this.schedule.push(new BlitzOptionsActiveTradingSession(msg.schedule[index][0], msg.schedule[index][1]))
        }
    }

    /**
     * Checks whether an option on an active can be purchased at a specified time.
     * @param at - Time for which the check is performed.
     */
    public canBeBoughtAt(at: Date): boolean {
        if (this.isSuspended) {
            return false
        }

        const atUnixTimeMilli = at.getTime()
        return this.schedule.findIndex((session: BlitzOptionsActiveTradingSession): boolean => {
            return session.from.getTime() <= atUnixTimeMilli && session.to.getTime() >= atUnixTimeMilli
        }) >= 0
    }

    /**
     * Updates the instance from DTO.
     * @param msg - Active's data transfer object.
     * @private
     */
    update(msg: InitializationDataV3BlitzActive): void {
        this.ticker = msg.ticker
        this.expirationTimes = msg.expirationTimes
        this.isSuspended = msg.isSuspended
        this.profitCommissionPercent = msg.profitCommission
        this.schedule = []
        for (const index in msg.schedule) {
            this.schedule.push(new BlitzOptionsActiveTradingSession(msg.schedule[index][0], msg.schedule[index][1]))
        }
    }
}

/**
 * Blitz options active trading session class.
 */
export class BlitzOptionsActiveTradingSession {
    /**
     * Start time of trading session.
     */
    public from: Date

    /**
     * End time of trading session.
     */
    public to: Date

    /**
     * Initialises class instance from DTO.
     * @param fromTs - Unix time of session start.
     * @param toTs - Unix time of session end.
     */
    public constructor(fromTs: number, toTs: number) {
        this.from = new Date(fromTs * 1000)
        this.to = new Date(toTs * 1000)
    }
}

/**
 * Blitz options option order class.
 */
export class BlitzOptionsOption {
    /**
     * Option's ID.
     */
    public id: number

    /**
     * Option's active ID.
     */
    public activeId: number

    /**
     * Option's price direction.
     */
    public direction: BlitzOptionsDirection

    /**
     * Option's expiration time.
     */
    public expiredAt: Date

    /**
     * Option's amount of the initial investment.
     */
    public price: number

    /**
     * Option's profit income percent.
     */
    public profitIncomePercent: number

    /**
     * The time when the option was purchased.
     */
    public openedAt: Date

    /**
     * The {@link CurrentQuote.value value} of the quote at which the option was purchased.
     */
    public openQuoteValue: number

    /**
     * Creates class instance from DTO.
     * @param msg - Option's data transfer object.
     * @internal
     * @private
     */
    public constructor(msg: BinaryOptionsOptionV1) {
        this.id = msg.id
        this.activeId = msg.activeId
        this.direction = <BlitzOptionsDirection>msg.direction
        this.price = msg.price
        this.expiredAt = new Date(msg.expired * 1000)
        this.profitIncomePercent = msg.profitIncome
        this.openedAt = new Date(msg.timeRate * 1000)
        this.openQuoteValue = msg.value
    }
}

/**
 * Don't use this class directly from your code. Use {@link QuadcodeClientSdk.turboOptions} static method instead.
 *
 * Turbo options facade class.
 */
export class TurboOptions {
    /**
     * Actives current state.
     * @private
     */
    private actives: Map<number, TurboOptionsActive> = new Map<number, TurboOptionsActive>()

    /**
     * Instance of WebSocket API client.
     * @private
     */
    private readonly wsApiClient: WsApiClient

    /**
     * Creates class instance.
     * @param activesMsg - Actives data transfer object.
     * @param wsApiClient - Instance of WebSocket API client.
     * @internal
     * @private
     */
    private constructor(activesMsg: InitializationDataV3TurboActive[], wsApiClient: WsApiClient) {
        this.wsApiClient = wsApiClient

        this.updateActives(activesMsg)
    }

    /**
     * Requests information about turbo options actives, runs timer for periodical actives list update, puts the information to instance of class TurboOptions and returns it.
     * @param wsApiClient - Instance of WebSocket API client.
     */
    public static async create(wsApiClient: WsApiClient): Promise<TurboOptions> {
        const initializationData = await wsApiClient.doRequest<InitializationDataV3>(new CallGetInitializationDataV3())

        const turboOptions = new TurboOptions(initializationData.turboActives, wsApiClient)

        setInterval(async () => {
            const response = await wsApiClient.doRequest<InitializationDataV3>(new CallGetInitializationDataV3())
            turboOptions.updateActives(response.turboActives)
        }, 600000)

        return turboOptions
    }

    /**
     * Returns list of turbo options actives.
     */
    public getActives(): TurboOptionsActive[] {
        const list = []
        for (const [index] of this.actives) {
            list.push(this.actives.get(index)!)
        }
        return list
    }

    /**
     * Returns refreshable instance of class TurboOptionsActive by specified active ID. If active doesn't exist then error will be thrown.
     * @param activeId - Active identification number.
     */
    public getActive(activeId: number): TurboOptionsActive {
        if (!this.actives.has(activeId)) {
            throw new Error(`active with id '${activeId}' is not found`)
        }

        return this.actives.get(activeId)!
    }

    /**
     * Makes request for buy turbo option.
     * @param instrument - The instrument for which the option is purchased.
     * @param direction - Direction of price change.
     * @param price - The amount of the initial investment.
     * @param balance - The balance from which the initial investment will be written off and upon successful closing of the position, profit will be credited to this balance.
     */
    public async buy(
        instrument: TurboOptionsActiveInstrument,
        direction: TurboOptionsDirection,
        price: number,
        balance: Balance
    ): Promise<TurboOptionsOption> {
        const request = new CallBinaryOptionsOpenTurboOptionV1(
            instrument.activeId,
            Math.trunc(instrument.expiredAt.getTime() / 1000),
            direction,
            price,
            balance.id
        )
        const response = await this.wsApiClient.doRequest<BinaryOptionsOptionV1>(request)
        return new TurboOptionsOption(response)
    }

    /**
     * Returns turbo options positions facade class for specified balance.
     * @param balance - User's balance for which the positions are being requested.
     */
    public positionsByBalance(balance: Balance): Promise<Positions> {
        return Positions.create(this.wsApiClient, 'turbo-option', balance)
    }

    /**
     * Updates instance from DTO.
     * @param activesMsg - Actives data transfer object.
     * @private
     */
    private updateActives(activesMsg: InitializationDataV3TurboActive[]): void {
        for (const index in activesMsg) {
            if (this.actives.has(activesMsg[index].id)) {
                this.actives.get(activesMsg[index].id)!.update(activesMsg[index])
            } else {
                this.actives.set(activesMsg[index].id, new TurboOptionsActive(activesMsg[index], this.wsApiClient.currentTime))
            }
            // @todo mark absent actives as deleted.
        }
    }
}

/**
 * Turbo options direction of price change.
 */
export enum TurboOptionsDirection {
    /**
     * The decision is that the price will go up.
     */
    Call = 'call',

    /**
     * The decision is that the price will go down.
     */
    Put = 'put',
}

/**
 * Turbo options active refreshable class.
 */
export class TurboOptionsActive {
    /**
     * Active's identification number.
     */
    public id: number

    /**
     * How many seconds before expiration time the ability to buyback options for this active will not be allowed.
     */
    public buybackDeadtime: number

    /**
     * How many seconds before expiration time the ability to purchase options for this active will not be allowed.
     */
    public deadtime: number

    /**
     * Active's ticker (symbol).
     */
    public ticker: string

    /**
     * Is buyback available in the active.
     */
    public isBuyback: boolean

    /**
     * Is trading suspended on the active.
     */
    public isSuspended: boolean

    /**
     * Count of nearest options available for the active.
     */
    public optionCount: number

    /**
     * Expiration times (sizes) available for the active.
     */
    public expirationTimes: number[]

    /**
     * The commission is taken from 100% of the profit. Therefore, income percent can be calculated using the following formula: `profitIncomePercent=100-profitCommissionPercent`.
     */
    public profitCommissionPercent: number

    /**
     * Active's trading schedule.
     */
    public schedule: TurboOptionsActiveTradingSession[] = []

    /**
     * An object with the current time obtained from WebSocket API.
     * @private
     */
    private readonly currentTime: WsApiClientCurrentTime

    /**
     * Instruments facade class instance.
     * @private
     */
    private instrumentsFacade: TurboOptionsActiveInstruments | undefined

    /**
     * Creates instance from DTO.
     * @param msg - Active's data transfer object.
     * @param currentTime - An object with the current time obtained from WebSocket API.
     * @internal
     * @private
     */
    public constructor(msg: InitializationDataV3TurboActive, currentTime: WsApiClientCurrentTime) {
        this.id = msg.id
        this.deadtime = msg.deadtime
        this.buybackDeadtime = msg.buybackDeadtime
        this.isBuyback = msg.isBuyback
        this.ticker = msg.ticker
        this.optionCount = msg.optionCount
        this.isSuspended = msg.isSuspended
        this.profitCommissionPercent = msg.profitCommission
        this.expirationTimes = msg.expirationTimes
        this.schedule = []
        for (const index in msg.schedule) {
            this.schedule.push(new TurboOptionsActiveTradingSession(msg.schedule[index][0], msg.schedule[index][1]))
        }
        this.currentTime = currentTime
    }

    /**
     * Returns turbo options active's instruments facade.
     */
    public async instruments(): Promise<TurboOptionsActiveInstruments> {
        if (!this.instrumentsFacade) {
            this.instrumentsFacade = await TurboOptionsActiveInstruments.create(this, this.currentTime)
        }
        return this.instrumentsFacade
    }

    /**
     * Updates the instance from DTO.
     * @param msg - Active's data transfer object.
     * @private
     */
    update(msg: InitializationDataV3TurboActive): void {
        this.deadtime = msg.deadtime
        this.buybackDeadtime = msg.buybackDeadtime
        this.ticker = msg.ticker
        this.isSuspended = msg.isSuspended
        this.isBuyback = msg.isBuyback
        this.profitCommissionPercent = msg.profitCommission
        this.optionCount = msg.optionCount
        this.expirationTimes = msg.expirationTimes
        this.schedule = []
        for (const index in msg.schedule) {
            this.schedule.push(new TurboOptionsActiveTradingSession(msg.schedule[index][0], msg.schedule[index][1]))
        }
    }
}

/**
 * Turbo options active trading session class.
 */
export class TurboOptionsActiveTradingSession {
    /**
     * Start time of trading session.
     */
    public from: Date

    /**
     * End time of trading session.
     */
    public to: Date

    /**
     * Initialises class instance from DTO.
     * @param fromTs - Unix time of session start.
     * @param toTs - Unix time of session end.
     */
    public constructor(fromTs: number, toTs: number) {
        this.from = new Date(fromTs * 1000)
        this.to = new Date(toTs * 1000)
    }
}

/**
 * Turbo options active's instruments facade class. Periodically generates active's instruments based on active's settings.
 */
export class TurboOptionsActiveInstruments {
    /**
     * Instruments current state.
     * @private
     */
    private instruments: Map<string, TurboOptionsActiveInstrument> = new Map<string, TurboOptionsActiveInstrument>()

    /**
     * Creates class instance.
     * @param activeId - Active ID.
     * @param deadtime - Deadtime.
     * @param optionCount - Options count.
     * @param expirationTimes - Expiration sizes.
     * @param currentTime - An object with the current time obtained from WebSocket API.
     * @internal
     * @private
     */
    private constructor(
        private activeId: number,
        private deadtime: number,
        private optionCount: number,
        private expirationTimes: number[],
        private readonly currentTime: WsApiClientCurrentTime,
    ) {
    }

    /**
     * Runs timer for periodical active's instruments list generation, creates instance of this class and returns it.
     * @param active - The active for which instruments are generated.
     * @param currentTime - An object with the current time obtained from WebSocket API.
     */
    public static async create(active: TurboOptionsActive, currentTime: WsApiClientCurrentTime): Promise<TurboOptionsActiveInstruments> {
        const instrumentsFacade = new TurboOptionsActiveInstruments(
            active.id,
            active.deadtime,
            active.optionCount,
            active.expirationTimes,
            currentTime,
        )

        instrumentsFacade.generateInstruments()

        setInterval((): void => {
            instrumentsFacade.generateInstruments()
        }, 30000)

        return instrumentsFacade
    }

    /**
     * Returns list of instruments available for buy at specified time.
     * @param at - Time for which the check is performed.
     */
    public getAvailableForBuyAt(at: Date): TurboOptionsActiveInstrument[] {
        const list = []
        for (const [index] of this.instruments) {
            if (this.instruments.get(index)!.isAvailableForBuyAt(at)) {
                list.push(this.instruments.get(index)!)
            }
        }
        return list
    }

    /**
     * Generates instruments.
     * @private
     */
    private generateInstruments(): void {
        const generatedInstrumentsKeys = []
        const nowUnixTime = Math.trunc(this.currentTime.unixMilliTime / 1000)

        for (const index in this.expirationTimes) {
            const expirationSize = this.expirationTimes[index]
            let instrumentExpirationUnixTime = nowUnixTime + expirationSize - nowUnixTime % expirationSize
            for (let i = 0; i < this.optionCount; i++) {
                const key = `${this.activeId},${expirationSize},${instrumentExpirationUnixTime}`
                generatedInstrumentsKeys.push(key)
                if (!this.instruments.has(key)) {
                    this.instruments.set(key, new TurboOptionsActiveInstrument(this.activeId, expirationSize, new Date(instrumentExpirationUnixTime * 1000), this.deadtime))
                } else {
                    this.instruments.get(key)!.update(this.deadtime)
                }
                instrumentExpirationUnixTime += expirationSize
            }
        }

        for (const [index] of this.instruments) {
            if (!generatedInstrumentsKeys.includes(index)) {
                this.instruments.delete(index)
            }
        }
    }
}

/**
 * Turbo options active's instrument refreshable class.
 */
export class TurboOptionsActiveInstrument {
    /**
     * Creates instance of the class.
     * @param activeId - Instrument's active ID.
     * @param expirationSize - Instrument's expiration size.
     * @param expiredAt - The time when the instrument will be expired.
     * @param deadtime - How many seconds before expiration time the ability to purchase options for this instrument will not be allowed.
     * @internal
     * @private
     */
    public constructor(
        public readonly activeId: number,
        public readonly expirationSize: number,
        public readonly expiredAt: Date,
        public deadtime: number
    ) {
    }

    /**
     * Checks availability for buy option at specified time.
     * @param at - Time for which the check is performed.
     */
    public isAvailableForBuyAt(at: Date): boolean {
        return this.purchaseEndTime().getTime() > at.getTime()
    }

    /**
     * Returns the time until which it is possible to open trades that will fall into the current expiration.
     * @returns {Date}
     */
    public purchaseEndTime(): Date {
        const purchaseEndTime = new Date(this.expiredAt);
        purchaseEndTime.setTime(purchaseEndTime.getTime() - this.deadtime * 1000);

        return purchaseEndTime;
    }

    /**
     * Returns the remaining duration in milliseconds for which it is possible to purchase options.
     * @param {Date} currentTime - The current time.
     * @returns {number} - The remaining duration in milliseconds.
     */
    public durationRemainingForPurchase(currentTime: Date): number {
        const purchaseEndTime = this.purchaseEndTime();

        return purchaseEndTime.getTime() - currentTime.getTime();
    }

    /**
     * Updates the instance from DTO.
     * @param deadtime - How many seconds before expiration time the ability to purchase options for this instrument will not be allowed.
     * @private
     */
    update(deadtime: number): void {
        this.deadtime = deadtime
    }
}

/**
 * Turbo options option order class.
 */
export class TurboOptionsOption {
    /**
     * Option's ID.
     */
    public id: number

    /**
     * Option's active ID.
     */
    public activeId: number

    /**
     * Option's price direction.
     */
    public direction: TurboOptionsDirection

    /**
     * Option's expiration time.
     */
    public expiredAt: Date

    /**
     * Option's amount of the initial investment.
     */
    public price: number

    /**
     * Option's profit income percent.
     */
    public profitIncomePercent: number

    /**
     * The time when the option was purchased.
     */
    public openedAt: Date

    /**
     * The {@link CurrentQuote.value value} of the quote at which the option was purchased.
     */
    public openQuoteValue: number

    /**
     * Create instance from DTO.
     * @param msg - Option's data transfer object.
     * @internal
     * @private
     */
    public constructor(msg: BinaryOptionsOptionV1) {
        this.id = msg.id
        this.activeId = msg.activeId
        this.direction = <TurboOptionsDirection>msg.direction
        this.price = msg.price
        this.profitIncomePercent = msg.profitIncome
        this.expiredAt = new Date(msg.expired * 1000)
        this.openedAt = new Date(msg.timeRate * 1000)
        this.openQuoteValue = msg.value
    }
}

/**
 * Don't use this class directly from your code. Use {@link QuadcodeClientSdk.binaryOptions} static method instead.
 *
 * Binary options facade class.
 */
export class BinaryOptions {
    /**
     * Actives current state.
     * @private
     */
    private actives: Map<number, BinaryOptionsActive> = new Map<number, BinaryOptionsActive>()

    /**
     * Instance of WebSocket API client.
     * @private
     */
    private readonly wsApiClient: WsApiClient

    /**
     * Creates instance from DTO.
     * @param activesMsg - actives data transfer object.
     * @param wsApiClient - Instance of WebSocket API client.
     * @internal
     * @private
     */
    private constructor(activesMsg: InitializationDataV3BinaryActive[], wsApiClient: WsApiClient) {
        this.wsApiClient = wsApiClient

        this.updateActives(activesMsg)
    }

    /**
     * Requests information about binary options actives, runs timer for periodical actives list update, puts the information to instance of class BinaryOptions and returns it.
     * @param wsApiClient - Instance of WebSocket API client.
     */
    public static async create(wsApiClient: WsApiClient): Promise<BinaryOptions> {
        const initializationData = await wsApiClient.doRequest<InitializationDataV3>(new CallGetInitializationDataV3())

        const binaryOptions = new BinaryOptions(initializationData.binaryActives, wsApiClient)

        setInterval(async () => {
            const response = await wsApiClient.doRequest<InitializationDataV3>(new CallGetInitializationDataV3())
            binaryOptions.updateActives(response.binaryActives)
        }, 600000)

        return binaryOptions
    }

    /**
     * Returns list of binary options actives.
     */
    public getActives(): BinaryOptionsActive[] {
        const list = []
        for (const [index] of this.actives) {
            list.push(this.actives.get(index)!)
        }
        return list
    }

    /**
     * Returns refreshable instance of class BinaryOptionsActive by specified active ID. If active doesn't exist then error will be thrown.
     * @param activeId - Active identification number.
     */
    public getActive(activeId: number): BinaryOptionsActive {
        if (!this.actives.has(activeId)) {
            throw new Error(`active with id '${activeId}' is not found`)
        }

        return this.actives.get(activeId)!
    }

    /**
     * Makes request for buy binary option.
     * @param instrument - The instrument for which the option is purchased.
     * @param direction - Direction of price change.
     * @param price - The amount of the initial investment.
     * @param balance - The balance from which the initial investment will be written off and upon successful closing of the position, profit will be credited to this balance.
     */
    public async buy(
        instrument: BinaryOptionsActiveInstrument,
        direction: BinaryOptionsDirection,
        price: number,
        balance: Balance
    ): Promise<BinaryOptionsOption> {
        const request = new CallBinaryOptionsOpenBinaryOptionV1(
            instrument.activeId,
            Math.trunc(instrument.expiredAt.getTime() / 1000),
            direction,
            price,
            balance.id
        )
        const response = await this.wsApiClient.doRequest<BinaryOptionsOptionV1>(request)
        return new BinaryOptionsOption(response)
    }

    /**
     * Returns binary options positions facade class for specified balance.
     * @param balance - User's balance for which the positions are being requested.
     */
    public positionsByBalance(balance: Balance): Promise<Positions> {
        return Positions.create(this.wsApiClient, 'binary-option', balance)
    }

    /**
     * Updates actives from DTO.
     * @param activesMsg - Actives data transfer object.
     * @private
     */
    private updateActives(activesMsg: InitializationDataV3BinaryActive[]): void {
        for (const index in activesMsg) {
            if (this.actives.has(activesMsg[index].id)) {
                this.actives.get(activesMsg[index].id)!.update(activesMsg[index])
            } else {
                this.actives.set(activesMsg[index].id, new BinaryOptionsActive(activesMsg[index], this.wsApiClient.currentTime))
            }
            // @todo mark absent actives as deleted.
        }
    }
}

/**
 * Binary options direction of price change.
 */
export enum BinaryOptionsDirection {
    /**
     * The decision is that the price will go up.
     */
    Call = 'call',

    /**
     * The decision is that the price will go down.
     */
    Put = 'put',
}

/**
 * Binary options active refreshable class.
 */
export class BinaryOptionsActive {
    /**
     * Active's identification number.
     */
    public id: number

    /**
     * How many seconds before expiration time the ability to buyback options for this active will not be allowed.
     */
    public buybackDeadtime: number

    /**
     * How many seconds before expiration time the ability to purchase options for this active will not be allowed.
     */
    public deadtime: number

    /**
     * Active's ticker (symbol).
     */
    public ticker: string

    /**
     * Is buyback available in the active.
     */
    public isBuyback: boolean

    /**
     * Is trading suspended on the active.
     */
    public isSuspended: boolean

    /**
     * Count of nearest options available for the active.
     */
    public optionCount: number

    /**
     * List of special instruments available for the active.
     */
    public optionSpecial: BinaryOptionsActiveSpecialInstrument[] = []

    /**
     * Expiration times (sizes) available for the active.
     */
    public expirationTimes: number[]

    /**
     * The commission is taken from 100% of the profit. Therefore, income percent can be calculated using the following formula: `profitIncomePercent=100-profitCommissionPercent`.
     */
    public profitCommissionPercent: number

    /**
     * Active's trading schedule.
     */
    public schedule: BinaryOptionsActiveTradingSession[] = []

    /**
     * An object with the current time obtained from WebSocket API.
     * @private
     */
    private readonly currentTime: WsApiClientCurrentTime

    /**
     * Instruments facade class instance.
     * @private
     */
    private instrumentsFacade: BinaryOptionsActiveInstruments | undefined

    /**
     * Creates instance from DTO.
     * @param msg - Active's data transfer object.
     * @param currentTime - An object with the current time obtained from WebSocket API.
     * @internal
     * @private
     */
    public constructor(msg: InitializationDataV3BinaryActive, currentTime: WsApiClientCurrentTime) {
        this.id = msg.id
        this.deadtime = msg.deadtime
        this.ticker = msg.ticker
        this.isBuyback = msg.isBuyback
        this.isSuspended = msg.isSuspended
        this.buybackDeadtime = msg.buybackDeadtime
        this.optionCount = msg.optionCount
        this.expirationTimes = msg.expirationTimes
        this.profitCommissionPercent = msg.profitCommission

        this.schedule = []
        for (const index in msg.schedule) {
            this.schedule.push(new BinaryOptionsActiveTradingSession(msg.schedule[index][0], msg.schedule[index][1]))
        }

        for (const index in msg.optionSpecial) {
            this.optionSpecial.push(new BinaryOptionsActiveSpecialInstrument(msg.optionSpecial[index]))
        }

        this.currentTime = currentTime
    }

    /**
     * Returns binary options active's instruments facade.
     */
    public async instruments(): Promise<BinaryOptionsActiveInstruments> {
        if (!this.instrumentsFacade) {
            this.instrumentsFacade = await BinaryOptionsActiveInstruments.create(this, this.currentTime)
        }
        return this.instrumentsFacade
    }

    /**
     * Updates the instance from DTO.
     * @param msg - Active's data transfer object.
     * @private
     */
    update(msg: InitializationDataV3BinaryActive): void {
        this.buybackDeadtime = msg.buybackDeadtime
        this.deadtime = msg.deadtime
        this.ticker = msg.ticker
        this.isBuyback = msg.isBuyback
        this.isSuspended = msg.isSuspended
        this.expirationTimes = msg.expirationTimes
        this.optionCount = msg.optionCount
        this.profitCommissionPercent = msg.profitCommission

        this.schedule = []
        for (const index in msg.schedule) {
            this.schedule.push(new BinaryOptionsActiveTradingSession(msg.schedule[index][0], msg.schedule[index][1]))
        }

        this.optionSpecial = []
        for (const index in msg.optionSpecial) {
            this.optionSpecial.push(new BinaryOptionsActiveSpecialInstrument(msg.optionSpecial[index]))
        }
    }
}

/**
 * Binary options active trading session class.
 */
export class BinaryOptionsActiveTradingSession {
    /**
     * Start time of trading session.
     */
    public from: Date

    /**
     * End time of trading session.
     */
    public to: Date

    /**
     * Initialises class instance from DTO.
     * @param fromTs - Unix time of session start.
     * @param toTs - Unix time of session end.
     */
    public constructor(fromTs: number, toTs: number) {
        this.from = new Date(fromTs * 1000)
        this.to = new Date(toTs * 1000)
    }
}

/**
 * Binary options active's instruments facade class. Periodically generates active's instruments based on active's settings.
 */
export class BinaryOptionsActiveInstruments {
    /**
     * Instruments current state.
     * @private
     */
    private instruments: Map<string, BinaryOptionsActiveInstrument> = new Map<string, BinaryOptionsActiveInstrument>()

    /**
     * Creates class instance.
     * @param activeId - Active ID.
     * @param deadtime - Deadtime.
     * @param optionCount - Options count.
     * @param optionSpecial - Special instruments.
     * @param expirationTimes - Expiration sizes.
     * @param currentTime - An object with the current time obtained from WebSocket API.
     * @internal
     * @private
     */
    private constructor(
        private activeId: number,
        private deadtime: number,
        private optionCount: number,
        private optionSpecial: BinaryOptionsActiveSpecialInstrument[],
        private expirationTimes: number[],
        private readonly currentTime: WsApiClientCurrentTime,
    ) {
    }

    /**
     * Runs timer for periodical active's instruments list generation, creates instance of this class and returns it.
     * @param active - The active for which instruments are generated.
     * @param currentTime - An object with the current time obtained from WebSocket API.
     */
    public static async create(active: BinaryOptionsActive, currentTime: WsApiClientCurrentTime): Promise<BinaryOptionsActiveInstruments> {
        const instrumentsFacade = new BinaryOptionsActiveInstruments(
            active.id,
            active.deadtime,
            active.optionCount,
            active.optionSpecial,
            active.expirationTimes,
            currentTime,
        )

        instrumentsFacade.generateInstruments()

        setInterval(() => {
            instrumentsFacade.generateInstruments()
        }, 30000)

        return instrumentsFacade
    }

    /**
     * Returns list of instruments available for buy at specified time.
     * @param at - Time for which the check is performed.
     */
    public getAvailableForBuyAt(at: Date): BinaryOptionsActiveInstrument[] {
        const list = []
        for (const [index] of this.instruments) {
            if (this.instruments.get(index)!.isAvailableForBuyAt(at)) {
                list.push(this.instruments.get(index)!)
            }
        }
        return list
    }

    /**
     * Generates instruments.
     * @private
     */
    private generateInstruments(): void {
        const generatedInstrumentsKeys = []
        const nowUnixTime = Math.trunc(this.currentTime.unixMilliTime / 1000)

        for (const index in this.expirationTimes) {
            const expirationSize = this.expirationTimes[index]
            let instrumentExpirationUnixTime = nowUnixTime + expirationSize - nowUnixTime % expirationSize
            for (let i = 0; i < this.optionCount; i++) {
                const key = `${this.activeId},${expirationSize},${instrumentExpirationUnixTime}`
                generatedInstrumentsKeys.push(key)
                if (!this.instruments.has(key)) {
                    this.instruments.set(key, new BinaryOptionsActiveInstrument(this.activeId, expirationSize, new Date(instrumentExpirationUnixTime * 1000), this.deadtime))
                }
                this.instruments.get(key)!.update(this.deadtime)
                instrumentExpirationUnixTime += expirationSize
            }
        }

        for (const index in this.optionSpecial) {
            const specialInstrument = this.optionSpecial[index]
            if (!specialInstrument.isEnabled) {
                continue
            }
            const expirationSize = specialInstrument.title
            const key = `${this.activeId},${expirationSize},${specialInstrument.expiredAt.toISOString()}`
            generatedInstrumentsKeys.push(key)
            if (!this.instruments.has(key)) {
                this.instruments.set(key, new BinaryOptionsActiveInstrument(this.activeId, expirationSize, specialInstrument.expiredAt, this.deadtime))
            }
            this.instruments.get(key)!.update(this.deadtime)
        }

        for (const index in this.instruments) {
            if (!generatedInstrumentsKeys.includes(index)) {
                this.instruments.delete(index)
            }
        }
    }
}

/**
 * Binary options active's instrument refreshable class.
 */
export class BinaryOptionsActiveInstrument {
    /**
     * Creates instance of the class.
     * @param activeId - Instrument's active ID.
     * @param expirationSize - Instrument's expiration size.
     * @param expiredAt - The time when the instrument will be expired.
     * @param deadtime - How many seconds before expiration time the ability to purchase options for this instrument will not be allowed.
     * @internal
     * @private
     */
    public constructor(
        public readonly activeId: number,
        public readonly expirationSize: number | string,
        public readonly expiredAt: Date,
        public deadtime: number
    ) {
    }

    /**
     * Checks availability for buy option at specified time.
     * @param at - Time for which the check is performed.
     */
    public isAvailableForBuyAt(at: Date): boolean {
        return this.purchaseEndTime().getTime() > at.getTime()
    }

    /**
     * Returns the time until which it is possible to open trades that will fall into the current expiration.
     * @returns {Date}
     */
    public purchaseEndTime(): Date {
        const purchaseEndTime = new Date(this.expiredAt);
        purchaseEndTime.setTime(purchaseEndTime.getTime() - this.deadtime * 1000);

        return purchaseEndTime;
    }

    /**
     * Returns the remaining duration in milliseconds for which it is possible to purchase options.
     * @param {Date} currentTime - The current time.
     * @returns {number} - The remaining duration in milliseconds.
     */
    public durationRemainingForPurchase(currentTime: Date): number {
        const purchaseEndTime = this.purchaseEndTime();

        return purchaseEndTime.getTime() - currentTime.getTime();
    }

    /**
     * Updates the instance from DTO.
     * @param deadtime - How many seconds before expiration time the ability to purchase options for this instrument will not be allowed.
     * @private
     */
    update(deadtime: number): void {
        this.deadtime = deadtime
    }
}

/**
 * Binary options active's special instrument class.
 */
export class BinaryOptionsActiveSpecialInstrument {
    /**
     * Instrument's title.
     */
    public title: string

    /**
     * Is instrument allowed to trade.
     */
    public isEnabled: boolean

    /**
     * Instrument's expiration time.
     */
    public expiredAt: Date

    /**
     * Creates instance from DTO.
     * @param msg - Instrument's data transfer object.
     * @internal
     * @private
     */
    public constructor(msg: InitializationDataV3BinaryActiveSpecialInstrument) {
        this.title = msg.title
        this.isEnabled = msg.enabled
        this.expiredAt = new Date(msg.expiredAt * 1000)
    }
}

/**
 * Binary options option order class.
 */
export class BinaryOptionsOption {
    /**
     * Option's ID.
     */
    public id: number

    /**
     * Option's active ID.
     */
    public activeId: number

    /**
     * Option's price direction.
     */
    public direction: BinaryOptionsDirection

    /**
     * Option's expiration time.
     */
    public expiredAt: Date

    /**
     * Option's amount of the initial investment.
     */
    public price: number

    /**
     * Option's profit income percent.
     */
    public profitIncomePercent: number

    /**
     * The time when the option was purchased.
     */
    public openedAt: Date

    /**
     * The {@link CurrentQuote.value value} of the quote at which the option was purchased.
     */
    public openQuoteValue: number

    /**
     * Create instance from DTO.
     * @param msg - Option's data transfer object.
     * @internal
     * @private
     */
    public constructor(msg: BinaryOptionsOptionV1) {
        this.id = msg.id
        this.activeId = msg.activeId
        this.direction = <BinaryOptionsDirection>msg.direction
        this.expiredAt = new Date(msg.expired * 1000)
        this.price = msg.price
        this.profitIncomePercent = msg.profitIncome
        this.openedAt = new Date(msg.timeRate * 1000)
        this.openQuoteValue = msg.value
    }
}

/**
 * Don't use this class directly from your code. Use {@link QuadcodeClientSdk.digitalOptions} static method instead.
 *
 * Digital options facade class.
 */
export class DigitalOptions {
    /**
     * Instance of WebSocket API client.
     * @private
     */
    private readonly wsApiClient: WsApiClient

    /**
     * Underlyings current state.
     * @private
     */
    private underlyings: Map<number, DigitalOptionsUnderlying> = new Map<number, DigitalOptionsUnderlying>()

    /**
     * Creates instance from DTO.
     * @param underlyingList - Underlyings data transfer object.
     * @param wsApiClient - Instance of WebSocket API client.
     * @internal
     * @private
     */
    private constructor(underlyingList: DigitalOptionInstrumentsUnderlyingListV1, wsApiClient: WsApiClient) {
        this.wsApiClient = wsApiClient

        for (const index in underlyingList.underlying) {
            const underlying = underlyingList.underlying[index]
            this.underlyings.set(underlying.activeId, new DigitalOptionsUnderlying(underlying, wsApiClient))
        }
    }

    /**
     * Subscribes on underlyings updates, requests current state of underlyings, puts the state into this class instance and returns it.
     * @param wsApiClient - Instance of WebSocket API client.
     */
    public static async create(wsApiClient: WsApiClient): Promise<DigitalOptions> {
        const request = new SubscribeDigitalOptionInstrumentsUnderlyingListChangedV1()
        await wsApiClient.subscribe<DigitalOptionInstrumentsUnderlyingListChangedV1>(request, (event) => {
            if (event.type !== 'digital-option') {
                return
            }
            digitalOptionsFacade.updateUnderlyings(event)
        })
        const underlyingList = await wsApiClient.doRequest<DigitalOptionInstrumentsUnderlyingListV1>(new CallDigitalOptionInstrumentsGetUnderlyingListV1(true))
        const digitalOptionsFacade = new DigitalOptions(underlyingList, wsApiClient)
        return digitalOptionsFacade
    }

    /**
     * Returns list of underlyings available for buy at specified time.
     * @param at - Time for which the check is performed.
     */
    public getUnderlyingsAvailableForTradingAt(at: Date): DigitalOptionsUnderlying[] {
        const list = []
        for (const [activeId] of this.underlyings) {
            if (this.underlyings.get(activeId)!.isAvailableForTradingAt(at)) {
                list.push(this.underlyings.get(activeId)!)
            }
        }
        return list
    }

    /**
     * Makes request for buy digital option.
     * @param instrument - The instrument for which the option is purchased.
     * @param strikePrice - The strike price by which the option is purchased. Can be digit number or string 'SPT'. SPT is a spot strike that is always equal to the {@link CurrentQuote.value value} of the current underlying quote.
     * @param direction - Direction of price change.
     * @param amount - The amount of the initial investment.
     * @param balance - The balance from which the initial investment will be written off and upon successful closing of the position, profit will be credited to this balance.
     */
    public async buy(
        instrument: DigitalOptionsUnderlyingInstrument,
        strikePrice: string,
        direction: DigitalOptionsDirection,
        amount: number,
        balance: Balance,
    ): Promise<DigitalOptionsOrder> {
        const strike = instrument.getStrikeByPriceAndDirection(strikePrice, direction)
        const request = new CallDigitalOptionsPlaceDigitalOptionV2(
            instrument.assetId,
            strike.symbol,
            instrument.index,
            amount,
            balance.id
        )
        const response = await this.wsApiClient.doRequest<DigitalOptionPlacedV2>(request)
        return new DigitalOptionsOrder(response)
    }

    /**
     * Shortcut for buy option on spot strike.
     * @param instrument - The instrument for which the option is purchased.
     * @param direction - Direction of price change.
     * @param amount - The amount of the initial investment.
     * @param balance - The balance from which the initial investment will be written off and upon successful closing of the position, profit will be credited to this balance.     */
    public buySpotStrike(
        instrument: DigitalOptionsUnderlyingInstrument,
        direction: DigitalOptionsDirection,
        amount: number,
        balance: Balance,
    ): Promise<DigitalOptionsOrder> {
        return this.buy(instrument, 'SPT', direction, amount, balance)
    }

    /**
     * Returns digital options positions facade class for specified balance.
     * @param balance - User's balance for which the positions are being requested.
     */
    public positionsByBalance(balance: Balance): Promise<Positions> {
        return Positions.create(this.wsApiClient, 'digital-option', balance)
    }

    /**
     * Updates instance from DTO.
     * @param msg - Underlyings data transfer object.
     * @private
     */
    private updateUnderlyings(msg: DigitalOptionInstrumentsUnderlyingListChangedV1): void {
        const ids = []
        for (const index in msg.underlying) {
            const underlying = msg.underlying[index]
            ids.push(underlying.activeId)
            if (this.underlyings.has(underlying.activeId)) {
                this.underlyings.get(underlying.activeId)!.update(underlying)
            } else {
                this.underlyings.set(underlying.activeId, new DigitalOptionsUnderlying(underlying, this.wsApiClient))
            }
        }
    }
}

/**
 * Digital options direction of price change.
 */
export enum DigitalOptionsDirection {
    /**
     * The decision is that the price will go up.
     */
    Call = 'call',

    /**
     * The decision is that the price will go down.
     */
    Put = 'put',
}

/**
 * Digital options underlying refreshable class.
 */
export class DigitalOptionsUnderlying {
    /**
     * Underlying active ID.
     */
    public activeId: number

    /**
     * Is trading suspended on the underlying.
     */
    public isSuspended: boolean

    /**
     * Underlying name (ticker/symbol).
     */
    public name: string

    /**
     * Underlying trading schedule.
     */
    public schedule: DigitalOptionsUnderlyingTradingSession[]

    /**
     * Instruments facade class instance.
     * @private
     */
    private instrumentsFacade: DigitalOptionsUnderlyingInstruments | undefined

    /**
     * Instance of WebSocket API client.
     * @private
     */
    private readonly wsApiClient: WsApiClient

    /**
     * Creates instance from DTO.
     * @param msg - Underlying data transfer object.
     * @param wsApiClient - Instance of WebSocket API client.
     * @internal
     * @private
     */
    public constructor(msg: DigitalOptionInstrumentsUnderlyingListV1Underlying, wsApiClient: WsApiClient) {
        this.activeId = msg.activeId
        this.isSuspended = msg.isSuspended
        this.name = msg.name
        this.wsApiClient = wsApiClient

        this.schedule = []
        for (const index in msg.schedule) {
            const session = msg.schedule[index];
            this.schedule.push(new DigitalOptionsUnderlyingTradingSession(session.open, session.close))
        }
    }

    /**
     * Checks availability for trading at specified time.
     * @param at - Time for which the check is performed.
     */
    public isAvailableForTradingAt(at: Date): boolean {
        if (this.isSuspended) {
            return false
        }

        const atUnixTimeMilli = at.getTime()
        return this.schedule.findIndex((session: DigitalOptionsUnderlyingTradingSession): boolean => {
            return session.open.getTime() <= atUnixTimeMilli && session.close.getTime() >= atUnixTimeMilli
        }) >= 0
    }

    /**
     * Returns digital options active's instruments facade.
     */
    public async instruments(): Promise<DigitalOptionsUnderlyingInstruments> {
        if (!this.instrumentsFacade) {
            this.instrumentsFacade = await DigitalOptionsUnderlyingInstruments.create(this.activeId, this.wsApiClient)
        }

        return this.instrumentsFacade
    }

    /**
     * Updates the instance from DTO.
     * @param msg - Underlying data transfer object.
     * @private
     */
    update(msg: DigitalOptionInstrumentsUnderlyingListChangedV1Underlying): void {
        this.isSuspended = msg.isSuspended
        this.name = msg.name

        this.schedule = []
        for (const index in msg.schedule) {
            const session = msg.schedule[index];
            this.schedule.push(new DigitalOptionsUnderlyingTradingSession(session.open, session.close))
        }
    }
}

/**
 * Digital options active trading session class.
 */
export class DigitalOptionsUnderlyingTradingSession {
    /**
     * Start time of trading session.
     */
    public open: Date

    /**
     * End time of trading session.
     */
    public close: Date

    /**
     * Initialises class instance from DTO.
     * @param openTs - Unix time of session start.
     * @param closeTs - Unix time of session end.
     * @internal
     * @private
     */
    public constructor(openTs: number, closeTs: number) {
        this.open = new Date(openTs * 1000)
        this.close = new Date(closeTs * 1000)
    }
}

/**
 * Digital options underlying instruments facade class.
 */
export class DigitalOptionsUnderlyingInstruments {
    /**
     * Instruments current state.
     * @private
     */
    private instruments: Map<number, DigitalOptionsUnderlyingInstrument> = new Map<number, DigitalOptionsUnderlyingInstrument>()

    /**
     * Just private constructor. Use {@link DigitalOptionsUnderlyingInstruments.create create} instead.
     * @internal
     * @private
     */
    private constructor() {
    }

    /**
     * Subscribes on underlying instruments updates, requests current state of underlying instruments, puts the state into this class instance and returns it.
     * @param assetId
     * @param wsApiClient
     */
    public static async create(assetId: number, wsApiClient: WsApiClient): Promise<DigitalOptionsUnderlyingInstruments> {
        const instrumentsFacade = new DigitalOptionsUnderlyingInstruments()

        await wsApiClient.subscribe<DigitalOptionInstrumentsInstrumentGeneratedV1>(new SubscribeDigitalOptionInstrumentsInstrumentGeneratedV1('digital-option', assetId), (event) => {
            if (event.instrumentType !== 'digital-option' || event.assetId !== assetId) {
                return
            }
            instrumentsFacade.syncInstrumentFromEvent(event)
        })

        const instruments = await wsApiClient.doRequest<DigitalOptionInstrumentsInstrumentsV1>(new CallDigitalOptionInstrumentsGetInstrumentsV1('digital-option', assetId))
        instrumentsFacade.syncInstrumentsFromResponse(instruments)

        return instrumentsFacade
    }

    /**
     * Returns list of instruments available for buy at specified time.
     * @param at - Time for which the check is performed.
     */
    public getAvailableForBuyAt(at: Date): DigitalOptionsUnderlyingInstrument[] {
        const list = []
        for (const [index] of this.instruments) {
            if (this.instruments.get(index)!.isAvailableForBuyAt(at)) {
                list.push(this.instruments.get(index)!)
            }
        }
        return list
    }

    /**
     * Updates the instance from DTO.
     * @param msg - Instrument data transfer object.
     * @private
     */
    private syncInstrumentFromEvent(msg: DigitalOptionInstrumentsInstrumentGeneratedV1) {
        if (!this.instruments.has(msg.index)) {
            this.instruments.set(msg.index, new DigitalOptionsUnderlyingInstrument(msg))
        } else {
            this.instruments.get(msg.index)!.sync(msg)
        }
    }

    /**
     * Updates the instance from DTO.
     * @param msg - Instruments data transfer object.
     * @private
     */
    private syncInstrumentsFromResponse(msg: DigitalOptionInstrumentsInstrumentsV1) {
        const indexes = []
        for (const index in msg.instruments) {
            const instrument = msg.instruments[index]
            indexes.push(instrument.index)
            this.syncInstrumentFromResponse(instrument)
        }

        for (const [index] of this.instruments) {
            if (!indexes.includes(this.instruments.get(index)!.index)) {
                this.instruments.delete(index)
            }
        }
    }

    /**
     * Updates the instance from DTO.
     * @param msg - Instrument data transfer object.
     * @private
     */
    private syncInstrumentFromResponse(msg: DigitalOptionInstrumentsInstrumentsV1Instrument) {
        if (!this.instruments.has(msg.index)) {
            this.instruments.set(msg.index, new DigitalOptionsUnderlyingInstrument(msg))
        } else {
            this.instruments.get(msg.index)!.sync(msg)
        }
    }
}

/**
 * Digital options underlying instrument refreshable class.
 */
export class DigitalOptionsUnderlyingInstrument {
    /**
     * Instrument's active ID.
     */
    public assetId: number

    /**
     * Instrument's deadtime. How many seconds before expiration time the ability to purchase options for this instrument will not be allowed.
     */
    public deadtime: number

    /**
     * Instrument's expiration time.
     */
    public expiration: Date

    /**
     * Instrument's ID.
     */
    public index: number

    /**
     * Instrument's type.
     */
    public instrumentType: string

    /**
     * Instrument's period (expiration size).
     */
    public period: number

    /**
     * Instrument's strikes.
     */
    public strikes: DigitalOptionsUnderlyingInstrumentStrike[] = []

    /**
     * Creates instance from DTO.
     * @param msg - Instrument data transfer object.
     * @internal
     * @private
     */
    public constructor(msg: {
        /**
         * Instrument's asset (active) ID.
         */
        assetId: number

        /**
         * Instrument's deadtime.
         */
        deadtime: number,

        /**
         * Instrument's expiration UNIX time.
         */
        expiration: number,

        /**
         * Instrument's ID.
         */
        index: number,

        /**
         * Instrument's type.
         */
        instrumentType: string,

        /**
         * Instrument's period (expiration size).
         */
        period: number,

        /**
         * Instrument's strikes.
         */
        data: {
            /**
             * Strike's direction of price change.
             */
            direction: string,

            /**
             * Strike's price.
             */
            strike: string,

            /**
             * Strike's symbol.
             */
            symbol: string,
        }[],
    }) {
        this.assetId = msg.assetId
        this.deadtime = msg.deadtime
        this.expiration = new Date(msg.expiration * 1000)
        this.index = msg.index
        this.instrumentType = msg.instrumentType
        this.period = msg.period
        for (const index in msg.data) {
            this.strikes.push(new DigitalOptionsUnderlyingInstrumentStrike(msg.data[index]))
        }
    }

    /**
     * Checks availability for buy option at specified time.
     * @param at - Time for which the check is performed.
     */
    public isAvailableForBuyAt(at: Date): boolean {
        return this.purchaseEndTime().getTime() > at.getTime()
    }

    /**
     * Gets strike with specified price and direction.
     * @param price - Desired strike price.
     * @param direction - Desired strike direction of price change.
     */
    public getStrikeByPriceAndDirection(
        price: string,
        direction: DigitalOptionsDirection,
    ): DigitalOptionsUnderlyingInstrumentStrike {
        for (const index in this.strikes) {
            const strike = this.strikes[index]
            if (strike.price === price && strike.direction === direction) {
                return strike
            }
        }

        throw new Error(`Strike with price '${price}' and direction '${direction}' is not found`)
    }

    /**
     * Returns the time until which it is possible to open trades that will fall into the current expiration.
     * @returns {Date}
     */
    public purchaseEndTime(): Date {
        const purchaseEndTime = new Date(this.expiration);
        purchaseEndTime.setTime(purchaseEndTime.getTime() - this.deadtime * 1000);

        return purchaseEndTime;
    }

    /**
     * Returns the remaining duration in milliseconds for which it is possible to purchase options.
     * @param {Date} currentTime - The current time.
     * @returns {number} - The remaining duration in milliseconds.
     */
    public durationRemainingForPurchase(currentTime: Date): number {
        const purchaseEndTime = this.purchaseEndTime();

        return purchaseEndTime.getTime() - currentTime.getTime();
    }

    /**
     * Updates the instance from DTO.
     * @param msg - Instrument data transfer object.
     */
    sync(msg: DigitalOptionInstrumentsInstrumentGeneratedV1): void {
        this.assetId = msg.assetId
        this.deadtime = msg.deadtime
        this.expiration = new Date(msg.expiration * 1000)
        this.instrumentType = msg.instrumentType
        this.period = msg.period
        this.strikes = []
        for (const index in msg.data) {
            this.strikes.push(new DigitalOptionsUnderlyingInstrumentStrike(msg.data[index]))
        }
    }
}

/**
 * Digital options underlying instrument strike class.
 */
export class DigitalOptionsUnderlyingInstrumentStrike {
    /**
     * Direction of price change.
     */
    public direction: DigitalOptionsDirection

    /**
     * Strike's price. Can be digit number or string 'SPT'. SPT is a spot strike that is always equal to the {@link CurrentQuote.value value} of the current underlying quote.
     */
    public price: string

    /**
     * Strike's symbol.
     */
    public symbol: string

    /**
     * Creates instance from DTO.
     * @param msg - Strike data transfer object.
     * @internal
     * @private
     */
    public constructor(msg: {
        /**
         * Direction of price change.
         */
        direction: string,

        /**
         * Strike price.
         */
        strike: string,

        /**
         * Strike symbol.
         */
        symbol: string,
    }) {
        this.direction = <DigitalOptionsDirection>msg.direction
        this.price = msg.strike
        this.symbol = msg.symbol
    }
}

/**
 * Digital options order (option) class.
 */
export class DigitalOptionsOrder {
    /**
     * Order's ID.
     */
    public id: number

    /**
     * Creates instance from DTO.
     * @param msg - Order data transfer object.
     * @internal
     * @private
     */
    public constructor(msg: DigitalOptionPlacedV2) {
        this.id = msg.id
    }
}

// Common classes

/**
 * Observable class.
 * @ignore
 * @internal
 */
class Observable<T> {
    observers: ((data: T) => void)[] = []

    subscribe(func: (data: T) => void) {
        this.observers.push(func)
    }

    unsubscribe(func: (data: T) => void) {
        this.observers = this.observers.filter((observer) => observer !== func)
    }

    notify(data: T) {
        this.observers.forEach((observer) => observer(data))
    }
}

/**
 * HttpApiClient class.
 * @ignore
 * @internal
 */
class HttpApiClient {
    private readonly apiUrl: string

    constructor(apiUrl: string) {
        this.apiUrl = apiUrl
    }

    doRequest<T>(request: HttpRequest<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const options = {
                method: request.method(),
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'quadcode-client-sdk-js/0.1.3'
                },
                body: JSON.stringify(request.messageBody())
            }

            fetch(`${this.apiUrl}${request.path()}`, options)
                .then(async (response) => {
                    if (!response.ok) {
                        reject(new Error(`HTTP error: ${response.status}`))
                    }

                    const data = await response.json()
                    resolve(request.createResponse(response.status, data))
                })
                .catch((error) => {
                    reject(error)
                })
        })
    }
}

// WS API client

/**
 * WebSocket API client class.
 * @ignore
 * @internal
 */
class WsApiClient {
    public readonly currentTime: WsApiClientCurrentTime

    private readonly apiUrl: string
    private readonly platformId: number
    private readonly authMethod: AuthMethod

    private readonly initialReconnectTimeout: number = 100
    private readonly reconnectMultiplier: number = 2
    private readonly maxReconnectTimeout: number = 10000
    private reconnectTimeout: number = 100

    private disconnecting = false
    private connection: WebSocket
    private lastRequestId: number = 0
    private requests: Map<string, RequestMetaData> = new Map<string, RequestMetaData>()
    private subscriptions: Map<string, SubscriptionMetaData[]> = new Map<string, SubscriptionMetaData[]>()

    constructor(apiUrl: string, platformId: number, authMethod: AuthMethod) {
        this.currentTime = new WsApiClientCurrentTime(new Date().getTime())
        this.apiUrl = apiUrl
        this.platformId = platformId
        this.authMethod = authMethod
    }

    connect(): Promise<void> {
        this.connection = new WebSocket(this.apiUrl, {
            headers: {
                'cookie': `platform=${this.platformId}`,
                'user-agent': 'quadcode-client-sdk-js/0.1.3'
            }
        })

        this.connection.on('message', (data: string) => {
            const frame: {
                request_id: string
                name: string
                msg: any
                microserviceName: string
            } = JSON.parse(data)
            if (frame.request_id) {
                if (this.requests.has(frame.request_id)) {
                    const requestMetaData = this.requests.get(frame.request_id)!
                    if (frame.name === 'result' && !requestMetaData.request.resultOnly()) {
                        const result = new Result(frame.msg)
                        if (!result.success) {
                            requestMetaData.reject(`request result is not successful`)
                        }
                        return
                    }
                    try {
                        const response = requestMetaData.request.createResponse(frame.msg)
                        requestMetaData.resolve(response)
                    } catch (e) {
                        requestMetaData.reject(e)
                    } finally {
                        this.requests.delete(frame.request_id)
                    }
                }
            } else if (frame.microserviceName && frame.name) {
                const subscriptionKey = `${frame.microserviceName},${frame.name}`
                if (this.subscriptions.has(subscriptionKey)) {
                    const subscriptions = this.subscriptions.get(subscriptionKey)!
                    for (const index in subscriptions) {
                        const subscriptionMetaData = subscriptions[index]
                        subscriptionMetaData.callback(subscriptionMetaData.request.createEvent(frame.msg))
                    }
                }
            } else if (frame.name && frame.name === 'timeSync') {
                this.currentTime.unixMilliTime = frame.msg
            }
        })

        return new Promise((resolve, reject) => {
            this.connection.on('open', async () => {
                try {
                    const isSuccessful = await this.authMethod.authenticateWsApiClient(this)
                    if (!isSuccessful) {
                        this.connection.terminate()
                        reject(new Error('authentication is failed'))
                    }

                    const setOptionsResponse = await this.doRequest<Result>(new SetOptions(true))
                    if (!setOptionsResponse.success) {
                        this.connection.terminate()
                        reject(new Error('setOptions operation is failed'))
                    }

                    resolve()
                } catch (e) {
                    this.connection.terminate()
                    reject(e)
                }
            })

            this.connection.on('close', () => {
                this.reconnect()
            })

            this.connection.on('error', () => {
                this.reconnect()
            })
        })
    }

    disconnect() {
        this.disconnecting = true
        this.connection.terminate()
        this.connection = undefined
        this.lastRequestId = 0
        this.requests.clear()
        this.subscriptions.clear()
    }

    reconnect() {
        if (this.disconnecting) {
            return
        }

        if (this.connection) {
            this.connection.terminate()
            this.connection = undefined
        }

        const attemptReconnect = () => {
            this.connect().then(() => {
                this.resubscribeAll().then(() => {
                    this.reconnectTimeout = this.initialReconnectTimeout;
                })
            }).catch(() => {
                this.reconnectTimeout = Math.min(this.reconnectTimeout * this.reconnectMultiplier, this.maxReconnectTimeout) + this.getJitter();
                setTimeout(attemptReconnect, this.reconnectTimeout);
            });
        };

        attemptReconnect();
    }

    getJitter() {
        return Math.floor(Math.random() * 1000);
    }

    doRequest<T>(request: Request<T>): Promise<T> {
        const requestId = (++this.lastRequestId).toString()

        this.connection.send(JSON.stringify({
            name: request.messageName(),
            request_id: requestId,
            msg: request.messageBody()
        }))

        return new Promise<T>((resolve, reject) => {
            this.requests.set(requestId, new RequestMetaData(request, resolve, reject))
        })
    }

    resubscribeAll(): Promise<Result[]> {
        return new Promise((resolve, reject) => {
            const promises: Promise<Result>[] = [];
            if (this.subscriptions.size > 0) {
                for (const [, value] of this.subscriptions) {
                    for (const index in value) {
                        const subscriptionMetaData = value[index]
                        promises.push(this.doRequest<Result>(new SubscribeMessage(subscriptionMetaData.request.messageBody())))
                    }
                }
            }

            Promise.all(promises).then(resolve).catch(reject)
        })
    }

    subscribe<T>(request: SubscribeRequest<T>, callback: (event: T) => void) {
        return new Promise((resolve, reject) => {
            const subscriptionKey = `${request.eventMicroserviceName()},${request.eventName()}`
            if (!this.subscriptions.has(subscriptionKey)) {
                this.subscriptions.set(subscriptionKey, [])
            }
            this.subscriptions.get(subscriptionKey)!.push(new SubscriptionMetaData(request, callback))

            this.doRequest<Result>(new SubscribeMessage(request.messageBody())).then(resolve).catch(reject)
        })
    }
}

class WsApiClientCurrentTime {
    constructor(public unixMilliTime: number) {
    }
}

class RequestMetaData {
    constructor(public readonly request: Request<any>, public readonly resolve: any, public readonly reject: any) {
    }
}

class SubscriptionMetaData {
    constructor(public readonly request: SubscribeRequest<any>, public readonly callback: (event: any) => void) {
    }
}

interface Request<ResponseType> {
    messageName(): string

    messageBody(): any

    resultOnly(): boolean

    createResponse(data: any): ResponseType
}

interface HttpRequest<ResponseType> {
    method(): string

    path(): string

    messageBody(): any

    createResponse(status: number, data: any): ResponseType
}

interface SubscribeRequest<EventType> {
    messageName(): string

    messageBody(): any

    eventMicroserviceName(): string

    eventName(): string

    createEvent(data: any): EventType
}

// DTO classes

// Inbound messages

class Authenticated {
    isSuccessful: boolean

    constructor(isSuccessful: boolean) {
        this.isSuccessful = isSuccessful
    }
}

class HttpResponse<ResponseDataType> {
    status: number
    data: ResponseDataType

    constructor(status: number, data: ResponseDataType) {
        this.status = status
        this.data = data
    }
}

class HttpLoginResponse {
    code: string
    ssid: string

    constructor(data: { code: string, ssid: string }) {
        this.code = data.code
        this.ssid = data.ssid
    }
}

class Result {
    success: boolean

    constructor(data: { success: boolean }) {
        this.success = data.success
    }
}

class BinaryOptionsOptionV1 {
    id: number
    activeId: number
    direction: string
    expired: number
    price: number
    profitIncome: number
    timeRate: number
    type: string
    value: number

    constructor(data: {
        id: number
        act: number
        direction: string
        exp: number
        price: number
        profit_income: number
        time_rate: number
        type: string
        value: number
    }) {
        this.id = data.id
        this.activeId = data.act
        this.direction = data.direction
        this.expired = data.exp
        this.price = data.price
        this.profitIncome = data.profit_income
        this.timeRate = data.time_rate
        this.type = data.type
        this.value = data.value
    }
}

class CoreProfileV1 {
    userId: number

    constructor(data: {
        result: {
            user_id: number
        }
    }) {
        this.userId = data.result.user_id
    }
}

class DigitalOptionInstrumentsInstrumentGeneratedV1 {
    assetId: number
    data: DigitalOptionInstrumentsInstrumentGeneratedV1DataItem[] = []
    deadtime: number
    expiration: number
    index: number
    instrumentType: string
    period: number

    constructor(msg: any) {
        this.assetId = msg.asset_id
        for (const index in msg.data) {
            this.data.push(new DigitalOptionInstrumentsInstrumentGeneratedV1DataItem(msg.data[index]))
        }
        this.deadtime = msg.deadtime
        this.expiration = msg.expiration
        this.index = msg.index
        this.instrumentType = msg.instrument_type
        this.period = msg.period
    }
}

class DigitalOptionInstrumentsInstrumentGeneratedV1DataItem {
    direction: string
    strike: string
    symbol: string

    constructor(msg: any) {
        this.direction = msg.direction
        this.strike = msg.strike
        this.symbol = msg.symbol
    }
}

class DigitalOptionInstrumentsInstrumentsV1 {
    type: string
    instruments: DigitalOptionInstrumentsInstrumentsV1Instrument[] = []

    constructor(data: any) {
        this.type = data.type
        for (const index in data.instruments) {
            const instrument = data.instruments[index]
            this.instruments.push(new DigitalOptionInstrumentsInstrumentsV1Instrument(instrument))
        }
    }
}

class DigitalOptionInstrumentsInstrumentsV1Instrument {
    assetId: number
    data: DigitalOptionInstrumentsInstrumentsV1InstrumentDataItem[] = []
    deadtime: number
    expiration: number
    index: number
    instrumentType: string
    period: number

    constructor(msg: any) {
        this.assetId = msg.asset_id
        for (const index in msg.data) {
            this.data.push(new DigitalOptionInstrumentsInstrumentsV1InstrumentDataItem(msg.data[index]))
        }
        this.deadtime = msg.deadtime
        this.expiration = msg.expiration
        this.index = msg.index
        this.instrumentType = msg.instrument_type
        this.period = msg.period
    }
}

class DigitalOptionInstrumentsInstrumentsV1InstrumentDataItem {
    direction: string
    strike: string
    symbol: string

    constructor(msg: any) {
        this.direction = msg.direction
        this.strike = msg.strike
        this.symbol = msg.symbol
    }
}

class DigitalOptionInstrumentsUnderlyingListChangedV1 {
    type: string
    underlying: DigitalOptionInstrumentsUnderlyingListChangedV1Underlying[] = []

    constructor(data: {
        type: string
        underlying: {
            active_id: number
            is_suspended: boolean
            name: string
            schedule: {
                open: number,
                close: number,
            }[]
        }[]
    }) {
        this.type = data.type
        for (const index in data.underlying) {
            const underlying = data.underlying[index]
            this.underlying.push(new DigitalOptionInstrumentsUnderlyingListChangedV1Underlying(
                underlying.active_id,
                underlying.is_suspended,
                underlying.name,
                underlying.schedule,
            ))
        }
    }
}

class DigitalOptionInstrumentsUnderlyingListChangedV1Underlying {
    constructor(
        public activeId: number,
        public isSuspended: boolean,
        public name: string,
        public schedule: {
            open: number,
            close: number,
        }[],
    ) {
    }
}

class DigitalOptionInstrumentsUnderlyingListV1 {
    type: string
    underlying: DigitalOptionInstrumentsUnderlyingListV1Underlying[] = []

    constructor(data: {
        type: string
        underlying: {
            active_id: number
            is_suspended: boolean
            name: string
            schedule: {
                open: number,
                close: number,
            }[]
        }[]
    }) {
        this.type = data.type
        for (const index in data.underlying) {
            const underlying = data.underlying[index]
            this.underlying.push(new DigitalOptionInstrumentsUnderlyingListV1Underlying(
                underlying.active_id,
                underlying.is_suspended,
                underlying.name,
                underlying.schedule,
            ))
        }
    }
}

class DigitalOptionInstrumentsUnderlyingListV1Underlying {
    constructor(
        public activeId: number,
        public isSuspended: boolean,
        public name: string,
        public schedule: {
            open: number,
            close: number,
        }[],
    ) {
    }
}

class DigitalOptionPlacedV2 {
    id: number

    constructor(data: any) {
        this.id = data.id
    }
}

class InitializationDataV3 {
    binaryActives: InitializationDataV3BinaryActive[] = []
    blitzActives: InitializationDataV3BlitzActive[] = []
    turboActives: InitializationDataV3TurboActive[] = []

    constructor(msg: {
        binary: {
            actives: any
        }
        blitz: {
            actives: any
        }
        turbo: {
            actives: any
        }
    }) {
        for (const index in msg.binary.actives) {
            this.binaryActives.push(new InitializationDataV3BinaryActive(msg.binary.actives[index]))
        }
        for (const index in msg.blitz.actives) {
            this.blitzActives.push(new InitializationDataV3BlitzActive(msg.blitz.actives[index]))
        }
        for (const index in msg.turbo.actives) {
            this.turboActives.push(new InitializationDataV3TurboActive(msg.turbo.actives[index]))
        }
    }
}

class InitializationDataV3BlitzActive {
    id: number
    ticker: string
    isSuspended: boolean
    expirationTimes: number[]
    profitCommission: number
    schedule: number[][] = []

    constructor(data: {
        id: number
        ticker: string
        is_suspended: boolean
        option: {
            expiration_times: number[]
            profit: {
                commission: number
            }
        }
        schedule: number[][]
    }) {
        this.id = data.id
        this.ticker = data.ticker
        this.isSuspended = data.is_suspended
        this.expirationTimes = data.option.expiration_times
        this.profitCommission = data.option.profit.commission
        this.schedule = data.schedule
    }
}

class InitializationDataV3TurboActive {
    id: number
    buybackDeadtime: number
    deadtime: number
    ticker: string
    isBuyback: boolean
    isSuspended: boolean
    optionCount: number
    expirationTimes: number[]
    profitCommission: number
    schedule: number[][] = []

    constructor(data: {
        id: number
        buyback_deadtime: number
        deadtime: number
        ticker: string
        is_buyback: boolean
        is_suspended: boolean
        option: {
            count: number
            expiration_times: number[]
            profit: {
                commission: number
            }
        }
        schedule: number[][]
    }) {
        this.id = data.id
        this.buybackDeadtime = data.buyback_deadtime
        this.deadtime = data.deadtime
        this.ticker = data.ticker
        this.schedule = data.schedule
        this.isBuyback = data.is_buyback
        this.isSuspended = data.is_suspended
        this.optionCount = data.option.count
        this.expirationTimes = data.option.expiration_times
        this.profitCommission = data.option.profit.commission
    }
}

class InitializationDataV3BinaryActive {
    id: number
    buybackDeadtime: number
    deadtime: number
    ticker: string
    isBuyback: boolean
    isSuspended: boolean
    optionCount: number
    optionSpecial: InitializationDataV3BinaryActiveSpecialInstrument[] = []
    expirationTimes: number[]
    profitCommission: number
    schedule: number[][] = []

    constructor(data: {
        id: number
        buyback_deadtime: number
        deadtime: number
        ticker: string
        is_buyback: boolean
        is_suspended: boolean
        option: {
            count: number
            expiration_times: number[]
            profit: {
                commission: number
            }
            special: any
        }
        schedule: number[][]
    }) {
        this.id = data.id
        this.buybackDeadtime = data.buyback_deadtime
        this.deadtime = data.deadtime
        this.ticker = data.ticker
        this.isBuyback = data.is_buyback
        this.isSuspended = data.is_suspended
        this.optionCount = data.option.count
        this.expirationTimes = data.option.expiration_times
        this.profitCommission = data.option.profit.commission
        this.schedule = data.schedule

        for (const expiredAt in data.option.special) {
            this.optionSpecial.push(new InitializationDataV3BinaryActiveSpecialInstrument(parseInt(expiredAt), data.option.special[expiredAt]))
        }
    }
}

class InitializationDataV3BinaryActiveSpecialInstrument {
    title: string
    enabled: boolean
    expiredAt: number

    constructor(expiredAt: number, msg: any) {
        this.title = msg.title
        this.enabled = msg.enabled
        this.expiredAt = expiredAt
    }
}

class InternalBillingBalanceChangedV1 {
    id: number
    type: number
    amount: number
    currency: string
    userId: number

    constructor(data: {
        current_balance: {
            id: number
            type: number
            amount: number
            currency: string
        },
        user_id: number
    }) {
        this.id = data.current_balance.id
        this.type = data.current_balance.type
        this.amount = data.current_balance.amount
        this.currency = data.current_balance.currency
        this.userId = data.user_id
    }
}

class InternalBillingBalancesV1 {
    items: InternalBillingBalanceV1[] = []

    constructor(balances: any) {
        for (const index in balances) {
            this.items.push(new InternalBillingBalanceV1(balances[index]))
        }
    }
}

class InternalBillingBalanceV1 {
    id: number
    type: number
    amount: number
    currency: string
    userId: number

    constructor(data: any) {
        this.id = data.id
        this.type = data.type
        this.amount = data.amount
        this.currency = data.currency
        this.userId = data.user_id
    }
}

class PortfolioPositionChangedV3 {
    activeId: number
    closeProfit: number | undefined
    closeQuote: number | undefined
    closeReason: string | undefined
    closeTime: number | undefined
    expectedProfit: number
    externalId: number
    instrumentType: string
    invest: number
    openQuote: number
    openTime: number
    pnl: number
    pnlRealized: number
    quoteTimestamp: number | undefined
    status: string
    userId: number
    userBalanceId: number
    version: number

    constructor(data: {
        active_id: number
        close_profit: number | undefined
        close_quote: number | undefined
        close_reason: string | undefined
        close_time: number | undefined
        expected_profit: number
        instrument_type: string
        external_id: number
        invest: number
        open_quote: number
        open_time: number
        pnl: number
        pnl_realized: number
        quote_timestamp: number | undefined
        status: string
        user_id: number
        user_balance_id: number
        version: number
    }) {
        this.activeId = data.active_id
        this.closeProfit = data.close_profit
        this.closeQuote = data.close_quote
        this.closeReason = data.close_reason
        this.closeTime = data.close_time
        this.expectedProfit = data.expected_profit
        this.instrumentType = data.instrument_type
        this.externalId = data.external_id
        this.invest = data.invest
        this.openQuote = data.open_quote
        this.openTime = data.open_time
        this.pnl = data.pnl
        this.pnlRealized = data.pnl_realized
        this.quoteTimestamp = data.quote_timestamp
        this.status = data.status
        this.userId = data.user_id
        this.userBalanceId = data.user_balance_id
        this.version = data.version
    }
}

class PortfolioPositionsV4 {
    limit: number
    positions: PortfolioPositionsV4Position[] = []
    total: number

    constructor(data: any) {
        this.limit = data.limit
        this.total = data.total

        for (const index in data.positions) {
            this.positions.push(new PortfolioPositionsV4Position(data.positions[index]))
        }
    }
}

class PortfolioPositionsV4Position {
    activeId: number
    expectedProfit: number
    externalId: number
    instrumentType: string
    invest: number
    openQuote: number
    openTime: number
    pnl: number
    quoteTimestamp: number | undefined
    status: string
    userId: number
    userBalanceId: number

    constructor(data: {
        active_id: number
        expected_profit: number
        external_id: number
        instrument_type: string
        invest: number
        open_quote: number
        open_time: number
        pnl: number
        quote_timestamp: number | undefined
        status: string
        user_id: number
        user_balance_id: number
    }) {
        this.activeId = data.active_id
        this.expectedProfit = data.expected_profit
        this.externalId = data.external_id
        this.instrumentType = data.instrument_type
        this.invest = data.invest
        this.openQuote = data.open_quote
        this.openTime = data.open_time
        this.pnl = data.pnl
        this.quoteTimestamp = data.quote_timestamp
        this.status = data.status
        this.userId = data.user_id
        this.userBalanceId = data.user_balance_id
    }
}

class QuoteGenerated {
    activeId: number
    time: number
    ask: number
    bid: number
    value: number
    phase: string

    constructor(data: any) {
        this.activeId = data.active_id
        this.time = data.time
        this.ask = data.ask
        this.bid = data.bid
        this.value = data.value
        this.phase = data.phase
    }
}

// Outbound messages

class HttpLoginRequest implements HttpRequest<HttpResponse<HttpLoginResponse>> {
    constructor(private readonly login: string, private readonly password: string) {
    }

    method(): string {
        return 'POST'
    }

    path() {
        return '/v2/login'
    }

    messageBody() {
        return {
            identifier: this.login,
            password: this.password
        }
    }

    createResponse(status: number, data: any): HttpResponse<HttpLoginResponse> {
        return new HttpResponse(status, new HttpLoginResponse(data))
    }
}

class Authenticate implements Request<Authenticated> {
    constructor(private readonly ssid: string) {
    }

    messageName() {
        return 'authenticate'
    }

    messageBody() {
        return {
            ssid: this.ssid,
            protocol: 3,
            session_id: '',
            client_session_id: ''
        }
    }

    resultOnly(): boolean {
        return false
    }

    createResponse(data: any): Authenticated {
        return new Authenticated(data)
    }
}

class CallBinaryOptionsOpenBinaryOptionV1 implements Request<BinaryOptionsOptionV1> {
    constructor(
        private activeId: number,
        private expiredAt: number,
        private direction: string,
        private price: number,
        private userBalanceId: number,
    ) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'binary-options.open-option',
            version: '1.0',
            body: {
                active_id: this.activeId,
                direction: this.direction,
                expired: this.expiredAt,
                option_type_id: 1,
                price: this.price,
                user_balance_id: this.userBalanceId
            }
        }
    }

    createResponse(data: any): BinaryOptionsOptionV1 {
        return new BinaryOptionsOptionV1(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class CallBinaryOptionsOpenBlitzOptionV1 implements Request<BinaryOptionsOptionV1> {

    constructor(
        private activeId: number,
        private direction: string,
        private expirationSize: number,
        private price: number,
        private userBalanceId: number
    ) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'binary-options.open-option',
            version: '1.0',
            body: {
                active_id: this.activeId,
                direction: this.direction,
                expiration_size: this.expirationSize,
                expired: 0,
                option_type_id: 12,
                price: this.price,
                user_balance_id: this.userBalanceId
            }
        }
    }

    createResponse(data: any): BinaryOptionsOptionV1 {
        return new BinaryOptionsOptionV1(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class CallBinaryOptionsOpenTurboOptionV1 implements Request<BinaryOptionsOptionV1> {
    constructor(
        private activeId: number,
        private expiredAt: number,
        private direction: string,
        private price: number,
        private userBalanceId: number
    ) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'binary-options.open-option',
            version: '1.0',
            body: {
                active_id: this.activeId,
                direction: this.direction,
                expired: this.expiredAt,
                option_type_id: 3,
                price: this.price,
                user_balance_id: this.userBalanceId
            }
        }
    }

    createResponse(data: any): BinaryOptionsOptionV1 {
        return new BinaryOptionsOptionV1(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class CallCoreGetProfileV1 implements Request<CoreProfileV1> {
    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'core.get-profile',
            version: '1.0',
            body: {}
        }
    }

    createResponse(data: any): CoreProfileV1 {
        return new CoreProfileV1(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class CallDigitalOptionInstrumentsGetInstrumentsV1 implements Request<DigitalOptionInstrumentsInstrumentsV1> {
    constructor(
        private instrumentType: string,
        private assetId: number,
    ) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'digital-option-instruments.get-instruments',
            version: '1.0',
            body: {
                instrument_type: this.instrumentType,
                asset_id: this.assetId
            }
        }
    }

    createResponse(data: any): DigitalOptionInstrumentsInstrumentsV1 {
        return new DigitalOptionInstrumentsInstrumentsV1(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class CallDigitalOptionInstrumentsGetUnderlyingListV1 implements Request<DigitalOptionInstrumentsUnderlyingListV1> {
    constructor(private filterSuspended: boolean) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'digital-option-instruments.get-underlying-list',
            version: '1.0',
            body: {
                filter_suspended: this.filterSuspended
            }
        }
    }

    createResponse(data: any): DigitalOptionInstrumentsUnderlyingListV1 {
        return new DigitalOptionInstrumentsUnderlyingListV1(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class CallDigitalOptionsPlaceDigitalOptionV2 implements Request<DigitalOptionPlacedV2> {
    constructor(
        private assetId: number,
        private instrumentId: string,
        private instrumentIndex: number,
        private amount: number,
        private userBalanceId: number,
    ) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'digital-options.place-digital-option',
            version: '2.0',
            body: {
                amount: this.amount.toString(),
                asset_id: this.assetId,
                instrument_id: this.instrumentId,
                instrument_index: this.instrumentIndex,
                user_balance_id: this.userBalanceId
            }
        }
    }

    createResponse(data: any): DigitalOptionPlacedV2 {
        return new DigitalOptionPlacedV2(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class CallGetInitializationDataV3 implements Request<InitializationDataV3> {
    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'get-initialization-data',
            version: '3.0',
            body: {}
        }
    }

    createResponse(data: any): InitializationDataV3 {
        return new InitializationDataV3(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class CallInternalBillingGetBalancesV1 implements Request<InternalBillingBalancesV1> {
    constructor(private readonly typesIds: number[]) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'internal-billing.get-balances',
            version: '1.0',
            body: {
                types_ids: this.typesIds
            }
        }
    }

    createResponse(data: any): InternalBillingBalancesV1 {
        return new InternalBillingBalancesV1(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class CallPortfolioGetPositionsV4 implements Request<PortfolioPositionsV4> {
    constructor(private readonly instrumentTypes: string[], private readonly userBalanceId: number, private readonly limit: number, private readonly offset: number) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'portfolio.get-positions',
            version: '4.0',
            body: {
                instrument_types: this.instrumentTypes,
                user_balance_id: this.userBalanceId,
                limit: this.limit,
                offset: this.offset
            }
        }
    }

    createResponse(data: any): PortfolioPositionsV4 {
        return new PortfolioPositionsV4(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class SetOptions implements Request<Result> {
    constructor(private readonly sendResults: boolean) {
    }

    messageName() {
        return 'setOptions'
    }

    messageBody() {
        return {
            sendResults: this.sendResults
        }
    }

    resultOnly(): boolean {
        return true
    }

    createResponse(data: any): Result {
        return new Result(data)
    }
}

class SubscribeDigitalOptionInstrumentsInstrumentGeneratedV1 implements SubscribeRequest<DigitalOptionInstrumentsInstrumentGeneratedV1> {
    constructor(
        private instrumentType: string,
        private assetId: number,
    ) {
    }

    messageName() {
        return 'subscribeMessage'
    }

    messageBody() {
        return {
            name: `${this.eventMicroserviceName()}.${this.eventName()}`,
            version: '1.0',
            params: {
                routingFilters: {
                    instrument_type: this.instrumentType,
                    asset_id: this.assetId
                }
            }
        }
    }

    eventMicroserviceName() {
        return 'digital-option-instruments'
    }

    eventName() {
        return 'instrument-generated'
    }

    createEvent(data: any): DigitalOptionInstrumentsInstrumentGeneratedV1 {
        return new DigitalOptionInstrumentsInstrumentGeneratedV1(data)
    }
}

class SubscribeDigitalOptionInstrumentsUnderlyingListChangedV1 implements SubscribeRequest<DigitalOptionInstrumentsUnderlyingListChangedV1> {
    messageName() {
        return 'subscribeMessage'
    }

    messageBody() {
        return {
            name: `${this.eventMicroserviceName()}.${this.eventName()}`,
            version: '1.0'
        }
    }

    eventMicroserviceName() {
        return 'digital-option-instruments'
    }

    eventName() {
        return 'underlying-list-changed'
    }

    createEvent(data: any): DigitalOptionInstrumentsUnderlyingListChangedV1 {
        return new DigitalOptionInstrumentsUnderlyingListChangedV1(data)
    }
}

class SubscribeMessage implements Request<Result> {
    constructor(private readonly body: any) {
    }

    messageName() {
        return 'subscribeMessage'
    }

    messageBody() {
        return this.body
    }

    resultOnly(): boolean {
        return true
    }

    createResponse(data: any): Result {
        return new Result(data)
    }
}

class SubscribeInternalBillingBalanceChangedV1 implements SubscribeRequest<InternalBillingBalanceChangedV1> {
    messageName() {
        return 'subscribeMessage'
    }

    messageBody() {
        return {
            name: `${this.eventMicroserviceName()}.${this.eventName()}`,
            version: '1.0'
        }
    }

    eventMicroserviceName() {
        return 'internal-billing'
    }

    eventName() {
        return 'balance-changed'
    }

    createEvent(data: any): InternalBillingBalanceChangedV1 {
        return new InternalBillingBalanceChangedV1(data)
    }
}

class SubscribePortfolioPositionChangedV3 implements SubscribeRequest<PortfolioPositionChangedV3> {
    constructor(private readonly userId: number, private readonly userBalanceId: number, private readonly instrumentType: string) {
    }

    messageName() {
        return 'subscribeMessage'
    }

    messageBody() {
        return {
            name: `${this.eventMicroserviceName()}.${this.eventName()}`,
            version: '3.0',
            params: {
                routingFilters: {
                    user_id: this.userId,
                    user_balance_id: this.userBalanceId,
                    instrument_type: this.instrumentType
                }
            }
        }
    }

    eventMicroserviceName() {
        return 'portfolio'
    }

    eventName() {
        return 'position-changed'
    }

    createEvent(data: any): PortfolioPositionChangedV3 {
        return new PortfolioPositionChangedV3(data)
    }
}

class SubscribeQuoteGenerated implements SubscribeRequest<QuoteGenerated> {
    activeId

    constructor(activeId: number) {
        this.activeId = activeId
    }

    messageName() {
        return 'subscribeMessage'
    }

    messageBody() {
        return {
            name: `${this.eventName()}`,
            params: {
                routingFilters: {
                    active_id: this.activeId
                }
            }
        }
    }

    eventMicroserviceName() {
        return 'quotes-ws'
    }

    eventName() {
        return 'quote-generated'
    }

    createEvent(data: any): QuoteGenerated {
        return new QuoteGenerated(data)
    }
}
