import { AccountType, AssetData } from "@/types";

/**
 * Mock accounts data for development mode
 */
export const mockAccounts: AccountType[] = [
  {
    id: "pea-123456",
    name: "PEA - Plan d'Épargne en Actions",
    balance: 15420.50,
    bank_name: "Boursorama",
  },
  {
    id: "cto-789012",
    name: "CTO - Compte Titres Ordinaire",
    balance: 8750.25,
    bank_name: "Boursorama",
  },
  {
    id: "avi-345678",
    name: "Assurance Vie",
    balance: 25000.00,
    bank_name: "Boursorama",
  },
];

/**
 * Generate mock assets data
 */
export function generateMockAssetsForPeriod(days: number): AssetData[] {
  return [
    {
      symbol: "1rTCW8",
      name: "AMUNDI ETF MSCI WORLD UCITS ETF",
      color: "#3b82f6",
      quotes: generateMockQuotes(days, 450, 480),
    },
    {
      symbol: "1rTCW9",
      name: "AMUNDI ETF S&P 500 UCITS ETF",
      color: "#10b981",
      quotes: generateMockQuotes(days, 380, 420),
    },
    {
      symbol: "1rTCW0",
      name: "LYXOR ETF NASDAQ-100 UCITS ETF",
      color: "#f59e0b",
      quotes: generateMockQuotes(days, 520, 560),
    },
  ];
}

/**
 * Mock assets data for development mode
 * Generates 1 year of data by default
 */
export const mockAssetsData: AssetData[] = generateMockAssetsForPeriod(365);

/**
 * Simple seeded random number generator
 * Returns a deterministic random number between 0 and 1
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Generate mock quote data for an asset
 * @param days Number of days of historical data
 * @param minPrice Minimum price range
 * @param maxPrice Maximum price range
 * @param seed Seed for random generation
 */
function generateMockQuotes(
  days: number,
  minPrice: number,
  maxPrice: number,
  seed: number = 1000,
) {
  const quotes = [];
  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;

  let currentPrice = (minPrice + maxPrice) / 2;
  let seedCounter = seed;

  for (let i = days - 1; i >= 0; i--) {
    const date = now - i * dayInMs;

    // Random walk with mean reversion using seeded random
    const change = (seededRandom(seedCounter++) - 0.5) * 10;
    currentPrice = Math.max(minPrice, Math.min(maxPrice, currentPrice + change));

    const open = currentPrice;
    const volatility = 5;
    const high = open + seededRandom(seedCounter++) * volatility;
    const low = open - seededRandom(seedCounter++) * volatility;
    const close = low + seededRandom(seedCounter++) * (high - low);
    const volume = Math.floor(10000 + seededRandom(seedCounter++) * 50000);

    quotes.push({
      date,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
    });

    currentPrice = close;
  }

  return quotes;
}

/**
 * Check if development mode is enabled
 */
export function isDevMode(): boolean {
  return import.meta.env.VITE_DEV_MODE === 'true';
}