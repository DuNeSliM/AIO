#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;

#[tauri::command]
fn launch_game(platform: String, id: Option<String>, app_name: Option<String>) -> Result<String, String> {
    println!("[Tauri] Launch request - platform: {}, id: {:?}, app_name: {:?}", platform, id, app_name);
    
    // Determine the identifier to use
    let identifier = app_name.clone().or(id.clone()).ok_or("Missing game identifier")?;
    
    #[cfg(target_os = "windows")]
    {
        let uri = match platform.as_str() {
            "steam" => {
                // Steam uses numeric app IDs
                format!("steam://rungameid/{}", identifier)
            },
            "epic" => {
                // Epic Games uses app IDs with launcher protocol
                // Try multiple formats as Epic can be finicky
                format!("com.epicgames.launcher://apps/{}?action=launch&silent=true", identifier)
            },
            "gog" => {
                // GOG Galaxy uses product IDs
                format!("goggalaxy://openGameView/{}", identifier)
            },
            _ => return Err(format!("Unsupported platform: {}", platform)),
        };

        println!("[Tauri] Launching with URI: {}", uri);

        // Use Windows cmd to launch the URI
        let output = Command::new("cmd")
            .args(&["/C", "start", "", &uri])
            .spawn()
            .map_err(|e| format!("Failed to start game: {}", e))?;

        println!("[Tauri] Game launch initiated successfully");
        Ok(format!("Started {} game", platform))
    }

    #[cfg(target_os = "macos")]
    {
        let uri = match platform.as_str() {
            "steam" => format!("steam://rungameid/{}", identifier),
            "epic" => format!("com.epicgames.launcher://apps/{}?action=launch", identifier),
            "gog" => format!("goggalaxy://openGameView/{}", identifier),
            _ => return Err(format!("Unsupported platform: {}", platform)),
        };

        Command::new("open")
            .arg(&uri)
            .spawn()
            .map_err(|e| format!("Failed to start game: {}", e))?;

        Ok(format!("Started {} game", platform))
    }

    #[cfg(target_os = "linux")]
    {
        let uri = match platform.as_str() {
            "steam" => format!("steam://rungameid/{}", identifier),
            "epic" => return Err("Epic Games not well supported on Linux".to_string()),
            "gog" => return Err("GOG Galaxy not available on Linux".to_string()),
            _ => return Err(format!("Unsupported platform: {}", platform)),
        };

        // Try xdg-open first
        Command::new("xdg-open")
            .arg(&uri)
            .spawn()
            .map_err(|e| format!("Failed to start game: {}", e))?;

        Ok(format!("Started {} game", platform))
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Unsupported operating system".to_string())
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![launch_game])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
