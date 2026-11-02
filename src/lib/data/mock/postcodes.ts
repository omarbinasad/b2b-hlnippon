/**
 * SAMPLE postcode lookup data — a handful of entries for the demo only. It is
 * NOT a complete or verified list of Japanese postcodes (郵便番号); the real lookup must
 * come from an official/maintained dataset (e.g. the Japan Post postcode data) on the backend.
 * Postcodes are stored as "NNN-NNNN"; `area` is the town (町域).
 */
export interface SamplePostcode {
  postalCode: string;
  postOffice: string;
  area: string;
  city: string;
  prefecture: string;
}

export const samplePostcodes: SamplePostcode[] = [
  { postalCode: "100-0001", postOffice: "Chiyoda", area: "Chiyoda", city: "Chiyoda-ku", prefecture: "Tokyo" },
  { postalCode: "160-0023", postOffice: "Shinjuku", area: "Nishi-Shinjuku", city: "Shinjuku-ku", prefecture: "Tokyo" },
  { postalCode: "150-0043", postOffice: "Shibuya", area: "Dogenzaka", city: "Shibuya-ku", prefecture: "Tokyo" },
  { postalCode: "110-0005", postOffice: "Ueno", area: "Ueno", city: "Taito-ku", prefecture: "Tokyo" },
  { postalCode: "108-0014", postOffice: "Takanawa", area: "Shiba", city: "Minato-ku", prefecture: "Tokyo" },
  { postalCode: "332-0012", postOffice: "Kawaguchi", area: "Honcho", city: "Kawaguchi-shi", prefecture: "Saitama" },
  { postalCode: "231-0023", postOffice: "Yokohama Minato", area: "Yamashitacho", city: "Yokohama-shi Naka-ku", prefecture: "Kanagawa" },
  { postalCode: "530-0001", postOffice: "Osaka Kita", area: "Umeda", city: "Osaka-shi Kita-ku", prefecture: "Osaka" },
  { postalCode: "542-0076", postOffice: "Minami", area: "Namba", city: "Osaka-shi Chuo-ku", prefecture: "Osaka" },
  { postalCode: "600-8216", postOffice: "Kyoto Chuo", area: "Shiokojicho", city: "Kyoto-shi Shimogyo-ku", prefecture: "Kyoto" },
  { postalCode: "460-0008", postOffice: "Nagoya Chuo", area: "Sakae", city: "Nagoya-shi Naka-ku", prefecture: "Aichi" },
  { postalCode: "812-0011", postOffice: "Hakata", area: "Hakataekimae", city: "Fukuoka-shi Hakata-ku", prefecture: "Fukuoka" },
];
