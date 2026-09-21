export const CURRENCY_CODE = "GHS";
export const CURRENCY_SYMBOL = "GH\u20B5";
export const LOCALE = "en-GH";

/** Combined Ghana levies commonly applied at retail: VAT 15% + NHIL 2.5% + GETFund 2.5% + COVID 1%. */
export const DEFAULT_TAX_RATE = 0.21;

/** Physical Ghana Cedi denominations, used for cash-tender quick keys and drawer counts. */
export const CASH_DENOMINATIONS = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1] as const;

export const MOMO_NETWORK_PREFIXES: Record<string, string[]> = {
  MTN: ["024", "054", "055", "059", "025", "053"],
  VODAFONE: ["020", "050"],
  AIRTELTIGO: ["027", "057", "026", "056"],
};

export const GHANA_REGIONS = [
  "Ahafo",
  "Ashanti",
  "Bono",
  "Bono East",
  "Central",
  "Eastern",
  "Greater Accra",
  "North East",
  "Northern",
  "Oti",
  "Savannah",
  "Upper East",
  "Upper West",
  "Volta",
  "Western",
  "Western North",
] as const;

export const PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 200;
