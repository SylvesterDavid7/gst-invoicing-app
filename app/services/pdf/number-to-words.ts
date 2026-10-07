/**
 * Convert numerical INR amount to Indian Currency Words
 * (e.g. Lakhs, Crores, Thousands)
 */

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
];

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
];

function convertBelowThousand(num: number): string {
  let str = "";
  if (num >= 100) {
    str += ONES[Math.floor(num / 100)] + " Hundred ";
    num %= 100;
  }
  if (num >= 20) {
    str += TENS[Math.floor(num / 10)] + " ";
    num %= 10;
  }
  if (num > 0) {
    str += ONES[num] + " ";
  }
  return str.trim();
}

export function convertNumberToIndianWords(amount: number | string): string {
  const numVal = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numVal) || numVal === 0) return "Zero Rupees";

  const parts = numVal.toFixed(2).split(".");
  let integerPart = parseInt(parts[0], 10);
  const paise = parseInt(parts[1], 10);

  if (integerPart === 0 && paise === 0) return "Zero Rupees";

  let result = "";

  // Crores (10,000,000)
  if (integerPart >= 10000000) {
    const crore = Math.floor(integerPart / 10000000);
    result += convertBelowThousand(crore) + " Crore ";
    integerPart %= 10000000;
  }

  // Lakhs (100,000)
  if (integerPart >= 100000) {
    const lakh = Math.floor(integerPart / 100000);
    result += convertBelowThousand(lakh) + " Lakh ";
    integerPart %= 100000;
  }

  // Thousands (1,000)
  if (integerPart >= 1000) {
    const thousand = Math.floor(integerPart / 1000);
    result += convertBelowThousand(thousand) + " Thousand ";
    integerPart %= 1000;
  }

  // Remainder hundreds/tens/ones
  if (integerPart > 0) {
    result += convertBelowThousand(integerPart) + " ";
  }

  result = result.trim() + " Rupees";

  if (paise > 0) {
    result += " and " + convertBelowThousand(paise) + " Paise";
  }

  return result.replace(/\s+/g, " ").trim();
}
