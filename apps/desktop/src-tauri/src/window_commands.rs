use crate::fs_commands::config_dir;
use std::fs;
use std::path::PathBuf;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

const NOTEBOOK_PREFIX: &str = "nb-";
const LIST_LABEL: &str = "list";
const LAST_WINDOW_FILE: &str = "last_window.json";
const DEFAULT_WIDTH: f64 = 1024.0;
const DEFAULT_HEIGHT: f64 = 720.0;
const MIN_WIDTH: f64 = 680.0;
const MIN_HEIGHT: f64 = 500.0;
const CASCADE_OFFSET: f64 = 28.0;
const CASCADE_MARGIN: f64 = 8.0;

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct LastWindow {
    pub token: String,
    pub name: String,
}

fn last_window_path() -> PathBuf {
    PathBuf::from(config_dir()).join(LAST_WINDOW_FILE)
}

fn project_id_from_token(token: &str) -> &str {
    token.split('_').next().unwrap_or(token)
}

fn notebook_label(token: &str) -> String {
    format!("{NOTEBOOK_PREFIX}{token}")
}

fn write_last_window(last: &LastWindow) {
    let path = last_window_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(data) = serde_json::to_string(last) {
        let _ = fs::write(&path, data);
    }
}

pub fn read_last_window() -> Option<LastWindow> {
    let data = fs::read_to_string(last_window_path()).ok()?;
    serde_json::from_str(&data).ok()
}

fn focus_existing(app: &tauri::AppHandle, label: &str) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.unminimize();
        window.set_focus().map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

fn build_window(
    app: &tauri::AppHandle,
    label: &str,
    title: &str,
    position: Option<(f64, f64)>,
    centered: bool,
) -> Result<tauri::WebviewWindow, String> {
    let mut builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .title(title)
        .inner_size(DEFAULT_WIDTH, DEFAULT_HEIGHT)
        .min_inner_size(MIN_WIDTH, MIN_HEIGHT);
    if let Some((x, y)) = position {
        builder = builder.position(x, y);
    } else if centered {
        builder = builder.center();
    }
    builder.build().map_err(|e| e.to_string())
}

fn cascade_position(caller: &tauri::Window) -> (f64, f64) {
    let scale = caller.scale_factor().unwrap_or(1.0).max(1.0);
    let base = caller
        .outer_position()
        .map(|p| (p.x as f64 / scale, p.y as f64 / scale))
        .unwrap_or((120.0, 80.0));
    let mut x = base.0 + CASCADE_OFFSET;
    let mut y = base.1 + CASCADE_OFFSET;

    if let Ok(Some(monitor)) = caller.current_monitor() {
        let mon_pos = monitor.position();
        let mon_size = monitor.size();
        let mon_x = mon_pos.x as f64 / scale;
        let mon_y = mon_pos.y as f64 / scale;
        let mon_w = mon_size.width as f64 / scale;
        let mon_h = mon_size.height as f64 / scale;
        let max_x = mon_x + mon_w - DEFAULT_WIDTH - CASCADE_MARGIN;
        let max_y = mon_y + mon_h - DEFAULT_HEIGHT - CASCADE_MARGIN;
        if max_x > mon_x + CASCADE_MARGIN {
            x = x.clamp(mon_x + CASCADE_MARGIN, max_x);
        }
        if max_y > mon_y + CASCADE_MARGIN {
            y = y.clamp(mon_y + CASCADE_MARGIN, max_y);
        }
    }

    (x, y)
}

fn find_notebook_window(app: &tauri::AppHandle, project_id: &str) -> Option<tauri::WebviewWindow> {
    app.webview_windows().into_values().find(|window| {
        window
            .label()
            .strip_prefix(NOTEBOOK_PREFIX)
            .is_some_and(|token| project_id_from_token(token) == project_id)
    })
}

#[tauri::command]
pub fn open_notebook_window(
    app: tauri::AppHandle,
    caller: tauri::Window,
    token: String,
    name: String,
) -> Result<(), String> {
    let project_id = project_id_from_token(&token);

    if let Some(window) = find_notebook_window(&app, project_id) {
        let _ = window.unminimize();
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let label = notebook_label(&token);
    let position = cascade_position(&caller);
    let window = build_window(&app, &label, &name, Some(position), false)?;
    let _ = window.set_focus();
    write_last_window(&LastWindow {
        token: token.clone(),
        name: name.clone(),
    });
    Ok(())
}

#[tauri::command]
pub fn open_list_window(app: tauri::AppHandle, caller: tauri::Window) -> Result<(), String> {
    if focus_existing(&app, LIST_LABEL)? {
        return Ok(());
    }
    let position = cascade_position(&caller);
    let window = build_window(&app, LIST_LABEL, "TimeNote", Some(position), false)?;
    let _ = window.set_focus();
    Ok(())
}

pub fn restore_or_create_window(app: &tauri::AppHandle) {
    match read_last_window() {
        Some(last) => {
            let label = notebook_label(&last.token);
            if build_window(app, &label, &last.name, None, true).is_err() {
                let _ = build_window(app, LIST_LABEL, "TimeNote", None, true);
            }
        }
        None => {
            let _ = build_window(app, LIST_LABEL, "TimeNote", None, true);
        }
    }
}

pub fn handle_window_focused(label: &str, title: &str) {
    if let Some(token) = label.strip_prefix(NOTEBOOK_PREFIX) {
        write_last_window(&LastWindow {
            token: token.to_string(),
            name: title.to_string(),
        });
    }
}

pub fn handle_window_destroyed(app: &tauri::AppHandle) {
    if app.webview_windows().is_empty() {
        app.exit(0);
    }
}
