# Client SDK for TypeScript and JavaScript applications

## Installation

```shell
npm install @quadcode-tech/client-sdk-js
```

## Quick Vite + React + TypeScript example

### Create a new Vite + React + TypeScript project

```shell
npm create vite@latest my-app -- --template react-ts &&
cd my-app &&
npm i && 
npm i @quadcode-tech/client-sdk-js
```

### Edit `vite.config.ts` to add proxy for local development REQUIRED FOR LOCAL TESTING

```ts
import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api/lang/route-translations': {
                target: 'https://trade.example.com',      // local browser calls http://localhost:5173/api/lang/route-translations
                changeOrigin: true,
            },
            '/proxy/api': {
                target: 'https://api.trade.example.com',  // local REST base: http://localhost:5173/proxy/api
                changeOrigin: true,
                secure: false,
                rewrite: (p) => p.replace(/^\/proxy\/api/, ''),
            },
            '/proxy/ws': {
                target: 'wss://ws.trade.example.com',     // local WS base: ws://localhost:5173/proxy/ws
                ws: true,
                changeOrigin: true,
                rewriteWsOrigin: true,
                rewrite: (p) => p.replace(/^\/proxy\/ws/, ''),
            },
        },
    },
})
```

## Quick start with OAuth (PKCE) authentication

### [Online access] Step 1: Redirect user to authorization

```js
import {ClientSdk, OAuthMethod} from '@quadcode-tech/client-sdk-js'

async function startLogin() {
	const oauth = new OAuthMethod({
		apiBaseUrl: 'https://api.trade.example.com', // local: use the same prod host (DO NOT use localhost) — this is the OAuth/Token server; redirects are handled by the provider, not via Vite proxy
		clientId: CLIENT_ID,                         // your client ID (you can request CLIENT_ID and CLIENT_SECRET via form: https://forms.gle/J8NQxxMQWKXggWet6)
		redirectUri: 'https://your.app/callback',    // redirect URI ( local: http://localhost:5173/callback )
		scope: 'full'                                // scope (e.g. 'full' or 'full offline_access')
	})
	const {url, codeVerifier} = await oauth.createAuthorizationUrl()
	sessionStorage.setItem('pkce_verifier', codeVerifier)
	window.location.href = url
}
```

### [Online access] Step 2: Handle redirect and create SDK instance

```js
// Example of in-memory tokens storage (you can implement your own persistent storage)
// NOTE: In a real application, consider using localStorage/sessionStorage or IndexedDB for persistence across page reloads.
class InMemoryOAuthTokensStorage {
	private tokens: { accessToken: string; refreshToken?: string } = {
		accessToken: '',
	};

	get(): { accessToken: string; refreshToken?: string } {
		return this.tokens;
	}

	set(tokens: { accessToken: string; refreshToken?: string }): void {
		this.tokens = tokens;
	}
}


async function handleCallback() {
	const params = new URLSearchParams(window.location.search);
	const code = params.get('code');
	const codeVerifier = sessionStorage.getItem('pkce_verifier');

	if (!code) throw new Error('Missing ?code in callback URL');
	if (!codeVerifier) throw new Error('Missing PKCE code_verifier');

	const oauth = new OAuthMethod({
		apiBaseUrl: 'https://api.trade.example.com', // local (dev via Vite proxy from the browser): http://localhost:5173/proxy/api
		clientId: CLIENT_ID,
		redirectUri: 'https://your.app/callback',    // local: http://localhost:5173/callback
		scope: 'full',
		// NEVER put clientSecret in the browser; access/refresh tokens are managed by tokensStorage
		tokensStorage // custom tokens storage to persist tokens in memory (or use localStorage/sessionStorage)
	});

	await oauth.issueAccessTokenWithAuthCode(code, codeVerifier);

	const sdk = await ClientSdk.create(
		'wss://ws.trade.example.com/echo/websocket', // local (dev via Vite proxy): ws://localhost:5173/proxy/ws/echo/websocket
		82,
		oauth
	);

	const balances = await sdk.balances();
	console.log(balances.getBalances());
}
```

### [Offline access] Step 1: Redirect user to authorization

```js
import {ClientSdk, OAuthMethod} from '@quadcode-tech/client-sdk-js'

async function startLogin() {
	const oauth = new OAuthMethod({
		apiBaseUrl: 'https://api.trade.example.com', // local: use the same prod host (DO NOT use localhost) — this is the OAuth/Token server; redirects are handled by the provider, not via Vite proxy
		clientId: CLIENT_ID,                         // your client ID (you can request CLIENT_ID and CLIENT_SECRET via form: https://forms.gle/J8NQxxMQWKXggWet6)
		redirectUri: 'https://your.app/callback',    // redirect URI
		scope: 'full offline_access'                 // scope (e.g. 'full' or 'full offline_access')
	})
	const {url, codeVerifier} = await oauth.createAuthorizationUrl()
	sessionStorage.setItem('pkce_verifier', codeVerifier)
	window.location.href = url
}
```

### [Online access] Step 2: Handle redirect and save refresh token on server side

```js 
import express from 'express'
import {OAuthMethod} from '@quadcode-tech/client-sdk-js'

const app = express()
app.use(express.json())

app.post('/api/oauth/exchange', async (req, res) => {
	const {code, codeVerifier} = req.body
	if (!code || !codeVerifier) return res.status(400).json({error: 'Bad request'})

	const oauth = new OAuthMethod({
		apiBaseUrl: 'https://api.trade.example.com',
		clientId: Number(process.env.CLIENT_ID),
		redirectUri: 'https://your.app/callback',
		scope: 'full offline_access',
		clientSecret: process.env.CLIENT_SECRET, // SECRET: server-side only
		tokensStorage                            // server-side tokens storage (DB/kv bound to user/session); manages access/refresh tokens
	})

	const {accessToken, refreshToken, expiresIn} = await oauth.issueAccessTokenWithAuthCode(code, codeVerifier)

	// Persist refreshToken securely (DB/kv bound to user/session)
	await saveUserRefreshToken(req, refreshToken)

	// Return ONLY a short-lived access token to the browser
	res.json({accessToken, expiresIn})
})

// Optional refresh endpoint (server uses stored refresh token)
app.post('/api/oauth/refresh', async (req, res) => {
	const oauth = new OAuthMethod({
		apiBaseUrl: 'https://api.trade.example.com',
		clientId: Number(process.env.CLIENT_ID),
		redirectUri: 'https://your.app/callback',
		scope: 'full offline_access',
		clientSecret: process.env.CLIENT_SECRET,
		tokensStorage                            // server-side tokens storage (DB/kv bound to user/session); manages access/refresh tokens
	})

	const {accessToken, expiresIn} = await oauth.refreshAccessToken()

	return res.json({accessToken, expiresIn})
})
```

### [Offline access] Step 3: Handle redirect and send code to server

```js
import {ClientSdk, OAuthMethod} from '@quadcode-tech/client-sdk-js'

export async function handleCallbackAndStart() {
	const params = new URLSearchParams(window.location.search)
	const code = params.get('code')
	const codeVerifier = sessionStorage.getItem('pkce_verifier')
	if (!code || !codeVerifier) throw new Error('Missing code or PKCE verifier')

	// Exchange on the server (server stores refresh; client gets only accessToken)
	const r = await fetch('/api/oauth/exchange', {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify({code, codeVerifier})
	})
	const {accessToken} = await r.json()

	const sdk = await ClientSdk.create(
		'wss://ws.trade.example.com/echo/websocket',  // local (dev via Vite proxy): ws://localhost:5173/proxy/ws/echo/websocket
		82,
		new OAuthMethod({
			apiBaseUrl: 'https://api.trade.example.com', // local (dev via Vite proxy from the browser): http://localhost:5173/proxy/api
			clientId: CLIENT_ID,
			redirectUri: 'https://your.app/callback',    // local: http://localhost:5173/callback
			scope: 'full offline_access',
			accessToken // NEVER put clientSecret or a refresh token in the browser
		})
	)

	// use SDK
	const balances = await sdk.balances()
	console.log(balances.getBalances())
}
```

### Optional SDK Configuration

The `ClientSdk.create` method accepts an optional fourth parameter for additional configuration:

```js
const sdk = await ClientSdk.create(
	'wss://ws.trade.example.com/echo/websocket',
	82,
	new OAuthMethod({
		apiBaseUrl: 'https://api.trade.example.com',
		clientId: CLIENT_ID,
		redirectUri: 'https://your.app/callback',
		scope: 'full offline_access',
		accessToken // NEVER put clientSecret or a refresh token in the browser
	}),
	{
		// Optional: Override the default static files host
		// Default: 'https://static.cdnroute.io/files'
		staticHost: 'https://your-static-host.com/files',

		// Optional: Override the default host for API requests
		// Default: Extracted from the WebSocket URL
		host: 'https://trade.example.com'
	}
)
```

### Monitor connection state and recover from authentication failures

The SDK reconnects automatically when the WebSocket connection drops. On every reconnect it
re-authenticates with the credentials it was created with. If the server keeps rejecting
authentication (for example, the session has expired or was invalidated), the SDK retries
several times and then switches to the terminal `AuthenticationFailed` state. In this state
the client will not reconnect anymore and every request is rejected with
`AuthenticationFailedError`.

**The recommended way to avoid this is `OAuthMethod` with a `tokensStorage`** (and, on the
server side, a refresh token). When re-authentication fails on reconnect, the SDK refreshes
the access token through the storage by itself and keeps the connection alive — without any
extra code in your application:

```js
import {ClientSdk, OAuthMethod} from '@quadcode-tech/client-sdk-js'

const sdk = await ClientSdk.create(
	'wss://ws.trade.example.com/echo/websocket',
	82,
	new OAuthMethod({
		apiBaseUrl: 'https://api.trade.example.com',
		clientId: Number(process.env.CLIENT_ID),
		redirectUri: 'https://your.app/callback',
		scope: 'full offline_access',
		clientSecret: process.env.CLIENT_SECRET, // SECRET: server-side only
		tokensStorage                            // server-side tokens storage (DB/kv bound to user/session); manages access/refresh tokens
	})
)
```

`SsidAuthMethod` cannot refresh anything: an SSID is bound to a platform session, and once that
session expires or is invalidated, the existing `ClientSdk` instance cannot recover on its own.
If you authenticate with an SSID, subscribe to connection state changes and create a new
instance with a freshly obtained SSID when the terminal state is reached:

```js
import {ClientSdk, SsidAuthMethod, WsConnectionStateEnum} from '@quadcode-tech/client-sdk-js'

const wsConnectionState = await sdk.wsConnectionState()

wsConnectionState.subscribeOnStateChanged(async (state) => {
	if (state === WsConnectionStateEnum.AuthenticationFailed) {
		// The session is no longer valid. Dispose of the old instance and
		// create a new one with a freshly obtained SSID.
		await sdk.shutdown()

		sdk = await ClientSdk.create(
			'wss://ws.trade.example.com/echo/websocket',
			82,
			new SsidAuthMethod(await obtainFreshSsid())
		)
	}
})
```

### Get user's first real balance

```js
const balances = await sdk.balances()

console.log(balances.getBalances())

const balance = balances.getBalances().find((balance) => balance.type === BalanceType.Real)

balance.subscribeOnUpdate((updatedBalance) => console.log(updatedBalance))
```

### Reset demo balance to 10.000$

```js
const balances = await sdk.balances()

console.log(balances.getBalances())

const balance = balances.getBalances().find((balance) => balance.type === BalanceType.Demo)

balance.resetDemoBalance()
```

### Get user's balance by ID

```js
const balances = await sdk.balances()

const balance = balances.getBalanceById(12345)

balance.subscribeOnUpdate((updatedBalance) => console.log(updatedBalance))
```

### Get available amount for options and margin trading

The raw `balance.amount` is not always the amount you can actually trade with.
Use `availableForOptionsAmount()` and `availableForMarginAmount()` to get the
amount available for each trading type (both correctly account for bonuses and
margin balances).

```js
const balances = await sdk.balances()

const balance = balances.getBalances().find((balance) => balance.type === BalanceType.Real)

// Amount available for options trading (blitz / turbo / binary / digital), includes bonuses
console.log(balance.availableForOptionsAmount())

// Amount available for margin trading (CFD / Forex / Crypto)
console.log(balance.availableForMarginAmount())

// Keep the available amounts up to date in real time
balance.subscribeOnUpdate((updatedBalance) => {
    console.log('options:', updatedBalance.availableForOptionsAmount())
    console.log('margin:', updatedBalance.availableForMarginAmount())
})
```

### Get current quote for active (underlying)

```js
const quotes = await sdk.quotes()

const currentQuote = await quotes.getCurrentQuoteForActive(1)

currentQuote.subscribeOnUpdate((updatedCurrentQuote) => console.log(updatedCurrentQuote))
```

### Buy blitz options

```js
const blitzOptions = await sdk.blitzOptions()

const blitzOptionsActives = blitzOptions.getActives()

const blitzOptionsFirstAvailableActive = blitzOptionsActives.find((active) => active.canBeBoughtAt(sdk.currentTime()))

const callOption = await blitzOptions.buy(
	blitzOptionsFirstAvailableActive,
	BlitzOptionsDirection.Call,
	blitzOptionsFirstAvailableActive.expirationTimes[0],
	1,
	balance
)

console.log(callOption)

const putOption = await blitzOptions.buy(
	blitzOptionsFirstAvailableActive,
	BlitzOptionsDirection.Put,
	blitzOptionsFirstAvailableActive.expirationTimes[0],
	1,
	balance
)

console.log(putOption)
```

### Get positions for blitz options

```js
const blitzOptions = await sdk.blitzOptions()
const positions = await sdk.positions()

console.log(positions.getOpenedPositions().filter((position) => position.instrumentType === InstrumentType.BlitzOption))

positions.subscribeOnUpdatePosition((position) => {
	if (position.instrumentType === InstrumentType.BlitzOption) {
		console.log(position)
	}
})
```

### Get history of positions

```js
const blitzOptions = await sdk.blitzOptions()
const positions = await sdk.positions()
const positionsHistory = await positions.getPositionsHistory()

if (positionsHistory.hasPrevPage()) {
	await positionsHistory.fetchPrevPage()
}

console.log(positionsHistory.getPositions())
```

### Sell position

```js
const positions = await sdk.positions()
const position = positions.getOpenedPositions().find((position) => position.externalId == 1)
await position.sell() // not available for blitz options 
```

### Potential profit calculation

```js
const positions = await sdk.positions()
const position = positions.getOpenedPositions().find((position) => position.externalId == 1)
console.log(position.pnlNet)
console.log(position.sellProfit)
```

### Buy turbo options

```js
const turboOptions = await sdk.turboOptions()

const actives = turboOptions.getActives().filter((active) => active.canBeBoughtAt(sdk.currentTime()))

const firstActive = actives[0]

const firstActiveInstruments = await firstActive.instruments()

const firstActiveAvailableInstruments = firstActiveInstruments.getAvailableForBuyAt(sdk.currentTime())

const firstInstrument = firstActiveAvailableInstruments[0]

const callOption = await turboOptions.buy(firstInstrument, TurboOptionsDirection.Call, 1, balance)
console.log(callOption)

const putOption = await turboOptions.buy(firstInstrument, TurboOptionsDirection.Put, 1, balance)
console.log(putOption)
```

### Get positions for turbo options

```js
const turboOptions = await sdk.turboOptions()
const positions = await sdk.positions()

console.log(positions.getOpenedPositions().filter((position) => position.instrumentType === InstrumentType.TurboOption))

positions.subscribeOnUpdatePosition((position) => {
	if (position.instrumentType === InstrumentType.TurboOption) {
		console.log(position)
	}
})
```

### Buy binary options

```js
const binaryOptions = await sdk.binaryOptions()

const actives = binaryOptions.getActives().filter((active) => active.canBeBoughtAt(sdk.currentTime()))

const firstActive = actives[0]

const firstActiveInstruments = await firstActive.instruments()

const firstActiveAvailableInstruments = firstActiveInstruments.getAvailableForBuyAt(sdk.currentTime())

const firstInstrument = firstActiveAvailableInstruments[0]
const purchaseEndTime = firstInstrument.purchaseEndTime();

const callOption = await binaryOptions.buy(firstInstrument, BinaryOptionsDirection.Call, 1, balance)
console.log(callOption)

const putOption = await binaryOptions.buy(firstInstrument, BinaryOptionsDirection.Put, 1, balance)
console.log(putOption)
```

### Get purchase end time

```js
const binaryOptions = await sdk.binaryOptions()

const actives = binaryOptions.getActives()

const firstActive = actives[0]

const firstActiveInstruments = await firstActive.instruments()

const firstActiveAvailableInstruments = firstActiveInstruments.getAvailableForBuyAt(sdk.currentTime())

const firstInstrument = firstActiveAvailableInstruments[0]

const purchaseEndTime = firstInstrument.purchaseEndTime();

const durationRemainingForPurchase = firstInstrument.durationRemainingForPurchase();

```

### Get positions for binary options

```js
const binaryOptions = await sdk.binaryOptions()
const positions = await sdk.positions()

console.log(positions.getOpenedPositions().filter((position) => position.instrumentType === InstrumentType.BinaryOption))

binaryOptionsPositions.subscribeOnUpdatePosition((position) => {
	if (position.instrumentType === InstrumentType.BinaryOption) {
		console.log(position)
	}
})
```

### Buy digital spot options

```js
const digitalOptions = await sdk.digitalOptions()

const underlyings = digitalOptions.getUnderlyingsAvailableForTradingAt(sdk.currentTime())

const firstUnderlying = underlyings.find((u) => {
	return u.activeId === 1
})

const firstUnderlyingInstruments = await firstUnderlying.instruments()

const firstUnderlyingAvailableInstruments = firstUnderlyingInstruments.getAvailableForBuyAt(sdk.currentTime())

const firstInstrument = firstUnderlyingAvailableInstruments[0]

const callOption = await digitalOptions.buySpotStrike(firstInstrument, DigitalOptionsDirection.Call, 1, balance)
console.log(callOption)

const putOption = await digitalOptions.buySpotStrike(firstInstrument, DigitalOptionsDirection.Put, 1, balance)
console.log(putOption)
```

### Get positions for digital options

```js
const digitalOptions = await sdk.digitalOptions()
const positions = await sdk.positions()

console.log(digitalOptionsPositions.getOpenedPositions().filter((position) => position.instrumentType === InstrumentType.DigitalOption))

digitalOptionsPositions.subscribeOnUpdatePosition((position) => {
	if (position.instrumentType === InstrumentType.DigitalOption) {
		console.log(position)
	}
})
```

### Working with translations

```js
const translations = await sdk.translations()

// By default, English (en) translations for the 'front' group are already loaded
// and will automatically reload every 10 minutes
const translatedText = translations.getTranslation('front.EURGBP')

// To get translations in other languages or groups, you need to fetch them first
await translations.fetchTranslations('es', [TranslationGroup.Front])
const translatedTextEs = translations.getTranslation('front.EURGBP', 'es')

// Get active name with translation (automatically uses loaded translations)
const actives = await sdk.actives()
const active = await actives.getActive(1)
console.log(active.name) // Returns translated name

```

### Buy margin CFD/Forex/Crypto

```js
const marginCfd = await sdk.marginCfd() // or marginForex or marginCrypto

const underlyings = marginCfd.getUnderlyingsAvailableForTradingAt(sdk.currentTime())

const firstUnderlying = underlyings.find((u) => {
	return u.activeId === 1
})

const firstUnderlyingInstruments = await firstUnderlying.instruments()

const firstUnderlyingAvailableInstruments = firstUnderlyingInstruments.getAvailableForBuyAt(sdk.currentTime())

const firstInstrument = firstUnderlyingAvailableInstruments[0]

// The 3rd argument is `count` = quantity * instrument.lotSize, NOT a bare quantity.
// instrument.lotSize is 100000 for Forex and 1 for CFD/Crypto, so for Forex a bare `1` means
// 1 unit - 100000x smaller than 1 lot. The same `count` is expected by calculateMargin(),
// buyStop() and buyLimit(), so always build it the same way.
const count = firstInstrument.minQty * firstInstrument.lotSize

const callOption = await marginCfd.buy(firstInstrument, Margin.Buy, count, balance)
console.log(callOption)

const putOption = await marginCfd.buy(firstInstrument, Margin.Sell, count, balance)
console.log(putOption)
```

### Calculate required margin and pip value

Use `calculateMargin()` to estimate the required margin and pip (point) value for a margin trade before
opening it. It returns a refreshable object that recomputes automatically whenever the underlying quote,
the exchange rate or the balance equity changes.

```js
const marginCfd = await sdk.marginCfd() // or marginCrypto

const underlyings = marginCfd.getUnderlyingsAvailableForTradingAt(sdk.currentTime())
const instruments = await underlyings[0].instruments()
const instrument = instruments.getAvailableForBuyAt(sdk.currentTime())[0]

// `count` is a quantity multiplied by the instrument lot size, the same value you pass to buy().
// Use instrument.lotSize (Forex = 100000, CFD/Crypto = 1) instead of hard-coding the lot size.
// Passing a bare quantity (forgetting * lotSize) makes the Forex margin come out 100000x too
// small - e.g. 0.2 instead of 20000 - because CFD/Crypto lotSize is 1 but Forex lotSize is 100000.
const count = instrument.minQty * instrument.lotSize

// Direction is optional - omit it to price at the mid quote. Pass a pending price as the
// 5th argument to price a pending (stop/limit) order.
const calculation = await marginCfd.calculateMargin(instrument, count, balance, Margin.Buy)

// margin and pipValue are expressed in the balance (account) currency. They are `undefined`
// until the first quote / exchange-rate tick arrives, so read them via subscribeOnUpdate.
calculation.subscribeOnUpdate((c) => {
	console.log('margin:', c.margin, 'pip value:', c.pipValue)
})
```

### Calculate margin for a Forex instrument

Forex works the same way. `instrument.lotSize` returns 100000 for Forex (and 1 for CFD/Crypto), so the
`count` expression is identical.

```js
const marginForex = await sdk.marginForex()

const underlyings = marginForex.getUnderlyingsAvailableForTradingAt(sdk.currentTime())
const instruments = await underlyings[0].instruments()
const instrument = instruments.getAvailableForBuyAt(sdk.currentTime())[0]

const count = instrument.minQty * instrument.lotSize

const calculation = await marginForex.calculateMargin(instrument, count, balance, Margin.Buy)

calculation.subscribeOnUpdate((c) => {
	console.log('margin:', c.margin, 'pip value:', c.pipValue)
})
```

### Calculate take-profit / stop-loss PnL

`pnlForTPSL(openPrice, tpslPrice)` returns the PnL (in the account currency) the position would realise
if the price reached the given trigger price. Both arguments are absolute prices: `openPrice` is the
position open price and `tpslPrice` is the take-profit or stop-loss level. It relies on the live pip
value, so call it from `subscribeOnUpdate` - it returns `undefined` until the first tick.

```js
const calculation = await marginForex.calculateMargin(instrument, count, balance, Margin.Buy)

calculation.subscribeOnUpdate((c) => {
	const openPrice = 1.2345 // position open (underlying) price

	// Take-profit / stop-loss trigger prices. These are absolute prices, not deltas;
	// here they are 0.0010 (10 pips on a 4-decimal pair) above / below the open price.
	const takeProfitPrice = openPrice + 0.0010
	const stopLossPrice = openPrice - 0.0010

	// For a Buy, a take-profit above the open price yields a positive PnL,
	// and a stop-loss below it yields a negative PnL (reversed for a Sell).
	console.log('take-profit PnL:', c.pnlForTPSL(openPrice, takeProfitPrice))
	console.log('stop-loss PnL:', c.pnlForTPSL(openPrice, stopLossPrice))
})
```

---

## Draw chart using RealTimeChartDataLayer and Trading View Lightweight Charts

This example shows how to build a simple real-time chart using [
`lightweight-charts`](https://www.npmjs.com/package/lightweight-charts) and the `RealTimeChartDataLayer` facade.

### Prerequisites

```bash
npm install @quadcode-tech/client-sdk-js lightweight-charts @mantine/core
```

## Example (React)

### src/App.tsx

```tsx
import React from 'react';
import {SdkProvider} from "../provider/SdkProvider.tsx";

export default function App() {
    return (
        <SdkProvider>
            <TradingView/>
        </SdkProvider>
    );
}

```

### src/context/SdkContext.ts

```ts
import {createContext} from 'react';
import {ClientSdk} from "@quadcode-tech/client-sdk-js";

export const SdkContext = createContext<ClientSdk | null>(null);
```

### src/provider/SdkProvider.tsx

```tsx
import {ReactNode, useEffect, useRef, useState} from 'react';
import {ClientSdk, SsidAuthMethod} from '@quadcode-tech/client-sdk-js';
import {SdkContext} from '../context/SdkContext.tsx';
import LoadingPage from '../components/LoadingPage.tsx';

export const SdkProvider = ({children}: { children: ReactNode }) => {
    const [sdk, setSdk] = useState<ClientSdk | null>(null);
    const hasInitializedRef = useRef(false);

    useEffect(() => {
        if (hasInitializedRef.current) {
            return;
        }

        hasInitializedRef.current = true;
        const init = async () => {
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('SDK init timeout')), 10000)
            );

            try {
                const sdk = await Promise.race([
                    ClientSdk.create(
                        'wss://ws.trade.example.com/echo/websocket',
                        82,
                        new SsidAuthMethod('YOUR_SSID'),
                        {
                            host: window.location.origin,
                        }
                    ),
                    timeoutPromise,
                ]);

                setSdk(sdk);
            } catch (err) {
                console.error('Failed to initialize SDK:', err);
            }
        };

        init().catch(console.error);
    }, []);

    if (!sdk) return <LoadingPage/>;

    return <SdkContext.Provider value={sdk}>{children}</SdkContext.Provider>;
};
```

### src/hooks/useSdk.ts

```tsx
import {useContext} from 'react';
import {SdkContext} from '../context/SdkContext';
import type {ClientSdk} from '@quadcode-tech/client-sdk-js';

export const useSdk = (): ClientSdk => {
    const sdk = useContext(SdkContext);
    if (!sdk) {
        throw new Error('useSdk must be used within SdkProvider');
    }
    return sdk;
};
```

### src/pages/Home.page.tsx

```tsx
import {Chart} from '../components/Chart';
import {Flex, Select} from "@mantine/core";
import {useEffect, useState} from "react";
import {useSdk} from "../hooks/useSdk.ts";
import {Active} from "../types/Active.ts";

const candleSizes = [
    1, 5, 10, 15, 30, 60, 120, 300, 600, 900,
    1800, 3600, 7200, 14400, 28800, 43200,
    86400, 604800, 2592000,
];

export default function HomePage() {
    const sdk = useSdk();
    const [actives, setActives] = useState<Active[]>([]);
    const [selectedActiveId, setSelectedActiveId] = useState<string | null>(null);
    const [selectedCandleSize, setSelectedCandleSize] = useState<string | null>('10'); // default 1 min

    useEffect(() => {
        if (!sdk) return;

        const init = async () => {
            const now = sdk.currentTime();
            const blitzOptions = await sdk.blitzOptions();
            const blitzOptionsActives = blitzOptions.getActives()
                .filter((a) => a.canBeBoughtAt(now))
                .map((a) => ({
                    id: a.id,
                    title: a.ticker ?? `Active ${a.id}`,
                }));

            setActives(blitzOptionsActives);
            if (blitzOptionsActives.length > 0) {
                setSelectedActiveId(String(blitzOptionsActives[0].id));
            }
        };

        init().then();
    }, [sdk]);

    return (
        <Flex>
            <Flex direction="column" w="80%">
                {selectedActiveId && (
                    <Chart
                        activeId={parseInt(selectedActiveId)}
                        candleSize={parseInt(selectedCandleSize!)}
                        chartHeight={400}
                        chartMinutesBack={60}
                    />
                )}
            </Flex>

            <Flex w="20%" p={10} direction="column" gap="sm">
                <Select
                    label="Active"
                    placeholder="Choose an active"
                    value={selectedActiveId}
                    onChange={setSelectedActiveId}
                    data={actives.map((a) => ({
                        value: String(a.id),
                        label: a.title ?? `Active ${a.id}`,
                    }))}
                />

                <Select
                    label="Candle Size (sec)"
                    placeholder="Choose candle size"
                    value={selectedCandleSize}
                    onChange={setSelectedCandleSize}
                    data={candleSizes.map((s) => ({
                        value: String(s),
                        label: `${s} sec`,
                    }))}
                />
            </Flex>
        </Flex>
    );
}
```

### src/components/Chart.tsx

```tsx
import {useEffect, useRef} from 'react';
import {CandlestickSeries, createChart, UTCTimestamp} from 'lightweight-charts';
import {useSdk} from '../hooks/useSdk.ts';
import {Candle} from '@quadcode-tech/client-sdk-js';

interface ChartProps {
    activeId: number;
    candleSize: number;
    chartHeight?: number;
    chartMinutesBack?: number;
}

export function Chart({activeId, candleSize, chartHeight = 400, chartMinutesBack = 60}: ChartProps) {
    const sdk = useSdk();
    const containerRef = useRef<HTMLDivElement>(null);
    const earliestLoadedRef = useRef<number | null>(null);
    const fetchingRef = useRef<boolean>(false);

    useEffect(() => {
        if (!sdk || !containerRef.current) return;

        const chart = createChart(containerRef.current, {
            layout: {textColor: 'black'},
            height: chartHeight,
        });

        const series = chart.addSeries(CandlestickSeries);

        const initChart = async () => {
            const chartLayer = await sdk.realTimeChartDataLayer(activeId, candleSize);
            const from = Math.floor(Date.now() / 1000) - chartMinutesBack * 60;
            const candles = await chartLayer.fetchAllCandles(from);

            const format = (cs: Candle[]) =>
                cs.map((c) => ({
                    time: c.from as UTCTimestamp,
                    open: c.open,
                    high: c.max,
                    low: c.min,
                    close: c.close,
                }));

            series.setData(format(candles));

            if (candles.length > 0) {
                earliestLoadedRef.current = candles[0].from as number;
            }

            chartLayer.subscribeOnLastCandleChanged((candle) => {
                series.update({
                    time: candle.from as UTCTimestamp,
                    open: candle.open,
                    high: candle.max,
                    low: candle.min,
                    close: candle.close,
                });
            });

            chartLayer.subscribeOnConsistencyRecovered(() => {
                const all = chartLayer.getAllCandles();
                series.setData(format(all));
            });

            chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
                if (!range || !earliestLoadedRef.current || fetchingRef.current) return;

                if ((range.from as number) <= earliestLoadedRef.current) {
                    fetchingRef.current = true;
                    const fetchFrom = earliestLoadedRef.current - chartMinutesBack * 60;

                    chartLayer.fetchAllCandles(fetchFrom).then((moreData) => {
                        const formatted = format(moreData);

                        series.setData(formatted); // можно заменить на merge если нужно
                        if (formatted.length > 0) {
                            earliestLoadedRef.current = formatted[0].time;
                        }
                    }).finally(() => {
                        fetchingRef.current = false;
                    });
                }
            });
        };

        initChart().then();

        return () => {
            chart.remove();
        };
    }, [sdk, containerRef, activeId, candleSize, chartHeight, chartMinutesBack]);

    return <div ref={containerRef} style={{width: '100%', height: chartHeight}}/>;
}
```

This chart will:

* Load historical candles
* Display them using `lightweight-charts`
* Continuously update with new real-time candles

---

## Versioning

The SDK release versions are in the form of X.Y.Z where X represents the major version. Increasing the major version of
an SDK indicates that this SDK underwent significant and substantial changes to support new idioms and patterns in the
language. Major versions are introduced when public interfaces (e.g. classes, methods, types, etc.), behaviors, or
semantics have changed. Applications need to be updated in order for them to work with the newest SDK version. It is
important to update major versions carefully and in accordance with the upgrade guidelines provided in release notes.

## SDK major version lifecycle

The lifecycle for major SDKs versions consists of 5 phases, which are outlined below.

1. Developer Preview (Phase 0) - During this phase, SDKs are not supported, should not be used in production
   environments, and are meant for early access and feedback purposes only. It is possible for future releases to
   introduce breaking changes. Once SDK Developers identify a release to be a stable product, it may mark it as a
   Release Candidate. Release Candidates are ready for GA release unless significant bugs emerge, and will receive full
   SDK Developers support.

2. General Availability (GA) (Phase 1) - During this phase, SDKs are fully supported. SDK Developers will provide
   regular SDK releases that include support for new services, API updates for existing services, as well as bug and
   security fixes. For Tools, SDK Developers will provide regular releases that include new feature updates and bug
   fixes. SDK Developers will support the GA version of an SDK for at least 6 months.

3. Maintenance Announcement (Phase 2) - SDK Developers will make a public announcement at least 6 months before an SDK
   enters maintenance mode. During this period, the SDK will continue to be fully supported. Typically, maintenance mode
   is announced at the same time as the next major version is transitioned to GA.

4. Maintenance (Phase 3) - During the maintenance mode, SDK Developers limit SDK releases to address critical bug fixes
   and security issues only. An SDK will not receive API updates for new or existing services, or be updated to support
   new regions. Maintenance mode has a default duration of 6 months, unless otherwise specified.

5. End-of-Support (Phase 4) - When an SDK reaches end-of support, it will no longer receive updates or releases.
   Previously published releases will continue to be available via public package managers and the code will remain on
   GitHub. The GitHub repository may be archived. Use of an SDK which has reached end-of-support is done at the user's
   discretion. We recommend users upgrade to the new major version.

## Communication methods

Maintenance announcements are communicated over (project releases
page)[https://github.com/quadcode/client-sdk-js/releases].

## For SDK maintainers

### Release process

1) Change `version` field in file `package.json`.
2) Change user agent version in file `src/index.ts`
3) Commit and push the changes.
4) Create a new release on GitHub.
5) Check workflows runs on [Actions](https://github.com/quadcode/client-sdk-js/actions) page.
6) Add documentation link to release notes.
