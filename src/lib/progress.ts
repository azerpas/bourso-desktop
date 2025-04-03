export enum DashboardInitProgress {
  INITIATING = 0,
  LOGGIN_IN = 25,
  LOGGED_IN = 50,
  DATA_FETCHED = 75,
  DASHBOARD_FINALIZED = 100,
}

// DashboardInitProgress to string
export function DashboardInitProgressToString(
  value: DashboardInitProgress,
): string {
  switch (value) {
    case DashboardInitProgress.INITIATING:
      return "Initiating connection to Bourso";
    case DashboardInitProgress.LOGGIN_IN:
      return "Client initialized, logging in";
    case DashboardInitProgress.LOGGED_IN:
      return "Logged in, fetching data";
    case DashboardInitProgress.DATA_FETCHED:
      return "Data fetched, finalizing dashboard";
    case DashboardInitProgress.DASHBOARD_FINALIZED:
      return "Dashboard finalized";
    default:
      throw new Error(`Invalid value ${value}`);
  }
}
