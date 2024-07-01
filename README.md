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

const actives = turboOptions.getActives()

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

const actives = binaryOptions.getActives()

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

## For SDK maintainers

### Release process

1) Change `version` field in file `package.json`.
2) Change user agent version in file `src/index.ts`
3) Commit and push the changes.
4) Create a new release on GitHub.
5) Check workflows runs on [Actions](https://github.com/quadcode/client-sdk-js/actions) page.
6) Add documentation link to release notes.
