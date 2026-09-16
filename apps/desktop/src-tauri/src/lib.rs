mod automation;
mod fs_commands;
mod window_commands;

use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // focus the most recently used window when a second instance launches
            if let Some(last) = window_commands::read_last_window() {
                let project_id = last.token.split('_').next().unwrap_or("").to_string();
                if !project_id.is_empty() {
                    if let Some(label) = app
                        .webview_windows()
                        .keys()
                        .find(|l| l.starts_with("nb-") && l[3..].starts_with(&project_id))
                    {
                        if let Some(window) = app.get_webview_window(label) {
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                        return;
                    }
                }
            }
            if let Some(window) = app.get_webview_window("list") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .manage(automation::AutomationState::new())
        .setup(|app| {
            window_commands::restore_or_create_window(app.handle());
            let handle = app.handle().clone();
            let state = app.state::<automation::AutomationState>();
            if let Err(e) = automation::ensure_server(&handle, &state) {
                eprintln!("[automation] failed to start server: {e}");
            }
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::Focused(true) => {
                let label = window.label().to_string();
                let title = window.title().unwrap_or_default();
                window_commands::handle_window_focused(&label, &title);
            }
            WindowEvent::Destroyed => {
                let app = window.app_handle();
                automation::handle_window_destroyed(app, window.label());
                window_commands::handle_window_destroyed(app);
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            fs_commands::config_dir,
            fs_commands::fs_mkdir,
            fs_commands::fs_read_text_file,
            fs_commands::fs_write_text_file,
            fs_commands::fs_read_file,
            fs_commands::fs_write_file,
            fs_commands::fs_remove,
            fs_commands::fs_exists,
            fs_commands::fs_read_dir,
            fs_commands::fs_rename,
            fs_commands::fs_copy_file,
            window_commands::open_notebook_window,
            window_commands::open_list_window,
            automation::commands::automation_register_runtime,
            automation::commands::automation_claim_requests,
            automation::commands::automation_complete_request,
            automation::commands::automation_prepare_operation,
            automation::commands::automation_status,
            automation::commands::automation_set_enabled,
            automation::commands::automation_set_allowed_notebooks,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
