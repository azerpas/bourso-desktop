import { AccountType } from "@/types";

/**
 * Check if incognito mode is enabled
 */
export const isIncognitoMode = (): boolean => {
  return import.meta.env.VITE_INCOGNITO_MODE === "true";
};

export const getFormattedAccountName = (
  account: AccountType,
  accounts: AccountType[]
): string => {
  if (!isIncognitoMode()) {
    return account.name;
  }

  // Get a generic placeholder name for an account based on its type
  switch (account.kind) {
    case "Savings": {
      // Count how many Savings accounts appear before this one
      const savingsAccounts = accounts.filter((a) => a.kind === "Savings");
      const index = savingsAccounts.findIndex((a) => a.id === account.id);
      return `Savings ${index + 1}`;
    }
    case "Banking": {
      // Count how many Banking accounts appear before this one
      const bankingAccounts = accounts.filter((a) => a.kind === "Banking");
      const index = bankingAccounts.findIndex((a) => a.id === account.id);
      return `Banking ${index + 1}`;
    }
    case "Trading": {
      // Determine if it's a PEA or CTO based on the account name
      const isPEA = account.name.toUpperCase().includes("PEA");
      const tradingAccounts = accounts.filter(
        (a) => 
          a.kind === "Trading" && 
          (isPEA ? a.name.toUpperCase().includes("PEA") : !a.name.toUpperCase().includes("PEA"))
      );
      
      if (isPEA) {
        // If there's only one PEA, just return "PEA DUPONT"
        if (tradingAccounts.length === 1) {
          return "PEA DUPONT";
        }
        // If there are multiple PEAs, number them
        const index = tradingAccounts.findIndex((a) => a.id === account.id);
        return `PEA DUPONT ${index + 1}`;
      } else {
        // CTO accounts
        if (tradingAccounts.length === 1) {
          return "CTO DUPONT";
        }
        const index = tradingAccounts.findIndex((a) => a.id === account.id);
        return `CTO DUPONT ${index + 1}`;
      }
    }
    case "Loans": {
      const loanAccounts = accounts.filter((a) => a.kind === "Loans");
      const index = loanAccounts.findIndex((a) => a.id === account.id);
      return `Loan ${index + 1}`;
    }
    default:
      return "Account";
  }
};
