import { AccountType, TradingSummaryItem } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Loader, RefreshCw, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TransferModal } from "./TransferModal";
import { getFormattedAccountName } from "@/utils/format";

export function AccountsList({
  accounts,
  setAccounts,
}: {
  accounts: AccountType[];
  setAccounts: React.Dispatch<React.SetStateAction<AccountType[]>>;
}) {
  const [hideBalances, setHideBalances] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountType | null>(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferSource, setTransferSource] = useState<AccountType | null>(null);
  const [transferTarget, setTransferTarget] = useState<AccountType | null>(null);

  // Calculate total balance
  const totalBalance = accounts.reduce(
    (sum, account) => sum + account.balance,
    0,
  );

  // Format balance with currency
  const formatBalance = (amount: number, currency: string = "EUR") => {
    if (hideBalances) return "****";
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
    }).format(amount / 100);
  };

  const refreshAccounts = async () => {
    setRefreshing(true);
    try {
      const accounts: AccountType[] = await invoke("get_accounts");

      // Fetch trading summaries in parallel for all trading accounts
      const updatedAccounts = await Promise.all(
        accounts.map(async (account) => {
          if (account.kind !== "Trading") {
            return account;
          }

          try {
            const tradingSummary: TradingSummaryItem[] = await invoke(
              "get_trading_summary",
              { accountId: account.id },
            );
            const accountItem = tradingSummary.find(
              (item) => item.id === "account" && item.account,
            );
            return {
              ...account,
              cash_balance: accountItem?.account?.cash?.value,
            };
          } catch (error) {
            console.error(
              `Failed to fetch trading summary for account ${account.id}:`
            );
            console.error(error);
            // Return account unchanged if trading summary fails
            return account;
          }
        }),
      );

      setAccounts(updatedAccounts);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAccountClick = (account: AccountType) => {
    if (selectedAccount === null) {
      // First click - select source account only if it can send transfers
      setSelectedAccount(account);
    } else if (selectedAccount.id === account.id) {
      // Click same account - deselect
      setSelectedAccount(null);
    } else {
      // Second click - validate transfer rules before opening modal
      const canTransfer = isTransferAllowed(selectedAccount, account);
      if (!canTransfer) {
        // Invalid transfer, reset selection
        setSelectedAccount(null);
        return;
      }
      
      // Valid transfer - open modal
      setTransferSource(selectedAccount);
      setTransferTarget(account);
      setTransferModalOpen(true);
      setSelectedAccount(null);
    }
  };

  const isTransferAllowed = (source: AccountType, target: AccountType): boolean => {
    // Trading accounts cannot send to anyone
    // TODO: at least for PEAs, would need to check if it's true for CTOs too
    if (source.kind === "Trading") {
      return false;
    }
    
    // Savings accounts can only transfer to Banking accounts
    if (source.kind === "Savings") {
      return target.kind === "Banking";
    }
    
    // Banking accounts can send to all accounts (Savings, Banking, Trading)
    if (source.kind === "Banking") {
      return true;
    }
    
    return false;
  };

  /*
   * Determine if an account can be clicked based on selection state
   */
  const isAccountClickable = (account: AccountType): boolean => {
    if (selectedAccount === null) {
      return true;
    } else {
      // Can click if it's the same account (to deselect) or if transfer is allowed
      return account.id === selectedAccount.id || isTransferAllowed(selectedAccount, account);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Wallet className="h-6 w-6" />
              Total Balance
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHideBalances(!hideBalances)}
              className="gap-2"
            >
              {hideBalances ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
              {hideBalances ? "Show" : "Hide"} Balances
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <span className="text-3xl font-bold">
            {formatBalance(totalBalance, "EUR")}
          </span>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Wallet className="h-6 w-6" />
                Your Accounts
              </CardTitle>
              {selectedAccount && (
                <p className="text-sm text-muted-foreground">
                  {selectedAccount.kind === "Savings" 
                    ? `Click a Banking account to transfer from ${getFormattedAccountName(selectedAccount, accounts)}` 
                    : `Click another account to transfer from ${getFormattedAccountName(selectedAccount, accounts)}`}
                </p>
              )}
              {!selectedAccount && (
                <p className="text-sm text-muted-foreground">
                  Click an account to start a transfer (Trading accounts cannot send)
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshAccounts()}
              className="gap-2"
            >
              {refreshing ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {accounts.map((account) => {
            const clickable = isAccountClickable(account);
            const isSelected = selectedAccount?.id === account.id;
            const displayName = getFormattedAccountName(account, accounts);
            
            return (
              <div
                key={account.id}
                onClick={() => clickable && handleAccountClick(account)}
                className={`flex flex-col space-y-2 rounded-lg border p-4 transition-all select-none ${
                  isSelected
                    ? "border-primary border-2 bg-accent scale-[1.02] shadow-lg cursor-pointer"
                    : clickable
                    ? "hover:bg-accent hover:text-accent-foreground hover:scale-[1.01] cursor-pointer"
                    : "opacity-50 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{displayName}</h3>
                    {account.bank_name !== "BoursoBank" && (
                      <Badge
                        variant="outline"
                        className="flex items-center gap-1"
                      >
                        External
                      </Badge>
                    )}
                  </div>
                  <div className="relative">
                    <span className="text-lg font-semibold">
                      {formatBalance(account.balance)}
                    </span>
                    {account.kind === "Trading" && account.cash_balance !== undefined && (
                      <span className="absolute top-full right-0 text-xs text-muted-foreground whitespace-nowrap">
                        Cash: {account.cash_balance} €
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {account.bank_name}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <TransferModal
        open={transferModalOpen}
        onOpenChange={setTransferModalOpen}
        sourceAccount={transferSource}
        targetAccount={transferTarget}
        accounts={accounts}
        onTransferComplete={refreshAccounts}
      />
    </div>
  );
}
