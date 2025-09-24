# Client SDK for TypeScript and JavaScript applications

## Installation

```shell
npm install @quadcode-tech/client-sdk-js
```

## Quick start with OAuth (PKCE) authentication

### [Online access] Step 1: Redirect user to authorization

```js
import {ClientSdk, OAuthMethod} from '@quadcode-tech/client-sdk-js'

async function startLogin() {
	const oauth = new OAuthMethod(
		'https://api.trade.example.com',
		CLIENT_ID,                                // your client ID (you can request CLIENT_ID and CLIENT_SECRET by creating an issue on GitHub)
		'https://your.app/callback',              // redirect URI
		'full'                                    // scope (e.g. 'full' or 'full offline_access')
	)
	const {url, codeVerifier} = await oauth.createAuthorizationUrl()
	sessionStorage.setItem('pkce_verifier', codeVerifier)
	window.location.href = url
}
```

### [Online access] Step 2: Handle redirect and create SDK instance

```js 
async function handleCallback() {
	const params = new URLSearchParams(window.location.search);
	const code = params.get('code');
	const codeVerifier = sessionStorage.getItem('pkce_verifier');

	if (!code) throw new Error('Missing ?code in callback URL');
	if (!codeVerifier) throw new Error('Missing PKCE code_verifier');

	const oauth = new OAuthMethod(
		'https://api.trade.example.com',
		CLIENT_ID,
		'https://your.app/callback',
		'full'
	);

	const {accessToken, refreshToken} = await oauth.issueAccessTokenWithAuthCode(code, codeVerifier);

	const sdk = await ClientSdk.create(
		'wss://ws.trade.example.com/echo/websocket',
		82,
		new OAuthMethod(
			'https://api.trade.example.com',
			CLIENT_ID,
			'https://your.app/callback',
			'full offline_access',
			undefined,        // no clientSecret in browser
			accessToken,
			refreshToken || undefined
		)
	);

	const balances = await sdk.balances();
	console.log(balances.getBalances());
}
```

### [Offline access] Step 1: Redirect user to authorization

```js
import {ClientSdk, OAuthMethod} from '@quadcode-tech/client-sdk-js'

async function startLogin() {
	const oauth = new OAuthMethod(
		'https://api.trade.example.com',
		CLIENT_ID,                                // your client ID (you can request CLIENT_ID and CLIENT_SECRET by creating an issue on GitHub)
		'https://your.app/callback',              // redirect URI
		'offline_access'                          // scope (e.g. 'full' or 'full offline_access')
	)
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

	const oauth = new OAuthMethod(
		'https://api.trade.example.com',
		Number(process.env.CLIENT_ID),
		'https://your.app/callback',
		'full offline_access',
		process.env.CLIENT_SECRET                 // SECRET: server-side only
	)

	const {accessToken, refreshToken, expiresIn} = await oauth.issueAccessTokenWithAuthCode(code, codeVerifier)

	// Persist refreshToken securely (DB/kv bound to user/session)
	await saveUserRefreshToken(req, refreshToken)

	// Return ONLY a short-lived access token to the browser
	res.json({accessToken, expiresIn})
})

// Optional refresh endpoint (server uses stored refresh token)
app.post('/api/oauth/refresh', async (req, res) => {
	const storedRefreshToken = await loadUserRefreshToken(req)
	if (!storedRefreshToken) return res.status(401).json({error: 'No refresh token'})

	const oauth = new OAuthMethod(
		'https://api.trade.example.com',
		Number(process.env.CLIENT_ID),
		'https://your.app/callback',
		'full offline_access',
		process.env.CLIENT_SECRET,
		undefined,
		storedRefreshToken
	)

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
		'wss://ws.trade.example.com/echo/websocket',
		82,
		new OAuthMethod(
			'https://api.trade.example.com',
			CLIENT_ID,
			'https://your.app/callback',
			'full offline_access',
			undefined,         // NEVER put clientSecret in the browser
			accessToken        // no refresh token in the browser
		)
	)

	// use SDK
	const balances = await sdk.balances()
	console.log(balances.getBalances())
}
```

## Quick start with Login/Password authentication

```js
import {
	ClientSdk,
	BalanceType,
	BinaryOptionsDirection,
	BlitzOptionsDirection,
	DigitalOptionsDirection,
	SsidAuthMethod,
	TurboOptionsDirection
} from '@quadcode-tech/client-sdk-js'

const sdk = await ClientSdk.create(
	'wss://ws.trade.example.com/echo/websocket',
	82,
	new LoginPasswordAuthMethod('https://api.trade.example.com', "login", "password")
)
```

### Optional SDK Configuration

The `ClientSdk.create` method accepts an optional fourth parameter for additional configuration:

```js
const sdk = await ClientSdk.create(
	'wss://ws.trade.example.com/echo/websocket',
	82,
	new LoginPasswordAuthMethod('https://api.trade.example.com', "login", "password"),
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

const blitzOptionsFirstAvailableActive = blitzOptionsActives.find((active) => active.canBeBoughtAt(new Date()))

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

const actives = turboOptions.getActives().filter((active) => active.canBeBoughtAt(new Date()))

const firstActive = actives[0]

const firstActiveInstruments = await firstActive.instruments()

const firstActiveAvailableInstruments = firstActiveInstruments.getAvailableForBuyAt(new Date())

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

const actives = binaryOptions.getActives().filter((active) => active.canBeBoughtAt(new Date()))

const firstActive = actives[0]

const firstActiveInstruments = await firstActive.instruments()

const firstActiveAvailableInstruments = firstActiveInstruments.getAvailableForBuyAt(new Date())

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

const firstActiveAvailableInstruments = firstActiveInstruments.getAvailableForBuyAt(new Date())

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

const underlyings = digitalOptions.getUnderlyingsAvailableForTradingAt(new Date())

const firstUnderlying = underlyings.find((u) => {
	return u.activeId === 1
})

const firstUnderlyingInstruments = await firstUnderlying.instruments()

const firstUnderlyingAvailableInstruments = firstUnderlyingInstruments.getAvailableForBuyAt(new Date())

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

const underlyings = marginCfd.getUnderlyingsAvailableForTradingAt(new Date())

const firstUnderlying = underlyings.find((u) => {
	return u.activeId === 1
})

const firstUnderlyingInstruments = await firstUnderlying.instruments()

const firstUnderlyingAvailableInstruments = firstUnderlyingInstruments.getAvailableForBuyAt(new Date())

const firstInstrument = firstUnderlyingAvailableInstruments[0]

const callOption = await marginCfd.buy(firstInstrument, Margin.Buy, 1, balance)
console.log(callOption)

const putOption = await marginCfd.buy(firstInstrument, Margin.Sell, 1, balance)
console.log(putOption)
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
