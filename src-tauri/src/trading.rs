use bourso_api::{account::Account, client::trade::TradingSummaryItem};
use tauri::{async_runtime::Mutex, command, State};

use crate::BoursoState;

#[command]
pub async fn get_trading_summary(
    account_id: String,
    state: State<'_, Mutex<BoursoState>>,
) -> core::result::Result<Vec<TradingSummaryItem>, String> {
    let state = state.lock().await;

    match state
        .client
        .get_trading_summary(Account {
            id: account_id,
            ..Account::default()
        })
        .await
    {
        Ok(summary) => Ok(summary),
        Err(e) => Err(format!("Error while getting trading summary: {:?}", e)),
    }
}
