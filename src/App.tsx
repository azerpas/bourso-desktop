import { useEffect, useState } from "react";
import "./index.css";
import { LazyStore } from "@tauri-apps/plugin-store";
import { LoginModal } from "./views/login";
import { CREDENTIALS_FILE } from "./constants";
import { invoke } from "@tauri-apps/api/core";
import { Dashboard } from "./views/dashboard";
import { AccountType, AssetData, InitResponse, Mfa } from "./types";
import { parseAssetData } from "./utils/assetUtils";
import { Toaster, toast } from "sonner";
import { DashboardInitProgress } from "./lib/progress";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ToastAction } from "./components/ui/toast";
import "./lib/logs";
import { Dialog } from "./components/ui/dialog";
import { InputOTPForm } from "./components/MfaForm";

function App() {
  const [clientId, setClientId] = useState<string | undefined>();
  const [password, setPassword] = useState<string | undefined>();
  const [clientInitialized, setClientInitialized] = useState<boolean>(false);
  const [accounts, setAccounts] = useState<AccountType[]>([]);
  const [assetsData, setAssetData] = useState<AssetData[]>([]);
  const [dashboardInitProgress, setDashboardInitProgress] =
    useState<DashboardInitProgress>(DashboardInitProgress.INITIATING);
  const [currentMfa, setCurrentMfa] = useState<Mfa | undefined>();
  const [mfaCompleted, setMfaCompleted] = useState<boolean>(false);
  const [mfaDialogOpen, setMfaDialogOpen] = useState<boolean>(false);

  // Error with the bourso client
  const [clientError, setClientError] = useState<string | undefined>();

  // Update state
  const [update, setUpdate] = useState<Update | undefined>();
  const [updating, setUpdating] = useState<boolean>(false);
  const [updateProgress, setUpdateProgress] = useState<string>("");

  useEffect(() => {
    async function init() {
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
        toast("App opened for DCA", {
          description: "Login to place the order",
          duration: 999999999,
        });
      }

      const update = await check();
      if (update) {
        console.log(
          `found update ${update.version} from ${update.date} with notes ${update.body}`,
        );
        toast("Update available", {
          description: `Version ${update.version} is available with notes ${update.body}`,
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
      await invoke("save_assets", {
        assets: assetsData.map((asset) => asset.symbol),
      });
    }
    saveAssets();
  }, [assetsData]);

  useEffect(() => {
    const initClient = async () => {
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
        let downloaded = 0;
        let contentLength = 0;
        // alternatively we could also call update.download() and update.install() separately
        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case "Started":
              contentLength = event.data.contentLength || -1;
              setUpdateProgress(
                `started downloading ${event.data.contentLength} bytes`,
              );
              break;
            case "Progress":
              downloaded += event.data.chunkLength;
              setUpdateProgress(
                `downloaded ${downloaded} from ${contentLength}`,
              );
              break;
            case "Finished":
              setUpdateProgress("download finished");
              break;
          }
        });

        await relaunch();
      }
    }
    updateApp();
  }, [updating]);

  if (updating) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Updating... The app will restart automatically at the end</p>
        <p>{updateProgress}</p>
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
