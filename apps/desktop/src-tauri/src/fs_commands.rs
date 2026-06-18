use std::fs;
use std::path::Path;

#[tauri::command]
pub fn config_dir() -> String {
    if let Ok(xdg) = std::env::var("XDG_CONFIG_HOME") {
        return format!("{}/timenote", xdg);
    }
    let home = std::env::var("HOME").unwrap_or_default();
    format!("{}/.config/timenote", home)
}

#[tauri::command]
pub fn fs_mkdir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_write_text_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_read_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_write_file(path: String, data: Vec<u8>) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_remove(path: String, recursive: Option<bool>) -> Result<(), String> {
    if recursive.unwrap_or(false) {
        fs::remove_dir_all(&path).map_err(|e| e.to_string())
    } else {
        fs::remove_file(&path).or_else(|_| fs::remove_dir(&path)).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn fs_exists(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).exists())
}

#[derive(serde::Serialize)]
pub struct DirEntry {
    pub name: String,
    pub is_directory: bool,
}

#[tauri::command]
pub fn fs_read_dir(path: String) -> Result<Vec<DirEntry>, String> {
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        result.push(DirEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            is_directory: file_type.is_dir(),
        });
    }
    Ok(result)
}

#[tauri::command]
pub fn fs_rename(from: String, to: String) -> Result<(), String> {
    fs::rename(&from, &to).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_copy_file(from: String, to: String) -> Result<(), String> {
    fs::copy(&from, &to).map_err(|e| e.to_string())?;
    Ok(())
}
