/**
 * Store currency. Pure (no imports) so the calculation engines and tests can read it directly.
 * `minorDigits` is how many decimals an amount may have: 0 for JPY (whole yen), 2 for e.g. USD.
 * All money arithmetic is done in integer minor units and rounded once, half-up, to this precision.
 * Changing the currency of a live store needs a backend data migration — it is not a display setting.
 */
export const STORE_CURRENCY = { code: "JPY", symbol: "¥", minorDigits: 0 } as const;
