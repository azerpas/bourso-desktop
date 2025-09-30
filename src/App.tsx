import { useEffect, useState } from "react";
import "./index.css";
import { LazyStore } from "@tauri-apps/plugin-store";
import { LoginModal } from "./views/login";
import { CREDENTIALS_FILE } from "./constants";
import { invoke } from "@tauri-apps/api/core";
import { Dashboard } from "./views/dashboard";
import { AccountType, AssetData, InitResponse, Mfa, UpdateAvailable as NewUpdate } from "./types";
import { parseAssetData } from "./utils/assetUtils";
import { Toaster, toast } from "sonner";
import { DashboardInitProgress } from "./lib/progress";
import { relaunch } from "@tauri-apps/plugin-process";
import { ToastAction } from "./components/ui/toast";
import "./lib/logs";
import { Dialog } from "./components/ui/dialog";
import { InputOTPForm } from "./components/MfaForm";
import { isDevMode, mockAccounts, mockAssetsData } from "./lib/mockData";

function App() {
  const devMode = isDevMode();

  const [clientId, setClientId] = useState<string | undefined>(
    devMode ? "DEV_MODE" : undefined
  );
  const [password, setPassword] = useState<string | undefined>(
    devMode ? "DEV_MODE" : undefined
  );
  const [clientInitialized, setClientInitialized] = useState<boolean>(devMode);
  const [accounts, setAccounts] = useState<AccountType[]>(
    devMode ? mockAccounts : []
  );
  const [assetsData, setAssetData] = useState<AssetData[]>(
    devMode ? mockAssetsData : []
  );
  const [dashboardInitProgress, setDashboardInitProgress] =
    useState<DashboardInitProgress>(
      devMode ? DashboardInitProgress.DASHBOARD_FINALIZED : DashboardInitProgress.INITIATING
    );
  const [currentMfa, setCurrentMfa] = useState<Mfa | undefined>();
  const [mfaCompleted, setMfaCompleted] = useState<boolean>(false);
  const [mfaDialogOpen, setMfaDialogOpen] = useState<boolean>(false);

  // Error with the bourso client
  const [clientError, setClientError] = useState<string | undefined>();

  // Update state
  const [update, setUpdate] = useState<NewUpdate | undefined>();
  const [updating, setUpdating] = useState<boolean>(false);
  
  useEffect(() => {
    async function init() {
      // Skip initialization in dev mode
      if (devMode) {
        console.log("🚀 Development mode enabled - using mock data");
        return;
      }

      const store = new LazyStore(CREDENTIALS_FILE);

      const clientID = await store.get<string>("clientId");
      const password = await store.get<string>("password");
      if (clientID) {
        setClientId(clientID);
      }
      if (password) {
        setPassword(password);
      }

      const state: InitResponse = await invoke("init");
      if (state.dca_without_password) {
        // Format the DCA jobs information
        const dcaInfo = state.jobs_to_run.map(job => {
          if (job.command.order) {
            const order = job.command.order;
            const quantity = order.quantity || order.amount;
            return `${order.side.charAt(0).toUpperCase()}${order.side.slice(1)} ${order.symbol} (${quantity} ${order.quantity ? 'shares' : 'EUR'})`;
          }
          return 'Unknown job';
        }).join(', ');

        toast(`App opened for DCA ${dcaInfo}`, {
          description: (
            <div>
              <p className="text-xs text-gray-500">Login to place the order or skip until next occurrence</p>
            </div>
          ),
          duration: 999999999,
          action: state.jobs_to_run.length > 0 ? (
            <ToastAction
              altText="Skip"
              onClick={async () => {
                // Skip all jobs that are due to run
                for (const job of state.jobs_to_run) {
                  try {
                    await invoke("skip_dca_job", { jobId: job.id });
                  } catch (error) {
                    console.error(`Failed to skip job ${job.id}:`, error);
                  }
                }
                toast.dismiss();
                toast.success("DCA skipped", {
                  description: "The scheduled DCA has been skipped for this time.",
                });
              }}
            >
              Skip
            </ToastAction>
           ) : undefined,
        });
      }

      const updateResponse: { update: NewUpdate } | string = await invoke("check_for_updates");
      if (typeof updateResponse === "object") {
        const { update } = updateResponse;
        console.log(
          `found update ${update.version} from ${update.date} with notes ${update.body}`,
        );
        toast("Update available", {
          description: (
            <div>
              <p>Version {update.version} available</p>
              <p>{update.body}</p>
            </div>
          ),
          duration: 999999999,
          action: (
            <ToastAction
              altText="Install the update"
              onClick={() => {
                setUpdate(update);
                setUpdating(true);
              }}
            >
              Update
            </ToastAction>
          ),
        });
      }
    }
    if (!clientId && !password) {
      init();
    }
  }, []);

  useEffect(() => {
    async function initGraph() {
      // Skip in dev mode - using mock data
      if (devMode) return;

      const savedAssets: string[] = await invoke("get_saved_assets");
      const promises = [
        ...savedAssets.map((asset: string) =>
          invoke("get_ticks", { symbol: asset, length: 30 }),
        ),
      ];
      const ticks = await Promise.all(promises);
      const parsedTicks = ticks.map(parseAssetData);
      setAssetData(parsedTicks);
    }
    initGraph();
  }, []);

  useEffect(() => {
    async function saveAssets() {
      // Skip in dev mode
      if (devMode) return;

      await invoke("save_assets", {
        assets: assetsData.map((asset) => asset.symbol),
      });
    }
    saveAssets();
  }, [assetsData]);

  useEffect(() => {
    const initClient = async () => {
      // Skip in dev mode - already initialized
      if (devMode) return;

      if (clientId && password && !clientInitialized) {
        setClientError(undefined);
        setDashboardInitProgress(DashboardInitProgress.LOGGIN_IN);
        try {
          await invoke("init_client", { customerId: clientId, password });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          let message: string;
          if (error.message) {
            message = error.message;
          } else {
            message = error;
          }
          console.error(error);
          if (message.includes("credentials")) {
            setClientError("Invalid client ID or password");
          } else if (message.includes("mfa required")) {
            const mfas: Mfa[] = await invoke("get_mfas");
            console.log(mfas);
            if (mfas.length > 0) {
              setCurrentMfa(mfas[mfas.length - 1]);
              setMfaDialogOpen(true);
            } else {
              setClientError(
                "Error while initializing client, no MFA found while it was required",
              );
            }
          } else {
            setClientError("Error while initializing client");
          }
          setDashboardInitProgress(DashboardInitProgress.INITIATING);
          return;
        }

        setDashboardInitProgress(DashboardInitProgress.LOGGED_IN);
        setClientInitialized(true);
        const accounts: AccountType[] = await invoke("get_accounts");
        setDashboardInitProgress(DashboardInitProgress.DATA_FETCHED);
        // put every account that contains PEA in the name at the beginning
        // of the list
        const sortedAccounts = [...accounts].sort((a, b) => {
          const isPEAA = a.name.toUpperCase().includes("PEA");
          const isPEAB = b.name.toUpperCase().includes("PEA");
          if (isPEAA && !isPEAB) return -1;
          if (!isPEAA && isPEAB) return 1;
          return a.name.localeCompare(b.name);
        });

        setAccounts(sortedAccounts);
        setDashboardInitProgress(DashboardInitProgress.DASHBOARD_FINALIZED);
      }
    };
    initClient().catch((err) => {
      console.error("Error in initClient:", err);
    });
  }, [clientId, password, mfaCompleted]);

  useEffect(() => {
    async function updateApp() {
      if (updating && update) {
        await invoke("update");

        await relaunch();
      }
    }
    updateApp();
  }, [updating]);

  if (updating) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Updating to version {update?.version}... The app will restart at the end.</p>
      </div>
    );
  }

  if (
    !clientId ||
    !password ||
    dashboardInitProgress <= DashboardInitProgress.LOGGIN_IN
  ) {
    return (
      <>
        <LoginModal
          defaultClientId={clientId}
          defaultPassword={password}
          setClientId={setClientId}
          setPassword={setPassword}
          clientError={clientError}
          dashboardInitProgress={dashboardInitProgress}
        />
        {currentMfa && (
          <Dialog open={mfaDialogOpen} onOpenChange={setMfaDialogOpen}>
            <InputOTPForm
              mfa={currentMfa}
              setMfaCompleted={setMfaCompleted}
              setMfaDialogOpen={setMfaDialogOpen}
            />
          </Dialog>
        )}
        <Toaster />
      </>
    );
  } else {
    return (
      <main className="container">
        <Toaster />
        <Dashboard
          accounts={accounts}
          setAccounts={setAccounts}
          clientId={clientId!}
          progress={dashboardInitProgress}
          assetsData={assetsData}
          setAssetData={setAssetData}
          setDashboardInitProgress={setDashboardInitProgress}
        />
      </main>
    );
  }
}

export default App;