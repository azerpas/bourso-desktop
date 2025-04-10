use crate::order::{new_order, OrderArgs, OrderPassed};
use crate::BoursoState;
use anyhow::Result;
use chrono::{DateTime, Datelike, Local, Utc};
use log::debug;
use notify_rust::Notification;
#[cfg(target_os = "macos")]
use notify_rust::{get_bundle_identifier_or_default, set_application};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;
use std::{fmt::Display, fs};
use tauri::{async_runtime::Mutex, App, Manager};
use tauri::{AppHandle, Wry};
use tauri_plugin_store::{Store, StoreExt};

pub const HISTORY_FILE_PATH: &str = "history.json";

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum Schedule {
    Daily,
    Weekly { day: u8 },
    Monthly { day: u32 },
}

impl Display for Schedule {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                Schedule::Daily => "daily",
                Schedule::Weekly { .. } => "weekly",
                Schedule::Monthly { .. } => "monthly",
            }
        )
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Transfer {
    pub from: String,
    pub to: String,
    pub amount: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum Command {
    Order(OrderArgs),
    Transfer(Transfer),
}

impl Display for Command {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let qty_or_amount = match self {
            Command::Order(order_args) => {
                if order_args.quantity.is_some() {
                    order_args.quantity.unwrap().to_string()
                } else {
                    order_args.amount.unwrap().to_string()
                }
            }
            Command::Transfer(transfer_args) => transfer_args.amount.clone(),
        };

        write!(
            f,
            "{}",
            match self {
                Command::Order(order_args) => {
                    format!(
                        "order_{}_{}_{}",
                        order_args.side, qty_or_amount, order_args.symbol
                    )
                }
                Command::Transfer(transfer_args) => {
                    format!("transfer_{}_{}", transfer_args.from, transfer_args.to)
                }
            }
        )
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Job {
    pub id: String,
    pub schedule: Schedule,
    pub last_run: i64,
    pub command: Command,
}

impl Job {
    #[allow(dead_code)]
    pub fn new(schedule: Schedule, command: Command) -> Self {
        Job {
            id: format!("{}{}", schedule, command),
            schedule,
            last_run: Local::now().timestamp(),
            command,
        }
    }
}

impl Job {
    fn should_run(&self, now: DateTime<Utc>, last_run: DateTime<Utc>) -> bool {
        match &self.schedule {
            Schedule::Daily => now.date_naive() > last_run.date_naive(),
            Schedule::Weekly { day: _ } => {
                now.date_naive() > last_run.date_naive()
                    || now.iso_week().week() > last_run.iso_week().week()
            }
            Schedule::Monthly { day: _ } => {
                now.date_naive() > last_run.date_naive()
                    || now.date_naive().month() > last_run.date_naive().month()
            }
        }
    }

    pub fn should_run_now(&self) -> bool {
        let now = DateTime::from_timestamp(Local::now().timestamp(), 0).unwrap();
        let last_run = DateTime::from_timestamp(self.last_run, 0).unwrap();

        self.should_run(now, last_run)
    }

    pub async fn run(
        &mut self,
        store: Arc<Store<Wry>>,
        web_client: &bourso_api::client::BoursoWebClient,
    ) -> Result<()> {
        match &self.command {
            Command::Order(order) => {
                let market_open = match web_client.is_market_open(&order.symbol).await {
                    Ok(market_open) => market_open,
                    Err(e) => {
                        log::error!("Error checking market status: {}", e);
                        return Err(anyhow::anyhow!("Error checking market status"));
                    }
                };

                if !market_open {
                    return Err(anyhow::anyhow!("Market is closed"));
                }

                let quantity = order.get_qty(web_client).await?;

                let order_details = new_order(
                    web_client,
                    &order.account,
                    &order.symbol,
                    quantity,
                    &order.side,
                )
                .await?;

                let order = OrderPassed {
                    id: order_details.0,
                    price: order_details.1.unwrap(),
                    args: OrderArgs {
                        account: order.account.to_string(),
                        symbol: order.symbol.to_string(),
                        quantity: order.quantity,
                        amount: order.amount,
                        side: order.side.to_string(),
                    },
                };

                let orders = store.get("orders").unwrap_or(serde_json::json!([]));
                let mut orders: Vec<OrderPassed> = serde_json::from_value(orders)?;
                orders.push(order.clone());
                store.set("orders", serde_json::json!(&orders));
                store.save().unwrap();

                debug!("Running job: {} with last_run: {}", self.id, self.last_run);
                // Update last run to now
                self.last_run = DateTime::from_timestamp(Local::now().timestamp(), 0)
                    .unwrap()
                    .timestamp();
                debug!("Updated job: {} with last_run: {}", self.id, self.last_run);

                #[cfg(target_os = "macos")]
                {
                    let terminal_id = get_bundle_identifier_or_default("Terminal");
                    set_application(&terminal_id)
                        .map_err(|f| format!("{}", f))
                        .unwrap();
                }
                let _ = Notification::new()
                    .summary("bourso-desktop")
                    .body(&format!("{} {} were bought", quantity, order.args.symbol))
                    .icon("firefox")
                    .show()
                    .unwrap();
            }
            _ => todo!(),
        };
        Ok(())
    }
}

pub fn load_jobs(app_local_data_dir: &Path) -> Result<Vec<Job>> {
    let jobs_path = app_local_data_dir.join("jobs.json");

    if !fs::exists(jobs_path.clone()).unwrap() {
        fs::write(jobs_path, vec![])?;
        return Ok(vec![]);
    }

    let content = fs::read_to_string(jobs_path)?;

    if content.trim().is_empty() {
        return Ok(vec![]);
    }

    let jobs: Vec<Job> = serde_json::from_str(&content)?;

    Ok(jobs)
}

pub fn save_jobs(app_local_data_dir: &Path, jobs: Vec<Job>) -> Result<()> {
    let config_path = app_local_data_dir.join("jobs.json");

    fs::write(
        config_path,
        serde_json::to_string(&jobs).expect("Could not serialize jobs JSON"),
    )
    .expect("Could not write jobs JSON");

    Ok(())
}

pub fn save_job(app_local_data_dir: &Path, job: Job) -> Result<()> {
    let mut jobs = load_jobs(app_local_data_dir)?;

    if let Some(existing_job) = jobs.iter_mut().find(|j| j.id == job.id) {
        debug!("Updating job: {:?}", job);
        debug!("Existing job: {:?}", existing_job);
        *existing_job = job;
        debug!("Updated job: {:?}", existing_job);
    } else {
        jobs.push(job);
    }

    save_jobs(app_local_data_dir, jobs)?;

    Ok(())
}

pub fn delete_job(app_local_data_dir: &Path, job_id: &str) -> Result<()> {
    let mut jobs = load_jobs(app_local_data_dir)?;

    jobs.retain(|job| job.id != job_id);

    save_jobs(app_local_data_dir, jobs)?;

    Ok(())
}

/// Run a specific job from the UI
#[tauri::command]
pub async fn run_job_manually(app: AppHandle, job: Job) -> std::result::Result<(), String> {
    let state = app.state::<Mutex<BoursoState>>();
    let st = state.lock().await;
    let web_client = &st.client;

    let history_store = app
        .store(HISTORY_FILE_PATH)
        .expect("Could not open jobs store");

    let app_local_data_dir = app.path().app_local_data_dir().unwrap();

    let mut job = job.clone();

    match job.run(history_store, web_client).await {
        Ok(_) => {
            debug!("Job {} run successfully", job.id);
            // Update last run to now
            match save_job(&app_local_data_dir, job.clone()) {
                Ok(_) => {
                    debug!("Jobs saved successfully");
                    Ok(())
                }
                Err(e) => Err(e.to_string()),
            }
        }
        Err(e) => Err(e.to_string()),
    }
}

/// Run all jobs that are due to run. This will run the jobs and update the last_run field if
/// the password is present in the store, otherwise it will return an error that will trigger
/// the UI to prompt the user to enter the password.
pub async fn run(app: &mut App) -> Result<()> {
    let path = app.path().app_local_data_dir().unwrap();
    let mut jobs = load_jobs(&path)?;

    let store = app.store("credentials.json")?;
    let client_id = match store.get("clientId") {
        Some(client_id) => client_id.to_string(),
        None => {
            return Err(anyhow::anyhow!("client_id not found"));
        }
    };
    let password = match store.get("password") {
        Some(password) => password.to_string(),
        None => {
            // Set a flag to indicate that the password is missing
            // so that we can prompt the user to enter it from the UI
            let state = app.state::<Mutex<BoursoState>>();
            let mut st = state.lock().await;
            st.dca_without_password = true;
            // we pass the jobs to the state so that the front-end can display them
            st.jobs_to_run = vec![];
            for job in &mut jobs {
                if job.should_run_now() {
                    st.jobs_to_run.push(job.clone());
                }
            }
            // save the jobs with the updated last_run
            save_jobs(&path, jobs)?;
            return Err(anyhow::anyhow!("password not found"));
        }
    };

    let mut web_client: bourso_api::client::BoursoWebClient = bourso_api::get_client();
    web_client.init_session().await?;
    web_client.login(&client_id, &password).await?;

    for job in &mut jobs {
        if job.should_run_now() {
            let jobs_store = app.store(HISTORY_FILE_PATH)?;
            match job.run(jobs_store, &web_client).await {
                Ok(_) => (),
                Err(e) => {
                    log::error!("Error running job: {}", e);
                }
            }
        }
    }

    save_jobs(&path, jobs)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, TimeZone};

    // Helper function to create a timestamp for a specific date
    fn make_datetime(year: i32, month: u32, day: u32) -> DateTime<Utc> {
        DateTime::from_timestamp(
            Local
                .with_ymd_and_hms(year, month, day, 12, 0, 0)
                .unwrap()
                .timestamp(),
            0,
        )
        .unwrap()
    }

    // Helper function to create a test order
    fn create_test_order() -> OrderArgs {
        OrderArgs {
            account: "test-account".to_string(),
            symbol: "BTC".to_string(),
            quantity: Some(1),
            amount: None,
            side: "buy".to_string(),
        }
    }

    #[test]
    fn test_daily_schedule() {
        let test_order = create_test_order();

        let job = Job::new(Schedule::Daily, Command::Order(test_order));

        // Test with yesterday
        let now = DateTime::from_timestamp(Local::now().timestamp(), 0).unwrap();
        let yesterday = now - Duration::days(1);

        assert!(job.should_run(now, yesterday));

        // Test with today (shouldn't run again)
        assert!(!job.should_run(now, now));
    }

    #[test]
    fn test_weekly_schedule() {
        let test_order = create_test_order();

        let job = Job::new(Schedule::Weekly { day: 0 }, Command::Order(test_order));

        // Test when it's Monday but hasn't run this week
        let this_monday = make_datetime(2025, 2, 3); // A Monday
        let last_monday = this_monday - Duration::days(7);

        assert!(job.should_run(this_monday, last_monday));

        // Test when it's not Monday (shouldn't run)
        let tuesday = this_monday + Duration::days(1);
        assert!(!job.should_run(tuesday, last_monday));
    }

    #[test]
    fn test_monthly_schedule() {
        let test_order = create_test_order();

        let job = Job::new(Schedule::Monthly { day: 1 }, Command::Order(test_order));

        // Test on the 1st of the month
        let first_of_month = make_datetime(2025, 2, 1);
        let last_month = make_datetime(2025, 1, 1);

        assert!(job.should_run(first_of_month, last_month));

        // Test not on the 1st (shouldn't run)
        let second_of_month = make_datetime(2025, 2, 2);
        assert!(!job.should_run(second_of_month, last_month));
    }
}
