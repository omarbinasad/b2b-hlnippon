import { company } from "./runtime.ts";

/**
 * Store currency, from the company settings. Pure, so the calculation engines and tests can read it directly.
 * `minorDigits` is how many decimals an amount may have: 0 for JPY (whole yen), 2 for e.g. USD.
 * All money arithmetic is done in integer minor units and rounded once, half-up, to this precision.
 * Changing it relabels amounts and changes rounding; it never converts them. A live store needs a backend migration.
 */
export const STORE_CURRENCY = {
  get code() {
    return company().locale.currencyCode;
  },
  get symbol() {
    return company().locale.currencySymbol;
  },
  get minorDigits() {
    return company().locale.currencyDigits;
  },
  get symbolPosition() {
    return company().locale.symbolPosition;
  },
};
