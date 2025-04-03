use anyhow::Result;
use serde::{Deserialize, Serialize};
use tauri::{async_runtime::Mutex, command, AppHandle, Manager};
use tauri_plugin_store::StoreExt;

use crate::{scheduler::HISTORY_FILE_PATH, BoursoState};

/// Bourso is saving the orders for a year, let's save them longer with
/// this struct that gets saved locally
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OrderPassed {
    pub id: String,
    pub price: f64,
    pub args: OrderArgs,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OrderArgs {
    pub account: String,
    pub symbol: String,
    /// Quantity of shares
    ///
    /// Either quantity or amount should be set
    pub quantity: Option<u64>,
    /// Amount of money
    ///
    /// Either quantity or amount should be set
    pub amount: Option<f64>,
    pub side: String,
}

impl OrderArgs {
    /// Get the quantity of shares to buy/sell
    ///
    /// Since the user can set either quantity or amount, we need to check
    /// which one is set and return the corresponding value.
    ///
    /// To calculate the quantity from the amount, we need to get the price
    /// from the web client.
    pub async fn get_qty(&self, web_client: &bourso_api::client::BoursoWebClient) -> Result<u64> {
        if let Some(amount) = self.amount {
            let quote = web_client.instrument_quote(&self.symbol).await;
            match quote {
                Ok(quote) => {
                    let qty = (amount / quote.last).floor();
                    return Ok(qty as u64);
                }
                Err(e) => {
                    return Err(anyhow::anyhow!(
                        "Error while getting price for {}: {:?}",
                        self.symbol,
                        e
                    ));
                }
            }
        }

        if let Some(quantity) = self.quantity {
            return Ok(quantity);
        }

        Err(anyhow::anyhow!("Either quantity or amount should be set"))
    }
}

pub async fn new_order(
    web_client: &bourso_api::client::BoursoWebClient,
    account: &str,
    symbol: &str,
    quantity: u64,
    side: &str,
) -> Result<(String, Option<f64>)> {
    let order_details = web_client
        .order(
            match side {
                "buy" => bourso_api::client::trade::order::OrderSide::Buy,
                "sell" => bourso_api::client::trade::order::OrderSide::Sell,
                _ => unimplemented!(),
            },
            &bourso_api::account::Account {
                id: account.to_string(),
                name: "".to_owned(),
                balance: 0,
                bank_name: "".to_owned(),
                kind: bourso_api::account::AccountKind::Trading,
            },
            symbol,
            quantity.try_into().unwrap(),
            None,
        )
        .await?;

    Ok(order_details)
}

#[command]
pub async fn new_order_cmd(
    app: AppHandle,
    account: String,
    symbol: String,
    quantity: u64,
    side: String,
) -> core::result::Result<OrderPassed, String> {
    let state = app.state::<Mutex<BoursoState>>();
    let st = state.lock().await;
    let web_client = &st.client;

    match web_client.is_market_open(&symbol).await {
        Ok(false) => {
            return Err("Market is closed".to_string());
        }
        Err(e) => {
            return Err(format!("Error while checking if market is open: {:?}", e));
        }
        _ => {}
    }

    let order_details = new_order(web_client, &account, &symbol, quantity, &side)
        .await
        .expect("Error while creating order");

    let order = OrderPassed {
        id: order_details.0,
        price: order_details.1.unwrap(),
        args: OrderArgs {
            account: account.to_string(),
            symbol: symbol.to_string(),
            quantity: Some(quantity),
            amount: None,
            side: side.to_string(),
        },
    };

    let store = app
        .store(HISTORY_FILE_PATH)
        .expect("Error while getting store");

    let orders = store.get("orders").unwrap_or(serde_json::json!([]));
    let mut orders: Vec<OrderPassed> =
        serde_json::from_value(orders).expect("Error while parsing orders passed");
    orders.push(order.clone());
    store.set("orders", serde_json::json!(&orders));
    store.save().unwrap();

    Ok(order)
}

#[command]
pub fn get_orders_cmd(app: AppHandle) -> core::result::Result<Vec<OrderPassed>, ()> {
    Ok(get_orders(app).expect("Error while getting orders"))
}

pub fn get_orders(app: AppHandle) -> Result<Vec<OrderPassed>> {
    let order_file = app.store(HISTORY_FILE_PATH)?;
    let orders = order_file.get("orders").unwrap_or(serde_json::json!([]));
    let orders: Vec<OrderPassed> = serde_json::from_value(orders)?;
    Ok(orders)
}
