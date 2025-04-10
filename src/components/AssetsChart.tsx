import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { AssetData } from "@/types";
import { AssetPicker } from "./AssetPicker";

export function AssetsChart({
  assetsData,
  setAssetsData,
}: {
  assetsData: AssetData[];
  setAssetsData: (value: React.SetStateAction<AssetData[]>) => void;
}) {
  // Calculate percentage changes for each asset
  const chartData = useMemo(() => {
    return assetsData.map((asset) => {
      const initialPrice = asset.quotes[0].close;
      const data = asset.quotes.map((quote, index) => ({
        date: new Date().setDate(
          new Date().getDate() - (asset.quotes.length - index - 1),
        ),
        [asset.symbol]: ((quote.close - initialPrice) / initialPrice) * 100,
      }));
      return {
        symbol: asset.symbol,
        name: asset.name,
        color: asset.color,
        data,
      };
    });
  }, [assetsData]);

  // Merge all asset data into a single array for the chart
  const mergedData = useMemo(() => {
    if (chartData.length === 0) return [];

    return chartData[0].data.map((point, index) => {
      const mergedPoint: { [key: string]: number | string } = {
        date: point.date,
      };
      chartData.forEach((asset) => {
        let idx = index;
        if (asset.data.length != chartData[0].data.length) {
          // Handle case where data lengths are different
          idx = index - Math.abs(asset.data.length - chartData[0].data.length);
        }
        if (asset.data[idx] === undefined) {
          return;
        }
        mergedPoint[asset.symbol] = asset.data[idx][asset.symbol];
      });
      return mergedPoint;
    });
  }, [chartData]);

  // Format date for X-axis and tooltip
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    });
  };

  // Format percentage for tooltip and Y-axis
  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const renderSelected = (value: string[]) => {
    return `${value.length} selected`;
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="h-6 w-6" />
            Performance (30 Days)
          </CardTitle>
          <AssetPicker
            label="Assets"
            options={assetsData.map((asset) => ({
              value: asset.symbol,
              label: asset.name,
            }))}
            value={assetsData.map((asset) => asset.symbol)}
            renderItem={(option) => option.label}
            renderSelectedItem={renderSelected}
            assetsData={assetsData}
            setAssetsData={setAssetsData}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={mergedData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatDate}
                scale="time"
                className="text-xs"
              />
              <ReferenceLine y={0} stroke="#000" />
              <YAxis
                className="text-xs"
                tickFormatter={formatPercentage}
                domain={["dataMin", "dataMax"]}
              />
              <Tooltip
                labelFormatter={formatDate}
                formatter={(value: number) => [formatPercentage(value)]}
              />
              <Legend />
              {chartData.map((asset) => (
                <Line
                  key={asset.symbol}
                  type="linear"
                  dataKey={asset.symbol}
                  name={`${asset.symbol} - ${asset.name}`}
                  stroke={asset.color}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
