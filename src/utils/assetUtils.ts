import { AssetData } from "@/types";
import { getColor } from "./misc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseAssetData(data: any, index: number): AssetData {
  return {
    symbol: data.d.SymbolId,
    name: data.d.Name,
    color: getColor(index),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    quotes: data.d.QuoteTab.map((quote: any) => ({
      date: quote.d,
      open: quote.o,
      high: quote.h,
      low: quote.l,
      close: quote.c,
      volume: quote.v,
    })),
  };
}

export function findAssetDataBySymbol(
  assets: AssetData[],
  symbol: string,
): AssetData | undefined {
  return assets.find((asset) => asset.symbol === symbol);
}
