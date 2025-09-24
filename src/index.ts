import WebSocket from "isomorphic-ws"

/**
 * This is the entry point of this SDK for your application. Use it to implement the business logic of your application.
 */
export class ClientSdk {
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
     * Host extracted from WebSocket URL.
     * @private
     */
    private readonly host: string

    /**
     * WebSocket connection state facade.
     * @private
     */
    private wsConnectionStateFacade: WsConnectionState | undefined

    /**
     * Balances facade cache.
     * @private
     */
    private balancesFacade: Balances | undefined

    /**
     * Positions facade cache.
     * @private
     */
    private positionsFacade: Positions | undefined

    /**
     * Orders facade cache.
     * @private
     */
    private ordersFacade: Orders | undefined

    /**
     * Quotes facade cache.
     * @private
     */
    private quotesFacade: Quotes | undefined

    /**
     *  Actives facade cache.
     *  @private
     */
    private activesFacade: Actives | undefined

    /**
     * Currencies facade cache.
     * @private
     */
    private currenciesFacade: Currencies | undefined

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
     * Margin forex facade cache.
     * @private
     */
    private marginForexFacade: MarginForex | undefined

    /**
     * Margin cfd facade cache
     * @private
     */
    private marginCfdFacade: MarginCfd | undefined

    /**
     * Margin crypto facade cache
     * @private
     */
    private marginCryptoFacade: MarginCrypto | undefined

    /**
     * Candles facade cache
     * @private
     */
    private candlesFacade: Candles | undefined

    /**
     * Host for static resources.
     * @private
     */
    private readonly staticHost: string = 'https://static.cdnroute.io/files'

    /**
     * Instruments availability cache.
     * @private
     */
    private instrumentsIsAvailable: Map<string, boolean> = new Map<string, boolean>()

    /**
     * Translations facade cache.
     * @private
     */
    private translationsFacade: Translations | undefined

    /**
     * Real-time chart data layer facade cache.
     * @private
     */
    private realTimeChartDataLayerFacade: Record<number, Record<number, Promise<RealTimeChartDataLayer>>> | undefined

    /**
     * Consistency manager instance.
     * @private
     */
    private candlesConsistencyManagerFacade: CandlesConsistencyManager | undefined

    /**
     * Creates instance of class.
     * @param userProfile - Information about the user on whose behalf your application is working.
     * @param wsApiClient - Instance of WebSocket API client.
     * @param options
     * @internal
     * @private
     */
    private constructor(userProfile: UserProfile, wsApiClient: WsApiClient, options?: ClientSDKAdditionalOptions) {
        this.userProfile = userProfile
        this.wsApiClient = wsApiClient
        this.host = options?.host ? this.normalizeHost(options.host) : this.extractHostFromWsUrl(wsApiClient.apiUrl)
        this.staticHost = options?.staticHost || 'https://static.cdnroute.io/files'
    }

    /**
     * Extracts host from WebSocket URL.
     * @param wsUrl - WebSocket URL (e.g. wss://trade.broker.com/echo/websocket)
     * @returns Host without protocol and path (e.g. https://trade.broker.com)
     * @private
     */
    private extractHostFromWsUrl(wsUrl: string): string {
        const url = new URL(wsUrl)
        const host = url.host.replace(/^ws\./, '')
        return `https://${host}`
    }

    private normalizeHost(host: string): string {
        if (host.startsWith('http://') || host.startsWith('https://')) {
            return host;
        }

        return `https://${host}`;
    }

    /**
     * Creates instance of SDK entry point class.
     * This method establishes and authenticates connection to system API.
     * @param apiUrl - URL to system API. Usually it has the following format: `wss://ws.trade.{brand_domain}/echo/websocket`.
     * @param platformId - Identification number of your application.
     * @param authMethod - Authentication method used for connection authentication.
     * @param options
     */
    public static async create(apiUrl: string, platformId: number, authMethod: AuthMethod, options?: ClientSDKAdditionalOptions): Promise<ClientSdk> {
        const wsApiClient = new WsApiClient(apiUrl, platformId, authMethod)
        await wsApiClient.connect()
        const userProfile = await UserProfile.create(wsApiClient)
        return new ClientSdk(userProfile, wsApiClient, options)
    }

    /**
     * Shuts down instance of SDK entry point class.
     */
    public async shutdown(): Promise<void> {
        this.wsApiClient.disconnect()

        if (this.blitzOptionsFacade) {
            this.blitzOptionsFacade.close()
        }

        if (this.turboOptionsFacade) {
            this.turboOptionsFacade.close()
        }

        if (this.binaryOptionsFacade) {
            this.binaryOptionsFacade.close()
        }

        if (this.digitalOptionsFacade) {
            this.digitalOptionsFacade.close()
        }

        if (this.positionsFacade) {
            this.positionsFacade.close()
        }

        if (this.translationsFacade) {
            this.translationsFacade.close()
        }
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
     * Returns positions facade class.
     */
    public async positions(): Promise<Positions> {
        if (!this.positionsFacade) {
            const actives = await this.actives()
            const state = await this.wsConnectionState()
            this.positionsFacade = await Positions.create(this.wsApiClient, this.userProfile.userId, actives, state)
        }
        return this.positionsFacade
    }

    /**
     * Returns actives facade class.
     */
    public async actives(): Promise<Actives> {
        if (!this.activesFacade) {
            const translations = await this.translations()
            this.activesFacade = new Actives(this.wsApiClient, this.staticHost, translations)
        }
        return this.activesFacade
    }

    public async currencies(): Promise<Currencies> {
        if (!this.currenciesFacade) {
            this.currenciesFacade = new Currencies(this.wsApiClient, this.staticHost)
        }
        return this.currenciesFacade
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
            if (!await this.blitzOptionsIsAvailable()) {
                throw new Error('Blitz options are not available')
            }

            this.blitzOptionsFacade = await BlitzOptions.create(this.wsApiClient)
        }
        return this.blitzOptionsFacade
    }

    /**
     * Blitz options availability check.
     */
    public async blitzOptionsIsAvailable(): Promise<boolean> {
        return this.instrumentIsAvailable('blitz-instrument')
    }

    /**
     * Returns turbo options facade class.
     */
    public async turboOptions(): Promise<TurboOptions> {
        if (!this.turboOptionsFacade) {
            if (!await this.turboOptionsIsAvailable()) {
                throw new Error('Turbo options are not available')
            }

            this.turboOptionsFacade = await TurboOptions.create(this.wsApiClient)
        }
        return this.turboOptionsFacade
    }

    /**
     * Turbo options availability check.
     */
    public async turboOptionsIsAvailable(): Promise<boolean> {
        return this.instrumentIsAvailable('turbo-instrument')
    }

    /**
     * Returns binary options facade class.
     */
    public async binaryOptions(): Promise<BinaryOptions> {
        if (!this.binaryOptionsFacade) {
            if (!await this.binaryOptionsIsAvailable()) {
                throw new Error('Binary options are not available')
            }

            this.binaryOptionsFacade = await BinaryOptions.create(this.wsApiClient)
        }
        return this.binaryOptionsFacade
    }

    /**
     * Binary options availability check.
     */
    public async binaryOptionsIsAvailable(): Promise<boolean> {
        return this.instrumentIsAvailable('binary-instrument')
    }

    /**
     * Returns digital options facade class.
     */
    public async digitalOptions(): Promise<DigitalOptions> {
        if (!this.digitalOptionsFacade) {
            if (!await this.digitalOptionsIsAvailable()) {
                throw new Error('Digital options are not available')
            }

            this.digitalOptionsFacade = await DigitalOptions.create(this.wsApiClient)
        }
        return this.digitalOptionsFacade
    }

    /**
     * Digital options availability check.
     */
    public async digitalOptionsIsAvailable(): Promise<boolean> {
        return this.instrumentIsAvailable('digital-instrument')
    }

    /**
     * Returns margin forex facade class.
     */
    public async marginForex(): Promise<MarginForex> {
        if (!this.marginForexFacade) {
            if (!await this.marginForexIsAvailable()) {
                throw new Error('Margin forex is not available')
            }

            this.marginForexFacade = await MarginForex.create(this.wsApiClient)
        }
        return this.marginForexFacade
    }

    /**
     * Margin forex availability check.
     */
    public async marginForexIsAvailable(): Promise<boolean> {
        return this.instrumentIsAvailable('margin-forex-instrument')
    }

    /**
     * Returns margin cfd facade class.
     */
    public async marginCfd(): Promise<MarginCfd> {
        if (!this.marginCfdFacade) {
            if (!await this.marginCfdIsAvailable()) {
                throw new Error('Margin CFD is not available')
            }

            this.marginCfdFacade = await MarginCfd.create(this.wsApiClient)
        }
        return this.marginCfdFacade
    }

    /**
     * Margin cfd availability check.
     */
    public async marginCfdIsAvailable(): Promise<boolean> {
        return this.instrumentIsAvailable('margin-cfd-instrument')
    }

    /**
     * Returns margin crypto facade class.
     */
    public async marginCrypto(): Promise<MarginCrypto> {
        if (!this.marginCryptoFacade) {
            if (!await this.marginCryptoIsAvailable()) {
                throw new Error('Margin crypto is not available')
            }

            this.marginCryptoFacade = await MarginCrypto.create(this.wsApiClient)
        }
        return this.marginCryptoFacade
    }

    /**
     * Margin crypto availability check.
     */
    public async marginCryptoIsAvailable(): Promise<boolean> {
        return this.instrumentIsAvailable('margin-crypto-instrument')
    }

    private async instrumentIsAvailable(instrumentFeature: string): Promise<boolean> {
        if (this.instrumentsIsAvailable.has(instrumentFeature)) {
            return this.instrumentsIsAvailable.get(instrumentFeature)!
        }

        const response = await this.wsApiClient.doRequest<FeaturesV2>(new CallGetFeaturesV2());
        for (const feature of response.features) {
            if (feature.name === instrumentFeature && feature.status === 'disabled') {
                this.instrumentsIsAvailable.set(instrumentFeature, false)
                return false
            }
        }

        this.instrumentsIsAvailable.set(instrumentFeature, true)
        return true
    }

    /**
     * Returns orders facade class.
     */
    public async orders(): Promise<Orders> {
        if (!this.ordersFacade) {
            const balances = await this.balances()
            const balanceIds = balances.getBalances().map(balance => balance.id)
            this.ordersFacade = await Orders.create(this.wsApiClient, this.userProfile.userId, balanceIds)
        }
        return this.ordersFacade
    }

    public async candles(): Promise<Candles> {
        if (!this.candlesFacade) {
            this.candlesFacade = new Candles(this.wsApiClient)
        }

        return this.candlesFacade
    }

    public async realTimeChartDataLayer(activeId: number, size: number): Promise<RealTimeChartDataLayer> {
        if (!this.realTimeChartDataLayerFacade) {
            this.realTimeChartDataLayerFacade = {};
        }

        if (!this.realTimeChartDataLayerFacade[activeId]) {
            this.realTimeChartDataLayerFacade[activeId] = {};
        }

        if (!this.realTimeChartDataLayerFacade[activeId][size]) {
            this.realTimeChartDataLayerFacade[activeId][size] = (async () => {
                const candles = await this.candles();
                const wsConnectionState = await this.wsConnectionState();
                const consistencyManager = await this.candlesConsistencyManager();
                return new RealTimeChartDataLayer(this.wsApiClient, wsConnectionState, consistencyManager, candles, activeId, size);
            })();
        }

        return this.realTimeChartDataLayerFacade[activeId][size];
    }

    /**
     * Returns ws current time.
     */
    public currentTime(): Date {
        return new Date(this.wsApiClient.currentTime.unixMilliTime)
    }

    /**
     * Subscribe to WebSocket current time updates.
     * @param callback - Callback function that will be called when current time updates.
     */
    public subscribeOnWsCurrentTime(callback: (currentTime: Date) => void): void {
        this.wsApiClient.subscribeOnWsCurrentTime((time) => callback(new Date(time)))
    }

    /**
     * Unsubscribe from WebSocket current time updates.
     * @param callback - Callback function to unsubscribe.
     */
    public unsubscribeOnWsCurrentTime(callback: (currentTime: Date) => void): void {
        this.wsApiClient.unsubscribeOnWsCurrentTime((time) => callback(new Date(time)))
    }

    /**
     * Get WebSocket connection state facade.
     */
    public async wsConnectionState(): Promise<WsConnectionState> {
        if (this.wsConnectionStateFacade === undefined) {
            this.wsConnectionStateFacade = await WsConnectionState.create(this.wsApiClient)
        }
        return this.wsConnectionStateFacade
    }

    /**
     * Returns translations facade class.
     */
    public async translations(): Promise<Translations> {
        if (!this.translationsFacade) {
            this.translationsFacade = await Translations.create(this.host)
        }
        return this.translationsFacade
    }

    private async candlesConsistencyManager(): Promise<CandlesConsistencyManager> {
        if (!this.candlesConsistencyManagerFacade) {
            const candles = await this.candles();
            const wsConnectionState = await this.wsConnectionState();
            this.candlesConsistencyManagerFacade = new CandlesConsistencyManager(wsConnectionState, candles);
        }

        return this.candlesConsistencyManagerFacade;
    }
}

export interface ClientSDKAdditionalOptions {
    staticHost?: string;
    host?: string;
}

/**
 * Authenticates user in system APIs.
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
 * Implements OAuth2 authentication flow.
 */
export class OAuthMethod implements AuthMethod {
    private isBrowser = typeof window !== 'undefined';

    /**
     * Accepts parameters for OAuth2 authentication.
     * @param apiBaseUrl - Base URL for API requests.
     * @param clientId - Client ID.
     * @param redirectUri - Redirect URI.
     * @param scope - Scope.
     * @param clientSecret - Client secret (optional, only for server-side applications).
     * @param accessToken - Access token (optional).
     * @param refreshToken - Refresh token (optional only for server-side applications).
     * @param affId - Affiliate ID (optional).
     * @param afftrack - Affiliate tracking info (optional).
     * @param affModel - Affiliate model (optional).
     */
    public constructor(
        private readonly apiBaseUrl: string,
        private readonly clientId: number,
        private readonly redirectUri: string,
        private readonly scope: string,
        private readonly clientSecret?: string,
        private accessToken?: string,
        private refreshToken?: string,
        private readonly affId?: number,
        private readonly afftrack?: string,
        private readonly affModel?: string,
    ) {
        if (this.isBrowser && this.clientSecret) {
            throw new Error('Client secret should not be used in browser applications');
        }
    }

    /**
     * Authenticates client in WebSocket API.
     * @param wsApiClient
     */
    public async authenticateWsApiClient(wsApiClient: WsApiClient): Promise<boolean> {
        if (this.accessToken) {
            const authResponse = await wsApiClient.doRequest<Authenticated>(new Authenticate(this.accessToken))

            if (authResponse.isSuccessful) {
                return authResponse.isSuccessful
            }

            if (!this.refreshToken || !this.clientSecret) {
                return false
            }

            const hasNewAccessToken = await this.refreshAccessToken()
            if (hasNewAccessToken) {
                return this.authenticateWsApiClient(wsApiClient)
            }
        }

        return false
    }

    /**
     * Creates authorization URL and code verifier for PKCE flow.
     */
    public async createAuthorizationUrl(): Promise<{ url: string; codeVerifier: string }> {
        const codeVerifier = this.generateCodeVerifier(96);
        const codeChallenge = await this.generateCodeChallenge(codeVerifier);

        const state = this.randomUrlSafe(16);

        const request = new HttpOAuthRequest(
            this.redirectUri,
            this.clientId,
            this.scope,
            codeChallenge,
            "S256",
            state,
            this.affId,
            this.afftrack,
            this.affModel
        )

        let url = this.apiBaseUrl
        if (!this.apiBaseUrl.startsWith('http://') && !this.apiBaseUrl.startsWith('https://')) {
            url = `https://${this.apiBaseUrl}`
        }

        return {url: request.buildUrl(url), codeVerifier};
    }

    /**
     * Exchanges authorization code for access token and refresh token.
     * @param code
     * @param codeVerifier
     */
    public async issueAccessTokenWithAuthCode(code: string, codeVerifier: string): Promise<{
        accessToken: string,
        expiresIn: number,
        refreshToken?: string
    }> {
        const httpApiClient = this.httpApiClient()
        const response = await httpApiClient.doRequest(
            new HttpAccessTokenRequest(code, this.clientId, codeVerifier, this.redirectUri)
        )

        if (response.status === 200 && response.data.accessToken) {
            this.accessToken = response.data.accessToken
            this.refreshToken = response.data.refreshToken

            return {
                accessToken: response.data.accessToken,
                expiresIn: response.data.expiresIn,
                refreshToken: response.data.refreshToken
            }
        } else {
            throw new Error(`Failed to issue access token: ${response.status}`)
        }
    }

    private generateCodeVerifier(length = 64): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        let result = '';
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        for (let i = 0; i < length; i++) {
            result += chars[array[i] % chars.length];
        }
        return result;
    }

    private async generateCodeChallenge(codeVerifier: string): Promise<string> {
        const data = new TextEncoder().encode(codeVerifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return this.base64url(new Uint8Array(digest));
    }

    private randomUrlSafe(bytes = 16): string {
        const a = new Uint8Array(bytes);
        crypto.getRandomValues(a);
        return this.base64url(a);
    }

    private base64url(input: Uint8Array): string {
        let str = '';
        for (let i = 0; i < input.length; i++) str += String.fromCharCode(input[i]);
        return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }

    public async refreshAccessToken(): Promise<{
        accessToken: string,
        expiresIn: number,
        refreshToken?: string
    }> {
        if (!this.refreshToken || !this.clientSecret) {
            return Promise.reject('Refresh token or client secret is not set');
        }

        const httpApiClient = this.httpApiClient()
        const response = await httpApiClient.doRequest(
            new HttpRefreshAccessTokenRequest(this.refreshToken, this.clientId, this.clientSecret)
        )

        if (response.status === 200 && response.data.accessToken) {
            this.accessToken = response.data.accessToken
            this.refreshToken = response.data.refreshToken

            return {
                accessToken: response.data.accessToken,
                expiresIn: response.data.expiresIn,
                refreshToken: response.data.refreshToken
            }
        }

        return Promise.reject(`Failed to refresh access token: ${response.status}`);
    }

    private httpApiClient() {
        if (!this.apiBaseUrl.startsWith('http://') && !this.apiBaseUrl.startsWith('https://')) {
            return new HttpApiClient(`https://${this.apiBaseUrl}`);
        }

        return new HttpApiClient(this.apiBaseUrl);
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
 * Don't use this class directly from your code. Use {@link ClientSdk.userProfile} field instead.
 *
 * User profile facade class. Stores information about the user on whose behalf your application is working.
 */
export class UserProfile {
    public readonly userId: number
    public readonly firstName: string
    public readonly lastName: string

    /**
     * Creates instance of class {@link UserProfile}.
     * @internal
     * @private
     * @param profile
     */
    private constructor(profile: CoreProfileV1) {
        this.userId = profile.userId
        this.firstName = profile.firstName
        this.lastName = profile.lastName
    }

    /**
     * Requests information about current user, puts the information to instance of class UserProfile and returns it.
     * @param wsApiClient - Instance of WebSocket API client.
     */
    public static async create(wsApiClient: WsApiClient): Promise<UserProfile> {
        const userProfile = await wsApiClient.doRequest<CoreProfileV1>(new CallCoreGetProfileV1())
        return new UserProfile(userProfile)
    }
}

/**
 * Don't use this class directly from your code. Use {@link ClientSdk.balances} static method instead.
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
     * @param wsApiClient - Instance of WebSocket API client.
     * @internal
     * @private
     */
    private constructor(private readonly types: number[], balancesMsg: BalancesAvailableBalancesV1, wsApiClient: WsApiClient) {
        for (const index in balancesMsg.items) {
            const balance = new Balance(balancesMsg.items[index], wsApiClient)
            this.balances.set(balance.id, balance)
        }
    }

    /**
     * Requests information about user's balances, subscribes on user's balances updates, puts the information to instance of class Balances and returns it.
     * @param wsApiClient - Instance of WebSocket API client.
     */
    public static async create(wsApiClient: WsApiClient): Promise<Balances> {
        const types = [1, 4]
        const balancesMsg = await wsApiClient.doRequest<BalancesAvailableBalancesV1>(new CallBalancesGetAvailableBalancesV1(types))
        const balances = new Balances(types, balancesMsg, wsApiClient)
        let hasMargin = false

        for (const [index] of balances.balances) {
            const balance = balances.balances.get(index)!
            await wsApiClient.doRequest<Result>(new CallSubscribeMarginPortfolioBalanceChangedV1(balance.id))

            if (balance.isMargin) {
                const marginBalance = await wsApiClient.doRequest<MarginPortfolioBalanceV1>(new CallMarginGetMarginBalanceV1(balance.id))
                balance.updateMargin(marginBalance)
                hasMargin = true
            }
        }

        if (hasMargin) {
            await wsApiClient.subscribe<MarginPortfolioBalanceV1>(new SubscribeMarginPortfolioBalanceChangedV1(), (event: MarginPortfolioBalanceV1) => {
                balances.updateMarginBalance(event)
            })
        }

        await wsApiClient.subscribe<BalancesBalanceChangedV1>(new SubscribeBalancesBalanceChangedV1(), (event: BalancesBalanceChangedV1) => {
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
     * Adds specified callback to balance update subscribers' list.
     *
     * @param balanceId
     * @param callback
     */
    public subscribeOnUpdateBalance(balanceId: number, callback: CallbackForBalanceUpdate): void {
        if (!this.balances.has(balanceId)) {
            throw new Error(`balance with id '${balanceId}' is not found`)
        }

        this.balances.get(balanceId)!.subscribeOnUpdate(callback)
    }

    /**
     * Removes specified callback from balance update subscribers' list.
     *
     * @param balanceId
     * @param callback
     */
    public unsubscribeOnUpdateBalance(balanceId: number, callback: CallbackForBalanceUpdate): void {
        if (!this.balances.has(balanceId)) {
            throw new Error(`balance with id '${balanceId}' is not found`)
        }

        this.balances.get(balanceId)!.unsubscribeOnUpdate(callback)
    }

    /**
     * Updates instance from DTO.
     * @param balanceChangedMsg - Balances data transfer object.
     * @private
     */
    private updateBalance(balanceChangedMsg: BalancesBalanceChangedV1): void {
        if (!this.types.includes(balanceChangedMsg.type)) {
            return
        }

        if (!this.balances.has(balanceChangedMsg.id)) {
            return
        }

        this.balances.get(balanceChangedMsg.id)!.update(balanceChangedMsg)
    }

    /**
     * Updates instance from DTO.
     * @param balanceChangedMsg - Margin balances data transfer object.
     * @private
     */
    private updateMarginBalance(balanceChangedMsg: MarginPortfolioBalanceV1): void {
        if (!this.types.includes(balanceChangedMsg.type)) {
            return
        }

        if (!this.balances.has(balanceChangedMsg.id)) {
            return
        }

        this.balances.get(balanceChangedMsg.id)!.updateMargin(balanceChangedMsg)
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
     * Current amount of bonuses.
     */
    public bonusAmount: number

    /**
     * User's balance currency code (ISO 4217).
     */
    public currency: string

    /**
     * User's identification number.
     */
    public userId: number

    /**
     * Is margin balance.
     */
    public isMargin: boolean = false

    /**
     * Gross Profit and Loss (PnL).
     */
    public pnl: number | undefined

    /**
     * Net Profit and Loss (PnL) after deductions.
     */
    public pnlNet: number | undefined

    /**
     * Total equity in the account.
     */
    public equity: number | undefined

    /**
     * Total equity in USD.
     */
    public equityUsd: number | undefined

    /**
     * Swap charges for holding positions overnight.
     */
    public swap: number | undefined

    /**
     * Dividends received or paid.
     */
    public dividends: number | undefined

    /**
     * Margin used by the account.
     */
    public margin: number | undefined

    /**
     * Available margin for new positions.
     */
    public available: number | undefined

    /**
     * Current amount of money on margin user's balance.
     */
    public cash: number | undefined

    /**
     * Margin level as a percentage.
     */
    public marginLevel: number | undefined

    /**
     * Stop out level where positions are closed to prevent losses.
     */
    public stopOutLevel: number | undefined

    /**
     * Balance updates observer.
     * @private
     */
    private onUpdateObserver: Observable<Balance> = new Observable<Balance>()

    /**
     * Instance of WebSocket API client.
     * @private
     */
    private wsApiClient: WsApiClient

    /**
     * Initialises the class instance from DTO.
     * @param msg - Balance data transfer object.
     * @param wsApiClient
     * @internal
     * @private
     */
    public constructor(msg: BalancesAvailableBalancesV1Balance, wsApiClient: WsApiClient) {
        this.id = msg.id
        this.type = this.convertBalanceType(msg.type)
        this.amount = msg.amount
        this.bonusAmount = msg.bonusAmount
        this.currency = msg.currency
        this.userId = msg.userId
        this.isMargin = msg.isMargin
        this.wsApiClient = wsApiClient
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
     * Resets demo balance to 10000.
     */
    public async resetDemoBalance(): Promise<void> {
        if (this.type !== BalanceType.Demo) {
            throw new Error('Only demo balance can be reset')
        }

        await this.wsApiClient.doRequest(new CallInternalBillingResetTrainingBalanceV4(this.id, 10000))
    }

    /**
     * Returns available amount for margin trading.
     */
    public availableForMarginAmount(): number {
        if (this.isMargin) {
            return this.available || 0
        }

        return this.amount
    }

    /**
     * Returns available amount for options trading.
     */
    public availableForOptionsAmount(): number {
        if (this.isMargin) {
            if (this.available && this.cash) {
                if (this.available < this.cash) {
                    return this.available + this.bonusAmount
                } else {
                    return this.cash + this.bonusAmount
                }
            }
        }

        return this.amount + this.bonusAmount
    }

    /**
     * Updates the class instance from DTO.
     * @param msg - Balance data transfer object.
     * @private
     */
    update(msg: BalancesBalanceChangedV1): void {
        this.type = this.convertBalanceType(msg.type)
        this.amount = msg.amount
        this.bonusAmount = msg.bonusAmount
        this.currency = msg.currency
        this.userId = msg.userId

        this.onUpdateObserver.notify(this)
    }

    updateMargin(msg: MarginPortfolioBalanceV1): void {
        this.pnl = msg.pnl
        this.pnlNet = msg.pnlNet
        this.equity = msg.equity
        this.equityUsd = msg.equityUsd
        this.swap = msg.swap
        this.dividends = msg.dividends
        this.margin = msg.margin
        this.available = msg.available
        this.cash = msg.cash
        this.marginLevel = msg.marginLevel
        this.stopOutLevel = msg.stopOutLevel
        this.bonusAmount = msg.bonus

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
 * WebSocket connection state enum.
 */
export enum WsConnectionStateEnum {
    /**
     * WebSocket is connected and ready to use
     */
    Connected = 'connected',

    /**
     * WebSocket is disconnected
     */
    Disconnected = 'disconnected',
}

/**
 * Do not use this class directly from your code. Use {@link ClientSdk.wsConnectionState} static method instead.
 *
 * WebSocket connection state facade.
 */
export class WsConnectionState {
    private readonly wsApiClient: WsApiClient
    private onStateChangedObserver: Observable<WsConnectionStateEnum> = new Observable<WsConnectionStateEnum>()

    private constructor(wsApiClient: WsApiClient) {
        this.wsApiClient = wsApiClient
        this.wsApiClient.onConnectionStateChanged = (state: WsConnectionStateEnum) => {
            this.onStateChangedObserver.notify(state)
        }
    }

    public static async create(wsApiClient: WsApiClient): Promise<WsConnectionState> {
        return new WsConnectionState(wsApiClient)
    }

    /**
     * Subscribe to WebSocket connection state changes.
     * @param callback - Callback function that will be called when the state changes.
     */
    public subscribeOnStateChanged(callback: (state: WsConnectionStateEnum) => void): void {
        this.onStateChangedObserver.subscribe(callback)
    }

    /**
     * Unsubscribe from WebSocket connection state changes.
     * @param callback - Callback function to unsubscribe.
     */
    public unsubscribeOnStateChanged(callback: (state: WsConnectionStateEnum) => void): void {
        this.onStateChangedObserver.unsubscribe(callback)
    }
}

/**
 * Don't use this class directly from your code. Use {@link ClientSdk.candles} static method instead.
 *
 * Candles facade class.
 */
export class Candles {
    /**
     * Instance of WebSocket API client.
     * @private
     */
    private wsApiClient: WsApiClient

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
     * Get candles for specified active.
     * @param activeId
     * @param size
     * @param options
     */
    public async getCandles(activeId: number,
                            size: number,
                            options: {
                                from?: number,
                                to?: number,
                                fromId?: number,
                                toId?: number,
                                count?: number,
                                backoff?: number
                                onlyClosed?: boolean
                                kind?: string,
                                splitNormalization?: boolean,
                            } | undefined = undefined
    ): Promise<Candle[]> {
        const response = await this.wsApiClient.doRequest<QuotesHistoryCandlesV2>(new CallQuotesHistoryGetCandlesV2({
            activeId,
            size,
            options
        }));

        return response.candles
    }
}

/**
 * Candle data transfer object.
 */
export class Candle {
    id: number
    from: number
    to: number
    open: number
    close: number
    min: number
    max: number
    volume: number
    at: number | undefined

    constructor(data: {
        id: number,
        from: number,
        to: number,
        open: number,
        close: number,
        min: number,
        max: number,
        volume: number,
        at: number | undefined
    }) {
        this.id = data.id
        this.from = data.from
        this.to = data.to
        this.open = data.open
        this.close = data.close
        this.min = data.min
        this.max = data.max
        this.volume = data.volume
        this.at = data.at
    }
}

/**
 * Available translation groups.
 */
export enum TranslationGroup {
    Front = 'front',
    Assets = 'assets',
    Desktop = 'desktop'
}

/**
 * Don't use this class directly from your code. Use {@link ClientSdk.translations} static method instead.
 *
 * Translations facade class.
 */
export class Translations {
    private translations: Record<string, Record<string, string>> = {}
    private reloadInterval: NodeJS.Timeout | undefined
    private readonly reloadIntervalMs: number = 10 * 60 * 1000 // 10 minutes
    private readonly httpApiClient: HttpApiClient
    private loadedLanguages: Set<string> = new Set()
    private loadedGroups: Set<TranslationGroup> = new Set()

    private constructor(host: string) {
        this.httpApiClient = new HttpApiClient(host)
    }

    public static async create(host: string): Promise<Translations> {
        const instance = new Translations(host)
        await instance.fetchTranslations('en', [TranslationGroup.Front])
        instance.startAutoReload()
        return instance
    }

    private startAutoReload(): void {
        this.reloadInterval = setInterval(async () => {
            for (const lang of this.loadedLanguages) {
                const groups = Array.from(this.loadedGroups)
                if (groups.length > 0) {
                    await this.fetchTranslations(lang, groups)
                }
            }
        }, this.reloadIntervalMs)
    }

    /**
     * Fetches translations from the server.
     * @param lang - Language code (e.g. 'en', 'ru')
     * @param groups - Array of translation groups to fetch
     */
    public async fetchTranslations(lang: string, groups: TranslationGroup[]): Promise<void> {
        const response = await this.httpApiClient.doRequest<HttpGetTranslationsResponse>(new HttpGetTranslationsRequest(lang, groups))
        if (response.isSuccessful && response.data) {
            if (!this.translations[lang]) {
                this.translations[lang] = {}
            }
            this.translations[lang] = {...this.translations[lang], ...response.data.result[lang]}

            this.loadedLanguages.add(lang)
            groups.forEach(group => this.loadedGroups.add(group))
        }
    }

    /**
     * Gets translation for a specific key in the specified language.
     * @param key - Translation key (e.g. 'front.W')
     * @param lang - Language code (defaults to 'en')
     */
    public getTranslation(key: string, lang: string = 'en'): string {
        return this.translations[lang]?.[key] || key
    }

    /**
     * Stops automatic reloading of translations and cleans up resources.
     */
    public close(): void {
        if (this.reloadInterval) {
            clearInterval(this.reloadInterval)
            this.reloadInterval = undefined
        }
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
 * Don't use this class directly from your code. Use {@link ClientSdk.actives} static method instead.
 *
 * Actives facade class. Stores information about actives. Keeps actives' information up to date.
 */
export class Actives {
    private wsApiClient: WsApiClient;
    private translations: Translations;
    private activeCache = new Map<number, Promise<Active>>();
    private activeData = new Map<number, Active>();
    private staticHost: string;

    public constructor(wsApiClient: WsApiClient, staticHost: string, translations: Translations) {
        this.wsApiClient = wsApiClient;
        this.staticHost = staticHost;
        this.translations = translations;
    }

    /**
     * Returns active data with caching.
     * @param activeId - Active ID.
     */
    public async getActive(activeId: number): Promise<Active> {
        if (this.activeData.has(activeId)) {
            return this.activeData.get(activeId)!;
        }

        if (this.activeCache.has(activeId)) {
            return this.activeCache.get(activeId)!;
        }

        const activePromise = this.wsApiClient.doRequest<ActiveV5>(new CallGetActiveV5(activeId))
            .then((response) => {
                const active = new Active(response, this.staticHost, this.translations)
                this.activeData.set(activeId, active);
                this.activeCache.delete(activeId);
                return active;
            })
            .catch((error) => {
                this.activeCache.delete(activeId);
                throw error;
            });

        this.activeCache.set(activeId, activePromise);
        return activePromise;
    }
}

/**
 * Active data transfer object.
 */
export class Active {
    /**
     * Active ID.
     */
    id: number

    /**
     * Active name.
     */
    name: string

    /**
     * Active description.
     */
    description: string

    /**
     * Active localization key.
     */
    localizationKey: string

    /**
     * Active image URL.
     */
    imageUrl: string

    /**
     * Is active OTC.
     */
    isOtc: boolean

    /**
     * Trading time from.
     */
    timeFrom: string

    /**
     * Trading time to.
     */
    timeTo: string

    /**
     * Active precision.
     */
    precision: number

    /**
     * Active pip scale.
     */
    pipScale: number

    /**
     * Active spread plus.
     */
    spreadPlus: number

    /**
     * Active spread minus.
     */
    spreadMinus: number

    /**
     * Active expiration days.
     */
    expirationDays: number[]

    /**
     * Active currency left side.
     */
    currencyLeftSide: string

    /**
     * Active currency right side.
     */
    currencyRightSide: string

    /**
     * Active type.
     */
    type: string

    /**
     * Active min quantity.
     */
    minQty: number

    /**
     * Active quantity step.
     */
    qtyStep: number

    /**
     * Active quantity type.
     */
    typeQty: string

    constructor(response: ActiveV5, staticHost: string, translations: Translations) {
        this.id = response.id
        this.localizationKey = `${TranslationGroup.Front}.${response.name}`
        this.name = translations.getTranslation(this.localizationKey)
        this.description = translations.getTranslation(`${TranslationGroup.Front}.${response.description}`)
        this.imageUrl = `${staticHost}${response.image}`
        this.isOtc = response.isOtc
        this.timeFrom = response.timeFrom
        this.timeTo = response.timeTo
        this.precision = response.precision
        this.pipScale = response.pipScale
        this.spreadPlus = response.spreadPlus
        this.spreadMinus = response.spreadMinus
        this.expirationDays = response.expirationDays
        this.currencyLeftSide = response.currencyLeftSide
        this.currencyRightSide = response.currencyRightSide
        this.type = response.type
        this.minQty = response.minQty
        this.qtyStep = response.qtyStep
        this.typeQty = response.typeQty
    }
}

/**
 * Don't use this class directly from your code. Use {@link ClientSdk.currencies} static method instead.
 *
 * Currencies facade class. Stores information about currencies. Keeps currencies information up to date.
 */
export class Currencies {
    private wsApiClient: WsApiClient;
    private currencyCache = new Map<string, Promise<Currency>>();
    private currencyData = new Map<string, Currency>();
    private staticHost: string;

    public constructor(wsApiClient: WsApiClient, staticHost: string) {
        this.wsApiClient = wsApiClient;
        this.staticHost = staticHost;
    }

    /**
     * Returns currency data with caching.
     * @param currencyCode - Currency code (example: USD).
     */
    public async getCurrency(currencyCode: string): Promise<Currency> {
        if (this.currencyData.has(currencyCode)) {
            return this.currencyData.get(currencyCode)!;
        }

        if (this.currencyCache.has(currencyCode)) {
            return this.currencyCache.get(currencyCode)!;
        }

        const currencyPromise = this.wsApiClient.doRequest<CurrencyV5>(new CallGetCurrencyV5(currencyCode))
            .then((response) => {
                const currency = new Currency(response, this.staticHost)
                this.currencyData.set(currencyCode, currency);
                this.currencyCache.delete(currencyCode);
                return currency;
            })
            .catch((error) => {
                this.currencyCache.delete(currencyCode);
                throw error;
            });

        this.currencyCache.set(currencyCode, currencyPromise);
        return currencyPromise;
    }
}

/**
 * Currency data transfer object.
 */
export class Currency {
    /**
     * Currency ID.
     */
    id: number

    /**
     * Currency name.
     */
    name: string

    /**
     * Currency description.
     */
    description: string

    /**
     * Currency symbol ($).
     */
    symbol: string

    /**
     * Currency mask ($%s).
     */
    mask: string

    /**
     * Currency is tradable.
     */
    isTradable: boolean

    /**
     * Currency code
     */
    code: string

    /**
     * Currency unit.
     */
    unit: number

    /**
     * Currency rate.
     */
    rate: number

    /**
     * Currency rate in USD.
     */
    rateUsd: number

    /**
     * Currency min deal amount.
     */
    minDealAmount: number

    /**
     * Currency max deal amount.
     */
    maxDealAmount: number

    /**
     * Currency minor units.
     */
    minorUnits: number

    /**
     * Currency image URL.
     */
    imageUrl: string

    /**
     * Currency is crypto.
     */
    isCrypto: boolean

    /**
     * Currency is inout.
     */
    isInout: boolean

    /**
     * Currency interest rate.
     */
    interestRate: number

    constructor(response: CurrencyV5, staticHost: string) {
        this.id = response.id
        this.name = response.name
        this.description = response.description
        this.symbol = response.symbol
        this.mask = response.mask
        this.isTradable = response.isTradable
        this.code = response.code
        this.unit = response.unit
        this.rate = response.rate
        this.rateUsd = response.rateUsd
        this.minDealAmount = response.minDealAmount
        this.maxDealAmount = response.maxDealAmount
        this.minorUnits = response.minorUnits
        this.imageUrl = `${staticHost}/${response.image}`
        this.isCrypto = response.isCrypto
        this.isInout = response.isInout
        this.interestRate = response.interestRate
    }
}

/**
 * RealTimeChartDataLayer provides real-time and historical candle data for a given activeId and candleSize.
 */
export class RealTimeChartDataLayer {
    private readonly wsApiClient: WsApiClient;
    private readonly candlesFacade: Candles;
    private readonly candlesConsistencyManager: CandlesConsistencyManager;
    private readonly activeId: number;
    private readonly candleSize: number;

    private candles: Candle[] = [];
    private connected: boolean = true;
    private subscribed: boolean = false;
    private loadedFrom: number | null = null;
    private loadedTo: number | null = null;
    private firstCandleFrom: number | null = null;
    private currentReject: ((err: any) => void) | null = null;
    private onUpdateObserver: Observable<Candle> = new Observable<Candle>();
    private onConsistencyUpdateObserver: Observable<{ from: number, to: number }> = new Observable<{
        from: number,
        to: number
    }>();
    private candleQueue: {
        from?: number;
        to?: number;
        countBack?: number;
        resolve: (c: Candle[]) => void;
        reject: (e: any) => void
    }[] = [];
    private isProcessingQueue = false;
    private candlesMutationsLock: Promise<void> = Promise.resolve();

    constructor(wsApiClient: WsApiClient, wsConnectionState: WsConnectionState, consistencyManager: CandlesConsistencyManager, candles: Candles, activeId: number, candleSize: number) {
        this.wsApiClient = wsApiClient;
        this.candlesFacade = candles;
        this.candlesConsistencyManager = consistencyManager;
        this.activeId = activeId;
        this.candleSize = candleSize;

        this.wsApiClient.doRequest<QuotesFirstCandlesV1>(new CallQuotesGetFirstCandlesV1(activeId))
            .then((response) => {
                const candle = response.candlesBySize[candleSize];

                if (candle) {
                    this.firstCandleFrom = candle.from;
                }
            })

        wsConnectionState.subscribeOnStateChanged((state: WsConnectionStateEnum) => {
            switch (state) {
                case WsConnectionStateEnum.Connected:
                    this.loadMissedCandlesOnReconnect().then(() => {
                        this.connected = true;
                        this.processQueue().then(() => {
                        })
                    })
                    break;
                case WsConnectionStateEnum.Disconnected:
                    this.connected = false;
                    this.isProcessingQueue = false;

                    for (const {reject} of this.candleQueue) {
                        reject(new Error('WebSocket disconnected'));
                    }

                    if (this.currentReject) {
                        this.currentReject(new Error('WebSocket disconnected'));
                        this.currentReject = null;
                    }

                    this.candleQueue = [];
                    break
            }
        })
    }

    /**
     * Returns the last candle for the activeId and candleSize.
     */
    getAllCandles(): Candle[] {
        return this.candles;
    }

    /**
     * Returns the first candle timestamp for the activeId and candleSize.
     */
    getFirstCandleFrom(): number | null {
        return this.firstCandleFrom;
    }

    /**
     * Fetch candles for the activeId and candleSize.
     *
     * Limitation: A maximum of 1000 candles can be fetched in a single request.
     * Therefore, the 'from' parameter must be chosen so that the time range between 'from' and 'to'
     * does not exceed 1000 * candleSize seconds.
     *
     * Formula:
     *   (to - from) <= 1000 * candleSize
     *
     * If 'to' is not provided, it defaults to the latest loaded candle or the current time.
     *
     * Example: If candleSize = 60 (1 minute), the time range between 'from' and 'to'
     * must be less than or equal to 60,000 seconds (~16.6 hours).
     *
     * @param from - UNIX timestamp in seconds from which to fetch candles.
     */
    async fetchAllCandles(from: number): Promise<Candle[]> {
        if (this.firstCandleFrom !== null && from < this.firstCandleFrom) {
            from = this.firstCandleFrom;
        }

        return new Promise<Candle[]>((resolve, reject) => {
            this.candleQueue.push({from, resolve, reject});
            this.processQueue();
        });
    }

    /**
     * Fetches candles for the activeId and candleSize within a specified time range.
     *
     * This method should be called iteratively with a maximum of 1000 candles per call (countBack <= 1000).
     * After each call, the "to" value should be updated to candles[0].from - 1 to fetch older data in steps.
     * This approach allows backward pagination of historical candles while avoiding overload or data gaps.
     *
     * @param to - Unix timestamp (in seconds) representing the end of the time range (inclusive).
     * @param countBack - Number of candles to fetch backward from the "to" timestamp.
     * @returns Promise resolving to an array of Candle objects.
     */
    async fetchCandles(to: number, countBack: number): Promise<Candle[]> {
        return new Promise<Candle[]>((resolve, reject) => {
            this.candleQueue.push({countBack, to, resolve, reject});
            this.processQueue();
        });
    }

    private async processQueue() {
        if (this.isProcessingQueue || this.candleQueue.length === 0 || !this.connected) {
            return;
        }

        this.isProcessingQueue = true;

        const {from, to, countBack, resolve, reject} = this.candleQueue.shift()!;
        this.currentReject = reject;

        let onlyRange = false;
        if (to) {
            onlyRange = true;
        }

        try {
            if (from && this.loadedFrom !== null && from >= this.loadedFrom) {
                resolve(this.candles);
            } else {
                let toCurrent = to
                if (!toCurrent) {
                    if (this.loadedFrom) {
                        toCurrent = this.loadedFrom - 1;
                    } else if (this.candles.length > 0) {
                        toCurrent = this.candles[0].from - 1;
                    } else {
                        toCurrent = undefined;
                    }
                }


                const newCandles = await this.candlesFacade.getCandles(this.activeId, this.candleSize, {
                    from,
                    to: toCurrent,
                    count: countBack
                });

                let hasGaps = newCandles.some((c, i, arr) =>
                    i > 0 && c.id - arr[i - 1].id !== 1
                );

                const missingIntervals: { fromId: number; toId: number }[] = [];
                if (newCandles.length > 0 && this.candles.length > 0 && this.loadedFrom !== null) {
                    const currentFirstCandle = this.candles[0];
                    const newLastCandle = newCandles[newCandles.length - 1];

                    const delta = currentFirstCandle.id - newLastCandle.id;
                    const maxDelta = 1000;

                    if (delta > 1) {
                        hasGaps = true

                        if (delta > maxDelta) {
                            const fromIdMissing = currentFirstCandle.id - maxDelta;
                            const toIdMissing = currentFirstCandle.id;

                            missingIntervals.push({fromId: fromIdMissing, toId: toIdMissing});
                        } else {
                            missingIntervals.push({fromId: newLastCandle.id, toId: currentFirstCandle.id})
                        }
                    }
                }

                if (hasGaps) {
                    for (let i = 1; i < newCandles.length; i++) {
                        const prev = newCandles[i - 1];
                        const curr = newCandles[i];
                        const delta = curr.id - prev.id;

                        if (delta > 1) {
                            const fromMissing = prev.id;
                            const toMissing = curr.id;
                            missingIntervals.push({fromId: fromMissing, toId: toMissing});
                        }
                    }

                    this.recoverGapsAsync(missingIntervals).then();
                    this.candles = [...newCandles, ...this.candles];
                    if (!from) {
                        this.loadedFrom = this.candles[0].from;
                    } else {
                        this.loadedFrom = this.loadedFrom !== null ? Math.min(this.loadedFrom, from) : from;
                    }
                    if (onlyRange) {
                        resolve(newCandles)
                    } else {
                        resolve(this.candles);
                    }
                } else {
                    this.candles = [...newCandles, ...this.candles];
                    if (!from) {
                        this.loadedFrom = this.candles[0].from;
                    } else {
                        this.loadedFrom = this.loadedFrom !== null ? Math.min(this.loadedFrom, from) : from;
                    }

                    if (onlyRange) {
                        resolve(newCandles)
                    } else {
                        resolve(this.candles);
                    }
                }
            }
        } catch (error) {
            reject(error);
        } finally {
            this.isProcessingQueue = false;
            this.currentReject = null;
            this.processQueue().then()
        }
    }

    /**
     * Subscribes to real-time updates for the last candle.
     * @param handler
     */
    subscribeOnLastCandleChanged(handler: (candle: Candle) => void) {
        if (!this.subscribed) {
            this.wsApiClient.subscribe<CandleGeneratedV1>(new SubscribeCandleGeneratedV1(this.activeId, this.candleSize), (event: CandleGeneratedV1) => {
                if (event.activeId !== this.activeId || event.size !== this.candleSize) {
                    return
                }

                if (this.connected) {
                    this.handleRealtimeUpdate(event).then()
                }
            }).then()
        }

        this.onUpdateObserver.subscribe(handler);
    }

    /**
     * Unsubscribes from real-time updates for the last candle.
     * @param handler
     */
    unsubscribeOnLastCandleChanged(handler: (candle: Candle) => void) {
        this.onUpdateObserver.unsubscribe(handler);
    }

    /**
     * Subscribes to consistency updates for the candles.
     * @param handler
     */
    subscribeOnConsistencyRecovered(handler: (data: { from: number, to: number }) => void) {
        this.onConsistencyUpdateObserver.subscribe(handler);
    }

    /**
     * Unsubscribes from consistency updates for the candles.
     * @param handler
     */
    unsubscribeOnConsistencyRecovered(handler: (data: { from: number, to: number }) => void) {
        this.onConsistencyUpdateObserver.unsubscribe(handler);
    }

    private async recoverGapsAsync(missingIntervals: { fromId: number; toId: number }[]) {
        const gapPromises = missingIntervals.map(async ({fromId, toId}) => {
            try {
                const gapCandles = await this.candlesConsistencyManager
                    .fetchCandles(fromId, toId, this.activeId, this.candleSize)

                return ({fromId, toId, gapCandles})
            } catch (err) {
                console.warn(`Failed to fetch gap from ${fromId} to ${toId}:`, err)
                return null
            }
        });

        function findInsertIndex(candles: Candle[], targetTo: number): number {
            let low = 0, high = candles.length;

            while (low < high) {
                const mid = Math.floor((low + high) / 2);
                if (candles[mid].id < targetTo) {
                    low = mid + 1;
                } else {
                    high = mid;
                }
            }

            return low;
        }

        const results = await Promise.all(gapPromises);

        const mutations = results
            .filter((r): r is { fromId: number; toId: number; gapCandles: Candle[] } => !!r)
            .map((result) => {
                const {toId, gapCandles} = result;

                return () => {
                    let insertIndex = findInsertIndex(this.candles, toId);
                    const from = gapCandles[0].from;
                    const to = gapCandles[gapCandles.length - 1].to;

                    if (insertIndex === 0) {
                        this.candles.splice(insertIndex, 1);
                    } else if (insertIndex === this.candles.length) {
                        this.candles.splice(insertIndex - 1, 1);
                        insertIndex -= 1
                    } else {
                        this.candles.splice(insertIndex - 1, 2);
                        insertIndex -= 1
                    }

                    this.candles.splice(insertIndex, 0, ...gapCandles);
                    this.onConsistencyUpdateObserver.notify({from, to});
                };
            });

        for (const mutate of mutations) {
            this.candlesMutationsLock = this.candlesMutationsLock.then(() => {
                mutate();
            });
            await this.candlesMutationsLock;
        }
    }

    private async handleRealtimeUpdate(newCandle: CandleGeneratedV1): Promise<void> {
        const candle = new Candle(newCandle);

        const mutate = async () => {
            const last = this.candles[this.candles.length - 1];

            if (!last) {
                this.candles.push(candle);
            } else if (newCandle.from === last.from) {
                this.candles[this.candles.length - 1] = candle;
            } else if (newCandle.from > last.from) {
                this.candles.push(candle);
                if (this.loadedTo === null || candle.to > this.loadedTo) {
                    this.loadedTo = candle.to;
                }

                const delta = candle.id - last.id;
                if (delta > 1 || (last.at && last.to !== last.at / 1_000_000_000)) {
                    this.recoverGapsAsync([{fromId: last.id, toId: candle.id}]).then()
                }
            } else {
                return;
            }

            this.onUpdateObserver.notify(candle);
        };

        this.candlesMutationsLock = this.candlesMutationsLock.then(() => mutate());
        await this.candlesMutationsLock;
    }

    private async loadMissedCandlesOnReconnect() {
        if (this.loadedTo === null) return;

        try {
            const newCandles = await this.candlesFacade.getCandles(this.activeId, this.candleSize, {
                from: this.loadedTo,
            });

            const hasGaps = newCandles.some((c, i, arr) =>
                i > 0 && c.id - arr[i - 1].id !== 1
            );

            if (hasGaps) {
                const missingIntervals: { fromId: number; toId: number }[] = [];

                for (let i = 1; i < newCandles.length; i++) {
                    const prev = newCandles[i - 1];
                    const curr = newCandles[i];
                    const delta = curr.id - prev.id;

                    if (delta > 1) {
                        const fromIdMissing = prev.id;
                        const toIdMissing = curr.id;
                        missingIntervals.push({fromId: fromIdMissing, toId: toIdMissing});
                    }
                }

                this.recoverGapsAsync(missingIntervals).then();
            }

            for (const candle of newCandles) {
                const existingIndex = this.candles.findIndex(c => c.from === candle.from);

                if (existingIndex !== -1) {
                    this.candles[existingIndex] = candle;
                } else {
                    this.candles.push(candle);
                }

                if (this.loadedTo === null || candle.to > this.loadedTo) {
                    this.loadedTo = candle.to;
                }

                this.onUpdateObserver.notify(candle);
            }
        } catch (error) {
            console.error('Failed to load missed candles after reconnect:', error);
        }
    }
}

class CandlesConsistencyManager {
    private readonly candlesFacade: Candles;
    private isProcessingQueue = false;
    private connected: boolean = true;
    private readonly maxRetries = 10;
    private candleQueue: {
        fromId: number;
        toId: number,
        activeId: number,
        candleSize: number;
        retries: number;
        resolve: (c: Candle[]) => void;
        reject: (e: any) => void
    }[] = [];
    private currentQueueElement: typeof this.candleQueue[number] | null = null;

    constructor(wsConnectionState: WsConnectionState, candles: Candles) {
        this.candlesFacade = candles;

        wsConnectionState.subscribeOnStateChanged((state: WsConnectionStateEnum) => {
            switch (state) {
                case WsConnectionStateEnum.Connected:
                    this.connected = true;
                    this.processQueue().then();
                    break;
                case WsConnectionStateEnum.Disconnected:
                    this.connected = false;
                    this.isProcessingQueue = false;
                    break;
            }
        });
    }

    fetchCandles(fromId: number, toId: number, activeId: number, candleSize: number): Promise<Candle[]> {
        return new Promise<Candle[]>((resolve, reject) => {
            this.candleQueue.push({fromId, toId, activeId, candleSize, retries: 0, resolve, reject});
            this.processQueue().then()
        });
    }

    private async processQueue() {
        if (this.isProcessingQueue || this.candleQueue.length === 0 || !this.connected) {
            return;
        }

        this.isProcessingQueue = true;

        const element = this.candleQueue.shift()!;
        this.currentQueueElement = element;

        const {fromId, toId, activeId, candleSize, retries, resolve, reject} = element;
        const delay = Math.min(100 * 2 ** retries, 10000);
        const jitter = Math.random() * 100;

        try {
            const candles = await this.candlesFacade.getCandles(activeId, candleSize, {fromId, toId});
            let hasGaps = candles.some((c, i, arr) =>
                i > 0 && c.id - arr[i - 1].id !== 1
            );

            const firstCandle = candles[0];
            const lastCandle = candles[candles.length - 1];

            if (!hasGaps && firstCandle.id !== fromId || lastCandle.id !== toId) {
                hasGaps = true
            }

            if (hasGaps || candles.length === 0) {
                if (retries < this.maxRetries) {
                    setTimeout(() => {
                        this.candleQueue.unshift({...element, retries: retries + 1});
                        this.processQueue().then();
                    }, delay + jitter);
                } else {
                    reject(new Error(`Candles have gaps. Max retries reached (${this.maxRetries})`));
                }
            } else {
                resolve(candles);
            }
        } catch (error) {
            if (retries < this.maxRetries) {
                setTimeout(() => {
                    this.candleQueue.unshift({...element, retries: retries + 1});
                    this.processQueue().then();
                }, delay + jitter);
            } else {
                reject(new Error(`Failed to fetch candles after ${this.maxRetries} retries: ${error}`));
            }
        } finally {
            this.isProcessingQueue = false;
            this.currentQueueElement = null;
            setTimeout(() => this.processQueue(), 0);
        }
    }
}

/**
 * Don't use this class directly from your code. Use {@link ClientSdk.quotes} static method instead.
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

        await this.wsApiClient.subscribe<QuoteGeneratedV2>(new SubscribeQuoteGeneratedV2(activeId), (event: QuoteGeneratedV2) => {
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
        this.time = new Date(msg.time)
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
 * * {@link ClientSdk.positions}
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
     * Positions history.
     * @private
     */
    private positionsHistoryFacade: PositionsHistory | undefined

    /**
     * Positions' history array.
     * @private
     */
    private positionsHistory: Position[] = []

    /**
     * Positions' IDs cache.
     * @private
     */
    private positionsIds: Map<string, number> = new Map<string, number>()

    /**
     * Positions updates observer.
     * @private
     */
    private onUpdatePositionObserver: Observable<Position> = new Observable<Position>()

    /**
     * Timer for periodical actives list update.
     * @private
     */
    private intervalId: NodeJS.Timeout | undefined

    /**
     * Instance of WebSocket API client.
     * @private
     */
    private wsApiClient: WsApiClient | undefined

    /**
     * Actives facade.
     * @private
     */
    private actives: Actives | undefined

    /**
     * Digital options facade.
     * @private
     */
    private digitalOptions: DigitalOptions | undefined

    /**
     * List of supported instrument types.
     * @private
     */
    private instrumentTypes: string[] = ["digital-option", "binary-option", "turbo-option", "blitz-option", "marginal-cfd", "marginal-crypto", "marginal-forex"]

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
     * @param userId - User's identification number.
     * @param actives - Actives facade.
     */
    public static async create(wsApiClient: WsApiClient, userId: number, actives: Actives, state: WsConnectionState): Promise<Positions> {
        const positionsFacade = new Positions()
        positionsFacade.actives = actives
        positionsFacade.wsApiClient = wsApiClient
        positionsFacade.positionsHistoryFacade = new PositionsHistory(wsApiClient, userId, positionsFacade.positionsHistory)
        await positionsFacade.syncOldActivePositions()
        await positionsFacade.subscribePositionChanged(userId)
        await positionsFacade.subscribePositionsState()
        positionsFacade.subscribePositions()

        state.subscribeOnStateChanged(((state) => {
            if (state === WsConnectionStateEnum.Connected) {
                positionsFacade.syncOldActivePositions()
            }
        }));

        return positionsFacade
    }

    /**
     * Subscribes on position's updates.
     *
     * @private
     */
    private async subscribePositionChanged(userId: number): Promise<void> {
        await this.wsApiClient!.subscribe<PortfolioPositionChangedV3>(
            new SubscribePortfolioPositionChangedV3(userId),
            (event: PortfolioPositionChangedV3) => {
                this.syncPositionFromEvent(event);
            }
        );
    }

    /**
     * Subscribes on positions states updates.
     * @private
     */
    private async subscribePositionsState(): Promise<void> {
        this.wsApiClient!.subscribe<PortfolioPositionsStateV1>(new SubscribePortfolioPositionsStateV1(),
            (event: PortfolioPositionsStateV1) => {
                this.syncPositionsStateFromEvent(event)
            }).then(() => {
        })

        this.intervalId = setInterval(async () => {
            await this.wsApiClient!.unsubscribe<PortfolioPositionsStateV1>(new SubscribePortfolioPositionsStateV1())
            await this.wsApiClient!.subscribe<PortfolioPositionsStateV1>(new SubscribePortfolioPositionsStateV1(),
                (event: PortfolioPositionsStateV1) => {
                    this.syncPositionsStateFromEvent(event)
                })
        }, 60000)
    }

    /**
     * Synchronizes old active positions.
     * @private
     */
    private async syncOldActivePositions(): Promise<void> {
        const previousIds = new Set<number>(this.positions.keys())
        const receivedIds = new Set<number>()

        let offset = 0
        const limit = 30
        for (; ;) {
            const positionsPage = await this.wsApiClient!.doRequest<PortfolioPositionsV4>(
                new CallPortfolioGetPositionsV4(this.instrumentTypes, limit, offset)
            )

            for (const raw of positionsPage.positions) {
                receivedIds.add(raw.externalId)
                this.syncPositionFromResponse(raw)
            }

            if (positionsPage.positions.length < positionsPage.limit) {
                break
            }

            offset += limit
        }

        const missingIds = [...previousIds].filter(id => !receivedIds.has(id))
        for (const id of missingIds) {
            try {
                const position = await this.positionsHistoryFacade?.getPositionHistory(id)
                if (!position) {
                    continue
                }

                this.syncPosition(position)
            } catch (e) {
                // console.warn(`Position ${id} not found in history`, e)
            }
        }
    }

    /**
     * @deprecated. Use {@link Positions.getOpenedPositions} instead.
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
     * Returns list of opened positions.
     */
    public getOpenedPositions(): Position[] {
        const list = []

        for (const [index] of this.positions) {
            list.push(this.positions.get(index)!)
        }

        return list
    }

    /**
     * Returns positions history.
     */
    public getPositionsHistory(): PositionsHistory {
        if (!this.positionsHistoryFacade) {
            throw new Error("Positions history facade is not available")
        }

        return this.positionsHistoryFacade
    }

    /**
     * Checks if a given order ID matches any of the order IDs associated with a position.
     * @param orderId
     * @param position
     */
    public isOrderMatchingPosition(orderId: number, position: Position): boolean {
        return position.orderIds.includes(orderId)
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
     * @param msg - Positions state data transfer object.
     * @private
     */
    private syncPositionsStateFromEvent(msg: PortfolioPositionsStateV1): void {
        for (const index in msg.positions) {
            const key = `${msg.positions[index].instrumentType}-${msg.positions[index].internalId}`
            const externalId = this.positionsIds.get(key)
            if (!externalId) {
                continue
            }

            const position = this.positions.get(externalId)
            if (!position) {
                continue
            }

            position.syncFromStateEvent(msg.positions[index])
            this.onUpdatePositionObserver.notify(position)
        }
    }

    /**
     * Updates instance from DTO.
     * @param msg - Position data transfer object.
     * @private
     */
    private syncPositionFromResponse(msg: PortfolioPositionsV4Position): void {
        const isNewPosition = !this.positions.has(msg.externalId)
        if (isNewPosition) {
            const position = new Position(this.wsApiClient!)
            position.externalId = msg.externalId
            this.positions.set(msg.externalId, position)
            const key = `${msg.instrumentType}-${msg.internalId}`
            this.positionsIds.set(key, msg.externalId)
        }

        const position = this.positions.get(msg.externalId)!
        position.syncFromResponse(msg)
        this.onUpdatePositionObserver.notify(position)

        if (isNewPosition) {
            this.subscribePositions()
        }

        if (!position.active && position.activeId) {
            this.actives!.getActive(position.activeId).then((active) => {
                position.active = active
            })
        }

        if (position.status === "closed") {
            this.positions.delete(msg.externalId)
            this.positionsIds.delete(`${msg.instrumentType}-${msg.internalId}`)
            this.positionsHistory.unshift(position)
        }
    }

    /**
     * Updates instance from DTO.
     * @param position - Position object.
     * @private
     */
    private syncPosition(position: Position): void {
        const isNewPosition = !this.positions.has(position.externalId!)
        if (isNewPosition) {
            this.positions.set(position.externalId!, position)
            const key = `${position.instrumentType}-${position.internalId}`
            this.positionsIds.set(key, position.externalId!)
        }

        this.onUpdatePositionObserver.notify(position)

        if (isNewPosition) {
            this.subscribePositions()
        }

        if (!position.active && position.activeId) {
            this.actives!.getActive(position.activeId).then((active) => {
                position.active = active
            })
        }

        if (position.status === "closed") {
            this.positions.delete(position.externalId!)
            this.positionsIds.delete(`${position.instrumentType}-${position.internalId}`)
            this.positionsHistory.unshift(position)
        }
    }

    /**
     * Updates instance from DTO.
     * @param msg - Position data transfer object.
     * @private
     */
    private syncPositionFromEvent(msg: PortfolioPositionChangedV3): void {
        const isNewPosition = !this.positions.has(msg.externalId)
        if (isNewPosition) {
            const position = new Position(this.wsApiClient!)
            position.externalId = msg.externalId
            this.positions.set(msg.externalId, position)
            const key = `${msg.instrumentType}-${msg.internalId}`
            this.positionsIds.set(key, msg.externalId)
        }

        const position = this.positions.get(msg.externalId)!
        position.syncFromEvent(msg)
        this.onUpdatePositionObserver.notify(position)

        if (isNewPosition) {
            this.subscribePositions()
        }

        if (!position.active && position.activeId) {
            this.actives!.getActive(position.activeId).then((active) => {
                position.active = active
            })
        }

        if (position.status === "closed") {
            this.positions.delete(msg.externalId)
            this.positionsIds.delete(`${msg.instrumentType}-${msg.internalId}`)
            this.positionsHistory.unshift(position)
        }
    }

    private subscribePositions(): void {
        const internalIds: string[] = [];
        for (const position of this.positions.values()) {
            if (position.status === "open") {
                internalIds.push(position.internalId!)
            }
        }

        this.wsApiClient!.doRequest<Result>(new CallPortfolioSubscribePositions("frequent", internalIds)).then(() => {
        })
    }

    /**
     * Closes the instance.
     */
    public close() {
        if (this.intervalId) {
            clearInterval(this.intervalId)
        }
    }
}

/**
 * Don't use this class directly from your code. Use the following methods instead:
 *
 * * {@link ClientSdk.orders}
 *
 * Orders facade class. Stores information about opened orders. Keeps order's information up to date.
 */
export class Orders {
    /**
     * Orders current state.
     * @private
     */
    private orders: Map<number, Order> = new Map<number, Order>()

    /**
     * Orders updates observer.
     * @private
     */
    private onUpdateOrderObserver: Observable<Order> = new Observable<Order>()

    /**
     * Instance of WebSocket API client.
     * @private
     */
    private wsApiClient: WsApiClient | undefined

    /**
     * List of supported instrument types.
     * @private
     */
    private instrumentTypes: string[] = ["digital-option", "marginal-cfd", "marginal-crypto", "marginal-forex"]


    /**
     * Just private constructor. Just private constructor. Use {@link Orders.create create} instead.
     * @internal
     * @private
     */
    private constructor() {
    }

    /**
     * Subscribes on opened order's updates, requests current state of opened order's, puts the current state to instance of class Orders and returns it.
     * @param wsApiClient - Instance of WebSocket API client.
     * @param userId
     * @param balanceIds
     */
    public static async create(wsApiClient: WsApiClient, userId: number, balanceIds: number[]): Promise<Orders> {
        const ordersFacade = new Orders()
        ordersFacade.wsApiClient = wsApiClient

        for (const index in ordersFacade.instrumentTypes) {
            await ordersFacade.subscribeOrderChanged(userId, ordersFacade.instrumentTypes[index])
        }

        for (const index in balanceIds) {
            await ordersFacade.syncOldActiveOrders(balanceIds[index])
        }

        return ordersFacade
    }

    /**
     * Subscribes on order's updates.
     *
     * @private
     */
    private async subscribeOrderChanged(userId: number, instrumentType: string): Promise<void> {
        await this.wsApiClient!.subscribe<PortfolioOrderChangedV2>(
            new SubscribePortfolioOrderChangedV2(userId, instrumentType),
            (event: PortfolioOrderChangedV2) => {
                if (event.instrumentType === instrumentType) {
                    this.syncOrderFromEvent(event)
                }
            }
        );
    }

    /**
     * Synchronizes old active orders.
     * @private
     */
    private async syncOldActiveOrders(userBalanceId: number): Promise<void> {
        const ordersPage = await this.wsApiClient!.doRequest<PortfolioOrdersV2>(
            new CallPortfolioGetOrdersV2(userBalanceId)
        )

        for (const index in ordersPage.orders) {
            this.syncOrderFromResponse(ordersPage.orders[index])
        }
    }

    /**
     * Returns list of all orders.
     */
    public getAllOrders(): Order[] {
        const list = []

        for (const [index] of this.orders) {
            list.push(this.orders.get(index)!)
        }

        return list
    }

    /**
     * Checks if a given position associated with an order.
     * @param position
     * @param order
     */
    public isPositionMatchingOrder(position: Position, order: Order): boolean {
        return order.positionId === position.internalId
    }

    /**
     * Adds specified callback to order update subscribers' list.
     * @param callback - Callback will be called for every change of order.
     */
    public subscribeOnUpdateOrder(callback: CallbackForOrderUpdate): void {
        this.onUpdateOrderObserver.subscribe(callback)
    }

    /**
     * Removes specified callback from order update subscribers' list.
     * @param callback - Callback for remove.
     */
    public unsubscribeOnUpdateOrder(callback: CallbackForOrderUpdate): void {
        this.onUpdateOrderObserver.unsubscribe(callback)
    }

    /**
     * Updates instance from DTO.
     * @param msg - Order data transfer object.
     * @private
     */
    private syncOrderFromResponse(msg: PortfolioOrdersV2Order): void {
        if (msg.id === undefined) {
            return
        }

        const isNewOrder = !this.orders.has(msg.id)
        if (isNewOrder) {
            const order = new Order(this.wsApiClient!)
            this.orders.set(msg.id, order)
        }

        const order = this.orders.get(msg.id)!
        order.syncFromResponse(msg)
        this.onUpdateOrderObserver.notify(order)
    }

    /**
     * Updates instance from DTO.
     * @param msg - Order data transfer object.
     * @private
     */
    private syncOrderFromEvent(msg: PortfolioOrderChangedV2): void {
        if (msg.id === undefined) {
            return
        }

        const isNewOrder = !this.orders.has(msg.id)
        if (isNewOrder) {
            const order = new Order(this.wsApiClient!)
            this.orders.set(msg.id, order)
        }

        const order = this.orders.get(msg.id)!
        order.syncFromEvent(msg)
        this.onUpdateOrderObserver.notify(order)

        if (order.status === "filled" || order.status === "canceled" || order.status === "rejected") {
            this.orders.delete(msg.id)
        }
    }
}

export class Order {
    /**
     * Order's identification number.
     */
    public id: number | undefined

    /**
     * Order status.
     */
    public status: string | undefined

    /**
     * Instrument type.
     */
    public instrumentType: string | undefined

    /**
     * Kind of order.
     */
    public kind: string | undefined

    /**
     * Order position ID.
     */
    public positionId: string | undefined

    /**
     * User ID.
     */
    public userId: number | undefined

    /**
     * User's balance ID.
     */
    public userBalanceId: number | undefined

    /**
     * Instance of WebSocket API client.
     * @private
     */
    private wsApiClient: WsApiClient

    constructor(wsApiClient: WsApiClient) {
        this.wsApiClient = wsApiClient
    }

    /**
     * Synchronises order from DTO.
     * @param msg - Order data transfer object.
     * @private
     */
    syncFromResponse(msg: PortfolioOrdersV2Order): void {
        this.id = msg.id
        this.status = msg.status
        this.positionId = msg.positionId
        this.instrumentType = msg.instrumentType
        this.kind = msg.kind
        this.userId = msg.userId
        this.userBalanceId = msg.userBalanceId
    }

    /**
     * Synchronises order from DTO.
     * @param msg - Order data transfer object.
     * @private
     */
    syncFromEvent(msg: PortfolioOrderChangedV2): void {
        this.id = msg.id
        this.status = msg.status
        this.positionId = msg.positionId
        this.instrumentType = msg.instrumentType
        this.kind = msg.kind
        this.userId = msg.userId
        this.userBalanceId = msg.userBalanceId
    }

    public async cancel(): Promise<void> {
        if (!this.id) {
            throw new Error('Order id is not set')
        }

        switch (this.instrumentType) {
            case "marginal-cfd":
                await this.wsApiClient.doRequest<Result>(new CallMarginCancelPendingOrderV1("cfd", this.id))
                break
            case "marginal-crypto":
                await this.wsApiClient.doRequest<Result>(new CallMarginCancelPendingOrderV1("crypto", this.id))
                break
            case "marginal-forex":
                await this.wsApiClient.doRequest<Result>(new CallMarginCancelPendingOrderV1("forex", this.id))
                break
            default:
                throw new Error(`Unsupported instrument type '${this.instrumentType}'`)
        }
    }
}

/**
 * Callback for handle position's update.
 */
export type CallbackForOrderUpdate = (order: Order) => void

class PositionsHistory {
    /**
     * Positions history.
     * @private
     */
    private readonly positions: Position[]

    /**
     * User ID.
     * @private
     */
    private readonly userId: number

    /**
     * Instance of WebSocket API client.
     * @private
     */
    private readonly wsApiClient: WsApiClient

    /**
     * Start time for positions history.
     * @private
     */
    private startTime: number | undefined

    /**
     * Limit of positions per page.
     * @private
     */
    private readonly limit: number = 30

    /**
     * Offset for positions history.
     * @private
     */
    private offset: number = 0

    /**
     * Flag for previous page.
     * @private
     */
    private prevPage: boolean = true

    constructor(wsApiClient: WsApiClient, userId: number, positions: Position[]) {
        this.wsApiClient = wsApiClient
        this.userId = userId
        this.positions = positions
    }

    /**
     * Fetches previous page of positions history.
     */
    public async fetchPrevPage() {
        if (!this.startTime) {
            this.startTime = Math.trunc(this.wsApiClient.currentTime.unixMilliTime / 1000)
        }

        const positionsPage = await this.wsApiClient.doRequest<PortfolioPositionsHistoryV2>(
            new CallPortfolioGetHistoryPositionsV2(
                {
                    userId: this.userId,
                    limit: this.limit,
                    offset: this.offset,
                    end: this.startTime,
                    instrumentTypes: ["digital-option", "binary-option", "turbo-option", "blitz-option"],
                }
            )
        )

        for (const index in positionsPage.positions) {
            const position = new Position(this.wsApiClient)
            position.syncFromHistoryResponse(positionsPage.positions[index])
            this.positions.push(position)
        }

        if (positionsPage.positions.length < positionsPage.limit) {
            this.prevPage = false
        }

        this.offset += this.limit
    }

    public async getPositionHistory(externalId: number): Promise<Position | undefined> {
        const positionsPage = await this.wsApiClient.doRequest<PortfolioPositionsHistoryV2>(
            new CallPortfolioGetHistoryPositionsV2(
                {
                    instrumentTypes: ["digital-option", "binary-option", "turbo-option", "blitz-option"],
                    externalId: externalId,
                }
            )
        )

        if (positionsPage.positions.length === 0) {
            return undefined
        }

        const position = new Position(this.wsApiClient)
        position.syncFromHistoryResponse(positionsPage.positions[0])
        this.positions.push(position)

        return position
    }

    /**
     * Checks if previous page exists.
     */
    public hasPrevPage(): boolean {
        return this.prevPage
    }

    /**
     * Returns list of loaded pages of positions history.
     *
     * Note: call after {@link fetchPrevPage} method.
     */
    public getPositions(): Position[] {
        const positions = [];
        for (let i = 0; i < this.positions.length; i += 1) {
            positions[i] = this.positions[i];
        }

        return positions
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
     * Position's identification number ( position external ID ).
     */
    public externalId: number | undefined

    /**
     * Position's internal ID. ( Positions across different instrument types can have the same internal_id )
     */
    public internalId: string | undefined

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
     * Current quote price.
     */
    public currentQuote: number | undefined

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
     * Expected PnL Net for the position.
     */
    public pnlNet: number | undefined

    /**
     * PnL with which the position was closed.
     */
    public pnlRealized: number | undefined

    /**
     * Quote time at which the position was opened.
     */
    public quoteTimestamp: Date | undefined

    /**
     * Current quote time.
     */
    public currentQuoteTimestamp: Date | undefined

    /**
     * Position's status.
     */
    public status: string | undefined

    /**
     * Position's user ID.
     */
    public userId: number | undefined

    /**
     * Realized profit from selling the position at this moment.
     */
    public sellProfit: number | undefined

    /**
     * List of order IDs.
     */
    public orderIds: number[] = []

    /**
     * Active information.
     */
    public active: Active | undefined

    /**
     * Expiration time for the position.
     */
    public expirationTime: Date | undefined

    /**
     * Direction of the position.
     */
    public direction: string | undefined

    /**
     * Version of position. Used for filter old versions of position's state.
     * @private
     */
    private version: number | undefined

    /**
     * Instance of WebSocket API client.
     * @private
     */
    private wsApiClient: WsApiClient

    constructor(wsApiClient: WsApiClient) {
        this.wsApiClient = wsApiClient
    }

    /**
     * Synchronises position from DTO.
     * @param msg - Position data transfer object.
     * @private
     */
    syncFromResponse(msg: PortfolioPositionsV4Position): void {
        this.externalId = msg.externalId
        this.internalId = msg.internalId
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
        this.orderIds = msg.orderIds
        this.direction = msg.direction
        this.expirationTime = msg.expirationTime !== undefined ? new Date(msg.expirationTime) : undefined
    }

    /**
     * Synchronises position from DTO.
     * @param msg - Position data transfer object.
     * @private
     */
    syncFromHistoryResponse(msg: PortfolioPositionsHistoryV2Position): void {
        this.externalId = msg.externalId
        this.internalId = msg.internalId
        this.activeId = msg.activeId
        this.balanceId = msg.userBalanceId
        this.instrumentType = msg.instrumentType
        this.invest = msg.invest
        this.openQuote = msg.openQuote
        this.openTime = new Date(msg.openTime)
        this.closeProfit = msg.closeProfit
        this.closeQuote = msg.closeQuote
        this.closeReason = msg.closeReason
        this.closeTime = msg.closeTime !== undefined ? new Date(msg.closeTime) : undefined
        this.pnl = msg.pnl
        this.pnlRealized = msg.pnlRealized
        this.pnlNet = msg.pnlNet
        this.status = msg.status
        this.userId = msg.userId
        this.orderIds = msg.orderIds
        this.direction = msg.direction
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
        this.internalId = msg.internalId
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
        this.orderIds = msg.orderIds
        this.direction = msg.direction
        this.expirationTime = msg.expirationTime !== undefined ? new Date(msg.expirationTime) : undefined
    }

    /**
     * Synchronises position from DTO.
     * @param msg - Position state data transfer object.
     * @private
     */
    syncFromStateEvent(msg: PortfolioPositionsStateV1Position): void {
        this.sellProfit = msg.sellProfit
        this.currentQuote = msg.currentPrice
        this.currentQuoteTimestamp = msg.quoteTimestamp !== undefined ? new Date(msg.quoteTimestamp) : undefined
        this.pnl = msg.pnl
        this.pnlNet = msg.pnlNet
        this.expectedProfit = msg.expectedProfit
    }

    public async sell(): Promise<void> {
        let promise: Promise<Result>
        switch (this.instrumentType) {
            case InstrumentType.TurboOption:
            case InstrumentType.BinaryOption:
                promise = this.wsApiClient.doRequest(new CallBinaryOptionsSellOptionsV3([this.externalId!]))
                break
            case InstrumentType.DigitalOption:
                promise = this.wsApiClient.doRequest(new CallDigitalOptionsClosePositionV1(this.externalId!))
                break
            case InstrumentType.BlitzOption:
                throw new Error("Blitz options are not supported")
            case InstrumentType.MarginCfd:
                promise = this.wsApiClient.doRequest(new CallMarginClosePositionV1("cfd", this.externalId!))
                break
            case InstrumentType.MarginCrypto:
                promise = this.wsApiClient.doRequest(new CallMarginClosePositionV1("crypto", this.externalId!))
                break
            case InstrumentType.MarginForex:
                promise = this.wsApiClient.doRequest(new CallMarginClosePositionV1("forex", this.externalId!))
                break
            default:
                throw new Error(`Unknown instrument type ${this.instrumentType}`)
        }

        const result = await promise
        if (!result.success) {
            throw new Error(result.reason)
        }
    }
}

/**
 * Don't use this class directly from your code. Use {@link ClientSdk.blitzOptions} static method instead.
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
     * Timer for periodical actives list update.
     * @private
     */
    private intervalId: NodeJS.Timeout | undefined

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
        const initializationData = await wsApiClient.doRequest<InitializationDataV3>(new CallBinaryOptionsGetInitializationDataV3())

        const blitzOptions = new BlitzOptions(initializationData.blitzActives, wsApiClient)

        blitzOptions.intervalId = setInterval(async () => {
            const response = await wsApiClient.doRequest<InitializationDataV3>(new CallBinaryOptionsGetInitializationDataV3())
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
        const request = new CallBinaryOptionsOpenBlitzOptionV2(
            active.id,
            direction,
            expirationSize,
            price,
            balance.id,
            100 - active.profitCommissionPercent,
        )
        const response = await this.wsApiClient.doRequest<BinaryOptionsOptionV1>(request)
        return new BlitzOptionsOption(response)
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

    /**
     * Closes the instance.
     */
    public close() {
        if (this.intervalId) {
            clearInterval(this.intervalId)
        }
    }
}

/**
 * Instrument types.
 */
export enum InstrumentType {
    BinaryOption = "binary-option",
    DigitalOption = "digital-option",
    TurboOption = "turbo-option",
    BlitzOption = "blitz-option",
    MarginForex = "marginal-forex",
    MarginCfd = "marginal-cfd",
    MarginCrypto = "marginal-crypto",
}

/**
 * Margin Trading TPSL types.
 */
export enum MarginTradingTPSLType {
    Price = "price",
    Pips = "pips",
    Delta = "delta",
    Pnl = "pnl",
}

/**
 * Margin Trading TPSL class.
 */
export class MarginTradingTPSL {
    public readonly type: string
    public readonly value: number

    constructor(type: string, value: number) {
        this.type = type
        this.value = value
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
 * Don't use this class directly from your code. Use {@link ClientSdk.turboOptions} static method instead.
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
     * Timer for periodical actives list update.
     * @private
     */
    private intervalId: NodeJS.Timeout | undefined

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
        const initializationData = await wsApiClient.doRequest<InitializationDataV3>(new CallBinaryOptionsGetInitializationDataV3())

        const turboOptions = new TurboOptions(initializationData.turboActives, wsApiClient)

        turboOptions.intervalId = setInterval(async () => {
            const response = await wsApiClient.doRequest<InitializationDataV3>(new CallBinaryOptionsGetInitializationDataV3())
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
        const request = new CallBinaryOptionsOpenTurboOptionV2(
            instrument.activeId,
            Math.trunc(instrument.expiredAt.getTime() / 1000),
            direction,
            price,
            balance.id,
            100 - instrument.profitCommissionPercent,
        )
        const response = await this.wsApiClient.doRequest<BinaryOptionsOptionV1>(request)
        return new TurboOptionsOption(response)
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

    /**
     * Closes the instance.
     */
    public close() {
        if (this.intervalId) {
            clearInterval(this.intervalId)
        }

        this.actives.forEach((active) => {
            active.close()
        })
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

    /**
     * Checks whether an option on an active can be purchased at a specified time.
     * @param at - Time for which the check is performed.
     */
    public canBeBoughtAt(at: Date): boolean {
        if (this.isSuspended) {
            return false
        }

        const atUnixTimeMilli = at.getTime()
        return this.schedule.findIndex((session: TurboOptionsActiveTradingSession): boolean => {
            return session.from.getTime() <= atUnixTimeMilli && session.to.getTime() >= atUnixTimeMilli
        }) >= 0
    }

    /**
     * Closes the instance.
     */
    public close() {
        if (this.instrumentsFacade) {
            this.instrumentsFacade.close()
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
     * Timer for periodical actives list update.
     * @private
     */
    private intervalId: NodeJS.Timeout | undefined

    /**
     * Creates class instance.
     * @param active - Active.
     * @param currentTime - An object with the current time obtained from WebSocket API.
     * @internal
     * @private
     */
    private constructor(
        private active: TurboOptionsActive,
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
            active,
            currentTime,
        )

        instrumentsFacade.generateInstruments()

        instrumentsFacade.intervalId = setInterval((): void => {
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
        if (!this.active.canBeBoughtAt(new Date(this.currentTime.unixMilliTime))) {
            return
        }

        const generatedInstrumentsKeys = []
        const nowUnixTime = Math.trunc(this.currentTime.unixMilliTime / 1000)

        for (const index in this.active.expirationTimes) {
            const expirationSize = this.active.expirationTimes[index]
            let instrumentExpirationUnixTime = nowUnixTime + expirationSize - nowUnixTime % expirationSize
            for (let i = 0; i < this.active.optionCount; i++) {
                const key = `${this.active.id},${expirationSize},${instrumentExpirationUnixTime}`
                generatedInstrumentsKeys.push(key)
                if (!this.instruments.has(key)) {
                    this.instruments.set(key,
                        new TurboOptionsActiveInstrument(
                            this.active.id,
                            expirationSize,
                            new Date(instrumentExpirationUnixTime * 1000),
                            this.active.deadtime,
                            this.active.profitCommissionPercent,
                        )
                    )
                } else {
                    this.instruments.get(key)!.update(this.active.deadtime)
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

    /**
     * Closes the instance.
     */
    public close() {
        if (this.intervalId) {
            clearInterval(this.intervalId)
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
     * @param profitCommissionPercent - The commission is taken from 100% of the profit. Therefore, income percent can be calculated using the following formula: `profitIncomePercent=100-profitCommissionPercent`.
     * @internal
     * @private
     */
    public constructor(
        public readonly activeId: number,
        public readonly expirationSize: number,
        public readonly expiredAt: Date,
        public deadtime: number,
        public profitCommissionPercent: number,
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
        return new Date(this.expiredAt.getTime() - this.deadtime * 1000);
    }

    /**
     * Returns the remaining duration in milliseconds for which it is possible to purchase options.
     * @param {Date} currentTime - The current time.
     * @returns {number} - The remaining duration in milliseconds.
     */
    public durationRemainingForPurchase(currentTime: Date): number {
        return this.purchaseEndTime().getTime() - currentTime.getTime();
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
 * Don't use this class directly from your code. Use {@link ClientSdk.binaryOptions} static method instead.
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
     * Timer for periodical actives list update.
     * @private
     */
    private intervalId: NodeJS.Timeout | undefined

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
        const initializationData = await wsApiClient.doRequest<InitializationDataV3>(new CallBinaryOptionsGetInitializationDataV3())

        const binaryOptions = new BinaryOptions(initializationData.binaryActives, wsApiClient)

        binaryOptions.intervalId = setInterval(async () => {
            const response = await wsApiClient.doRequest<InitializationDataV3>(new CallBinaryOptionsGetInitializationDataV3())
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
        const request = new CallBinaryOptionsOpenBinaryOptionV2(
            instrument.activeId,
            Math.trunc(instrument.expiredAt.getTime() / 1000),
            direction,
            price,
            balance.id,
            100 - instrument.profitCommissionPercent,
        )
        const response = await this.wsApiClient.doRequest<BinaryOptionsOptionV1>(request)
        return new BinaryOptionsOption(response)
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

    /**
     * Closes the instance.
     */
    public close() {
        if (this.intervalId) {
            clearInterval(this.intervalId)
        }

        this.actives.forEach((active) => {
            active.close()
        })
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

    /**
     * Checks whether an option on an active can be purchased at a specified time.
     * @param at - Time for which the check is performed.
     */
    public canBeBoughtAt(at: Date): boolean {
        if (this.isSuspended) {
            return false
        }

        const atUnixTimeMilli = at.getTime()
        return this.schedule.findIndex((session: BinaryOptionsActiveTradingSession): boolean => {
            return session.from.getTime() <= atUnixTimeMilli && session.to.getTime() >= atUnixTimeMilli
        }) >= 0
    }

    /**
     * Closes the instance.
     */
    public close() {
        if (this.instrumentsFacade) {
            this.instrumentsFacade.close()
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
     * Timer for periodical actives list update.
     * @private
     */
    private intervalId: NodeJS.Timeout | undefined

    /**
     * Creates class instance.
     * @param active - Active.
     * @param currentTime - An object with the current time obtained from WebSocket API.
     * @internal
     * @private
     */
    private constructor(
        private active: BinaryOptionsActive,
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
            active,
            currentTime,
        )

        instrumentsFacade.generateInstruments()

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

    private scheduleNextGeneration(): void {
        let nextGenerationTime: number | null = null;
        const now = this.currentTime.unixMilliTime

        for (const instrument of this.instruments.values()) {
            const triggerTime = instrument.expiredAt.getTime() - instrument.deadtime * 1000;
            if (triggerTime > now && (nextGenerationTime === null || triggerTime < nextGenerationTime)) {
                nextGenerationTime = triggerTime;
            }
        }

        if (nextGenerationTime !== null) {
            const delay = nextGenerationTime - now;
            this.intervalId = setTimeout(() => this.generateInstruments(), delay);
        } else {
            this.intervalId = setTimeout(() => this.generateInstruments(), 30000);
        }
    }

    /**
     * Generates instruments.
     * @private
     */
    private generateInstruments(): void {
        if (!this.active.canBeBoughtAt(new Date(this.currentTime.unixMilliTime))) {
            this.intervalId = setTimeout(() => this.generateInstruments(), 30000);

            return
        }

        const generatedInstrumentsKeys = []
        const nowUnixTime = Math.trunc(this.currentTime.unixMilliTime / 1000)

        for (const index in this.active.expirationTimes) {
            const expirationSize = this.active.expirationTimes[index]
            let instrumentExpirationUnixTime = nowUnixTime + expirationSize - nowUnixTime % expirationSize
            if (instrumentExpirationUnixTime - this.active.deadtime < nowUnixTime) {
                instrumentExpirationUnixTime += expirationSize
            }

            for (let i = 0; i < this.active.optionCount; i++) {
                const key = `${this.active.id},${expirationSize},${instrumentExpirationUnixTime}`
                generatedInstrumentsKeys.push(key)
                if (!this.instruments.has(key)) {
                    this.instruments.set(key,
                        new BinaryOptionsActiveInstrument(
                            this.active.id,
                            expirationSize,
                            new Date(instrumentExpirationUnixTime * 1000),
                            this.active.deadtime,
                            this.active.profitCommissionPercent,
                        )
                    )
                }
                this.instruments.get(key)!.update(this.active.deadtime)
                instrumentExpirationUnixTime += expirationSize
            }
        }

        for (const index in this.active.optionSpecial) {
            const specialInstrument = this.active.optionSpecial[index]
            if (!specialInstrument.isEnabled) {
                continue
            }
            const expirationSize = specialInstrument.title
            const key = `${this.active.id},${expirationSize},${specialInstrument.expiredAt.toISOString()}`
            generatedInstrumentsKeys.push(key)
            if (!this.instruments.has(key)) {
                this.instruments.set(key,
                    new BinaryOptionsActiveInstrument(
                        this.active.id,
                        expirationSize,
                        specialInstrument.expiredAt,
                        this.active.deadtime,
                        this.active.profitCommissionPercent,
                    )
                )
            }
            this.instruments.get(key)!.update(this.active.deadtime)
        }

        for (const index in this.instruments) {
            if (!generatedInstrumentsKeys.includes(index)) {
                this.instruments.delete(index)
            }
        }

        this.scheduleNextGeneration()
    }

    /**
     * Closes the instance.
     */
    public close() {
        if (this.intervalId) {
            clearInterval(this.intervalId)
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
     * @param profitCommissionPercent - The commission is taken from 100% of the profit. Therefore, income percent can be calculated using the following formula: `profitIncomePercent=100-profitCommissionPercent`.
     * @internal
     * @private
     */
    public constructor(
        public readonly activeId: number,
        public readonly expirationSize: number | string,
        public readonly expiredAt: Date,
        public deadtime: number,
        public profitCommissionPercent: number,
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
        return new Date(this.expiredAt.getTime() - this.deadtime * 1000);
    }

    /**
     * Returns the remaining duration in milliseconds for which it is possible to purchase options.
     * @param {Date} currentTime - The current time.
     * @returns {number} - The remaining duration in milliseconds.
     */
    public durationRemainingForPurchase(currentTime: Date): number {
        return this.purchaseEndTime().getTime() - currentTime.getTime();
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
 * Don't use this class directly from your code. Use {@link ClientSdk.digitalOptions} static method instead.
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
    private constructor(underlyingList: DigitalOptionInstrumentsUnderlyingListV3, wsApiClient: WsApiClient) {
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
        const request = new SubscribeDigitalOptionInstrumentsUnderlyingListChangedV3()
        await wsApiClient.subscribe<DigitalOptionInstrumentsUnderlyingListChangedV3>(request, (event) => {
            if (event.type !== 'digital-option') {
                return
            }
            digitalOptionsFacade.updateUnderlyings(event)
        })
        const underlyingList = await wsApiClient.doRequest<DigitalOptionInstrumentsUnderlyingListV3>(new CallDigitalOptionInstrumentsGetUnderlyingListV3(true))
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
        const request = new CallDigitalOptionsPlaceDigitalOptionV3(
            instrument.assetId,
            strike.symbol,
            instrument.index,
            amount,
            balance.id
        )
        const response = await this.wsApiClient.doRequest<DigitalOptionPlacedV3>(request)
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
     * Updates instance from DTO.
     * @param msg - Underlyings data transfer object.
     * @private
     */
    private updateUnderlyings(msg: DigitalOptionInstrumentsUnderlyingListChangedV3): void {
        for (const index in msg.underlying) {
            const underlying = msg.underlying[index]
            if (this.underlyings.has(underlying.activeId)) {
                this.underlyings.get(underlying.activeId)!.update(underlying)
            } else {
                this.underlyings.set(underlying.activeId, new DigitalOptionsUnderlying(underlying, this.wsApiClient))
            }
        }
    }

    /**
     * Closes the instance.
     */
    public close() {
        this.underlyings.forEach((underlying) => {
            underlying.close()
        })
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
 * Margin direction.
 */
export enum MarginDirection {
    Buy = 'buy',
    Sell = 'sell',
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
    public constructor(msg: DigitalOptionInstrumentsUnderlyingListV3Underlying, wsApiClient: WsApiClient) {
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
    update(msg: DigitalOptionInstrumentsUnderlyingListChangedV3Underlying): void {
        this.isSuspended = msg.isSuspended
        this.name = msg.name

        this.schedule = []
        for (const index in msg.schedule) {
            const session = msg.schedule[index];
            this.schedule.push(new DigitalOptionsUnderlyingTradingSession(session.open, session.close))
        }
    }

    /**
     * Closes the instance.
     */
    public close() {
        if (this.instrumentsFacade) {
            this.instrumentsFacade.close()
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
     * Instance of WebSocket API client.
     * @private
     */
    private wsApiClient: WsApiClient | undefined

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
        instrumentsFacade.wsApiClient = wsApiClient

        await wsApiClient.subscribe<DigitalOptionInstrumentsInstrumentGeneratedV3>(
            new SubscribeDigitalOptionInstrumentsInstrumentGeneratedV3(assetId), (event) => {
                if (event.instrumentType !== 'digital-option' || event.assetId !== assetId) {
                    return
                }
                instrumentsFacade.syncInstrumentFromEvent(event)
            })

        const instruments = await wsApiClient.doRequest<DigitalOptionInstrumentsInstrumentsV3>(new CallDigitalOptionInstrumentsGetInstrumentsV3(assetId))
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
    private syncInstrumentFromEvent(msg: DigitalOptionInstrumentsInstrumentGeneratedV3) {
        if (!this.instruments.has(msg.index)) {
            this.instruments.set(msg.index, new DigitalOptionsUnderlyingInstrument(msg, this.wsApiClient!))
        } else {
            this.instruments.get(msg.index)!.sync(msg)
        }
    }

    /**
     * Updates the instance from DTO.
     * @param msg - Instruments data transfer object.
     * @private
     */
    private syncInstrumentsFromResponse(msg: DigitalOptionInstrumentsInstrumentsV3) {
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
    private syncInstrumentFromResponse(msg: DigitalOptionInstrumentsInstrumentsV3Instrument) {
        if (!this.instruments.has(msg.index)) {
            this.instruments.set(msg.index, new DigitalOptionsUnderlyingInstrument(msg, this.wsApiClient!))
        } else {
            this.instruments.get(msg.index)!.sync(msg)
        }
    }

    /**
     * Closes the instance.
     */
    public close() {
        this.instruments.forEach((instrument) => {
            instrument.close()
        })
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
    public strikes: Map<string, DigitalOptionsUnderlyingInstrumentStrike> = new Map<string, DigitalOptionsUnderlyingInstrumentStrike>()


    /**
     * Instance of WebSocket API client.
     * @private
     */
    private readonly wsApiClient: WsApiClient

    /**
     * Timer for periodical actives list update.
     * @private
     */
    private intervalId: NodeJS.Timeout | undefined

    /**
     * Creates instance from DTO.
     * @param msg - Instrument data transfer object.
     * @param wsApiClient
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
    }, wsApiClient: WsApiClient) {
        this.wsApiClient = wsApiClient
        this.assetId = msg.assetId
        this.deadtime = msg.deadtime
        this.expiration = new Date(msg.expiration * 1000)
        this.index = msg.index
        this.instrumentType = msg.instrumentType
        this.period = msg.period
        for (const index in msg.data) {
            this.strikes.set(msg.data[index].symbol, new DigitalOptionsUnderlyingInstrumentStrike(msg.data[index]))
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
        for (const strike of this.strikes.values()) {
            if (strike.price === price && strike.direction === direction) {
                return strike;
            }
        }

        throw new Error(`Strike with price '${price}' and direction '${direction}' is not found`)
    }

    /**
     * Returns the time until which it is possible to open trades that will fall into the current expiration.
     * @returns {Date}
     */
    public purchaseEndTime(): Date {
        return new Date(this.expiration.getTime() - this.deadtime * 1000);
    }

    /**
     * Subscribes on strikes ask/bid prices updates.
     */
    public async subscribeOnStrikesAskBidPrices() {
        const request = new SubscribeTradingSettingsDigitalOptionClientPriceGeneratedV1('digital-option', this.assetId, this.index)
        await this.wsApiClient.subscribe<DigitalOptionClientPriceGeneratedV1>(request, (event) => {
            this.syncAskBidPricesFromEvent(event)
        })

        this.intervalId = setInterval(() => {
            if (this.wsApiClient.currentTime.unixMilliTime >= this.expiration.getTime()) {
                this.wsApiClient.unsubscribe<DigitalOptionClientPriceGeneratedV1>(request)
                clearInterval(this.intervalId);
            }
        }, 1000);
    }

    /**
     * Returns the remaining duration in milliseconds for which it is possible to purchase options.
     * @param {Date} currentTime - The current time.
     * @returns {number} - The remaining duration in milliseconds.
     */
    public durationRemainingForPurchase(currentTime: Date): number {
        return this.purchaseEndTime().getTime() - currentTime.getTime();
    }

    /**
     * Updates the instance from DTO.
     * @param msg - Instrument data transfer object.
     */
    sync(msg: DigitalOptionInstrumentsInstrumentGeneratedV3): void {
        this.assetId = msg.assetId
        this.deadtime = msg.deadtime
        this.expiration = new Date(msg.expiration * 1000)
        this.instrumentType = msg.instrumentType
        this.period = msg.period
        this.strikes = new Map<string, DigitalOptionsUnderlyingInstrumentStrike>()
        for (const index in msg.data) {
            this.strikes.set(msg.data[index].symbol, new DigitalOptionsUnderlyingInstrumentStrike(msg.data[index]))
        }
    }

    private syncAskBidPricesFromEvent(msg: DigitalOptionClientPriceGeneratedV1): void {
        msg.prices.map((price) => {
            const callSymbol = this.strikes.get(price.call.symbol)
            if (callSymbol) {
                callSymbol.ask = price.call.ask
                callSymbol.bid = price.call.bid
            }

            const putSymbol = this.strikes.get(price.put.symbol)
            if (putSymbol) {
                putSymbol.ask = price.put.ask
                putSymbol.bid = price.put.bid
            }
        })
    }

    /**
     * Closes the instance.
     */
    public close() {
        if (this.intervalId) {
            clearInterval(this.intervalId)
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
     * Ask price.
     */
    public ask?: number

    /**
     * Bid price.
     */
    public bid?: number

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
    public constructor(msg: DigitalOptionPlacedV3) {
        this.id = msg.id
    }
}

/**
 * Margin order class.
 */
export class MarginOrder {
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
    public constructor(msg: MarginOrderPlacedV1) {
        this.id = msg.id
    }
}

export class MarginForex {
    /**
     * Instance of WebSocket API client.
     * @private
     */
    private readonly wsApiClient: WsApiClient

    /**
     * Underlyings current state.
     * @private
     */
    private underlyings: Map<number, MarginUnderlying> = new Map<number, MarginUnderlying>()

    /**
     * Creates instance from DTO.
     * @param underlyingList - Underlyings data transfer object.
     * @param wsApiClient - Instance of WebSocket API client.
     * @internal
     * @private
     */
    private constructor(underlyingList: MarginInstrumentsUnderlyingListV1, wsApiClient: WsApiClient) {
        this.wsApiClient = wsApiClient

        for (const index in underlyingList.items) {
            const underlying = underlyingList.items[index]
            this.underlyings.set(underlying.activeId, new MarginUnderlying(underlying, "forex", wsApiClient))
        }
    }

    /**
     * Subscribes on underlyings updates, requests current state of underlyings, puts the state into this class instance and returns it.
     * @param wsApiClient - Instance of WebSocket API client.
     */
    public static async create(wsApiClient: WsApiClient): Promise<MarginForex> {
        const request = new SubscribeMarginInstrumentsUnderlyingListChangedV1("forex")
        await wsApiClient.subscribe<MarginInstrumentsUnderlyingListChangedV1>(request, (event) => {
            marginForexFacade.updateUnderlyings(event)
        })
        const underlyingList = await wsApiClient.doRequest<MarginInstrumentsUnderlyingListV1>(
            new CallMarginInstrumentsGetUnderlyingListV1("forex")
        )
        const marginForexFacade = new MarginForex(underlyingList, wsApiClient)
        return marginForexFacade
    }

    /**
     * Makes request for buy margin active.
     * @param instrument - The instrument for which the option is purchased.
     * @param direction - Direction of price change.
     * @param count
     * @param balance - The balance from which the initial investment will be written off and upon successful closing of the position, profit will be credited to this balance.
     * @param stopLoss
     * @param takeProfit
     */
    public async buy(
        instrument: MarginUnderlyingInstrument,
        direction: MarginDirection,
        count: number,
        balance: Balance,
        stopLoss: MarginTradingTPSL | null = null,
        takeProfit: MarginTradingTPSL | null = null,
    ): Promise<MarginOrder> {
        const request = new CallMarginPlaceMarketOrderV1(
            direction,
            balance.id,
            count.toString(),
            instrument.id,
            instrument.activeId,
            instrument.calculateLeverageProfile(balance).toString(),
            "forex",
            stopLoss,
            takeProfit,
        )
        const response = await this.wsApiClient.doRequest<MarginOrderPlacedV1>(request)
        return new MarginOrder(response)
    }

    /**
     * Makes stop order request for buy margin active.
     * If the stop order price is on the opposite side of the current market price, it will be converted to a limit order.
     * @param instrument
     * @param direction
     * @param count
     * @param balance
     * @param stopPrice
     * @param takeProfit
     * @param stopLoss
     */
    public async buyStop(
        instrument: MarginUnderlyingInstrument,
        direction: MarginDirection,
        count: number,
        balance: Balance,
        stopPrice: number,
        stopLoss: MarginTradingTPSL | null = null,
        takeProfit: MarginTradingTPSL | null = null,
    ): Promise<MarginOrder> {
        const request = new CallMarginPlaceStopOrderV1(
            direction,
            balance.id,
            count.toString(),
            stopPrice.toString(),
            instrument.id,
            instrument.activeId,
            instrument.calculateLeverageProfile(balance).toString(),
            'forex',
            stopLoss,
            takeProfit,
        )
        const response = await this.wsApiClient.doRequest<MarginOrderPlacedV1>(request)
        return new MarginOrder(response)
    }

    /**
     * Makes limit order request for buy margin active.
     * If the limit order price is on the opposite side of the current market price, it will be converted to a stop order.
     * @param instrument
     * @param direction
     * @param count
     * @param balance
     * @param limitPrice
     * @param stopLoss
     * @param takeProfit
     */
    public async buyLimit(
        instrument: MarginUnderlyingInstrument,
        direction: MarginDirection,
        count: number,
        balance: Balance,
        limitPrice: number,
        stopLoss: MarginTradingTPSL | null = null,
        takeProfit: MarginTradingTPSL | null = null,
    ): Promise<MarginOrder> {
        const request = new CallMarginPlaceLimitOrderV1(
            direction,
            balance.id,
            count.toString(),
            limitPrice.toString(),
            instrument.id,
            instrument.activeId,
            instrument.calculateLeverageProfile(balance).toString(),
            'forex',
            stopLoss,
            takeProfit,
        )
        const response = await this.wsApiClient.doRequest<MarginOrderPlacedV1>(request)
        return new MarginOrder(response)
    }

    /**
     * Returns list of underlyings available for buy at specified time.
     * @param at - Time for which the check is performed.
     */
    public getUnderlyingsAvailableForTradingAt(at: Date): MarginUnderlying[] {
        const list = []
        for (const [activeId] of this.underlyings) {
            if (this.underlyings.get(activeId)!.isAvailableForTradingAt(at)) {
                list.push(this.underlyings.get(activeId)!)
            }
        }
        return list
    }

    /**
     * Updates instance from DTO.
     * @param msg - Underlyings data transfer object.
     * @private
     */
    private updateUnderlyings(msg: MarginInstrumentsUnderlyingListChangedV1): void {
        for (const index in msg.items) {
            const underlying = msg.items[index]
            if (this.underlyings.has(underlying.activeId)) {
                this.underlyings.get(underlying.activeId)!.update(underlying)
            } else {
                this.underlyings.set(underlying.activeId, new MarginUnderlying(underlying, "forex", this.wsApiClient))
            }
        }
    }
}

export class MarginCfd {
    /**
     * Instance of WebSocket API client.
     * @private
     */
    private readonly wsApiClient: WsApiClient

    /**
     * Underlyings current state.
     * @private
     */
    private underlyings: Map<number, MarginUnderlying> = new Map<number, MarginUnderlying>()

    /**
     * Creates instance from DTO.
     * @param underlyingList - Underlyings data transfer object.
     * @param wsApiClient - Instance of WebSocket API client.
     * @internal
     * @private
     */
    private constructor(underlyingList: MarginInstrumentsUnderlyingListV1, wsApiClient: WsApiClient) {
        this.wsApiClient = wsApiClient

        for (const index in underlyingList.items) {
            const underlying = underlyingList.items[index]
            this.underlyings.set(underlying.activeId, new MarginUnderlying(underlying, "cfd", wsApiClient))
        }
    }

    /**
     * Subscribes on underlyings updates, requests current state of underlyings, puts the state into this class instance and returns it.
     * @param wsApiClient - Instance of WebSocket API client.
     */
    public static async create(wsApiClient: WsApiClient): Promise<MarginCfd> {
        const request = new SubscribeMarginInstrumentsUnderlyingListChangedV1("cfd")
        await wsApiClient.subscribe<MarginInstrumentsUnderlyingListChangedV1>(request, (event) => {
            marginForexFacade.updateUnderlyings(event)
        })
        const underlyingList = await wsApiClient.doRequest<MarginInstrumentsUnderlyingListV1>(
            new CallMarginInstrumentsGetUnderlyingListV1("cfd")
        )
        const marginForexFacade = new MarginCfd(underlyingList, wsApiClient)
        return marginForexFacade
    }

    /**
     * Makes request for buy margin active.
     * @param instrument - The instrument for which the option is purchased.
     * @param direction - Direction of price change.
     * @param count
     * @param balance - The balance from which the initial investment will be written off and upon successful closing of the position, profit will be credited to this balance.
     * @param takeProfit
     * @param stopLoss
     */
    public async buy(
        instrument: MarginUnderlyingInstrument,
        direction: MarginDirection,
        count: number,
        balance: Balance,
        stopLoss: MarginTradingTPSL | null = null,
        takeProfit: MarginTradingTPSL | null = null,
    ): Promise<MarginOrder> {
        const request = new CallMarginPlaceMarketOrderV1(
            direction,
            balance.id,
            count.toString(),
            instrument.id,
            instrument.activeId,
            instrument.calculateLeverageProfile(balance).toString(),
            "cfd",
            stopLoss,
            takeProfit,
        )
        const response = await this.wsApiClient.doRequest<MarginOrderPlacedV1>(request)
        return new MarginOrder(response)
    }

    /**
     * Makes stop order request for buy margin active.
     * If the stop order price is on the opposite side of the current market price, it will be converted to a limit order.
     * @param instrument
     * @param direction
     * @param count
     * @param balance
     * @param stopPrice
     * @param takeProfit
     * @param stopLoss
     */
    public async buyStop(
        instrument: MarginUnderlyingInstrument,
        direction: MarginDirection,
        count: number,
        balance: Balance,
        stopPrice: number,
        stopLoss: MarginTradingTPSL | null = null,
        takeProfit: MarginTradingTPSL | null = null,
    ): Promise<MarginOrder> {
        const request = new CallMarginPlaceStopOrderV1(
            direction,
            balance.id,
            count.toString(),
            stopPrice.toString(),
            instrument.id,
            instrument.activeId,
            instrument.calculateLeverageProfile(balance).toString(),
            'cfd',
            stopLoss,
            takeProfit,
        )
        const response = await this.wsApiClient.doRequest<MarginOrderPlacedV1>(request)
        return new MarginOrder(response)
    }

    /**
     * Makes limit order request for buy margin active.
     * If the limit order price is on the opposite side of the current market price, it will be converted to a stop order.
     * @param instrument
     * @param direction
     * @param count
     * @param balance
     * @param limitPrice
     * @param stopLoss
     * @param takeProfit
     */
    public async buyLimit(
        instrument: MarginUnderlyingInstrument,
        direction: MarginDirection,
        count: number,
        balance: Balance,
        limitPrice: number,
        stopLoss: MarginTradingTPSL | null = null,
        takeProfit: MarginTradingTPSL | null = null,
    ): Promise<MarginOrder> {
        const request = new CallMarginPlaceLimitOrderV1(
            direction,
            balance.id,
            count.toString(),
            limitPrice.toString(),
            instrument.id,
            instrument.activeId,
            instrument.calculateLeverageProfile(balance).toString(),
            'cfd',
            stopLoss,
            takeProfit,
        )
        const response = await this.wsApiClient.doRequest<MarginOrderPlacedV1>(request)
        return new MarginOrder(response)
    }

    /**
     * Returns list of underlyings available for buy at specified time.
     * @param at - Time for which the check is performed.
     */
    public getUnderlyingsAvailableForTradingAt(at: Date): MarginUnderlying[] {
        const list = []
        for (const [activeId] of this.underlyings) {
            if (this.underlyings.get(activeId)!.isAvailableForTradingAt(at)) {
                list.push(this.underlyings.get(activeId)!)
            }
        }
        return list
    }

    /**
     * Updates instance from DTO.
     * @param msg - Underlyings data transfer object.
     * @private
     */
    private updateUnderlyings(msg: MarginInstrumentsUnderlyingListChangedV1): void {
        for (const index in msg.items) {
            const underlying = msg.items[index]
            if (this.underlyings.has(underlying.activeId)) {
                this.underlyings.get(underlying.activeId)!.update(underlying)
            } else {
                this.underlyings.set(underlying.activeId, new MarginUnderlying(underlying, "cfd", this.wsApiClient))
            }
        }
    }
}

export class MarginCrypto {
    /**
     * Instance of WebSocket API client.
     * @private
     */
    private readonly wsApiClient: WsApiClient

    /**
     * Underlyings current state.
     * @private
     */
    private underlyings: Map<number, MarginUnderlying> = new Map<number, MarginUnderlying>()

    /**
     * Creates instance from DTO.
     * @param underlyingList - Underlyings data transfer object.
     * @param wsApiClient - Instance of WebSocket API client.
     * @internal
     * @private
     */
    private constructor(underlyingList: MarginInstrumentsUnderlyingListV1, wsApiClient: WsApiClient) {
        this.wsApiClient = wsApiClient

        for (const index in underlyingList.items) {
            const underlying = underlyingList.items[index]
            this.underlyings.set(underlying.activeId, new MarginUnderlying(underlying, "crypto", wsApiClient))
        }
    }

    /**
     * Subscribes on underlyings updates, requests current state of underlyings, puts the state into this class instance and returns it.
     * @param wsApiClient - Instance of WebSocket API client.
     */
    public static async create(wsApiClient: WsApiClient): Promise<MarginCrypto> {
        const request = new SubscribeMarginInstrumentsUnderlyingListChangedV1("crypto")
        await wsApiClient.subscribe<MarginInstrumentsUnderlyingListChangedV1>(request, (event) => {
            marginForexFacade.updateUnderlyings(event)
        })
        const underlyingList = await wsApiClient.doRequest<MarginInstrumentsUnderlyingListV1>(
            new CallMarginInstrumentsGetUnderlyingListV1("crypto")
        )
        const marginForexFacade = new MarginCrypto(underlyingList, wsApiClient)
        return marginForexFacade
    }

    /**
     * Makes request for buy margin active.
     * @param instrument - The instrument for which the option is purchased.
     * @param direction - Direction of price change.
     * @param count
     * @param balance - The balance from which the initial investment will be written off and upon successful closing of the position, profit will be credited to this balance.
     * @param stopLoss
     * @param takeProfit
     */
    public async buy(
        instrument: MarginUnderlyingInstrument,
        direction: MarginDirection,
        count: number,
        balance: Balance,
        stopLoss: MarginTradingTPSL | null = null,
        takeProfit: MarginTradingTPSL | null = null,
    ): Promise<MarginOrder> {
        const request = new CallMarginPlaceMarketOrderV1(
            direction,
            balance.id,
            count.toString(),
            instrument.id,
            instrument.activeId,
            instrument.calculateLeverageProfile(balance).toString(),
            "crypto",
            stopLoss,
            takeProfit,
        )
        const response = await this.wsApiClient.doRequest<MarginOrderPlacedV1>(request)
        return new MarginOrder(response)
    }

    /**
     * Makes stop order request for buy margin active.
     * If the stop order price is on the opposite side of the current market price, it will be converted to a limit order.
     * @param instrument
     * @param direction
     * @param count
     * @param balance
     * @param stopPrice
     * @param takeProfit
     * @param stopLoss
     */
    public async buyStop(
        instrument: MarginUnderlyingInstrument,
        direction: MarginDirection,
        count: number,
        balance: Balance,
        stopPrice: number,
        stopLoss: MarginTradingTPSL | null = null,
        takeProfit: MarginTradingTPSL | null = null,
    ): Promise<MarginOrder> {
        const request = new CallMarginPlaceStopOrderV1(
            direction,
            balance.id,
            count.toString(),
            stopPrice.toString(),
            instrument.id,
            instrument.activeId,
            instrument.calculateLeverageProfile(balance).toString(),
            'crypto',
            stopLoss,
            takeProfit,
        )
        const response = await this.wsApiClient.doRequest<MarginOrderPlacedV1>(request)
        return new MarginOrder(response)
    }

    /**
     * Makes limit order request for buy margin active.
     * If the limit order price is on the opposite side of the current market price, it will be converted to a stop order.
     * @param instrument
     * @param direction
     * @param count
     * @param balance
     * @param limitPrice
     * @param stopLoss
     * @param takeProfit
     */
    public async buyLimit(
        instrument: MarginUnderlyingInstrument,
        direction: MarginDirection,
        count: number,
        balance: Balance,
        limitPrice: number,
        stopLoss: MarginTradingTPSL | null = null,
        takeProfit: MarginTradingTPSL | null = null,
    ): Promise<MarginOrder> {
        const request = new CallMarginPlaceLimitOrderV1(
            direction,
            balance.id,
            count.toString(),
            limitPrice.toString(),
            instrument.id,
            instrument.activeId,
            instrument.calculateLeverageProfile(balance).toString(),
            'crypto',
            stopLoss,
            takeProfit,
        )
        const response = await this.wsApiClient.doRequest<MarginOrderPlacedV1>(request)
        return new MarginOrder(response)
    }

    /**
     * Returns list of underlyings available for buy at specified time.
     * @param at - Time for which the check is performed.
     */
    public getUnderlyingsAvailableForTradingAt(at: Date): MarginUnderlying[] {
        const list = []
        for (const [activeId] of this.underlyings) {
            if (this.underlyings.get(activeId)!.isAvailableForTradingAt(at)) {
                list.push(this.underlyings.get(activeId)!)
            }
        }
        return list
    }

    /**
     * Updates instance from DTO.
     * @param msg - Underlyings data transfer object.
     * @private
     */
    private updateUnderlyings(msg: MarginInstrumentsUnderlyingListChangedV1): void {
        for (const index in msg.items) {
            const underlying = msg.items[index]
            if (this.underlyings.has(underlying.activeId)) {
                this.underlyings.get(underlying.activeId)!.update(underlying)
            } else {
                this.underlyings.set(underlying.activeId, new MarginUnderlying(underlying, "crypto", this.wsApiClient))
            }
        }
    }
}

export class MarginUnderlying {
    /**
     * Underlying active ID.
     */
    public activeId: number

    /**
     * Margin instrument type (cfd/crypto/forex).
     * @private
     */
    private readonly marginInstrumentType: string

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
    public schedule: MarginUnderlyingTradingSession[]

    /**
     * Instruments facade class instance.
     * @private
     */
    private instrumentsFacade: MarginUnderlyingInstruments | undefined

    /**
     * Instance of WebSocket API client.
     * @private
     */
    private readonly wsApiClient: WsApiClient

    /**
     * Creates instance from DTO.
     * @param msg - Underlying data transfer object.
     * @param marginInstrumentType
     * @param wsApiClient - Instance of WebSocket API client.
     * @internal
     * @private
     */
    public constructor(msg: MarginInstrumentsUnderlyingListV1Item, marginInstrumentType: string, wsApiClient: WsApiClient) {
        this.activeId = msg.activeId
        this.marginInstrumentType = marginInstrumentType
        this.isSuspended = msg.isSuspended
        this.name = msg.name
        this.wsApiClient = wsApiClient

        this.schedule = []
        for (const index in msg.schedule) {
            const session = msg.schedule[index];
            this.schedule.push(new MarginUnderlyingTradingSession(session.open, session.close))
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
        return this.schedule.findIndex((session: MarginUnderlyingTradingSession): boolean => {
            return session.open.getTime() <= atUnixTimeMilli && session.close.getTime() >= atUnixTimeMilli
        }) >= 0
    }

    /**
     * Returns margin active's instruments facade.
     */
    public async instruments(): Promise<MarginUnderlyingInstruments> {
        if (!this.instrumentsFacade) {
            this.instrumentsFacade = await MarginUnderlyingInstruments.create(this.activeId, this.marginInstrumentType, this.wsApiClient)
        }

        return this.instrumentsFacade
    }

    /**
     * Updates the instance from DTO.
     * @param msg - Underlying data transfer object.
     * @private
     */
    update(msg: MarginInstrumentsUnderlyingListV1Item): void {
        this.isSuspended = msg.isSuspended
        this.name = msg.name

        this.schedule = []
        for (const index in msg.schedule) {
            const session = msg.schedule[index];
            this.schedule.push(new MarginUnderlyingTradingSession(session.open, session.close))
        }
    }
}


/**
 * Margin forex active trading session class.
 */
export class MarginUnderlyingTradingSession {
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
 * Margin underlying instruments facade class.
 */
export class MarginUnderlyingInstruments {
    /**
     * Instruments current state.
     * @private
     */
    private instruments: Map<string, MarginUnderlyingInstrument> = new Map<string, MarginUnderlyingInstrument>()

    /**
     * Just private constructor. Use {@link MarginUnderlyingInstruments.create create} instead.
     * @internal
     * @private
     */
    private constructor() {
    }

    /**
     * Subscribes on underlying instruments updates, requests current state of underlying instruments, puts the state into this class instance and returns it.
     * @param activeId
     * @param marginInstrumentType
     * @param wsApiClient
     */
    public static async create(activeId: number, marginInstrumentType: string, wsApiClient: WsApiClient): Promise<MarginUnderlyingInstruments> {
        const instrumentsFacade = new MarginUnderlyingInstruments()

        const instruments = await wsApiClient.doRequest<MarginInstrumentsInstrumentsListV1>(
            new CallMarginInstrumentsGetInstrumentsListV1(activeId, marginInstrumentType)
        )

        instrumentsFacade.syncInstrumentsFromResponse(instruments)

        return instrumentsFacade
    }

    /**
     * Returns list of instruments available for buy at specified time.
     * @param at - Time for which the check is performed.
     */
    public getAvailableForBuyAt(at: Date): MarginUnderlyingInstrument[] {
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
     * @param msg - Instruments data transfer object.
     * @private
     */
    private syncInstrumentsFromResponse(msg: MarginInstrumentsInstrumentsListV1) {
        const instrumentIds = []
        for (const index in msg.items) {
            const instrument = msg.items[index]
            instrumentIds.push(instrument.id)
            this.syncInstrumentFromResponse(instrument)
        }

        for (const [index] of this.instruments) {
            if (!instrumentIds.includes(this.instruments.get(index)!.id)) {
                this.instruments.delete(index)
            }
        }
    }

    /**
     * Updates the instance from DTO.
     * @param msg - Instrument data transfer object.
     * @private
     */
    private syncInstrumentFromResponse(msg: MarginInstrumentsInstrumentsListV1Item) {
        if (!this.instruments.has(msg.id)) {
            this.instruments.set(msg.id, new MarginUnderlyingInstrument(msg))
        } else {
            this.instruments.get(msg.id)!.sync(msg)
        }
    }
}

/**
 * Margin underlying instruments facade class.
 */
export class MarginUnderlyingInstrument {
    /**
     * Instrument ID.
     */
    public id: string

    /**
     * Active ID of the instrument.
     */
    public activeId: number

    /**
     * Allow long positions.
     */
    public allowLongPosition: boolean

    /**
     * Allow short positions.
     */
    public allowShortPosition: boolean

    /**
     * Default leverage for the instrument.
     */
    public defaultLeverage: number

    /**
     * Leverage profile for the instrument.
     */
    public leverageProfile: number

    /**
     * Indicates if the instrument is suspended.
     */
    public isSuspended: boolean

    /**
     * The minimum amount when buying an asset.
     */
    public minQty: number

    /**
     * The step of the amount when buying an asset.
     */
    public qtyStep: number

    /**
     * Active trading schedule.
     */
    public tradable: MarginUnderlyingInstrumentTradable

    /**
     * Dynamic leverage profiles.
     */
    public dynamicLeverageProfiles: MarginInstrumentsInstrumentsListV1DynamicLeverageProfile[]

    /**
     * Creates instance from DTO.
     * @param msg - Instrument data transfer object.
     * @internal
     * @private
     */
    public constructor(msg: MarginInstrumentsInstrumentsListV1Item) {
        this.id = msg.id
        this.activeId = msg.activeId
        this.allowLongPosition = msg.allowLongPosition
        this.allowShortPosition = msg.allowShortPosition
        this.defaultLeverage = msg.defaultLeverage
        this.leverageProfile = msg.leverageProfile
        this.isSuspended = msg.isSuspended
        this.minQty = parseFloat(msg.minQty)
        this.qtyStep = parseFloat(msg.qtyStep)
        this.tradable = new MarginUnderlyingInstrumentTradable(msg.tradable.from, msg.tradable.to)
        this.dynamicLeverageProfiles = msg.dynamicLeverageProfile
    }

    /**
     * Checks availability for buy option at specified time.
     * @param at - Time for which the check is performed.
     */
    public isAvailableForBuyAt(at: Date): boolean {
        const atUnixTimeMilli = at.getTime()
        return this.tradable.from.getTime() <= atUnixTimeMilli && this.tradable.to.getTime() >= atUnixTimeMilli
    }

    /**
     * Returns the remaining duration in milliseconds for which it is possible to purchase options.
     * @param {Date} currentTime - The current time.
     * @returns {number} - The remaining duration in milliseconds.
     */
    public durationRemainingForPurchase(currentTime: Date): number {
        if (!this.isAvailableForBuyAt(currentTime)) {
            return 0
        }

        return this.tradable.to.getTime() - currentTime.getTime();
    }

    sync(msg: MarginInstrumentsInstrumentsListV1Item): void {
        this.id = msg.id
        this.activeId = msg.activeId
        this.allowLongPosition = msg.allowLongPosition
        this.allowShortPosition = msg.allowShortPosition
        this.defaultLeverage = msg.defaultLeverage
        this.leverageProfile = msg.leverageProfile
        this.isSuspended = msg.isSuspended
        this.minQty = parseFloat(msg.minQty)
        this.qtyStep = parseFloat(msg.qtyStep)
        this.tradable = new MarginUnderlyingInstrumentTradable(msg.tradable.from, msg.tradable.to)
        this.dynamicLeverageProfiles = msg.dynamicLeverageProfile
    }

    public calculateLeverageProfile(balance: Balance): number {
        if (!this.dynamicLeverageProfiles) {
            return this.defaultLeverage
        }

        if (!balance.equityUsd) {
            return this.defaultLeverage
        }

        if (this.dynamicLeverageProfiles.length === 1) {
            return this.dynamicLeverageProfiles[0].leverage
        }

        let leverage = this.defaultLeverage
        for (const index in this.dynamicLeverageProfiles) {
            const profile = this.dynamicLeverageProfiles[index]

            if (balance.equityUsd < profile.equity) {
                return leverage
            } else {
                leverage = profile.leverage
            }
        }

        return this.dynamicLeverageProfiles[this.dynamicLeverageProfiles.length - 1].leverage
    }
}

class MarginUnderlyingInstrumentTradable {
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

    async doRequest<T>(request: HttpRequest<T>): Promise<T> {
        const url = new URL(`${this.apiUrl}${request.path()}`)

        if (request.method() === 'GET' && request.messageBody()) {
            Object.entries(request.messageBody()).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    value.forEach(item => url.searchParams.append(`${key}[]`, String(item)))
                } else {
                    url.searchParams.append(key, String(value))
                }
            })
        }

        const requestUrl = url.toString()
        const requestOptions = {
            method: request.method(),
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'quadcode-client-sdk-js/1.3.10'
            },
            body: request.method() !== 'GET' ? JSON.stringify(request.messageBody()) : undefined
        }

        try {
            const response = await fetch(requestUrl, requestOptions)
            const data = await response.json()

            return request.createResponse(response.status, data)
        } catch (error) {
            console.error(`[HttpApiClient] Request failed:`, {
                url: requestUrl,
                method: request.method(),
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            })
            throw error
        }
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

    /**
     * API URL for WebSocket connection.
     */
    public readonly apiUrl: string
    private readonly onCurrentTimeChangedObserver: Observable<number> = new Observable<number>()
    private readonly platformId: number
    private readonly authMethod: AuthMethod
    private isBrowser = typeof window !== 'undefined';

    private readonly initialReconnectTimeout: number = 100
    private readonly reconnectMultiplier: number = 2
    private readonly maxReconnectTimeout: number = 10000
    private reconnectTimeout: number = 100

    private disconnecting = false
    private reconnecting = false
    private connection: WebSocket | undefined
    private lastRequestId: number = 0
    private pendingRequests: Map<string, RequestMetaData> = new Map<string, RequestMetaData>()
    private subscriptions: Map<string, SubscriptionMetaData[]> = new Map<string, SubscriptionMetaData[]>()
    public onConnectionStateChanged: ((state: WsConnectionStateEnum) => void) | undefined
    private timeSyncInterval: NodeJS.Timeout | undefined
    private lastTimeSyncReceived: number = 0
    private reconnectTimeoutHandle: NodeJS.Timeout | undefined = undefined;

    constructor(apiUrl: string, platformId: number, authMethod: AuthMethod) {
        this.currentTime = new WsApiClientCurrentTime(new Date().getTime())
        this.apiUrl = apiUrl
        this.platformId = platformId
        this.authMethod = authMethod
    }

    private startTimeSyncMonitoring(): void {
        this.stopTimeSyncMonitoring()
        this.lastTimeSyncReceived = Date.now()
        this.timeSyncInterval = setInterval(() => {
            if (Date.now() - this.lastTimeSyncReceived > 60000 && !this.reconnecting) {
                this.forceCloseConnection()
                this.reconnect()
            }
        }, 10000)
    }

    private stopTimeSyncMonitoring(): void {
        if (this.timeSyncInterval) {
            clearInterval(this.timeSyncInterval)
            this.timeSyncInterval = undefined
        }
    }

    public subscribeOnWsCurrentTime(callback: (currentTime: Date) => void): void {
        this.onCurrentTimeChangedObserver.subscribe((time) => callback(new Date(time)))
    }

    public unsubscribeOnWsCurrentTime(callback: (currentTime: Date) => void): void {
        this.onCurrentTimeChangedObserver.unsubscribe((time) => callback(new Date(time)))
    }

    private updateCurrentTime(time: number): void {
        this.currentTime.unixMilliTime = time
        this.onCurrentTimeChangedObserver.notify(time)
    }

    async connect(): Promise<void> {
        if (this.connection !== undefined || this.disconnecting) {
            return
        }

        return new Promise((resolve, reject) => {
            try {
                if (!this.isBrowser) {
                    this.connection = new WebSocket(this.apiUrl, undefined, {
                        headers: {
                            'cookie': `platform=${this.platformId}`,
                            'user-agent': 'quadcode-client-sdk-js/1.3.10'
                        }
                    });
                } else {
                    document.cookie = `platform=${this.platformId};`;
                    this.connection = new WebSocket(this.apiUrl);
                }
                this.connection!.onerror = (err) => {
                    this.forceCloseConnection()
                    return reject(err);
                }
            } catch (err) {
                return reject(err);
            }

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error ignore
            this.connection!.onmessage = ({data}: { data: string }) => {
                const frame: {
                    request_id: string
                    name: string
                    msg: any
                    microserviceName: string
                    status: number
                } = JSON.parse(data)
                if (frame.request_id) {
                    if (this.pendingRequests.has(frame.request_id)) {
                        const requestMetaData = this.pendingRequests.get(frame.request_id)!
                        if (frame.status >= 4000) {
                            this.pendingRequests.delete(frame.request_id)
                            requestMetaData.reject(new Error(`request is failed with status ${frame.status} and message: ${frame.msg.message}`))
                            return
                        }

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
                            this.pendingRequests.delete(frame.request_id)
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
                    this.lastTimeSyncReceived = Date.now()
                    this.updateCurrentTime(frame.msg)
                    return
                } else if (frame.name && frame.name === 'authenticated' && frame.msg === false) {
                    for (const [, requestMetaData] of this.pendingRequests) {
                        if (requestMetaData.request instanceof Authenticate) {
                            requestMetaData.reject(new Error('authentication is failed'))
                        }
                    }
                }
            }

            this.connection!.onopen = async () => {
                try {
                    const isSuccessful = await this.authMethod.authenticateWsApiClient(this)
                    if (!isSuccessful) {
                        this.disconnect()
                        return reject(new Error('authentication is failed'))
                    }

                    const setOptionsResponse = await this.doRequest<Result>(new SetOptions(true))
                    if (!setOptionsResponse.success) {
                        this.disconnect()
                        return reject(new Error('setOptions operation is failed'))
                    }

                    // BEGIN_EXCLUDE
                    try {
                        const response = await this.doRequest<FeaturesV2>(new CallGetFeaturesV2());
                        for (const feature of response.features) {
                            if (feature.name === 'client-sdk' && feature.status === 'disabled') {
                                return reject(new Error('platform does not support'))
                            }
                        }
                    } catch (error) {
                        // it's okay
                    }
                    // END_EXCLUDE

                    this.connection!.onclose = () => {
                        this.forceCloseConnection()
                        this.reconnect()
                    }

                    this.connection!.onerror = () => {
                        this.forceCloseConnection()
                        this.reconnect()
                    }

                    this.startTimeSyncMonitoring()
                    this.onConnectionStateChanged?.(WsConnectionStateEnum.Connected)

                    return resolve()
                } catch (e) {
                    return reject(e)
                }
            }
        })
    }

    disconnect() {
        this.disconnecting = true;

        if (this.reconnectTimeoutHandle) {
            clearTimeout(this.reconnectTimeoutHandle);
            this.reconnectTimeoutHandle = undefined;
        }

        this.stopTimeSyncMonitoring();
        this.forceCloseConnection();
        this.onConnectionStateChanged?.(WsConnectionStateEnum.Disconnected);
        this.reconnecting = false;
        this.lastRequestId = 0;
        this.subscriptions.clear();
    }

    private forceCloseConnection() {
        if (this.connection) {
            try {
                if (!this.isBrowser) {
                    (this.connection as any).terminate();
                } else {
                    this.connection.close();
                }
            } finally {
                this.connection = undefined;
                this.rejectAllPendingRequests(new Error('WebSocket connection closed unexpectedly'));
            }
        }
    }


    reconnect() {
        if (this.disconnecting || this.reconnecting) {
            return;
        }

        this.reconnecting = true;
        this.onConnectionStateChanged?.(WsConnectionStateEnum.Disconnected)

        const attemptReconnect = async () => {
            if (this.disconnecting) {
                this.reconnecting = false;
                return;
            }

            this.connect().then(() => {
                this.resubscribeAll();
                this.reconnectTimeout = this.initialReconnectTimeout;
                this.reconnecting = false;
            }).catch(() => {
                this.reconnectTimeout = Math.min(this.reconnectTimeout * this.reconnectMultiplier, this.maxReconnectTimeout) + this.getJitter();
                this.reconnectTimeoutHandle = setTimeout(attemptReconnect, this.reconnectTimeout);
            })
        };

        this.reconnectTimeoutHandle = setTimeout(attemptReconnect, this.reconnectTimeout);
    }

    getJitter() {
        return Math.floor(Math.random() * 1000);
    }

    doRequest<T>(request: Request<T>): Promise<T> {
        const requestId = (++this.lastRequestId).toString()

        if (!this.connection || this.connection.readyState !== WebSocket.OPEN) {
            return Promise.reject(new Error('WebSocket connection is not open'));
        }

        this.connection!.send(JSON.stringify({
            name: request.messageName(),
            request_id: requestId,
            msg: request.messageBody()
        }))

        return new Promise<T>((resolve, reject) => {
            this.pendingRequests.set(requestId, new RequestMetaData(request, resolve, reject))
        })
    }

    private rejectAllPendingRequests(reason: Error) {
        for (const [, meta] of this.pendingRequests) {
            meta.reject(reason);
        }
        this.pendingRequests.clear();
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

    unsubscribe<T>(request: SubscribeRequest<T>) {
        return new Promise((resolve, reject) => {
            const subscriptionKey = `${request.eventMicroserviceName()},${request.eventName()}`
            if (this.subscriptions.has(subscriptionKey)) {
                const subscriptions = this.subscriptions.get(subscriptionKey)!
                for (const index in subscriptions) {
                    const subscriptionMetaData = subscriptions[index]
                    if (subscriptionMetaData.request === request) {
                        subscriptions.splice(parseInt(index), 1)
                        break
                    }
                }
            }

            this.doRequest<Result>(new UnsubscribeMessage(request.messageBody())).then(resolve).catch(reject)
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
    reason: string

    constructor(data: { success: boolean, reason: string }) {
        this.success = data.success
        this.reason = data.reason
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
    firstName: string
    lastName: string

    constructor(data: {
        result: {
            user_id: number
            first_name: string
            last_name: string
        }
    }) {
        this.userId = data.result.user_id
        this.firstName = data.result.first_name
        this.lastName = data.result.last_name
    }
}

class DigitalOptionInstrumentsInstrumentGeneratedV3 {
    assetId: number
    data: DigitalOptionInstrumentsInstrumentGeneratedV3DataItem[] = []
    deadtime: number
    expiration: number
    index: number
    instrumentType: string
    period: number

    constructor(msg: any) {
        this.assetId = msg.asset_id
        for (const index in msg.data) {
            this.data.push(new DigitalOptionInstrumentsInstrumentGeneratedV3DataItem(msg.data[index]))
        }
        this.deadtime = msg.deadtime
        this.expiration = msg.expiration
        this.index = msg.index
        this.instrumentType = msg.instrument_type
        this.period = msg.period
    }
}

class DigitalOptionInstrumentsInstrumentGeneratedV3DataItem {
    direction: string
    strike: string
    symbol: string

    constructor(msg: any) {
        this.direction = msg.direction
        this.strike = msg.strike
        this.symbol = msg.symbol
    }
}

class DigitalOptionInstrumentsInstrumentsV3 {
    instruments: DigitalOptionInstrumentsInstrumentsV3Instrument[] = []

    constructor(data: any) {
        for (const index in data.instruments) {
            const instrument = data.instruments[index]
            this.instruments.push(new DigitalOptionInstrumentsInstrumentsV3Instrument(instrument))
        }
    }
}

class DigitalOptionInstrumentsInstrumentsV3Instrument {
    assetId: number
    data: DigitalOptionInstrumentsInstrumentsV3InstrumentDataItem[] = []
    deadtime: number
    expiration: number
    index: number
    instrumentType: string
    period: number

    constructor(msg: any) {
        this.assetId = msg.asset_id
        for (const index in msg.data) {
            this.data.push(new DigitalOptionInstrumentsInstrumentsV3InstrumentDataItem(msg.data[index]))
        }
        this.deadtime = msg.deadtime
        this.expiration = msg.expiration
        this.index = msg.index
        this.instrumentType = msg.instrument_type
        this.period = msg.period
    }
}

class DigitalOptionInstrumentsInstrumentsV3InstrumentDataItem {
    direction: string
    strike: string
    symbol: string

    constructor(msg: any) {
        this.direction = msg.direction
        this.strike = msg.strike
        this.symbol = msg.symbol
    }
}

class DigitalOptionInstrumentsUnderlyingListChangedV3 {
    type: string
    underlying: DigitalOptionInstrumentsUnderlyingListChangedV3Underlying[] = []

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
            this.underlying.push(new DigitalOptionInstrumentsUnderlyingListChangedV3Underlying(
                underlying.active_id,
                underlying.is_suspended,
                underlying.name,
                underlying.schedule,
            ))
        }
    }
}

class DigitalOptionInstrumentsUnderlyingListChangedV3Underlying {
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

class DigitalOptionInstrumentsUnderlyingListV3 {
    type: string
    underlying: DigitalOptionInstrumentsUnderlyingListV3Underlying[] = []

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
            this.underlying.push(new DigitalOptionInstrumentsUnderlyingListV3Underlying(
                underlying.active_id,
                underlying.is_suspended,
                underlying.name,
                underlying.schedule,
            ))
        }
    }
}

class DigitalOptionInstrumentsUnderlyingListV3Underlying {
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

class DigitalOptionPlacedV3 {
    id: number

    constructor(data: any) {
        this.id = data.id
    }
}

class MarginOrderPlacedV1 {
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

class BalancesBalanceChangedV1 {
    id: number
    type: number
    amount: number
    bonusAmount: number
    currency: string
    userId: number

    constructor(data: {
        current_balance: {
            id: number
            type: number
            amount: number
            bonus_amount: number
            currency: string
        },
        user_id: number
    }) {
        this.id = data.current_balance.id
        this.type = data.current_balance.type
        this.amount = data.current_balance.amount
        this.bonusAmount = data.current_balance.bonus_amount
        this.currency = data.current_balance.currency
        this.userId = data.user_id
    }
}

class DigitalOptionClientPriceGeneratedV1 {
    instrumentIndex: number
    assetId: number
    digitalOptionTradingGroupId: string
    quoteTime: number
    prices: DigitalOptionClientPriceGeneratedV1Price[] = []

    constructor(data: {
        instrument_index: number
        asset_id: number
        digital_option_trading_group_id: string
        quote_time: number
        prices: {
            strike: string
            call: {
                symbol: string
                ask?: number
                bid?: number
            },
            put: {
                symbol: string
                ask?: number
                bid?: number
            }
        }[]
    }) {
        this.instrumentIndex = data.instrument_index
        this.assetId = data.asset_id
        this.digitalOptionTradingGroupId = data.digital_option_trading_group_id
        this.quoteTime = data.quote_time
        for (const index in data.prices) {
            this.prices.push(new DigitalOptionClientPriceGeneratedV1Price(data.prices[index]))
        }
    }
}

class DigitalOptionClientPriceGeneratedV1Price {
    strike: string
    call: DigitalOptionClientPriceGeneratedV1CallOrPutPrice
    put: DigitalOptionClientPriceGeneratedV1CallOrPutPrice

    constructor(data: {
        strike: string
        call: {
            symbol: string
            ask?: number
            bid?: number
        },
        put: {
            symbol: string
            ask?: number
            bid?: number
        }
    }) {
        this.strike = data.strike
        this.call = new DigitalOptionClientPriceGeneratedV1CallOrPutPrice(data.call)
        this.put = new DigitalOptionClientPriceGeneratedV1CallOrPutPrice(data.put)
    }
}

class DigitalOptionClientPriceGeneratedV1CallOrPutPrice {
    symbol: string
    ask?: number
    bid?: number

    constructor(data: {
        symbol: string
        ask?: number
        bid?: number
    }) {
        this.symbol = data.symbol
        this.ask = data.ask
        this.bid = data.bid
    }
}

class BalancesAvailableBalancesV1 {
    items: BalancesAvailableBalancesV1Balance[] = []

    constructor(balances: any) {
        for (const index in balances) {
            this.items.push(new BalancesAvailableBalancesV1Balance(balances[index]))
        }
    }
}

class BalancesAvailableBalancesV1Balance {
    id: number
    type: number
    amount: number
    bonusAmount: number
    currency: string
    userId: number
    isMargin: boolean

    constructor(data: {
        id: number
        type: number
        amount: number
        bonus_amount: number
        currency: string
        user_id: number
        is_marginal: boolean
    }) {
        this.id = data.id
        this.type = data.type
        this.amount = data.amount
        this.bonusAmount = data.bonus_amount
        this.currency = data.currency
        this.userId = data.user_id
        this.isMargin = data.is_marginal
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
    internalId: string
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
    direction: string | undefined
    expirationTime: number | undefined
    orderIds: number[]

    constructor(data: {
        active_id: number
        close_profit: number | undefined
        close_quote: number | undefined
        close_reason: string | undefined
        close_time: number | undefined
        expected_profit: number
        instrument_type: string
        source: string
        external_id: number
        id: string
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
        raw_event: PositionsRawEvent | undefined
    }) {
        this.activeId = data.active_id
        this.closeProfit = data.close_profit
        this.closeQuote = data.close_quote
        this.closeReason = data.close_reason
        this.closeTime = data.close_time
        this.expectedProfit = data.expected_profit
        this.instrumentType = data.instrument_type
        this.externalId = data.external_id
        this.internalId = data.id
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

        if (data.raw_event) {
            let order_ids: number[] | undefined
            switch (data.instrument_type) {
                case InstrumentType.BinaryOption:
                case InstrumentType.TurboOption:
                case InstrumentType.BlitzOption:
                    order_ids = data.raw_event.binary_options_option_changed1!.order_ids
                    this.direction = data.raw_event.binary_options_option_changed1!.direction
                    if (data.raw_event.binary_options_option_changed1!.expiration_time) {
                        this.expirationTime = data.raw_event.binary_options_option_changed1!.expiration_time * 1000
                    }
                    break;
                case InstrumentType.DigitalOption:
                    order_ids = data.raw_event.digital_options_position_changed1!.order_ids
                    this.direction = data.raw_event.digital_options_position_changed1!.instrument_dir
                    if (data.raw_event.digital_options_position_changed1!.instrument_expiration) {
                        this.expirationTime = data.raw_event.digital_options_position_changed1!.instrument_expiration
                    }
                    break;
                case InstrumentType.MarginCfd:
                    order_ids = data.raw_event.marginal_cfd_position_changed1!.order_ids
                    break;
                case InstrumentType.MarginForex:
                    order_ids = data.raw_event.marginal_forex_position_changed1!.order_ids
                    break;
                case InstrumentType.MarginCrypto:
                    order_ids = data.raw_event.marginal_crypto_position_changed1!.order_ids
                    break
            }

            if (order_ids) {
                this.orderIds = order_ids
            } else {
                this.orderIds = [data.external_id]
            }
        } else {
            this.orderIds = [data.external_id]
        }
    }
}

class PortfolioPositionsHistoryV2 {
    limit: number
    positions: PortfolioPositionsHistoryV2Position[] = []

    constructor(data: any) {
        this.limit = data.limit

        for (const index in data.positions) {
            this.positions.push(new PortfolioPositionsHistoryV2Position(data.positions[index]))
        }
    }
}

class PortfolioPositionsHistoryV2Position {
    externalId: number
    internalId: string
    userId: number
    userBalanceId: number
    activeId: number
    instrumentType: string
    status: string
    openQuote: number
    openTime: number
    invest: number
    closeProfit: number | undefined
    closeQuote: number | undefined
    closeReason: string | undefined
    closeTime: number | undefined
    pnl: number
    pnlRealized: number
    pnlNet: number
    orderIds: number[]
    direction: string | undefined

    constructor(data: {
        active_id: number
        close_profit: number | undefined
        close_quote: number | undefined
        close_reason: string | undefined
        close_time: number | undefined
        expected_profit: number
        instrument_type: string
        source: string
        external_id: number
        id: string
        invest: number
        open_quote: number
        open_time: number
        pnl: number
        pnl_realized: number
        pnl_net: number
        quote_timestamp: number | undefined
        status: string
        user_id: number
        user_balance_id: number
        version: number
        raw_event: PositionsRawEvent | undefined
    }) {
        this.activeId = data.active_id
        this.closeProfit = data.close_profit
        this.closeQuote = data.close_quote
        this.closeReason = data.close_reason
        this.closeTime = data.close_time
        this.externalId = data.external_id
        this.internalId = data.id
        this.instrumentType = data.instrument_type
        this.invest = data.invest
        this.openQuote = data.open_quote
        this.openTime = data.open_time
        this.pnl = data.pnl
        this.pnlRealized = data.pnl_realized
        this.pnlNet = data.pnl_net
        this.status = data.status
        this.userId = data.user_id
        this.userBalanceId = data.user_balance_id

        if (data.raw_event) {
            let order_ids: number[] | undefined
            switch (data.instrument_type) {
                case InstrumentType.BinaryOption:
                case InstrumentType.TurboOption:
                case InstrumentType.BlitzOption:
                    order_ids = data.raw_event.binary_options_option_changed1!.order_ids
                    this.direction = data.raw_event.binary_options_option_changed1!.direction
                    break;
                case InstrumentType.DigitalOption:
                    order_ids = data.raw_event.digital_options_position_changed1!.order_ids
                    this.direction = data.raw_event.digital_options_position_changed1!.instrument_dir
                    break;
                case InstrumentType.MarginCfd:
                    order_ids = data.raw_event.marginal_cfd_position_changed1!.order_ids
                    break;
                case InstrumentType.MarginForex:
                    order_ids = data.raw_event.marginal_forex_position_changed1!.order_ids
                    break;
                case InstrumentType.MarginCrypto:
                    order_ids = data.raw_event.marginal_crypto_position_changed1!.order_ids
                    break
            }

            if (order_ids) {
                this.orderIds = order_ids
            } else {
                this.orderIds = [data.external_id]
            }
        } else {
            this.orderIds = [data.external_id]
        }
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

class PortfolioPositionsStateV1 {
    positions: PortfolioPositionsStateV1Position[] = []
    expiresIn: number
    userId: number
    subscriptionId: number

    constructor(data: {
        positions: any[],
        expires_in: number,
        user_id: number,
        subscription_id: number
    }) {
        this.expiresIn = data.expires_in
        this.userId = data.user_id
        this.subscriptionId = data.subscription_id
        for (const index in data.positions) {
            this.positions.push(new PortfolioPositionsStateV1Position(data.positions[index]))
        }
    }
}

class PortfolioPositionsStateV1Position {
    internalId: string
    instrumentType: string
    sellProfit: number
    margin: number
    currentPrice: number
    quoteTimestamp: number | undefined
    pnl: number
    pnlNet: number
    openPrice: number
    expectedProfit: number
    currencyConversion: number

    constructor(data: {
        id: string
        instrument_type: string
        sell_profit: number
        margin: number
        current_price: number
        quote_timestamp: number | undefined
        pnl: number
        pnl_net: number
        open_price: number
        expected_profit: number
        currency_conversion: number
    }) {
        this.internalId = data.id
        this.instrumentType = data.instrument_type
        this.sellProfit = data.sell_profit
        this.margin = data.margin
        this.currentPrice = data.current_price
        this.quoteTimestamp = data.quote_timestamp
        this.pnl = data.pnl
        this.pnlNet = data.pnl_net
        this.openPrice = data.open_price
        this.expectedProfit = data.expected_profit
        this.currencyConversion = data.currency_conversion
    }
}

class PortfolioPositionsV4Position {
    activeId: number
    expectedProfit: number
    externalId: number
    internalId: string
    instrumentType: string
    invest: number
    openQuote: number
    openTime: number
    pnl: number
    quoteTimestamp: number | undefined
    status: string
    userId: number
    userBalanceId: number
    orderIds: number[]
    expirationTime: number | undefined
    direction: string | undefined

    constructor(data: {
        active_id: number
        expected_profit: number
        external_id: number
        id: string
        instrument_type: string
        source: string
        invest: number
        open_quote: number
        open_time: number
        pnl: number
        quote_timestamp: number | undefined
        status: string
        user_id: number
        user_balance_id: number
        raw_event: PositionsRawEvent | undefined
    }) {
        this.activeId = data.active_id
        this.expectedProfit = data.expected_profit
        this.externalId = data.external_id
        this.internalId = data.id
        this.instrumentType = data.instrument_type
        this.invest = data.invest
        this.openQuote = data.open_quote
        this.openTime = data.open_time
        this.pnl = data.pnl
        this.quoteTimestamp = data.quote_timestamp
        this.status = data.status
        this.userId = data.user_id
        this.userBalanceId = data.user_balance_id

        if (data.raw_event) {
            let order_ids: number[] | undefined
            switch (data.instrument_type) {
                case InstrumentType.BinaryOption:
                case InstrumentType.TurboOption:
                case InstrumentType.BlitzOption:
                    order_ids = data.raw_event.binary_options_option_changed1!.order_ids
                    this.direction = data.raw_event.binary_options_option_changed1!.direction
                    if (data.raw_event.binary_options_option_changed1!.expiration_time) {
                        this.expirationTime = data.raw_event.binary_options_option_changed1!.expiration_time * 1000
                    }
                    break;
                case InstrumentType.DigitalOption:
                    order_ids = data.raw_event.digital_options_position_changed1!.order_ids
                    this.direction = data.raw_event.digital_options_position_changed1!.instrument_dir
                    if (data.raw_event.digital_options_position_changed1!.instrument_expiration) {
                        this.expirationTime = data.raw_event.digital_options_position_changed1!.instrument_expiration
                    }
                    break;
                case InstrumentType.MarginCfd:
                    order_ids = data.raw_event.marginal_cfd_position_changed1!.order_ids
                    break;
                case InstrumentType.MarginForex:
                    order_ids = data.raw_event.marginal_forex_position_changed1!.order_ids
                    break;
                case InstrumentType.MarginCrypto:
                    order_ids = data.raw_event.marginal_crypto_position_changed1!.order_ids
                    break
            }

            if (order_ids) {
                this.orderIds = order_ids
            } else {
                this.orderIds = [data.external_id]
            }
        } else {
            this.orderIds = [data.external_id]
        }
    }
}

class PositionsRawEvent {
    binary_options_option_changed1: BinaryOptionsRawEventItem | undefined
    digital_options_position_changed1: PositionsRawEventItem | undefined
    marginal_forex_position_changed1: PositionsRawEventItem | undefined
    marginal_cfd_position_changed1: PositionsRawEventItem | undefined
    marginal_crypto_position_changed1: PositionsRawEventItem | undefined
}

class BinaryOptionsRawEventItem {
    order_ids: number[] | undefined
    direction: string | undefined
    expiration_time: number | undefined
}

class PositionsRawEventItem {
    order_ids: number[] | undefined
    instrument_dir: string | undefined
    instrument_expiration: number | undefined
}

class PortfolioOrdersV2 {
    orders: PortfolioOrdersV2Order[] = []

    constructor(data: any) {
        for (const index in data.items) {
            this.orders.push(new PortfolioOrdersV2Order(data.items[index]))
        }
    }
}

class PortfolioOrdersV2Order {
    id: number | undefined
    instrumentType: string
    kind: string
    positionId: string
    status: string
    userId: number
    userBalanceId: number

    constructor(data: {
        id: string
        instrument_type: string
        kind: string
        position_id: string
        status: string
        user_id: number
        user_balance_id: number
        raw_event: OrdersRawEvent | undefined
    }) {
        this.instrumentType = data.instrument_type
        this.kind = data.kind
        this.positionId = data.position_id
        this.status = data.status
        this.userId = data.user_id
        this.userBalanceId = data.user_balance_id

        if (data.raw_event) {
            switch (data.instrument_type) {
                case InstrumentType.DigitalOption:
                    this.id = data.raw_event.digital_options_order_changed1!.id
                    break;
                case InstrumentType.MarginCfd:
                    this.id = data.raw_event.marginal_cfd_order_changed1!.id
                    break;
                case InstrumentType.MarginForex:
                    this.id = data.raw_event.marginal_forex_order_changed1!.id
                    break;
                case InstrumentType.MarginCrypto:
                    this.id = data.raw_event.marginal_crypto_order_changed1!.id
                    break
            }
        }
    }
}

class PortfolioOrderChangedV2 {
    id: number | undefined
    instrumentType: string
    kind: string
    positionId: string
    status: string
    userId: number
    userBalanceId: number

    constructor(data: {
        id: string
        instrument_type: string
        kind: string
        position_id: string
        status: string
        user_id: number
        user_balance_id: number
        raw_event: OrdersRawEvent | undefined
    }) {
        this.instrumentType = data.instrument_type
        this.kind = data.kind
        this.positionId = data.position_id
        this.status = data.status
        this.userId = data.user_id
        this.userBalanceId = data.user_balance_id

        if (data.raw_event) {
            switch (data.instrument_type) {
                case InstrumentType.DigitalOption:
                    this.id = data.raw_event.digital_options_order_changed1!.id
                    break;
                case InstrumentType.MarginCfd:
                    this.id = data.raw_event.marginal_cfd_order_changed1!.id
                    break;
                case InstrumentType.MarginForex:
                    this.id = data.raw_event.marginal_forex_order_changed1!.id
                    break;
                case InstrumentType.MarginCrypto:
                    this.id = data.raw_event.marginal_crypto_order_changed1!.id
                    break
            }
        }
    }
}

class OrdersRawEvent {
    digital_options_order_changed1: OrdersRawEventItem | undefined
    marginal_forex_order_changed1: OrdersRawEventItem | undefined
    marginal_cfd_order_changed1: OrdersRawEventItem | undefined
    marginal_crypto_order_changed1: OrdersRawEventItem | undefined
}

class OrdersRawEventItem {
    id: number

    constructor(data: {
        id: number
    }) {
        this.id = data.id
    }
}

class QuoteGeneratedV2 {
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

class CandleGeneratedV1 {
    id: number
    activeId: number
    size: number
    at: number
    from: number
    to: number
    ask: number
    bid: number
    open: number
    close: number
    min: number
    max: number
    volume: number
    phase: string

    constructor(data: any) {
        this.id = data.id
        this.activeId = data.active_id
        this.size = data.size
        this.at = data.at
        this.from = data.from
        this.to = data.to
        this.ask = data.ask
        this.bid = data.bid
        this.open = data.open
        this.close = data.close
        this.min = data.min
        this.max = data.max
        this.volume = data.volume
        this.phase = data.phase
    }
}

// Outbound messages

class HttpGetTranslationsRequest implements HttpRequest<HttpGetTranslationsResponse> {
    constructor(private readonly lang: string, private readonly groups: string[]) {
    }

    method(): string {
        return 'GET'
    }

    path() {
        return '/api/lang/route-translations'
    }

    messageBody() {
        return {
            route: this.lang,
            groups: this.groups
        }
    }

    createResponse(status: number, data: any): HttpGetTranslationsResponse {
        return new HttpGetTranslationsResponse(data)
    }
}

class HttpGetTranslationsResponse {
    isSuccessful: boolean
    data: {
        result: Record<string, Record<string, string>>
    }

    constructor(data: any) {
        this.isSuccessful = data.isSuccessful
        this.data = data
    }
}

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

class HttpOAuthRequest {
    constructor(
        private readonly redirectUri: string,
        private readonly clientId: number,
        private readonly scope: string,
        private readonly codeChallenge: string,
        private readonly codeChallengeMethod: string,
        private readonly state?: string,
        private readonly affiliateId?: number,
        private readonly afftrack?: string,
        private readonly aff_model?: string,
    ) {
    }

    path(): string {
        return '/auth/oauth.v5/authorize';
    }

    queryParams(): URLSearchParams {
        const params = new URLSearchParams({
            response_type: 'code',
            redirect_uri: this.redirectUri,
            client_id: this.clientId.toString(),
            scope: this.scope,
            code_challenge: this.codeChallenge,
            code_challenge_method: this.codeChallengeMethod,
        });

        if (this.state) params.set('state', this.state);
        if (this.affiliateId) params.set('aff', String(this.affiliateId));
        if (this.afftrack) params.set('afftrack', this.afftrack);
        if (this.aff_model) params.set('aff_model', this.aff_model);

        return params;
    }

    buildUrl(baseUrl: string): string {
        return `${baseUrl}${this.path()}?${this.queryParams().toString()}`;
    }
}

class HttpAccessTokenRequest implements HttpRequest<HttpResponse<HttpAccessTokenResponse>> {
    constructor(
        private readonly code: string,
        private readonly clientId: number,
        private readonly codeVerifier: string,
        private readonly redirectUri: string,
    ) {
    }

    method(): string {
        return 'POST'
    }

    path() {
        return '/auth/oauth.v5/token'
    }

    messageBody() {
        return {
            grant_type: 'authorization_code',
            code: this.code,
            redirect_uri: this.redirectUri,
            client_id: this.clientId,
            code_verifier: this.codeVerifier,
        }
    }

    createResponse(status: number, data: any): HttpResponse<HttpAccessTokenResponse> {
        return new HttpResponse(status, new HttpAccessTokenResponse(data))
    }
}

class HttpAccessTokenResponse {
    accessToken: string
    tokenType: string
    expiresIn: number
    refreshToken?: string
    scope: string

    constructor(data: any) {
        this.accessToken = data.access_token
        this.tokenType = data.token_type
        this.expiresIn = data.expires_in
        this.scope = data.scope

        if (data.refresh_token) {
            this.refreshToken = data.refresh_token
        }
    }
}

class HttpRefreshAccessTokenRequest implements HttpRequest<HttpResponse<HttpRefreshAccessTokenResponse>> {
    constructor(
        private readonly refreshToken: string,
        private readonly clientId: number,
        private readonly clientSecret: string,
    ) {
    }

    method(): string {
        return 'POST'
    }

    path() {
        return '/auth/oauth.v5/token'
    }

    messageBody() {
        return {
            grant_type: 'refresh_token',
            refresh_token: this.refreshToken,
            client_id: this.clientId,
            client_secret: this.clientSecret,
        }
    }

    createResponse(status: number, data: any): HttpResponse<HttpRefreshAccessTokenResponse> {
        return new HttpResponse(status, new HttpRefreshAccessTokenResponse(data))
    }
}

class HttpRefreshAccessTokenResponse {
    accessToken: string
    tokenType: string
    expiresIn: number
    refreshToken: string
    scope: string

    constructor(data: any) {
        this.accessToken = data.access_token
        this.tokenType = data.token_type
        this.expiresIn = data.expires_in
        this.refreshToken = data.refresh_token
        this.scope = data.scope
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

class CallBinaryOptionsOpenBinaryOptionV2 implements Request<BinaryOptionsOptionV1> {
    constructor(
        private activeId: number,
        private expiredAt: number,
        private direction: string,
        private price: number,
        private userBalanceId: number,
        private profitPercent: number
    ) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'binary-options.open-option',
            version: '2.0',
            body: {
                active_id: this.activeId,
                direction: this.direction,
                expired: this.expiredAt,
                option_type_id: 1,
                price: this.price,
                user_balance_id: this.userBalanceId,
                profit_percent: this.profitPercent
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

class CallPortfolioSubscribePositions implements Request<Result> {
    constructor(private frequency: string, private positionIds: string[]) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'portfolio.subscribe-positions',
            version: '1.0',
            body: {
                frequency: this.frequency,
                ids: this.positionIds
            }
        }
    }

    createResponse(data: any): Result {
        return new Result(data)
    }

    resultOnly(): boolean {
        return true
    }
}

class CallPortfolioGetOrdersV2 implements Request<PortfolioOrdersV2> {
    constructor(private userBalanceId: number) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'portfolio.get-orders',
            version: '2.0',
            body: {
                user_balance_id: this.userBalanceId,
                kind: 'deferred'
            }
        }
    }

    createResponse(data: any): PortfolioOrdersV2 {
        return new PortfolioOrdersV2(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class CallMarginClosePositionV1 implements Request<Result> {
    constructor(private marginInstrumentType: string, private positionId: number) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: `marginal-${this.marginInstrumentType}.close-position`,
            version: '1.0',
            body: {
                position_id: this.positionId
            }
        }
    }

    createResponse(data: any): Result {
        return new Result(data)
    }

    resultOnly(): boolean {
        return true
    }
}

class CallDigitalOptionsClosePositionV1 implements Request<Result> {
    constructor(private positionId: number) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'digital-options.close-position',
            version: '1.0',
            body: {
                position_id: this.positionId
            }
        }
    }

    createResponse(data: any): Result {
        return new Result(data)
    }

    resultOnly(): boolean {
        return true
    }
}

class CallBinaryOptionsSellOptionsV3 implements Request<Result> {
    constructor(private optionsIds: number[]) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'binary-options.sell-options',
            version: '3.0',
            body: {
                options_ids: this.optionsIds
            }
        }
    }

    createResponse(data: any): Result {
        return new Result(data)
    }

    resultOnly(): boolean {
        return true
    }
}

class CallBinaryOptionsOpenBlitzOptionV2 implements Request<BinaryOptionsOptionV1> {

    constructor(
        private activeId: number,
        private direction: string,
        private expirationSize: number,
        private price: number,
        private userBalanceId: number,
        private profitPercent: number,
    ) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'binary-options.open-option',
            version: '2.0',
            body: {
                active_id: this.activeId,
                direction: this.direction,
                expiration_size: this.expirationSize,
                expired: 0,
                option_type_id: 12,
                price: this.price,
                user_balance_id: this.userBalanceId,
                profit_percent: this.profitPercent,
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

class CallBinaryOptionsOpenTurboOptionV2 implements Request<BinaryOptionsOptionV1> {
    constructor(
        private activeId: number,
        private expiredAt: number,
        private direction: string,
        private price: number,
        private userBalanceId: number,
        private profitPercent: number,
    ) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'binary-options.open-option',
            version: '2.0',
            body: {
                active_id: this.activeId,
                direction: this.direction,
                expired: this.expiredAt,
                option_type_id: 3,
                price: this.price,
                user_balance_id: this.userBalanceId,
                profit_percent: this.profitPercent,
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

class CallInternalBillingResetTrainingBalanceV4 implements Request<Result> {
    constructor(private readonly userBalanceId: number, private readonly amount: number) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'internal-billing.reset-training-balance',
            version: '4.0',
            body: {
                user_balance_id: this.userBalanceId,
                amount: this.amount
            }
        }
    }

    createResponse(data: any): Result {
        return new Result(data)
    }

    resultOnly(): boolean {
        return true
    }
}

class CallDigitalOptionInstrumentsGetInstrumentsV3 implements Request<DigitalOptionInstrumentsInstrumentsV3> {
    constructor(
        private assetId: number,
    ) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'digital-option-instruments.get-instruments',
            version: '3.0',
            body: {
                asset_id: this.assetId
            }
        }
    }

    createResponse(data: any): DigitalOptionInstrumentsInstrumentsV3 {
        return new DigitalOptionInstrumentsInstrumentsV3(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class CallDigitalOptionInstrumentsGetUnderlyingListV3 implements Request<DigitalOptionInstrumentsUnderlyingListV3> {
    constructor(private filterSuspended: boolean) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'digital-option-instruments.get-underlying-list',
            version: '3.0',
            body: {
                filter_suspended: this.filterSuspended
            }
        }
    }

    createResponse(data: any): DigitalOptionInstrumentsUnderlyingListV3 {
        return new DigitalOptionInstrumentsUnderlyingListV3(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class CallDigitalOptionsPlaceDigitalOptionV3 implements Request<DigitalOptionPlacedV3> {
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
            version: '3.0',
            body: {
                amount: this.amount.toString(),
                asset_id: this.assetId,
                instrument_id: this.instrumentId,
                instrument_index: this.instrumentIndex,
                user_balance_id: this.userBalanceId
            }
        }
    }

    createResponse(data: any): DigitalOptionPlacedV3 {
        return new DigitalOptionPlacedV3(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class CallBinaryOptionsGetInitializationDataV3 implements Request<InitializationDataV3> {
    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'binary-options.get-initialization-data',
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

class CallBalancesGetAvailableBalancesV1 implements Request<BalancesAvailableBalancesV1> {
    constructor(private readonly typesIds: number[]) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'balances.get-available-balances',
            version: '1.0',
            body: {
                types_ids: this.typesIds
            }
        }
    }

    createResponse(data: any): BalancesAvailableBalancesV1 {
        return new BalancesAvailableBalancesV1(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class CallPortfolioGetPositionsV4 implements Request<PortfolioPositionsV4> {
    constructor(private readonly instrumentTypes: string[], private readonly limit: number, private readonly offset: number) {
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

class CallPortfolioGetHistoryPositionsV2 implements Request<PortfolioPositionsHistoryV2> {
    private readonly instrumentTypes: string[];
    private readonly externalId: number | undefined;
    private readonly userId: number | undefined;
    private readonly end: number | undefined;
    private readonly limit: number | undefined;
    private readonly offset: number | undefined;

    constructor(data: {
        instrumentTypes: string[],
        externalId?: number,
        userId?: number,
        end?: number,
        limit?: number,
        offset?: number
    }) {
        this.instrumentTypes = data.instrumentTypes;
        this.externalId = data.externalId;
        this.userId = data.userId;
        this.end = data.end;
        this.limit = data.limit;
        this.offset = data.offset;
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        const body: any = {
            instrument_types: this.instrumentTypes
        };

        if (this.externalId !== undefined) body.external_id = this.externalId;
        if (this.userId !== undefined) body.user_id = this.userId;
        if (this.end !== undefined) body.end = this.end;
        if (this.limit !== undefined) body.limit = this.limit;
        if (this.offset !== undefined) body.offset = this.offset;

        return {
            name: 'portfolio.get-history-positions',
            version: '2.0',
            body
        };
    }

    createResponse(data: any): PortfolioPositionsHistoryV2 {
        return new PortfolioPositionsHistoryV2(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class CallQuotesHistoryGetCandlesV2 implements Request<QuotesHistoryCandlesV2> {
    private readonly activeId: number;
    private readonly size: number;

    private readonly from: number | undefined;
    private readonly to: number | undefined;
    private readonly fromId: number | undefined;
    private readonly toId: number | undefined;
    private readonly count: number | undefined;
    private readonly backoff: number | undefined;
    private readonly onlyClosed: boolean | undefined;
    private readonly kind: string | undefined;
    private readonly splitNormalization: boolean | undefined;

    constructor(data: {
        activeId: number,
        size: number,
        options: {
            from?: number,
            to?: number,
            fromId?: number,
            toId?: number,
            count?: number,
            backoff?: number,
            onlyClosed?: boolean,
            kind?: string,
            splitNormalization?: boolean,
        } | undefined
    }) {
        this.activeId = data.activeId;
        this.size = data.size;

        if (data.options) {
            this.from = data.options.from;
            this.to = data.options.to;
            this.fromId = data.options.fromId;
            this.toId = data.options.toId;
            this.count = data.options.count;
            this.backoff = data.options.backoff;
            this.onlyClosed = data.options.onlyClosed;
            this.kind = data.options.kind;
            this.splitNormalization = data.options.splitNormalization;
        }
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'quotes-history.get-candles',
            version: '2.0',
            body: {
                active_id: this.activeId,
                size: this.size,
                from: this.from,
                to: this.to,
                from_id: this.fromId,
                to_id: this.toId,
                count: this.count,
                backoff: this.backoff,
                only_closed: this.onlyClosed,
                kind: this.kind,
                split_normalization: this.splitNormalization,
            }
        }
    }

    createResponse(data: any): QuotesHistoryCandlesV2 {
        return new QuotesHistoryCandlesV2(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class QuotesHistoryCandlesV2 {
    candles: Candle[] = []

    constructor(data: any) {
        for (const index in data.candles) {
            this.candles.push(new Candle(data.candles[index]))
        }
    }
}

class CallQuotesGetFirstCandlesV1 implements Request<QuotesFirstCandlesV1> {
    private readonly activeId: number;
    private readonly splitNormalization: boolean | undefined;

    constructor(
        activeId: number,
        splitNormalization?: boolean | undefined,
    ) {
        this.activeId = activeId;

        if (splitNormalization === undefined) {
            this.splitNormalization = false; // Default value if not provided
        } else {
            this.splitNormalization = splitNormalization;
        }
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'get-first-candles',
            version: '1.0',
            body: {
                active_id: this.activeId,
                split_normalization: this.splitNormalization,
            }
        }
    }

    createResponse(data: any): QuotesFirstCandlesV1 {
        return new QuotesFirstCandlesV1(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class QuotesFirstCandlesV1 {
    candlesBySize: Record<number, Candle> = {}

    constructor(data: any) {
        for (const size in data.candles_by_size) {
            const sizeNumber = Number(size);
            this.candlesBySize[sizeNumber] = new Candle(data.candles_by_size[sizeNumber]);
        }
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

class SubscribePortfolioPositionsStateV1 implements SubscribeRequest<PortfolioPositionsStateV1> {
    messageName() {
        return 'subscribeMessage'
    }

    messageBody() {
        return {
            name: `${this.eventMicroserviceName()}.${this.eventName()}`,
            version: '1.0',
        }
    }

    eventMicroserviceName() {
        return 'portfolio'
    }

    eventName() {
        return 'positions-state'
    }

    createEvent(data: any): PortfolioPositionsStateV1 {
        return new PortfolioPositionsStateV1(data)
    }
}

class SubscribeDigitalOptionInstrumentsInstrumentGeneratedV3 implements SubscribeRequest<DigitalOptionInstrumentsInstrumentGeneratedV3> {
    constructor(
        private assetId: number,
    ) {
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

    createEvent(data: any): DigitalOptionInstrumentsInstrumentGeneratedV3 {
        return new DigitalOptionInstrumentsInstrumentGeneratedV3(data)
    }
}

class SubscribeTradingSettingsDigitalOptionClientPriceGeneratedV1 implements SubscribeRequest<DigitalOptionClientPriceGeneratedV1> {
    constructor(
        private instrumentType: string,
        private assetId: number,
        private instrumentIndex: number,
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
                    asset_id: this.assetId,
                    instrument_index: this.instrumentIndex,
                    instrument_type: this.instrumentType
                }
            }
        }
    }

    eventMicroserviceName() {
        return 'trading-settings'
    }

    eventName() {
        return 'digital-option-client-price-generated'
    }

    createEvent(data: any): DigitalOptionClientPriceGeneratedV1 {
        return new DigitalOptionClientPriceGeneratedV1(data)
    }
}

class SubscribeDigitalOptionInstrumentsUnderlyingListChangedV3 implements SubscribeRequest<DigitalOptionInstrumentsUnderlyingListChangedV3> {
    messageName() {
        return 'subscribeMessage'
    }

    messageBody() {
        return {
            name: `${this.eventMicroserviceName()}.${this.eventName()}`,
            version: '3.0'
        }
    }

    eventMicroserviceName() {
        return 'digital-option-instruments'
    }

    eventName() {
        return 'underlying-list-changed'
    }

    createEvent(data: any): DigitalOptionInstrumentsUnderlyingListChangedV3 {
        return new DigitalOptionInstrumentsUnderlyingListChangedV3(data)
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

class UnsubscribeMessage implements Request<Result> {
    constructor(private readonly body: any) {
    }

    messageName() {
        return 'unsubscribeMessage'
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

class SubscribeBalancesBalanceChangedV1 implements SubscribeRequest<BalancesBalanceChangedV1> {
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
        return 'balances'
    }

    eventName() {
        return 'balance-changed'
    }

    createEvent(data: any): BalancesBalanceChangedV1 {
        return new BalancesBalanceChangedV1(data)
    }
}

class SubscribePortfolioPositionChangedV3 implements SubscribeRequest<PortfolioPositionChangedV3> {
    constructor(private readonly userId: number) {
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

class SubscribePortfolioOrderChangedV2 implements SubscribeRequest<PortfolioOrderChangedV2> {
    constructor(private readonly userId: number, private readonly instrumentType: string) {
    }

    messageName() {
        return 'subscribeMessage'
    }

    messageBody() {
        return {
            name: `${this.eventMicroserviceName()}.${this.eventName()}`,
            version: '2.0',
            params: {
                routingFilters: {
                    user_id: this.userId,
                    instrument_type: this.instrumentType
                }
            }
        }
    }

    eventMicroserviceName() {
        return 'portfolio'
    }

    eventName() {
        return 'order-changed'
    }

    createEvent(data: any): PortfolioOrderChangedV2 {
        return new PortfolioOrderChangedV2(data)
    }
}

class SubscribeQuoteGeneratedV2 implements SubscribeRequest<QuoteGeneratedV2> {
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
            version: '2.0',
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

    createEvent(data: any): QuoteGeneratedV2 {
        return new QuoteGeneratedV2(data)
    }
}

class SubscribeCandleGeneratedV1 implements SubscribeRequest<CandleGeneratedV1> {
    activeId
    size

    constructor(activeId: number, size: number) {
        this.activeId = activeId
        this.size = size
    }

    messageName() {
        return 'subscribeMessage'
    }

    messageBody() {
        return {
            name: `${this.eventName()}`,
            version: '1.0',
            params: {
                routingFilters: {
                    active_id: this.activeId,
                    size: this.size,
                }
            }
        }
    }

    eventMicroserviceName() {
        return 'quotes'
    }

    eventName() {
        return 'candle-generated'
    }

    createEvent(data: any): CandleGeneratedV1 {
        return new CandleGeneratedV1(data)
    }
}

class CallMarginCancelPendingOrderV1 implements Request<Result> {
    constructor(private marginInstrumentType: string, private orderId: number) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: `marginal-${this.marginInstrumentType}.cancel-pending-order`,
            version: '1.0',
            body: {
                order_id: this.orderId
            }
        }
    }

    createResponse(data: any): Result {
        return new Result(data)
    }

    resultOnly(): boolean {
        return true
    }
}

class CallMarginPlaceStopOrderV1 implements Request<MarginOrderPlacedV1> {
    private readonly stopLoss: {
        value: string
        type: string
    } | undefined

    private readonly takeProfit: {
        value: string
        type: string
    } | undefined

    constructor(
        private side: string,
        private userBalanceId: number,
        private count: string,
        private stopPrice: string,
        private instrumentId: string,
        private instrumentActiveId: number,
        private leverage: string,
        private instrumentType: string,
        stopLoss: MarginTradingTPSL | null,
        takeProfit: MarginTradingTPSL | null,
    ) {
        if (stopLoss) {
            this.stopLoss = {
                value: stopLoss.value.toString(),
                type: stopLoss.type,
            }
        }


        if (takeProfit) {
            this.takeProfit = {
                value: takeProfit.value.toString(),
                type: takeProfit.type,
            }
        }
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: `marginal-${this.instrumentType}.place-stop-order`,
            version: '1.0',
            body: {
                side: this.side,
                user_balance_id: this.userBalanceId,
                count: this.count,
                stop_price: this.stopPrice,
                instrument_id: this.instrumentId,
                instrument_active_id: this.instrumentActiveId,
                leverage: this.leverage,
                stop_loss: this.stopLoss,
                take_profit: this.takeProfit
            }
        }
    }

    createResponse(data: any): MarginOrderPlacedV1 {
        return new MarginOrderPlacedV1(data)
    }

    resultOnly(): boolean {
        return false
    }
}


class CallMarginPlaceLimitOrderV1 implements Request<MarginOrderPlacedV1> {
    private readonly stopLoss: {
        value: string
        type: string
    } | undefined

    private readonly takeProfit: {
        value: string
        type: string
    } | undefined

    constructor(
        private side: string,
        private userBalanceId: number,
        private count: string,
        private limitPrice: string,
        private instrumentId: string,
        private instrumentActiveId: number,
        private leverage: string,
        private instrumentType: string,
        stopLoss: MarginTradingTPSL | null,
        takeProfit: MarginTradingTPSL | null,
    ) {
        if (stopLoss) {
            this.stopLoss = {
                value: stopLoss.value.toString(),
                type: stopLoss.type,
            }
        }


        if (takeProfit) {
            this.takeProfit = {
                value: takeProfit.value.toString(),
                type: takeProfit.type,
            }
        }
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: `marginal-${this.instrumentType}.place-limit-order`,
            version: '1.0',
            body: {
                side: this.side,
                user_balance_id: this.userBalanceId,
                count: this.count,
                limit_price: this.limitPrice,
                instrument_id: this.instrumentId,
                instrument_active_id: this.instrumentActiveId,
                leverage: this.leverage,
                stop_loss: this.stopLoss,
                take_profit: this.takeProfit
            }
        }
    }

    createResponse(data: any): MarginOrderPlacedV1 {
        return new MarginOrderPlacedV1(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class CallMarginPlaceMarketOrderV1 implements Request<MarginOrderPlacedV1> {
    private readonly stopLoss: {
        value: string
        type: string
    } | undefined

    private readonly takeProfit: {
        value: string
        type: string
    } | undefined

    constructor(
        private side: string,
        private userBalanceId: number,
        private count: string,
        private instrumentId: string,
        private instrumentActiveId: number,
        private leverage: string,
        private instrumentType: string,
        stopLoss: MarginTradingTPSL | null,
        takeProfit: MarginTradingTPSL | null,
    ) {
        if (stopLoss) {
            this.stopLoss = {
                value: stopLoss.value.toString(),
                type: stopLoss.type,
            }
        }


        if (takeProfit) {
            this.takeProfit = {
                value: takeProfit.value.toString(),
                type: takeProfit.type,
            }
        }
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: `marginal-${this.instrumentType}.place-market-order`,
            version: '1.0',
            body: {
                side: this.side,
                user_balance_id: this.userBalanceId,
                count: this.count,
                instrument_id: this.instrumentId,
                instrument_active_id: this.instrumentActiveId,
                leverage: this.leverage,
                stop_loss: this.stopLoss,
                take_profit: this.takeProfit
            }
        }
    }

    createResponse(data: any): MarginOrderPlacedV1 {
        return new MarginOrderPlacedV1(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class CallMarginInstrumentsGetUnderlyingListV1 implements Request<MarginInstrumentsUnderlyingListV1> {
    constructor(private marginInstrumentType: string) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: `marginal-${this.marginInstrumentType}-instruments.get-underlying-list`,
            version: '1.0',
            body: {}
        }
    }

    createResponse(data: any): MarginInstrumentsUnderlyingListV1 {
        return new MarginInstrumentsUnderlyingListV1(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class SubscribeMarginInstrumentsUnderlyingListChangedV1 implements SubscribeRequest<MarginInstrumentsUnderlyingListChangedV1> {
    constructor(private marginInstrumentType: string) {
    }

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
        return `marginal-${this.marginInstrumentType}-instruments`
    }

    eventName() {
        return 'underlying-list-changed'
    }

    createEvent(data: any): MarginInstrumentsUnderlyingListChangedV1 {
        return new MarginInstrumentsUnderlyingListChangedV1(data)
    }
}

class CallMarginInstrumentsGetInstrumentsListV1 implements Request<MarginInstrumentsInstrumentsListV1> {
    constructor(
        private activeId: number,
        private marginInstrumentType: string,
    ) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: `marginal-${this.marginInstrumentType}-instruments.get-instruments-list`,
            version: '1.0',
            body: {
                active_id: this.activeId
            }
        }
    }

    createResponse(data: any): MarginInstrumentsInstrumentsListV1 {
        return new MarginInstrumentsInstrumentsListV1(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class CallMarginGetMarginBalanceV1 implements Request<MarginPortfolioBalanceV1> {
    constructor(private readonly userBalanceId: number) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'marginal-portfolio.get-marginal-balance',
            version: '1.0',
            body: {
                user_balance_id: this.userBalanceId
            }
        }
    }

    createResponse(data: any): MarginPortfolioBalanceV1 {
        return new MarginPortfolioBalanceV1(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class CallSubscribeMarginPortfolioBalanceChangedV1 implements Request<Result> {
    constructor(private readonly userBalanceId: number) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'marginal-portfolio.subscribe-balance-changed',
            version: '1.0',
            body: {
                user_balance_id: this.userBalanceId
            }
        }
    }

    createResponse(data: any): Result {
        return new Result(data)
    }

    resultOnly(): boolean {
        return true
    }
}

class SubscribeMarginPortfolioBalanceChangedV1 implements SubscribeRequest<MarginPortfolioBalanceV1> {
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
        return 'marginal-portfolio'
    }

    eventName() {
        return 'balance-changed'
    }

    createEvent(data: any): MarginPortfolioBalanceV1 {
        return new MarginPortfolioBalanceV1(data)
    }
}

class CallGetCurrencyV5 implements Request<CurrencyV5> {
    constructor(private readonly currencyCode: string) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'get-currency',
            version: '5.0',
            body: {
                name: this.currencyCode
            }
        }
    }

    createResponse(data: any): CurrencyV5 {
        return new CurrencyV5(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class CurrencyV5 {
    id: number
    name: string
    description: string
    symbol: string
    isVisible: boolean
    mask: string
    isTradable: boolean
    code: string
    unit: number
    rate: number
    rateUsd: number
    minDealAmount: number
    maxDealAmount: number
    minorUnits: number
    image: string
    isCrypto: boolean
    isInout: boolean
    interestRate: number

    constructor(data: any) {
        this.id = data.id
        this.name = data.name
        this.description = data.description
        this.symbol = data.symbol
        this.isVisible = data.is_visible
        this.mask = data.mask
        this.isTradable = data.is_tradable
        this.code = data.code
        this.unit = data.unit
        this.rate = data.rate
        this.rateUsd = data.rate_usd
        this.minDealAmount = data.min_deal_amount
        this.maxDealAmount = data.max_deal_amount
        this.minorUnits = data.minor_units
        this.image = data.image
        this.isCrypto = data.is_crypto
        this.isInout = data.is_inout
        this.interestRate = data.interest_rate
    }
}


class CallGetActiveV5 implements Request<ActiveV5> {
    constructor(private readonly activeId: number) {
    }

    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'get-active',
            version: '5.0',
            body: {
                id: this.activeId
            }
        }
    }

    createResponse(data: any): ActiveV5 {
        return new ActiveV5(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class ActiveV5 {
    id: number
    name: string
    description: string
    image: string
    isOtc: boolean
    timeFrom: string
    timeTo: string
    precision: number
    pipScale: number
    spreadPlus: number
    spreadMinus: number
    expirationDays: number[]
    currencyLeftSide: string
    currencyRightSide: string
    type: string
    minQty: number
    qtyStep: number
    typeQty: string

    constructor(data: any) {
        this.id = data.id
        this.name = data.name
        this.description = data.description
        this.image = data.image
        this.isOtc = data.is_otc
        this.timeFrom = data.time_from
        this.timeTo = data.time_to
        this.precision = data.precision
        this.pipScale = data.pip_scale
        this.spreadPlus = data.spread_plus
        this.spreadMinus = data.spread_minus
        this.expirationDays = data.expiration_days
        this.currencyLeftSide = data.currency_left_side
        this.currencyRightSide = data.currency_right_side
        this.type = data.type
        this.minQty = data.min_qty
        this.qtyStep = data.qty_step
        this.typeQty = data.type_qty
    }
}

class CallGetFeaturesV2 implements Request<FeaturesV2> {
    messageName() {
        return 'sendMessage'
    }

    messageBody() {
        return {
            name: 'features.get-features',
            version: '2.0',
            body: {
                category: 'client-sdk-js',
            }
        }
    }

    createResponse(data: any): FeaturesV2 {
        return new FeaturesV2(data)
    }

    resultOnly(): boolean {
        return false
    }
}

class FeaturesV2 {
    features: FeaturesV2Item[] = []

    constructor(data: any) {
        for (const index in data.features) {
            this.features.push(new FeaturesV2Item(data.features[index]))
        }
    }
}

class FeaturesV2Item {
    id: number
    name: string
    category: string
    version: string
    status: string
    params: any

    constructor(msg: any) {
        this.id = msg.id
        this.name = msg.name
        this.category = msg.category
        this.version = msg.version
        this.status = msg.status
        this.params = msg.params
    }
}


class MarginPortfolioBalanceV1 {
    id: number
    type: number
    cash: number
    bonus: number
    currency: string
    userId: number
    pnl: number
    pnlNet: number
    equity: number
    equityUsd: number
    swap: number
    dividends: number
    margin: number
    available: number
    marginLevel: number
    stopOutLevel: number

    constructor(data: {
        id: number
        type: number
        cash: string
        bonus: string
        currency: string
        user_id: number
        pnl: string
        pnl_net: string
        equity: string
        equity_usd: string
        swap: string
        dividends: string
        margin: string
        available: string
        margin_level: string
        stop_out_level: string
    }) {
        this.id = data.id
        this.type = data.type
        this.cash = parseFloat(data.cash)
        this.bonus = parseFloat(data.bonus)
        this.currency = data.currency
        this.userId = data.user_id
        this.pnl = parseFloat(data.pnl)
        this.pnlNet = parseFloat(data.pnl_net)
        this.equity = parseFloat(data.equity)
        this.equityUsd = parseFloat(data.equity_usd)
        this.swap = parseFloat(data.swap)
        this.dividends = parseFloat(data.dividends)
        this.margin = parseFloat(data.margin)
        this.available = parseFloat(data.available)
        this.marginLevel = parseFloat(data.margin_level)
        this.stopOutLevel = parseFloat(data.stop_out_level)
    }
}

class MarginInstrumentsUnderlyingListV1 {
    items: MarginInstrumentsUnderlyingListV1Item[] = []

    constructor(data: {
        items: {
            active_id: number
            is_suspended: boolean
            name: string
            schedule: {
                open: number,
                close: number,
            }[]
        }[]
    }) {
        for (const index in data.items) {
            const underlying = data.items[index]
            this.items.push(new MarginInstrumentsUnderlyingListV1Item(
                underlying.active_id,
                underlying.is_suspended,
                underlying.name,
                underlying.schedule,
            ))
        }
    }
}

class MarginInstrumentsUnderlyingListChangedV1 {
    type: string
    items: MarginInstrumentsUnderlyingListV1Item[] = []

    constructor(data: {
        type: string
        items: {
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
        for (const index in data.items) {
            const underlying = data.items[index]
            this.items.push(new MarginInstrumentsUnderlyingListV1Item(
                underlying.active_id,
                underlying.is_suspended,
                underlying.name,
                underlying.schedule,
            ))
        }
    }
}

class MarginInstrumentsUnderlyingListV1Item {
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

class MarginInstrumentsInstrumentsListV1 {
    items: MarginInstrumentsInstrumentsListV1Item[] = []

    constructor(data: any) {
        const dynamicLeverageProfiles = new Map<number, MarginInstrumentsInstrumentsListV1DynamicLeverageProfile[]>()
        if (data.dynamic_leverage_profiles) {
            for (const index in data.dynamic_leverage_profiles) {
                const dynamicLeverageProfile = data.dynamic_leverage_profiles[index]
                dynamicLeverageProfiles.set(dynamicLeverageProfile.id, dynamicLeverageProfile.items)
            }
        }

        for (const index in data.items) {
            const instrument = data.items[index]

            if (dynamicLeverageProfiles.has(instrument.leverage_profile)) {
                this.items.push(new MarginInstrumentsInstrumentsListV1Item(instrument, dynamicLeverageProfiles.get(instrument.leverage_profile)))
            } else {
                this.items.push(new MarginInstrumentsInstrumentsListV1Item(instrument))
            }
        }
    }
}

class MarginInstrumentsInstrumentsListV1DynamicLeverageProfile {
    equity: number
    leverage: number

    constructor(data: any) {
        this.equity = data.equity
        this.leverage = data.leverage
    }
}

class MarginInstrumentsInstrumentsListV1Item {
    id: string
    activeId: number
    allowLongPosition: boolean
    allowShortPosition: boolean
    defaultLeverage: number
    leverageProfile: number
    dynamicLeverageProfile: MarginInstrumentsInstrumentsListV1DynamicLeverageProfile[] = []
    isSuspended: boolean
    minQty: string
    qtyStep: string
    tradable: MarginInstrumentsInstrumentsListV1Tradable

    constructor(msg: any, dynamicLeverageProfile: MarginInstrumentsInstrumentsListV1DynamicLeverageProfile[] = []) {
        this.id = msg.id
        this.activeId = msg.active_id
        this.allowLongPosition = msg.allow_long_position
        this.allowShortPosition = msg.allow_short_position
        this.defaultLeverage = msg.default_leverage
        this.leverageProfile = msg.leverage_profile
        this.dynamicLeverageProfile = dynamicLeverageProfile
        this.isSuspended = msg.is_suspended
        this.minQty = msg.min_qty
        this.qtyStep = msg.qty_step
        this.tradable = new MarginInstrumentsInstrumentsListV1Tradable(msg.tradable.from, msg.tradable.to)
    }
}

class MarginInstrumentsInstrumentsListV1Tradable {
    constructor(public from: number, public to: number) {
    }
}
