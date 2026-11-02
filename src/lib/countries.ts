/**
 * Countries offered for product origin. Static English names (not Intl) so server
 * and browser render identical text. Extend as sourcing grows; the backend should
 * accept any ISO 3166-1 alpha-2 code.
 */
export const originCountries = [
  { code: "BD", name: "Bangladesh" },
  { code: "JP", name: "Japan" },
  { code: "IN", name: "India" },
  { code: "PK", name: "Pakistan" },
  { code: "TH", name: "Thailand" },
  { code: "VN", name: "Vietnam" },
  { code: "MY", name: "Malaysia" },
  { code: "ID", name: "Indonesia" },
  { code: "CN", name: "China" },
  { code: "KR", name: "South Korea" },
  { code: "SG", name: "Singapore" },
  { code: "LK", name: "Sri Lanka" },
  { code: "MM", name: "Myanmar" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "TR", name: "Türkiye" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "BR", name: "Brazil" },
  { code: "AR", name: "Argentina" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "FR", name: "France" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "UA", name: "Ukraine" },
] as const;

export const originCountryName = (code?: string) =>
  code ? (originCountries.find((c) => c.code === code)?.name ?? code) : undefined;
