mod fs_commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
