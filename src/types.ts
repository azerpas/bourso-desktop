export interface InitResponse {
  dca_without_password: boolean;
  jobs_to_run: Job[];
}

export interface DcaJob {
  id: string;
  symbol: string;
  account_id: string;
  quantity: number;
  side: string;
  cron_expression: string;
  next_run: number; // timestamp
  enabled: boolean;
}

export interface Daily {
  kind: "Daily";
}

export interface Weekly {
  kind: "Weekly";
  day: number;
}

export interface WeeklyMonthlyDetail {
  day: number;
}

export interface WeeklyMonthly {
  weekly?: WeeklyMonthlyDetail;
  monthly?: WeeklyMonthlyDetail;
}

export interface OrderArgs {
  account: string;
  symbol: string;
  /**
   * Amount in currency
   *
   * Either quantity or amount should be set
   */
  amount: number | undefined;
  /*
   * Quantity of shares
   *
   * Either quantity or amount should be set
   */
  quantity: number | undefined;
  side: string;
}

export interface Order {
  id: string;
  timestamp?: number;
  price: number;
  args: OrderArgs;
}

export interface Command {
  order?: OrderArgs;
}
// {schedule: {Monthly: {day: 2}}, last_run: 0, command: Object}
export interface Job {
  id: string;
  schedule: WeeklyMonthly | "daily";
  last_run: number;
  command: Command;
}

export type AccountKind = "Banking" | "Savings" | "Trading" | "Loans";

export interface AccountType {
  id: string;
  name: string;
  balance: number;
  bank_name: string;
  kind: AccountKind;
}

export interface QuoteTab {
  date: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AssetData {
  symbol: string;
  name: string;
  color: string;
  quotes: QuoteTab[];
}

/**
 * Trading summary item containing either account or positions data
 */
export interface TradingSummaryItem {
  /** Either "account" or "positions" */
  id: string;
  positions?: PositionSummary[];
}

/**
 * Summary of a trading position
 */
export interface PositionSummary {
  /** The symbol of the position ie. 1rTCW8 */
  symbol: string;
  /** The name of the position ie. AMUNDI ETF MSCI WORLD UCITS ETF */
  label: string;
  permalink: string;
  quantity: SummaryValue;
  buyingPrice: SummaryValue;
  amount: SummaryValue;
  last: SummaryValue;
  /** Variation */
  var: SummaryValue;
  gainLoss: SummaryValue;
  gainLossPercent: SummaryValue;
  /** YYYY-MM-DD */
  lastMovementDate: string;
}

/**
 * Represents a numeric value with formatting metadata
 */
export interface SummaryValue {
  value: number;
  decimals: number;
  currency?: string;
}

/**
 * Summary of a trading account
 */
export interface AccountSummary {
  /** Name of the account */
  name: string;
  currency: string;
  /** eg "TRADING" */
  typeCategory: string;
  /** YYYY-MM-DD */
  activationDate: string;
  balance: SummaryValue;
  cash: SummaryValue;
  valuation: SummaryValue;
  total: SummaryValue;
  gainLoss: SummaryValue;
  gainLossPercent: SummaryValue;
  liquidationAmount: SummaryValue;
  /** Cash deposited */
  contribution: number;
}

export interface Mfa {
  otp_id: string;
  token: string;
  mfa_type: string;
}

export interface UpdateAvailable {
  version: string;
  current_version: string;
  body: string;
  date: string;
}
