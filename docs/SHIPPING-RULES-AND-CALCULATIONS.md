# Shipping rules and calculations

For the backend developer, and for anyone setting up shipping. All amounts in the demo are samples, and every amount is in the store's currency.

The logic is pure and tested, and it's the reference to match: `src/lib/shipping/engine.ts` (zones and rates), `src/lib/shipping/rules.ts` (conditional rules), tests in `tests/shipping-engine.test.ts` and `tests/shipping-rules.test.ts`.

**The backend must calculate shipping itself at cart, checkout and order creation.** Never trust a charge sent by the browser. The one exception is a staff member entering an agreed charge on an admin order, which needs a reason and is recorded.

## The calculation, in order

1. **Find the zone** for the delivery address.
2. **Measure the cart:** total weight, subtotal and units.
3. **Quote each enabled method** in the zone.
4. **Apply the conditional rules** by priority.
5. **Add shipping class surcharges.**
6. **Apply the visibility settings**, such as hiding paid methods when one is free.
7. **Choose the suggested method:** the cheapest delivery method. Pickup is offered alongside and is never chosen automatically.

### 1. Zones

Each address matches exactly one zone, checked in this order:

1. A zone listing the exact postcode
2. A zone listing the city (region + city)
3. A zone listing the region
4. The fallback zone, which has no locations and can't be deleted

Text comparison ignores case and extra spaces. A postcode, city or region can belong to only one zone, enforced on save. If the matched zone has no available method, checkout shows the "unavailable" message from the shipping settings and can't complete.

### 2. Cart measures

- **Weight** = unit weight × quantity, summed. A variation's weight overrides the product's.
- **Subtotal** = unit price × quantity, summed, after line discounts and before tax and shipping.
- **Units** = the sum of quantities.

### 3. Methods

| Type | Charge |
|---|---|
| Flat rate | A fixed amount |
| Weight-based | The tier whose `from` is the highest not above the weight. A tier runs up to the next tier's `from` |
| Subtotal-based | As above, using the subtotal |
| Free shipping | Zero, when the items subtotal reaches `minSubtotal` |
| Local pickup | Its own charge, usually zero, with instructions |

A method can also have per-class adjustments, per order or per unit.

### 4. Conditional rules

Enabled rules whose zones include this zone (empty means every zone) and whose conditions match run by **priority, lowest number first**. Ties go by name.

**Note:** price rules use the opposite order, where the highest number wins. Keep each as it is, since each is tested and documented, but take care not to mix them up.

**Conditions** are joined by `all` (AND) or `any` (OR). A rule with no conditions always matches.

| Field | Operators | Value |
|---|---|---|
| `subtotal`, `quantity` | `lt`, `lte`, `gt`, `gte` | Number |
| `weight` | `lt`, `lte`, `gt`, `gte` | Kilograms |
| `region`, `city` | `in`, `not_in` | Names, ignoring case |
| `postcode` | `in`, `not_in` | Compared by letters and digits only |
| `category`, `shipping_class`, `product`, `customer_group`, `coupon` | `in`, `not_in` | Ids, slugs or codes. Matches if any cart item matches |

**Actions:**

| Action | Effect |
|---|---|
| `set_charge` | Fixes the base charge. The first such rule wins |
| `tiers` | Fixes the base charge from weight or subtotal tiers. If no tier fits, the rule does nothing and later rules may apply |
| `free` | Delivery is free, and surcharges don't apply. The first such rule wins |
| `surcharge` | Adds an amount. Every matching surcharge applies |
| `hide_method` | Removes a method type |

The first matching `set_charge`, `tiers` or `free` rule decides the base. Later ones are skipped and noted in the trace.

### 5. Class surcharges

For each shipping class with a surcharge and at least one unit in the cart, add the amount once per order or once per unit, after rule surcharges. Free still means free.

### 6. Settings

- **Hide paid delivery when free is available:** pickup stays available.
- **Unavailable message:** shown when no method is left.

### Final charge

```
base      = rule's charge, or the method's own
surcharges = rule surcharges + class surcharges
final     = 0 when free, otherwise base + surcharges
```

Money uses integer minor units with half-up rounding (`toMinor`, `fromMinor` in `src/lib/orders/calc.ts`). Local pickup keeps its own charge, and rules don't change it.

## Worked example

These are sample values, in yen:

- Address: Shinjuku-ku, Tokyo, postcode 160-0023. The zone lists Tokyo but not that city or postcode, so it matches at the region level.
- Cart: 12 kg, subtotal ¥28,000, 3 units, one unit in a "Chilled" class with a ¥300 per-order surcharge.
- Methods: flat ¥800; weight tiers from 0 kg ¥600, from 10 kg ¥1,200.
- Rules: priority 10 surcharges ¥200 when weight is above 10 kg; priority 20 makes delivery free when the subtotal is at least ¥50,000 (doesn't match).

| Step | Flat | Weight |
|---|---|---|
| Method charge | ¥800 | ¥1,200 |
| Rule surcharge | +¥200 | +¥200 |
| Class surcharge | +¥300 | +¥300 |
| **Final** | **¥1,300** | **¥1,700** |

Suggested method: flat, at ¥1,300.

## Admin screens and how far they've been checked

All of these were browser-tested in the demo (Batch 7).

| Screen | URL |
|---|---|
| Zones and guided wizard | `/admin/shipping`, `/admin/shipping/new` |
| Methods overview | `/admin/shipping/methods` |
| Conditional rules | `/admin/shipping/rules` |
| Classes | `/admin/shipping/classes` |
| Pickup locations | `/admin/shipping/pickup` |
| Settings | `/admin/shipping/settings` |
| Calculator, with an explanation of each decision | `/admin/shipping/preview` |

## Known limits in the demo

- Choosing pickup at checkout records it as the shipping label, with delivery as the fulfilment type on customer orders. The backend should store pickup and its location properly.
- Dimensional weight isn't modelled.
- Delivery route cut-offs are shown to customers but not enforced at checkout. See [BACKEND-PENDING-FEATURES.md](BACKEND-PENDING-FEATURES.md).
