/**
 * Staff looking at the store see the STANDARD wholesale price: what an approved customer with no group and no
 * customer-specific rule pays (rules for all approved customers and sale prices still apply).
 *
 * In the mock layer the pricing calls take a customer id, so staff pass this id. The HTTP adapter never sends a customer
 * id: the backend decides from the session, and returns standard prices to a staff session.
 */
export const STANDARD_PRICING_ID = "standard-pricing";
