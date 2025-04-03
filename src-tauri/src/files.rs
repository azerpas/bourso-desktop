use std::path::PathBuf;

use anyhow::Result;
use tauri::AppHandle;
use tauri::Manager;

/// Get the app data directory and create it if it does not exist
pub fn get_app_data_dir(app: &AppHandle) -> Result<PathBuf> {
    let data_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data directory");

    if !data_dir.exists() {
        // create data dir
        std::fs::create_dir_all(&data_dir).expect("Failed to create data dir");
    }

    Ok(data_dir)
}
