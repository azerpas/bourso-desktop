import { AccountType, AssetData, Command, Job, OrderArgs, WeeklyMonthly } from "@/types";
import { findAssetDataBySymbol } from "./assetUtils";

export function scheduleToString(schedule: WeeklyMonthly | "daily") {
  if (schedule === "daily") {
    return "Daily";
  } else if (schedule.weekly) {
    return `Weekly: ${schedule.weekly.day}`;
  } else if (schedule.monthly) {
    return `Monthly: ${schedule.monthly.day}`;
  } else {
    return "Unknown";
  }
}

function orderAmountQuantityToString(orderArgs: OrderArgs) {
  if (orderArgs.amount) {
    return `${orderArgs.amount}€ of ${orderArgs.symbol}`;
  } else if (orderArgs.quantity) {
    return `${orderArgs.quantity} share(s) of ${orderArgs.symbol}`;
  } else {
    return "Unknown amount/quantity";
  }
}

export function commandToString(command: Command) {
  if (command.order) {
    return `Order: ${command.order.side} ${orderAmountQuantityToString(command.order)}`;
  } else {
    return "Unknown";
  }
}

/**
 * Calculate estimated cost of a job order
 */
export function calculateJobEstimatedCost(
  job: Job,
  assetsData: AssetData[]
): number | null {
  if (!job.command.order) return null;

  const order = job.command.order;
  const asset = findAssetDataBySymbol(assetsData, order.symbol);
  
  if (!asset || !asset.quotes || asset.quotes.length === 0) return null;
  
  const latestPrice = asset.quotes[asset.quotes.length - 1].close;

  if (order.amount) {
    // User specified amount in euros
    return order.amount;
  } else if (order.quantity) {
    // User specified quantity of shares
    return latestPrice * order.quantity;
  }
  
  return null;
}

/**
 * Check if account has sufficient balance for the job
 */
export function hasInsufficientBalance(
  job: Job,
  accounts: AccountType[],
  assetsData: AssetData[]
): { insufficient: boolean; estimatedCost: number | null; balance: number | null } {
  if (!job.command.order) {
    return { insufficient: false, estimatedCost: null, balance: null };
  }
  
  const account = accounts.find(a => a.id === job.command.order?.account);
  const estimatedCost = calculateJobEstimatedCost(job, assetsData);
    
  if (!account || account.cash_balance === undefined || estimatedCost === null) {
    return { insufficient: false, estimatedCost, balance: account?.cash_balance ?? null };
  }
  
  return {
    insufficient: account.cash_balance < estimatedCost,
    estimatedCost,
    balance: account.cash_balance
  };
}

export function jobDescriptionInfos(job: Job, accounts?: AccountType[], assetsData?: AssetData[]) {
  let cashBalance = null;
  // Amount of cash needed if insufficient balance
  let needCash = 0;

  if (accounts && job.command.order) {
    const account = accounts.find(a => a.id === job.command.order?.account);
    if (account && account.cash_balance !== undefined) {
      cashBalance = account.cash_balance;
      
      // Add warning if balance is insufficient
      if (assetsData) {
        const { insufficient, estimatedCost } = hasInsufficientBalance(job, accounts, assetsData);
        if (insufficient && estimatedCost !== null) {
          needCash = estimatedCost;
        }
      }
    }
  }
  
  return {
    schedule: scheduleToString(job.schedule),
    command: commandToString(job.command),
    cashBalance,
    needCash,
  };
}
