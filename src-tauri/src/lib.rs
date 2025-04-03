use std::process::exit;

use assets::{get_saved_assets, save_assets};
use bourso_api::{
    client::{trade::tick::GetTicksEOD, BoursoWebClient},
    get_client,
};
use cron::{deactivate_dca_scheduler, init_dca_scheduler, is_dca_scheduler_setup};
use order::{get_orders_cmd, new_order_cmd};
use scheduler::run_job_manually;
use tauri::{
    async_runtime::{block_on, Mutex},
    AppHandle, Manager, State,
};
use tauri_plugin_cli::CliExt;
use tauri_plugin_sentry::sentry;
use trading::get_trading_summary;

mod assets;
mod cli;
mod cron;
mod files;
mod order;
mod scheduler;
mod trading;

struct BoursoState {
    pub client: BoursoWebClient,
    pub dca_without_password: bool,
    pub jobs_to_run: Vec<scheduler::Job>,
    pub mfas: Vec<Mfa>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct Mfa {
    pub otp_id: String,
    pub token: String,
    pub mfa_type: bourso_api::client::MfaType,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct InitResponse {
    pub dca_without_password: bool,
    pub jobs_to_run: Vec<scheduler::Job>,
}

#[tauri::command]
async fn init(
    app: AppHandle,
    state: State<'_, Mutex<BoursoState>>,
) -> Result<InitResponse, String> {
    let state = state.lock().await;

    update_embed_files(&app).expect("error while updating embedded files");

    Ok(InitResponse {
        // defined by CLI helper if the app was started by a CRON job
        dca_without_password: state.dca_without_password,
        jobs_to_run: state.jobs_to_run.clone(),
    })
}

pub fn update_embed_files(app: &AppHandle) -> Result<(), String> {
    cron::modify_script_file(app).expect("error while modifying script file");

    Ok(())
}

#[tauri::command]
async fn init_client(
    customer_id: &str,
    password: &str,
    state: State<'_, Mutex<BoursoState>>,
) -> Result<(), String> {
    let mut state = state.lock().await;
    if state.client.config.user_hash.is_some() {
        return Ok(());
    } else {
        println!("{:?}", state.client.config);
    }
    if state.client.config.jwt_token_id.is_empty() {
        match state.client.init_session().await {
            Ok(_) => {}
            Err(e) => {
                return Err(format!("error while init session: {:?}", e));
            }
        }
    }
    match state.client.login(customer_id, password).await {
        Ok(_) => {}
        Err(e) => match e.downcast_ref() {
            Some(bourso_api::client::error::ClientError::MfaRequired) => {
                let (otp_id, token, mfa_type) = state
                    .client
                    .request_mfa()
                    .await
                    .expect("error while requesting mfa");
                state.mfas.push(Mfa {
                    otp_id,
                    token,
                    mfa_type,
                });
                return Err("mfa required".to_string());
            }
            _ => return Err(format!("error while login: {:?}", e)),
        },
    }
    Ok(())
}

#[tauri::command]
async fn get_mfas(state: State<'_, Mutex<BoursoState>>) -> Result<Vec<Mfa>, ()> {
    let state = state.lock().await;
    Ok(state.mfas.clone())
}

#[tauri::command]
async fn submit_mfa(
    mfa: Mfa,
    code: &str,
    state: State<'_, Mutex<BoursoState>>,
) -> Result<(), String> {
    let mut state = state.lock().await;
    match state
        .client
        .submit_mfa(mfa.mfa_type, mfa.otp_id, code.to_string(), mfa.token)
        .await
    {
        Ok(_) => Ok(()),
        Err(e) => match e.downcast_ref() {
            Some(bourso_api::client::error::ClientError::MfaRequired) => {
                let sms_and_email_mfa = state
                    .mfas
                    .iter()
                    .any(|m| m.mfa_type == bourso_api::client::MfaType::Sms)
                    && state
                        .mfas
                        .iter()
                        .any(|m| m.mfa_type == bourso_api::client::MfaType::Email);
                if state.mfas.len() >= 2 && sms_and_email_mfa {
                    // If MFA is passed twice, it means the user has passed an sms and email mfa
                    // which should clear the IP. We just need to reinitialize the session
                    // and login again to access the account.
                    state.client = get_client();
                    return Ok(());
                }

                let (otp_id, token, mfa_type) = state
                    .client
                    .request_mfa()
                    .await
                    .expect("error while requesting mfa");
                state.mfas.push(Mfa {
                    otp_id,
                    token,
                    mfa_type,
                });
                Err("mfa required".to_string())
            }
            _ => Err(format!("error while submitting mfa: {:?}", e)),
        },
    }
}

#[tauri::command]
async fn get_accounts(
    state: State<'_, Mutex<BoursoState>>,
) -> Result<Vec<bourso_api::account::Account>, ()> {
    let state = state.lock().await;
    let accounts = state
        .client
        .get_accounts(None)
        .await
        .expect("error while getting accounts");
    Ok(accounts)
}

#[tauri::command]
async fn get_ticks(symbol: &str, length: u8) -> Result<GetTicksEOD, ()> {
    let interval = 0;
    let web_client: BoursoWebClient = get_client();

    let quotes = web_client
        .get_ticks(symbol, length.into(), interval)
        .await
        .expect("error while getting ticks");
    Ok(quotes)
}

#[tauri::command]
async fn add_scheduled_job(app: AppHandle, job: scheduler::Job) -> Result<(), ()> {
    let mut jobs = scheduler::load_jobs(&app.path().app_local_data_dir().unwrap()).unwrap();
    jobs.push(job);
    scheduler::save_jobs(&app.path().app_local_data_dir().unwrap(), jobs)
        .expect("error while saving job");
    Ok(())
}

#[tauri::command]
async fn get_scheduled_jobs(app: AppHandle) -> Result<Vec<scheduler::Job>, ()> {
    Ok(
        scheduler::load_jobs(&app.path().app_local_data_dir().unwrap())
            .expect("error while getting jobs"),
    )
}

#[tauri::command]
async fn delete_scheduled_job(app: AppHandle, job_id: String) -> Result<(), ()> {
    scheduler::delete_job(&app.path().app_local_data_dir().unwrap(), &job_id)
        .expect("error while deleting job");
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let client = sentry::init((
        "https://7d2cf4cc64da1c0fcebd27e097aa2733@o4508812159156224.ingest.de.sentry.io/4508812162039888",
        sentry::ClientOptions {
            release: sentry::release_name!(),
            auto_session_tracking: true,
            ..Default::default()
        },
    ));

    let log_plugin = tauri_plugin_log::Builder::new()
        .target(tauri_plugin_log::Target::new(
            tauri_plugin_log::TargetKind::LogDir {
                file_name: Some("logs".to_string()),
            },
        ))
        .build();

    tauri::Builder::default()
        .plugin(log_plugin)
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_sentry::init(&client))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            init,
            init_client,
            get_accounts,
            get_ticks,
            is_dca_scheduler_setup,
            init_dca_scheduler,
            add_scheduled_job,
            get_scheduled_jobs,
            delete_scheduled_job,
            deactivate_dca_scheduler,
            get_orders_cmd,
            get_saved_assets,
            save_assets,
            get_trading_summary,
            run_job_manually,
            new_order_cmd,
            get_mfas,
            submit_mfa,
        ])
        .setup(|app| {
            app.manage(Mutex::new(BoursoState {
                client: BoursoWebClient::new(),
                dca_without_password: false,
                jobs_to_run: vec![],
                mfas: vec![],
            }));
            block_on(async {
                if let Ok(matches) = app.cli().matches() {
                    if matches.subcommand.is_some() {
                        match cli::cli_handler(app, matches).await {
                            Ok(_) => {
                                exit(-1);
                            }
                            Err(e) => {
                                // if error contains "password not found" then we open the desktop app
                                if e.to_string().contains("password not found") {
                                    // by returning nothing, we open the desktop app
                                } else {
                                    exit(-1);
                                }
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
