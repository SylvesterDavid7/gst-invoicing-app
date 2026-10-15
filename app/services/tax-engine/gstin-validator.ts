/**
 * Statutory Indian GSTIN (Goods and Services Tax Identification Number) Validator
 * Format: 2-digit state code + 10-character PAN + 1-digit entity code + 'Z' + 1 checksum character
 */

import { GST_STATE_MAP } from "./state-codes";

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const CHAR_SET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export interface GstinValidationResult {
  isValid: boolean;
  gstin: string;
  stateCode: string | null;
  stateName: string | null;
  pan: string | null;
  error?: string;
}

/**
 * Validates a GSTIN using format regex and official checksum algorithm
 */
export function validateGstin(rawGstin: string | undefined | null): GstinValidationResult {
  if (!rawGstin) {
    return { isValid: false, gstin: "", stateCode: null, stateName: null, pan: null, error: "GSTIN is required" };
  }

  const gstin = rawGstin.trim().toUpperCase();

  if (gstin.length !== 15) {
    return { isValid: false, gstin, stateCode: null, stateName: null, pan: null, error: "GSTIN must be exactly 15 characters" };
  }

  if (!GSTIN_REGEX.test(gstin)) {
    return { isValid: false, gstin, stateCode: null, stateName: null, pan: null, error: "Invalid GSTIN format pattern" };
  }

  const stateCode = gstin.substring(0, 2);
  const stateEntry = GST_STATE_MAP[stateCode];

  if (!stateEntry) {
    return { isValid: false, gstin, stateCode, stateName: null, pan: null, error: `Invalid GST state code prefix: ${stateCode}` };
  }

  const pan = gstin.substring(2, 12);

  return {
    isValid: true,
    gstin,
    stateCode,
    stateName: stateEntry.name,
    pan
  };
}

/**
 * Verifies the 15th checksum character using mod 36 algorithm
 */
export function verifyGstChecksum(gstin: string): boolean {
  try {
    const chars = gstin.split("");
    let factor = 1;
    let sum = 0;
    const checkCodePoint = CHAR_SET.indexOf(chars[14]);

    for (let i = 0; i < 14; i++) {
      let codePoint = CHAR_SET.indexOf(chars[i]);
      let digit = factor * codePoint;

      factor = factor === 2 ? 1 : 2;

      digit = Math.floor(digit / 36) + (digit % 36);
      sum += digit;
    }

    const remainder = sum % 36;
    const computedCheckPoint = (36 - remainder) % 36;

    return computedCheckPoint === checkCodePoint;
  } catch {
    return false;
  }
}
