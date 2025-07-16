/** Returns a random float with 6‑digit precision */
function rand6(n: number): number {
    return +n.toFixed(6);
}

/** Shortcut: just alias rand6 so code reads semantic */
const clamp6 = rand6;
/** Small helper to pick a random boolean */
const randBool = (): boolean => Math.random() < 0.5;

/** Generates a realistic candle object */
function makeCandle(id: number, from: number, to: number, lastPrice?: number) {
    // Step 1 – choose a base price: continue from previous close or fresh 1.30‑1.40
    const base = lastPrice ?? rand6(Math.random() * 0.1 + 1.3);

    // Step 2 – tiny delta (≤ 0.0001) for open / close swings
    const delta = rand6(Math.random() * 1e-4);
    const open = rand6(base + (randBool() ? delta : -delta));
    const close = rand6(base + (randBool() ? delta : -delta));

    // Step 3 – min / max ± a pinch (≤ 0.00005)
    const extra = rand6(Math.random() * 5e-5);
    const min = rand6(Math.min(open, close) - extra);
    const max = rand6(Math.max(open, close) + extra);

    // Step 4 – random volume 1‑10000
    const volume = Math.floor(Math.random() * 10_000) + 1;

    return {id, from, to, open, close, min, max, volume} as const;
}

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

/**
 * Generates JSON string for a *single* 1‑second candle in the format:
 * {
 *   "candles_by_size": {
 *     "1": { ... }
 *   }
 * }
 */
export function generateFirstCandleJson(id: number, from: number, size: number,): {
    candles_by_size: {
        [p: string]: {
            readonly id: number;
            readonly from: number;
            readonly to: number;
            readonly open: number;
            readonly close: number;
            readonly min: number;
            readonly max: number;
            readonly volume: number
        }
    }
} {
    const to = from + size;
    const candle = makeCandle(id, from, to);
    return {candles_by_size: {[String(size)]: candle}};
}

/**
 * Generates JSON string with an array of `count` candles of arbitrary size.`
 */
export function generateCandlesJson(
    startId: number,
    from: number,
    candleSizeSec: number,
    count: number,
    /** id или пары [from,to] которые нужно вырезать из ответа */
    exclude: (number | [number, number])[] = [],
): {
    candles: ReturnType<(id: number, from: number, to: number, lastPrice?: number) => {
        id: number;
        from: number;
        to: number;
        open: number;
        close: number;
        min: number;
        max: number;
        volume: number
    }>[]
} {
    const candles = buildCandlesArray(startId, from, candleSizeSec, count, exclude);
    return {candles};
}

/**
 * Generates **только пропущенные** свечи – удобно, чтобы сервер‑мок мог
 * вернуть их, когда клиент запрашивает «дыры».
 *
 * @param missing   id‑список или диапазоны тех свечей, которые нужно сгенерировать
 *                  (чаще всего — те же, что передавали в `exclude` выше)
 */
export function generateMissingCandlesJson(
    startId: number,
    from: number,
    candleSizeSec: number,
    missing: (number | [number, number])[],
): {
    candles: ReturnType<(id: number, from: number, to: number, lastPrice?: number) => {
        id: number;
        from: number;
        to: number;
        open: number;
        close: number;
        min: number;
        max: number;
        volume: number
    }>[]
} {
    // превратим диапазоны в плоский Set id‑шек
    const wanted: number[] = [];
    for (const m of missing) {
        if (Array.isArray(m)) {
            for (let id = m[0]; id <= m[1]; id++) wanted.push(id);
        } else {
            wanted.push(m);
        }
    }

    const candles = buildCandlesArray(startId, from, candleSizeSec, wanted.length, [], wanted);
    return {candles};
}

function buildCandlesArray(
    startId: number,
    from: number,
    candleSizeSec: number,
    count: number,
    exclude: (number | [number, number])[] = [],
    includeOnly: number[] | null = null,
) {
    const shouldSkip = (id: number) =>
        exclude.some(e => Array.isArray(e) ? id >= e[0] && id <= e[1] : id === e);


    const candles: ReturnType<typeof makeCandle>[] = [];
    let lastClose: number | undefined;

    // если includeOnly задан, бежим по id именно из него
    if (includeOnly) {
        for (const id of includeOnly) {
            const offset = id - startId;
            const candleFrom = from + offset * candleSizeSec;
            const candleTo = candleFrom + candleSizeSec;
            const c = makeCandle(id, candleFrom, candleTo, lastClose);
            candles.push(c);
            lastClose = c.close;
        }
    } else {
        for (let i = 0; i < count; i++) {
            const id = startId + i;
            if (shouldSkip(id)) continue;

            const candleFrom = from + i * candleSizeSec;
            const candleTo = candleFrom + candleSizeSec;
            const c = makeCandle(id, candleFrom, candleTo, lastClose);
            candles.push(c);
            lastClose = c.close;
        }
    }
    return candles;
}

/**
 * Starts an endless stream of candles with a given size (seconds).
 * Every second it emits an updated snapshot of the current candle; when the
 * second hand reaches the candle boundary (`now === to`) a new bar starts.
 *
 * Returns a stop() function to clear the interval.
 */
export function startCandleStream(
    ws: { send(o: unknown): void },
    activeId: number,
    candleSizeSec = 60,
    startId = 1,
    skipIds: (number | [number, number])[] = [],
    maxId: number | null = null,
    openIds: (number | [number, number])[] = [], // Works only with size=1
) {
    const inRange = (arr: (number | [number, number])[]) =>
        (id: number) => arr.some(e => Array.isArray(e) ? id >= e[0] && id <= e[1] : id === e);
    const shouldSkip = inRange(skipIds);
    const isOpenId = inRange(openIds);
    const align = (t: number) => Math.floor(t / candleSizeSec) * candleSizeSec;

    let barFrom = align(Math.floor(Date.now() / 1000));
    let barTo = barFrom + candleSizeSec;
    let id = startId;
    let open = rand6(Math.random() * 0.1 + 1.3);
    let last = open;
    let min = open;
    let max = open;
    let volume = 0;

    const timer = setInterval(() => {
        if (maxId !== null && id > maxId) {
            clearInterval(timer);
            return;
        }

        const nowSec = Math.floor(Date.now() / 1000);

        // tiny tick
        const tick = rand6((Math.random() - 0.5) * 0.0001);
        last = clamp6(open + tick);
        min = Math.min(min, last);
        max = Math.max(max, last);
        volume += Math.floor(Math.random() * 10) + 1;

        if (!shouldSkip(id)) {
            const nowSecNanos = nowSec * 1_000_000_000; // секунды → наносекунды (0 µs внутри текущей секунды)
            const atNanos = candleSizeSec === 1
                ? (isOpenId(id) ? nowSecNanos - 500_000_000 : barTo * 1_000_000_000)
                : nowSecNanos;

            ws.send(JSON.stringify({
                name: 'candle-generated',
                microserviceName: 'quotes',
                msg: {
                    active_id: activeId,
                    size: candleSizeSec,
                    at: atNanos,
                    from: barFrom,
                    to: barTo,
                    id,
                    open,
                    close: last,
                    min,
                    max,
                    ask: clamp6(last + 0.00002),
                    bid: clamp6(last - 0.00002),
                    volume,
                    phase: nowSec < barTo ? 'T' : 'C',
                },
            }));
        }

        if (nowSec >= barTo) {
            barFrom = barTo;
            barTo = barFrom + candleSizeSec;
            open = last;
            min = open;
            max = open;
            volume = 0;
        }

        id += 1;
    }, 1_000);

    return () => clearInterval(timer);
}
