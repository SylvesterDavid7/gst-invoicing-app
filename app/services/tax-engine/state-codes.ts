/**
 * Statutory Indian GST State Codes & Normalization
 * Standard 2-digit codes defined under the Central Goods and Services Tax Rules.
 */

export interface GstState {
  code: string;
  name: string;
  aliases: string[];
}

export const GST_STATE_MAP: Record<string, GstState> = {
  "01": { code: "01", name: "Jammu and Kashmir", aliases: ["JK", "JAMMU & KASHMIR", "JAMMU AND KASHMIR"] },
  "02": { code: "02", name: "Himachal Pradesh", aliases: ["HP", "HIMACHAL PRADESH"] },
  "03": { code: "03", name: "Punjab", aliases: ["PB", "PUNJAB"] },
  "04": { code: "04", name: "Chandigarh", aliases: ["CH", "CHANDIGARH"] },
  "05": { code: "05", name: "Uttarakhand", aliases: ["UK", "UA", "UTTARAKHAND", "UTTARANCHAL"] },
  "06": { code: "06", name: "Haryana", aliases: ["HR", "HARYANA"] },
  "07": { code: "07", name: "Delhi", aliases: ["DL", "DELHI", "NEW DELHI", "NATIONAL CAPITAL TERRITORY OF DELHI"] },
  "08": { code: "08", name: "Rajasthan", aliases: ["RJ", "RAJASTHAN"] },
  "09": { code: "09", name: "Uttar Pradesh", aliases: ["UP", "UTTAR PRADESH"] },
  "10": { code: "10", name: "Bihar", aliases: ["BR", "BIHAR"] },
  "11": { code: "11", name: "Sikkim", aliases: ["SK", "SIKKIM"] },
  "12": { code: "12", name: "Arunachal Pradesh", aliases: ["AR", "ARUNACHAL PRADESH"] },
  "13": { code: "13", name: "Nagaland", aliases: ["NL", "NAGALAND"] },
  "14": { code: "14", name: "Manipur", aliases: ["MN", "MANIPUR"] },
  "15": { code: "15", name: "Mizoram", aliases: ["MZ", "MIZORAM"] },
  "16": { code: "16", name: "Tripura", aliases: ["TR", "TRIPURA"] },
  "17": { code: "17", name: "Meghalaya", aliases: ["ML", "MEGHALAYA"] },
  "18": { code: "18", name: "Assam", aliases: ["AS", "ASSAM"] },
  "19": { code: "19", name: "West Bengal", aliases: ["WB", "WEST BENGAL"] },
  "20": { code: "20", name: "Jharkhand", aliases: ["JH", "JHARKHAND"] },
  "21": { code: "21", name: "Odisha", aliases: ["OR", "OD", "ODISHA", "ORISSA"] },
  "22": { code: "22", name: "Chhattisgarh", aliases: ["CT", "CG", "CHHATTISGARH"] },
  "23": { code: "23", name: "Madhya Pradesh", aliases: ["MP", "MADHYA PRADESH"] },
  "24": { code: "24", name: "Gujarat", aliases: ["GJ", "GUJARAT"] },
  "25": { code: "25", name: "Daman and Diu", aliases: ["DD", "DAMAN AND DIU"] },
  "26": { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu", aliases: ["DN", "DADRA AND NAGAR HAVELI"] },
  "27": { code: "27", name: "Maharashtra", aliases: ["MH", "MAHARASHTRA"] },
  "28": { code: "28", name: "Andhra Pradesh (Old)", aliases: ["AP_OLD"] },
  "29": { code: "29", name: "Karnataka", aliases: ["KA", "KARNATAKA"] },
  "30": { code: "30", name: "Goa", aliases: ["GA", "GOA"] },
  "31": { code: "31", name: "Lakshadweep", aliases: ["LD", "LAKSHADWEEP"] },
  "32": { code: "32", name: "Kerala", aliases: ["KL", "KERALA"] },
  "33": { code: "33", name: "Tamil Nadu", aliases: ["TN", "TAMIL NADU", "TAMILNADU"] },
  "34": { code: "34", name: "Puducherry", aliases: ["PY", "PUDUCHERRY", "PONDICHERRY"] },
  "35": { code: "35", name: "Andaman and Nicobar Islands", aliases: ["AN", "ANDAMAN AND NICOBAR"] },
  "36": { code: "36", name: "Telangana", aliases: ["TS", "TG", "TELANGANA"] },
  "37": { code: "37", name: "Andhra Pradesh", aliases: ["AP", "ANDHRA PRADESH"] },
  "38": { code: "38", name: "Ladakh", aliases: ["LA", "LADAKH"] },
  "97": { code: "97", name: "Other Territory", aliases: ["OTHER"] }
};

/**
 * Normalizes Shopify province or province_code to standard 2-digit GST State Code
 * @param province Input from Shopify address (e.g. "MH", "Maharashtra", "Karnataka", "29")
 * @returns 2-digit GST state code (e.g. "27") or null if unrecognized
 */
export function normalizeStateCode(province: string | undefined | null): string | null {
  if (!province) return null;

  const cleaned = province.trim().toUpperCase();

  // If already a valid 2-digit state code
  if (GST_STATE_MAP[cleaned]) {
    return cleaned;
  }

  // Look through aliases and names
  for (const [code, entry] of Object.entries(GST_STATE_MAP)) {
    if (entry.name.toUpperCase() === cleaned || entry.aliases.includes(cleaned)) {
      return code;
    }
  }

  return null;
}

/**
 * Get state name by GST code
 */
export function getStateNameByCode(code: string): string {
  return GST_STATE_MAP[code]?.name || "Unknown State";
}
