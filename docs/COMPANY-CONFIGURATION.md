# Company configuration

For whoever sets up a new company on this platform. In the demo, changes are kept in the server's memory and return to the sample after a restart.

## Where to set things

| Screen | What it covers |
| --- | --- |
| Admin → Settings → General | Country, currency, symbol, decimals, number and date format, language, time zone, first day of the week, weight and dimension units |
| Admin → Settings → Company & Branding | Names, description, registration numbers, logos, favicon, colors, fonts, button shape, contact details, address, map, social links, invoice and email branding |
| Admin → Settings → Setup wizard | The same settings as 10 guided steps, plus links to shipping, tax, payments, pricing and content |

**Restore sample settings** on both settings pages puts the sample company back. Demo only.

## Logos

| Logo | Used for | If empty |
| --- | --- | --- |
| Main | Everywhere by default | The store name shows as text |
| Light | Light backgrounds | Main logo |
| Dark | Dark theme and the admin sidebar | Main logo |
| Mobile | Store header on phones | Light or dark logo |
| Favicon | Browser tab | Browser default |

Upload JPEG, PNG or WebP files up to 4 MB. SVG is not accepted, because SVG files can contain scripts. Files are checked by their content, not their name.

## Colors

| Setting | Where it shows |
| --- | --- |
| Primary | Buttons, links, charts |
| Secondary | Admin sidebar, home hero |
| Accent | Call-to-action buttons and badges |

Dark mode uses a lighter version automatically. Text on these colors switches between black and white for contrast.

## Country and currency

Choosing a country fills in suggested currency, number format, time zone and first weekday. All can be changed. It also switches address rules: labels (Prefecture, Division, State), the region list, and phone and postcode checks. If your contact details don't fit the new country, the page asks you to correct them before saving.

**Changing currency does not convert amounts.** ¥1,000 becomes ৳1,000. Use it when setting up a new company, not on a store with real prices.

## Starting a new deployment

1. Edit `src/config/sample-company.ts` with the company's values, or load them from the backend once it exists.
2. Put logo files in `public/brand`, or upload them in Company & Branding.
3. Replace the sample catalog, customers, zones and content.
4. Run the setup wizard to check everything.
