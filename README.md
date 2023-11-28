# Quadcode system client SDK for TypeScript and JavaScript applications

## Installation

```shell
npm install @quadcode-tech/client-sdk-js
```

## Quick start

### Initialize SDK facade

```js
import {
    QuadcodeClientSdk,
    BalanceType,
    BinaryOptionsDirection,
    BlitzOptionsDirection,
    DigitalOptionsDirection,
    SsidAuthMethod,
    TurboOptionsDirection
} from '@quadcode-tech/client-sdk-js'

const sdk = await QuadcodeClientSdk.create(
    'wss://ws.trade.example.com/echo/websocket',
    82,
    new SsidAuthMethod('c1xxxxxxxxxxxxxxxxxxxxxxxxxxxx97') // B2B-client's application can retrieve SSID over b2b-gateway API: [/v1/b2b-gateway/users/{user_id}/sessions](https://github.com/qc-b2b/api-b2b-gateway/blob/f1e09ad4bb7e68efdd4a9b2105bdd123b0e64c4d/qc-internal-balance-openapi.yaml#L104).
)
```

### Get user's first real balance

```js
const balances = await sdk.balances()

console.log(balances.getBalances())

const balance = balances.getBalances().find((balance) => balance.type === BalanceType.Real)

balance.subscribeOnUpdate((updatedBalance) => console.log(updatedBalance))
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

const blitzOptionsPositions = await blitzOptions.positionsByBalance(balance)

console.log(blitzOptionsPositions.getAllPositions())

blitzOptionsPositions.subscribeOnUpdatePosition((position) => console.log(position))
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

const turboOptionsPositions = await turboOptions.positionsByBalance(balance)

console.log(turboOptionsPositions.getAllPositions())

turboOptionsPositions.subscribeOnUpdatePosition((position) => console.log(position))
```

### Buy binary options

```js
const binaryOptions = await sdk.binaryOptions()

const actives = binaryOptions.getActives()

const firstActive = actives[0]

const firstActiveInstruments = await firstActive.instruments()

const firstActiveAvailableInstruments = firstActiveInstruments.getAvailableForBuyAt(new Date())

const firstInstrument = firstActiveAvailableInstruments[0]

const callOption = await binaryOptions.buy(firstInstrument, BinaryOptionsDirection.Call, 1, balance)
console.log(callOption)

const putOption = await binaryOptions.buy(firstInstrument, BinaryOptionsDirection.Put, 1, balance)
console.log(putOption)
```

### Get positions for binary options

```js
const binaryOptions = await sdk.binaryOptions()

const binaryOptionsPositions = await binaryOptions.positionsByBalance(balance)

console.log(binaryOptionsPositions.getAllPositions())

binaryOptionsPositions.subscribeOnUpdatePosition((position) => console.log(position))
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

const digitalOptionsPositions = await digitalOptions.positionsByBalance(balance)

console.log(digitalOptionsPositions.getAllPositions())

digitalOptionsPositions.subscribeOnUpdatePosition((position) => console.log(position))
```
