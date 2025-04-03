import { AccountType } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Loader, RefreshCw, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function AccountsList({
  accounts,
  setAccounts,
}: {
  accounts: AccountType[];
  setAccounts: React.Dispatch<React.SetStateAction<AccountType[]>>;
}) {
  const [hideBalances, setHideBalances] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
    const accounts: AccountType[] = await invoke("get_accounts");
    setAccounts(accounts);
    setRefreshing(false);
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
            <CardTitle className="flex items-center gap-2 text-xl">
              <Wallet className="h-6 w-6" />
              Your Accounts
            </CardTitle>
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
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex flex-col space-y-2 rounded-lg border p-4 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{account.name}</h3>
                  {account.bank_name !== "BoursoBank" && (
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1"
                    >
                      External
                    </Badge>
                  )}
                </div>
                <span className="text-lg font-semibold">
                  {formatBalance(account.balance)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {account.bank_name}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
