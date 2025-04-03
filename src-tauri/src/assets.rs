use anyhow::Result;
use tauri::{command, AppHandle};

use crate::files::get_app_data_dir;

#[command]
pub fn get_saved_assets(app: AppHandle) -> Result<Vec<String>, ()> {
    let assets_file = get_app_data_dir(&app).unwrap().join("assets.json");

    // if assets file does not exist or empty, save default assets
    if !assets_file.exists() || assets_file.metadata().unwrap().len() == 0 {
        // save default assets
        let assets = vec![
            "1rTWPEA".to_string(),
            "1rTPSP5".to_string(),
            "1rTAEEM".to_string(),
        ];
        let assets_str = serde_json::to_string(&assets).expect("Failed to serialize assets");
        std::fs::write(&assets_file, assets_str).expect("Failed to write assets file");
        return Ok(assets);
    }

    let assets = std::fs::read_to_string(assets_file).expect("Failed to read assets file");
    let assets: Vec<String> = serde_json::from_str(&assets).expect("Failed to parse assets file");
    Ok(assets)
}

#[command]
pub fn save_assets(app: AppHandle, assets: Vec<String>) -> Result<(), ()> {
    let assets_file = get_app_data_dir(&app).unwrap().join("assets.json");

    let assets_str = serde_json::to_string(&assets).expect("Failed to serialize assets");
    std::fs::write(&assets_file, assets_str).expect("Failed to write assets file");
    Ok(())
}
