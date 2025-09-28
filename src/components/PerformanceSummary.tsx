import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { TrendingUp, TrendingDown, Loader } from "lucide-react";
import { AssetData, PositionSummary, AccountType, TradingSummaryItem } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { isDevMode } from "@/lib/mockData";
import { parseAssetData } from "@/utils/assetUtils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

type TimePeriod = "1d" | "1m" | "6m" | "1y";

const PERIOD_CONFIG: Record<
  TimePeriod,
  { label: string; days: number }
> = {
  "1d": { label: "1 Day", days: 1 },
  "1m": { label: "1 Month", days: 30 },
  "6m": { label: "6 Months", days: 180 },
  "1y": { label: "1 Year", days: 365 },
};

interface PerformanceData {
  totalGainLoss: number;
  totalGainLossPercent: number;
  byAsset: Array<{
    symbol: string;
    name: string;
    gainLoss: number;
    gainLossPercent: number;
    quantity: number;
    startPrice: number;
    endPrice: number;
  }>;
}

export function PerformanceSummary({
  accounts,
  assetsData,
  setAssetsData,
}: {
  accounts: AccountType[];
  assetsData: AssetData[];
  setAssetsData: (value: React.SetStateAction<AssetData[]>) => void;
}) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("1m");
  const [positions, setPositions] = useState<PositionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPeriod, setLoadingPeriod] = useState(false);

  // Fetch positions from trading summary
  useEffect(() => {
    const fetchPositions = async () => {
      if (isDevMode()) {
        // In dev mode, use mock positions
        setPositions([
          {
            symbol: "1rTCW8",
            label: "AMUNDI ETF MSCI WORLD UCITS ETF",
            permalink: "",
            quantity: { value: 25, decimals: 0 },
            buyingPrice: { value: 46000, decimals: 2 },
            amount: { value: 1150000, decimals: 2 },
            last: { value: 47500, decimals: 2 },
            var: { value: 500, decimals: 2 },
            gainLoss: { value: 37500, decimals: 2 },
            gainLossPercent: { value: 3.26, decimals: 2 },
            lastMovementDate: "2025-01-15",
          },
          {
            symbol: "2rTCW9",
            label: "AMUNDI ETF S&P 500 UCITS ETF",
            permalink: "",
            quantity: { value: 30, decimals: 0 },
            buyingPrice: { value: 39000, decimals: 2 },
            amount: { value: 1170000, decimals: 2 },
            last: { value: 40500, decimals: 2 },
            var: { value: 300, decimals: 2 },
            gainLoss: { value: 45000, decimals: 2 },
            gainLossPercent: { value: 3.85, decimals: 2 },
            lastMovementDate: "2025-01-14",
          },
          {
            symbol: "3rTCW0",
            label: "LYXOR ETF NASDAQ-100 UCITS ETF",
            permalink: "",
            quantity: { value: 20, decimals: 0 },
            buyingPrice: { value: 52000, decimals: 2 },
            amount: { value: 1040000, decimals: 2 },
            last: { value: 54000, decimals: 2 },
            var: { value: 400, decimals: 2 },
            gainLoss: { value: 40000, decimals: 2 },
            gainLossPercent: { value: 3.85, decimals: 2 },
            lastMovementDate: "2025-01-13",
          },
        ]);
        return;
      }

      const peaAccount = accounts.find((account) =>
        account.name.toUpperCase().includes("PEA")
      );
      if (!peaAccount) {
        console.error("No PEA account found");
        return;
      }

      setLoading(true);
      try {
        const tradingSummary: TradingSummaryItem[] = await invoke("get_trading_summary", {
          accountId: peaAccount.id,
        });
        const positionsItem = tradingSummary.find(
          (item) => item.id === "positions" && item.positions
        );
        if (positionsItem && positionsItem.positions) {
          setPositions(positionsItem.positions);
        }
      } catch (error) {
        console.error("Error fetching positions:", error);
        toast.error("Error fetching positions", {
          description: "Could not load position data",
          duration: 5000,
        });
      } finally {
        setLoading(false);
      }
    };

    if (accounts.length > 0) {
      fetchPositions();
    }
  }, [accounts]);

  // Update ticks data when period changes
  useEffect(() => {
    const updateTicksForPeriod = async () => {
      if (assetsData.length === 0) return;

      if (isDevMode()) {
        // In dev mode, regenerate mock data with new period
        const { generateMockAssetsForPeriod } = await import("@/lib/mockData");
        const days = PERIOD_CONFIG[selectedPeriod].days;
        const newMockData = generateMockAssetsForPeriod(days);
        setAssetsData(newMockData);
        setLoadingPeriod(false);
        return;
      }

      setLoadingPeriod(true);
      try {
        const days = PERIOD_CONFIG[selectedPeriod].days;
        const ticksPromises = assetsData.map((asset, index) =>
          invoke("get_ticks", {
            symbol: asset.symbol,
            length: days,
          }).then((ticks) => parseAssetData(ticks, index))
        );
        const updatedAssets = await Promise.all(ticksPromises);
        setAssetsData(updatedAssets);
      } catch (error) {
        console.error("Error updating ticks:", error);
        toast.error("Error updating chart data", {
          description: "Could not load historical data",
          duration: 5000,
        });
      } finally {
        setLoadingPeriod(false);
      }
    };

    updateTicksForPeriod();
  }, [selectedPeriod]);

  // Calculate performance based on positions and asset data
  const performance = useMemo((): PerformanceData & { startBalance: number; endBalance: number } => {
    console.log("Calculating performance with positions and assetsData");
    console.log(positions);
    console.log(assetsData);
    if (positions.length === 0 || assetsData.length === 0) {
      return {
        totalGainLoss: 0,
        totalGainLossPercent: 0,
        byAsset: [],
        startBalance: 0,
        endBalance: 0,
      };
    }

    const assetPerformances = positions
      .map((position) => {
        const assetData = assetsData.find((a) => a.symbol === position.symbol);
        if (!assetData || assetData.quotes.length === 0) return null;

        const quantity = position.quantity.value / Math.pow(10, position.quantity.decimals);
        const buyingPrice = position.buyingPrice.value / Math.pow(10, position.buyingPrice.decimals);

        // Start price is the first quote (oldest), end price is the last quote (most recent)
        const startPrice = assetData.quotes[0].close;
        const endPrice = assetData.quotes[assetData.quotes.length - 1].close;

        // Calculate gain/loss for this period
        const priceChange = endPrice - startPrice;
        const gainLoss = priceChange * quantity;
        const gainLossPercent = (priceChange / startPrice) * 100;

        return {
          symbol: position.symbol,
          name: position.label,
          gainLoss,
          gainLossPercent,
          quantity,
          buyingPrice,
          startPrice,
          endPrice,
        };
      })
      .filter((p) => p !== null);

    const totalGainLoss = assetPerformances.reduce(
      (sum, asset) => sum + asset.gainLoss,
      0
    );

    // Calculate start and end balances
    const startBalance = assetPerformances.reduce(
      (sum, asset) => sum + asset.startPrice * asset.quantity,
      0
    );
    const endBalance = assetPerformances.reduce(
      (sum, asset) => sum + asset.endPrice * asset.quantity,
      0
    );

    // Calculate weighted average percentage
    const totalGainLossPercent =
      startBalance > 0 ? (totalGainLoss / startBalance) * 100 : 0;

    return {
      totalGainLoss,
      totalGainLossPercent,
      byAsset: assetPerformances,
      startBalance,
      endBalance,
    };
  }, [positions, assetsData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  const isPositive = performance.totalGainLoss >= 0;

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              {isPositive ? (
                <TrendingUp className="h-6 w-6" />
              ) : (
                <TrendingDown className="h-6 w-6" />
              )}
              Performance
            </CardTitle>
            <Select
              value={selectedPeriod}
              onValueChange={(value) => setSelectedPeriod(value as TimePeriod)}
              disabled={loadingPeriod}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PERIOD_CONFIG) as TimePeriod[]).map((period) => (
                  <SelectItem key={period} value={period}>
                    {PERIOD_CONFIG[period].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Total Performance */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="rounded-lg border p-4 cursor-pointer hover:bg-muted/70 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Total {PERIOD_CONFIG[selectedPeriod].label}
                      </span>
                      {loadingPeriod && (
                        <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    <div className="mt-2 flex items-baseline gap-3">
                      <span
                        className={`text-3xl font-bold`}
                      >
                        {formatCurrency(performance.totalGainLoss)}
                      </span>
                      <span
                        className={`text-xl font-semibold ${isPositive ? "text-green-600" : "text-red-600"}`}
                      >
                        {formatPercent(performance.totalGainLossPercent)}
                      </span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="space-y-1">
                    <p className="font-semibold">Portfolio Performance</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <span className="text-muted-foreground">Starting Balance:</span>
                      <span className="font-medium">{formatCurrency(performance.startBalance)}</span>
                      <span className="text-muted-foreground">Ending Balance:</span>
                      <span className="font-medium">{formatCurrency(performance.endBalance)}</span>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>

              {/* Per Asset Performance */}
              {performance.byAsset.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    By Asset
                  </h4>
                  {performance.byAsset.map((asset) => {
                    const isAssetPositive = asset.gainLoss >= 0;
                    return (
                      <Tooltip key={asset.symbol}>
                        <TooltipTrigger asChild>
                          <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors cursor-pointer">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{asset.symbol}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {asset.name}
                              </div>
                            </div>
                            <div className="text-right">
                              <div
                                className={`font-semibold ${isAssetPositive ? "text-green-600" : "text-red-600"}`}
                              >
                                {formatCurrency(asset.gainLoss)}
                              </div>
                              <div
                                className={`text-sm ${isAssetPositive ? "text-green-600" : "text-red-600"}`}
                              >
                                {formatPercent(asset.gainLossPercent)}
                              </div>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          <div className="space-y-1">
                            <p className="font-semibold">{asset.name}</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                              <span className="text-muted-foreground">Start Price:</span>
                              <span className="font-medium">{formatCurrency(asset.startPrice)}</span>
                              <span className="text-muted-foreground">End Price:</span>
                              <span className="font-medium">{formatCurrency(asset.endPrice)}</span>
                              <span className="text-muted-foreground">Quantity:</span>
                              <span className="font-medium">{asset.quantity}</span>
                              <span className="text-muted-foreground">Starting Value:</span>
                              <span className="font-medium">{formatCurrency(asset.startPrice * asset.quantity)}</span>
                              <span className="text-muted-foreground">Ending Value:</span>
                              <span className="font-medium">{formatCurrency(asset.endPrice * asset.quantity)}</span>
                              <span className="text-muted-foreground"><a href={`https://www.boursorama.com/bourse/trackers/cours/${asset.symbol}/`} target="_blank" rel="noreferrer" className="underline">View on Boursorama</a></span>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}