import { company } from "../config/runtime.ts";

/**
 * Japan's 47 prefectures (都道府県), the top address level, in the official north-to-south order.
 * Stored values are the English names; `prefectureLabel()` adds the Japanese name for display.
 * Pure (no imports), so the shipping and tax engines and the tests can use it directly.
 */
export const PREFECTURES = [
  ["Hokkaido", "北海道"], ["Aomori", "青森県"], ["Iwate", "岩手県"], ["Miyagi", "宮城県"], ["Akita", "秋田県"],
  ["Yamagata", "山形県"], ["Fukushima", "福島県"], ["Ibaraki", "茨城県"], ["Tochigi", "栃木県"], ["Gunma", "群馬県"],
  ["Saitama", "埼玉県"], ["Chiba", "千葉県"], ["Tokyo", "東京都"], ["Kanagawa", "神奈川県"], ["Niigata", "新潟県"],
  ["Toyama", "富山県"], ["Ishikawa", "石川県"], ["Fukui", "福井県"], ["Yamanashi", "山梨県"], ["Nagano", "長野県"],
  ["Gifu", "岐阜県"], ["Shizuoka", "静岡県"], ["Aichi", "愛知県"], ["Mie", "三重県"], ["Shiga", "滋賀県"],
  ["Kyoto", "京都府"], ["Osaka", "大阪府"], ["Hyogo", "兵庫県"], ["Nara", "奈良県"], ["Wakayama", "和歌山県"],
  ["Tottori", "鳥取県"], ["Shimane", "島根県"], ["Okayama", "岡山県"], ["Hiroshima", "広島県"], ["Yamaguchi", "山口県"],
  ["Tokushima", "徳島県"], ["Kagawa", "香川県"], ["Ehime", "愛媛県"], ["Kochi", "高知県"], ["Fukuoka", "福岡県"],
  ["Saga", "佐賀県"], ["Nagasaki", "長崎県"], ["Kumamoto", "熊本県"], ["Oita", "大分県"], ["Miyazaki", "宮崎県"],
  ["Kagoshima", "鹿児島県"], ["Okinawa", "沖縄県"],
] as const;

export const JP_PREFECTURES = PREFECTURES.map(([en]) => en) as unknown as readonly (typeof PREFECTURES)[number][0][];

export type JpPrefecture = (typeof PREFECTURES)[number][0];

const japanese = new Map<string, string>(PREFECTURES.map(([en, ja]) => [en, ja]));

/** "Tokyo 東京都" for dropdowns and addresses; unknown values are returned as they are. */
export const prefectureLabel = (name: string) => (japanese.has(name) ? `${name} ${japanese.get(name)}` : name);

const BD_DIVISIONS = ["Barishal", "Chattogram", "Dhaka", "Khulna", "Mymensingh", "Rajshahi", "Rangpur", "Sylhet"] as const;
const US_STATES = ["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","District of Columbia","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming"] as const;

/** Top address level per country. A country not listed here uses a free-text field. */
const REGIONS: Record<string, readonly string[]> = { JP: JP_PREFECTURES, BD: BD_DIVISIONS, US: US_STATES };

export interface AddressLabels {
  region: string;
  /** Local-language name shown next to the label, when the country has one. */
  regionLocal?: string;
  postcode: string;
  postcodeLocal?: string;
  postcodeMark?: string;
  cityLocal?: string;
}

const LABELS: Record<string, AddressLabels> = {
  JP: { region: "Prefecture", regionLocal: "都道府県", postcode: "Postcode", postcodeLocal: "郵便番号", postcodeMark: "〒", cityLocal: "市区町村" },
  BD: { region: "Division", postcode: "Postcode" },
  US: { region: "State", postcode: "ZIP code" },
  CA: { region: "Province", postcode: "Postal code" },
  GB: { region: "County", postcode: "Postcode" },
};
const DEFAULT_LABELS: AddressLabels = { region: "State / region", postcode: "Postcode" };

export const storeCountry = () => company().locale.country;
export const regionNames = (country = storeCountry()): readonly string[] => REGIONS[country] ?? [];
export const addressLabels = (country = storeCountry()): AddressLabels => LABELS[country] ?? DEFAULT_LABELS;

/** In a listed country the value must be on the list; elsewhere any text will do. */
export function isKnownRegion(name: string, country = storeCountry()) {
  const list = regionNames(country);
  const n = name.trim().toLowerCase();
  return list.length ? list.some((r) => r.toLowerCase() === n) : n.length > 0;
}

/** "Prefecture / 都道府県" where the country has a local name. */
export const regionFieldLabel = (country?: string) => {
  const l = addressLabels(country);
  return l.regionLocal ? `${l.region} / ${l.regionLocal}` : l.region;
};
export const postcodeFieldLabel = (country?: string) => {
  const l = addressLabels(country);
  return l.postcodeLocal ? `${l.postcode} / ${l.postcodeLocal}` : l.postcode;
};
