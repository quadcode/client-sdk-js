# Client SDK for TypeScript and JavaScript applications

## Installation

```shell
npm install @quadcode-tech/client-sdk-js
```

## Quick start

### Initialize SDK facade

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

console.log(positions.getAllPositions().filter((position) => position.instrumentType === InstrumentType.BlitzOption))

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

console.log(positionsHistory.getPositions())
```

### Sell position

```js
const positions = await sdk.positions()
const position = positions.getAllPositions().find((position) => position.externalId == 1)
await position.sell() // not available for blitz options 
```

### Potential profit calculation

```js
const positions = await sdk.positions()
const position = positions.getAllPositions().find((position) => position.externalId == 1)
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

console.log(positions.getAllPositions().filter((position) => position.instrumentType === InstrumentType.TurboOption))

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

console.log(positions.getAllPositions().filter((position) => position.instrumentType === InstrumentType.BinaryOption))

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

console.log(digitalOptionsPositions.getAllPositions().filter((position) => position.instrumentType === InstrumentType.DigitalOption))

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

## Versioning

The SDK release versions are in the form of X.Y.Z where X represents the major version. Increasing the major version of an SDK indicates that this SDK underwent significant and substantial changes to support new idioms and patterns in the language. Major versions are introduced when public interfaces (e.g. classes, methods, types, etc.), behaviors, or semantics have changed. Applications need to be updated in order for them to work with the newest SDK version. It is important to update major versions carefully and in accordance with the upgrade guidelines provided in release notes.

## SDK major version lifecycle

The lifecycle for major SDKs versions consists of 5 phases, which are outlined below.

1. Developer Preview (Phase 0) - During this phase, SDKs are not supported, should not be used in production environments, and are meant for early access and feedback purposes only. It is possible for future releases to introduce breaking changes. Once SDK Developers identify a release to be a stable product, it may mark it as a Release Candidate. Release Candidates are ready for GA release unless significant bugs emerge, and will receive full SDK Developers support.

2. General Availability (GA) (Phase 1) - During this phase, SDKs are fully supported. SDK Developers will provide regular SDK releases that include support for new services, API updates for existing services, as well as bug and security fixes. For Tools, SDK Developers will provide regular releases that include new feature updates and bug fixes. SDK Developers will support the GA version of an SDK for at least 6 months.

3. Maintenance Announcement (Phase 2) - SDK Developers will make a public announcement at least 6 months before an SDK enters maintenance mode. During this period, the SDK will continue to be fully supported. Typically, maintenance mode is announced at the same time as the next major version is transitioned to GA.

4. Maintenance (Phase 3) - During the maintenance mode, SDK Developers limit SDK releases to address critical bug fixes and security issues only. An SDK will not receive API updates for new or existing services, or be updated to support new regions. Maintenance mode has a default duration of 6 months, unless otherwise specified.

5. End-of-Support (Phase 4) - When an SDK reaches end-of support, it will no longer receive updates or releases. Previously published releases will continue to be available via public package managers and the code will remain on GitHub. The GitHub repository may be archived. Use of an SDK which has reached end-of-support is done at the user's discretion. We recommend users upgrade to the new major version.

## Communication methods

Maintenance announcements are communicated over (project releases page)[https://github.com/quadcode/client-sdk-js/releases].

## For SDK maintainers

### Release process

1) Change `version` field in file `package.json`.
2) Change user agent version in file `src/index.ts`
3) Commit and push the changes.
4) Create a new release on GitHub.
5) Check workflows runs on [Actions](https://github.com/quadcode/client-sdk-js/actions) page.
6) Add documentation link to release notes.
