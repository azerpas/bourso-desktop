use anyhow::Result;
use std::process::Command;
use tauri::{command, path::BaseDirectory, Manager};

#[cfg(unix)]
use croner::Cron;

use crate::files::get_app_data_dir;

const SHELL_SCRIPT: &str = "run_if_needed.sh";

#[cfg(unix)]
#[command]
pub fn is_dca_scheduler_setup() -> Result<bool, String> {
    crontab_contains()
}

#[cfg(windows)]
#[command]
pub fn is_dca_scheduler_setup() -> Result<bool, String> {
    // TODO: windows
    Ok(false)
}

#[cfg(unix)]
fn crontab_contains() -> Result<bool, String> {
    let output = Command::new("crontab")
        .arg("-l")
        .output()
        .expect("Could not execute crontab command");
    if output.status.success() {
        let content = String::from_utf8_lossy(&output.stdout);

        for line in content.lines() {
            if line.contains(SHELL_SCRIPT) {
                return Ok(true);
            }
        }

        Ok(false)
    } else {
        Err("Error while getting crontab".to_string())
    }
}

/// Makes the script file that will be run by the scheduler have the correct path
/// to the data directory and the command path.
pub fn modify_script_file(app: &tauri::AppHandle) -> Result<(), String> {
    let resource_path = app
        .path()
        .resolve(SHELL_SCRIPT, BaseDirectory::Resource)
        .expect("Failed to resolve resource path");

    let command_path = std::env::current_exe().expect("Failed to get current executable path");
    if !command_path.exists() {
        return Err("Command path does not exist".to_string());
    }
    let command_path = command_path
        .to_str()
        .expect("Failed to convert command path to string");

    let data_dir = get_app_data_dir(app).unwrap();

    // In .sh, replace /path/to/data_dir with the actual data_dir
    let mut content =
        std::fs::read_to_string(resource_path.clone()).expect("Failed to read resource file");
    content = content.replace("/path/to/data_dir", data_dir.to_str().unwrap());
    // replace /path/to/my_program with the actual command path
    content = content.replace("/path/to/my_program", command_path);

    std::fs::write(&resource_path, content).expect("Failed to write script file");

    Ok(())
}

#[command]
pub fn init_dca_scheduler(app: tauri::AppHandle) -> Result<(), String> {
    let resource_path = app
        .path()
        .resolve(SHELL_SCRIPT, BaseDirectory::Resource)
        .expect("Failed to resolve resource path");

    modify_script_file(&app)?;

    let dca_logs = app
        .path()
        .app_log_dir()
        .expect("Failed to get app log directory")
        .join("dca.log");

    #[cfg(unix)]
    match add_to_scheduler(
        format!(
            r#"*/5 * * * * {} > {} 2>&1"#,
            resource_path.to_str().unwrap(),
            dca_logs.to_str().unwrap()
        )
        .as_str(),
    ) {
        Ok(_) => {}
        Err(e) => return Err(e),
    }

    // On MacOS, give execute permission and run the script once
    #[cfg(target_os = "macos")]
    give_perm(&resource_path).expect("Failed to give permission");

    Ok(())

    // TODO: Windows
}

#[cfg(windows)]
#[command]
pub fn deactivate_dca_scheduler(app: tauri::AppHandle) -> Result<(), String> {
    // TODO: Windows
    Ok(())
}

#[cfg(unix)]
#[command]
pub fn deactivate_dca_scheduler(app: tauri::AppHandle) -> Result<(), String> {
    let resource_path = app
        .path()
        .resolve(SHELL_SCRIPT, BaseDirectory::Resource)
        .expect("Failed to resolve resource path");

    remove_from_scheduler(format!("*/5 * * * * {}", resource_path.to_str().unwrap()).as_str())
}

#[cfg(unix)]
pub fn add_to_scheduler(cron_job: &str) -> Result<(), String> {
    let schedule = cron_job
        .split_whitespace()
        .take(5)
        .collect::<Vec<&str>>()
        .join(" ");

    assert!(
        Cron::new(&schedule).parse().is_ok(),
        "Invalid cron schedule"
    );

    let output = Command::new("crontab")
        .arg("-l")
        .output()
        .map_err(|e| e.to_string())
        .expect("Failed to list cron jobs");

    let mut content = String::from_utf8_lossy(&output.stdout).to_string();
    content.push('\n');
    const PACKAGE_NAME: &str = env!("CARGO_PKG_NAME");
    content.push_str(format!("# {} schedule cron job\n", PACKAGE_NAME).as_str());
    content.push_str(cron_job);
    content.push('\n');

    // Write to temporary file
    let temp_file = tempfile::NamedTempFile::new().expect("Failed to create temporary file");
    std::fs::write(temp_file.path(), content).expect("Failed to write to temporary file");

    // Install new crontab
    let result = Command::new("crontab")
        .arg(temp_file.path())
        .output()
        .expect("Failed to install new crontab");

    if !result.status.success() {
        return Err("Failed to install new crontab".to_string());
    }

    println!("Result: {:?}", result);

    Ok(())
}

#[cfg(target_os = "macos")]
pub fn give_perm(resource_path: &std::path::PathBuf) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    use log::debug;

    debug!("Giving perms to: {:?}", resource_path);

    // Give execute permission
    std::fs::metadata(resource_path)
        .unwrap()
        .permissions()
        .set_mode(0o755);

    Ok(())
}

#[cfg(unix)]
pub fn remove_from_scheduler(cron_job: &str) -> Result<(), String> {
    let output = Command::new("crontab")
        .arg("-l")
        .output()
        .map_err(|e| e.to_string())
        .expect("Failed to list cron jobs");

    let content = String::from_utf8_lossy(&output.stdout).to_string();
    let mut new_content = String::new();
    let mut found = false;

    const PACKAGE_NAME: &str = env!("CARGO_PKG_NAME");
    let comment = format!("# {} schedule cron job", PACKAGE_NAME);

    for line in content.lines() {
        if line.contains(cron_job) || line.contains(comment.as_str()) {
            found = true;
        } else {
            new_content.push_str(line);
            new_content.push('\n');
        }
    }

    if !found {
        return Err("Cron job not found".to_string());
    }

    // Write to temporary file
    let temp_file = tempfile::NamedTempFile::new().expect("Failed to create temporary file");
    std::fs::write(temp_file.path(), new_content).expect("Failed to write to temporary file");

    // Install new crontab
    let status = Command::new("crontab")
        .arg(temp_file.path())
        .status()
        .expect("Failed to install new crontab");

    if !status.success() {
        return Err("Failed to install new crontab".to_string());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_list_unix_cron_jobs() {
        #[cfg(unix)]
        let result = crontab_contains();
        assert!(result.is_ok());
        println!("{:?}", result.unwrap());
    }

    #[test]
    fn test_add_to_crontab() {
        let tmp_dir = tempfile::tempdir().expect("Failed to create temporary directory");
        let tmp_file = tmp_dir.path().join(SHELL_SCRIPT);
        std::fs::write(&tmp_file, "#!/bin/bash\necho 'Hello, world!'")
            .expect("Failed to write to temporary file");

        let cron_job = format!("0 * * * * {}", tmp_file.to_str().unwrap());
        #[cfg(unix)]
        let result = add_to_scheduler(cron_job.as_str());
        // TODO: Windows

        #[cfg(target_os = "macos")]
        give_perm(&tmp_file).expect("Failed to give permission");

        tmp_dir
            .close()
            .expect("Failed to delete temporary directory");

        assert!(result.is_ok());
    }

    #[test]
    fn test_remove_from_crontab() {
        let cron_job = format!("0 * * * * /path/to/command/{}", SHELL_SCRIPT);
        #[cfg(unix)]
        let result = remove_from_scheduler(cron_job.as_str());
        // TODO: Windows
        assert!(result.is_ok());
    }
}
