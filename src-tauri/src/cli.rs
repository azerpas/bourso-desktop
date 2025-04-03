use anyhow::Result;
use tauri::App;
use tauri_plugin_cli::Matches;

use crate::scheduler;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct Order {
    pub id: String,
    pub price: f64,
    pub account: String,
    pub symbol: String,
    pub quantity: u64,
    pub side: String,
}

pub async fn cli_handler(app: &mut App, matches: Matches) -> Result<()> {
    if let Some(subcommand) = matches.subcommand {
        match subcommand.name.as_str() {
            "trade" => {
                if let Some(trade_subcommand) = subcommand.matches.subcommand {
                    match trade_subcommand.name.as_str() {
                        "orders" => {
                            return scheduler::run(app).await;
                        }
                        "liquidate" => todo!(),
                        _ => {}
                    }
                }
            }
            "transfer" => todo!(),
            _ => {}
        }
    }
    Ok(())
}
