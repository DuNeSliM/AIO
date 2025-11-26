// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            println!("Second instance detected with args: {:?}", argv);
            
            // Find deep link in arguments
            for arg in argv.iter() {
                if arg.starts_with("aio://") {
                    println!("Deep link from second instance: {}", arg);
                    
                    // Send to the main window and focus it
                    if let Some(window) = app.get_window("main") {
                        let _ = window.emit("deep-link", arg.clone());
                        let _ = window.set_focus();
                    }
                    break;
                }
            }
        }))
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            
            // Check if app was launched with a deep link URL
            let args: Vec<String> = std::env::args().collect();
            for arg in args.iter() {
                if arg.starts_with("aio://") {
                    println!("Deep link received on startup: {}", arg);
                    let _ = window.emit("deep-link", arg.clone());
                    break;
                }
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
