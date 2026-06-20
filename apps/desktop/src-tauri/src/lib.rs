mod fs_commands;
mod window_commands;

use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            window_commands::restore_or_create_window(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::Focused(true) => {
                let label = window.label().to_string();
                let title = window.title().unwrap_or_default();
                window_commands::handle_window_focused(&label, &title);
            }
            WindowEvent::Destroyed => {
                window_commands::handle_window_destroyed(window.app_handle());
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
