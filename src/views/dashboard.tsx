import { AccountsList } from "@/components/AccountsList";
import { AssetsChart } from "@/components/AssetsChart";
import { Orders } from "@/components/Orders";
import { SetupDca } from "@/components/SetupDca";
import { PerformanceSummary } from "@/components/PerformanceSummary";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  DashboardInitProgress,
  DashboardInitProgressToString,
} from "@/lib/progress";
import {
  AccountType,
  AssetData,
  InitResponse,
  PositionSummary,
  TradingSummaryItem,
} from "@/types";
import { parseAssetData } from "@/utils/assetUtils";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { jobToString } from "@/utils/jobUtils";

export function Dashboard({
  accounts,
  clientId,
  assetsData,
  setAssetData,
  setAccounts,
  setDashboardInitProgress,
  progress,
}: {
  accounts: AccountType[];
  clientId: string;
  assetsData: AssetData[];
  setAssetData: (value: React.SetStateAction<AssetData[]>) => void;
  setAccounts: React.Dispatch<React.SetStateAction<AccountType[]>>;
  setDashboardInitProgress: React.Dispatch<
    React.SetStateAction<DashboardInitProgress>
  >;
  progress: DashboardInitProgress;
}) {
  const [setupDcaDialogOpen, setSetupDcaDialogOpen] = useState(false);
  const [dcaScheduled, setDcaScheduled] = useState<boolean>(false);
  const [versionId, setVersionId] = useState<string | undefined>();
  const [jobsExecuted, setJobsExecuted] = useState<number>(0);

  useEffect(() => {
    (async () => {
      try {
        setDcaScheduled(await invoke("is_dca_scheduler_setup"));
      } catch (error) {
        let message;
        if (error instanceof Error) {
          message = error.message;
        } else if (typeof error === "string") {
          message = error;
        } else {
          message = "Unknown error";
        }
        toast.error(
          "An error occurred while checking the DCA scheduler setup.",
          {
            description: message,
            duration: 15000,
          },
        );
      }

      try {
        setVersionId(await getVersion());
      } catch (error) {
        let message;
        if (error instanceof Error) {
          message = error.message;
        } else if (typeof error === "string") {
          message = error;
        } else {
          message = "Unknown error";
        }
        toast.error("An error occurred while getting the version.", {
          description: message,
          duration: 15000,
        });
      }

      const state: InitResponse = await invoke("init");
      if (state.jobs_to_run.length > 0) {
        for (const job of state.jobs_to_run) {
          toast(`Confirm job execution`, {
            description: jobToString(job),
            action: {
              label: "Run",
              onClick: async () => {
                try {
                  await invoke("run_job_manually", { job });
                  toast.success(`Job ${job.id} executed successfully`, {
                    duration: 30000,
                  });
                  setJobsExecuted((prev) => prev + 1);
                } catch (error) {
                  console.error(error);
                  let message;
                  if (error instanceof Error) {
                    message = error.message;
                  } else if (typeof error === "string") {
                    message = error;
                  } else {
                    message = "Unknown error";
                  }
                  toast.error("An error occurred while placing the order.", {
                    description: message,
                    duration: 15000,
                  });
                }
              },
            },
            duration: 999999999,
          });
        }
      }
    })();
  }, []);

  useEffect(() => {
    // Fetch the positions from trading summary
    // merge them with the already existing assetsData
    // if the asset is not in the assetsData, add it
    const updateAssetsDataFromTradingSummary = async () => {
      const accountId = accounts.find((account) =>
        account.name.includes("PEA"),
      )?.id;
      if (!accountId) {
        console.error("No PEA account found in accounts");
        return;
      }
      let tradingSummary: TradingSummaryItem[];
      try {
        tradingSummary = await invoke("get_trading_summary", {
          accountId,
        });
      } catch (error) {
        console.error("Error fetching trading summary:", error);
        toast.error("Error fetching trading summary", {
          description: "Please check your connection or try again later.",
          duration: 15000,
        });
        return;
      }
      const positionsItem = tradingSummary.find(
        (item) => item.id === "positions" && item.positions,
      );
      if (!positionsItem) {
        console.error("No positions found in trading summary");
        return;
      }
      const unknownAssets: PositionSummary[] = positionsItem.positions!.filter(
        (position) =>
          !assetsData.find((asset) => asset.symbol === position.symbol),
      );

      if (unknownAssets.length === 0) {
        return;
      }

      try {
        const newAssetsData = await Promise.all(
          unknownAssets.map(async (position, index) => {
            return {
              ...parseAssetData(
                await invoke("get_ticks", {
                  symbol: position.symbol,
                  length: 30,
                }),
                index,
              ),
            };
          }),
        );

        console.log("New assets data:", newAssetsData);
  
        setAssetData([...assetsData, ...newAssetsData]);
      } catch (error) {
        console.error("Error fetching asset data:", error);
        toast.error("Error fetching asset data", {
          description: "Please check your connection or try again later.",
          duration: 15000,
        });
      }
    };

    updateAssetsDataFromTradingSummary();
  }, [accounts]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Toaster />
      <Dialog open={setupDcaDialogOpen} onOpenChange={setSetupDcaDialogOpen}>
        <SetupDca
          initialized={dcaScheduled}
          setInitialized={setDcaScheduled}
          accounts={accounts}
          assetsData={assetsData}
        />

        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Dashboard
                <span className="text-sm text-muted-foreground">
                  {" "}
                  / v{versionId || "x.x.x"}
                </span>
              </h1>
              {progress === DashboardInitProgress.DASHBOARD_FINALIZED ? (
                <p className="text-sm text-muted-foreground">
                  Connected as <span className="font-medium">{clientId}</span>
                  <X
                    onClick={() =>
                      setDashboardInitProgress(DashboardInitProgress.INITIATING)
                    }
                    className="w-4 h-4 inline cursor-pointer ml-2"
                  />
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  <Progress value={progress} />
                  {DashboardInitProgressToString(progress)}
                </p>
              )}
            </div>
            <div>
              <DialogTrigger asChild>
                {accounts.length > 0 && (
                  <Button>
                    Setup DCA{" "}
                    <span
                      className={`ml-1 text-xl text-${dcaScheduled ? `green-500` : `red-500`}`}
                    >
                      {dcaScheduled ? "✓" : "⨉"}
                    </span>
                  </Button>
                )}
              </DialogTrigger>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AssetsChart assetsData={assetsData} setAssetsData={setAssetData} />
            <PerformanceSummary
              accounts={accounts}
              assetsData={assetsData}
              setAssetsData={setAssetData}
            />
            <AccountsList accounts={accounts} setAccounts={setAccounts} />
            <Orders
              accounts={accounts}
              assetsData={assetsData}
              jobsExecuted={jobsExecuted}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
